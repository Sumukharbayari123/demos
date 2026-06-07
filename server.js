const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const rootDir = __dirname;
const demosDir = path.join(rootDir, 'demos');
const publicFiles = new Set(['/', '/index.html', '/styles.css', '/app.js']);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, content, contentType) {
  response.writeHead(statusCode, { 'Content-Type': contentType });
  response.end(content);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeRelativeFile(fileName) {
  const normalized = path.normalize(fileName).replace(/^([/\\])+/, '');
  if (normalized.includes('..')) {
    return null;
  }
  return normalized;
}

function resolveSafePath(baseDir, requestPath) {
  const relativePath = requestPath.replace(/^([/\\])+/, '');
  const absolutePath = path.resolve(baseDir, relativePath);
  const normalizedBase = path.resolve(baseDir) + path.sep;
  if (!absolutePath.startsWith(normalizedBase) && absolutePath !== path.resolve(baseDir)) {
    return null;
  }
  return absolutePath;
}

function readDemoDirectories() {
  if (!fs.existsSync(demosDir)) {
    return [];
  }

  return fs.readdirSync(demosDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const demoPath = path.join(demosDir, entry.name);
      const files = fs.readdirSync(demoPath, { withFileTypes: true })
        .filter((child) => child.isFile())
        .map((child) => child.name)
        .filter((fileName) => /\.(html?|css|js|json|txt)$/i.test(fileName))
        .sort((left, right) => {
          const order = ['index.html', 'styles.css', 'script.js'];
          const leftIndex = order.indexOf(left);
          const rightIndex = order.indexOf(right);
          if (leftIndex !== -1 || rightIndex !== -1) {
            return (leftIndex === -1 ? order.length : leftIndex) - (rightIndex === -1 ? order.length : rightIndex);
          }
          return left.localeCompare(right);
        });

      return {
        id: entry.name,
        title: entry.name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
        files
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function getDemoById(demoId) {
  return readDemoDirectories().find((demo) => demo.id === demoId) || null;
}

function serveStaticFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extension] || 'application/octet-stream';
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('File not found');
      return;
    }

    response.writeHead(200, { 'Content-Type': contentType });
    response.end(data);
  });
}

function renderIndexHtml() {
  const escapedTitle = escapeHtml('Demo Browser');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedTitle}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div id="app"></div>
  <script src="/app.js"></script>
</body>
</html>`;
}

function handleApiRequest(request, response, urlObject) {
  if (urlObject.pathname === '/api/demos') {
    sendJson(response, 200, { demos: readDemoDirectories() });
    return true;
  }

  const demoMatch = urlObject.pathname.match(/^\/api\/demos\/([^/]+)(?:\/(files|source))?$/);
  if (!demoMatch) {
    return false;
  }

  const demoId = decodeURIComponent(demoMatch[1]);
  const action = demoMatch[2] || 'files';
  const demo = getDemoById(demoId);

  if (!demo) {
    sendJson(response, 404, { error: 'Demo not found' });
    return true;
  }

  if (action === 'files') {
    sendJson(response, 200, { demo });
    return true;
  }

  const requestedFile = normalizeRelativeFile(urlObject.searchParams.get('file') || '');
  if (!requestedFile) {
    sendJson(response, 400, { error: 'Invalid file path' });
    return true;
  }

  const filePath = path.join(demosDir, demo.id, requestedFile);
  if (!filePath.startsWith(path.join(demosDir, demo.id))) {
    sendJson(response, 400, { error: 'Invalid file path' });
    return true;
  }

  fs.readFile(filePath, 'utf8', (error, content) => {
    if (error) {
      sendJson(response, 404, { error: 'File not found' });
      return;
    }

    sendJson(response, 200, { file: requestedFile, content });
  });

  return true;
}

const server = http.createServer((request, response) => {
  const urlObject = new URL(request.url, `http://${request.headers.host}`);
  const decodedPathname = decodeURIComponent(urlObject.pathname);

  if (request.method !== 'GET') {
    response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Method not allowed');
    return;
  }

  if (handleApiRequest(request, response, urlObject)) {
    return;
  }

  if (decodedPathname === '/' || decodedPathname === '/index.html') {
    sendText(response, 200, renderIndexHtml(), 'text/html; charset=utf-8');
    return;
  }

  if (publicFiles.has(decodedPathname)) {
    const filePath = path.join(rootDir, decodedPathname === '/' ? 'index.html' : decodedPathname.slice(1));
    serveStaticFile(response, filePath);
    return;
  }

  const staticPath = resolveSafePath(rootDir, decodedPathname);
  if (staticPath && fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    serveStaticFile(response, staticPath);
    return;
  }

  const demoAssetPath = resolveSafePath(rootDir, decodedPathname);
  if (demoAssetPath && demoAssetPath.startsWith(demosDir) && fs.existsSync(demoAssetPath) && fs.statSync(demoAssetPath).isFile()) {
    serveStaticFile(response, demoAssetPath);
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found');
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Demo browser running at http://localhost:${port}`);
});