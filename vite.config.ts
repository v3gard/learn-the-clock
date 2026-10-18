import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/learn-the-clock/',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.ts',
      injectRegister: false,
      registerType: 'prompt',
      scope: '/learn-the-clock/',
      includeManifestIcons: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,webmanifest,svg,png}'],
        manifestTransforms: [async entries => ({
          manifest: await Promise.all(entries.map(async entry => ({
            ...entry,
            integrity: `sha256-${createHash('sha256').update(await readFile(resolve('dist', entry.url))).digest('base64')}`,
          }))),
          warnings: [],
        })],
      },
      manifest: {
        id: '/learn-the-clock/',
        name: 'Learn the Clock',
        short_name: 'Learn the Clock',
        description: 'Explore the clock and practice telling the time.',
        lang: 'en',
        start_url: '/learn-the-clock/',
        scope: '/learn-the-clock/',
        display: 'standalone',
        theme_color: '#f7f2e6',
        background_color: '#f7f2e6',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
