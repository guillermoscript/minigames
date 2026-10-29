'use strict';
/* Servidor de desarrollo para jugar LA FIESTA / Margarita EN LÍNEA sin el binario de PocketBase: sirve el repo como archivos estáticos y
   habla lo mismo que los hooks (pocketbase/pb_hooks/party_routes.js) para las salas de fiesta, con la lógica REAL de party.js:
     POST /api/party/<acción>   create/join/pick/cfg/ready/start/act/tick/juez/mjfin/mjack/back/leave/mine/commit/time, sig y vsig (relé)
     GET  /api/party/kind/<code>   {kind, tab}
     GET  /api/collections/rooms/records/<id>   (el sondeo de fiesta-net)
     GET/POST /api/realtime   SSE de PocketBase: PB_CONNECT, suscripciones y eventos rooms/<id>, rooms/<id>/sig, rooms/<id>/vsig
   Las salas viven en memoria (se pierden al reiniciar). Solo salas de fiesta: los modos clásicos de la app no están aquí.
   Uso: node test/helpers/dev-fiesta-server.js [puerto]   →   http://127.0.0.1:<puerto>/docs/margarita/ */
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const P = require(path.join(ROOT, 'pocketbase/pb_hooks/party.js'));
const PORT = +process.argv[2] || 8874;

const rooms = new Map();                          // code -> room (el registro de PocketBase, sin `rec`)
const mem = new Map();
const store = { get: (k) => mem.get(k), set: (k, v) => { mem.set(k, v); }, update: (k, fn) => { mem.set(k, fn(mem.get(k))); }, remove: (k) => { mem.delete(k); } };
const idOf = (code) => 'room' + code.toLowerCase();
const view = (o) => { const r = P.publicRoom(o); r.id = idOf(o.code); return JSON.parse(JSON.stringify(r)); };

/* ── SSE ── */
const clients = new Map();                        // clientId -> {res, subs:Set}
let nextId = 1;
function send(c, topic, data) { c.res.write('id:' + c.id + '\nevent:' + topic + '\ndata:' + JSON.stringify(data) + '\n\n'); }
function broadcast(topic, data) { for (const c of clients.values()) if (c.subs.has(topic)) send(c, topic, data); }
const pushRoom = (o) => broadcast('rooms/' + idOf(o.code), { action: 'update', record: view(o) });

/* ── las acciones (como exec() de party_routes.js, solo la rama fiesta) ── */
function exec(action, body, now) {
  const rand = Math.random;
  if (action === 'create') {
    if (body.mode !== P.FIESTA) P.fail('Only LA FIESTA rooms on the dev server', 400);
    let code = ''; for (let i = 0; i < 30 && !code; i++) { const c = P.makeCode(rand); if (!rooms.has(c)) code = c; }
    const cfg = body.tab ? Object.assign({}, body.cfg && typeof body.cfg === 'object' ? body.cfg : {}, { tab: body.tab }) : body.cfg;
    const o = P.fiestaNew(code, now, cfg); o.made = now;
    const me = P.fiestaJoin(o, { name: body.name, color: body.color, ch: body.ch }, now, rand).you;
    rooms.set(code, o);
    return { room: view(o), you: me };
  }
  const code = P.cleanCode(body.code), o = code.length === 4 ? rooms.get(code) : null;
  if (!o) P.fail('Room not found', 404);
  const before = JSON.stringify(o);
  let r;
  try {
    if (action !== 'join' && action !== 'tick') P.auth(o, String(body.id || ''), String(body.key || ''));
    r = P.fiesta(o, action, body, now, rand, action === 'join' ? { name: body.name, color: body.color, id: body.id, key: body.key, ch: body.ch, seat: body.seat } : null, store);
  } catch (err) { if (err instanceof P.PartyError) err.room = view(o); throw err; }
  if (r.del) { rooms.delete(code); broadcast('rooms/' + idOf(code), { action: 'delete', record: { id: idOf(code) } }); return { ok: true }; }
  delete r.del; delete r.back; delete r.took;
  if (JSON.stringify(o) !== before) pushRoom(o);
  return Object.assign({ room: view(o) }, r);
}
function relay(body, voice) {
  const code = P.cleanCode(body.code), o = rooms.get(code);
  if (!o) P.fail('Room not found', 404);
  P.auth(o, String(body.id || ''), String(body.key || ''));
  const msg = voice ? P.vsigPayload(o, String(body.id), body.to, String(body.k || ''), body.d) : P.sigPayload(P.slimRoom(o), String(body.id), body.round | 0, body.m, Date.now(), store, body.sc);
  if (msg === null) return { ok: true, n: 0 };
  broadcast('rooms/' + idOf(code) + (voice ? '/vsig' : '/sig'), msg);
  return { ok: true, n: 1 };
}

/* ── estáticos ── */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary' };
function estatico(req, res, u) {
  let f = path.normalize(path.join(ROOT, decodeURIComponent(u.pathname)));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (e) { res.writeHead(404); return res.end('not found'); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data);
  });
}
const json = (res, status, o) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
function leer(req) { return new Promise((ok) => { let s = ''; req.on('data', (d) => { s += d; }); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { ok({}); } }); }); }

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname;
  if (p === '/api/realtime' && req.method === 'GET') {
    const id = 'c' + nextId++;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const c = { id, res, subs: new Set() }; clients.set(id, c);
    send(c, 'PB_CONNECT', { clientId: id });
    const ka = setInterval(() => res.write(':\n\n'), 15000);
    req.on('close', () => { clearInterval(ka); clients.delete(id); });
    return;
  }
  if (p === '/api/realtime' && req.method === 'POST') {
    const b = await leer(req), c = clients.get(b.clientId);
    if (!c) return json(res, 404, { error: 'Missing client' });
    c.subs = new Set(Array.isArray(b.subscriptions) ? b.subscriptions : []);
    res.writeHead(204); return res.end();
  }
  let m = /^\/api\/party\/kind\/(\w+)$/.exec(p);
  if (m) {
    const o = rooms.get(P.cleanCode(m[1]));
    if (!o) return json(res, 404, { error: 'Room not found' });
    return json(res, 200, { kind: 'fiesta', tab: P.tabDe(o) || 'venezuela' });
  }
  m = /^\/api\/collections\/rooms\/records\/(\w+)$/.exec(p);
  if (m) { for (const o of rooms.values()) if (idOf(o.code) === m[1]) return json(res, 200, view(o)); return json(res, 404, { error: 'not found' }); }
  m = /^\/api\/party\/(\w+)$/.exec(p);
  if (m && req.method === 'POST') {
    const action = m[1], body = await leer(req);
    try {
      if (action === 'time') return json(res, 200, { now: Date.now() });
      const out = action === 'sig' || action === 'vsig' ? relay(body, action === 'vsig') : exec(action, body, Date.now());
      out.now = Date.now(); return json(res, 200, out);
    } catch (err) {
      if (!(err instanceof P.PartyError)) { console.log('[dev] ' + action + ': ' + (err && err.stack || err)); return json(res, 500, { error: 'Server error', now: Date.now() }); }
      const o = { error: err.message, now: Date.now() }; if (err.room) o.room = err.room;
      return json(res, err.status, o);
    }
  }
  if (p.startsWith('/api/')) return json(res, 404, { error: 'Not on the dev server' });
  if (p === '/dev/dos') {   // dos jugadores en una pestaña: cada iframe en su propio origen (localhost y 127.0.0.1), así cada uno tiene su sesión
    const q = (u.searchParams.get('pag') || 'docs/margarita/').replace(/^\/+/, '');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta charset="utf-8"><title>dos jugadores</title><style>html,body{margin:0;height:100%;background:#000}body{display:flex;gap:4px}iframe{flex:1;border:0;height:100%}</style>' +
      '<iframe id="a" src="http://localhost:' + PORT + '/' + q + '"></iframe><iframe id="b" src="http://127.0.0.1:' + PORT + '/' + q + '"></iframe>');
  }
  estatico(req, res, u);
}).listen(PORT, '127.0.0.1', () => console.log('dev fiesta server: http://127.0.0.1:' + PORT + '/docs/margarita/'));
