import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'forward-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/track')) {
            try {
              const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
              const query: Record<string, string> = {};
              urlObj.searchParams.forEach((val, key) => {
                query[key] = val;
              });

              const { default: handler } = await import('./api/track');
              const extendedReq = Object.assign(req, { query });
              await handler(extendedReq, res);
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          } else {
            next();
          }
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
})
