import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import socialHandler from './api/social.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'local-api-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith('/api/social')) {
              // ---- /api/social : نفس دالة الإنتاج (api/social.ts) بلا تكرار ----
              try {
                const base = `http://${req.headers.host || 'localhost'}`;
                const webRes = await socialHandler(new Request(new URL(req.url, base).toString(), { method: req.method || 'GET' }));
                res.statusCode = webRes.status;
                webRes.headers.forEach((value, key) => res.setHeader(key, value));
                res.end(await webRes.text());
              } catch (err: any) {
                res.statusCode = 502;
                res.end(JSON.stringify({ count: null, error: err?.message || 'failed' }));
              }
              return;
            }
            if (req.url && req.url.startsWith('/api/kick')) {
              // Parse the URL
              const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
              const endpoint = url.searchParams.get('endpoint');
              
              if (!endpoint) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing endpoint' }));
                return;
              }
              
              try {
                const targetUrl = Array.isArray(endpoint) ? endpoint[0] : endpoint;
                
                // Use built-in Node.js fetch (Node 18+)
                // ملاحظة: UA مختصر فقط — الـ UA الكامل يفعّل حظر Kick الأمني (403)
                const response = await fetch(targetUrl, {
                  headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0',
                  }
                });
                
                const text = await response.text();
                
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.statusCode = response.status;
                res.end(text);
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
              }
            } else {
              next();
            }
          });
        }
      }
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      // تقسيم الحزم: تحميل متوازٍ + كاش أفضل بين التحديثات
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (id.includes('react-dom') || id.includes('\\react\\') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('pusher-js') || id.includes('pusher-js')) return 'vendor-pusher';
            if (id.includes('hls.js')) return 'vendor-hls';
            return 'vendor';
          }
        }
      }
    }
  };
});
