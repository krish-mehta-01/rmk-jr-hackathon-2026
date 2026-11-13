const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.FRONTEND_PORT || 5173;
const BACKEND_PORT = process.env.BACKEND_PORT || 30000;
const FRONTEND_DIR = path.join(__dirname, 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  // 1. Proxy /api requests to backend
  if (req.url.startsWith('/api/') || req.url === '/api') {
    const options = {
      hostname: '127.0.0.1',
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${BACKEND_PORT}` }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend unreachable on port ' + BACKEND_PORT, details: err.message }));
    });

    req.pipe(proxyReq, { end: true });
    return;
  }

  // 2. Serve static files from frontend/
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(FRONTEND_DIR, reqPath);

  // Security check to prevent directory traversal
  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // SPA Fallback: for routes like /rmkjrhackathon2026-jurylogin, serve index.html
      const indexPath = path.join(FRONTEND_DIR, 'index.html');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(indexPath).pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[FRONTEND DEV SERVER] Running on http://localhost:${PORT}`);
  console.log(`[FRONTEND DEV SERVER] Proxying /api -> http://localhost:${BACKEND_PORT}`);
});
