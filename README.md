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
| 3 | Provisional Themes | Freeform text |
| 4 | Whole-Part Reconciliation | Freeform text |
| 5 | Individual Essence | Freeform text |

Stage 2 (Meaning Units) captures verbatim excerpts alongside boundary justifications, descriptive paraphrases, and analyst notes — one row per unit. Rows can be reordered by drag-and-drop.

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
- **Export (single case)** — structured `.txt` file with all stage outputs for one case
- **Export (corpus)** — two `.csv` files covering all cases: one for freeform stage outputs, one for meaning units
- **Database switching** — open a different `.db` file or create a new one (useful for a shared Dropbox-synced database)

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
├── main.js                       # Electron main process — DB init, IPC handlers, window
├── preload.js                    # Context bridge (exposes IPC to renderer)
├── electron-builder.config.js    # macOS .dmg packaging config
├── vite.config.js                # Vite renderer build config
├── src/
│   ├── App.jsx                   # Root component — layout, pane resize, tab state
│   ├── components/
│   │   ├── Sidebar.jsx           # Case list, import, export, DB switcher
│   │   ├── TranscriptPanel.jsx   # Read-only transcript display
│   │   ├── StageArea.jsx         # Tab bar + dual-panel split logic
│   │   ├── FreeformStage.jsx     # Stages 1, 3, 4, 5 — textarea with auto-save
│   │   ├── MeaningUnitsStage.jsx # Stage 2 — table with drag-and-drop reorder
│   │   ├── ImportModal.jsx       # Import dialog
│   │   └── DatabaseModal.jsx     # Database file switcher
│   ├── db/
│   │   ├── schema.js             # CREATE TABLE IF NOT EXISTS — runs on every launch
│   │   └── queries.js            # All SQL — never called directly from renderer
│   └── utils/
│       ├── autoSave.js           # Reusable debounce hook (3s)
│       └── exportFormatters.js   # Single-case .txt and corpus .csv formatters
```

---

## Database Schema

### `transcripts`
One record per participant per workflow condition. The `raw_text` field is immutable after import.

### `stage_outputs`
One row per case per freeform stage (`memo`, `themes`, `whole_part`, `essence`). Content is upserted on every auto-save.

### `meaning_units`
One row per meaning unit. Fields: `excerpt`, `boundary_justification`, `paraphrase`, `analyst_note`, `mu_order`. Reorderable by drag-and-drop.

---

## Out of Scope

The following are intentionally excluded from this version:

- LLM integration
- Multi-user or shared live database
- Windows / Linux builds
- Markdown or rich text in stage fields
- Search or filter within transcripts
- Version history beyond OS-level undo
- Authentication or user accounts
- Cloud sync or backup

---

## Notes

- macOS only — ships as a `.dmg`
- No Apple Developer certificate; Gatekeeper bypass (right-click → Open) required on first launch
- The database file persists independently of the app installation
- Switching databases (via the DB button in the sidebar) reloads the case list without restarting the app
