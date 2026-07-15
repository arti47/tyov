'use strict';

// Flat ESLint config (ESLint v9+). Run with `npm run lint` (requires `npm install`).
const browserGlobals = {
    window: 'readonly',
    document: 'readonly',
    navigator: 'readonly',
    localStorage: 'readonly',
    getComputedStyle: 'readonly',
    alert: 'readonly',
    confirm: 'readonly',
    location: 'readonly',
    FileReader: 'readonly',
    Blob: 'readonly',
    URL: 'readonly',
    DOMParser: 'readonly',
    Event: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    console: 'readonly',
    module: 'writable',
    globalThis: 'readonly',
    promptDB: 'readonly',
    meaningTable: 'readonly',
    TYOV: 'readonly'
};

module.exports = [
    {
        files: ['logic.js', 'app.js', 'sw.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: Object.assign({ self: 'readonly', caches: 'readonly', fetch: 'readonly' }, browserGlobals)
        },
        rules: {
            // App functions are invoked from inline HTML handlers, so they read
            // as "unused" to a static linter. Disable that check rather than
            // litter the source with eslint-disable comments.
            'no-unused-vars': 'off',
            'no-undef': 'error'
        }
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { require: 'readonly', module: 'writable', __dirname: 'readonly' }
        }
    }
];
