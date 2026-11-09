# Clip Choice — working notes

Behavior spec: the Claude artifact prototype "Clip Choice" plus the build handoff. Sister apps:
SOAP (soap.harmonic-systems.org) and Transcribe; same conventions.

## Hard constraints
- No network calls except YouTube (IFrame API, nocookie player, i.ytimg thumbnails). No CDN fonts,
  no analytics. Uploaded tile pictures are stored as shrunk data URLs, never fetched by URL.
- Student codes only (≤5 A–Z/0–9). No name fields anywhere.
- Keyboard-only must always work. Screens read keys at window level; the YouTube iframe is
  `pointer-events: none` + `tabIndex=-1` so focus can't get trapped.
- Never show YouTube end screens: the player is destroyed on ENDED *or* when currentTime ≥ end.
- Bundle ≤ 120 KB gzipped JS (scripts/check-bundle-size.mjs gates the build).

## Files
- `src/lib/config.js` — defaults, normalizeConfig, parseCode (gate codes), parseWords, parseTime,
  clipWindow, youtubeId.
- `src/lib/stats.js` — event builders (flags copied at log time; the private letter is never
  stored), computeStats, **noteText (all note wording lives here)**, toCSV, historyRow.
- `src/lib/db.js` — Dexie: `configs` (&student), `sessions` (&id; open = `ended:null`),
  `history` (&sessionId). Every event is appended immediately. Export/import JSON.
  `prefs` = localStorage, UI conveniences only.
- `src/lib/youtube.js` — API loader with timeout + playClip (calls onEnd/onError exactly once).
- `src/lib/gridnav.js` — arrow movement by tile position (any column count).
- Components: App (state + loop), Menu, Gate, Player (also Setup's Test clip), Talk, Setup, Data.

## Open questions (after the trial week)
1. Should `E` (immediate echo) play the clip? Per-code "Plays clip" toggle, default on.
2. MLU in words or morphemes? Currently words.
3. Spoken labels on tiles? Currently no audio.
4. Word cards every clip? Setup → "Word cards after a clip": every / every other / off.
5. Does "defined" need its own score beyond Y?
6. Which device at Astor?
