import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    allowedHosts: ['.trycloudflare.com'],
    port: 5173,
    strictPort: true,
  },
});
