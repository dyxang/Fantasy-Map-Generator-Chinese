# Tauri desktop shell (lightweight native packaging)

This directory is the Tauri v2 shell that wraps the existing Vite-built
`dist/` as a native desktop application. It exists in parallel with the
Web deployment paths (GitHub Pages / Netlify / Vercel / Docker nginx) —
none of the application code in `src/` or `public/` was modified to
support this shell except for a handful of conditional tweaks (see
`/workspace/.trae/documents/pack-fmg-as-lightweight-desktop-and-fix-cors.md`).

## Why Tauri

- ~3–10 MB binary (reuses the system WebView, no Chromium bundled)
- Native `tauri://localhost` protocol with HTTP semantics, so the same
  `XMLHttpRequest` / `fetch` calls that fail under `file://` keep working
- Asset protocol (`assetProtocol`) enabled for any `convertFileSrc` need
- Cross-platform: Linux (.deb / AppImage), Windows (.msi), macOS (.dmg)

## Prerequisites

- Node.js 24+ (matches `engines` in `package.json`)
- Rust 1.77+ (`rustup install stable`)
- Platform WebView deps:
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libayatana-appindicator3-dev`
  - **Windows**: WebView2 Runtime (preinstalled on Win10 21H2+ / Win11)
  - **macOS**: built-in

## Develop

```bash
npm install
npm run dev:desktop
```

This runs `tauri dev`, which spawns Vite on `localhost:1420` and opens
the native window pointing at it. Hot-reload works for `src/` changes.

## Build a release

```bash
npm run build:desktop
```

Output goes to `src-tauri/target/release/bundle/`:
- `deb/` — Debian / Ubuntu installer
- `appimage/` — portable Linux binary
- `msi/` — Windows installer
- `dmg/` — macOS disk image

## CORS solution recap

The shell relies on three layered fixes; no application code knows about Tauri:

1. `tauri://localhost` protocol (built-in) — same-origin HTTP semantics,
   so `getBase64()` (`XHR`), `fetch('./charges/...')`, `loadScript('libs/...')`
   keep working exactly as on the web.
2. `assetProtocol` (`tauri.conf.json`) — opens the local filesystem
   through an HTTP-like URL when the app needs to read arbitrary user
   files (drag-drop already uses `FileReader` so this is future-proofing).
3. `public/main.js` skips Service Worker registration under the
   `tauri:` protocol (Tauri WebView has limited SW support on custom
   protocols). Web deployments still register the simplified
   workbox-free `public/sw.js` for offline caching.

External CDN dependencies (Google Fonts, analytics, workbox) are
disabled in the desktop build via the `IS_TAURI` flag set early in
`src/index.html`. The app remains fully usable offline.
