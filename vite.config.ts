import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import socialHandler from './api/social.ts';
import kickHandler from './api/kick.ts';

/** جسم الطلب يُقرأ كما هو حتى تُمرَّره Middleware التطوير إلى دالة الإنتاج نفسها */
const readBody = (req: any): Promise<string | undefined> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (c: Buffer) => {
    chunks.push(c);
    size += c.length;
    if (size > 64_000) { reject(new Error('Request body too large')); req.destroy?.(); }
  });
  req.on('end', () => resolve(size ? Buffer.concat(chunks).toString('utf8') : undefined));
  req.on('error', reject);
});

export default defineConfig(() => {
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
              // ---- /api/kick : نفس دالة الإنتاج (api/kick.ts) بلا تكرار ----
              // مهم: لوكتبناها يدوياً هنا كانت قائمة النطاقات المسموحة تنطبق على
              // فيركل فقط، فيشتغل الموقع محلياً ويفشل منشوراً (خطأ أساطير الشات).
              try {
                const base = `http://${req.headers.host || 'localhost'}`;
                // الجسم لازم يُقرأ ويُمرَّر، وإلا فشل تجديد بيانات Pusher محلياً ونجح منشوراً
                const body = (req.method || 'GET') === 'GET' ? undefined : await readBody(req);
                const webRes = await kickHandler(new Request(new URL(req.url, base).toString(), {
                  method: req.method || 'GET',
                  headers: { 'Content-Type': req.headers['content-type'] || 'application/json' },
                  body,
                }));
                res.statusCode = webRes.status;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(await webRes.text());
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message || 'Internal Server Error' }));
              }
            } else {
              next();
            }
          });
        }
      }
    ],
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
