# Clip Choice

A keyboard-driven menu of short video clips that a student uses as reinforcement. The
clinician's unlock step doubles as data collection. One static page, configurable per student,
with no accounts and no server.

**Live at:** https://clips.harmonic-systems.org (once DNS + Pages are set up)

## How it works

1. **Menu.** Clip tiles. Arrow keys move the yellow focus ring and Enter picks a clip.
2. **Gate ("Ask for it!").** The student makes a verbal request. The clinician types a 3-key code:
   response letter + cue digit (0–4) + private letter, e.g. `A2K`. An invalid code shakes and
   logs nothing. A valid code is logged and, if that response plays the clip, unlocks it.
   Esc returns to the menu.
3. **Player.** YouTube (nocookie) plays from start to end, then is torn down so no
   recommendations ever show. Space ends early.
4. **Word cards.** Y / P / X score the focused word and 1–9 log an utterance length. "Again"
   returns to the gate; "New video" returns to the menu.

**Student view** hides the app bar and all clinician text. Shift + private letter exits it.

## Data

- Everything lives in this browser (IndexedDB, keyed by student code). Nothing leaves the device
  except YouTube video requests. No analytics.
- Student codes only, ≤5 letters/digits, never names.
- Every key press is written straight away, so reloading mid-session loses nothing.
- Setup → Files: export all data as JSON (also used for import/restore) or one student as CSV.
- Data & note: live stats, the draft note (copy → SOAP), the event log with Remove for
  mis-keys, and End & save session (adds a row to history for next time's comparison).

## Local development

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # vitest: code parsing, stats, note wording, CSV, storage
npm run build   # production build + gzip bundle-size gate (120 KB JS)
npm run icons   # regenerate public/icon-*.png
```

Svelte 5 + Vite, Dexie (IndexedDB), vite-plugin-pwa, self-hosted Atkinson Hyperlegible.

## Deployment

Same as SOAP: pushing to `main` runs `.github/workflows/deploy.yml` (test → build → GitHub
Pages). One-time setup: repo Settings → Pages → Source: GitHub Actions, then set the custom
domain to `clips.harmonic-systems.org` (`public/CNAME` already ships) and add DNS
`CNAME clips → harmonicsystems.github.io`.
