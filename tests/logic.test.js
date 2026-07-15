'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
    escapeHtml, getTier, getPromptText, parseMarkdown, rollDice, resolveTraitAction
} = require('../logic.js');

test('escapeHtml neutralises HTML metacharacters', () => {
    assert.strictEqual(
        escapeHtml('<img src=x onerror="alert(1)">'),
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
    assert.strictEqual(escapeHtml(`a & b ' c`), 'a &amp; b &#39; c');
    assert.strictEqual(escapeHtml(null), '');
    assert.strictEqual(escapeHtml(undefined), '');
});

test('getTier maps visit count to a/b/c', () => {
    assert.strictEqual(getTier(1), 'a');
    assert.strictEqual(getTier(2), 'b');
    assert.strictEqual(getTier(3), 'c');
    assert.strictEqual(getTier(4), 'c');
    assert.strictEqual(getTier(0), 'a');
});

test('getPromptText resolves tiers and edge cases', () => {
    const db = { 5: { a: 'first', b: 'second', c: 'third' } };
    assert.strictEqual(getPromptText(db, 5, 1), 'first');
    assert.strictEqual(getPromptText(db, 5, 2), 'second');
    assert.strictEqual(getPromptText(db, 5, 3), 'third');
    assert.match(getPromptText(db, 5, 4), /completed all entries/);
    assert.match(getPromptText(db, 99, 1), /not found/);
});

test('parseMarkdown escapes before formatting (no XSS)', () => {
    assert.strictEqual(parseMarkdown('**bold** *italic*'), '<b>bold</b> <i>italic</i>');
    assert.strictEqual(parseMarkdown('<script>'), '&lt;script&gt;');
    assert.strictEqual(parseMarkdown('a\nb'), 'a<br>b');
    assert.strictEqual(parseMarkdown(''), '');
});

test('rollDice is deterministic with an injected RNG (standard)', () => {
    // d10_1 then d6.  0.95 -> 10,  0.0 -> 1.
    const seq = [0.95, 0.0];
    let i = 0;
    const rng = () => seq[i++];
    const r = rollDice({}, rng);
    assert.strictEqual(r.d10_1, 10);
    assert.strictEqual(r.d6, 1);
    assert.strictEqual(r.diff, 9); // d10 - d6
    assert.strictEqual(r.multi, false);
});

test('rollDice reverse-time subtracts the other way', () => {
    const seq = [0.95, 0.0]; // d10_1=10, d6=1
    let i = 0;
    const r = rollDice({ reverse: true }, () => seq[i++]);
    assert.strictEqual(r.diff, -9); // d6 - d10
    assert.strictEqual(r.reverse, true);
});

test('rollDice multiplayer rolls two d10s', () => {
    const seq = [0.0, 0.0, 0.0]; // d10_1=1, d10_2=1, d6=1
    let i = 0;
    const r = rollDice({ multi: true }, () => seq[i++]);
    assert.strictEqual(r.d10_1, 1);
    assert.strictEqual(r.d10_2, 1);
    assert.strictEqual(r.d6, 1);
    assert.strictEqual(r.diff, 1); // (1+1) - 1
});

test('rollDice stays within die bounds across many rolls', () => {
    for (let n = 0; n < 1000; n++) {
        const r = rollDice({ multi: true });
        assert.ok(r.d10_1 >= 1 && r.d10_1 <= 10);
        assert.ok(r.d10_2 >= 1 && r.d10_2 <= 10);
        assert.ok(r.d6 >= 1 && r.d6 <= 6);
    }
});

test('resolveTraitAction: check a Skill uses the substitution ladder', () => {
    assert.strictEqual(resolveTraitAction('check', 2, 3).result, 'check');
    assert.strictEqual(resolveTraitAction('check', 0, 3).result, 'substitute-lose');
    assert.strictEqual(resolveTraitAction('check', 0, 0).result, 'gameover');
});

test('resolveTraitAction: lose a Resource uses the substitution ladder', () => {
    assert.strictEqual(resolveTraitAction('lose', 2, 3).result, 'lose');
    assert.strictEqual(resolveTraitAction('lose', 2, 0).result, 'substitute-check');
    assert.strictEqual(resolveTraitAction('lose', 0, 0).result, 'gameover');
});

test('resolveTraitAction: missing/zero counts default to game over', () => {
    assert.strictEqual(resolveTraitAction('check').result, 'gameover');
    assert.strictEqual(resolveTraitAction('lose').result, 'gameover');
    // Every branch carries a human-readable message.
    ['check', 'lose'].forEach((a) => {
        assert.ok(resolveTraitAction(a, 1, 1).message.length > 0);
    });
});
