# CLAUDE.md

Guidance for AI agents (and humans) working in this repository.

> **⚠️ MAINTENANCE RULE — READ FIRST**
> **Whenever you change the code, you MUST update this file in the same commit.**
> If you add/remove/rename a function, change the save-data shape, add a file,
> change game rules, or alter the UI structure, reflect it in the relevant
> section below. Treat an out-of-date CLAUDE.md as a bug. See
> [Keeping this file up to date](#keeping-this-file-up-to-date).

---

## What this project is

**Thousand Year Old Vampire — Companion** ("Vampire Chronicle") is a
browser-based companion app for the solo, single-player journaling tabletop RPG
*Thousand Year Old Vampire* by Tim Hutchings. The player rolls dice to move
through a numbered book of 80 prompts, records the unlife of a vampire over
centuries, and watches their Memories, Skills, Resources, Characters, and Marks
accumulate and decay.

This app digitizes that bookkeeping: it rolls the dice, tracks your position in
the prompt book, displays each prompt's narrative text, and manages all the
character state (traits, memories, diary) with autosave, undo, backup/restore,
and a journal export.

It is a **single-player, offline-capable Progressive Web App (PWA)** — no
backend, no accounts, no network calls for gameplay. All state lives in the
browser's `localStorage`.

## Tech stack

- **Vanilla JavaScript** (no framework, no bundler, no package manager).
- **Plain HTML + inline CSS** (all styles live in a `<style>` block in `index.html`).
- **PWA**: `manifest.json` + a cache-first service worker (`sw.js`).
- No build step, no dependencies, no tests. Open `index.html` in a browser to run.

### Running locally

Because the service worker and `fetch` require an HTTP origin, serve the folder
rather than opening the file directly:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/
```

(Opening `index.html` via `file://` mostly works but the service worker will not register.)

## File map

| File | Purpose |
|------|---------|
| `index.html` | The entire UI: setup wizard, dice/prompt panel, traits panel, memories/diary panel, modals, and all CSS. Loads `data.js` then `app.js`. |
| `app.js` | The game engine: save/load/undo, dice & movement, prompt display, traits/memories/diary management, triggers, import/export. ~700 lines of plain functions on the global scope. |
| `data.js` | The prompt database: `const promptDB`, an object keyed by prompt number `1..80`, each with tiers `a`/`b`/`c` (first/second/third visit) containing the prompt's narrative text. |
| `manifest.json` | PWA manifest (name, colors, bat emoji icon). |
| `sw.js` | Service worker. Cache name `vampire-chronicle-v1`; precaches the core assets and serves cache-first. |
| `README.md` | Minimal. |

## How it works

### State (globals in `app.js`)
- `maxMemories` (default 5), `maxDiary` (default 4) — slot limits.
- `currentPrompt` — current position in the 1..80 prompt book (0 before first roll).
- `promptVisits` — `{ promptNum: visitCount }`, used to pick tier a/b/c.
- `futureTriggers` — array of `{ prompt, text }` reminders that fire on arrival.
- `namesHistory`, `turnCount`, `rollHistory`, `journalHistory`.
- `previousState` — single-level undo snapshot.
- `isGameLoaded` — guards autosave until load/setup completes (iOS Safari fix).

### Persistence
- Autosave: global `input` and `change` listeners call `saveGame()`.
- `saveGame()` serializes globals **plus** the `innerHTML` of the dynamic lists
  (skills/resources/characters/marks/memories/diary) and key display nodes into
  `localStorage` under the key **`tyov_save`**. `syncInputsToAttributes()` first
  copies live input values into HTML attributes so the saved markup round-trips.
- `loadGame()` (runs on `window.onload`) restores everything, or opens the
  **setup wizard** if no save exists.
- Backup/restore export and import the same JSON blob as a file.

### Gameplay flow
1. **Setup wizard** (`index.html` `#setupWizard`, driven by `nextStep`/`finishSetup`)
   collects name, 3 skills, 3 resources, 3 characters, a Mark, and a first Memory.
2. **Roll** (`rollAndMove`): archives the current journal entry, rolls dice via
   `calculateMove()` (d10 − d6 normally; d6 − d10 if "Rev. Time"; two d10s if
   "Multi"), advances `currentPrompt`, picks tier a/b/c from visit count, shows
   the prompt text from `promptDB`, logs history, checks triggers/game-over.
3. **Navigation aids**: `jumpToPrompt`, `useAccursedStrings` (step back one),
   `undoLastRoll` (one level).
4. **Traits**: add/lose (strikethrough = "graveyard") Skills, Resources,
   Characters (Mortal/Immortal, with Doom Dots), Marks. `checkSurvivalState()`
   warns when no active skills/resources remain; `checkGameOver()` triggers on
   prompts 72–80.
5. **Memories & Diary**: max-limited blocks with Theme + Experiences. States:
   normal / starred (doesn't count toward limit) / hazy / vast (5 experiences) /
   primal. Memories can migrate to the Diary. Slot limits change via
   `loseMemorySlot`, `expandDiary`, `unlockSecondSeason` (sets max memories to 8).
6. **Journal**: per-prompt narrative text is archived into `journalHistory`
   (tagged `<prompt><tier>`). `previewChronicle` renders it; `exportJournal`
   downloads a `.txt`. `parseMarkdown` supports `*italics*` / `**bold**`.

### Conventions to follow
- **Functions are global and called from inline `onclick`/`onchange` handlers in
  `index.html`.** If you rename a function in `app.js`, update every reference in
  the HTML, and vice versa.
- Dynamic rows are built with template-literal HTML strings via
  `insertAdjacentHTML`. State is persisted by saving `innerHTML`, so keep markup
  self-contained and avoid relying on JS-only state for anything that must survive
  a reload.
- After any mutation, call `saveGame()` (most helpers already do).
- No external libraries — keep it dependency-free and vanilla.
- The game data in `data.js` is the canonical TYOV prompt text; edit it only to
  fix transcription errors.

### Bumping the service worker cache
If you change `index.html`, `app.js`, `data.js`, or `manifest.json`, users with
the PWA installed may keep serving stale cached files. Bump `CACHE_NAME` in
`sw.js` (e.g. `vampire-chronicle-v1` → `-v2`) when shipping user-facing changes.

## Keeping this file up to date

This is a hard requirement of working in this repo:

1. Make your code change.
2. Update the affected section(s) above (file map, globals, save shape, flow,
   conventions).
3. If you changed cached assets, bump `CACHE_NAME` in `sw.js`.
4. Commit the code and the `CLAUDE.md` update **together**.

If a change makes any statement here false, fix the statement.
