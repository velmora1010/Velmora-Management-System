import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      {
        name: 'forward-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url) return next();

            // 1. Forward /r/:id to ./api/r.ts
            if (req.url.startsWith('/r/')) {
              try {
                const linkId = req.url.replace(/^\/r\//, '').split('?')[0];
                const query: Record<string, string> = { id: decodeURIComponent(linkId) };
                const mod = await server.ssrLoadModule('./api/r.ts');
                const handler = mod.default;
                const extendedReq = Object.assign(req, { query });
                await handler(extendedReq, res);
                return;
              } catch (err: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
                return;
              }
            }

            // 2. Forward /api/track, /api/r, /api/clicks
            if (req.url.startsWith('/api/')) {
              const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
              const pathname = urlObj.pathname;
              const query: Record<string, string> = {};
              urlObj.searchParams.forEach((val, key) => {
                query[key] = val;
              });

              let apiFile = '';
              if (pathname === '/api/track' || pathname.startsWith('/api/track/')) {
                apiFile = './api/track.ts';
              } else if (pathname === '/api/r' || pathname.startsWith('/api/r/')) {
                apiFile = './api/r.ts';
              } else if (pathname === '/api/clicks' || pathname.startsWith('/api/clicks/')) {
                apiFile = './api/clicks.ts';
              }

              if (apiFile) {
                try {
                  const mod = await server.ssrLoadModule(apiFile);
                  const handler = mod.default;
                  const extendedReq = Object.assign(req, { query });
                  await handler(extendedReq, res);
                  return;
                } catch (err: any) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: err.message }));
                  return;
                }
              }
            }

            next();
          });
        }
      }
    ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor';
            }
            if (id.includes('recharts')) {
              return 'charts';
            }
            if (id.includes('@react-pdf')) {
              return 'pdf';
            }
            if (id.includes('lucide')) {
              return 'icons';
            }
          }
        }
      }
    }
  }
};
});
