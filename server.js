/**
 * FieldManual — HTTPS Server
 * Node.js built-in modules only (no npm packages needed)
 * Usage: node server.js [port]
 */
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

const PORT       = parseInt(process.argv[2] || '8443', 10);
const HTTP_PORT  = PORT - 1; // HTTP → HTTPS redirect (e.g. 8442 → 8443)
const PUBLIC_DIR = __dirname;

// ── MIME types ──────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

// ── Request handler ─────────────────────────────────────────────────────────
function handler(req, res) {
  // Security: block path traversal
  const safePath = path.normalize(req.url.split('?')[0]);
  if (safePath.includes('..')) {
    res.writeHead(400); res.end('Bad Request'); return;
  }

  // Serve index.html for root
  let filePath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath);

  // If directory, try index.html inside
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback to index.html for SPA routing
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const ct  = MIME[ext] || 'application/octet-stream';
    // Camera API headers
    res.writeHead(200, {
      'Content-Type': ct,
      'Cache-Control': 'no-cache',
      'Permissions-Policy': 'camera=*, microphone=*',
    });
    res.end(data);
  });
}

// ── TLS options ─────────────────────────────────────────────────────────────
const tlsOpts = {
  key:  fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
};

// ── HTTPS server ─────────────────────────────────────────────────────────────
const httpsServer = https.createServer(tlsOpts, handler);
httpsServer.listen(PORT, '0.0.0.0', () => {
  const ifaces = os.networkInterfaces();
  const ips = [];
  Object.values(ifaces).forEach(list =>
    list.forEach(i => { if (i.family === 'IPv4' && !i.internal) ips.push(i.address); })
  );

  console.log('\n========================================');
  console.log('  FieldManual — HTTPS サーバー起動');
  console.log('========================================');
  console.log('');
  console.log('  ✅ PC からアクセス:');
  console.log(`     https://localhost:${PORT}`);
  if (ips.length) {
    console.log('');
    console.log('  📱 スマートフォンからアクセス (同一Wi-Fi):');
    ips.forEach(ip => console.log(`     https://${ip}:${PORT}`));
  }
  console.log('');
  console.log('  ⚠️  初回アクセス時に「安全でない接続」の警告が出ます。');
  console.log('     詳細 → このサイトにアクセスする でスキップできます。');
  console.log('');
  console.log('  停止するには Ctrl+C を押してください');
  console.log('========================================\n');
});

// ── HTTP → HTTPS redirect ────────────────────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  const host = (req.headers.host || 'localhost').replace(/:\d+$/, '');
  res.writeHead(301, { Location: `https://${host}:${PORT}${req.url}` });
  res.end();
});
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`  🔀 HTTP リダイレクト: http://0.0.0.0:${HTTP_PORT} → https://...:${PORT}`);
});

httpsServer.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n❌ ポート ${PORT} は既に使用中です。別のポートを指定してください:`);
    console.error(`   node server.js 8444\n`);
  } else {
    console.error('Server error:', e);
  }
  process.exit(1);
});
