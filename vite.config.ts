import { defineConfig } from 'vite';

// base: GitHub Pages phục vụ tại /dai-viet/ ; dev server tại /
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/dai-viet/' : '/',
  worker: { format: 'es' },
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
