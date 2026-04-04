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

Stage 3 (Provisional Themes) uses a dedicated two-view interface: a flat tagging table where each meaning unit receives a theme label, color, and Stage 3 notes; and a grouped/collapsed view organized by theme.

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
- **Export (single case)** — structured `.txt` file with all stage outputs for one case; Stage 3 exported grouped by theme
- **Export (corpus)** — two `.csv` files covering all cases: one for freeform stage outputs, one for meaning units (including all Stage 3 fields)
- **Database switching** — open a different `.db` file or create a new one (useful for a shared Dropbox-synced database)
- **Transcript search** — case-insensitive search within the transcript panel with ↑↓ navigation and match counter
- **Theme highlighting** — meaning unit excerpts are highlighted in the transcript panel using their assigned theme color once Stage 3 tagging begins; toggle on/off at any time
- **Day-locked timestamps** — all analyst-entered content records the date and time of first edit per calendar day, included in exports

---

## Stage 3 in Detail

Stage 3 replaces the freeform text field from earlier versions with a structured theme-tagging interface:

**View 1 — Tagging Table**
- One row per meaning unit
- Read-only columns: Paraphrase, Stage 2 Notes (from Stage 2)
- Editable columns: Provisional Theme label, color (10-swatch picker), Stage 3 Notes
- Filter by theme or tagged/untagged status; sort by original order or alphabetically by theme

**View 2 — Grouped View**
- Meaning units collapsed under their assigned theme label
- Stage 3 Notes editable inline; theme labels and colors not editable from this view
- "Untagged" block at the bottom for units not yet assigned a theme

Theme grouping is **case-sensitive** — "Belonging" and "belonging" are treated as distinct themes.

---

## Transcript Theme Highlighting

Once meaning units have been assigned a theme and color in Stage 3, their excerpts are highlighted in the transcript panel using the theme color at 30% opacity. Highlights are:

- Always visible (unless toggled off via "Hide highlights")
- Re-rendered automatically after Stage 3 saves
- Matched using fuzzy excerpt search (Levenshtein similarity ≥ 0.90), so lightly edited excerpts still match
- Read-only — the underlying transcript is never modified

Overlapping excerpts show the lower-order theme's color with a small colored dot indicating the second theme.

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
├── SPEC_v2.md                        # Authoritative feature specification (v2.1)
├── src/
│   ├── App.jsx                       # Root component — layout, pane resize, tab state
│   ├── components/
│   │   ├── Sidebar.jsx               # Case list, import, export, DB switcher
│   │   ├── TranscriptPanel.jsx       # Transcript display with search + theme highlights
│   │   ├── StageArea.jsx             # Tab bar + dual-panel split logic
│   │   ├── FreeformStage.jsx         # Stages 1, 4, 5 — textarea with auto-save
│   │   ├── MeaningUnitsStage.jsx     # Stage 2 — table with drag-and-drop reorder
│   │   ├── ProvisionalThemesStage.jsx# Stage 3 — view toggle + state management
│   │   ├── ThemeTaggingView.jsx      # Stage 3 View 1 — per-row theme entry table
│   │   ├── ThemeGroupedView.jsx      # Stage 3 View 2 — collapsed by theme
│   │   ├── ImportModal.jsx           # Import dialog
│   │   └── DatabaseModal.jsx         # Database file switcher
│   ├── db/
│   │   ├── schema.js                 # CREATE TABLE + ALTER TABLE migrations — runs on launch
│   │   └── queries.js                # All SQL — never called directly from renderer
│   └── utils/
│       ├── autoSave.js               # Reusable debounce hook (3s)
│       ├── exportFormatters.js       # Single-case .txt and corpus .csv formatters
│       ├── timestamps.js             # Day-locked edit timestamp logic
│       └── fuzzyMatch.js             # Levenshtein excerpt-to-transcript locator
```

---

## Database Schema

### `transcripts`
One record per participant per workflow condition. The `raw_text` field is immutable after import.

### `stage_outputs`
One row per case per freeform stage (`memo`, `whole_part`, `essence`). Includes a `day_stamps` JSON column tracking first-edit times per calendar day. Content is upserted on every auto-save.

### `meaning_units`
One row per meaning unit. Core fields: `excerpt`, `boundary_justification`, `paraphrase`, `analyst_note`, `mu_order`. Stage 3 fields: `provisional_theme`, `theme_color`, `stage3_notes`. Also includes `day_stamps`. Reorderable by drag-and-drop.

---

## Out of Scope

The following are intentionally excluded from this version:

- LLM integration
- Multi-user or shared live database
- Windows / Linux builds
- Markdown or rich text in stage fields
- Version history beyond OS-level undo
- Authentication or user accounts
- Cloud sync or backup
- Freeform hex color input (predefined 10-color palette only)
- Cross-case theme comparison or corpus-level theme aggregation

---

## Notes

- macOS only — ships as a `.dmg`
- No Apple Developer certificate; Gatekeeper bypass (right-click → Open) required on first launch
- The database file persists independently of the app installation
- Switching databases (via the DB button in the sidebar) reloads the case list without restarting the app
- Existing v1.0 databases are automatically migrated on first launch — no data loss
