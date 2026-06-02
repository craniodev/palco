# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Cifra de Palco** — a single-page, offline-first PWA for reading chord charts (cifras) live on stage. Portuguese (pt-BR) UI. No build step, no dependencies, no framework. The entire app is `index.html` (HTML + CSS + vanilla JS inline). Supporting files: `sw.js` (service worker), `manifest.webmanifest`, PNG icons, and `repertorio.md` (the author's own setlist data, served via GitHub raw link — not app code).

## Running / developing

No build, no tests, no lint. Serve the folder over HTTP (service worker + `fetch` need a real origin, not `file://`):

```powershell
python -m http.server 8000   # then open http://localhost:8000
```

Edit `index.html` directly and reload. When changing `sw.js` or cached assets, bump the `CACHE` constant (`cifra-v1` → `cifra-v2`) in `sw.js:5` or the old cache won't be evicted and you'll test stale assets. Hard-reload / "Update on reload" in DevTools to dodge the service worker during dev.

## Architecture

Everything lives in the `<script>` at the bottom of `index.html`, organized in labeled sections. Data flows one direction:

```
raw markdown text → splitUnits() → state.songs[] → parseBody()/expand() → blocks[] → appendBlocks() → DOM
```

- **State** — a single `state` object; user prefs (transpose, font size, speed, theme, url) persist via the `LS` localStorage wrapper under `cifra.*` keys. `state.raw` holds the current chart text (cached for offline).
- **Chord engine** — `isChord`, `transposeChord`, `splitStrum`. Notes map through `SHARP`/`FLAT_IDX`; transposition is semitone integer math, output always normalized to sharps. Strum arrows (`↓↑`) are split off the chord token and preserved across transpose.
- **Parsing** is two layers:
  1. `splitUnits()` — splits the file into **setlist units**. `---` (or `***`) separates songs; `+++` glues songs into one **pot-pourri** unit (`parts[]`) played as a single item. Legacy fallback: no separators → each `# H1` is its own song.
  2. `expand()` / `parseBody()` — turns one song body into typed `blocks[]` (`title`, `section`, `line`, `instr`, `bars`, `annot`, `medley`, `blank`). This is where the markup dialect is interpreted (see below).
- **Rendering** — `appendBlocks()` dispatches per block type to `renderSegs` / `renderBars` / `medleyDivider`. `render()` rebuilds `#chart` wholesale on every change (transpose, font, song switch). Transpose is applied at render time, not parse time, so `state.transpose` + per-block `tr` offset compose.
- **Auto-scroll** — `requestAnimationFrame` loop in `step()`, pixels/sec driven by `state.speed`, holds a screen `wakeLock` while playing.
- **Sync** — `syncFromUrl()` pulls the chart from a GitHub/Gist link. `toRawUrl()` rewrites a `blob/` page URL to `raw.githubusercontent.com`; `fetchViaApi()` prefers the GitHub **API** (`api.github.com/repos/.../contents`) to bypass raw's ~5-min CDN cache and get the newest commit, falling back to the raw URL. Result is cached in `localStorage`, so the app opens instantly offline and refreshes when online.
- **Service worker** (`sw.js`) — caches the app shell + Google Fonts. Navigations are network-first (pick up updates), assets cache-first. The repertoire raw URL is deliberately *not* cached by the SW — the page owns that via localStorage.

## The cifra markup dialect

This is the core domain logic; the editor hint in `index.html` (~line 360) documents it for users. When touching the parser, keep these forms working:

- **Chords**: ChordPro inline `[C]lyric`, or a bare chord line directly above a lyric line (Cifra Club style). A bare chord line with no lyric below → instrumental line.
- **Sections**: `## Nome`, or a non-chord `[Refrão]` bracket, or a known keyword (`SECTION_WORDS` regex: intro, verso, refrão, ponte, solo…).
- **Bars/measures**: `|Dm |% |C |% |`. `%` repeats the previous measure; `|: … :|` repeat marks; trailing `2x`/`x2` repeat count; `/` or `.` are beat marks.
- **Strum/levada**: arrows glued to a chord, e.g. `C↓↓` (`STRUM_RE`).
- **Annotation/cue**: `* texto` → italic note.
- **Pot-pourri include** (medley reference): `@incluir Título > Seção +2` or `{incluir: Título}` — pulls another song (optionally one section, optionally transposed) inline. `findSong` matches by accent-/case-normalized title; recursion is guarded by `visited` set + depth ≤ 6 to prevent cycles.

## Conventions

- pt-BR for all user-facing strings.
- Keep it dependency-free and single-file; don't introduce a build step or framework.
- Chord/section detection is regex-driven and ambiguity-prone (a bracket can be a chord *or* a section label) — when editing detection, test against `repertorio.md` and the `DEMO` constant, which exercise inline chords, bar grids, pot-pourris (`+++`), and includes.
