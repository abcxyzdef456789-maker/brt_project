import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The `base` value is resolved at build time:
//  - '/'                 → Vercel / Netlify / custom domain (default)
//  - '/brt/' or similar  → GitHub Pages project site (repo name)
// The repo name for GitHub Pages is read from the GITHUB_REPO env var if set.
const repo = process.env.GITHUB_REPO || '';
const base = repo ? `/${repo}/` : '/';

export default defineConfig({
  plugins: [react()],
  base,
  server: {
      host: '0.0.0.0',
      allowedHosts: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
});
