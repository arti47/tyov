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
var rollMeaning = TYOV.rollMeaning;
// Save-state helpers live in logic.js (pure + unit-tested); alias them here.
var genId = TYOV.genId;
var defaultState = TYOV.defaultState;
var normMem = TYOV.normMem;
var normalizeState = TYOV.normalizeState;

// --- Save slots (B8) ------------------------------------------------------
// Several vampires can be kept side by side. The FIRST slot keeps the original
// 'tyov_save' key so existing chronicles load untouched; later slots are
// 'tyov_save_<id>'. `tyov_slots` is the index, `tyov_active_slot` the current
// one. SAVE_KEY/HISTORY_KEY are repointed whenever the active slot changes.
var SLOT_INDEX_KEY = 'tyov_slots';
var ACTIVE_SLOT_KEY = 'tyov_active_slot';
var DEFAULT_SLOT = 'default';
var activeSlotId = DEFAULT_SLOT;

function saveKeyFor(id) { return id === DEFAULT_SLOT ? 'tyov_save' : 'tyov_save_' + id; }
function historyKeyFor(id) {
    return id === DEFAULT_SLOT ? 'tyov_save_history' : 'tyov_save_history_' + id;
}

function readSlots() {
    try {
        var raw = JSON.parse(localStorage.getItem(SLOT_INDEX_KEY) || 'null');
        if (Array.isArray(raw) && raw.length) return raw;
    } catch (e) { /* fall through to bootstrap */ }
    return null;
}

function writeSlots(slots) {
    try { localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(slots)); } catch (e) { /* ignore */ }
}

// Build the index on first run (or for a pre-slots save) so upgrading players
// keep their chronicle as slot one.
function ensureSlotIndex() {
    var slots = readSlots();
    if (!slots) {
        slots = [{ id: DEFAULT_SLOT, name: slotNameFromSave(saveKeyFor(DEFAULT_SLOT)) }];
        writeSlots(slots);
    }
    var active = null;
    try { active = localStorage.getItem(ACTIVE_SLOT_KEY); } catch (e) { active = null; }
    var known = slots.some(function (sl) { return sl.id === active; });
    activeSlotId = known ? active : slots[0].id;
    SAVE_KEY = saveKeyFor(activeSlotId);
    HISTORY_KEY = historyKeyFor(activeSlotId);
    return slots;
}

function slotNameFromSave(key) {
    try {
        var d = JSON.parse(localStorage.getItem(key) || 'null');
        if (d && d.currentName) return d.currentName;
    } catch (e) { /* ignore */ }
    return 'Chronicle 1';
}

var SAVE_KEY = 'tyov_save';
var SAVE_VERSION = TYOV.SAVE_VERSION;

var isGameLoaded = false; // Guards autosave until load/setup completes.
var undoStack = [];        // Multi-level undo of gameplay state.

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
function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
}

// Lightweight non-blocking toast — the shared surface for Guided nudges.
var toastTimer;
function toast(msg, kind) {
    var box = el('toast');
    if (!box) { console.log('toast:', msg); return; }
    box.textContent = msg;
    box.className = 'toast show' + (kind ? ' toast-' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.className = 'toast'; }, 4200);
}

// In-app modal replacing blocking alert()/confirm(). Callback-based since a
// modal is async. `showConfirm` has Cancel + Confirm; `showAlert` is OK-only.
var _modalOnConfirm = null;
var _modalLastFocus = null;
function showConfirm(o) {
    o = o || {};
    _modalLastFocus = document.activeElement;
    setText('appModalTitle', o.title || 'Confirm');
    setText('appModalMsg', o.message || '');
    var ok = el('appModalOk'), cancel = el('appModalCancel');
    ok.textContent = o.confirmLabel || 'Confirm';
    ok.className = o.danger ? 'btn-danger' : '';
    cancel.textContent = o.cancelLabel || 'Cancel';
    cancel.style.display = o.alert ? 'none' : '';
    _modalOnConfirm = o.onConfirm || null;
    el('appModal').classList.add('show');
    ok.focus();
}
function showAlert(o) {
    o = o || {};
    showConfirm({
        title: o.title || 'Notice', message: o.message, alert: true,
        confirmLabel: o.okLabel || 'OK', onConfirm: o.onClose
    });
}
function closeAppModal() {
    el('appModal').classList.remove('show');
    _modalOnConfirm = null;
    if (_modalLastFocus && _modalLastFocus.focus) { try { _modalLastFocus.focus(); } catch (e) { /* ignore */ } }
}
function appModalConfirm() {
    var fn = _modalOnConfirm;
    closeAppModal();
    if (fn) fn();
}
function isAppModalOpen() { var m = el('appModal'); return m && m.classList.contains('show'); }

function setSaveStatus(text) {
    var s = el('saveStatus');
    if (s) s.textContent = text;
}

// Push a message to the screen-reader live region (B10).
function announce(msg) {
    var r = el('srAnnounce');
    if (r) r.textContent = msg;
}

// ==========================================
// TABS + STICKY PROMPT BANNER
// ==========================================
var TABS = ['play', 'character', 'diary', 'journal', 'settings'];

function showTab(name) {
    if (TABS.indexOf(name) === -1) name = 'play';
    if (typeof closeTraitPicker === 'function') closeTraitPicker();
    state.activeTab = name;
    TABS.forEach(function (t) {
        var panel = el('panel-' + t), btn = el('tab-' + t);
        if (panel) panel.hidden = (t !== name);
        if (btn) {
            btn.classList.toggle('active', t === name);
            btn.setAttribute('aria-selected', t === name ? 'true' : 'false');
        }
    });
    if (name === 'journal') renderJournalTab();
    if (name === 'settings') renderSlots();
    // Textareas measure 0 while hidden, so re-fit them when their tab appears.
    autoGrowAll(el('panel-' + name));
    updatePromptBanner();
    window.scrollTo(0, 0);
    persist();
}

// Slim banner (shown on non-Play tabs) with the current prompt so you can act on
// it while editing traits/memories. Tapping it jumps to the Play tab.
function updatePromptBanner() {
    var b = el('promptBanner');
    if (!b) return;
    var show = state.currentPrompt >= 1 && state.activeTab !== 'play';
    if (show) {
        var visits = state.promptVisits[state.currentPrompt] || 1;
        setText('promptBannerLabel', 'Prompt ' + state.currentPrompt + (visits <= 3 ? getTier(visits) : ''));
        var txt = state.display.promptText || '';
        setText('promptBannerText', txt.length > 100 ? txt.slice(0, 100) + '…' : txt);
    }
    b.hidden = !show;
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
    var step = el('step' + stepNum);
    step.style.display = 'block';
    fillTraitRecaps(); // keep the "traits so far" reference current on every step
    autoGrowAll(step);  // textareas measure 0 while hidden
    var first = step.querySelector('input, textarea'); // move focus into the step (B10)
    if (first) first.focus();
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
// `skipValidate` is used by "Surprise me", which fills every step at once and
// therefore has nothing to validate on the way past.
function gotoStep(nextStepNum, skipValidate) {
    var fromStep = nextStepNum - 1;
    if (!skipValidate && !validateStep(fromStep)) return;
    nextStep(nextStepNum);
}

function newMemory(theme, exp1) {
    return { id: genId(), theme: theme || '', experiences: [exp1 || ''], memState: 'normal', lost: false };
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
    resetSettingPack(); // a fresh vampire gets a fresh setting
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
        touchActiveSlot();
        pushSaveHistory(json);
        setSaveStatus('Saved ✓ ' + nowHM());
    } catch (e) {
        console.error('Save failed', e);
        setSaveStatus('Save failed!');
    }
}

// Rolling backup: keep the last few good saves so a corrupt write is recoverable.
var HISTORY_KEY = 'tyov_save_history';  // repointed per slot by ensureSlotIndex()
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
    ensureSlotIndex(); // repoints SAVE_KEY/HISTORY_KEY at the active slot
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
            showAlert({
                title: 'Chronicle recovered',
                message: 'Your saved chronicle was corrupted, but a recent automatic backup was ' +
                         'found and restored. The raw corrupt data was kept under "tyov_save_corrupt".'
            });
            data = recovered;
        } else {
            showAlert({
                title: 'Save could not be read',
                message: 'Your saved chronicle was corrupted and no automatic backup was available. ' +
                         'Starting fresh; a backup of the raw data was kept under "tyov_save_corrupt".',
                onClose: showWizard
            });
            return;
        }
    }

    state = isLegacy(data) ? migrateV1(data) : normalizeState(data);
    applyState();
    isGameLoaded = true;
    persist(); // Re-save in current format (completes the migration).
}

// Record the current vampire's name and save time against the active slot so
// the chooser can label it without parsing every save.
function touchActiveSlot() {
    var slots = readSlots();
    if (!slots) return;
    var changed = false;
    slots.forEach(function (sl) {
        if (sl.id !== activeSlotId) return;
        var nm = state.currentName || sl.name || 'Unnamed';
        if (sl.name !== nm) { sl.name = nm; changed = true; }
        var stamp = Date.now();
        if (!sl.updated || stamp - sl.updated > 30000) { sl.updated = stamp; changed = true; }
    });
    if (changed) writeSlots(slots);
}

function renderSlots() {
    var box = el('slotList');
    if (!box) return;
    var slots = ensureSlotIndex();
    box.innerHTML = slots.map(function (sl) {
        var active = sl.id === activeSlotId;
        var when = sl.updated ? new Date(sl.updated).toLocaleDateString() : '—';
        return '<li class="slot-row' + (active ? ' slot-active' : '') + '">' +
            '<span class="slot-name">' + escapeHtml(sl.name || 'Unnamed') +
                (active ? ' <span class="slot-badge">current</span>' : '') + '</span>' +
            '<span class="slot-when">' + escapeHtml(when) + '</span>' +
            (active
                ? '<button class="btn-small" onclick="renameSlot()">Rename</button>'
                : '<button class="btn-small" onclick="switchSlot(\'' + sl.id + '\')">Play</button>') +
            (slots.length > 1
                ? '<button class="btn-small btn-strike" onclick="deleteSlot(\'' + sl.id + '\')">Delete</button>'
                : '') +
            '</li>';
    }).join('');
}

// Switching persists the current vampire first, then reloads onto the other
// slot — a reload is the simplest way to guarantee no state leaks across.
function switchSlot(id) {
    persist();
    try { localStorage.setItem(ACTIVE_SLOT_KEY, id); } catch (e) { /* ignore */ }
    location.reload();
}

function newSlot() {
    showConfirm({
        title: 'Begin another vampire?',
        message: 'Your current chronicle is saved and stays available in the slot list. ' +
                 'A new slot starts at vampire creation.',
        confirmLabel: 'New Chronicle',
        onConfirm: function () {
            persist();
            var slots = ensureSlotIndex();
            var id = 's' + Date.now().toString(36);
            slots.push({ id: id, name: 'New Chronicle', updated: Date.now() });
            writeSlots(slots);
            try { localStorage.setItem(ACTIVE_SLOT_KEY, id); } catch (e) { /* ignore */ }
            location.reload();
        }
    });
}

function renameSlot() {
    // The slot label tracks the vampire's current name, so renaming means
    // editing that name — send the player there rather than keeping two names.
    var field = el('currentName');
    if (field) { field.focus(); field.select(); }
    showTab('play');
    toast('Rename your vampire in the name field — the slot follows it.', 'info');
}

function deleteSlot(id) {
    var slots = ensureSlotIndex();
    var slot = slots.filter(function (sl) { return sl.id === id; })[0];
    if (!slot || slots.length < 2) return;
    showConfirm({
        title: 'Delete “' + (slot.name || 'Unnamed') + '”?',
        message: 'That chronicle is permanently deleted. This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: function () {
            try {
                localStorage.removeItem(saveKeyFor(id));
                localStorage.removeItem(historyKeyFor(id));
            } catch (e) { /* ignore */ }
            var rest = slots.filter(function (sl) { return sl.id !== id; });
            writeSlots(rest);
            if (id === activeSlotId) {
                try { localStorage.setItem(ACTIVE_SLOT_KEY, rest[0].id); } catch (e2) { /* ignore */ }
                location.reload();
                return;
            }
            renderSlots();
            toast('Chronicle deleted.', 'info');
        }
    });
}

function resetGame() {
    showConfirm({
        title: 'Wipe this chronicle?',
        message: 'This permanently deletes your saved vampire. This cannot be undone.',
        confirmLabel: 'Wipe Data',
        danger: true,
        onConfirm: function () {
            localStorage.removeItem(SAVE_KEY);
            location.reload();
        }
    });
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
    autoGrow(el('promptJournal'));
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
            showAlert({ title: 'Import failed', message: 'The file is not valid JSON.\n\n' + err.message });
            return;
        }
        try {
            var migrated = isLegacy(parsed) ? migrateV1(parsed) : normalizeState(parsed);
            localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
            location.reload();
        } catch (err) {
            showAlert({ title: 'Import failed', message: 'The file is not a valid Vampire Chronicle save.\n\n' + err.message });
        }
    };
    r.readAsText(f);
}

// Render the accumulated chronicle into the Journal tab (was the preview modal).
function renderJournalTab() {
    var box = el('journalTabContent');
    if (!box) return;
    var name = state.currentName || 'Unnamed Vampire';
    var html = '<p style="font-style:italic; color:#aaa; margin-top:0;">The Chronicle of ' + escapeHtml(name) + '</p>';
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
    box.innerHTML = html;
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

    downloadFile(txt, 'Chronicle.txt', 'text/plain');
}

// B9: the same chronicle as Markdown, for pasting into a notes app or repo.
function exportJournalMarkdown() {
    var name = state.currentName || 'Unnamed Vampire';
    var md = '# Chronicle of ' + name + '\n\n';

    var boxed = val('boxedExpText');
    if (boxed.trim()) {
        md += '> **The Boxed Experience**\n>\n' +
              boxed.split('\n').map(function (l) { return '> ' + l; }).join('\n') + '\n\n';
    }

    if (state.journalHistory.length) {
        md += '## Narrative Journal\n\n';
        state.journalHistory.forEach(function (e) {
            md += '### Prompt ' + e.prompt + '\n\n' + e.text + '\n\n';
        });
    }

    md += memoriesMarkdown('Active Memories', state.memories);
    md += memoriesMarkdown('Diary', state.diary);
    md += traitsMarkdown();

    downloadFile(md, 'Chronicle.md', 'text/markdown');
    toast('Markdown chronicle exported.', 'info');
}

function memoriesMarkdown(heading, list) {
    var kept = list.filter(function (m) { return !m.lost; });
    if (!kept.length) return '';
    var out = '## ' + heading + '\n\n';
    kept.forEach(function (m) {
        out += '### ' + (m.theme || 'Untitled Memory') +
            (m.memState !== 'normal' ? ' *(' + m.memState + ')*' : '') + '\n\n';
        m.experiences.forEach(function (x) {
            if (x.trim()) out += '- ' + x.trim() + '\n';
        });
        out += '\n';
    });
    return out;
}

function traitsMarkdown() {
    function group(label, list, fmt) {
        if (!list.length) return '';
        return '### ' + label + '\n\n' + list.map(function (e) {
            return '- ' + (e.lost ? '~~' + (fmt ? fmt(e) : e.text) + '~~' : (fmt ? fmt(e) : e.text));
        }).join('\n') + '\n\n';
    }
    var out = '## Traits\n\n';
    out += group('Skills', state.skills, function (s2) {
        return (s2.checked ? '[x] ' : '[ ] ') + s2.text;
    });
    out += group('Resources', state.resources);
    out += group('Characters', state.characters, function (c) {
        return c.text + ' — ' + c.type + (c.doom ? ' (' + new Array(c.doom + 1).join('•') + ')' : '');
    });
    out += group('Marks', state.marks);
    return out;
}

function downloadFile(text, filename, mime) {
    var blob = new Blob([text], { type: mime });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

// B9: print / save-as-PDF the rendered chronicle. The print stylesheet hides
// every control and shows only #journalTabContent.
function printChronicle() {
    showTab('journal');
    renderJournalTab();
    setTimeout(function () { window.print(); }, 60);
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
        autoGrow(ta); // shrink back after the entry is archived
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

// B11: brief dice-roll animation. Flashes random faces, then settles on the
// actual d10/d6 and the net movement. Purely cosmetic; state updates happen
// immediately in rollAndMove regardless.
function dieFace(val, cls) { return '<span class="die die-' + cls + '">' + val + '</span>'; }
function animateDice(m) {
    var box = el('diceAnim');
    if (!box) return;
    clearInterval(box._t);
    var d10Final = m.multi ? (m.d10_1 + ' + ' + m.d10_2) : ('' + m.d10_1);
    var op = m.reverse ? '−' : '−'; // d10 − d6 (or d6 − d10 shown by order below)
    var ticks = 0;
    box.classList.add('rolling');
    box._t = setInterval(function () {
        ticks++;
        if (ticks <= 8) {
            var a = 1 + Math.floor(Math.random() * 10);
            var b = 1 + Math.floor(Math.random() * 6);
            box.innerHTML = m.reverse
                ? dieFace(b, 'd6') + '<span class="die-op">' + op + '</span>' + dieFace(a, 'd10')
                : dieFace(a, 'd10') + '<span class="die-op">' + op + '</span>' + dieFace(b, 'd6');
        } else {
            clearInterval(box._t);
            box.classList.remove('rolling');
            var faces = m.reverse
                ? dieFace(m.d6, 'd6') + '<span class="die-op">' + op + '</span>' + dieFace(d10Final, 'd10')
                : dieFace(d10Final, 'd10') + '<span class="die-op">' + op + '</span>' + dieFace(m.d6, 'd6');
            box.innerHTML = faces + '<span class="die-net">= ' + (m.diff >= 0 ? '+' : '') + m.diff + '</span>';
        }
    }, 55);
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
    // First-turn hint: after setup there is no Prompt yet, so say what to do.
    toggleNote('startNote', p === 0 && !state.gameOver);
    var ea = el('entryActions');
    if (ea) ea.style.display = p === 0 ? 'none' : '';
    updatePromptBanner();
}

function checkGameOver() {
    var ending = state.currentPrompt >= 72 && state.currentPrompt <= 80;
    if (ending && !state.gameOver) {
        // Same reason as declareGameOver: nothing will archive it later.
        archiveJournal();
    }
    if (ending) state.gameOver = true;
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
    animateDice(m);
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
    announce('Moved ' + m.diff + '. Prompt ' + state.currentPrompt + tier + '. ' + state.display.promptText);

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
        toast('Enter a prompt number between 1 and 80.', 'warn');
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
    announce('Jumped to Prompt ' + target + tier + '. ' + state.display.promptText);

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
    announce('Stepped back to Prompt ' + state.currentPrompt + '. ' + state.display.promptText);
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
    announce('Advanced to Prompt ' + state.currentPrompt + tier + '. ' + state.display.promptText);
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

// --- Guided prompt-action pickers (hovering popovers) -------------------
// Clicking "Check a Skill" / "Lose a Resource" opens a small popover anchored
// to the button, listing the relevant traits. Each row toggles that trait's
// state live: check/un-check a Skill, lose/restore a Resource. Which picker
// opens follows the rules substitution ladder (TYOV.resolveTraitAction): if you
// can't check a Skill you're steered to lose a Resource instead (and vice
// versa); if neither is possible you're offered "the game is over".

var openTraitPicker = null; // the currently-open popover element, or null

function promptCheckSkill() {
    var res = TYOV.resolveTraitAction('check', uncheckedSkillCount(), activeResourceCount());
    if (res.result === 'check') {
        showTraitPicker('skills', el('btnCheckSkill'));
    } else if (res.result === 'substitute-lose') {
        toast(res.message, 'warn');
        showTraitPicker('resources', el('btnLoseResource'));
    } else {
        offerGameOver(res.message);
    }
}

function promptLoseResource() {
    var res = TYOV.resolveTraitAction('lose', uncheckedSkillCount(), activeResourceCount());
    if (res.result === 'lose') {
        showTraitPicker('resources', el('btnLoseResource'));
    } else if (res.result === 'substitute-check') {
        toast(res.message, 'warn');
        showTraitPicker('skills', el('btnCheckSkill'));
    } else {
        offerGameOver(res.message);
    }
}

// "Kill a Character" — opens the picker of ALL Characters (kill or revive).
// Most kill prompts say "kill a Character" (5a, 17c, 19b, 35b, 36b…), which can
// include Immortals such as your sire; a couple (1a, 34b) specify a mortal, so
// the picker tags each row Mortal/Immortal and lists mortals first. A "+ New
// mortal Character" action covers the rules' "create a mortal if none are
// available". Unlike Skills/Resources this isn't part of the substitution ladder.
function promptKillCharacter() {
    showTraitPicker('characters', el('btnKillCharacter'));
}

function closeTraitPicker() {
    if (openTraitPicker && openTraitPicker.parentNode) {
        openTraitPicker.parentNode.removeChild(openTraitPicker);
    }
    openTraitPicker = null;
}

// kind: 'skills' (check/un-check) | 'resources' (lose/restore)
function showTraitPicker(kind, anchorBtn) {
    var toggleClosed = openTraitPicker && openTraitPicker.getAttribute('data-kind') === kind;
    closeTraitPicker();
    if (toggleClosed) return; // clicking the same button again closes it

    var container = el('promptActions');
    if (!container) return;
    var pop = document.createElement('div');
    pop.className = 'trait-picker';
    pop.setAttribute('data-kind', kind);
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', kind === 'skills' ? 'Check a Skill'
        : kind === 'characters' ? 'Kill a Character'
        : kind === 'memories' ? 'File as an Experience'
        : kind === 'memoryops' ? 'Memory actions' : 'Lose a Resource');
    pop.innerHTML = kind === 'memories' ? memoryPickerHTML()
        : kind === 'memoryops' ? memoryOpsHTML()
        : traitPickerHTML(kind);
    container.appendChild(pop);
    positionTraitPicker(pop, anchorBtn);
    openTraitPicker = pop;
    var first = pop.querySelector('.tp-row') || pop.querySelector('.tp-close');
    if (first) first.focus();
}

function traitPickerHTML(kind) {
    var title, hint, body;
    if (kind === 'skills') {
        title = 'Check a Skill';
        hint = 'Tap to check — or un-check — a Skill.';
        // A Skill in the graveyard (lost) can't be checked, so omit it.
        var skills = state.skills.filter(function (s) { return !s.lost; });
        body = skills.length
            ? skills.map(function (s) { return traitPickerRow('skills', s.id, s.text, s.checked, '✓'); }).join('')
            : '<p class="tp-empty">No Skills.</p>';
    } else if (kind === 'characters') {
        title = 'Kill a Character';
        hint = 'Tap to kill — or revive — a Character.';
        // All Characters (incl. already-killed, so they can be revived), mortals
        // listed first, each tagged with its type. Some prompts kill any
        // Character (Immortals included), others specify a mortal.
        var chars = state.characters.slice().sort(function (a, b) {
            if (a.type === b.type) return 0;
            return a.type === 'Mortal' ? -1 : 1;
        });
        body = (chars.length
            ? chars.map(function (c) { return traitPickerRow('characters', c.id, c.text, c.lost, '✗', c.type); }).join('')
            : '<p class="tp-empty">No Characters yet.</p>') +
            '<button type="button" class="tp-row tp-create" onclick="createMortalFromPicker()">' +
                '<span class="tp-box">+</span><span class="tp-name">New mortal Character…</span></button>';
    } else {
        title = 'Lose a Resource';
        hint = 'Tap to lose — or restore — a Resource.';
        // All Resources (incl. the Diary) — lost ones stay listed for restore.
        body = state.resources.length
            ? state.resources.map(function (r) { return traitPickerRow('resources', r.id, r.text, r.lost, '✗'); }).join('')
            : '<p class="tp-empty">No Resources.</p>';
    }
    return '<div class="tp-head"><strong>' + title + '</strong>' +
        '<button type="button" class="tp-close" aria-label="Close" onclick="closeTraitPicker()">×</button></div>' +
        '<div class="tp-rows" role="menu">' + body + '</div>' +
        '<p class="tp-hint">' + hint + '</p>';
}

function traitPickerRow(kind, id, text, on, glyph, tag) {
    var fallback = kind === 'skills' ? 'Unnamed Skill'
        : (kind === 'characters' ? 'Unnamed Character' : 'Unnamed Resource');
    var name = escapeHtml(text || fallback);
    // A lost Resource / killed Character is struck out; a checked Skill is not
    // (it's marked by the ✓ box + accent border — checked ≠ lost).
    var strike = on && kind !== 'skills';
    var tagHtml = tag ? '<span class="tp-tag">' + escapeHtml(tag) + '</span>' : '';
    var typeAttr = tag ? ' data-type="' + escapeHtml(tag) + '"' : '';
    return '<button type="button" class="tp-row' + (on ? ' tp-on' : '') + '" data-id="' + id + '"' + typeAttr +
        ' role="menuitemcheckbox" aria-checked="' + (on ? 'true' : 'false') + '"' +
        ' onclick="pickTrait(\'' + kind + '\',\'' + id + '\')">' +
        '<span class="tp-box">' + (on ? glyph : '') + '</span>' +
        '<span class="tp-name' + (strike ? ' strikethrough' : '') + '">' + name + '</span>' + tagHtml + '</button>';
}

function pickTrait(kind, id) {
    var on;
    if (kind === 'skills') {
        var s = findEntity('skills', id);
        if (!s) return;
        setSkillChecked(id, !s.checked); // pushUndo + renderSkills + persist
        on = s.checked;
        announce((on ? 'Checked' : 'Un-checked') + ' Skill "' + (s.text || 'Unnamed') + '".');
    } else {
        // Resources and mortal Characters both toggle .lost via toggleLoseEntity.
        var list = kind === 'characters' ? 'characters' : 'resources';
        toggleLoseEntity(list, id); // pushUndo + render + survival + persist (Diary-aware)
        var e = findEntity(list, id);
        if (!e) return;
        on = e.lost;
        if (kind === 'characters') {
            announce((on ? 'Killed' : 'Revived') + ' Character "' + (e.text || 'Unnamed') + '".');
        } else {
            announce((on ? 'Lost' : 'Restored') + ' Resource "' + (e.text || 'Unnamed') + '".');
        }
    }
    // Update just this row in place. (Rebuilding innerHTML here would detach the
    // clicked node before the document outside-click handler runs, which would
    // then wrongly close the popover.)
    if (openTraitPicker && openTraitPicker.getAttribute('data-kind') === kind) {
        var row = openTraitPicker.querySelector('.tp-row[data-id="' + id + '"]');
        if (row) {
            row.classList.toggle('tp-on', on);
            row.setAttribute('aria-checked', on ? 'true' : 'false');
            var box = row.querySelector('.tp-box');
            if (box) box.textContent = on ? (kind === 'skills' ? '✓' : '✗') : '';
            var nm = row.querySelector('.tp-name');
            if (nm) nm.classList.toggle('strikethrough', on && kind !== 'skills');
        }
    }
}

// "+ New mortal Character" in the Kill-a-Mortal picker. Appends a fresh mortal
// and inserts a killable row in place (no innerHTML rebuild — that would detach
// the clicked create button and let the outside-click handler close the popover).
function createMortalFromPicker() {
    addCharacter('', 'Mortal'); // pushUndo + renderCharacters + persist
    var created = state.characters[state.characters.length - 1];
    announce('Created a new mortal Character. Name it in the Character tab.');
    toast('New mortal Character added — name it in the Character tab.', 'info');
    if (openTraitPicker && openTraitPicker.getAttribute('data-kind') === 'characters') {
        var rows = openTraitPicker.querySelector('.tp-rows');
        var createBtn = rows.querySelector('.tp-create');
        var empty = rows.querySelector('.tp-empty');
        if (empty) rows.removeChild(empty);
        var tmp = document.createElement('div');
        tmp.innerHTML = traitPickerRow('characters', created.id, created.text, created.lost, '✗', 'Mortal');
        var newRow = tmp.firstChild;
        // Keep mortals-first order: insert before the first Immortal (or the
        // create action if there are none).
        var firstImmortal = rows.querySelector('.tp-row[data-type="Immortal"]');
        rows.insertBefore(newRow, firstImmortal || createBtn);
        newRow.focus();
    }
}

function positionTraitPicker(pop, anchorBtn) {
    // Anchor just below the clicked button, inside the position:relative
    // .prompt-actions. On narrow screens, center it so it can't run off-screen.
    if (window.innerWidth <= 520 || !anchorBtn) {
        pop.classList.add('tp-centered');
        pop.style.left = '';
        pop.style.top = '';
        return;
    }
    pop.classList.remove('tp-centered');
    var container = pop.parentNode;
    var cRect = container.getBoundingClientRect();
    var bRect = anchorBtn.getBoundingClientRect();
    var left = bRect.left - cRect.left;
    var maxLeft = container.clientWidth - pop.offsetWidth;
    if (left > maxLeft) left = maxLeft;
    if (left < 0) left = 0;
    pop.style.left = left + 'px';
    pop.style.top = (bRect.bottom - cRect.top + 6) + 'px';
}

function offerGameOver(msg) {
    showConfirm({
        title: 'The game is over?',
        message: msg + '\n\nEnd the chronicle now?',
        confirmLabel: 'End the Game',
        cancelLabel: 'Not yet',
        danger: true,
        onConfirm: function () { declareGameOver(msg); }
    });
}

function declareGameOver(reason) {
    pushUndo();
    // The roll button is disabled once the game is over, and archiveJournal()
    // normally runs on the next roll — so archive the pending entry NOW or the
    // final, most important entry of the chronicle would be lost.
    archiveJournal();
    state.gameOver = true;
    addToHistoryLog('GAME OVER — ' + reason);
    applyDisplay();
    checkGameOver();
    updatePromptMeta();
    toast('The game is over. ' + reason, 'warn');
    announce('The game is over. ' + reason);
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
    renderPlayRecap();
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
    showConfirm({
        title: 'Pass a century?',
        message: 'Every living mortal Character will be struck out (they have died of old age).',
        confirmLabel: 'Pass a Century',
        onConfirm: function () {
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
    });
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
    // Forced forgetting is the heart of the game, so don't dead-end on a toast:
    // offer the two legal ways out (Diary or forget) right here. Starred
    // Memories don't occupy a slot, so count actives, not the raw array.
    if (name === 'memories' && activeMemoryCount() >= state.maxMemories) {
        offerMemorySlotRelief();
        return;
    }
    if (name === 'diary' && state.diary.length >= state.maxDiary) {
        toast('Diary limit reached (' + state.maxDiary + ' Memories).', 'warn');
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

function memExpCap(m) { return m.memState === 'vast' ? 5 : 3; }

function changeMemoryState(name, id, memState) {
    var m = findMem(name, id);
    if (!m) return;
    pushUndo();
    m.memState = memState;
    // Leaving Vast drops any Experiences beyond the normal three (rules).
    if (memState !== 'vast' && m.experiences.length > 3) {
        m.experiences = m.experiences.slice(0, 3);
    }
    if (m.experiences.length === 0) m.experiences.push('');
    renderMemoryList(name);
    updateMemoryCount();
    persist();
}

// B7: add/remove Experience rows (up to 3, or 5 when Vast).
function addExperience(name, id) {
    var m = findMem(name, id);
    if (!m || m.experiences.length >= memExpCap(m)) return;
    pushUndo();
    m.experiences.push('');
    renderMemoryList(name);
    var last = el('exp-' + id + '-' + (m.experiences.length - 1));
    if (last) last.focus();
    persist();
}

function removeExperience(name, id, index) {
    var m = findMem(name, id);
    if (!m) return;
    pushUndo();
    m.experiences.splice(index, 1);
    if (m.experiences.length === 0) m.experiences.push('');
    renderMemoryList(name);
    persist();
}

function migrateToDiary(id) {
    if (state.diary.length >= state.maxDiary) {
        toast('Your Diary is full (' + state.maxDiary + ' Memories). Delete a Diary entry first.', 'warn');
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

// Grow a textarea to fit its content so a whole Experience paragraph is visible
// without inner scrolling. Called on input and after every Memory re-render.
function autoGrow(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
}

function autoGrowAll(container) {
    var root = container || document;
    var list = root.querySelectorAll('textarea.autogrow');
    for (var i = 0; i < list.length; i++) autoGrow(list[i]);
}

function memoryBlockHtml(m, name) {
    var inDiary = name === 'diary';
    var cap = memExpCap(m);
    var exps = '';
    for (var i = 0; i < m.experiences.length; i++) {
        // Memories in the Diary are frozen — no new/edited Experiences (A6).
        var delBtn = (!inDiary && m.experiences.length > 1)
            ? '<button class="btn-small btn-strike exp-del" aria-label="Remove experience ' + (i + 1) +
              '" onclick="removeExperience(\'' + name + '\',\'' + m.id + '\',' + i + ')">×</button>'
            : '';
        // A textarea (not a single-line input): an Experience is a whole
        // sentence or short paragraph, and autoGrow keeps the full text visible.
        exps += '<div class="exp-row">' +
            '<textarea id="exp-' + m.id + '-' + i + '" class="experience-input autogrow" rows="2" aria-label="Experience ' + (i + 1) +
            '" placeholder="- Experience ' + (i + 1) + '"' +
            (inDiary ? ' readonly' : ' oninput="setExperience(\'' + name + '\',\'' + m.id + '\',' + i + ', this.value); autoGrow(this)"') +
            '>' + escapeHtml(m.experiences[i] || '') + '</textarea>' +
            delBtn + '</div>';
    }
    var addExpBtn = (!inDiary && m.experiences.length < cap)
        ? '<button class="btn-small exp-add" onclick="addExperience(\'' + name + '\',\'' + m.id + '\')">+ Experience</button>'
        : '';
    // Meaning-table inspiration (Character-tab Memories only; the Diary is frozen).
    var expIds = m.experiences.map(function (x, i) { return 'exp-' + m.id + '-' + i; }).join(',');
    var sparkBtn = inDiary ? ''
        : '<button type="button" class="btn-small spark-btn" onclick="sparkInto(\'spark-' + m.id +
          '\',\'' + expIds + '\')">🎲 Spark</button>';
    var sparkDiv = inDiary ? '' : '<div class="meaning-spark" id="spark-' + m.id + '"></div>';
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
        '<div class="exp-container">' + exps + '</div>' + addExpBtn + sparkBtn + hint + sparkDiv +
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
    autoGrowAll(el(containerId)); // size each Experience box to its text
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

// At the Memory cap: name the choice and take the player straight to it.
function offerMemorySlotRelief() {
    var canDiary = state.diary.length < state.maxDiary;
    showConfirm({
        title: 'Your Memories are full',
        message: 'You hold ' + activeMemoryCount() + ' of ' + state.maxMemories +
            ' Memories. To take on a new one you must first let an old one go — ' +
            (canDiary
                ? 'move a Memory to your Diary to keep it safely out of mind, or strike one out to forget it forever.'
                : 'your Diary is full too, so a Memory must be struck out and forgotten.'),
        confirmLabel: canDiary ? 'Open my Memories' : 'Open my Memories',
        cancelLabel: 'Not yet',
        onConfirm: function () {
            showTab('character');
            var first = el('memoriesContainer');
            if (first) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
            toast(canDiary
                ? 'Use “Move to Diary” to store a Memory, or Delete to forget it.'
                : 'Delete a Memory to forget it and free a slot.', 'info');
        }
    });
}

function loseMemorySlot() {
    showConfirm({
        title: 'Lose a memory slot?',
        message: 'This permanently reduces your maximum Memories. (You can Undo this.)',
        confirmLabel: 'Lose a Slot',
        onConfirm: function () {
            pushUndo();
            state.maxMemories = Math.max(1, state.maxMemories - 1);
            updateMemoryCount();
            toast('You have lost a memory slot. Max is now ' + state.maxMemories + '.', 'warn');
            persist();
        }
    });
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
    renderPlayRecap();
    renderNameHistory();
    updateMemoryCount();
    updateDiaryCount();
}

function applyState() {
    setVal('currentName', state.currentName);
    setVal('boxedExpText', state.boxedExp);
    setVal('promptJournal', state.currentJournal);
    autoGrowAll(); // fit the free-form boxes to whatever was just loaded in

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
    showTab(state.activeTab || 'play');
}

// ==========================================
// BOOT
// ==========================================

// ==========================================
// MEANING ORACLE (floating d100 idea generator)
// ==========================================
// A floating button opens a panel that rolls a d100 three times against the
// meaningTable (data.js) and offers to insert the three words into whichever
// text field you last had focused. Not a rule — just an idea spark.

var oracleResults = [];   // [{ roll, word } x3]
var lastActiveField = null; // the text input/textarea focused before the oracle

// Track the last-focused text field so we can insert back into it after the
// oracle button steals focus. Only plain text inputs and textareas qualify.
function isInsertableField(elm) {
    if (!elm || elm.readOnly || elm.disabled) return false;
    if (elm.tagName === 'TEXTAREA') return true;
    return elm.tagName === 'INPUT' && (elm.type === 'text' || elm.type === 'search');
}

function toggleOracle() {
    var p = el('oraclePanel');
    if (!p) return;
    var opening = !p.classList.contains('show');
    p.classList.toggle('show', opening);
    if (opening) {
        if (!oracleResults.length) rerollOracle();
        setOracleHint('');
    }
}

function rerollOracle() {
    oracleResults = [
        rollMeaning(meaningTable), rollMeaning(meaningTable), rollMeaning(meaningTable)
    ];
    renderOracle();
    setOracleHint('');
}

function renderOracle() {
    var box = el('oracleWords');
    if (!box) return;
    box.innerHTML = oracleResults.map(function (r) {
        return '<div class="oracle-word"><span class="oracle-roll">' + r.roll + '</span>' +
               '<span class="oracle-term">' + escapeHtml(r.word) + '</span></div>';
    }).join('');
}

function setOracleHint(msg) {
    var h = el('oracleHint');
    if (h) h.textContent = msg || '';
}

// Insert text at the caret of a field (or replacing its selection), then fire an
// 'input' event so autosave and per-field state handlers pick up the change.
function insertAtCaret(field, text) {
    var start = field.selectionStart;
    var end = field.selectionEnd;
    if (typeof start === 'number' && typeof end === 'number') {
        var v = field.value;
        field.value = v.slice(0, start) + text + v.slice(end);
        var pos = start + text.length;
        field.setSelectionRange(pos, pos);
    } else {
        field.value += text;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    }
    fallbackCopy(text);
}
function fallbackCopy(text) {
    try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    } catch (e) { /* clipboard is best-effort */ }
}

function insertOracle() {
    if (!oracleResults.length) return;
    var words = oracleResults.map(function (r) { return r.word; });
    var f = lastActiveField;
    if (f && f.isConnected && isInsertableField(f)) {
        // "Each on its own line" for textareas; single-line inputs can't hold
        // newlines, so fall back to a comma separator there.
        var sep = f.tagName === 'TEXTAREA' ? '\n' : ', ';
        insertAtCaret(f, words.join(sep));
        setOracleHint('Inserted into your text field.');
    } else {
        copyToClipboard(words.join('\n'));
        setOracleHint('No active text field — copied to the clipboard.');
    }
}

// Inline "spark" — roll the meaning table 3× and show the words as inspiration
// (NOT inserted) beside a Memory/Experience field. Used in the setup wizard and
// on Character-tab Memory blocks.
// `fieldIds` (optional, comma-separated) makes each word tappable: tapping
// inserts it into the first empty listed field (else the last-focused one).
function sparkInto(id, fieldIds) {
    var target = el(id);
    if (!target) return;
    var words = [rollMeaning(meaningTable), rollMeaning(meaningTable), rollMeaning(meaningTable)];
    var chips = words.map(function (r) {
        var body = '<span class="spark-roll">' + r.roll + '</span>' + escapeHtml(r.word);
        if (!fieldIds) return '<span class="spark-word">' + body + '</span>';
        return chipHtml(r.word, fieldIds, body);
    }).join(' ');
    target.innerHTML = chipRowHtml('Spark:', chips, id);
}

// Concrete ready-to-use examples for setup steps 1–4 (names / skills /
// resources / characters). Tapping one drops it into the first empty field of
// that step. Purely a "stuck for ideas" aid, like the Meaning Oracle.
function suggestInto(kind, containerId, fieldIds) {
    var target = el(containerId);
    var pack = activeSettingPack();
    if (!target || !pack) return;
    var picks = TYOV.pickSuggestions(pack[kind], 3).map(traitText);
    var chips = picks.map(function (s) { return chipHtml(s, fieldIds); }).join(' ');
    target.innerHTML = chipRowHtml('Try:', chips, containerId);
}

// --- Memory operations (Play tab) ----------------------------------------
// 28 Prompt entries manipulate Memories: "strike out a Memory" / "lose a
// Memory" (15), "lose a Memory slot permanently" (4), and "create a Skill
// based on a Memory" / "convert a Memory to a Skill" (9). One picker serves
// all three, switching between two modes.
var memoryOpsMode = 'forget'; // 'forget' | 'skill'

function promptMemoryOps() {
    memoryOpsMode = 'forget';
    showTraitPicker('memoryops', el('btnMemoryOps'));
}

function setMemoryOpsMode(mode) {
    memoryOpsMode = mode;
    if (!openTraitPicker) return;
    openTraitPicker.innerHTML = memoryOpsHTML();
    var f = openTraitPicker.querySelector('.tp-row');
    if (f) f.focus();
}

// Every Memory the player holds, Diary included — "lose a Memory" doesn't
// exempt stored ones.
function allMemoryRefs() {
    return state.memories.map(function (m) { return { m: m, list: 'memories' }; })
        .concat(state.diary.map(function (m) { return { m: m, list: 'diary' }; }));
}

function memoryOpsHTML() {
    var skillMode = memoryOpsMode === 'skill';
    var refs = allMemoryRefs();
    var rows = refs.map(function (r) {
        var label = r.m.theme || firstExperienceOf(r.m) || 'Untitled Memory';
        var on = !skillMode && r.m.lost;
        var tag = r.list === 'diary' ? 'diary' : (r.m.memState !== 'normal' ? r.m.memState : '');
        return '<button type="button" class="tp-row' + (on ? ' tp-on' : '') + '" data-id="' + r.m.id + '"' +
            ' role="menuitemcheckbox" aria-checked="' + (on ? 'true' : 'false') + '"' +
            ' onclick="pickMemoryOp(\'' + r.list + '\',\'' + r.m.id + '\')">' +
            '<span class="tp-box">' + (skillMode ? '+' : (on ? '\u2717' : '')) + '</span>' +
            '<span class="tp-name' + (on ? ' strikethrough' : '') + '">' + escapeHtml(label) + '</span>' +
            (tag ? '<span class="tp-tag">' + escapeHtml(tag) + '</span>' : '') + '</button>';
    }).join('');
    var body = rows || '<p class="tp-empty">No Memories yet.</p>';
    var footer = skillMode
        ? '<button type="button" class="tp-row tp-create" onclick="setMemoryOpsMode(\'forget\')">' +
          '<span class="tp-box">\u2190</span><span class="tp-name">Back to forgetting</span></button>'
        : '<button type="button" class="tp-row tp-create" onclick="setMemoryOpsMode(\'skill\')">' +
          '<span class="tp-box">+</span><span class="tp-name">Make a Skill from a Memory…</span></button>' +
          '<button type="button" class="tp-row tp-create" onclick="loseMemorySlotFromPicker()">' +
          '<span class="tp-box">\u2212</span><span class="tp-name">Lose a Memory slot permanently</span></button>';
    return '<div class="tp-head"><strong>' + (skillMode ? 'Skill from a Memory' : 'Forget a Memory') + '</strong>' +
        '<button type="button" class="tp-close" aria-label="Close" onclick="closeTraitPicker()">\u00d7</button></div>' +
        '<div class="tp-rows" role="menu">' + body + footer + '</div>' +
        '<p class="tp-hint">' + (skillMode
            ? 'Tap a Memory to base a new Skill on it.'
            : 'Tap to strike out — or restore — a Memory.') + '</p>';
}

function firstExperienceOf(m) {
    var e = (m.experiences || []).filter(function (x) { return x.trim(); })[0] || '';
    return e.length > 40 ? e.slice(0, 40) + '…' : e;
}

function pickMemoryOp(list, id) {
    var m = findEntity(list, id);
    if (!m) return;
    if (memoryOpsMode === 'skill') {
        pushUndo();
        var base = m.theme || firstExperienceOf(m) || '';
        addSkill(base);
        closeTraitPicker();
        showTab('play');
        toast('Skill created from “' + (base || 'a Memory') + '” — reword it below.', 'info');
        announce('Skill created from a Memory.');
        focusNewTrait('skills', state.skills[state.skills.length - 1]);
        return;
    }
    pushUndo();
    m.lost = !m.lost;
    renderMemoryList(list);
    updateMemoryCount();
    updateDiaryCount();
    persist();
    announce((m.lost ? 'Struck out' : 'Restored') + ' Memory.');
    var row = openTraitPicker && openTraitPicker.querySelector('.tp-row[data-id="' + id + '"]');
    if (row) {
        row.classList.toggle('tp-on', m.lost);
        row.setAttribute('aria-checked', m.lost ? 'true' : 'false');
        var box = row.querySelector('.tp-box');
        if (box) box.textContent = m.lost ? '\u2717' : '';
        var nm = row.querySelector('.tp-name');
        if (nm) nm.classList.toggle('strikethrough', m.lost);
    }
}

function loseMemorySlotFromPicker() {
    closeTraitPicker();
    loseMemorySlot();
}

// --- Entry actions (Play tab) --------------------------------------------
// The prompt journal normally archives itself on the next roll. These give the
// player explicit control, which also covers the two cases a roll never
// reaches: the end of the game, and filing an answer as a real Memory.

function saveEntryNow() {
    var ta = el('promptJournal');
    if (!ta || !ta.value.trim()) { toast('Nothing written yet.', 'warn'); return; }
    if (state.currentPrompt === 0) { toast('Roll the dice first.', 'warn'); return; }
    pushUndo();
    archiveJournal();
    renderJournalTab();
    persist();
    toast('Entry saved to your Chronicle.', 'info');
    announce('Entry saved to the chronicle.');
}

// "File as an Experience" — the core TYOV loop the app was missing: the answer
// you just wrote becomes an Experience inside one of your Memories. Opens the
// same popover the guided actions use, listing Memories with a free slot plus
// a "new Memory" row (offered only when you are under the Memory cap).
function fileExperience() {
    var ta = el('promptJournal');
    if (!ta || !ta.value.trim()) { toast('Write your answer first.', 'warn'); return; }
    showTraitPicker('memories', el('btnFileExperience'));
}

function memoryPickerHTML() {
    var rows = state.memories.map(function (m) {
        var cap = memExpCap(m);
        var full = m.experiences.filter(function (x) { return x.trim(); }).length >= cap;
        var label = (m.theme || 'Untitled Memory');
        var tag = full ? 'full' : (m.experiences.filter(function (x) { return x.trim(); }).length + '/' + cap);
        return '<button type="button" class="tp-row' + (full ? ' tp-disabled' : '') +
            '" data-id="' + m.id + '"' + (full ? ' disabled' : '') +
            ' onclick="pickMemoryForExperience(\'' + m.id + '\')">' +
            '<span class="tp-box">' + (full ? '' : '+') + '</span>' +
            '<span class="tp-name">' + escapeHtml(label) + '</span>' +
            '<span class="tp-tag">' + tag + '</span></button>';
    }).join('');
    var atCap = activeMemoryCount() >= state.maxMemories;
    var create = atCap
        ? '<p class="tp-empty">Memory limit reached (' + state.maxMemories + '). ' +
          'Free a slot to start a new Memory:</p>' +
          '<button type="button" class="tp-row tp-create" onclick="closeTraitPicker(); showTab(\'character\');">' +
          '<span class="tp-box">→</span><span class="tp-name">Open Memories to move or forget one</span></button>'
        : '<button type="button" class="tp-row tp-create" onclick="createMemoryWithExperience()">' +
          '<span class="tp-box">+</span><span class="tp-name">New Memory from this entry…</span></button>';
    return '<div class="tp-head"><strong>File as an Experience</strong>' +
        '<button type="button" class="tp-close" aria-label="Close" onclick="closeTraitPicker()">×</button></div>' +
        '<div class="tp-rows" role="menu">' + (rows || '') + create + '</div>' +
        '<p class="tp-hint">The text stays in your Chronicle entry too.</p>';
}

function pickMemoryForExperience(id) {
    var ta = el('promptJournal');
    var text = ta ? ta.value.trim() : '';
    var m = findEntity('memories', id);
    if (!m || !text) return;
    pushUndo();
    // Reuse a trailing blank row if there is one, else append.
    var idx = -1;
    for (var i = 0; i < m.experiences.length; i++) {
        if (!m.experiences[i].trim()) { idx = i; break; }
    }
    if (idx === -1) m.experiences.push(text); else m.experiences[idx] = text;
    closeTraitPicker();
    renderMemoryList('memories');
    updateMemoryCount();
    persist();
    toast('Filed into “' + (m.theme || 'Untitled Memory') + '”.', 'info');
    announce('Experience filed into ' + (m.theme || 'a Memory') + '.');
}

function createMemoryWithExperience() {
    var ta = el('promptJournal');
    var text = ta ? ta.value.trim() : '';
    if (!text) return;
    pushUndo();
    state.memories.push(newMemory('', text));
    closeTraitPicker();
    renderMemoryList('memories');
    updateMemoryCount();
    persist();
    toast('New Memory created — give it a Theme in the Character tab.', 'info');
    announce('New Memory created from this entry.');
}

// Memories that occupy a slot (starred ones are free, struck-out ones are gone).
function activeMemoryCount() {
    return state.memories.filter(function (m) {
        return m.memState !== 'starred' && !m.lost;
    }).length;
}

// --- Quick-create traits from the Play tab -------------------------------
// 120 of the 222 prompt entries say "create/gain a Skill / Resource /
// Character / Mark". Doing that used to mean leaving the Prompt for the
// Character tab; these add the trait in place and focus it for naming.
function quickCreate(list) {
    pushUndo();
    if (list === 'skills') addSkill('');
    else if (list === 'resources') addResource('');
    else if (list === 'characters') addCharacter('', 'Mortal');
    else if (list === 'marks') addMark('');
    else return;
    var added = state[list][state[list].length - 1];
    var labels = { skills: 'Skill', resources: 'Resource', characters: 'mortal Character', marks: 'Mark' };
    renderPlayRecap();
    toast('New ' + labels[list] + ' added — name it below.', 'info');
    announce('New ' + labels[list] + ' created.');
    focusNewTrait(list, added);
}

// Reveal the Play-tab recap and focus the new (blank) trait so it can be named
// without leaving the Prompt.
function focusNewTrait(list, entity) {
    if (!entity) return;
    var rec = el('playRecap');
    if (rec) rec.open = true;
    var field = el('recap-' + entity.id);
    if (field) { field.focus(); field.scrollIntoView({ block: 'nearest' }); }
}

// --- Play-tab trait recap -------------------------------------------------
// Editable one-line list of the traits you need while answering a Prompt, so
// the Character tab is only needed for bigger surgery.
function renderPlayRecap() {
    var box = el('playTraitRecap');
    if (!box) return;
    // Never rebuild while one of its own inputs has focus — that would drop the
    // caret mid-word (same rule as the trait lists: text edits don't re-render).
    var a = document.activeElement;
    if (a && a.classList && a.classList.contains('recap-input') && box.contains(a)) return;
    box.innerHTML =
        recapGroup('Skills', 'skills') +
        recapGroup('Resources', 'resources') +
        recapGroup('Characters', 'characters') +
        recapGroup('Marks', 'marks');
}

function recapGroup(label, list) {
    var items = state[list].filter(function (e) { return !e.lost; });
    if (!items.length) return '<div class="recap-row"><b>' + label + ':</b> <i>none</i></div>';
    var cells = items.map(function (e) {
        var checkedCls = (list === 'skills' && e.checked) ? ' checked-skill' : '';
        return '<input type="text" id="recap-' + e.id + '" class="recap-input' + checkedCls +
            '" aria-label="' + label + '" value="' + escapeHtml(e.text) +
            '" oninput="setEntityText(\'' + list + '\',\'' + e.id + '\', this.value); syncTraitLists(\'' + list + '\')">';
    }).join('');
    return '<div class="recap-row"><b>' + label + ':</b> <span class="recap-items">' + cells + '</span></div>';
}

// The Character tab shows the same traits. Mirror the edit into its matching
// input directly rather than re-rendering, so neither field loses focus.
function syncTraitLists(list) {
    var ids = { skills: 'skillsList', resources: 'resourcesList',
                characters: 'charactersList', marks: 'marksList' };
    var host = el(ids[list]);
    var src = document.activeElement;
    if (!host || !src || !src.id) return;
    var id = src.id.replace(/^recap-/, '');
    var inputs = host.querySelectorAll('input[type="text"]');
    for (var i = 0; i < inputs.length && i < state[list].length; i++) {
        if (state[list][i].id === id && inputs[i].value !== src.value) {
            inputs[i].value = src.value;
            return;
        }
    }
}

// --- Setting packs -------------------------------------------------------
// Suggestions are grouped into coherent settings (Medieval Europe, the Norse
// Coast, …) so a rolled vampire doesn't mix a Yoruba sire with an English
// thatcher. The first helper used in a wizard session LOCKS a pack, and every
// later chip draws from it, so hand-built vampires stay coherent too.
var activePack = null;

function activeSettingPack() {
    if (typeof settingPacks === 'undefined' || !settingPacks.length) return null;
    if (!activePack) {
        activePack = settingPacks[Math.floor(Math.random() * settingPacks.length)];
    }
    return activePack;
}

function resetSettingPack() { activePack = null; }

// Pool entries are either tagged objects ({ text, short, name }) or plain
// strings; the wizard fields always want the display text.
function traitText(entry) {
    if (!entry) return '';
    return typeof entry === 'object' ? (entry.text || '') : String(entry);
}

// Wizard fields hold plain text, so a trait taken from a pool loses its grammar
// metadata on the way back out. Look the text up in the active pack to recover
// the tagged entry (and its hand-authored `short`/`name` forms); anything the
// player typed themselves falls through as a plain string, which
// TYOV.traitForms handles heuristically.
function packEntryFor(text, kind) {
    var pack = activePack;
    if (!pack || !kind || !pack[kind]) return text;
    var t = String(text).trim();
    for (var i = 0; i < pack[kind].length; i++) {
        var e = pack[kind][i];
        if (traitText(e).trim() === t) return e;
    }
    return text;
}

// Sentence-starter suggestions for the Memory steps: a template from
// `memoryTemplates[kind]` with the player's own traits substituted in
// (TYOV.fillTemplate), so the chip inserts usable prose rather than one word.
// `themeFieldId` (optional) additionally offers a Memory Theme chip.
function templateInto(kind, containerId, fieldIds, themeFieldId) {
    var target = el(containerId);
    if (!target || typeof memoryTemplates === 'undefined') return;
    var traits = currentSetupTraits();
    var picks = TYOV.pickSuggestions(memoryTemplates[kind], 2).map(function (t) {
        return TYOV.fillTemplate(t, traits);
    });
    var chips = picks.map(function (s) { return chipHtml(s, fieldIds); }).join(' ');
    if (themeFieldId) {
        var theme = TYOV.pickSuggestions(memoryTemplates.themes, 1)[0];
        if (theme) chips += ' ' + chipHtml(theme, themeFieldId, 'Theme: ' + escapeHtml(theme));
    }
    target.innerHTML = chipRowHtml('Try:', chips, containerId);
}

// The traits the player has entered so far in the wizard, for template
// substitution. Falls back to saved state once the game is under way.
// The traits the player has entered so far, for template substitution. The
// sire is kept OUT of `characters` — it belongs only to the turning Memory,
// never to the mortal-life ones — and is exposed as its own `sire` list.
function currentSetupTraits(includeSire) {
    function vals(ids, kind) {
        return ids.map(function (i) { return val(i); })
            .filter(function (v) { return v.trim(); })
            .map(function (v) { return packEntryFor(v, kind); });
    }
    var t = {
        skills: vals(['setupSkill1', 'setupSkill2', 'setupSkill3'], 'skills'),
        resources: vals(['setupRes1', 'setupRes2', 'setupRes3'], 'resources'),
        characters: vals(['setupChar1', 'setupChar2', 'setupChar3'], 'characters'),
        sire: includeSire ? vals(['setupSire'], 'characters') : []
    };
    if (!t.skills.length && state.skills) {
        t.skills = state.skills.map(function (s) { return s.text; });
        t.resources = state.resources.map(function (r) { return r.text; });
        t.characters = state.characters.filter(function (c) { return c.type !== 'Immortal'; })
            .map(function (c) { return c.text; });
        if (includeSire) {
            t.sire = state.characters.filter(function (c) { return c.type === 'Immortal'; })
                .map(function (c) { return c.text; });
        }
    }
    return t;
}

function chipHtml(text, fieldIds, labelHtml) {
    return '<button type="button" class="spark-word spark-tap" onclick="applySuggestion(this, \'' +
        escapeHtml(fieldIds) + '\')" data-text="' + escapeHtml(text) + '">' +
        (labelHtml || escapeHtml(text)) + '</button>';
}

// Chip rows carry a ✕ so a suggestion set can be dismissed once it's served its
// purpose (tapping 🎲 again simply re-rolls the row in place).
function chipRowHtml(label, chips, containerId) {
    return '<span class="spark-label">' + label + '</span> ' + chips +
        '<button type="button" class="spark-dismiss" aria-label="Dismiss suggestions" onclick="dismissChips(\'' +
        containerId + '\')">×</button>';
}

function dismissChips(containerId) {
    var c = el(containerId);
    if (c) c.innerHTML = '';
}

// "Surprise me" — roll a whole vampire from ONE setting pack, then jump to the
// last step so the player reviews (and edits) before Begin. Only fills blanks,
// so a partly-written wizard keeps what you already wrote.
//
// Coherence rules baked in here:
//   - every trait comes from the same pack (no era/culture mixing)
//   - the sire is drawn from the pack too, and never appears in the four
//     mortal-life Memories — only in the turning Memory
//   - the three combining Memories use DISTINCT templates and spread across
//     the traits instead of naming the same resource three times
//   - Memory themes are drawn from the theme group for that step
function surpriseMe() {
    var pack = activeSettingPack();
    if (!pack || typeof memoryTemplates === 'undefined') return;

    function fill(id, text) {
        var f = el(id);
        if (f && !f.value.trim() && text) {
            f.value = text;
            f.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    function fillSet(ids, pool) {
        var picks = TYOV.pickSuggestions(pool, ids.length);
        ids.forEach(function (id, i) { fill(id, traitText(picks[i])); });
    }

    fill('setupName', traitText(TYOV.pickSuggestions(pack.names, 1)[0]));
    fillSet(['setupSkill1', 'setupSkill2', 'setupSkill3'], pack.skills);
    fillSet(['setupRes1', 'setupRes2', 'setupRes3'], pack.resources);
    fillSet(['setupChar1', 'setupChar2', 'setupChar3'], pack.characters);
    // Draw the sire from the same pack, and make sure it isn't the player's
    // own mortal name.
    var sireName = TYOV.pickSuggestions(pack.names, 2)
        .map(traitText)
        .filter(function (n) { return n !== val('setupName'); })[0];
    fill('setupSire', sireName + ', an ancient immortal');
    fill('setupMark', traitText(TYOV.pickSuggestions(pack.marks, 1)[0]));

    // Memories are written after the traits exist, so the templates name them.
    var mortalTraits = currentSetupTraits(false);
    var turningTraits = currentSetupTraits(true);
    var lifeTheme = TYOV.pickSuggestions(memoryTemplates.themes.life, 1)[0];
    var comboThemes = TYOV.pickSuggestions(memoryTemplates.themes.combine, 3);
    var turnTheme = TYOV.pickSuggestions(memoryTemplates.themes.turning, 1)[0];
    var combos = TYOV.pickSuggestions(memoryTemplates.combine, 3);

    fill('setupMemTheme1', lifeTheme);
    fill('setupMemTheme2', comboThemes[0]);
    fill('setupMemTheme3', comboThemes[1]);
    fill('setupMemTheme4', comboThemes[2]);
    fill('setupMemTheme5', turnTheme);

    // `first` makes fillTemplate take the head of each list, so rotating the
    // lists below is what actually spreads the Memories across the traits.
    var first = function () { return 0; };
    fill('setupMemExp1', TYOV.fillTemplate(
        TYOV.pickSuggestions(memoryTemplates.life, 1)[0], mortalTraits, first));
    // Rotate the trait lists between the combining Memories so each one leans
    // on different Skills/Resources/Characters.
    [combos[0], combos[1], combos[2]].forEach(function (tpl, i) {
        fill('setupMemExp' + (i + 2),
            TYOV.fillTemplate(tpl, rotateTraits(mortalTraits, i + 1), first));
    });
    fill('setupMemExp5', TYOV.fillTemplate(
        TYOV.pickSuggestions(memoryTemplates.turning, 1)[0],
        rotateTraits(turningTraits, 1), first));

    gotoStep(8, true);
    toast('Rolled a vampire from ' + pack.label + ' — review and edit, then Begin.', 'info');
}

// Rotate each trait list by `n` so successive Memories draw different traits
// from the same small pools.
function rotateTraits(traits, n) {
    function rot(list) {
        if (!list || list.length < 2) return list || [];
        var k = n % list.length;
        return list.slice(k).concat(list.slice(0, k));
    }
    return {
        skills: rot(traits.skills),
        resources: rot(traits.resources),
        characters: rot(traits.characters),
        sire: traits.sire
    };
}

// Insert a tapped suggestion into the first empty field of the step (falling
// back to the last-focused one, then the last field), then fire `input` so the
// wizard's autosave/validation see it.
function applySuggestion(btn, fieldIds) {
    var text = btn.getAttribute('data-text') || '';
    var ids = fieldIds.split(',');
    var fields = ids.map(function (i) { return el(i.trim()); }).filter(Boolean);
    if (!fields.length) return;
    var target = null;
    for (var i = 0; i < fields.length; i++) {
        if (!fields[i].value.trim()) { target = fields[i]; break; }
    }
    if (!target && lastActiveField && fields.indexOf(lastActiveField) !== -1) target = lastActiveField;
    if (!target) target = fields[fields.length - 1];
    if (target.tagName === 'TEXTAREA' && target.value.trim()) {
        insertAtCaret(target, text);
    } else {
        target.value = text;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.focus();
    }
}

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

// Remember the last text field focused (outside the oracle panel) so the
// Meaning Oracle can insert back into it after its button takes focus.
document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (isInsertableField(t) && !(t.closest && t.closest('#oraclePanel'))) {
        lastActiveField = t;
    }
});

// Close the guided trait picker when clicking anywhere outside it (except its
// own trigger buttons, whose own handlers toggle it).
document.addEventListener('click', function (e) {
    if (!openTraitPicker) return;
    var t = e.target;
    // A row that re-rendered the popover (e.g. switching Memory-ops modes) is
    // already detached by the time this runs — that is not an outside click.
    if (!t.isConnected) return;
    if (openTraitPicker.contains(t)) return;
    if (t.closest && t.closest('#btnCheckSkill, #btnLoseResource, #btnKillCharacter, #btnFileExperience, #btnMemoryOps')) return;
    closeTraitPicker();
});

// --- Modal a11y: focus trap + Esc (B10) ---
function focusablesIn(container) {
    return Array.prototype.slice.call(container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
        'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (x) { return x.offsetParent !== null; });
}
// The currently-open overlay whose focus should be trapped, or null.
function openModalEl() {
    var am = el('appModal'); if (am && am.classList.contains('show')) return am;
    var sw = el('setupWizard'); if (sw && sw.style.display === 'flex') return sw;
    return null;
}

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        // Esc dismisses dismissable overlays (not the required setup wizard).
        if (openTraitPicker) { closeTraitPicker(); return; }
        if (isAppModalOpen()) { closeAppModal(); return; }
        var op = el('oraclePanel');
        if (op && op.classList.contains('show')) toggleOracle();
        return;
    }
    if (e.key === 'Tab') {
        var modal = openModalEl();
        if (!modal) return;
        var f = focusablesIn(modal);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1], a = document.activeElement;
        if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
        else if (f.indexOf(a) === -1) { e.preventDefault(); first.focus(); }
    }
});

window.addEventListener('load', function () {
    loadGame();
    initServiceWorker();
});
