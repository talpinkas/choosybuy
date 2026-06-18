// ============================================================
// CHOOSY — local preview server (zero dependencies).
// ============================================================
// Serves public/ as static files AND runs the /api/get-pool serverless handler
// in-process, so the whole app (including the game) works locally — no Vercel CLI.
//   node tools/preview-server.js        (PORT env overrides the default 5050)
// Used by .claude/launch.json for the in-app preview panel.
// ============================================================
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var ROOT = path.join(__dirname, '..', 'public');
var getPool = require('../api/get-pool.js');
var PORT = process.env.PORT || 5050;
var TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon'
};

http.createServer(function (req, res) {
  var parsed = url.parse(req.url, true);
  var pathname = parsed.pathname;

  if (pathname === '/api/get-pool') {
    req.query = parsed.query;
    res.status = function (c) { res.statusCode = c; return res; };
    res.json = function (b) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); };
    return getPool(req, res);
  }

  if (pathname === '/') pathname = '/index.html';
  var file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
  if (file.indexOf(ROOT) !== 0) { res.statusCode = 403; return res.end('forbidden'); }
  fs.readFile(file, function (e, data) {
    if (e) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(PORT, function () { console.log('Choosy preview on http://localhost:' + PORT); });
