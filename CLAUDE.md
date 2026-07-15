# CLAUDE.md

Guidance for AI agents (and humans) working in this repository.

> **⚠️ MAINTENANCE RULE — READ FIRST**
> **Whenever you change the code, you MUST update this file in the same commit.**
> If you add/remove/rename a function, change the save-data shape, add a file,
> change game rules, or alter the UI structure, reflect it in the relevant
> section below. Treat an out-of-date CLAUDE.md as a bug. See
> [Keeping this file up to date](#keeping-this-file-up-to-date).
>
> **Also keep the [Roadmap](#roadmap--rules-fidelity-gaps) current** — when a
> change closes (or opens) a gap between this app and the rules-as-written, move
> or edit that roadmap item in the same commit. **Always merge the latest
> `main` into your working branch before you start and before you push**, so the
> roadmap and code never drift from `main`.

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
| `index.html` | The UI markup only. A global header (title, name, warnings/nudges, autosave indicator) + a sticky one-row **tab bar** (`▶ Play`, `📜 Character`, `📔 Diary`, `📖 Journal`, `⚙ Settings` — icon-only on mobile) over five `.tab-panel` sections, a sticky `#promptBanner` (current prompt, shown on non-Play tabs), the setup wizard, the confirm modal (`#appModal`), and the floating oracle. Loads `logic.js` → `data.js` → `app.js`. No inline CSS. |
| `styles.css` | All styles (themes/variables, layout, components, `:focus-visible` a11y outlines). Ends with a `@media (max-width: 680px)` block for the responsive/mobile layout; form controls use `min-width: 0` and the body has `overflow-x: hidden` so nothing scrolls sideways on phones. |
| `logic.js` | **Pure**, DOM-free helpers shared by the app and tests: `escapeHtml`, `getTier`, `getPromptText`, `parseMarkdown`, `rollDice` (RNG injectable), `resolveTraitAction` (Skill/Resource substitution ladder), `rollMeaning` (d100 → meaning-table word), and the save-state helpers `genId`/`defaultState`/`normMem`/`normalizeState` (+`SAVE_VERSION`). Exposed as `window.TYOV` in the browser and `module.exports` in Node. |
| `app.js` | The game engine: the `state` object, render-from-state functions, save/load + v1→v2 migration, full-state undo stack, dice/prompts, traits/memories/diary, triggers, guided prompt actions, nudges, the Meaning Oracle, import/export. |
| `data.js` | The prompt database: `const promptDB`, keyed `1..80`, each with tiers `a`/`b`/`c` (first/second/third visit). Also `const meaningTable` — the 100-word Meaning Oracle list (1-indexed by a d100 roll). |
| `assets/dice.wav`, `assets/page.wav` | Bundled, precached sound effects (dice roll, page turn) — local so audio works offline. Generated lightweight WAVs. |
| `assets/icon-192.png`, `assets/icon-512.png`, `assets/icon-180.png` | PWA / home-screen icons (192 & 512 for the manifest incl. `maskable`; 180 for the iOS `apple-touch-icon`). Generated PNGs (blood-red field, dark moon, white fangs). |
| `manifest.json` | PWA manifest: name/short_name/description, `start_url`/`scope`/`id` (all relative so it works under a Pages subpath), `standalone`, colors, and PNG icons (`any` + `maskable`). Drives "Add to Home Screen". |
| `sw.js` | Service worker. `CACHE_NAME` = `vampire-chronicle-v11`. Precaches assets (incl. `assets/*.wav` and `assets/icon-*.png`), deletes old caches on activate, network-first for navigations, stale-while-revalidate for other GETs. **Does not `skipWaiting()` on install** — it waits so the page can offer "tap to update", and calls `skipWaiting()` only on a `SKIP_WAITING` message. |
| `.github/workflows/pages.yml` | GitHub Actions workflow: on push to `main`, runs `npm test` then deploys the repo root to **GitHub Pages**. Requires Pages Source = "GitHub Actions" (one-time repo setting). |
| `.github/workflows/ci.yml` | CI workflow: on push to `main` and on PRs, runs `npm ci` → `npm test` → `npm run lint`. |
| `tests/logic.test.js` | Unit tests for `logic.js` (escaping, tiers, prompt text, markdown, dice, `resolveTraitAction`, `rollMeaning`, and state normalization: `normalizeState`/`normMem`/`defaultState`). |
| `package.json` / `package-lock.json` | Scripts: `test`, `serve`, `lint`. ESLint as the sole devDependency; the lockfile pins it for reproducible CI. |
| `eslint.config.js` | Flat ESLint config with browser + test globals. |
| `.gitignore` | Ignores `node_modules/`, editor cruft, and `_qa_*.html` scratch files. |
| `README.md` | Minimal. |

## How it works

### State (the `state` object in `app.js`)
A single source of truth, serialized to `localStorage` under key **`tyov_save`**:
- `version` (currently **2**), `maxMemories` (5), `maxDiary` (4).
- `currentPrompt` (0 before first roll), `promptVisits` (`{ num: count }`).
- `futureTriggers` (`[{ prompt, text }]`), `namesHistory`, `turnCount`,
  `rollsSinceOldAge`, `rollsSinceBackup` (drive the old-age / backup nudges),
  `gameOver` (bool), `rollHistory` (strings), `journalHistory` (`[{ prompt, text }]`).
- `currentName`, `boxedExp`, `currentJournal`, `activeTab` (last-viewed tab:
  `play`|`character`|`diary`|`journal`|`settings`, restored on load).
- `skills` (`{ id, text, lost, checked }`), `marks` (`{ id, text, lost }`),
  `resources` (`{ id, text, lost, isDiary? }` — `isDiary` marks the one
  auto-managed Diary Resource), `characters` (`{ id, text, type, doom, lost }`).
- `memories` / `diary` (`{ id, theme, experiences[], memState, lost }` — `lost`
  strikes out a Memory, e.g. when the Diary Resource is lost). `experiences` is a
  **compact** array (≥1, up to 3 — or 5 when Vast); trailing empties are trimmed
  by `normMem`, and rows are added/removed via `addExperience`/`removeExperience`.
- `settings` (`isLightMode`, `fontSize`, `hideGraveyard`, `muteSound`,
  `multiplayer`). **`reverseTime` is intentionally NOT persisted** — it is a
  one-shot cleared after each roll.
- `display` (`promptResult`, `rollDetails`, `promptText`).

`undoStack` (in `app.js`, not persisted) holds JSON snapshots of the **full**
`state` plus the journal textarea (`pushUndo()`), for multi-level undo (cap 50)
covering rolls **and** trait/memory edits. `tyov_save_history` is a separate
rolling backup of the last 10 good saves used to recover a corrupt `tyov_save`.

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
  current journal, settings) into `state`, writes JSON, appends to the rolling
  `tyov_save_history` backup, and updates the `#saveStatus` indicator.
- `loadGame()` (on `window.onload`) parses the save, runs **migration** if it's
  legacy (`migrateV1`, see below), `normalizeState()`s it, renders, and re-saves.
  Corrupt JSON is preserved under `tyov_save_corrupt`; the loader then tries to
  **recover from the newest `tyov_save_history` snapshot** before falling back to
  opening the wizard.
- Backup/restore export and import the same JSON. **Import is validated**
  (`importSaveData` → migrate/normalize in a `try/catch`) before replacing the save.

### Save migration (v1 → v2)
The old format stored the `innerHTML` of each list under `htmlData`. `migrateV1`
parses those blobs with `DOMParser` into the structured arrays. The raw v1 save
is backed up to `tyov_save_v1_backup`. A save is "legacy" if it has `htmlData`
or no `version`.

### Gameplay flow
1. **Setup wizard** (`#setupWizard`, 8 steps) rebuilds the rules-faithful vampire
   creation. `gotoStep`/`validateStep` require every field before advancing;
   `finishSetup` seeds name, 3 Skills, 3 Resources, 3 Mortal Characters, the
   **Immortal sire** (created as an Immortal), a Mark, and **five Memories each
   seeded with one Experience** (life summary, three trait-combining, the
   transformation). The Memory steps show a live **"traits so far"** recap
   (`fillTraitRecaps` → `.trait-recap` panels) so you can see the Skills/
   Resources/Characters you entered earlier while writing combining Experiences.
2. **Roll** (`rollAndMove`): snapshots undo, archives the journal entry, rolls via
   `TYOV.rollDice` (d10−d6; d6−d10 if "Rev. Time"; two d10s if "Multi"),
   **clears the one-shot Rev. Time**, plays a brief dice animation (`animateDice`
   → the `#diceAnim` faces + net), advances `currentPrompt`, picks tier a/b/c from
   visit count, updates the tier/visit badge (`updatePromptMeta`), ticks the
   old-age/backup nudge counters, logs history, checks triggers/game-over.
3. **Navigation**: `jumpToPrompt`, `stepBackOnePrompt` (manual back-one; formerly
   "Accursed Strings"), `advanceToNextPrompt` (offered once all three tiers are
   answered), `undoLastRoll` (multi-level, full-state).
4. **Guided prompt actions** (`promptCheckSkill`/`promptLoseResource`): apply the
   rules substitution ladder via `TYOV.resolveTraitAction` — check↔lose, and when
   neither is possible `offerGameOver`→`declareGameOver`. `checkSurvivalState()`
   warns at zero active skills+resources; `checkGameOver()` sets `gameOver` on
   prompts 72–80 (each a "the game is over" prompt) and disables the roll button.
5. **Traits**: add/lose (strikethrough = "graveyard") Skills, Resources,
   Characters (Mortal/Immortal + Doom Dots, tooltip = Prompt-98 lifespan halving),
   Marks. Every structural mutation calls `pushUndo()` first. A periodic old-age
   **nudge** suggests striking mortals; "Pass a Century" (`killAllMortals`) and
   `loseMemorySlot` **confirm** first.
6. **Memories & Diary**: blocks with Theme + **flexible Experience rows**
   (`addExperience`/`removeExperience`, each row has a `×`, `+ Experience` up to
   the cap). States: normal / starred (excluded from active count) / hazy
   (verbs+adjectives only) / vast (up to 5 experiences) / primal (feelings clause
   only) — each shows a writing reminder. The **Diary is an auto-managed Resource**
   (`ensureDiaryResource`, `isDiary` flag): holds ≤4 Memories, its Memories are
   **frozen** (read-only Experiences, no add/remove), and losing the Diary
   Resource strikes out (`lost`) its Memories. No Diary-expand or "2nd Season".
7. **Journal**: per-prompt text is archived into `journalHistory` (tagged
   `<prompt><tier>`). The **Journal tab** (`renderJournalTab` → `#journalTabContent`)
   renders the chronicle inline; `exportJournal` downloads `.txt` (both skip
   struck-out Memories). `parseMarkdown` supports `*italics*`/`**bold**` and
   **escapes first**.
   **Tabs** (`showTab`, `TABS` array, persisted in `state.activeTab`): Play (dice/
   prompt/response/history/triggers) · Character (traits + Memories) · Diary ·
   Journal · Settings (theme/font/mute + backup/restore/wipe). The one-row tab bar
   collapses to icons on mobile (`≤680px`; `.tab-label` hidden). The `#promptBanner`
   (`updatePromptBanner`) shows the current prompt on non-Play tabs and jumps back
   to Play when tapped.
   **Meaning spark** (`sparkInto`): a 🎲 button on setup memory steps and each
   Character-tab Memory block rolls `rollMeaning` ×3 and **shows** the words as
   inspiration beside the field (not inserted). The floating oracle still inserts.
8. **Nudges & feedback**: `toast()` shows non-blocking messages; `#saveStatus`
   shows autosave state; dismissable banners nudge old-age deaths (`#ageNudge`)
   and periodic backups (`#backupNudge`). Blocking decisions use the in-app modal
   `showConfirm`/`showAlert` (`#appModal`, callback-based, Esc = cancel) instead
   of native `alert()`/`confirm()`.

### Meaning Oracle (floating idea generator)
A floating 🎲 button (`#oracleFab`) toggles the `#oraclePanel`. `rerollOracle()`
rolls `TYOV.rollMeaning(meaningTable)` three times; `renderOracle()` shows each
word with its d100 roll. `insertOracle()` drops the three words into the text
field you last had focused — a global `focusin` listener records the last
insertable field (`lastActiveField`) so the button taking focus doesn't lose it;
`insertAtCaret()` splices at the caret and fires an `input` event so autosave and
per-field handlers run. Textareas get one word per line; single-line inputs get a
comma separator; with no active field it copies to the clipboard. Not a rule —
purely a brainstorming aid.

### PWA install & self-update
- **Add to Home Screen**: `manifest.json` (PNG icons `any` + `maskable`,
  `standalone`, relative `start_url`/`scope`) plus iOS `apple-touch-icon` and
  `apple-mobile-web-app-*` meta tags in `<head>` make the app installable on
  Android (Chrome install prompt) and iOS (Share → Add to Home Screen).
- **Tap-to-update**: `initServiceWorker()` (in `app.js`, run on `load`) registers
  `./sw.js` and watches for an updated worker. When one finishes installing (and
  a controller already exists), it calls `showUpdateToast()` → the `#updateToast`
  banner. `applyUpdate()` posts `SKIP_WAITING` to the waiting worker; the worker
  activates, `controllerchange` fires, and the page reloads onto the new code.
  For this to trigger on a deploy, the changed build must produce a byte-different
  `sw.js` — i.e. **bump `CACHE_NAME`** (see below).

### Deployment (GitHub Pages)
`.github/workflows/pages.yml` deploys the repo root to GitHub Pages on push to
`main` (running `npm test` first as a gate). Enable it once via
**Settings → Pages → Source: "GitHub Actions"**. The site serves at
`https://<owner>.github.io/<repo>/`; all asset paths are relative so it works
under that subpath. Every asset the SW precaches must stay same-origin/relative.

### Conventions to follow
- **Public functions are global** and called from inline `onclick`/`onchange`.
  If you rename one, update every reference in `index.html` and in the
  template-literal HTML that `render*()` emits.
- **Always escape user text** with `escapeHtml` (or `parseMarkdown`, which
  escapes) before putting it in `innerHTML`. Never interpolate raw user input.
- **No native `alert()`/`confirm()`** — use `showAlert`/`showConfirm` (callback
  onConfirm) or `toast()` for non-blocking notices.
- After mutating `state`, call the relevant `render*()` and `persist()`
  (or rely on the global autosave listener for plain text edits).
- **Call `pushUndo()` BEFORE any structural mutation** (add/lose/delete/state
  change, rolls, jumps) so multi-level undo stays complete. Do **not** call it on
  per-keystroke text edits — those flood the stack and are covered by autosave.
- Keep pure, testable logic in `logic.js` and add a test in
  `tests/logic.test.js`. Keep `app.js` for DOM/state wiring.
- No external libraries — keep it dependency-free and vanilla.
- The game data in `data.js` is the canonical TYOV prompt text; edit it only to
  fix transcription errors.

### Bumping the service worker cache
If you change any cached asset (`index.html`, `styles.css`, `logic.js`,
`app.js`, `data.js`, `manifest.json`, `assets/*.wav`, `assets/icon-*.png`), bump
`CACHE_NAME` in `sw.js` (currently `-v11`). Bumping it is also what makes the
deployed `sw.js` byte-different, which is what triggers the tap-to-update toast
for existing installs. The SW also network-first-loads navigations, so updates
generally land on next load even without a bump — but bump for certainty, and
keep the `ASSETS` precache list in sync when you add/remove files.

## Roadmap — rules-fidelity gaps

Tracked differences between this app and *Thousand Year Old Vampire* as written
(rulebook + appendices). Verified against the full source text. Keep this list
live: when you close a gap, move it to **Done**; if you find a new one, add it.
Severity reflects how far the app drifts from the rules-as-written, not effort.

**Design principle:** *Guided* — the app surfaces the correct move and nudges
toward it, but the player can override. (Exception: setup is fully faithful and
required.) Delivery is **phased**; Phases 1–2 and Phase 3's a11y/CI are done —
only save-slots/export (B8/B9) remain.

### Planned / open

**Phase 3 — Saves / export (remaining)**
- **B8** Multiple save slots / vampires (keyed save collection + chooser).
- **B9** Markdown export and a print-friendly chronicle stylesheet.

### Scoping decisions (not bugs)

- `data.js` is the **Standard Prompt Database (1–80)** only. Appendix I
  alternate Prompts (81–135) are intentionally out of scope.
- Prompts **72–80** are each single-entry "The game is over" Prompts, so
  `checkGameOver()` disabling the roll across that range is **faithful**.

### Done

**Phase 3 — accessibility + CI**
- **B10** Screen-reader live region (`#srAnnounce`/`announce()`) for roll/jump/
  step/advance/game-over; modal focus trap (`focusablesIn`/`openModalEl` + Tab
  handler) with Esc closing dismissable overlays and focus moved in on open;
  `role="dialog"`/`aria-modal` on the wizard & journal modals; `.sr-only`; the
  noisy `#saveStatus`/`#tierBadge` live regions were made visual-only.
- **C1** `genId`/`defaultState`/`normMem`/`normalizeState` moved to `logic.js`
  and unit-tested (18 tests total). (v1 `migrateV1` stays in `app.js` — it needs
  `DOMParser`, untestable in Node without jsdom.)
- **C2** `.github/workflows/ci.yml` runs `npm ci` → `npm test` → `npm run lint`
  on push/PR. `package-lock.json` committed; `node_modules/` git-ignored.

**Phase 2 — UX polish** (complete)
- **B2** Responsive/mobile layout pass — verified in a real 390px viewport
  (headless Chromium via an iframe; note `--window-size` alone does **not** set
  `innerWidth`, so measure inside a sized iframe or via `getBoundingClientRect`).
- **B3** In-app `showConfirm`/`showAlert` modal (`#appModal`) replacing every
  native `alert()`/`confirm()`; non-critical notices became `toast()`s.
- **B7** Flexible Experience rows (compact `experiences[]`, `addExperience`/
  `removeExperience`, `×` per row + `+ Experience`, capped at 3 / 5 when Vast).
- **B11** Dice-roll animation (`animateDice` → `#diceAnim`), with
  `prefers-reduced-motion` respected.

**Phase 1 — rules fidelity + audio + data safety** (this commit)
- **A1** Setup wizard rebuilt (8 steps, required): 5 seeded Memories + Immortal sire.
- **A2/A3** Guided `promptCheckSkill`/`promptLoseResource` substitution ladder
  (`resolveTraitAction`) with game-over-on-exhaustion offer.
- **A4** Rev. Time is now a one-shot (auto-clears after a roll).
- **A5** "Strings (-1)" relabeled to a neutral "Step Back" (`stepBackOnePrompt`).
- **A6** Faithful Diary: frozen Experiences, auto Diary Resource (`isDiary`),
  4-cap, and lose-Resource-strikes-Memories.
- **A7** Removed the unfounded "2nd Season" (and the Diary "Expand Limit").
- **A8/A12** Doom-dots tooltip (Prompt-98 lifespan) + periodic old-age nudge.
- **A9** Auto-advance offer once all three tiers are answered.
- **A10** Optional-end note on Prompt 69c.
- **A11** Hazy/Primal/Vast/Starred writing reminders; **B6** tier + visit badge.
- **B1** Bundled local `assets/*.wav` audio, precached in the SW.
- **B4** Autosave `#saveStatus` indicator; **B12** periodic backup nudge.
- **C4** Rolling `tyov_save_history` snapshots + corrupt-save recovery.
- **B5** Undo extended to full-state (covers trait/memory edits too).

## Keeping this file up to date

This is a hard requirement of working in this repo:

1. **Merge the latest `main`** into your working branch before you start.
2. Make your code change.
3. Update the affected section(s) above (file map, state shape, save format,
   flow, conventions).
4. Update the [Roadmap](#roadmap--rules-fidelity-gaps): move any gap you closed
   to **Done**, and add any new gap you introduced or discovered.
5. If you changed cached assets, bump `CACHE_NAME` and update `ASSETS` in `sw.js`.
6. Add/adjust tests in `tests/` for any logic change.
7. Commit the code and the `CLAUDE.md` update **together**.
8. **Merge `main` again and push** so the branch never drifts from `main`.

If a change makes any statement here false, fix the statement.
