# PhenomApp — Feature Specification (v1.0)

> **Purpose of this document**: Authoritative reference for the app's current state. Use this when scoping new features — identify what already exists, what files own each concern, and what conventions to follow.

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
    TranscriptPanel.jsx         — read-only transcript display
    StageArea.jsx               — tab bar + panel layout
    FreeformStage.jsx           — stages 1, 3, 4, 5 (textarea)
    MeaningUnitsStage.jsx       — stage 2 (structured table)
    ImportModal.jsx             — import form
    DatabaseModal.jsx           — DB switcher form
  db/
    schema.js                   — CREATE TABLE IF NOT EXISTS definitions
    queries.js                  — all SQL operations
  utils/
    autoSave.js                 — useAutoSave hook (3s debounce)
    exportFormatters.js         — single-case .txt + corpus CSV formatters
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
- Body: read-only monospace `pre` of `raw_text`
- Footer: word count

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
updated_at                DATETIME DEFAULT CURRENT_TIMESTAMP
```

Zero or more rows per transcript. No unique constraint (multiple units allowed).

### Completion tracking

Computed at query time (not stored):

```sql
completed_stages =
  COUNT(stage_outputs WHERE content NOT NULL AND content != '')   -- stages 1,3,4,5
  + CASE WHEN meaning_units exist for transcript THEN 1 ELSE 0   -- stage 2
```

---

## 5. Five-Stage Analysis Pipeline

| Tab # | Stage key    | Label                    | Component         | Data stored in       |
|-------|--------------|--------------------------|-------------------|----------------------|
| 1     | `memo`       | Holistic Memo            | FreeformStage     | `stage_outputs`      |
| 2     | `meaning_units` | Meaning Units         | MeaningUnitsStage | `meaning_units`      |
| 3     | `themes`     | Provisional Themes       | FreeformStage     | `stage_outputs`      |
| 4     | `whole_part` | Whole-Part Reconciliation| FreeformStage     | `stage_outputs`      |
| 5     | `essence`    | Individual Essence       | FreeformStage     | `stage_outputs`      |

### Tab behavior

- Click a closed tab: opens it (if < 2 open)
- Click an open tab: closes it
- Click a new tab when 2 are open: replaces the oldest (keeps the newer one + new one)
- Max 2 tabs open simultaneously

### FreeformStage behavior

1. Mount → IPC `getStageOutput({transcriptId, stage})` → populate textarea
2. User types → `useAutoSave` debounce (3s) → IPC `saveStageOutput({transcriptId, stage, content})`
3. Footer: "Last saved HH:MM:SS" (success) or "Save failed — check disk space" (error)
4. On `phenomapp:flush-saves` event → immediate save (called before app quit)

### MeaningUnitsStage behavior

Table columns: `ID (read-only)` | `Excerpt` | `Boundary Justification` | `Paraphrase` | `Analyst Note` | `✕ Delete`

- ID displayed as `MU-001`, `MU-002`, etc.
- "+ Add Row" → IPC `addMeaningUnit({transcriptId, workflow})` → new row with next `mu_order`
- Cell edit → marks unit dirty → 3s debounce → IPC `saveMeaningUnit({id, ...fields})`
- Drag-and-drop reorder → recalculate all `mu_order` values → IPC `reorderMeaningUnits([{id, mu_order}])`
- Delete (✕) → confirmation dialog → IPC `deleteMeaningUnit(id)`

---

## 6. Auto-Save

Hook: `useAutoSave(saveFn, delay = 3000)` in `src/utils/autoSave.js`

- Debounce: 3000ms; timer resets on each keystroke
- Before app quit: main sends `app:flush-saves`; renderer forces immediate save; 800ms grace period

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
| `getStageOutput({transcriptId, stage})` | — | `{id, transcript_id, stage, content, updated_at}` or null |
| `saveStageOutput({transcriptId, stage, content})` | — | `{success}` or `{error}` |

### Meaning units

| Method | Args | Returns |
|--------|------|---------|
| `getMeaningUnits(transcriptId)` | — | `Array<{id, transcript_id, workflow, mu_order, excerpt, boundary_justification, paraphrase, analyst_note, updated_at}>` |
| `addMeaningUnit({transcriptId, workflow})` | — | new unit object |
| `saveMeaningUnit({id, excerpt, boundary_justification, paraphrase, analyst_note})` | — | `{success}` or `{error}` |
| `deleteMeaningUnit(id)` | — | `{success}` |
| `reorderMeaningUnits([{id, mu_order}])` | — | `{success}` |

### Export

| Method | Args | Returns |
|--------|------|---------|
| `exportSingleCase(transcriptId)` | — | `{success}` or `{error}` or `{canceled}` |
| `exportCorpus()` | — | `{success}` or `{error}` or `{canceled}` |

`exportSingleCase`: opens file-save dialog; suggested name `{participant_id}_{workflow}_export.txt`; plain text with section headers.

`exportCorpus`: opens folder picker; writes `corpus_stage_outputs.csv` and `corpus_meaning_units.csv`.

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
   - Creates 4 `stage_outputs` rows (memo, themes, whole_part, essence)
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

--- STAGE 2: MEANING UNITS ---
MU-001
  Excerpt: ...
  Boundary Justification: ...
  Paraphrase: ...
  Analyst Note: ...

--- STAGE 3: PROVISIONAL THEMES ---
{content}
...
```

### Corpus CSVs

**`corpus_stage_outputs.csv`**: `participant_id, workflow, stage, content, updated_at`

**`corpus_meaning_units.csv`**: `participant_id, workflow, mu_order, excerpt, boundary_justification, paraphrase, analyst_note, updated_at`

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

---

## 14. What Is Not in Scope (Do Not Add Without Explicit Discussion)

- LLM / AI API integration
- Multi-user / real-time collaboration
- Windows or Linux support
- Rich text / Markdown in any field
- Full-text search
- Version history or undo beyond OS-level
- Authentication or user accounts
- Automatic cloud sync or backup
- Code signing / notarization

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
