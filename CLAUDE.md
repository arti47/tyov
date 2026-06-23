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
through a numbered book of 80 prompts, and records the unlife of a vampire over
centuries as their Memories, Skills, Resources, Characters, and Marks accumulate
and decay.

This app digitizes that bookkeeping: it rolls the dice, tracks your position in
the prompt book, displays each prompt's narrative text, and manages all the
character state with autosave, multi-level undo, backup/restore, and a journal
export.

It is a **single-player, offline-capable Progressive Web App (PWA)** — no
backend, no accounts, no network calls for gameplay. All state lives in the
browser's `localStorage`.

## Tech stack

- **Vanilla JavaScript** (no framework, no bundler). State is a plain object
  rendered to the DOM; the DOM is never the source of truth.
- **Plain HTML** (`index.html`) + **external CSS** (`styles.css`).
- **PWA**: `manifest.json` + an auto-updating service worker (`sw.js`).
- **Tests**: Node's built-in test runner over the pure-logic module
  (`logic.js`). No browser/test framework needed.
- **Lint**: flat-config ESLint (`eslint.config.js`) — config only; run requires
  `npm install`.

### Running locally

Serve over HTTP (the service worker and `fetch` need an HTTP origin):

```bash
npm run serve     # python3 -m http.server 8000  → http://localhost:8000/
npm test          # run the logic unit tests (node --test)
npm run lint      # ESLint (needs `npm install` first; no network = skip)
```

## File map

| File | Purpose |
|------|---------|
| `index.html` | The UI markup only: setup wizard, dice/prompt panel, traits & memories panels, modals. Loads `logic.js` → `data.js` → `app.js`. No inline CSS. |
| `styles.css` | All styles (themes/variables, layout, components, `:focus-visible` a11y outlines). |
| `logic.js` | **Pure**, DOM-free helpers shared by the app and tests: `escapeHtml`, `getTier`, `getPromptText`, `parseMarkdown`, `rollDice` (RNG injectable). Exposed as `window.TYOV` in the browser and `module.exports` in Node. |
| `app.js` | The game engine: the `state` object, render-from-state functions, save/load + v1→v2 migration, undo stack, dice/prompts, traits/memories/diary, triggers, import/export. |
| `data.js` | The prompt database: `const promptDB`, keyed `1..80`, each with tiers `a`/`b`/`c` (first/second/third visit). |
| `manifest.json` | PWA manifest (name, colors, bat emoji icon). |
| `sw.js` | Service worker. `CACHE_NAME` = `vampire-chronicle-v2`. Precaches assets, deletes old caches on activate, network-first for navigations, stale-while-revalidate for other GETs. |
| `tests/logic.test.js` | Unit tests for `logic.js` (escaping, tiers, prompt text, markdown, dice). |
| `package.json` | Scripts: `test`, `serve`, `lint`. ESLint as a dev dependency. |
| `eslint.config.js` | Flat ESLint config with browser + test globals. |
| `README.md` | Minimal. |

## How it works

### State (the `state` object in `app.js`)
A single source of truth, serialized to `localStorage` under key **`tyov_save`**:
- `version` (currently **2**), `maxMemories` (5), `maxDiary` (4).
- `currentPrompt` (0 before first roll), `promptVisits` (`{ num: count }`).
- `futureTriggers` (`[{ prompt, text }]`), `namesHistory`, `turnCount`,
  `rollHistory` (strings), `journalHistory` (`[{ prompt, text }]`).
- `currentName`, `boxedExp`, `currentJournal`.
- `skills` (`{ id, text, lost, checked }`), `resources`/`marks`
  (`{ id, text, lost }`), `characters` (`{ id, text, type, doom, lost }`).
- `memories` / `diary` (`{ id, theme, experiences[], memState }`).
- `settings` (`isLightMode`, `fontSize`, `hideGraveyard`, `muteSound`,
  `reverseTime`, `multiplayer`).
- `display` (`promptResult`, `rollDetails`, `promptText`).

`undoStack` (in `app.js`, not persisted) holds JSON snapshots of the
gameplay-relevant slice for multi-level undo (cap 50).

### Persistence
- **Render from state, never read the DOM as truth.** Each list has a
  `render*()` that rebuilds its `innerHTML` from `state`, escaping all user text
  with `escapeHtml`.
- **Text inputs** update `state` via per-field handlers (`setEntityText`,
  `setMemoryTheme`, `setExperience`) **without re-rendering**, so focus is
  preserved while typing. **Structural** changes (add/lose/delete/migrate/state)
  mutate `state` then re-render that list.
- Autosave: global `input`/`change` listeners call a **debounced** `persist()`
  (300 ms). `persist()` pulls the few free-form DOM fields (name, boxed exp,
  current journal, settings) into `state`, then writes JSON.
- `loadGame()` (on `window.onload`) parses the save, runs **migration** if it's
  legacy (`migrateV1`, see below), `normalizeState()`s it, renders, and re-saves.
  Corrupt JSON is preserved under `tyov_save_corrupt` and the wizard opens.
- Backup/restore export and import the same JSON. **Import is validated**
  (`importSaveData` → migrate/normalize in a `try/catch`) before replacing the save.

### Save migration (v1 → v2)
The old format stored the `innerHTML` of each list under `htmlData`. `migrateV1`
parses those blobs with `DOMParser` into the structured arrays. The raw v1 save
is backed up to `tyov_save_v1_backup`. A save is "legacy" if it has `htmlData`
or no `version`.

### Gameplay flow
1. **Setup wizard** (`#setupWizard`, `nextStep`/`finishSetup`) seeds name, 3
   skills, 3 resources, 3 characters, a Mark, and a first Memory (+4 empty).
2. **Roll** (`rollAndMove`): archives the journal entry, rolls via
   `TYOV.rollDice` (d10−d6; d6−d10 if "Rev. Time"; two d10s if "Multi"),
   advances `currentPrompt`, picks tier a/b/c from visit count, shows prompt
   text, logs history, checks triggers/game-over.
3. **Navigation**: `jumpToPrompt`, `useAccursedStrings` (step back one),
   `undoLastRoll` (multi-level).
4. **Traits**: add/lose (strikethrough = "graveyard") Skills, Resources,
   Characters (Mortal/Immortal + Doom Dots), Marks. `checkSurvivalState()` warns
   at zero active skills+resources; `checkGameOver()` fires on prompts 72–80.
   "Pass a Century" (`killAllMortals`) and `loseMemorySlot` now **confirm** first.
5. **Memories & Diary**: limited blocks with Theme + Experiences. States:
   normal / starred (excluded from the active count) / hazy / vast (5
   experiences) / primal. Memories migrate to the Diary. Limits change via
   `loseMemorySlot`, `expandDiary`, `unlockSecondSeason` (sets max memories 8).
6. **Journal**: per-prompt text is archived into `journalHistory` (tagged
   `<prompt><tier>`). `previewChronicle` renders it; `exportJournal` downloads
   `.txt`. `parseMarkdown` supports `*italics*`/`**bold**` and **escapes first**.

### Conventions to follow
- **Public functions are global** and called from inline `onclick`/`onchange`.
  If you rename one, update every reference in `index.html` and in the
  template-literal HTML that `render*()` emits.
- **Always escape user text** with `escapeHtml` (or `parseMarkdown`, which
  escapes) before putting it in `innerHTML`. Never interpolate raw user input.
- After mutating `state`, call the relevant `render*()` and `persist()`
  (or rely on the global autosave listener for plain text edits).
- Keep pure, testable logic in `logic.js` and add a test in
  `tests/logic.test.js`. Keep `app.js` for DOM/state wiring.
- No external libraries — keep it dependency-free and vanilla.
- The game data in `data.js` is the canonical TYOV prompt text; edit it only to
  fix transcription errors.

### Bumping the service worker cache
If you change any cached asset (`index.html`, `styles.css`, `logic.js`,
`app.js`, `data.js`, `manifest.json`), bump `CACHE_NAME` in `sw.js`
(e.g. `-v2` → `-v3`). The SW also network-first-loads navigations, so updates
generally land on next load even without a bump — but bump for certainty, and
keep the `ASSETS` precache list in sync when you add/remove files.

## Keeping this file up to date

This is a hard requirement of working in this repo:

1. Make your code change.
2. Update the affected section(s) above (file map, state shape, save format,
   flow, conventions).
3. If you changed cached assets, bump `CACHE_NAME` and update `ASSETS` in `sw.js`.
4. Add/adjust tests in `tests/` for any logic change.
5. Commit the code and the `CLAUDE.md` update **together**.

If a change makes any statement here false, fix the statement.
