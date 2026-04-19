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
- **Delete transcript** — remove a case and all its data via the sidebar delete button (confirmation dialog required)
- **Export (single case)** — structured `.txt` file with all stage outputs for one case; Stage 3 exported grouped by theme
- **Export (corpus)** — two `.csv` files covering all cases: one for freeform stage outputs, one for meaning units (including all Stage 3 fields)
- **Database switching** — open a different `.db` file or create a new one (useful for a shared Dropbox-synced database)
- **Transcript search** — case-insensitive search within the transcript panel with ↑↓ navigation and match counter
- **Theme highlighting** — meaning unit excerpts are highlighted in the transcript panel using their assigned theme color once Stage 3 tagging begins; toggle on/off at any time
- **Coverage highlight** — when Stage 2 is open, text in the transcript panel that has been copied into any meaning unit's excerpt field is highlighted in blue (`#27C2F5`), providing a live map of which parts of the transcript have been attended to
- **MU ID tooltips** — hovering over any highlighted (covered) or theme-highlighted text in the transcript panel while Stage 2 is open shows the corresponding meaning unit ID(s) (e.g., `MU-007` or `MU-007, MU-008` for overlapping excerpts)
- **Click MU ID to locate** — clicking any `MU-NNN` ID in Stage 2 or Stage 3 scrolls the transcript panel to that excerpt
- **Stage 2 row search** — real-time search bar in the Stage 2 header filters the meaning units table across all text fields (excerpt, boundary justification, paraphrase, analyst note)
- **Stage 3 row search** — search bar in the Stage 3 header filters both the tagging table and grouped view simultaneously, with a live match count
- **Global save indicator** — sidebar footer shows "Saved [time]" after any auto-save fires across all stages
- **Per-stage completion dots** — each of the five dots in the sidebar case list maps to an individual stage (Holistic Memo, Meaning Units, Themes, Whole-Part, Essence)
- **Day-locked timestamps** — all analyst-entered content records the date and time of first edit per calendar day, included in exports

---

## Stage 2 in Detail

The meaning units table has one row per unit with these columns:

| Column | Editable | Description |
|---|---|---|
| ID | No | Auto-assigned `MU-001` … `MU-NNN` label based on row order |
| Excerpt | Yes | Verbatim text from the transcript |
| Boundary Justification | Yes | Rationale for where this unit begins and ends |
| Paraphrase | Yes | Analyst's descriptive paraphrase |
| Analyst Note | Yes | Free observations or flags |

**Row management:**
- Rows are reorderable by drag-and-drop
- **Right-click any row** to open a context menu with options to insert a blank row immediately above or below that row — useful when a pasted excerpt needs to be split into multiple units without scrolling to the bottom
- The `+ Add Row` button appends a new blank row at the end
- **Search bar** in the panel header filters visible rows in real time across all text fields; `+ Add Row` is hidden while a search is active
- **Clicking the MU ID** (e.g. `MU-003`) in any row scrolls the transcript panel to that excerpt

---

## Stage 3 in Detail

Stage 3 uses a two-view interface:

**View 1 — Tagging Table**
- One row per meaning unit
- **MU ID column** — clicking the `MU-NNN` ID scrolls the transcript panel to that excerpt
- Read-only reference columns: Boundary Justification, Paraphrase (carried over from Stage 2)
- Editable columns: Provisional Theme label, color (80-swatch popup picker with hex input), Stage 3 Notes
- **Theme autocomplete** — typing in the Provisional Theme field shows a dropdown of existing theme names from the current case. Selecting a suggestion fills the theme name and automatically applies that theme's saved color to both the color picker and the transcript highlight
- Filter by theme or tagged/untagged status; sort by original order or alphabetically by theme
- **Search bar** in the panel header filters rows across all text fields; shows a live match count

**View 2 — Grouped View**
- Meaning units collapsed under their assigned theme label
- **MU ID** shown inline; clicking it scrolls the transcript panel to that excerpt
- Read-only reference column: Boundary Justification for tagged units, Paraphrase for untagged units
- Stage 3 Notes editable inline
- "Untagged" block at the bottom for units not yet assigned a theme
- **Search bar** (shared with View 1) filters the grouped view in real time

Theme grouping is **case-sensitive** — "Belonging" and "belonging" are treated as distinct themes.

---

## Transcript Panel in Detail

The left panel shows the full immutable transcript. While working:

**Theme highlights (Stage 3)**
- Once a meaning unit has both an excerpt and a provisional theme, the matching text is highlighted in the transcript using the theme color at 30% opacity
- Toggle on/off via "Hide/Show highlights"
- Overlapping excerpts show the lower-order theme's color with a small colored dot for the second theme
- Hovering over highlighted text shows the theme label as a tooltip

**Coverage highlight (Stage 2)**
- Active whenever the Stage 2 tab is open
- Any transcript text that has been copied into a meaning unit's excerpt field is highlighted in blue (`#27C2F5`)
- Text that has both a coverage match and a theme highlight shows the theme color (color takes precedence over blue)
- Hovering over highlighted or theme-highlighted text shows the MU ID(s): e.g., `MU-004` or `MU-004, MU-009`
- Updates live within ~3 seconds of an excerpt being saved

**Matching algorithm**
- All excerpt matching (both highlights and coverage) uses exact normalized match: whitespace collapsed, case-insensitive
- Excerpts containing `...` or `…` are treated as multi-segment; each segment is independently located in the transcript

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
│   │   ├── Sidebar.jsx               # Case list, import, delete, export, DB switcher
│   │   ├── TranscriptPanel.jsx       # Transcript display, search, theme highlights, coverage greying
│   │   ├── StageArea.jsx             # Tab bar + dual-panel split logic
│   │   ├── FreeformStage.jsx         # Stages 1, 4, 5 — textarea with auto-save
│   │   ├── MeaningUnitsStage.jsx     # Stage 2 — table with drag-and-drop, right-click insert
│   │   ├── ProvisionalThemesStage.jsx# Stage 3 — view toggle + state management
│   │   ├── ThemeTaggingView.jsx      # Stage 3 View 1 — per-row theme entry with autocomplete
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
One row per meaning unit. Core fields: `excerpt`, `boundary_justification`, `paraphrase`, `analyst_note`, `mu_order`. Stage 3 fields: `provisional_theme`, `theme_color`, `stage3_notes`. Also includes `day_stamps`. Reorderable by drag-and-drop; insertable at any position via right-click context menu.

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
- Cross-case theme comparison or corpus-level theme aggregation

---

## Notes

- macOS only — ships as a `.dmg`
- No Apple Developer certificate; Gatekeeper bypass (right-click → Open) required on first launch
- The database file persists independently of the app installation
- Switching databases (via the DB button in the sidebar) reloads the case list without restarting the app
- Existing v1.0 databases are automatically migrated on first launch — no data loss

---

## Changelog

### 2026-04-19

- **Global save indicator** — sidebar footer shows "Saved [time]" after any auto-save across all stages
- **Per-stage completion dots** — each sidebar dot now maps to an individual stage (Holistic Memo, Meaning Units, Themes, Whole-Part, Essence) rather than an aggregate count
- **Stage 2 row search** — real-time search bar in the Stage 2 header filters the meaning units table across all text fields; `+ Add Row` hides during a search
- **Stage 3 row search** — search bar in the Stage 3 header filters both the tagging table and grouped view simultaneously with a live match count
- **Click MU ID to locate** — clicking any `MU-NNN` ID in Stage 2 or Stage 3 scrolls the transcript panel to that excerpt
- **Coverage color change** — covered text now highlighted in blue (`#27C2F5`) instead of grey
- **MU ID column in Stage 3 tagging table** — `MU-NNN` ID shown as first column; click to scroll transcript
- **Grouped view MU IDs** — `MU-NNN` IDs shown inline in Stage 3 grouped view; click to scroll transcript
- **Grouped view shows paraphrase for untagged units** — untagged rows now display the paraphrase (instead of boundary justification) as the reference column
- **Auto-resizing textareas** — all text cells in Stage 2 and Stage 3 grow to fit their content automatically
- **Per-stage DB flags** — `getAllTranscripts` query now returns individual boolean columns per stage (`has_memo`, `has_meaning_units`, `has_themes`, `has_whole_part`, `has_essence`) for accurate sidebar dot rendering
- **Performance** — memoized row components (`MURow`, `ThemeTaggingRow`, `GroupedMURow`) and `useCallback`/`useMemo` hooks reduce unnecessary re-renders

### 2026-04-17 (v2.2)

- **Coverage highlight** — transcript text copied into meaning unit excerpts is highlighted to show analyst coverage
- **MU right-click insert** — right-click any Stage 2 row to insert a blank row immediately above or below
- **Theme autocomplete carries color** — selecting an existing theme from the autocomplete dropdown also applies that theme's saved color
- **Stage 3 column additions** — Stage 3 notes column added to the tagging table

### 2026-04-04

- **Ellipsis-segment highlighting** — excerpts containing `...` or `…` are split and each segment is independently located and highlighted in the transcript
- **Exact normalized excerpt matching** — matching collapses whitespace and is case-insensitive
- **Color picker revamp** — improved swatch layout and hex input behavior

### 2026-04-03 (v2.1)

- **Stage 3 theme tagging** — dedicated view for assigning provisional themes, colors, and notes to each meaning unit
- **Transcript theme highlights** — meaning unit excerpts highlighted using assigned theme color once Stage 3 tagging begins; toggle on/off
- **Transcript search** — case-insensitive search within the transcript panel with ↑↓ navigation and match counter
- **Day-locked timestamps** — all analyst content records date and time of first edit per calendar day, included in exports
- **80-swatch color picker** — square grid popup with hex input for theme color assignment

### 2026-04-02 (v1.0)

- **Initial release** — three-panel layout (sidebar, transcript, stage work area)
- **Five-stage workflow** — Holistic Memo, Meaning Units, Provisional Themes, Whole-Part Reconciliation, Individual Essence
- **Auto-save** — all stage content saves automatically every 3 seconds
- **Import / delete** — load `.txt` transcript files with participant ID and workflow condition; remove cases via sidebar
- **Export (single case)** — structured `.txt` file with all stage outputs; Stage 3 grouped by theme
- **Export (corpus)** — two `.csv` files covering all cases
- **Database switching** — open a different `.db` file or create a new one
- **Drag-and-drop row reorder** — Stage 2 meaning units reorderable by drag-and-drop
- **About window** — CC BY-NC-SA 4.0 license and attribution
