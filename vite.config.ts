import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Same-origin proxy for the MyAnimeList API. api.myanimelist.net sends no
 * CORS headers (preflight → 405), so the browser calls `/mal-api/v2/...`
 * here instead; the official origin has no knowledge of the origin — the
 * client still authenticates with X-MAL-CLIENT-ID, forwarded unchanged.
 * Node scripts (probe/smoke) bypass this and call the origin directly.
 */
const malProxy: Record<string, ProxyOptions> = {
  '/mal-api': {
    target: 'https://api.myanimelist.net',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/mal-api/, ''),
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: malProxy },
  preview: { proxy: malProxy },
});
