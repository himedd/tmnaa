import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

const port = Number(process.env.PORT) || 5173;
const apiServerUrl = process.env.FOLLOWER_API_URL || 'http://localhost:7000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port,
    strictPort: true,
    proxy: {},
  },
});