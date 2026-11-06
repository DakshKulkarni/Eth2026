import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const backend = (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.VITE_BACKEND ?? 'http://127.0.0.1:8799';
const proxied = ['/api', '^/live/', '^/checkin/', '/credential', '/machine', '/health', '/worker', '/session', '/tts'];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(proxied.map((p) => [p, { target: backend, changeOrigin: true }])),
  },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
});
