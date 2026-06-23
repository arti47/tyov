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

    var api = {
        escapeHtml: escapeHtml,
        getTier: getTier,
        getPromptText: getPromptText,
        parseMarkdown: parseMarkdown,
        rollDice: rollDice
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api; // Node (tests)
    }
    root.TYOV = api; // Browser
})(typeof window !== 'undefined' ? window : globalThis);
