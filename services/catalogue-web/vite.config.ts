import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = process.env['CATALOGUE_API_PORT'] ?? '3001';
if (!/^[1-9]\d{0,4}$/.test(apiPort) || Number(apiPort) > 65535) throw new Error('Invalid local API port');

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false } },
  },
});
