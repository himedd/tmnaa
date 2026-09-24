import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

const port = Number(process.env.PORT) || 5173;

// Backend API server (api-server) that hosts the SSE follower-count stream
// and the 300K Edits Wall API.
const apiServerUrl = process.env.FOLLOWER_API_URL || 'http://localhost:7000';

const followerCountProxy = {
  target: apiServerUrl,
  changeOrigin: true,
};

// Catch-all backend proxy for the 300K Edits Wall API (uploads, wall, admin).
const wallApiProxy = {
  target: apiServerUrl,
  changeOrigin: true,
  proxyTimeout: 300000,
  timeout: 300000,
};

function kickProxyPlugin(): Plugin {
  return {
    name: 'kick-proxy',
    configureServer(server) {
      server.middlewares.use('/api/kick', async (req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const endpoint = url.searchParams.get('endpoint');
        if (!endpoint) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Endpoint is required' }));
          return;
        }
        try {
          const apiRes = await fetch(endpoint, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });
          if (!apiRes.ok) {
            res.writeHead(apiRes.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Kick API failed: ${apiRes.status}` }));
            return;
          }
          const data = await apiRes.json();
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
          });
          res.end(JSON.stringify(data));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/kick', async (req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const endpoint = url.searchParams.get('endpoint');
        if (!endpoint) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Endpoint is required' }));
          return;
        }
        try {
          const apiRes = await fetch(endpoint, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          const data = await apiRes.json();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

export default defineConfig({
  // Expose GROQ_API_KEY (in addition to VITE_*) to client code for the AI bot.
  envPrefix: ['VITE_', 'GROQ_'],
  plugins: [
    react(),
    tailwindcss(),
    kickProxyPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api/follower-count': followerCountProxy,
      '/api/wall': wallApiProxy,
      '/api/admin': wallApiProxy,
      '/api': wallApiProxy,
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api/follower-count': followerCountProxy,
      '/api/wall': wallApiProxy,
      '/api/admin': wallApiProxy,
      '/api': wallApiProxy,
    },
  },
});