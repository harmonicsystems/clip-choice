import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base so the same build works at the custom domain root
// (clips.harmonic-systems.org) and at the GitHub Pages subfolder (/clip-choice/).
export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      // 'prompt': never auto-reload — a live session must not be interrupted.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'CNAME'],
      manifest: {
        name: 'Clip Choice',
        short_name: 'Clip Choice',
        description: 'Keyboard-driven video clip menu for speech-language sessions. All data stays on this device.',
        display: 'standalone',
        start_url: './',
        scope: './',
        theme_color: '#2f5677',
        background_color: '#f4f2ec',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html'
      }
    })
  ],
  build: { target: 'es2020', sourcemap: false }
})
