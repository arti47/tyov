# Vampire Chronicle

A browser-based companion for the solo journaling RPG **Thousand Year Old
Vampire** by Tim Hutchings. It rolls the dice, walks you through the numbered
prompt book, and tracks your vampire's Memories, Skills, Resources, Characters,
and Marks — with autosave, multi-level undo, backup/restore, and a chronicle
export. It's a dependency-free, offline-capable Progressive Web App; all state
lives in your browser's `localStorage` (no accounts, no servers).

> This is an unofficial companion tool. *Thousand Year Old Vampire* is
> © Tim Hutchings / Petit Guignol LLC. You need the game to play.

## Play it

Hosted on GitHub Pages: **https://arti47.github.io/tyov/**

(Enable once under **Settings → Pages → Source: "GitHub Actions"**; the
`Deploy to GitHub Pages` workflow publishes on every push to `main`.)

## Install on your phone (Add to Home Screen)

- **Android / Chrome:** open the site, then use the browser menu → *Install app*
  / *Add to Home screen*.
- **iOS / Safari:** open the site, tap **Share** → **Add to Home Screen**.

It launches full-screen like a native app and works offline after the first
load. When a new version is deployed, a **"new version available — Update now"**
banner appears; tap it to refresh onto the latest code.

## Run locally

Serve over HTTP (the service worker needs an HTTP origin):

```bash
npm run serve   # python3 -m http.server 8000  → http://localhost:8000/
npm test        # run the logic unit tests (node --test)
npm run lint    # ESLint (needs `npm install` first)
```

## For contributors

See [`CLAUDE.md`](./CLAUDE.md) for the architecture, state model, save format,
the rules-fidelity Roadmap, and the maintenance rules (keep `CLAUDE.md` current,
bump the service-worker `CACHE_NAME` on asset changes, and merge `main`).
