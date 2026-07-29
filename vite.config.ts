import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mock-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/track' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                JSON.parse(body);
                // Return a mock successful tracking status for local testing
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: true,
                  status: 'In Transit',
                  location: 'Bengaluru Hub',
                  lastUpdated: new Date().toLocaleString(),
                  deliveredDate: '',
                  rawResponse: 'Mock response from local Vite dev server'
                }));
              } catch (e) {
                res.writeHead(400);
                res.end('Bad Request');
              }
            });
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
