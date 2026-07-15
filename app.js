// app.js
// The engine for the Thousand Year Old Vampire Companion.
//
// State model (v2): a single `state` object is the source of truth. The DOM is
// rendered FROM state; it is never read back as the source of truth. This kills
// the previous innerHTML-as-state design and the XSS/quote bugs that came with
// it. All user text is escaped via TYOV.escapeHtml before it touches innerHTML.

'use strict';

var escapeHtml = TYOV.escapeHtml;
var getTier = TYOV.getTier;
var getPromptText = TYOV.getPromptText;
var parseMarkdown = TYOV.parseMarkdown;

var SAVE_KEY = 'tyov_save';
var SAVE_VERSION = 2;

var isGameLoaded = false; // Guards autosave until load/setup completes.
var undoStack = [];        // Multi-level undo of gameplay state.

function defaultState() {
    return {
        version: SAVE_VERSION,
        maxMemories: 5,
        maxDiary: 4,
        currentPrompt: 0,
        promptVisits: {},
        futureTriggers: [],
        namesHistory: [],
        turnCount: 0,
        rollsSinceOldAge: 0,   // Rolls since the last old-age nudge (see rules p.155).
        rollsSinceBackup: 0,   // Rolls since the last export, drives the backup reminder.
        gameOver: false,       // True once a game-ending Prompt/exhaustion has fired.
        rollHistory: [],
        journalHistory: [],
        currentName: '',
        boxedExp: '',
        currentJournal: '',
        skills: [],      // { id, text, lost, checked }
        resources: [],   // { id, text, lost }
        characters: [],  // { id, text, type: 'Mortal'|'Immortal', doom, lost }
        marks: [],       // { id, text, lost }
        memories: [],    // { id, theme, experiences[], memState }
        diary: [],       // same shape as memories
        settings: {},
        display: {
            promptResult: 'Awaiting First Roll...',
            rollDetails: '',
            promptText: 'Your prompt narrative will appear here.'
        }
    };
}

var state = defaultState();

// ==========================================
// SMALL DOM HELPERS
// ==========================================

function el(id) { return document.getElementById(id); }
function val(id) { var e = el(id); return e ? e.value : ''; }
function setVal(id, v) { var e = el(id); if (e) e.value = v || ''; }
function checked(id) { var e = el(id); return e ? e.checked : false; }
function setChecked(id, v) { var e = el(id); if (e) e.checked = !!v; }
function setText(id, t) { var e = el(id); if (e) e.innerText = t; }
function genId() {
    return 'e' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}
function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
}

// Lightweight non-blocking toast. (Phase 2 will replace confirm()/alert() with
// full modals; this is the shared surface for Guided nudges in the meantime.)
var toastTimer;
function toast(msg, kind) {
    var box = el('toast');
    if (!box) { console.log('toast:', msg); return; }
    box.textContent = msg;
    box.className = 'toast show' + (kind ? ' toast-' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.className = 'toast'; }, 4200);
}

function setSaveStatus(text) {
    var s = el('saveStatus');
    if (s) s.textContent = text;
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function nowHM() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

// ==========================================
// AUDIO CUES & THEMES
// ==========================================

function playSound(type) {
    if (checked('optMuteSound')) return;
    try {
        var sfx = el(type === 'dice' ? 'sfxDice' : 'sfxPage');
        if (sfx) {
            sfx.currentTime = 0;
            sfx.play().catch(function () { console.log('Audio prevented by browser'); });
        }
    } catch (e) { /* ignore */ }
}

function toggleTheme() {
    var isLight = document.body.classList.toggle('light-mode');
    setText('btnTheme', isLight ? 'Toggle Dark Mode' : 'Toggle Light Mode');
    persist();
}

function changeFontSize(delta) {
    var cur = parseInt(getComputedStyle(document.body).getPropertyValue('--base-font-size'), 10) || 16;
    var next = Math.max(12, Math.min(24, cur + delta));
    document.body.style.setProperty('--base-font-size', next + 'px');
    persist();
}

function toggleGraveyard() {
    el('traitsContainer').classList.toggle('hide-graveyard', checked('hideGraveyardToggle'));
    persist();
}

// ==========================================
// SETUP WIZARD
// ==========================================

function nextStep(stepNum) {
    var steps = document.querySelectorAll('.wizard-step');
    for (var i = 0; i < steps.length; i++) steps[i].style.display = 'none';
    el('step' + stepNum).style.display = 'block';
    fillTraitRecaps(); // keep the "traits so far" reference current on every step
}

// Populate the read-only "your traits so far" panels shown on the Memory steps,
// so you can see the Skills/Resources/Characters you entered earlier while you
// write Experiences that combine them.
function recapLine(label, ids) {
    var vals = ids.map(function (id) { return val(id).trim(); }).filter(Boolean);
    return '<div><em>' + label + ':</em> ' +
        (vals.length ? vals.map(escapeHtml).join(', ') : '<span class="recap-empty">— none yet —</span>') +
        '</div>';
}
function fillTraitRecaps() {
    var html = '<strong>Your traits so far</strong>' +
        recapLine('Skills', ['setupSkill1', 'setupSkill2', 'setupSkill3']) +
        recapLine('Resources', ['setupRes1', 'setupRes2', 'setupRes3']) +
        recapLine('Characters', ['setupChar1', 'setupChar2', 'setupChar3']);
    var nodes = document.querySelectorAll('.trait-recap');
    for (var i = 0; i < nodes.length; i++) nodes[i].innerHTML = html;
}

function setStepError(fromStep, msg) {
    var e = el('err' + fromStep);
    if (e) e.textContent = msg || '';
}

// Required-field validation for the faithful creation sequence. Every field a
// field the rules seed on the character record must be present before Begin.
function validateStep(stepNum) {
    var missing = [];
    function need(id, label) { if (!val(id).trim()) missing.push(label); }
    if (stepNum === 1) { need('setupName', 'your mortal name'); }
    if (stepNum === 2) { ['setupSkill1', 'setupSkill2', 'setupSkill3'].forEach(function (id, i) { need(id, 'Skill ' + (i + 1)); }); }
    if (stepNum === 3) { ['setupRes1', 'setupRes2', 'setupRes3'].forEach(function (id, i) { need(id, 'Resource ' + (i + 1)); }); }
    if (stepNum === 4) { ['setupChar1', 'setupChar2', 'setupChar3'].forEach(function (id, i) { need(id, 'Character ' + (i + 1)); }); }
    if (stepNum === 5) { need('setupMemTheme1', 'Memory 1 theme'); need('setupMemExp1', 'Memory 1 Experience'); }
    if (stepNum === 6) {
        need('setupMemTheme2', 'Memory 2 theme'); need('setupMemExp2', 'Experience 2');
        need('setupMemTheme3', 'Memory 3 theme'); need('setupMemExp3', 'Experience 3');
    }
    if (stepNum === 7) { need('setupMemTheme4', 'Memory 4 theme'); need('setupMemExp4', 'Experience 4'); }
    if (stepNum === 8) {
        need('setupSire', 'the immortal who turned you'); need('setupMark', 'your Mark');
        need('setupMemTheme5', 'Memory 5 theme'); need('setupMemExp5', 'the transformation Experience');
    }
    if (missing.length) {
        setStepError(stepNum, 'Please fill in: ' + missing.join(', ') + '.');
        return false;
    }
    setStepError(stepNum, '');
    return true;
}

// Advance from `fromStep`, validating it first.
function gotoStep(nextStepNum) {
    var fromStep = nextStepNum - 1;
    if (!validateStep(fromStep)) return;
    nextStep(nextStepNum);
}

function newMemory(theme, exp1) {
    return { id: genId(), theme: theme || '', experiences: [exp1 || '', '', ''], memState: 'normal', lost: false };
}

function finishSetup() {
    if (!validateStep(8)) return;

    state.currentName = val('setupName');

    ['setupSkill1', 'setupSkill2', 'setupSkill3'].forEach(function (id) {
        var v = val(id);
        if (v) state.skills.push({ id: genId(), text: v, lost: false, checked: false });
    });
    ['setupRes1', 'setupRes2', 'setupRes3'].forEach(function (id) {
        var v = val(id);
        if (v) state.resources.push({ id: genId(), text: v, lost: false });
    });
    ['setupChar1', 'setupChar2', 'setupChar3'].forEach(function (id) {
        var v = val(id);
        if (v) state.characters.push({ id: genId(), text: v, type: 'Mortal', doom: 0, lost: false });
    });
    // The immortal who turned you — created last, per the rules (an enemy Immortal).
    var sire = val('setupSire');
    if (sire) state.characters.push({ id: genId(), text: sire, type: 'Immortal', doom: 0, lost: false });

    var mark = val('setupMark');
    if (mark) state.marks.push({ id: genId(), text: mark, lost: false });

    // Five Memories, each seeded with one Experience (life summary, three
    // trait-combining, and the transformation).
    state.memories.push(newMemory(val('setupMemTheme1'), val('setupMemExp1')));
    state.memories.push(newMemory(val('setupMemTheme2'), val('setupMemExp2')));
    state.memories.push(newMemory(val('setupMemTheme3'), val('setupMemExp3')));
    state.memories.push(newMemory(val('setupMemTheme4'), val('setupMemExp4')));
    state.memories.push(newMemory(val('setupMemTheme5'), val('setupMemExp5')));

    el('setupWizard').style.display = 'none';
    isGameLoaded = true;
    applyState();
    persist();
}

function showWizard() {
    el('setupWizard').style.display = 'flex';
    nextStep(1);
}

// ==========================================
// SAVE, LOAD, MIGRATION & UNDO
// ==========================================

function persist() {
    if (!isGameLoaded) return;
    // Pull the few free-form fields that live directly in the DOM.
    state.currentName = val('currentName');
    state.boxedExp = val('boxedExpText');
    state.currentJournal = val('promptJournal');
    state.settings = {
        isLightMode: document.body.classList.contains('light-mode'),
        fontSize: getComputedStyle(document.body).getPropertyValue('--base-font-size'),
        hideGraveyard: checked('hideGraveyardToggle'),
        muteSound: checked('optMuteSound'),
        // reverseTime is a one-shot (clears after each roll), so it is not persisted.
        multiplayer: checked('optMultiplayer')
    };
    try {
        var json = JSON.stringify(state);
        localStorage.setItem(SAVE_KEY, json);
        pushSaveHistory(json);
        setSaveStatus('Saved ✓ ' + nowHM());
    } catch (e) {
        console.error('Save failed', e);
        setSaveStatus('Save failed!');
    }
}

// Rolling backup: keep the last few good saves so a corrupt write is recoverable.
var HISTORY_KEY = 'tyov_save_history';
var HISTORY_MAX = 10;
function pushSaveHistory(json) {
    try {
        var hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        if (!Array.isArray(hist)) hist = [];
        var last = hist[hist.length - 1];
        if (last && last.data === json) return; // no change, don't churn
        hist.push({ t: Date.now(), data: json });
        while (hist.length > HISTORY_MAX) hist.shift();
        localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    } catch (e) { /* history is best-effort */ }
}
function latestHistorySave() {
    try {
        var hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        if (Array.isArray(hist) && hist.length) return hist[hist.length - 1].data;
    } catch (e) { /* ignore */ }
    return null;
}

var saveGame = debounce(persist, 300);

function normMem(m) {
    m = m || {};
    var exps = Array.isArray(m.experiences) ? m.experiences.slice() : [];
    while (exps.length < 3) exps.push('');
    return {
        id: m.id || genId(),
        theme: m.theme || '',
        experiences: exps,
        memState: m.memState || 'normal',
        lost: !!m.lost
    };
}

// Validate/repair an arbitrary parsed object into a complete v2 state.
function normalizeState(d) {
    var s = Object.assign(defaultState(), d || {});
    s.version = SAVE_VERSION;
    s.skills = (s.skills || []).map(function (x) {
        return { id: x.id || genId(), text: x.text || '', lost: !!x.lost, checked: !!x.checked };
    });
    s.resources = (s.resources || []).map(function (x) {
        var r = { id: x.id || genId(), text: x.text || '', lost: !!x.lost };
        if (x.isDiary) r.isDiary = true; // the auto-managed Diary Resource (A6)
        return r;
    });
    s.marks = (s.marks || []).map(function (x) {
        return { id: x.id || genId(), text: x.text || '', lost: !!x.lost };
    });
    s.characters = (s.characters || []).map(function (x) {
        return {
            id: x.id || genId(),
            text: x.text || '',
            type: x.type === 'Immortal' ? 'Immortal' : 'Mortal',
            doom: x.doom || 0,
            lost: !!x.lost
        };
    });
    s.memories = (s.memories || []).map(normMem);
    s.diary = (s.diary || []).map(normMem);
    s.settings = s.settings || {};
    s.display = Object.assign(defaultState().display, s.display || {});
    return s;
}

// --- v1 (innerHTML-blob) migration -------------------------------------------

function isLegacy(d) {
    return d && (d.htmlData !== undefined || d.version === undefined);
}

function parseTraitRows(html, hasCheckbox) {
    if (!html) return [];
    var doc = new DOMParser().parseFromString('<ul>' + html + '</ul>', 'text/html');
    return Array.prototype.map.call(doc.querySelectorAll('li'), function (li) {
        var t = li.querySelector('input[type="text"]');
        var row = {
            id: genId(),
            text: t ? (t.getAttribute('value') || '') : '',
            lost: li.classList.contains('strikethrough')
        };
        if (hasCheckbox) {
            var c = li.querySelector('input[type="checkbox"]');
            row.checked = !!(c && c.hasAttribute('checked'));
        }
        return row;
    });
}

function parseCharacterRows(html) {
    if (!html) return [];
    var doc = new DOMParser().parseFromString('<ul>' + html + '</ul>', 'text/html');
    return Array.prototype.map.call(doc.querySelectorAll('li'), function (li) {
        var t = li.querySelector('input[type="text"]');
        var sel = li.querySelector('select');
        var type = 'Mortal';
        if (sel) {
            var opt = sel.querySelector('option[selected]');
            type = opt ? opt.value : 'Mortal';
        }
        var dots = li.querySelector('.doom-dots');
        var doom = dots ? (dots.textContent.match(/•/g) || []).length : 0;
        return {
            id: genId(),
            text: t ? (t.getAttribute('value') || '') : '',
            type: type === 'Immortal' ? 'Immortal' : 'Mortal',
            doom: doom,
            lost: li.classList.contains('strikethrough')
        };
    });
}

function parseMemoryRows(html) {
    if (!html) return [];
    var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
    return Array.prototype.map.call(doc.querySelectorAll('.memory-block'), function (b) {
        var theme = b.querySelector('input[type="text"]');
        var exps = Array.prototype.map.call(b.querySelectorAll('.experience-input'), function (e) {
            return e.getAttribute('value') || '';
        });
        var memState = 'normal';
        var sel = b.querySelector('select');
        if (sel) {
            var opt = sel.querySelector('option[selected]');
            if (opt) memState = opt.value;
        } else {
            ['starred', 'hazy', 'vast', 'primal'].forEach(function (st) {
                if (b.classList.contains('mem-' + st)) memState = st;
            });
        }
        return normMem({ theme: theme ? (theme.getAttribute('value') || '') : '', experiences: exps, memState: memState });
    });
}

function migrateV1(d) {
    try { localStorage.setItem('tyov_save_v1_backup', JSON.stringify(d)); } catch (e) { /* ignore */ }
    var h = d.htmlData || {};
    return normalizeState({
        version: SAVE_VERSION,
        maxMemories: d.maxMemories || 5,
        maxDiary: d.maxDiary || 4,
        currentPrompt: d.currentPrompt || 0,
        promptVisits: d.promptVisits || {},
        futureTriggers: d.futureTriggers || [],
        namesHistory: d.namesHistory || [],
        turnCount: d.turnCount || 0,
        rollHistory: d.rollHistory || [],
        journalHistory: d.journalHistory || [],
        currentName: d.currentName || '',
        boxedExp: d.boxedExp || '',
        currentJournal: d.currentJournal || '',
        skills: parseTraitRows(h.skills, true),
        resources: parseTraitRows(h.resources, false),
        marks: parseTraitRows(h.marks, false),
        characters: parseCharacterRows(h.characters),
        memories: parseMemoryRows(h.memories),
        diary: parseMemoryRows(h.diary),
        settings: d.settings || {},
        display: {
            promptResult: h.promptResult || 'Awaiting First Roll...',
            rollDetails: h.rollDetails || '',
            promptText: h.promptDisplay || 'Your prompt narrative will appear here.'
        }
    });
}

function loadGame() {
    var saved;
    try {
        saved = localStorage.getItem(SAVE_KEY);
    } catch (e) {
        saved = null;
    }
    if (!saved) { showWizard(); return; }

    var data;
    try {
        data = JSON.parse(saved);
    } catch (e) {
        try { localStorage.setItem('tyov_save_corrupt', saved); } catch (e2) { /* ignore */ }
        // Try to recover from the newest rolling-backup snapshot before giving up.
        var backup = latestHistorySave();
        var recovered = null;
        if (backup) { try { recovered = JSON.parse(backup); } catch (e3) { recovered = null; } }
        if (recovered) {
            alert('Your saved chronicle was corrupted, but a recent automatic backup was ' +
                  'found and restored. The raw corrupt data was kept under "tyov_save_corrupt".');
            data = recovered;
        } else {
            alert('Your saved chronicle could not be read (corrupted data), and no automatic ' +
                  'backup was available. Starting fresh; a backup of the raw data was kept ' +
                  'under "tyov_save_corrupt".');
            showWizard();
            return;
        }
    }

    state = isLegacy(data) ? migrateV1(data) : normalizeState(data);
    applyState();
    isGameLoaded = true;
    persist(); // Re-save in current format (completes the migration).
}

function resetGame() {
    if (confirm('Are you sure you want to wipe this chronicle? This cannot be undone.')) {
        localStorage.removeItem(SAVE_KEY);
        location.reload();
    }
}

// Multi-level undo now snapshots the FULL gameplay + traits + memories state,
// so it also covers add/lose/delete of Skills, Resources, Characters, Marks and
// Memories — not just rolls. Call pushUndo() BEFORE any structural mutation.
// (Free-form text typing does not snapshot; it is saved by the debounced
// autosave and would flood the stack.)
function pushUndo() {
    undoStack.push(JSON.stringify({ state: state, journal: val('promptJournal') }));
    if (undoStack.length > 50) undoStack.shift();
    var b = el('btnUndo');
    if (b) b.disabled = false;
}
// Back-compat alias for the roll/jump/step callers.
var saveStateForUndo = pushUndo;

function undoLastRoll() {
    if (!undoStack.length) return;
    var snap = JSON.parse(undoStack.pop());
    state = normalizeState(snap.state);
    applyState();
    setVal('promptJournal', snap.journal || '');
    var b = el('btnUndo');
    if (b) b.disabled = undoStack.length === 0;
    persist();
}

function addToHistoryLog(text) {
    state.turnCount++;
    state.rollHistory.push('[Turn ' + state.turnCount + '] ' + text);
    renderRollLog();
}

// ==========================================
// IMPORT & EXPORT
// ==========================================

function exportSaveData() {
    state.rollsSinceBackup = 0; // Reset the backup reminder — you just backed up.
    persist();
    dismissBackupNudge();
    var blob = new Blob([localStorage.getItem(SAVE_KEY) || '{}'], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Vampire_Save.json';
    a.click();
}

function importSaveData(e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function (event) {
        var parsed;
        try {
            parsed = JSON.parse(event.target.result);
            if (!parsed || typeof parsed !== 'object') throw new Error('Not a JSON object');
        } catch (err) {
            alert('Import failed: the file is not valid JSON.\n\n' + err.message);
            return;
        }
        try {
            var migrated = isLegacy(parsed) ? migrateV1(parsed) : normalizeState(parsed);
            localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
            location.reload();
        } catch (err) {
            alert('Import failed: the file is not a valid Vampire Chronicle save.\n\n' + err.message);
        }
    };
    r.readAsText(f);
}

function previewChronicle() {
    var name = state.currentName || 'Unnamed Vampire';
    el('previewTitle').innerText = 'The Chronicle of ' + name;

    var html = '';
    var boxed = val('boxedExpText');
    if (boxed.trim()) {
        html += '<div style="background:rgba(76,175,80,0.1);padding:15px;border-left:4px solid #4CAF50;margin-bottom:20px;">' +
                '<i>"A serendipitous moment that never fades..."</i><br><br>' + parseMarkdown(boxed) + '</div>';
    }

    if (state.journalHistory.length > 0) {
        html += '<h3>Narrative Journal</h3><div style="margin-bottom: 30px; padding: 15px; background: rgba(0,0,0,0.05); border: 1px solid var(--border-color);">';
        state.journalHistory.forEach(function (entry) {
            html += '<div style="margin-bottom: 15px;"><b>[Prompt ' + escapeHtml(String(entry.prompt)) + ']</b><br>' +
                    parseMarkdown(entry.text) + '</div>';
        });
        html += '</div>';
    }

    html += '<h3>Active Memories</h3>' + renderMemoriesPreview(state.memories, false);
    html += '<hr style="border-color: var(--border-color); margin: 30px 0;">';
    html += '<h3>The Diary / Lost Storage</h3>' + renderMemoriesPreview(state.diary, true);

    el('previewContent').innerHTML = html;
    el('previewModal').style.display = 'flex';
}

function renderMemoriesPreview(list, faded) {
    var out = '';
    list.forEach(function (m) {
        if (!m.theme || m.lost) return;
        out += '<div style="margin-bottom: 15px;' + (faded ? ' color:#888;' : '') + '"><b>Theme: ' +
               escapeHtml(m.theme) + '</b><ul>';
        m.experiences.forEach(function (x) {
            if (x.trim() !== '') out += '<li>' + parseMarkdown(x) + '</li>';
        });
        out += '</ul></div>';
    });
    return out;
}

function exportJournal() {
    var txt = 'CHRONICLE OF ' + (state.currentName || 'Unnamed Vampire') +
              '\n=======================================\n\n';

    var boxed = val('boxedExpText');
    if (boxed) txt += '--- BOXED EXPERIENCE ---\n' + boxed + '\n\n';

    if (state.journalHistory.length > 0) {
        txt += '--- NARRATIVE JOURNAL ---\n';
        state.journalHistory.forEach(function (entry) {
            txt += '[Prompt ' + entry.prompt + ']\n' + entry.text + '\n\n';
        });
    }

    txt += '--- ACTIVE MEMORIES ---\n' + journalMemoriesText(state.memories);
    txt += '--- DIARY / STORAGE ---\n' + journalMemoriesText(state.diary);

    var blob = new Blob([txt], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Chronicle.txt';
    a.click();
}

function journalMemoriesText(list) {
    var out = '';
    list.forEach(function (m) {
        if (m.lost) return;
        out += '[' + m.theme + ']\n';
        m.experiences.forEach(function (x) {
            if (x.trim() !== '') out += '- ' + x + '\n';
        });
        out += '\n';
    });
    return out;
}

// ==========================================
// GAMEPLAY MECHANICS (DICE & PROMPTS)
// ==========================================

function archiveJournal() {
    var ta = el('promptJournal');
    var jText = ta.value.trim();
    if (jText !== '' && state.currentPrompt !== 0) {
        var visits = state.promptVisits[state.currentPrompt] || 1;
        state.journalHistory.push({ prompt: state.currentPrompt + getTier(visits), text: jText });
        ta.value = '';
        state.currentJournal = '';
    }
}

function changeName() {
    var input = el('currentName');
    if (input.value.trim() !== '') {
        state.namesHistory.push(input.value);
        renderNameHistory();
        input.value = '';
        state.currentName = '';
        persist();
    }
}

function calculateMove() {
    return TYOV.rollDice({ reverse: checked('optReverseTime'), multi: checked('optMultiplayer') });
}

function updatePromptDisplay(promptNum, visits) {
    state.display.promptText = getPromptText(promptDB, promptNum, visits);
    el('promptTextDisplay').innerText = state.display.promptText;
}

// Show/hide a small note element under the prompt.
function toggleNote(id, show) { var e = el(id); if (e) e.style.display = show ? 'block' : 'none'; }

// Update the tier/visit badge (B6) and the auto-advance (A9) / optional-end
// (A10) notes from the current position.
function updatePromptMeta() {
    var p = state.currentPrompt;
    var visits = state.promptVisits[p] || 0;
    var badge = el('tierBadge');
    if (badge) {
        if (p >= 1 && visits >= 1) {
            badge.textContent = visits > 3
                ? 'Prompt ' + p + ' — all entries (a, b, c) answered'
                : 'Entry ' + p + getTier(visits) + ' · visit ' + visits +
                  (visits === 1 ? ' (first)' : visits === 2 ? ' (second)' : ' (third)');
        } else {
            badge.textContent = '';
        }
    }
    toggleNote('advanceNote', p >= 1 && visits > 3 && !state.gameOver);
    toggleNote('endNote', p === 69 && visits === 3 && !state.gameOver);
}

function checkGameOver() {
    if (state.currentPrompt >= 72 && state.currentPrompt <= 80) state.gameOver = true;
    var roll = el('btnRoll');
    if (roll) roll.disabled = !!state.gameOver;
    if (state.gameOver && state.display.promptResult.indexOf('[GAME OVER]') === -1) {
        state.display.promptResult += ' [GAME OVER]';
        setText('promptResult', state.display.promptResult);
    }
}

// Roll counters that drive the old-age (A12) and backup (B12) nudges.
function tickRollCounters() {
    state.rollsSinceOldAge = (state.rollsSinceOldAge || 0) + 1;
    state.rollsSinceBackup = (state.rollsSinceBackup || 0) + 1;
    showAgeNudgeIfDue();
    showBackupNudgeIfDue();
}

function showAgeNudgeIfDue() {
    var activeMortals = state.characters.filter(function (c) { return c.type === 'Mortal' && !c.lost; }).length;
    toggleNote('ageNudge', (state.rollsSinceOldAge || 0) >= 5 && activeMortals > 0 && !state.gameOver);
}
function dismissAgeNudge() {
    state.rollsSinceOldAge = 0;
    toggleNote('ageNudge', false);
    persist();
}
function showBackupNudgeIfDue() {
    toggleNote('backupNudge', (state.rollsSinceBackup || 0) >= 20);
}
function dismissBackupNudge() {
    toggleNote('backupNudge', false);
}

function rollAndMove() {
    if (state.gameOver) return;
    pushUndo();
    archiveJournal();
    playSound('dice');

    if (state.currentPrompt === 0) state.currentPrompt = 1;

    var m = calculateMove();
    setChecked('optReverseTime', false); // Rev. Time is a one-shot; clear it now (A4).
    state.currentPrompt = Math.max(1, state.currentPrompt + m.diff);
    state.promptVisits[state.currentPrompt] = (state.promptVisits[state.currentPrompt] || 0) + 1;

    var visits = state.promptVisits[state.currentPrompt];
    var tier = getTier(visits);
    var d10Str = m.multi ? (m.d10_1 + ' + ' + m.d10_2) : ('' + m.d10_1);
    var detail = 'Rolled ' + (m.reverse
        ? ('d6(' + m.d6 + ') - d10(' + d10Str + ')')
        : ('d10(' + d10Str + ') - d6(' + m.d6 + ')')) + '. Moved by ' + m.diff + '.';

    state.display.rollDetails = detail;
    state.display.promptResult = 'Proceed to Prompt ' + state.currentPrompt + tier;

    updatePromptDisplay(state.currentPrompt, visits);
    addToHistoryLog('Prompt ' + state.currentPrompt + tier + ' (' + detail + ')');

    tickRollCounters();
    applyDisplay();
    updatePromptMeta();
    checkTriggers();
    checkGameOver();
    persist();
}

function jumpToPrompt() {
    var target = parseInt(val('jumpPromptNum'), 10);
    if (!(target >= 1 && target <= 80)) {
        alert('Please enter a valid prompt number between 1 and 80.');
        return;
    }
    pushUndo();
    archiveJournal();
    playSound('page');
    state.currentPrompt = target;
    state.promptVisits[target] = (state.promptVisits[target] || 0) + 1;
    var visits = state.promptVisits[target];
    var tier = getTier(visits);

    state.display.rollDetails = 'Manually jumped to Prompt ' + target + '.';
    state.display.promptResult = 'Proceed to Prompt ' + target + tier;
    updatePromptDisplay(target, visits);
    addToHistoryLog('Jumped to Prompt ' + target + tier);

    applyDisplay();
    updatePromptMeta();
    checkTriggers();
    checkGameOver();
    persist();
    setVal('jumpPromptNum', '');
}

// Manual back-one-Prompt navigation (formerly "Accursed Strings"; that named
// Resource is an Appendix I mechanic, out of scope for the 1–80 app — A5).
function stepBackOnePrompt() {
    if (state.currentPrompt <= 1) return;
    pushUndo();
    archiveJournal();
    state.currentPrompt -= 1;
    var visits = state.promptVisits[state.currentPrompt] || 1;
    state.display.promptResult = 'Stepped back to Prompt ' + state.currentPrompt;
    updatePromptDisplay(state.currentPrompt, visits);
    addToHistoryLog('Stepped back to Prompt ' + state.currentPrompt);
    applyDisplay();
    updatePromptMeta();
    checkTriggers();
    persist();
}

// A9: after all three tiers are answered, offer to move to the next Prompt.
function advanceToNextPrompt() {
    if (state.currentPrompt >= 80) return;
    pushUndo();
    archiveJournal();
    playSound('page');
    state.currentPrompt += 1;
    state.promptVisits[state.currentPrompt] = (state.promptVisits[state.currentPrompt] || 0) + 1;
    var visits = state.promptVisits[state.currentPrompt];
    var tier = getTier(visits);
    state.display.rollDetails = 'Advanced to the next Prompt.';
    state.display.promptResult = 'Proceed to Prompt ' + state.currentPrompt + tier;
    updatePromptDisplay(state.currentPrompt, visits);
    addToHistoryLog('Advanced to Prompt ' + state.currentPrompt + tier);
    applyDisplay();
    updatePromptMeta();
    checkTriggers();
    checkGameOver();
    persist();
}

// ==========================================
// GUIDED PROMPT ACTIONS (A2 / A3)
// ==========================================

function uncheckedSkillCount() {
    return state.skills.filter(function (s) { return !s.lost && !s.checked; }).length;
}
function activeResourceCount() {
    return state.resources.filter(function (r) { return !r.lost; }).length;
}
function firstActiveResource() {
    return state.resources.filter(function (r) { return !r.lost; })[0];
}
function firstUncheckedSkill() {
    return state.skills.filter(function (s) { return !s.lost && !s.checked; })[0];
}

function promptCheckSkill() {
    var res = TYOV.resolveTraitAction('check', uncheckedSkillCount(), activeResourceCount());
    if (res.result === 'check') {
        toast('Check one of your Skills in the Traits panel.', 'info');
    } else if (res.result === 'substitute-lose') {
        var r = firstActiveResource();
        if (r) { pushUndo(); r.lost = true; renderResources(); checkSurvivalState(); persist(); }
        toast('Substitution — lost Resource "' + (r ? (r.text || 'Unnamed') : '') + '". ' + res.message, 'warn');
    } else {
        offerGameOver(res.message);
    }
}

function promptLoseResource() {
    var res = TYOV.resolveTraitAction('lose', uncheckedSkillCount(), activeResourceCount());
    if (res.result === 'lose') {
        toast('Lose (strike out) one of your Resources in the Traits panel.', 'info');
    } else if (res.result === 'substitute-check') {
        var s = firstUncheckedSkill();
        if (s) { pushUndo(); s.checked = true; renderSkills(); persist(); }
        toast('Substitution — checked Skill "' + (s ? (s.text || 'Unnamed') : '') + '". ' + res.message, 'warn');
    } else {
        offerGameOver(res.message);
    }
}

function offerGameOver(msg) {
    if (confirm(msg + '\n\nEnd the chronicle now?')) {
        declareGameOver(msg);
    } else {
        toast(msg, 'warn');
    }
}

function declareGameOver(reason) {
    pushUndo();
    state.gameOver = true;
    addToHistoryLog('GAME OVER — ' + reason);
    applyDisplay();
    checkGameOver();
    updatePromptMeta();
    toast('The game is over. ' + reason, 'warn');
    persist();
}

// ==========================================
// TRIGGERS
// ==========================================

function addTrigger() {
    var num = parseInt(val('triggerPromptNum'), 10);
    var desc = val('triggerDesc');
    if (!num || !desc) return;
    state.futureTriggers.push({ prompt: num, text: desc });
    renderTriggers();
    setVal('triggerPromptNum', '');
    setVal('triggerDesc', '');
    persist();
}

function removeTrigger(index) {
    state.futureTriggers.splice(index, 1);
    renderTriggers();
    persist();
}

function renderTriggers() {
    el('triggersList').innerHTML = state.futureTriggers.map(function (t, index) {
        return '<div class="trigger-item"><span><b>Prompt ' + escapeHtml(String(t.prompt)) + ':</b> ' +
               escapeHtml(t.text) + '</span> <button class="btn-small btn-strike" aria-label="Remove trigger" ' +
               'onclick="removeTrigger(' + index + ')">X</button></div>';
    }).join('');
}

function checkTriggers() {
    var alertBox = el('triggerAlert');
    var alertText = el('triggerAlertText');
    var found = state.futureTriggers.filter(function (t) { return t.prompt === state.currentPrompt; });
    if (found.length > 0) {
        alertBox.style.display = 'block';
        alertText.innerText = found.map(function (t) { return t.text; }).join(' | ');
    } else {
        alertBox.style.display = 'none';
    }
}

// ==========================================
// TRAITS MANAGEMENT
// ==========================================

function findEntity(list, id) {
    return state[list].filter(function (e) { return e.id === id; })[0];
}

function renderList(list) {
    if (list === 'skills') renderSkills();
    else if (list === 'resources') renderResources();
    else if (list === 'characters') renderCharacters();
    else if (list === 'marks') renderMarks();
}

// Text edits update state only — no re-render, so input focus is preserved.
// The global 'input' listener handles the (debounced) save.
function setEntityText(list, id, value) {
    var e = findEntity(list, id);
    if (e) e.text = value;
}

function toggleLoseEntity(list, id) {
    var e = findEntity(list, id);
    if (!e) return;
    pushUndo();
    e.lost = !e.lost;
    // The Diary is a Resource: losing/restoring it strikes/unstrikes the
    // Memories it holds (A6 — rules p.100).
    if (list === 'resources' && e.isDiary) {
        state.diary.forEach(function (m) { m.lost = e.lost; });
        renderMemoryList('diary');
        updateDiaryCount();
    }
    renderList(list);
    checkSurvivalState();
    persist();
}

function setSkillChecked(id, isChecked) {
    var e = findEntity('skills', id);
    if (e) { pushUndo(); e.checked = isChecked; renderSkills(); persist(); }
}

function setCharacterType(id, type) {
    var e = findEntity('characters', id);
    if (e) { pushUndo(); e.type = type === 'Immortal' ? 'Immortal' : 'Mortal'; renderCharacters(); persist(); }
}

function addDoom(id) {
    var e = findEntity('characters', id);
    if (e) { pushUndo(); e.doom++; renderCharacters(); persist(); }
}

function addSkill(v) {
    pushUndo();
    state.skills.push({ id: genId(), text: v || '', lost: false, checked: false });
    renderSkills();
    checkSurvivalState();
    persist();
}

function addResource(v) {
    pushUndo();
    state.resources.push({ id: genId(), text: v || '', lost: false });
    renderResources();
    checkSurvivalState();
    persist();
}

function addCharacter(v, type) {
    pushUndo();
    state.characters.push({
        id: genId(), text: v || '', type: type === 'Immortal' ? 'Immortal' : 'Mortal', doom: 0, lost: false
    });
    renderCharacters();
    persist();
}

function addMark(v) {
    pushUndo();
    state.marks.push({ id: genId(), text: v || '', lost: false });
    renderMarks();
    persist();
}

function killAllMortals() {
    if (!confirm('Pass a century? Every living mortal Character will be struck out.')) return;
    pushUndo();
    state.characters.forEach(function (c) {
        if (c.type === 'Mortal' && !c.lost) c.lost = true;
    });
    state.rollsSinceOldAge = 0;
    toggleNote('ageNudge', false);
    renderCharacters();
    checkSurvivalState();
    persist();
}

function checkSurvivalState() {
    var activeSkills = state.skills.filter(function (s) { return !s.lost; }).length;
    var activeRes = state.resources.filter(function (r) { return !r.lost; }).length;
    el('gameWarning').style.display = (activeSkills === 0 && activeRes === 0) ? 'block' : 'none';
}

function renderSkills() {
    el('skillsList').innerHTML = state.skills.map(function (s) {
        return '<li class="' + (s.lost ? 'strikethrough' : '') + '">' +
            '<input type="checkbox" aria-label="Mark skill as used" ' + (s.checked ? 'checked' : '') +
                ' onchange="setSkillChecked(\'' + s.id + '\', this.checked)">' +
            '<input type="text" aria-label="Skill name" class="' + (s.checked ? 'checked-skill' : '') +
                '" value="' + escapeHtml(s.text) + '" oninput="setEntityText(\'skills\',\'' + s.id + '\', this.value)">' +
            '<button class="btn-small btn-strike" onclick="toggleLoseEntity(\'skills\',\'' + s.id + '\')">' +
                (s.lost ? 'Restore' : 'Lose') + '</button></li>';
    }).join('');
}

function renderResources() {
    el('resourcesList').innerHTML = state.resources.map(function (r) {
        return '<li class="' + (r.lost ? 'strikethrough' : '') + '">' +
            '<input type="text" aria-label="Resource name" value="' + escapeHtml(r.text) +
                '" oninput="setEntityText(\'resources\',\'' + r.id + '\', this.value)">' +
            '<button class="btn-small btn-strike" onclick="toggleLoseEntity(\'resources\',\'' + r.id + '\')">' +
                (r.lost ? 'Restore' : 'Lose') + '</button></li>';
    }).join('');
}

function renderMarks() {
    el('marksList').innerHTML = state.marks.map(function (m) {
        return '<li class="' + (m.lost ? 'strikethrough' : '') + '">' +
            '<input type="text" aria-label="Mark description" value="' + escapeHtml(m.text) +
                '" oninput="setEntityText(\'marks\',\'' + m.id + '\', this.value)">' +
            '<button class="btn-small btn-strike" onclick="toggleLoseEntity(\'marks\',\'' + m.id + '\')">' +
                (m.lost ? 'Restore' : 'Lose') + '</button></li>';
    }).join('');
}

function renderCharacters() {
    el('charactersList').innerHTML = state.characters.map(function (c) {
        var dots = new Array(c.doom + 1).join('•');
        var doomTip = 'Doom dots (Appendix Prompt 98): each dot halves this mortal’s remaining lifespan.';
        return '<li class="' + (c.lost ? 'strikethrough' : '') + '" id="' + c.id + '">' +
            '<select aria-label="Character mortality" onchange="setCharacterType(\'' + c.id + '\', this.value)">' +
                '<option value="Mortal" ' + (c.type === 'Mortal' ? 'selected' : '') + '>Mortal</option>' +
                '<option value="Immortal" ' + (c.type === 'Immortal' ? 'selected' : '') + '>Immortal</option>' +
            '</select>' +
            '<input type="text" aria-label="Character name" value="' + escapeHtml(c.text) +
                '" oninput="setEntityText(\'characters\',\'' + c.id + '\', this.value)">' +
            '<span class="doom-dots" title="' + doomTip + '">' + dots + '</span>' +
            '<button class="btn-small doom-btn" aria-label="Add doom dot" title="' + doomTip + '" style="display:' +
                (c.type === 'Mortal' ? 'inline-block' : 'none') + '" onclick="addDoom(\'' + c.id + '\')">+•</button>' +
            '<button class="btn-small btn-strike" onclick="toggleLoseEntity(\'characters\',\'' + c.id + '\')">' +
                (c.lost ? 'Restore' : 'Lose') + '</button></li>';
    }).join('');
}

// ==========================================
// MEMORIES & DIARY
// ==========================================

function memList(name) { return name === 'diary' ? state.diary : state.memories; }
function findMem(name, id) {
    return memList(name).filter(function (m) { return m.id === id; })[0];
}

function setMemoryTheme(name, id, value) {
    var m = findMem(name, id);
    if (m) m.theme = value;
}

function setExperience(name, id, index, value) {
    var m = findMem(name, id);
    if (m) m.experiences[index] = value;
}

// The Diary is a Resource: keep exactly one "Diary" Resource present while it
// holds ≥1 Memory, and remove it when empty (A6 — rules p.100).
function ensureDiaryResource() {
    var existing = state.resources.filter(function (r) { return r.isDiary; })[0];
    if (state.diary.length > 0 && !existing) {
        state.resources.push({ id: genId(), text: 'Diary (holds stored Memories)', lost: false, isDiary: true });
        renderResources();
    } else if (state.diary.length === 0 && existing) {
        state.resources = state.resources.filter(function (r) { return !r.isDiary; });
        renderResources();
    }
}

function addMemoryBlock(containerId) {
    var name = containerId === 'diaryContainer' ? 'diary' : 'memories';
    if (name === 'memories' && state.memories.length >= state.maxMemories) {
        alert('Memory Limit Reached (' + state.maxMemories + '). Delete a memory or move it to a Diary.');
        return;
    }
    if (name === 'diary' && state.diary.length >= state.maxDiary) {
        alert('Diary Limit Reached (' + state.maxDiary + '). A Diary holds at most ' + state.maxDiary + ' Memories.');
        return;
    }
    pushUndo();
    memList(name).push(newMemory());
    if (name === 'diary') ensureDiaryResource();
    renderMemoryList(name);
    updateMemoryCount();
    updateDiaryCount();
    persist();
}

function changeMemoryState(name, id, memState) {
    var m = findMem(name, id);
    if (!m) return;
    pushUndo();
    m.memState = memState;
    if (memState === 'vast') {
        while (m.experiences.length < 5) m.experiences.push('');
    } else if (m.experiences.length > 3) {
        m.experiences = m.experiences.slice(0, 3); // Lose the extra Vast experiences.
    }
    renderMemoryList(name);
    updateMemoryCount();
    persist();
}

function migrateToDiary(id) {
    if (state.diary.length >= state.maxDiary) {
        alert('Your Diary is full! (' + state.maxDiary + ' Memories). Delete a Diary entry first.');
        return;
    }
    var i = state.memories.map(function (m) { return m.id; }).indexOf(id);
    if (i < 0) return;
    pushUndo();
    playSound('page');
    state.diary.push(state.memories.splice(i, 1)[0]);
    ensureDiaryResource();
    renderMemoryList('memories');
    renderMemoryList('diary');
    updateMemoryCount();
    updateDiaryCount();
    persist();
}

function deleteMemory(name, id) {
    pushUndo();
    var arr = memList(name);
    var i = arr.map(function (m) { return m.id; }).indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    if (name === 'diary') ensureDiaryResource();
    renderMemoryList(name);
    updateMemoryCount();
    updateDiaryCount();
    persist();
}

function memoryBlockHtml(m, name) {
    var inDiary = name === 'diary';
    var expCount = m.memState === 'vast' ? 5 : 3;
    var exps = '';
    for (var i = 0; i < expCount; i++) {
        // Memories in the Diary are frozen — no new/edited Experiences (A6).
        exps += '<input type="text" class="experience-input" aria-label="Experience ' + (i + 1) +
                '" placeholder="- Experience ' + (i + 1) + '" value="' + escapeHtml(m.experiences[i] || '') +
                '"' + (inDiary ? ' readonly' : ' oninput="setExperience(\'' + name + '\',\'' + m.id + '\',' + i + ', this.value)"') + '>';
    }
    var states = [['normal', 'Normal'], ['starred', '⭐ Starred'], ['hazy', '🌫️ Hazy'],
                  ['vast', '🌌 Vast'], ['primal', '🐾 Primal']];
    var options = states.map(function (s) {
        return '<option value="' + s[0] + '" ' + (m.memState === s[0] ? 'selected' : '') + '>' + s[1] + '</option>';
    }).join('');
    // Writing-constraint reminders for the states that impose them (A11).
    var hint = '';
    if (m.memState === 'hazy') hint = '<div class="mem-hint">🌫️ Hazy: only verbs &amp; adjectives may be written here.</div>';
    else if (m.memState === 'primal') hint = '<div class="mem-hint">🐾 Primal: write only the “how I felt” clause, not “what happened”.</div>';
    else if (m.memState === 'vast') hint = '<div class="mem-hint">🌌 Vast: holds up to five Experiences.</div>';
    else if (m.memState === 'starred') hint = '<div class="mem-hint">⭐ Starred: fixed forever and does not count toward your Memory limit.</div>';
    var migrateBtn = name === 'memories'
        ? '<button class="btn-small migrate-btn" style="background:#2196F3; margin-right:5px;" onclick="migrateToDiary(\'' + m.id + '\')">Move to Diary</button>'
        : '';
    var cls = 'memory-block' + (m.memState !== 'normal' ? ' mem-' + m.memState : '') + (m.lost ? ' strikethrough' : '');
    return '<div class="' + cls + '" id="' + m.id + '">' +
        '<input type="text" aria-label="Memory theme" placeholder="Memory Theme" value="' + escapeHtml(m.theme) +
            '"' + (inDiary ? ' readonly' : ' oninput="setMemoryTheme(\'' + name + '\',\'' + m.id + '\', this.value)"') + '>' +
        '<div class="exp-container">' + exps + '</div>' + hint +
        '<div class="mem-controls">' +
            '<select aria-label="Memory state" onchange="changeMemoryState(\'' + name + '\',\'' + m.id + '\', this.value)">' +
                options + '</select>' +
            '<div>' + migrateBtn +
                '<button class="btn-small btn-strike" onclick="deleteMemory(\'' + name + '\',\'' + m.id + '\')">Delete</button>' +
            '</div>' +
        '</div></div>';
}

function renderMemoryList(name) {
    var containerId = name === 'diary' ? 'diaryContainer' : 'memoriesContainer';
    el(containerId).innerHTML = memList(name).map(function (m) { return memoryBlockHtml(m, name); }).join('');
}

function updateMemoryCount() {
    // Starred Memories don't take a slot; struck-out (lost) ones don't count.
    var count = state.memories.filter(function (m) {
        return m.memState !== 'starred' && !m.lost;
    }).length;
    setText('memoryCount', '(' + count + '/' + state.maxMemories + ' Active Slots)');
}

function updateDiaryCount() {
    var count = state.diary.filter(function (m) { return !m.lost; }).length;
    setText('diaryCount', '(' + count + '/' + state.maxDiary + ' Slots)');
}

function loseMemorySlot() {
    if (!confirm('Permanently lose a memory slot? (You can Undo this.)')) return;
    pushUndo();
    state.maxMemories = Math.max(1, state.maxMemories - 1);
    updateMemoryCount();
    toast('You have lost a memory slot. Max is now ' + state.maxMemories + '.', 'warn');
    persist();
}

// ==========================================
// RENDER / APPLY FULL STATE
// ==========================================

function renderNameHistory() {
    setText('nameHistory', 'Forgotten Names: ' +
        (state.namesHistory.length ? state.namesHistory.join(' ➔ ') : 'None yet.'));
}

function renderRollLog() {
    var entries = state.rollHistory.slice().reverse().map(function (s) {
        return '<div>' + escapeHtml(s) + '</div>';
    }).join('');
    el('rollHistoryLog').innerHTML = '<b>History:</b><br>' + entries;
}

function applyDisplay() {
    setText('promptResult', state.display.promptResult);
    setText('rollResultDetails', state.display.rollDetails);
    el('promptTextDisplay').innerText = state.display.promptText;
}

function renderAll() {
    renderSkills();
    renderResources();
    renderCharacters();
    renderMarks();
    renderMemoryList('memories');
    renderMemoryList('diary');
    renderTriggers();
    renderRollLog();
    renderNameHistory();
    updateMemoryCount();
    updateDiaryCount();
}

function applyState() {
    setVal('currentName', state.currentName);
    setVal('boxedExpText', state.boxedExp);
    setVal('promptJournal', state.currentJournal);

    var st = state.settings || {};
    if (st.isLightMode) {
        document.body.classList.add('light-mode');
        setText('btnTheme', 'Toggle Dark Mode');
    }
    if (st.fontSize) document.body.style.setProperty('--base-font-size', st.fontSize);
    setChecked('hideGraveyardToggle', !!st.hideGraveyard);
    if (st.hideGraveyard) el('traitsContainer').classList.add('hide-graveyard');
    setChecked('optMuteSound', !!st.muteSound);
    setChecked('optReverseTime', false); // one-shot, never restored
    setChecked('optMultiplayer', !!st.multiplayer);

    renderAll();
    applyDisplay();
    updatePromptMeta();
    checkSurvivalState();
    checkTriggers();
    checkGameOver();
    showAgeNudgeIfDue();
    showBackupNudgeIfDue();
}

// ==========================================
// BOOT
// ==========================================

// ==========================================
// SERVICE WORKER + "TAP TO UPDATE" FLOW
// ==========================================
// When a new build is deployed, the browser installs the updated worker in the
// background; we surface a clickable toast and only swap in the new version when
// the user taps "Update now" (posts SKIP_WAITING; the controllerchange reload
// then loads the fresh code).

var waitingWorker = null;

function showUpdateToast(worker) {
    waitingWorker = worker;
    var b = el('updateToast');
    if (b) b.classList.add('show');
}

function applyUpdate() {
    var b = el('updateToast');
    if (b) b.classList.remove('show');
    if (waitingWorker) {
        waitingWorker.postMessage('SKIP_WAITING'); // triggers controllerchange → reload
    } else {
        window.location.reload();
    }
}

function dismissUpdate() {
    var b = el('updateToast');
    if (b) b.classList.remove('show');
}

function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
        // A new worker was already waiting when we loaded (updated while away).
        if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg.waiting);
        reg.addEventListener('updatefound', function () {
            var nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', function () {
                // 'installed' + an existing controller = an update (not first install).
                if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateToast(nw);
                }
            });
        });
    }).catch(function () { /* SW registration is best-effort */ });

    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}

document.addEventListener('input', saveGame);
document.addEventListener('change', saveGame);
window.addEventListener('load', function () {
    loadGame();
    initServiceWorker();
});
