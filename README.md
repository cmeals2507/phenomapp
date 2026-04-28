# PhenomApp

A local desktop application for managing **hermeneutic phenomenological analysis**. Built for qualitative researchers working through multi-stage analysis of interview transcripts.

---

## Overview

PhenomApp supports a structured, five-stage phenomenological analysis workflow. Each transcript is loaded as a single case. Analysts work through stages sequentially, with all outputs saved automatically to a local SQLite database linked to the source transcript.

The app is designed to support studies comparing multiple **workflow conditions** — human-only analysis, human-machine hybrid analysis, and machine-only analysis — while keeping each condition's data cleanly separated within a shared case list.

---

## Analysis Workflow

Each case moves through five stages:

| Stage | Name | Type |
|---|---|---|
| 1 | Holistic Memo | Freeform text |
| 2 | Meaning Units | Structured table |
| 3 | Provisional Themes | Per-row theme tagging with grouped view |
| 4 | Whole-Part Reconciliation | Freeform text |
| 5 | Individual Essence | Freeform text |

Stage 2 (Meaning Units) captures verbatim excerpts alongside boundary justifications, descriptive paraphrases, and analyst notes — one row per unit. Rows can be reordered by drag-and-drop.

Stage 3 (Provisional Themes) uses a dedicated two-view interface: a flat tagging table where each meaning unit receives a theme label, color, thematic interpretation, and notes; and a grouped/collapsed view organized by theme.

Up to two stage panels can be open simultaneously in a split view, allowing analysts to reference one stage while writing in another.

---

## Workflow Conditions

Each transcript is tagged with one of three workflow conditions at import:

| Code | Label |
|---|---|
| H | Human-Only |
| HM | Human-Machine Hybrid |
| M | Machine-Only |

The same participant can have transcripts in multiple workflow conditions — the combination of `participant_id` + `workflow` is unique in the database.

---

## Features

- **Three-panel layout** — case list sidebar, read-only transcript panel, stage work area
- **Resizable panels** — drag the divider between transcript and stage panels
- **Auto-save** — all stage content saves automatically every 3 seconds; no manual save needed
- **Import** — load `.txt` transcript files with participant ID and workflow condition
- **Delete transcript** — remove a case and all its data via the sidebar delete button (confirmation dialog required)
- **Export (single case)** — structured `.txt` file with all stage outputs for one case; Stage 3 exported grouped by theme
- **Export (corpus CSV)** — two `.csv` files covering all cases: one for freeform stage outputs, one for meaning units (including all Stage 3 fields)
- **Export (corpus JSON)** — a fully structured JSON export of the entire corpus, formatted for LLM processing; includes project metadata, positionality, cross-case theme index, workflow summary, and all stage outputs per case
- **Database switching** — open a different `.db` file or create a new one (useful for a shared Dropbox-synced database)
- **Transcript search** — case-insensitive search within the transcript panel with ↑↓ navigation and match counter
- **Theme highlighting** — meaning unit excerpts are highlighted in the transcript panel using their assigned theme color once both a provisional theme and a thematic interpretation are provided; toggle on/off at any time
- **Coverage highlight** — when Stage 2 is open, text in the transcript panel copied into any meaning unit's excerpt field is highlighted in blue (`#1F75F0`), but only if the meaning unit has a memo link; toggle on/off
- **MU ID tooltips** — hovering over highlighted (covered) or theme-highlighted text in the transcript panel shows the corresponding MU ID(s)
- **Click MU ID to locate** — clicking any `MU-NNN` ID in Stage 2 or Stage 3 scrolls the transcript panel to that excerpt
- **Stage 2 row search** — real-time search bar in the Stage 2 header filters the meaning units table across all text fields
- **Stage 3 row search** — search bar in the Stage 3 header filters both the tagging table and grouped view simultaneously, with a live match count
- **Global save indicator** — sidebar footer shows "Saved [time]" after any auto-save fires across all stages
- **Per-stage completion dots** — each of the five dots in the sidebar case list maps to an individual stage
- **Day-locked timestamps** — all analyst-entered content records the date and time of first edit per calendar day, included in exports
- **Canonical MU-IDs** — each meaning unit has a permanent `MU-NNN` ID based on original creation order (`mu_order`), preserved regardless of drag-and-drop reordering
- **Reorder log** — all drag-and-drop reorder events are logged with timestamps; accessible via the audit icon in the Stage 2 toolbar
- **3-step undo** — the last three drag-and-drop reorders can be individually undone
- **Sort by MU-ID** — Stage 2 can be sorted by canonical creation order to restore the original MU sequence
- **Positionality record** — free-text field in the sidebar for recording analyst positionality; included in all corpus exports
- **Memo ↔ MU linking** — each meaning unit in Stage 2 is linked to one or more passages in the Holistic Memo; the transcript highlight only activates once at least one link exists, grounding segmentation in the analyst's initial phenomenological encounter with the text
- **Thematic interpretation gate** — in Stage 3, the theme highlight only activates once both a provisional theme label and a thematic interpretation are provided
- **Work card modal** — clicking the earned-highlight indicator dot on any meaning unit opens a full blocking modal showing the excerpt and Holistic Memo alongside editable fields for the current stage; the app is inaccessible while the modal is open

---

## Stage 2 in Detail

The meaning units table has one row per unit with these columns:

| Column | Editable | Description |
|---|---|---|
| ID | No | Canonical `MU-001` … `MU-NNN` label based on creation order, with earned-highlight dot |
| Excerpt | Yes | Verbatim text from the transcript |
| Boundary Justification | Yes | Rationale for where this unit begins and ends |
| Paraphrase | Yes | Analyst's descriptive paraphrase |
| Analyst Note | Yes | Free observations or flags |

**Memo ↔ MU Linking and earned highlights:**

Each MU row has an indicator dot in the ID column:

- **Orange dot** — no memo link yet; transcript highlight is inactive
- **Green dot** — linked to at least one passage in the Holistic Memo; transcript highlight is active

Clicking the dot opens the **work card modal** for that unit. The modal shows the verbatim excerpt, the full Holistic Memo with link status highlighted, and all Stage 2 editable fields. Select any passage in the memo and click "Link this passage" to earn the highlight. Links can be removed from the modal's summary panel.

**Row management:**
- Rows are reorderable by drag-and-drop (changes `display_order` but not canonical `mu_order`)
- **Right-click any row** to insert a blank row immediately above or below
- The `+ Add Row` button appends a new blank row at the end
- **Search bar** filters visible rows in real time; `+ Add Row` is hidden during a search
- **Sort** by display order or by canonical MU-ID
- **Undo** — up to three drag-and-drop reorders can be individually undone
- **Reorder log** — all reordering events are audited with timestamps (toolbar icon)

---

## Stage 3 in Detail

Stage 3 uses a two-view interface:

**View 1 — Tagging Table**

| Column | Editable | Description |
|---|---|---|
| ID | No | Canonical `MU-NNN` with earned-highlight dot |
| Boundary Justification | No | Carried over from Stage 2 |
| Paraphrase | No | Carried over from Stage 2 |
| Provisional Theme | Yes | Theme label with autocomplete |
| Color | Yes | 80-swatch popup picker with hex input |
| Thematic Interpretation | Yes | What this theme reveals about the structure of lived experience |
| Stage 3 Notes | Yes | Free notes |

**Earned dot:**
- **Orange dot** — provisional theme or thematic interpretation missing; theme highlight is inactive
- **Green dot** — both fields filled; theme highlight is active in the transcript

Clicking the dot opens the **work card modal** in Stage 3 mode: shows excerpt, read-only Stage 2 context (boundary justification, paraphrase), editable Provisional Theme (with autocomplete) and Thematic Interpretation, and the Holistic Memo read-only with Stage 2 linked passages highlighted.

**Theme autocomplete** — selecting a suggestion fills the theme name and automatically applies that theme's saved color.

Filter by theme or tagged/untagged status; sort by original order or alphabetically by theme.

**View 2 — Grouped View**
- Meaning units collapsed under their assigned theme label
- MU IDs shown inline; clicking scrolls to that excerpt
- Stage 3 Notes editable inline
- Untagged block at the bottom

Theme grouping is **case-sensitive**.

---

## Work Card Modal

The work card is a full-width blocking modal (920px, 87vh). It cannot be dismissed by clicking the overlay — only the **Done** button closes it.

**Layout:**

| Left panel (360px) | Right panel (fills remainder) |
|---|---|
| Transcript excerpt (quoted) | Full Holistic Memo |
| Editable fields for current stage | Stage 2: interactive — select to link, delete links |
| Earned status indicator | Stage 3: read-only — Stage 2 linked passages highlighted |

The header shows whether the highlight is earned and the specific condition that must be met.

**Stage 2 modal** — editable: Boundary Justification, Paraphrase, Analyst Note. Memo is interactive; highlight text and click "Link this passage" to create a link.

**Stage 3 modal** — editable: Provisional Theme (with autocomplete), Thematic Interpretation. Stage 2 context shown read-only. Memo is read-only; existing Stage 2 links highlighted in orange for reference.

---

## Transcript Panel in Detail

The left panel shows the full immutable transcript. While working:

**Theme highlights (Stage 3)**
- Once a meaning unit has an excerpt, a provisional theme, and a thematic interpretation, the matching text is highlighted using the theme color at 30% opacity
- Toggle on/off via "Hide/Show highlights"
- Overlapping excerpts show the lower-order theme's color with a small colored dot for the second theme
- Hovering over highlighted text shows the theme label as a tooltip

**Coverage highlight (Stage 2)**
- Active whenever the Stage 2 tab is open
- Transcript text copied into a meaning unit's excerpt is highlighted in blue (`#1F75F0`), but only if that unit also has at least one memo link — coverage and earned highlights are unified
- Hovering shows the MU ID(s)
- Updates live within ~3 seconds of an excerpt or link being saved

**Matching algorithm**
- All excerpt matching uses exact normalized match: whitespace collapsed, case-insensitive
- Excerpts containing `...` or `…` are treated as multi-segment; each segment is independently located

---

## Corpus JSON Export

The JSON export (`Export Corpus (LLM JSON)`) produces a single structured file for LLM-assisted cross-case analysis. Top-level keys:

| Key | Contents |
|---|---|
| `meta` | Export timestamp, database filename, total case count, methodology notes, stage descriptions, workflow type definitions |
| `positionality` | Analyst positionality statement |
| `participant_workflow_index` | Map of participant → workflow conditions |
| `workflow_summary` | Per-workflow case counts, total MUs, completed case counts |
| `cross_case_theme_index` | Map of theme label → cases and MU count across corpus |
| `corpus` | Array of cases with full transcript, all stage outputs, all meaning units, and completion flags |

Each meaning unit in the export includes both `mu_order` (canonical ID) and `display_order` (analyst's final arrangement), all text fields, theme assignment, and day-stamps.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Electron |
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Database | SQLite via better-sqlite3 |
| Export | csv-stringify |
| Packaging | electron-builder (.dmg) |

All data is stored locally in a single SQLite file. No network dependency, no cloud database, no server.

---

## For End Users (receiving the .dmg)

1. Open the `.dmg` file
2. Drag **PhenomApp** into your Applications folder
3. Launch it like any other Mac app

**First launch — macOS Gatekeeper:** Because this app is not signed with an Apple Developer certificate, macOS will block it on first launch. To open it:

> Right-click (or Control-click) the app icon → select **Open** → click **Open** in the dialog

This is a one-time step. After that, the app opens normally.

Your data is stored at:
```
~/Library/Application Support/PhenomApp/phenomapp.db
```

Deleting and reinstalling the app does **not** delete your data. To reset, delete that file manually.

---

## For Developers

### Prerequisites (one-time setup)

**1. Homebrew**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**2. Node.js via nvm (Node 20 required)**
```bash
brew install nvm
nvm install 20
nvm use 20
```
Verify: `node -v` should return `v20.x.x`

**3. Xcode Command Line Tools** (required to compile `better-sqlite3`)
```bash
xcode-select --install
```

### First run

```bash
git clone <repo-url>
cd phenomapp
npm install        # installs all dependencies and compiles better-sqlite3 for Electron
npm run dev        # starts Vite dev server + Electron app
```

### Build a distributable .dmg

```bash
npm run dist       # compiles React, then packages via electron-builder → outputs to /release
```

The `.dmg` in `/release` is the file to distribute to collaborators.

---

## Project Structure

```
phenomapp/
├── main.js                           # Electron main process — DB init, IPC handlers, window
├── preload.js                        # Context bridge (exposes IPC to renderer)
├── electron-builder.config.js        # macOS .dmg packaging config
├── vite.config.js                    # Vite renderer build config
├── src/
│   ├── App.jsx                       # Root component — layout, pane resize, tab state
│   ├── components/
│   │   ├── Sidebar.jsx               # Case list, import, delete, export, DB switcher, positionality
│   │   ├── TranscriptPanel.jsx       # Transcript display, search, theme highlights, coverage highlight
│   │   ├── StageArea.jsx             # Tab bar + dual-panel split logic
│   │   ├── FreeformStage.jsx         # Stages 1, 4, 5 — textarea with auto-save
│   │   ├── MeaningUnitsStage.jsx     # Stage 2 — table, drag-and-drop, reorder log, undo, memo linking
│   │   ├── ProvisionalThemesStage.jsx# Stage 3 — view toggle, state management, work card modal
│   │   ├── ThemeTaggingView.jsx      # Stage 3 View 1 — per-row theme entry with earned dot indicators
│   │   ├── ThemeGroupedView.jsx      # Stage 3 View 2 — collapsed by theme
│   │   ├── MemoLinkModal.jsx         # Work card modal — stage-aware, blocking, memo linking interface
│   │   ├── ImportModal.jsx           # Import dialog
│   │   └── DatabaseModal.jsx         # Database file switcher
│   ├── db/
│   │   ├── schema.js                 # CREATE TABLE + ALTER TABLE migrations — runs on launch
│   │   └── queries.js                # All SQL — never called directly from renderer
│   └── utils/
│       ├── autoSave.js               # Reusable debounce hook (3s)
│       ├── exportFormatters.js       # Single-case .txt, corpus .csv, and corpus JSON formatters
│       ├── timestamps.js             # Day-locked edit timestamp logic
│       └── fuzzyMatch.js            # Levenshtein excerpt-to-transcript locator
```

---

## Database Schema

### `transcripts`
One record per participant per workflow condition. The `raw_text` field is immutable after import.

### `stage_outputs`
One row per case per freeform stage (`memo`, `whole_part`, `essence`). Includes a `day_stamps` JSON column tracking first-edit times per calendar day. Content is upserted on every auto-save.

### `meaning_units`
One row per meaning unit. Core fields: `excerpt`, `boundary_justification`, `paraphrase`, `analyst_note`, `mu_order` (canonical creation order), `display_order` (analyst's arrangement). Stage 3 fields: `provisional_theme`, `theme_color`, `thematic_interpretation`, `stage3_notes`. Also includes `day_stamps`.

### `mu_reorder_log`
Audit log of all drag-and-drop reorder events with timestamps and order snapshots.

### `memo_mu_links`
Links between holistic memo passages and meaning units. Each row records the transcript, the target MU, character offsets into the memo text, and the verbatim excerpt. A MU can have multiple links; a passage can link to multiple MUs. The transcript highlight for a MU is only active when at least one link exists.

### `project_meta`
Key-value store for project-wide settings including the positionality record.

---

## Out of Scope

The following are intentionally excluded from this version:

- Real-time LLM integration within the app
- Multi-user or shared live database
- Windows / Linux builds
- Markdown or rich text in stage fields
- Version history beyond the 3-step reorder undo
- Authentication or user accounts
- Cloud sync or backup
- Cross-case theme comparison UI within the app

---

## Notes

- macOS only — ships as a `.dmg`
- No Apple Developer certificate; Gatekeeper bypass (right-click → Open) required on first launch
- The database file persists independently of the app installation
- Switching databases (via the DB button in the sidebar) reloads the case list without restarting the app
- Existing databases are automatically migrated on first launch — no data loss

---

## Changelog

### 2026-04-28

- **Work card modal** — clicking the earned-highlight indicator dot on any MU in Stage 2 or Stage 3 opens a full blocking two-panel modal; left panel shows the transcript excerpt and editable fields for the current stage; right panel shows the full Holistic Memo with highlights; the app is inaccessible while the modal is open
- **Memo ↔ MU linking** — Stage 2 transcript highlight is now earned, not automatic; each meaning unit must be linked to at least one passage in the Holistic Memo before its excerpt highlights in the transcript; orange/green indicator dots in the ID column show link status
- **Stage 3 thematic interpretation gate** — Stage 3 transcript highlight now requires both a provisional theme label and a thematic interpretation; orange/green dots in the ID column reflect earned status
- **Stage 3 work card** — Stage 3 dot opens the work card in Stage 3 mode: excerpt, read-only Stage 2 context, editable Provisional Theme and Thematic Interpretation, and the Holistic Memo read-only with Stage 2 linked passages highlighted
- **Corpus JSON export** — new "Export Corpus (LLM JSON)" option in the sidebar produces a structured JSON file of the full corpus; formatted for LLM-assisted cross-case analysis; includes metadata, positionality, cross-case theme index, workflow summary, and all stage outputs
- **Sidebar export label** — "Export All (Corpus)" renamed to "Export Corpus (CSV)"

### 2026-04-25

- **Canonical MU-IDs** — each meaning unit now has a permanent `MU-NNN` ID (`mu_order`) assigned at creation; preserved regardless of drag-and-drop reordering
- **3-step undo** — the last three drag-and-drop reorder operations can be individually undone
- **Sort by MU-ID** — Stage 2 can be sorted by canonical creation order
- **Coverage color** — covered text highlight updated to `#1F75F0`
- **MU scroll linkage** — fixed excerpt matching for excerpts containing special characters

### 2026-04-22

- **Thematic Interpretation field** — Stage 3 rows now include a Thematic Interpretation column (renamed from assignment rationale); required alongside a provisional theme for the transcript highlight to activate
- **Reorder log** — all drag-and-drop reorder events logged with timestamps; accessible via audit icon in Stage 2 toolbar; analysts can add notes to each log entry
- **Positionality record** — free-text field in the sidebar; saved to the database and included in all corpus exports

### 2026-04-19

- **Global save indicator** — sidebar footer shows "Saved [time]" after any auto-save across all stages
- **Per-stage completion dots** — each sidebar dot maps to an individual stage
- **Stage 2 row search** — real-time search bar filters the meaning units table across all text fields
- **Stage 3 row search** — search bar filters both the tagging table and grouped view simultaneously
- **Click MU ID to locate** — clicking any `MU-NNN` ID scrolls the transcript panel to that excerpt
- **MU ID column in Stage 3 tagging table** — `MU-NNN` shown as first column
- **Grouped view MU IDs** — IDs shown inline in Stage 3 grouped view
- **Auto-resizing textareas** — all text cells grow to fit content automatically
- **Performance** — memoized row components and `useCallback`/`useMemo` hooks reduce re-renders

### 2026-04-17 (v2.2)

- **Coverage highlight** — transcript text copied into meaning unit excerpts highlighted to show analyst coverage
- **MU right-click insert** — insert a blank row immediately above or below any Stage 2 row
- **Theme autocomplete carries color** — selecting an existing theme also applies that theme's saved color
- **Stage 3 notes column** — added to the tagging table

### 2026-04-04

- **Ellipsis-segment highlighting** — excerpts containing `...` or `…` split and independently located
- **Exact normalized excerpt matching** — whitespace collapsed, case-insensitive
- **Color picker revamp** — improved swatch layout and hex input behavior

### 2026-04-03 (v2.1)

- **Stage 3 theme tagging** — dedicated view for assigning provisional themes, colors, and notes
- **Transcript theme highlights** — excerpts highlighted using assigned theme color; toggle on/off
- **Transcript search** — case-insensitive with ↑↓ navigation and match counter
- **Day-locked timestamps** — all analyst content records date and time of first edit per day
- **80-swatch color picker** — square grid popup with hex input

### 2026-04-02 (v1.0)

- **Initial release** — three-panel layout (sidebar, transcript, stage work area)
- **Five-stage workflow** — Holistic Memo, Meaning Units, Provisional Themes, Whole-Part Reconciliation, Individual Essence
- **Auto-save** — all stage content saves automatically every 3 seconds
- **Import / delete** — load `.txt` transcript files; remove cases via sidebar
- **Export (single case)** — structured `.txt` file with all stage outputs
- **Export (corpus)** — two `.csv` files covering all cases
- **Database switching** — open a different `.db` file or create a new one
- **Drag-and-drop row reorder** — Stage 2 meaning units reorderable
- **About window** — CC BY-NC-SA 4.0 license and attribution
