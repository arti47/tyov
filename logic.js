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

    var api = {
        escapeHtml: escapeHtml,
        getTier: getTier,
        getPromptText: getPromptText,
        parseMarkdown: parseMarkdown,
        rollDice: rollDice,
        resolveTraitAction: resolveTraitAction
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api; // Node (tests)
    }
    root.TYOV = api; // Browser
})(typeof window !== 'undefined' ? window : globalThis);
