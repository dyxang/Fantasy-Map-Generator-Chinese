import { fileURLToPath, URL } from 'node:url';

// Tauri injects a few env vars when invoking beforeBuildCommand / beforeDevCommand.
// We treat any of them as a positive signal that we are building for the desktop shell.
const isTauri = [
    'TAURI',
    'TAURI_DEV',
    'TAURI_ENV_PLATFORM',
    'TAURI_ENV_TARGET_TRIPLE',
].some(key => {
    const value = process.env[key];
    return value === 'true' || value === '1' || (typeof value === 'string' && value.length > 0 && key !== 'TAURI');
});

// Tauri serves the built assets from a `tauri://localhost` origin, which
// expects relative URLs. For web deployments we keep the legacy base path
// (`/` on Netlify, `/Fantasy-Map-Generator/` everywhere else) so the
// existing GitHub Pages / Vercel / nginx setups continue to work.
const base = isTauri
    ? './'
    : process.env.NETLIFY
        ? '/'
        : '/Fantasy-Map-Generator/';

export default {
    root: './src',
    base,
    build: {
        outDir: '../dist',
        assetsDir: './',
        target: 'esnext',
    },
    publicDir: '../public',
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        port: 1420,
        strictPort: true,
    },
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_'],
}
