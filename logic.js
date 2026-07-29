// logic.js
// Pure, framework-free helpers shared by the browser app and the Node tests.
// No DOM access here — keep this module testable in isolation.

(function (root) {
    'use strict';

    // Escape a string for safe interpolation into HTML (text or attribute).
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[&<>"']/g, function (c) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[c];
        });
    }

    // Which prompt tier (a/b/c) corresponds to the Nth visit to a prompt.
    function getTier(visits) {
        if (visits <= 1) return 'a';
        if (visits === 2) return 'b';
        return 'c';
    }

    // Resolve the narrative text for a prompt + visit count.
    function getPromptText(db, num, visits) {
        var entry = db && db[num];
        if (!entry) return 'Prompt text not found. Ensure data.js is loaded.';
        if (visits > 3) {
            return 'You have completed all entries (a, b, and c) for this prompt. ' +
                'Roll again or move forward.';
        }
        return entry[getTier(visits)] || 'No text for this tier.';
    }

    // Minimal, XSS-safe markdown: escapes first, then applies **bold**/*italic*/newlines.
    function parseMarkdown(text) {
        if (!text) return '';
        return escapeHtml(text)
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/\n/g, '<br>');
    }

    // Roll the TYOV dice. `rng` is injectable for deterministic tests.
    // opts: { reverse, multi }. Returns the dice and the net movement `diff`.
    function rollDice(opts, rng) {
        opts = opts || {};
        rng = rng || Math.random;
        var d10_1 = Math.floor(rng() * 10) + 1;
        var d10_2 = opts.multi ? Math.floor(rng() * 10) + 1 : 0;
        var d6 = Math.floor(rng() * 6) + 1;
        var totalD10 = d10_1 + d10_2;
        var diff = opts.reverse ? (d6 - totalD10) : (totalD10 - d6);
        return {
            diff: diff,
            d10_1: d10_1,
            d10_2: d10_2,
            d6: d6,
            multi: !!opts.multi,
            reverse: !!opts.reverse
        };
    }

    // Resolve a "check a Skill" / "lose a Resource" instruction against the
    // vampire's current stock, applying the rulebook substitution:
    //   - can't check a Skill  -> lose a Resource instead
    //   - can't lose a Resource -> check a Skill instead
    //   - can do neither        -> the game is over
    // `action` is 'check' (a Skill) or 'lose' (a Resource). Pure: takes counts,
    // returns { result, message } where result is one of
    //   'check' | 'lose' | 'substitute-lose' | 'substitute-check' | 'gameover'.
    function resolveTraitAction(action, uncheckedSkills, activeResources) {
        uncheckedSkills = uncheckedSkills || 0;
        activeResources = activeResources || 0;
        if (action === 'check') {
            if (uncheckedSkills > 0) {
                return { result: 'check', message: 'Check one of your Skills below.' };
            }
            if (activeResources > 0) {
                return {
                    result: 'substitute-lose',
                    message: 'No unchecked Skills — per the rules you lose a Resource instead. ' +
                             'Narrate the worst outcome.'
                };
            }
            return {
                result: 'gameover',
                message: 'You cannot check a Skill or lose a Resource. The game is over.'
            };
        }
        // action === 'lose' (a Resource)
        if (activeResources > 0) {
            return { result: 'lose', message: 'Lose one of your Resources below.' };
        }
        if (uncheckedSkills > 0) {
            return {
                result: 'substitute-check',
                message: 'No Resources to lose — per the rules you check a Skill instead. ' +
                         'Narrate the worst outcome.'
            };
        }
        return {
            result: 'gameover',
            message: 'You cannot lose a Resource or check a Skill. The game is over.'
        };
    }

    // Roll a d100 against a 100-entry meaning table (1-indexed by roll).
    // `rng` is injectable for deterministic tests. Returns { roll, word }.
    function rollMeaning(table, rng) {
        rng = rng || Math.random;
        var roll = Math.floor(rng() * 100) + 1;
        var word = (table && table[roll - 1]) || '';
        return { roll: roll, word: word };
    }

    // Pick `n` distinct random entries from a suggestion list (setup wizard
    // "stuck for ideas" helper). `rng` is injectable for deterministic tests.
    // Returns fewer than n only when the list itself is shorter.
    function pickSuggestions(list, n, rng) {
        rng = rng || Math.random;
        if (!list || !list.length) return [];
        var pool = list.slice();
        var out = [];
        var want = Math.min(n || 3, pool.length);
        while (out.length < want) {
            var i = Math.floor(rng() * pool.length);
            if (i >= pool.length) i = pool.length - 1;
            out.push(pool.splice(i, 1)[0]);
        }
        return out;
    }

    // Normalise a trait entry (tagged pool object OR a plain player-typed
    // string) to the forms templates need:
    //   full  — as shown in the trait lists ("Old Hallam, my master smith")
    //   short — mid-sentence form ("old Hallam" / "the hawk" / "beekeeping")
    //   name  — bare name for Characters ("Old Hallam")
    // Tagged entries supply `short`/`name`; plain strings fall back to
    // heuristics: drop an appositive after the first comma, and lower-case a
    // leading article so it reads inside a sentence.
    var LEADING_ARTICLE = /^(a|an|the|my|his|her|their|our)\s+/i;

    function traitForms(entry, kind) {
        if (entry === null || entry === undefined) return null;
        if (typeof entry === 'object') {
            var full = (entry.text || '').trim();
            if (!full) return null;
            return {
                full: full,
                short: (entry.short || deriveShort(full, kind)).trim(),
                name: (entry.name || deriveName(full)).trim()
            };
        }
        var t = String(entry).trim();
        if (!t) return null;
        return { full: t, short: deriveShort(t, kind), name: deriveName(t) };
    }

    // "Old Hallam, my master smith" -> "Old Hallam"
    function deriveName(text) {
        var cut = text.split(',')[0].trim();
        return cut || text;
    }

    // Make a trait readable mid-sentence. Characters keep their name; other
    // traits keep a leading article but lower-cased ("A hawk" -> "a hawk"),
    // and an un-articled trait is lower-cased unless it looks like a proper
    // noun (already capitalised beyond the first word, e.g. "Reading Latin").
    function deriveShort(text, kind) {
        if (kind === 'character') return deriveName(text);
        var t = text.trim();
        if (LEADING_ARTICLE.test(t)) {
            return t.charAt(0).toLowerCase() + t.slice(1);
        }
        var words = t.split(/\s+/);
        var hasInnerCaps = words.slice(1).some(function (w) { return /^[A-Z]/.test(w); });
        if (hasInnerCaps) return t.charAt(0).toLowerCase() + t.slice(1);
        return t.toLowerCase();
    }

    function capitalise(s) {
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    }

    // Substitute {skill}/{resource}/{character}/{sire} tokens in a Memory
    // sentence template with the player's own traits, so a tapped suggestion
    // reads as usable prose. Capitalised tokens ({Skill}) yield a
    // sentence-initial form; {character2} draws a SECOND, distinct Character.
    // Each token kind draws one trait for the whole template (so a sentence
    // naming {character} twice stays about one person). Empty trait lists fall
    // back to a neutral placeholder rather than leaving the token visible.
    var TEMPLATE_FALLBACKS = {
        skill: 'my old trade',
        resource: 'what little I owned',
        character: 'someone I loved',
        character2: 'another I knew',
        sire: 'the one who turned me'
    };

    var TOKEN_KIND = {
        skill: 'skills', resource: 'resources',
        character: 'characters', character2: 'characters', sire: 'sire'
    };

    function fillTemplate(template, traits, rng) {
        rng = rng || Math.random;
        if (!template) return '';
        traits = traits || {};

        function pool(kind) {
            var list = traits[TOKEN_KIND[kind]] || [];
            if (!Array.isArray(list)) list = [list];
            return list.map(function (e) {
                return traitForms(e, kind === 'character2' ? 'character' : kind);
            }).filter(Boolean);
        }

        var chosen = {};
        function pick(kind) {
            if (kind in chosen) return chosen[kind];
            var p = pool(kind);
            // {character} and {character2} must name different people. Guard
            // both ways: either token may appear first in the template.
            var other = kind === 'character2' ? chosen.character
                : (kind === 'character' ? chosen.character2 : null);
            if (other) {
                var distinct = p.filter(function (f) { return f.full !== other.full; });
                if (distinct.length) p = distinct;
            }
            chosen[kind] = p.length
                ? p[Math.min(Math.floor(rng() * p.length), p.length - 1)]
                : null;
            return chosen[kind];
        }

        return template.replace(/\{(skill|resource|character2|character|sire)\}/gi,
            function (match, raw) {
                var kind = raw.toLowerCase();
                var forms = pick(kind);
                var text = forms
                    ? (kind === 'character' || kind === 'character2' || kind === 'sire'
                        ? forms.name : forms.short)
                    : TEMPLATE_FALLBACKS[kind];
                return /^[A-Z]/.test(raw) ? capitalise(text) : text;
            });
    }

    // --- Save-state shape + validation (pure; shared with the app & tests) ----

    var SAVE_VERSION = 2;

    function genId() {
        return 'e' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
    }

    // A complete, empty v2 state.
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
            rollsSinceOldAge: 0,
            rollsSinceBackup: 0,
            gameOver: false,
            rollHistory: [],
            journalHistory: [],
            currentName: '',
            boxedExp: '',
            currentJournal: '',
            activeTab: 'play', // last-viewed tab (play|character|diary|journal)
            skills: [],      // { id, text, lost, checked }
            resources: [],   // { id, text, lost, isDiary? }
            characters: [],  // { id, text, type: 'Mortal'|'Immortal', doom, lost }
            marks: [],       // { id, text, lost }
            memories: [],    // { id, theme, experiences[], memState, lost }
            diary: [],       // same shape as memories
            settings: {},
            display: {
                promptResult: 'Awaiting First Roll...',
                rollDetails: '',
                promptText: 'Your prompt narrative will appear here.'
            }
        };
    }

    // Normalize a Memory/Diary entry: compact experiences (≥1, trailing empties
    // trimmed), and fill id/theme/memState/lost.
    function normMem(m) {
        m = m || {};
        var exps = Array.isArray(m.experiences) ? m.experiences.slice() : [];
        while (exps.length > 1 && exps[exps.length - 1] === '') exps.pop();
        if (exps.length === 0) exps.push('');
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

    var api = {
        escapeHtml: escapeHtml,
        getTier: getTier,
        getPromptText: getPromptText,
        parseMarkdown: parseMarkdown,
        rollDice: rollDice,
        resolveTraitAction: resolveTraitAction,
        rollMeaning: rollMeaning,
        pickSuggestions: pickSuggestions,
        fillTemplate: fillTemplate,
        traitForms: traitForms,
        genId: genId,
        defaultState: defaultState,
        normMem: normMem,
        normalizeState: normalizeState,
        SAVE_VERSION: SAVE_VERSION
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api; // Node (tests)
    }
    root.TYOV = api; // Browser
})(typeof window !== 'undefined' ? window : globalThis);
