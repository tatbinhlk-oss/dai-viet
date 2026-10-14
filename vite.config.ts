import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// base: GitHub Pages phục vụ tại /dai-viet/ ; dev server tại /
const base = process.env.GITHUB_PAGES ? '/dai-viet/' : '/';

export default defineConfig({
  base,
  worker: { format: 'es' },
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
  plugins: [
    // M6c: PWA — manifest + service worker (workbox) cache mọi file build và spritesheet để chơi offline; tự cập nhật khi có bản mới
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'sheets/*.png', 'sheets/*.json'],
      manifest: {
        name: 'Đại Việt — city builder',
        short_name: 'Đại Việt',
        description: 'Game xây thành phố kiểu Caesar 3, bối cảnh Đại Việt: ruộng lúa, đê điều, mùa lũ, triều đình.',
        lang: 'vi',
        start_url: base,
        scope: base,
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#141210',
        theme_color: '#141210',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,json,woff2,ogg,mp3}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: null,
      },
    }),
  ],
});
