#!/usr/bin/env node
/**
 * serve_dist.js — Pure Node.js static file server + API/WS proxy for dist/
 * No external dependencies required.
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = parseInt(process.env.PORT || '4000', 10);
const API_UPSTREAM = process.env.API_UPSTREAM || 'http://localhost:3003';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

/**
 * Parse upstream URL into { protocol, hostname, port, basePath }
 */
function parseUpstream(upstreamUrl) {
  const u = new URL(upstreamUrl);
  return {
    protocol: u.protocol,
    hostname: u.hostname,
    port: u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80),
  };
}

/**
 * Proxy an HTTP request to the upstream backend.
 */
function proxyRequest(req, res, upstream) {
  const { protocol, hostname, port } = upstream;
  const options = {
    hostname,
    port,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${hostname}:${port}`,
    },
  };

  const transport = protocol === 'https:' ? https : http;
  const proxyReq = transport.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ error: 'Bad gateway', detail: err.message }));
  });

  req.pipe(proxyReq, { end: true });
}

/**
 * Serve a static file from dist/
 */
function serveStatic(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback — serve index.html
      serveIndexHtml(res);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    });
    const readStream = fs.createReadStream(filePath);
    readStream.on('error', () => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    readStream.pipe(res);
  });
}

function serveIndexHtml(res) {
  const indexPath = path.join(DIST_DIR, 'index.html');
  fs.readFile(indexPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found. Run `npm run build` first.');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

const upstream = parseUpstream(API_UPSTREAM);

const server = http.createServer((req, res) => {
  const { url } = req;

  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy /api/* and /health to backend
  if (url.startsWith('/api/') || url.startsWith('/api') || url === '/health') {
    proxyRequest(req, res, upstream);
    return;
  }

  // Static files
  let urlPath = url.split('?')[0];
  // Prevent directory traversal
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(DIST_DIR, safePath);

  // Security: must stay within DIST_DIR
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if the path requests a directory — serve index inside or SPA fallback
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      const dirIndex = path.join(filePath, 'index.html');
      fs.access(dirIndex, fs.constants.R_OK, (e) => {
        if (e) {
          serveIndexHtml(res);
        } else {
          serveStatic(req, res, dirIndex);
        }
      });
    } else {
      serveStatic(req, res, filePath);
    }
  });
});

// WebSocket proxy: forward /ws/* upgrade requests to backend
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/ws')) {
    socket.destroy();
    return;
  }

  const wsProtocol = upstream.protocol === 'https:' ? 'https' : 'http';
  const targetHost = upstream.hostname;
  const targetPort = upstream.port;

  // Build the raw HTTP CONNECT to proxy WS upgrade
  const options = {
    hostname: targetHost,
    port: targetPort,
    path: req.url,
    method: 'GET',
    headers: {
      ...req.headers,
      host: `${targetHost}:${targetPort}`,
    },
  };

  const transport = wsProtocol === 'https' ? https : http;
  const proxyReq = transport.request(options);
  proxyReq.on('upgrade', (proxyRes, proxySocket) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n` +
        Object.entries(proxyRes.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n') +
        '\r\n\r\n'
    );
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);

    socket.on('error', () => proxySocket.destroy());
    proxySocket.on('error', () => socket.destroy());
  });
  proxyReq.on('error', () => socket.destroy());
  proxyReq.end();
});

server.listen(PORT, () => {
  console.log(`Blackbird 2030 frontend serving on http://localhost:${PORT}`);
  console.log(`  API upstream: ${API_UPSTREAM}`);
  console.log(`  Static: ${DIST_DIR}`);
});
