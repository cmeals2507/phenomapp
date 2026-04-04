# PhenomApp — Feature Specification (v2.1)

> **Purpose of this document**: Authoritative reference for the app's current state. Use this when scoping new features — identify what already exists, what files own each concern, and what conventions to follow.
>
> **v2.1 changes from v2.0**: Stage 3 UI redesigned to match the approved mockup (per-row theme entry and Stage 3 Notes, not a global notes field or popover-based tag assignment). Transcript theme highlighting added as Section 6B. Section 5A fully rewritten. `ThemeTaggingView` component behavior updated throughout.
>
> **v2.0 changes from v1.0**: Stage 3 (Provisional Themes) substantially redesigned. Four new feature areas added: theme tagging on meaning units, dual-view toggle in Stage 3, transcript search, stage search, and day-locked timestamps on all analyst-entered content. See sections 5A, 5B, 6A, and 16.

---

## 1. Purpose & Context

PhenomApp is a local-first macOS desktop application for conducting **hermeneutic phenomenological analysis** of qualitative interview transcripts. It supports three workflow conditions (used in comparative research):

| Badge | Value in DB | Meaning |
|-------|-------------|---------|
| H     | `'human'`   | Human-only analysis |
| HM    | `'hybrid'`  | Human-machine hybrid |
| M     | `'machine'` | Machine-only analysis |

The app has no LLM integration, no network calls, and no authentication. It is a structured data container with a five-stage analysis pipeline.

---

## 2. Architecture

### Stack

| Layer | Tech | Version |
|-------|------|---------|
| Desktop runtime | Electron | 30.5.1 |
| UI framework | React + Vite | 18.3.1 / 5.4.11 |
| Styling | Tailwind CSS | 3.4.17 |
| Database | SQLite via `better-sqlite3` | 9.6.0 |
| CSV export | `csv-stringify` | 6.5.2 |
| Packaging | `electron-builder` | 24.13.3 |

### Process Model

```
main.js                         — Electron main process
  ├── IPC handlers              — all file I/O, DB reads/writes
  ├── Database init             — opens .db, runs schema
  ├── Menu setup                — macOS app menu + About window
  └── Window lifecycle

preload.js                      — context bridge (sandboxed)
  └── window.phenomAPI          — exposes IPC to renderer

src/
  App.jsx                       — root; owns openTabs + selectedCase state
  components/
    Sidebar.jsx                 — case list, import, export, DB switcher
    TranscriptPanel.jsx         — read-only transcript display + search bar
    StageArea.jsx               — tab bar + panel layout
    FreeformStage.jsx           — stages 1, 4, 5 (textarea)
    MeaningUnitsStage.jsx       — stage 2 (structured table)
    ProvisionalThemesStage.jsx  — stage 3 (NEW — replaces FreeformStage for themes tab)
    ThemeTaggingView.jsx        — stage 3 View 1: per-row theme entry table
    ThemeGroupedView.jsx        — stage 3 View 2: grouped/collapsed by theme
    ImportModal.jsx             — import form
    DatabaseModal.jsx           — DB switcher form
  db/
    schema.js                   — CREATE TABLE IF NOT EXISTS definitions
    queries.js                  — all SQL operations
  utils/
    autoSave.js                 — useAutoSave hook (3s debounce)
    exportFormatters.js         — single-case .txt + corpus CSV formatters
    timestamps.js               — day-locked timestamp logic (NEW)
    fuzzyMatch.js               — excerpt-to-transcript fuzzy matching for theme highlights (NEW)
```

### Security Model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`
- Renderer accesses nothing but `window.phenomAPI` (contextBridge)
- All file and DB operations live in main process

---

## 3. Layout

Three-panel layout, always visible once a case is selected:

```
┌──────────┬──────────────────────┬──────┬──────────────────────┐
│ SIDEBAR  │  TRANSCRIPT PANEL    │ drag │   STAGE AREA         │
│ (200px)  │  (default 380px)     │  bar │   (flex remaining)   │
│          │  resizable 200-700px  │      │                      │
└──────────┴──────────────────────┴──────┴──────────────────────┘
```

**Sidebar** (fixed 200px):
- "+ Import Transcript" button → opens ImportModal
- Scrollable case list (participant ID + workflow badge + 5 completion dots)
- "Export All (Corpus)" button → folder picker → 2 CSV files
- "DB: {filename}" button → opens DatabaseModal

**Transcript Panel** (resizable, CSS min 200 / max 700):
- Header: participant ID, workflow label, "Export" button
- Search bar: see Section 6A
- Body: read-only monospace `pre` of `raw_text`; highlights search matches inline
- Footer: word count + match count when search is active

**Resize Divider** (4px): drag to resize transcript panel; cursor `col-resize`; min/max enforced in `mouseMove` handler

**Stage Area**:
- Tab bar: 5 numbered tabs (max 2 open simultaneously)
- Content: 50/50 split when 2 open, 100% when 1 open
- Empty state placeholder when no tabs open

---

## 4. Data Model

### Database location

| Type | Path |
|------|------|
| Default | `~/Library/Application Support/PhenomApp/phenomapp.db` |
| Settings | `~/Library/Application Support/PhenomApp/settings.json` |
| Alternate | Any user-selected `.db` / `.sqlite` / `.sqlite3` file |

`settings.json` schema: `{ "dbPath": "/absolute/path/to/file.db" }`

### Tables

#### `transcripts`

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
participant_id  TEXT NOT NULL
raw_text        TEXT NOT NULL          -- immutable after import
workflow        TEXT NOT NULL          -- 'human' | 'hybrid' | 'machine'
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
UNIQUE (participant_id, workflow)
```

#### `stage_outputs`

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
transcript_id   INTEGER NOT NULL REFERENCES transcripts(id)
stage           TEXT NOT NULL          -- 'memo' | 'themes' | 'whole_part' | 'essence'
content         TEXT                   -- NULL or '' = not started
day_stamps      TEXT                   -- JSON array of {date, first_edited_at} — see Section 16
updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
UNIQUE (transcript_id, stage)
```

Four rows are created per transcript on import (one per freeform stage).

#### `meaning_units`

```sql
id                        INTEGER PRIMARY KEY AUTOINCREMENT
transcript_id             INTEGER NOT NULL REFERENCES transcripts(id)
workflow                  TEXT NOT NULL
mu_order                  INTEGER NOT NULL   -- 1-indexed, user-reorderable
excerpt                   TEXT
boundary_justification    TEXT
paraphrase                TEXT
analyst_note              TEXT
day_stamps                TEXT               -- JSON array of {date, first_edited_at} — see Section 16
updated_at                DATETIME DEFAULT CURRENT_TIMESTAMP
```

Zero or more rows per transcript. No unique constraint (multiple units allowed).

#### `themes` (NEW)

One row per named theme per transcript. Themes are created inline in Stage 3 — the first time a label is typed and confirmed, a row is inserted here.

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
transcript_id   INTEGER NOT NULL REFERENCES transcripts(id)
workflow        TEXT NOT NULL
label           TEXT NOT NULL          -- analyst-defined theme name
color           TEXT NOT NULL          -- hex color string, e.g. '#6366f1'
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
UNIQUE (transcript_id, workflow, label)
```

#### `meaning_unit_themes` (NEW)

Junction table. A meaning unit can belong to multiple themes; a theme can contain multiple meaning units.

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
meaning_unit_id INTEGER NOT NULL REFERENCES meaning_units(id)
theme_id        INTEGER NOT NULL REFERENCES themes(id)
assigned_at     DATETIME DEFAULT CURRENT_TIMESTAMP
UNIQUE (meaning_unit_id, theme_id)
```

### Completion tracking

Computed at query time (not stored):

```sql
completed_stages =
  COUNT(stage_outputs WHERE content NOT NULL AND content != '')   -- stages 1,3,4,5
  + CASE WHEN meaning_units exist for transcript THEN 1 ELSE 0   -- stage 2
```

Note: Stage 3 completion is still tracked via `stage_outputs.content` (the freeform notes field in the themes tab — see Section 5A). Theme tagging activity does not separately count toward completion.

---

## 5. Five-Stage Analysis Pipeline

| Tab # | Stage key       | Label                     | Component               | Data stored in                        |
|-------|-----------------|---------------------------|-------------------------|---------------------------------------|
| 1     | `memo`          | Holistic Memo             | FreeformStage           | `stage_outputs`                       |
| 2     | `meaning_units` | Meaning Units             | MeaningUnitsStage       | `meaning_units`                       |
| 3     | `themes`        | Provisional Themes        | ProvisionalThemesStage  | `themes`, `meaning_unit_themes`, `stage_outputs` |
| 4     | `whole_part`    | Whole-Part Reconciliation | FreeformStage           | `stage_outputs`                       |
| 5     | `essence`       | Individual Essence        | FreeformStage           | `stage_outputs`                       |

### Tab behavior

- Click a closed tab: opens it (if < 2 open)
- Click an open tab: closes it
- Click a new tab when 2 are open: replaces the oldest (keeps the newer one + new one)
- Max 2 tabs open simultaneously

### FreeformStage behavior (Stages 1, 4, 5)

1. Mount → IPC `getStageOutput({transcriptId, stage})` → populate textarea
2. User types → `useAutoSave` debounce (3s) → IPC `saveStageOutput({transcriptId, stage, content})`
3. Footer: "Last saved HH:MM:SS" (success) or "Save failed — check disk space" (error)
4. On `phenomapp:flush-saves` event → immediate save (called before app quit)
5. Day-locked timestamps appended per Section 16

### MeaningUnitsStage behavior (Stage 2)

Table columns: `ID (read-only)` | `Excerpt` | `Boundary Justification` | `Paraphrase` | `Analyst Note` | `✕ Delete`

- ID displayed as `MU-001`, `MU-002`, etc.
- "+ Add Row" → IPC `addMeaningUnit({transcriptId, workflow})` → new row with next `mu_order`
- Cell edit → marks unit dirty → 3s debounce → IPC `saveMeaningUnit({id, ...fields})`
- Drag-and-drop reorder → recalculate all `mu_order` values → IPC `reorderMeaningUnits([{id, mu_order}])`
- Delete (✕) → confirmation dialog → IPC `deleteMeaningUnit(id)`
- Day-locked timestamps tracked per Section 16

---

## 5A. Stage 3 — Provisional Themes (Redesigned — v2.1)

Stage 3 is a dedicated component (`ProvisionalThemesStage`) with two views toggled by a segmented control. The core data model is **per-row**: each meaning unit row carries its own Provisional Theme label, color, and Stage 3 Notes field. There is no global notes field and no popover-based tag system. The mockup is authoritative for layout.

---

### Data model clarification for Stage 3

The `themes` table and `meaning_unit_themes` junction table from v2.0 are **replaced** by a simpler per-row model:

- `provisional_theme` (TEXT) — analyst-entered theme label for this meaning unit
- `theme_color` (TEXT) — hex color selected for this row's theme
- `stage3_notes` (TEXT) — analyst-entered notes specific to this row at Stage 3

These three columns are added to the `meaning_units` table via `ALTER TABLE`. They are NULL until the analyst enters them in Stage 3.

The `themes` table and `meaning_unit_themes` table from v2.0 are **not built**. Remove them from `schema.js` if previously added. Theme identity is inferred at query time by grouping on `provisional_theme` value — not stored as a separate entity.

Updated `meaning_units` table (full definition):

```sql
id                        INTEGER PRIMARY KEY AUTOINCREMENT
transcript_id             INTEGER NOT NULL REFERENCES transcripts(id)
workflow                  TEXT NOT NULL
mu_order                  INTEGER NOT NULL
excerpt                   TEXT
boundary_justification    TEXT
paraphrase                TEXT
analyst_note              TEXT
provisional_theme         TEXT               -- NEW: analyst-entered theme label
theme_color               TEXT               -- NEW: hex color for this theme
stage3_notes              TEXT               -- NEW: per-row Stage 3 analyst notes
day_stamps                TEXT
updated_at                DATETIME DEFAULT CURRENT_TIMESTAMP
```

`ALTER TABLE` additions for schema migration (wrap in try/catch — safe to re-run):

```sql
ALTER TABLE meaning_units ADD COLUMN provisional_theme TEXT;
ALTER TABLE meaning_units ADD COLUMN theme_color TEXT;
ALTER TABLE meaning_units ADD COLUMN stage3_notes TEXT;
```

---

### View Toggle

A segmented control in the Stage 3 header toggles between:

- **View 1 — Tagging View** (default): flat table, one row per meaning unit, all fields editable for Stage 3 columns
- **View 2 — Grouped View**: meaning units collapsed under their provisional theme label; Stage 3 Notes editable; provisional theme label and color not editable from this view

Toggle state is local UI state — resets to View 1 when the tab is closed and reopened.

---

### View 1 — Tagging View (`ThemeTaggingView.jsx`)

A table with one row per meaning unit. Columns left to right:

| Column | Source | Editable in View 1 |
|--------|--------|--------------------|
| Paraphrase | `meaning_units.paraphrase` | No |
| Stage 2 Notes | `meaning_units.analyst_note` | No |
| Provisional Theme | `meaning_units.provisional_theme` | **Yes** — text input |
| ▼ (color picker) | `meaning_units.theme_color` | **Yes** — dropdown swatch |
| Stage 3 Notes | `meaning_units.stage3_notes` | **Yes** — text input |

**Read-only columns** (`paraphrase`, `analyst_note`) display as plain text. They cannot be edited from any Stage 3 view — Stage 2 text is frozen once it reaches Stage 3.

**Provisional Theme input**: A plain text input field. The analyst types a theme label directly into the cell. No autocomplete or suggestions at MVP. On change, auto-save fires (3s debounce) → `saveMeaningUnit`. If two rows share the same `provisional_theme` string (case-sensitive match), they are treated as the same theme for grouping purposes in View 2 and for transcript highlighting.

**Color picker (▼)**: A small dropdown button showing the current color swatch (or a neutral gray placeholder if no theme is set). On click, opens a 10-swatch color grid using the predefined palette. Selecting a color sets `theme_color` for this row only and saves immediately (no debounce — direct IPC call). If `provisional_theme` is empty when a color is selected, accept the color anyway — the analyst may fill in the label afterward.

**Predefined color palette** (10 swatches, same as v2.0):
`#6366f1` (indigo), `#f59e0b` (amber), `#10b981` (emerald), `#ef4444` (red), `#3b82f6` (blue), `#8b5cf6` (violet), `#f97316` (orange), `#14b8a6` (teal), `#ec4899` (pink), `#84cc16` (lime)

**Stage 3 Notes input**: A plain text input (single-line) or small textarea per row. Auto-saves via 3s debounce → `saveMeaningUnit`. Day-locked timestamps tracked per Section 16.

If Stage 2 has no meaning units, show empty-state: *"No meaning units found. Complete Stage 2 first."*

#### Filtering and sorting in View 1

Filter/sort toolbar above the table:

- **Filter dropdown**: "All" (default) | "Untagged only" | "Tagged only" | [one entry per distinct `provisional_theme` value that exists across all rows]
- **Sort**: "Original order" (default, by `mu_order`) | "By theme" (alphabetical on `provisional_theme`; untagged rows at bottom)
- Filter and sort state are local UI state only

---

### View 2 — Grouped View (`ThemeGroupedView.jsx`)

Organizes meaning unit rows by their `provisional_theme` value. Each distinct theme becomes a collapsible block.

**Block header**:
```
▼ [color swatch] [Provisional Theme label]     (n units)
```
- Color swatch shows `theme_color` of the first row in that group (all rows sharing a theme label should have the same color, but if they differ, use the first row's color)
- Clicking the header collapses/expands the block
- Blocks expanded by default

**Block body** — one sub-row per meaning unit in this theme:

```
┌────────────────────────────┬──────────────────────────────────┐
│ Paraphrase text here...    │ [Stage 3 Notes — editable]       │
└────────────────────────────┴──────────────────────────────────┘
```

- `Paraphrase` is read-only
- `Stage 3 Notes` is an editable text input — auto-saves via `saveMeaningUnit` (3s debounce)
- `provisional_theme` label and `theme_color` are **not editable** from View 2. To rename or recolor a theme, the analyst must return to View 1.

**Untagged block**: A block at the bottom labeled "Untagged" containing all rows where `provisional_theme` is NULL or empty. No color swatch. Stage 3 Notes still editable within it.

**Empty state** (no themes defined yet): *"No themes defined yet. Switch to View 1 to begin tagging."*

**Case-sensitivity notice**: Display a static note directly above the View 2 content area (and also above the theme column header in View 1): *"Theme grouping is case-sensitive. 'Belonging' and 'belonging' are treated as different themes."* Style as a subdued info line (small gray text), not a warning or alert.

---

### IPC changes for Stage 3 (v2.1 revision)

Remove the `themes`, `createTheme`, `updateThemeColor`, `deleteTheme`, `assignTheme`, `unassignTheme`, and `getThemeAssignments` IPC calls from v2.0. They are not needed under the per-row model.

Stage 3 data flows entirely through the existing `saveMeaningUnit` and `getMeaningUnits` calls, which must now include the three new columns:

Updated `saveMeaningUnit` args: `{id, excerpt, boundary_justification, paraphrase, analyst_note, provisional_theme, theme_color, stage3_notes}`

Updated `getMeaningUnits` return: add `provisional_theme`, `theme_color`, `stage3_notes` to each object in the array.

Add one new IPC call for immediate (non-debounced) color save:

| Method | Args | Returns |
|--------|------|---------|
| `saveMeaningUnitColor({id, theme_color})` | — | `{success}` or `{error}` |

This exists solely because color changes should persist immediately on swatch click, without waiting for the 3s debounce that governs text fields.

---

### Completion tracking (Stage 3)

Stage 3 is considered complete when at least one meaning unit has a non-empty `provisional_theme`. This replaces the v2.0 rule (which tracked `stage_outputs.content` for the themes stage).

Update the completion query accordingly:

```sql
completed_stages =
  COUNT(stage_outputs WHERE content NOT NULL AND content != '')   -- stages 1, 4, 5
  + CASE WHEN meaning_units exist for transcript THEN 1 ELSE 0   -- stage 2
  + CASE WHEN any meaning_unit has provisional_theme NOT NULL AND provisional_theme != '' THEN 1 ELSE 0  -- stage 3
```

The `stage_outputs` row for `stage = 'themes'` is no longer created on import and is no longer used. Remove it from the import flow.

---

## 6. Auto-Save

Hook: `useAutoSave(saveFn, delay = 3000)` in `src/utils/autoSave.js`

- Debounce: 3000ms; timer resets on each keystroke
- Before app quit: main sends `app:flush-saves`; renderer forces immediate save; 800ms grace period

---

## 6A. Search (NEW)

Two mutually exclusive search features. They share no state, produce no cross-contamination of results, and are scoped independently.

---

### Transcript Search

**Location**: A search bar in the Transcript Panel header, below the participant ID / workflow line and above the transcript body.

**Behavior**:
- Input field with a clear (✕) button and match counter: "3 of 12 matches"
- Case-insensitive substring match against `raw_text`
- Matches highlighted inline in the transcript body using a `<mark>`-style highlight (yellow background)
- Up/down arrow buttons (or ↑↓ keyboard shortcuts) cycle through matches, scrolling the transcript to keep the active match in view
- Active match highlighted in a distinct color (orange) to distinguish it from passive matches (yellow)
- If no matches: counter shows "0 matches"; no highlights
- Search state (query string, active match index) is local to `TranscriptPanel` — cleared when a new case is selected

**Implementation note**: Because `raw_text` is rendered in a `pre` tag, the highlight pass must split the text into segments and render alternating plain-text and `<mark>` spans. Do not use `dangerouslySetInnerHTML` with unsanitized content.

---

### Stage Search

**Location**: A search bar in the header of each open stage panel, scoped to that panel only.

**Behavior**:
- Visible in all five stage panels
- In **FreeformStage** (stages 1, 4, 5) and the **Stage 3 Notes** field: searches the textarea content; highlights matches inline using the same mark/span pattern as transcript search; up/down navigation through matches
- In **MeaningUnitsStage** (stage 2): searches across all text fields (`excerpt`, `boundary_justification`, `paraphrase`, `analyst_note`) for all rows; highlights matching text within cells; rows with no matches are not hidden (keep table intact) but matched cells are visually highlighted
- In **ProvisionalThemesStage** (stage 3): searches the `paraphrase` and `analyst_note` fields of meaning unit rows in Tagging View, and the same fields in Grouped View; also searches Stage 3 Notes field
- Match counter and clear button follow same pattern as transcript search
- Search state is local to each stage panel — cleared when the stage tab is closed

**Scope constraint**: Stage search does not search the transcript. Transcript search does not search any stage content. These are entirely separate.

---

## 6B. Transcript Theme Highlighting (NEW — v2.1)

When meaning units have been assigned a `provisional_theme` and `theme_color` in Stage 3, the corresponding excerpt text is highlighted in the Transcript Panel with the theme's color. This is a read-only visual layer. The underlying `raw_text` is never modified.

---

### Inviolate rule

**The transcript is read-only at all times.** Theme highlights are rendered as a React overlay — colored `<span>` elements wrapping matched text segments — and are derived entirely from the `meaning_units` data at render time. No write operation of any kind touches `raw_text`. If the app is closed and reopened, highlights are reconstructed from the database, not stored in the transcript itself.

---

### When highlights appear

Highlights are rendered in the Transcript Panel whenever:
1. A case is selected, AND
2. At least one meaning unit for that transcript has both a non-empty `excerpt` and a non-empty `provisional_theme`

Highlights are always visible in the Transcript Panel — they are not toggled on/off by which stage tab is open. A "Hide highlights" toggle button in the Transcript Panel header allows the analyst to suppress them temporarily if they want a clean view. Default state: highlights on.

---

### Fuzzy matching (`fuzzyMatch.js`)

Each meaning unit's `excerpt` must be located within `raw_text`. Because excerpts may have been lightly edited, truncated, or have minor punctuation differences, exact string matching is not sufficient.

**Algorithm** (`src/utils/fuzzyMatch.js`):

Use a sliding-window approach with normalized comparison:

1. Normalize both the excerpt and candidate windows: collapse whitespace, strip leading/trailing whitespace, lowercase
2. For each possible starting position in `raw_text`, extract a window of approximately the same character length as the excerpt (±20% tolerance)
3. Compute similarity using the **Levenshtein distance** ratio: `similarity = 1 - (editDistance / maxLength)`
4. Accept the window with the highest similarity score above a threshold of **0.90**
5. If no window exceeds 0.90, the excerpt is considered unmatched — skip it silently (no highlight, no error)
6. Return the character start and end indices of the best match within `raw_text`

**Implementation notes**:
- Use a pure JavaScript Levenshtein implementation — no external library required
- For performance, only compute edit distance for windows where the first 10 characters have similarity > 0.7 (pre-filter)
- For transcripts longer than 10,000 characters, run matching in a Web Worker to avoid blocking the UI thread
- Cache match results per `(meaningUnitId, excerptText)` pair in component state; recompute only when `excerpt` changes

Export: `findExcerptInText(excerpt, rawText) → { start, end } | null`

---

### Rendering highlights

The Transcript Panel body renders `raw_text` as a sequence of React `<span>` elements rather than a plain `<pre>`. The rendering pipeline:

1. On case load (or when meaning unit data changes): call `findExcerptInText` for each meaning unit that has both `excerpt` and `provisional_theme`
2. Collect all matched ranges: `[{ start, end, themeColor, themeLabel, muId }]`
3. Sort ranges by `start` position
4. Handle overlaps (see below)
5. Split `raw_text` into segments: unhighlighted plain text and highlighted spans
6. Render as a `<pre>`-style block (preserve whitespace, monospace font) containing the mixed spans

**Overlap handling**: When two matched ranges overlap (same characters claimed by two different themes):
- The region covered only by one theme renders with that theme's `theme_color` at 30% opacity background
- The overlapping sub-region renders with the **first-assigned theme's color** (lower `mu_order` wins) at 30% opacity background, plus a small colored dot (6px circle) in the second theme's color positioned at the top-right of the overlapping span
- "First-assigned" means lower `mu_order` value, not creation timestamp

**Highlight style**:
- Background color: `theme_color` at 30% opacity (use `rgba` or Tailwind `bg-opacity`)
- No border, no underline — background only
- The dot for multi-theme overlap: `inline-block`, 6px × 6px, `border-radius: 50%`, `vertical-align: super`, `margin-left: 2px`
- Do not use `dangerouslySetInnerHTML` — build the span tree in React

---

### Interaction

- **Hover**: hovering a highlighted span shows a small tooltip with the theme label (and both theme labels if overlapping). Use a simple CSS `title` attribute or a lightweight React tooltip — no external tooltip library.
- **No click behavior** at MVP — clicking a highlighted span does nothing.
- **"Hide highlights" toggle**: a button in the Transcript Panel header labeled "Hide highlights" / "Show highlights". Toggling it sets a boolean in local state that suppresses rendering the highlight layer. The underlying match computation is not discarded — toggling back to "Show" re-renders immediately from cached results.

---

### IPC addition

Add one new call to retrieve the data needed for highlight rendering:

| Method | Args | Returns |
|--------|------|---------|
| `getHighlightData(transcriptId)` | — | `Array<{mu_id, mu_order, excerpt, provisional_theme, theme_color}>` — only rows where both `excerpt` and `provisional_theme` are non-empty |

This is a thin query wrapper and does not require a new DB table. It filters `meaning_units` in `queries.js`.

---

### Export

Theme highlights are a visual feature only and do not affect export. The single-case `.txt` export already includes `provisional_theme` per meaning unit (Section 9). No additional export changes needed for this feature.

---

## 7. IPC API (`window.phenomAPI`)

All calls return Promises. DB operations use synchronous `better-sqlite3` internally.

### Transcripts

| Method | Args | Returns |
|--------|------|---------|
| `getTranscripts()` | — | `Array<{id, participant_id, workflow, created_at, completed_stages}>` |
| `importTranscript({filePath, participantId, workflow})` | — | `{success, id}` or `{error}` |
| `getTranscript(id)` | — | `{id, participant_id, raw_text, workflow, created_at, updated_at}` |

### Stage outputs

| Method | Args | Returns |
|--------|------|---------|
| `getStageOutput({transcriptId, stage})` | — | `{id, transcript_id, stage, content, day_stamps, updated_at}` or null |
| `saveStageOutput({transcriptId, stage, content})` | — | `{success}` or `{error}` |

### Meaning units

| Method | Args | Returns |
|--------|------|---------|
| `getMeaningUnits(transcriptId)` | — | `Array<{id, transcript_id, workflow, mu_order, excerpt, boundary_justification, paraphrase, analyst_note, provisional_theme, theme_color, stage3_notes, day_stamps, updated_at}>` |
| `addMeaningUnit({transcriptId, workflow})` | — | new unit object |
| `saveMeaningUnit({id, excerpt, boundary_justification, paraphrase, analyst_note, provisional_theme, theme_color, stage3_notes})` | — | `{success}` or `{error}` |
| `saveMeaningUnitColor({id, theme_color})` | — | `{success}` or `{error}` — immediate save, no debounce |
| `deleteMeaningUnit(id)` | — | `{success}` |
| `reorderMeaningUnits([{id, mu_order}])` | — | `{success}` |

### Theme highlighting

| Method | Args | Returns |
|--------|------|---------|
| `getHighlightData(transcriptId)` | — | `Array<{mu_id, mu_order, excerpt, provisional_theme, theme_color}>` — only rows where both fields are non-empty |

### Export

| Method | Args | Returns |
|--------|------|---------|
| `exportSingleCase(transcriptId)` | — | `{success}` or `{error}` or `{canceled}` |
| `exportCorpus()` | — | `{success}` or `{error}` or `{canceled}` |

`exportSingleCase`: opens file-save dialog; suggested name `{participant_id}_{workflow}_export.txt`; plain text with section headers.

`exportCorpus`: opens folder picker; writes `corpus_stage_outputs.csv` and `corpus_meaning_units.csv`. All theme data (provisional_theme, theme_color, stage3_notes) is included in `corpus_meaning_units.csv` — no separate themes CSV needed under the per-row model.

### Database

| Method | Returns |
|--------|---------|
| `dbGetPath()` | current DB path string |
| `dbGetDefaultPath()` | default DB path string |
| `dbOpenExisting()` | `{success, path}` or `{error}` or `{canceled}` |
| `dbCreateNew()` | `{success, path}` or `{error}` or `{canceled}` |
| `dbUseDefault()` | `{success, path}` or `{error}` |

### System

| Method | Notes |
|--------|-------|
| `openFile()` | file picker for .txt; returns path or null |
| `onFlushSaves(callback)` | registers listener for pre-quit flush event |

---

## 8. Import Flow

1. User clicks "+ Import Transcript"
2. ImportModal: select `.txt` file → enter participant ID → choose workflow
3. On submit → IPC `importTranscript` →
   - Reads file content
   - Validates non-empty
   - Checks UNIQUE(participant_id, workflow); rejects if duplicate
   - Inserts `transcripts` row
   - Creates **3** `stage_outputs` rows: `memo`, `whole_part`, `essence` (with `day_stamps = '[]'`)
   - Does **not** create a `stage_outputs` row for `themes` — Stage 3 data lives in `meaning_units` columns
4. On success: modal closes, new case selected automatically

---

## 9. Export Formats

### Single-case `.txt`

```
PHENOMAPP CASE EXPORT
Participant: {participant_id}
Workflow: {workflow label}
Exported: {datetime}

--- TRANSCRIPT ---
{raw_text}

--- STAGE 1: HOLISTIC MEMO ---
{content}
[Day stamps: YYYY-MM-DD (first edited HH:MM:SS), ...]

--- STAGE 2: MEANING UNITS ---
MU-001
  Excerpt: ...
  Boundary Justification: ...
  Paraphrase: ...
  Analyst Note: ...
  Themes: [Theme Label 1], [Theme Label 2]
  [Day stamps: YYYY-MM-DD (first edited HH:MM:SS), ...]

--- STAGE 3: PROVISIONAL THEMES ---
Themes identified:
  [#hex] Theme Label 1
    MU-001  Paraphrase: ...  |  Stage 3 Notes: ...
    MU-003  Paraphrase: ...  |  Stage 3 Notes: ...
  [#hex] Theme Label 2
    MU-002  Paraphrase: ...  |  Stage 3 Notes: ...

Untagged units:
    MU-005  Paraphrase: ...  |  Stage 3 Notes: ...

--- STAGE 4: WHOLE-PART RECONCILIATION ---
{content}
[Day stamps: YYYY-MM-DD (first edited HH:MM:SS), ...]

--- STAGE 5: INDIVIDUAL ESSENCE ---
{content}
[Day stamps: YYYY-MM-DD (first edited HH:MM:SS), ...]
```

### Corpus CSVs

**`corpus_stage_outputs.csv`**: `participant_id, workflow, stage, content, day_stamps, updated_at`
(stages 1, 4, 5 only — stage 3 is in meaning units)

**`corpus_meaning_units.csv`**: `participant_id, workflow, mu_order, excerpt, boundary_justification, paraphrase, analyst_note, provisional_theme, theme_color, stage3_notes, day_stamps, updated_at`

---

## 10. Modals

### ImportModal

Fields: file path (read-only text + Browse button), participant ID (text input), workflow (select dropdown).
Validation: file required, participant ID non-empty.
Error display: red box.

### DatabaseModal

Shows: current path + whether it's the default. Three actions: Open Existing, Create New, Use Default (hidden if already default).

---

## 11. Application Menu (macOS)

- **PhenomApp**: About PhenomApp (separate 420×250 window, CC BY-NC-SA 4.0), Hide, Quit
- **Edit**: Undo, Redo, Cut, Copy, Paste, Select All (all standard)

No custom keyboard shortcuts beyond standard macOS.

---

## 12. About Window

Separate `BrowserWindow`, fixed 420×250, not resizable. Displays version, license (CC BY-NC-SA 4.0), attribution. External links open via `shell.openExternal`.

---

## 13. Conventions & Patterns to Follow When Adding Features

1. **New IPC calls**: Add handler in `main.js`, expose via `preload.js` contextBridge, call via `window.phenomAPI` in components.
2. **New DB columns/tables**: Add `ALTER TABLE` or new `CREATE TABLE IF NOT EXISTS` to `schema.js`; add query functions to `queries.js`.
3. **New UI components**: Place in `src/components/`; wire state up to `App.jsx` if shared, or keep local if scoped.
4. **Styling**: Use Tailwind utility classes; match existing color palette (indigo for primary, gray for secondary, red for destructive).
5. **Auto-save pattern**: Use `useAutoSave` hook; always wire `onFlushSaves` listener for pre-quit safety.
6. **Error display**: Footer "Save failed — check disk space" for save errors; red box for modal validation errors.
7. **No async DB**: `better-sqlite3` calls are synchronous in main process — keep them that way.
8. **Workflow values**: Always one of `'human'`, `'hybrid'`, `'machine'` (lowercase, no spaces).
9. **Stage keys**: Always one of `'memo'`, `'themes'`, `'whole_part'`, `'essence'` for `stage_outputs`; `'meaning_units'` used only as tab key in `STAGES` array.
10. **Theme colors**: Always use the predefined 10-color palette defined in Section 5A. No freeform hex entry at MVP.
11. **Day stamps**: Always managed via `src/utils/timestamps.js` — never write timestamp logic inline in components or queries. See Section 16.
12. **Fuzzy matching**: All excerpt-to-transcript matching goes through `src/utils/fuzzyMatch.js`. Never implement Levenshtein or matching logic inline in components.
13. **Transcript immutability**: No write operation of any kind may touch `raw_text` or the `transcripts` table after import. Theme highlights are a render-layer concern only.

---

## 14. What Is Not in Scope (Do Not Add Without Explicit Discussion)

- LLM / AI API integration
- Multi-user / real-time collaboration
- Windows or Linux support
- Rich text / Markdown in any field
- Version history or undo beyond OS-level
- Authentication or user accounts
- Automatic cloud sync or backup
- Code signing / notarization
- Freeform hex color input for themes (use predefined palette only)
- Cross-case theme comparison or corpus-level theme aggregation
- A separate `themes` entity table or junction table (per-row model only — see Section 5A)
- Click-to-navigate from a transcript highlight to its meaning unit row

---

## 15. Build & Distribution

```bash
npm install        # install deps; rebuilds better-sqlite3 native module
npm run dev        # Vite dev server + Electron (hot reload)
npm run build      # build React → dist/
npm run dist       # package → release/*.dmg (universal: Intel + Apple Silicon)
```

App ID: `edu.uh.phenomapp`
Data persists in `~/Library/Application Support/PhenomApp/` across reinstalls.
No code signing; users must right-click → Open on first launch to bypass Gatekeeper.

---

## 16. Day-Locked Timestamps (NEW)

All analyst-entered content carries a day-locked edit history. The logic lives entirely in `src/utils/timestamps.js` and is called from IPC handlers in `main.js` — never from the renderer directly.

### Purpose

To track *when* analysis was done at the day level — both for transparency in the research record and for export. A timestamp records the first moment within a given calendar day that a field was edited. It does not update again until the next calendar day.

### Storage format

Timestamps are stored as a JSON array in the `day_stamps` TEXT column on `stage_outputs` and `meaning_units`:

```json
[
  { "date": "2026-04-03", "first_edited_at": "14:23:07" },
  { "date": "2026-04-07", "first_edited_at": "09:11:42" }
]
```

- `date`: ISO date string (`YYYY-MM-DD`) in the user's local timezone
- `first_edited_at`: wall-clock time (`HH:MM:SS`) of the first edit on that calendar day, local timezone
- Array is ordered chronologically (oldest first)
- One entry per calendar day maximum — if the analyst edits on Monday and again on Monday, only one entry for Monday exists

### Logic in `timestamps.js`

Export a single function: `updateDayStamps(existingJson, nowDate, nowTime)`

- `existingJson`: current value of `day_stamps` from DB (string or null)
- `nowDate`: today's date as `YYYY-MM-DD`
- `nowTime`: current time as `HH:MM:SS`
- Returns: updated JSON string

Behavior:
1. Parse `existingJson` (default to `[]` if null or empty)
2. Check whether the last entry in the array has `date === nowDate`
3. If yes: return the existing JSON unchanged (day already recorded)
4. If no: append `{ date: nowDate, first_edited_at: nowTime }` and return updated JSON string

### When to call it

Call `updateDayStamps` inside the IPC handlers for:
- `saveStageOutput` — update `stage_outputs.day_stamps` on every save
- `saveMeaningUnit` — update `meaning_units.day_stamps` on every save
- `addMeaningUnit` — initialize `day_stamps` with today's entry on row creation

Do not call it for `saveMeaningUnitColor` — color selection is a structural tagging action, not analyst text entry.

### Display

Day stamps are not shown in the UI during normal analysis. They appear only in export output (see Section 9 export formats).
