import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const githubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  // Project Pages serves the site at /<repo>/, so production asset URLs need that prefix.
  base: githubPages ? '/lane-controller-lpu-simulation/' : '/',
  plugins: [react(), tailwindcss()],
  server: {host: '127.0.0.1', port: 3000},
});
