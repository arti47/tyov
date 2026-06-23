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
}

function newMemory(theme, exp1) {
    return { id: genId(), theme: theme || '', experiences: [exp1 || '', '', ''], memState: 'normal' };
}

function finishSetup() {
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
    var mark = val('setupMark');
    if (mark) state.marks.push({ id: genId(), text: mark, lost: false });

    state.memories.push(newMemory(val('setupMemTheme'), val('setupMemExp')));
    for (var i = 1; i < 5; i++) state.memories.push(newMemory());

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
        reverseTime: checked('optReverseTime'),
        multiplayer: checked('optMultiplayer')
    };
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Save failed', e);
    }
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
        memState: m.memState || 'normal'
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
        return { id: x.id || genId(), text: x.text || '', lost: !!x.lost };
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
        alert('Your saved chronicle could not be read (corrupted data). Starting fresh; ' +
              'a backup of the raw data was kept under "tyov_save_corrupt".');
        try { localStorage.setItem('tyov_save_corrupt', saved); } catch (e2) { /* ignore */ }
        showWizard();
        return;
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

function saveStateForUndo() {
    undoStack.push(JSON.stringify({
        currentPrompt: state.currentPrompt,
        promptVisits: state.promptVisits,
        turnCount: state.turnCount,
        rollHistory: state.rollHistory,
        journalHistory: state.journalHistory,
        display: state.display,
        currentJournal: val('promptJournal')
    }));
    if (undoStack.length > 50) undoStack.shift();
    el('btnUndo').disabled = false;
}

function undoLastRoll() {
    if (!undoStack.length) return;
    var s = JSON.parse(undoStack.pop());
    state.currentPrompt = s.currentPrompt;
    state.promptVisits = s.promptVisits;
    state.turnCount = s.turnCount;
    state.rollHistory = s.rollHistory;
    state.journalHistory = s.journalHistory;
    state.display = s.display;
    setVal('promptJournal', s.currentJournal);

    applyDisplay();
    renderRollLog();
    checkTriggers();
    checkGameOver();
    el('btnUndo').disabled = undoStack.length === 0;
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
    persist();
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
        if (!m.theme) return;
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

function checkGameOver() {
    var over = state.currentPrompt >= 72 && state.currentPrompt <= 80;
    el('btnRoll').disabled = over;
    if (over) el('promptResult').innerText = state.display.promptResult + ' [GAME OVER]';
}

function rollAndMove() {
    archiveJournal();
    playSound('dice');
    saveStateForUndo();

    if (state.currentPrompt === 0) state.currentPrompt = 1;

    var m = calculateMove();
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

    applyDisplay();
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
    archiveJournal();
    playSound('page');
    saveStateForUndo();
    state.currentPrompt = target;
    state.promptVisits[target] = (state.promptVisits[target] || 0) + 1;
    var visits = state.promptVisits[target];
    var tier = getTier(visits);

    state.display.rollDetails = 'Manually jumped to Prompt ' + target + '.';
    state.display.promptResult = 'Proceed to Prompt ' + target + tier;
    updatePromptDisplay(target, visits);
    addToHistoryLog('Jumped to Prompt ' + target + tier);

    applyDisplay();
    checkTriggers();
    checkGameOver();
    persist();
    setVal('jumpPromptNum', '');
}

function useAccursedStrings() {
    if (state.currentPrompt <= 1) return;
    archiveJournal();
    saveStateForUndo();
    state.currentPrompt -= 1;
    state.display.promptResult = 'Stepped back to Prompt ' + state.currentPrompt;
    state.display.promptText = 'You have stepped backward using the Accursed Strings.';
    addToHistoryLog('Used Accursed Strings: Back to Prompt ' + state.currentPrompt);
    applyDisplay();
    checkTriggers();
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
    e.lost = !e.lost;
    renderList(list);
    checkSurvivalState();
    persist();
}

function setSkillChecked(id, isChecked) {
    var e = findEntity('skills', id);
    if (e) { e.checked = isChecked; renderSkills(); persist(); }
}

function setCharacterType(id, type) {
    var e = findEntity('characters', id);
    if (e) { e.type = type === 'Immortal' ? 'Immortal' : 'Mortal'; renderCharacters(); persist(); }
}

function addDoom(id) {
    var e = findEntity('characters', id);
    if (e) { e.doom++; renderCharacters(); persist(); }
}

function addSkill(v) {
    state.skills.push({ id: genId(), text: v || '', lost: false, checked: false });
    renderSkills();
    checkSurvivalState();
    persist();
}

function addResource(v) {
    state.resources.push({ id: genId(), text: v || '', lost: false });
    renderResources();
    checkSurvivalState();
    persist();
}

function addCharacter(v, type) {
    state.characters.push({
        id: genId(), text: v || '', type: type === 'Immortal' ? 'Immortal' : 'Mortal', doom: 0, lost: false
    });
    renderCharacters();
    persist();
}

function addMark(v) {
    state.marks.push({ id: genId(), text: v || '', lost: false });
    renderMarks();
    persist();
}

function killAllMortals() {
    if (!confirm('Pass a century? Every living mortal Character will be struck out.')) return;
    state.characters.forEach(function (c) {
        if (c.type === 'Mortal' && !c.lost) c.lost = true;
    });
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
        return '<li class="' + (c.lost ? 'strikethrough' : '') + '" id="' + c.id + '">' +
            '<select aria-label="Character mortality" onchange="setCharacterType(\'' + c.id + '\', this.value)">' +
                '<option value="Mortal" ' + (c.type === 'Mortal' ? 'selected' : '') + '>Mortal</option>' +
                '<option value="Immortal" ' + (c.type === 'Immortal' ? 'selected' : '') + '>Immortal</option>' +
            '</select>' +
            '<input type="text" aria-label="Character name" value="' + escapeHtml(c.text) +
                '" oninput="setEntityText(\'characters\',\'' + c.id + '\', this.value)">' +
            '<span class="doom-dots">' + dots + '</span>' +
            '<button class="btn-small doom-btn" aria-label="Add doom dot" style="display:' +
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

function addMemoryBlock(containerId) {
    var name = containerId === 'diaryContainer' ? 'diary' : 'memories';
    if (name === 'memories' && state.memories.length >= state.maxMemories) {
        alert('Memory Limit Reached (' + state.maxMemories + '). Delete a memory or move it to a Diary.');
        return;
    }
    if (name === 'diary' && state.diary.length >= state.maxDiary) {
        alert('Diary Limit Reached (' + state.maxDiary + '). Expand your limit if a Prompt allows it.');
        return;
    }
    memList(name).push(newMemory());
    renderMemoryList(name);
    updateMemoryCount();
    updateDiaryCount();
    persist();
}

function changeMemoryState(name, id, memState) {
    var m = findMem(name, id);
    if (!m) return;
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
        alert('Your Diary is full! (' + state.maxDiary + ' slots). Expand your limit or delete an entry.');
        return;
    }
    var i = state.memories.map(function (m) { return m.id; }).indexOf(id);
    if (i < 0) return;
    playSound('page');
    state.diary.push(state.memories.splice(i, 1)[0]);
    renderMemoryList('memories');
    renderMemoryList('diary');
    updateMemoryCount();
    updateDiaryCount();
    persist();
}

function deleteMemory(name, id) {
    var arr = memList(name);
    var i = arr.map(function (m) { return m.id; }).indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    renderMemoryList(name);
    updateMemoryCount();
    updateDiaryCount();
    persist();
}

function memoryBlockHtml(m, name) {
    var expCount = m.memState === 'vast' ? 5 : 3;
    var exps = '';
    for (var i = 0; i < expCount; i++) {
        exps += '<input type="text" class="experience-input" aria-label="Experience ' + (i + 1) +
                '" placeholder="- Experience ' + (i + 1) + '" value="' + escapeHtml(m.experiences[i] || '') +
                '" oninput="setExperience(\'' + name + '\',\'' + m.id + '\',' + i + ', this.value)">';
    }
    var states = [['normal', 'Normal'], ['starred', '⭐ Starred'], ['hazy', '🌫️ Hazy'],
                  ['vast', '🌌 Vast'], ['primal', '🐾 Primal']];
    var options = states.map(function (s) {
        return '<option value="' + s[0] + '" ' + (m.memState === s[0] ? 'selected' : '') + '>' + s[1] + '</option>';
    }).join('');
    var migrateBtn = name === 'memories'
        ? '<button class="btn-small migrate-btn" style="background:#2196F3; margin-right:5px;" onclick="migrateToDiary(\'' + m.id + '\')">Move to Diary</button>'
        : '';
    return '<div class="memory-block ' + (m.memState !== 'normal' ? 'mem-' + m.memState : '') + '" id="' + m.id + '">' +
        '<input type="text" aria-label="Memory theme" placeholder="Memory Theme" value="' + escapeHtml(m.theme) +
            '" oninput="setMemoryTheme(\'' + name + '\',\'' + m.id + '\', this.value)">' +
        '<div class="exp-container">' + exps + '</div>' +
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
    var count = state.memories.filter(function (m) { return m.memState !== 'starred'; }).length;
    setText('memoryCount', '(' + count + '/' + state.maxMemories + ' Active Slots)');
}

function updateDiaryCount() {
    setText('diaryCount', '(' + state.diary.length + '/' + state.maxDiary + ' Slots)');
}

function loseMemorySlot() {
    if (!confirm('Permanently lose a memory slot? This cannot be undone.')) return;
    state.maxMemories = Math.max(1, state.maxMemories - 1);
    updateMemoryCount();
    alert('You have permanently lost a memory slot. Max is now ' + state.maxMemories + '.');
    persist();
}

function expandDiary() {
    state.maxDiary += 2;
    updateDiaryCount();
    alert('Diary storage expanded! Max is now ' + state.maxDiary + '.');
    persist();
}

function unlockSecondSeason() {
    state.maxMemories = 8;
    updateMemoryCount();
    alert('Second Season unlocked! Max Memories is now 8.');
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
    setChecked('optReverseTime', !!st.reverseTime);
    setChecked('optMultiplayer', !!st.multiplayer);

    renderAll();
    applyDisplay();
    checkSurvivalState();
    checkTriggers();
    checkGameOver();
}

// ==========================================
// BOOT
// ==========================================

document.addEventListener('input', saveGame);
document.addEventListener('change', saveGame);
window.onload = loadGame;
