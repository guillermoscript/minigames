'use strict';
/* Relé en memoria para probar el transporte de LA FIESTA sin red (doc 09 §14.1). Reutilizable por fiesta-net / fiesta-live / sim.
   - Reloj VIRTUAL: todo timer inyectado (setTimeout/setInterval) y toda entrega corre sobre él; avanza con `await R.advance(ms)`.
   - Relé HTTP de juguete (/api/party/*): latencia por tramo (`delay` + U[0, jitter]), pérdida y duplicado de peticiones, y los topes
     reales del servidor: lote ≤`maxBytes` (512 B, medido como sigPayload: JSON de [{t,d,n,l,v}]) y ≤`maxMsgs` (10), 25 msg/s por asiento
     (ráfaga 40). Rechaza igual que el servidor (400/413/429) y lo anota en `R.log.sig`. Toda respuesta lleva `now`.
   - SSE falso (PB_CONNECT + POST /api/realtime con suscripciones), EN ORDEN por conexión, con pérdida/duplicado opcionales.
   - WebRTC falso por par: 'open' | 'fail' | 'down' (agujero negro) | 'closed'; canal 'f' sin orden (pérdida, jitter, reordenamiento)
     y 'r' fiable y ordenado. La señalización viaja por el vsig del relé, como en producción.
   Uso: const R = memRelay({ seats: ['a','b','c'], http: {delay: 60, jitter: 40}, p2p: {pairs: {'a-b': 'open'}} });
        const N = net.create(R.client('a')); await N.join(R.room.code, {}); await R.advance(1000); */

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
const flushMicro = () => new Promise(r => setImmediate(r));
const COLORS = ['#FF4D4D', '#4DB8FF', '#5CFF7A', '#FFE14D'];

function memRelay(o = {}) {
  const rnd = mulberry32(o.seed || 1);
  const http = Object.assign({ delay: 40, jitter: 0, loss: 0, dup: 0, maxBytes: 512, maxMsgs: 10, rate: 25, burst: 40 }, o.http);
  const sse = Object.assign({ delay: 20, jitter: 0, loss: 0, dup: 0 }, o.sse);
  const p2p = Object.assign({ pairs: {}, def: 'fail', connect: 120 }, o.p2p);
  p2p.f = Object.assign({ delay: 25, jitter: 10, loss: 0, reorder: 0 }, p2p.f);
  p2p.r = Object.assign({ delay: 30, jitter: 5 }, p2p.r);
  const leg = c => (Array.isArray(c.delay) ? c.delay[0] + rnd() * (c.delay[1] - c.delay[0]) : c.delay) + rnd() * (c.jitter || 0);

  /* ── tiempo virtual ── */
  const q = []; let seqEv = 0;
  const R = { t: 0, epoch: o.epoch || 1790000000000, rnd, http, sse, p2p, offline: {}, log: { sig: [], vsig: [], p2p: 0, req: [] }, presence: {} };
  function at(when, fn) {
    const ev = { at: Math.max(when, R.t), s: ++seqEv, fn, off: false };
    let lo = 0, hi = q.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (q[m].at < ev.at || (q[m].at === ev.at && q[m].s < ev.s)) lo = m + 1; else hi = m; }
    q.splice(lo, 0, ev); return ev;
  }
  const later = (ms, fn) => at(R.t + ms, fn);
  R.later = later;
  R.advance = async ms => {
    const end = R.t + ms;
    await flushMicro();
    for (;;) {
      const ev = q[0]; if (!ev || ev.at > end) break;
      q.shift(); R.t = ev.at;
      if (!ev.off) { try { ev.fn(); } catch (e) { (R.errors = R.errors || []).push(e); } }
      await flushMicro();
    }
    R.t = end;
  };
  R.serverNow = () => R.epoch + R.t;

  /* ── sala de juguete ── */
  const room = { id: 'room1', code: o.code || 'ABCD', mode: 'fiesta', state: 'play', host: null, players: [], ver: 1,
    board: o.board || { f: 'mj', mj: { k: 1, juez: 'a', e: 0, watch: 0 }, pj: {} } };
  const keys = {};
  R.room = room; R.keys = keys; R.gone = false;
  R.addSeat = (id, info = {}) => {
    if (room.players.some(p => p.id === id)) return keys[id];
    room.players.push({ id, name: info.name || id.toUpperCase(), color: COLORS[room.players.length % 4], score: 0, left: false });
    room.players.sort((a, b) => a.id < b.id ? -1 : 1);
    keys[id] = 'k' + id + Math.floor(rnd() * 1e6);
    room.board.pj = room.board.pj || {};
    room.board.pj[id] = Object.assign({ ch: info.ch || null, cpu: info.cpu || null }, room.board.pj[id]);
    if (!room.host) room.host = id;
    return keys[id];
  };
  (o.seats || ['a', 'b']).forEach(id => R.addSeat(id));
  (o.cpus || []).forEach(id => R.addSeat(id, { cpu: 'auto' }));
  R.push = () => { room.ver++; broadcast('rooms/' + room.id, { action: 'update', record: clone(room) }); };
  R.kill = () => { R.gone = true; broadcast('rooms/' + room.id, { action: 'delete', record: { id: room.id } }); };
  R.handlers = {};                                           // acciones propias de una prueba: (body, from) → {status, body}
  const buckets = {};
  function rateOk(id, n) {                                   // 25 msg/s por asiento, ráfaga 40 (doc 07 §4.3, clave fl:<code>:<asiento>)
    const b = buckets[id] || (buckets[id] = { tok: http.burst, at: R.t });
    b.tok = Math.min(http.burst, b.tok + (R.t - b.at) / 1000 * http.rate); b.at = R.t;
    if (b.tok < n) return false;
    b.tok -= n; return true;
  }
  const authOk = b => b && typeof b.id === 'string' && keys[b.id] && keys[b.id] === b.key && String(b.code || '') === room.code;
  function serve(action, body, client) {
    const now = R.serverNow(), ok = x => ({ status: 200, body: Object.assign({ now }, x) }), bad = (s, e) => ({ status: s, body: { error: e, now } });
    if (R.gone) return bad(404, 'Room not found');
    if (R.handlers[action]) { const r = R.handlers[action](body, client); if (r) { r.body = Object.assign({ now }, r.body); return r; } }
    if (action === 'time') return ok({});
    if (action === 'sig') {
      const rec = { at: R.t, from: body && body.id, sc: body && body.sc, count: 0, bytes: 0, status: 200, types: [] };
      R.log.sig.push(rec);
      const r = (() => {
        if (!authOk(body)) return bad(403, 'Not in this room');
        if (String(body.code) !== room.code) return bad(404, 'Room not found');
        const sc = body.sc;
        if (typeof sc !== 'string' || !(sc === 'b' || (R.scopeOk ? R.scopeOk(sc) : /^m:\d+$/.test(sc)))) return bad(409, 'Round is over');
        const m = body.m;
        if (!Array.isArray(m) || !m.length || m.length > http.maxMsgs) return bad(400, 'Bad message');
        const out = m.map(x => { const y = { t: String((x && x.t) || '').slice(0, 12), d: x && x.d !== undefined ? x.d : null };
          if (x && Number.isSafeInteger(x.n) && x.n > 0) { y.n = x.n; y.l = x.l === true; if (typeof x.v === 'string' && /^[a-z0-9]{1,24}$/.test(x.v)) y.v = x.v; } return y; });
        rec.count = out.length; rec.bytes = JSON.stringify(out).length; rec.types = out.map(x => x.t);
        if (rec.bytes > http.maxBytes) return bad(413, 'Message too big');
        if (!rateOk(body.id, out.length)) return bad(429, 'Too many messages');
        for (const x of out) if (x.t === 'hb') R.presence[body.id] = { at: now, rtt: x.d && x.d.rtt, vis: x.d && x.d.vis };   // D20: fp:<code>:<asiento>
        broadcast('rooms/' + room.id + '/sig', { from: body.id, sc, at: now, m: out });
        return ok({ ok: true });
      })();
      rec.status = r.status;
      return r;
    }
    if (action === 'vsig') {
      if (!authOk(body)) return bad(403, 'Not in this room');
      const msg = { from: body.id, to: String(body.to || '*'), k: String(body.k || ''), d: body.d === undefined ? null : body.d };
      if (JSON.stringify(msg).length > 4096) return bad(413, 'Message too big');
      R.log.vsig.push({ at: R.t, k: msg.k, from: msg.from, to: msg.to });
      broadcast('rooms/' + room.id + '/vsig', msg);
      return ok({ ok: true });
    }
    if (action === 'join') {
      if (String(body.code || '') !== room.code) return bad(404, 'Room not found');
      if (body.id && keys[body.id] && keys[body.id] === body.key) {
        const pj = room.board.pj[body.id]; if (pj && pj.cpu === 'afk') { pj.cpu = null; R.push(); }
        return ok({ room: clone(room), you: { id: body.id, key: body.key } });
      }
      if (body.id && body.key) return bad(403, 'Bad key');
      const free = ['a', 'b', 'c', 'd'].find(s => !room.players.some(p => p.id === s));
      if (!free) return ok({ spectate: true, room: clone(room) });
      const key = R.addSeat(free, { name: body.name }); R.push();
      return ok({ room: clone(room), you: { id: free, key } });
    }
    if (action === 'create') { const key = keys.a || R.addSeat('a'); return ok({ room: clone(room), you: { id: 'a', key } }); }
    if (action === 'tick') return ok({ room: clone(room) });
    if (!authOk(body)) return bad(403, 'Bad key');
    if (action === 'leave') { const pj = room.board.pj[body.id]; if (pj) pj.cpu = 'afk'; R.push(); return ok({ ok: true }); }
    if (action === 'mine') return ok({ priv: {} });
    return ok({ room: clone(room) });
  }

  /* ── SSE ── */
  const streams = [];
  function broadcast(topic, data) {
    const s = JSON.stringify(data);
    for (const es of streams) {
      if (!es.open || !es.subs.includes(topic) || R.offline[es.owner]) continue;
      if (rnd() < sse.loss) continue;
      const n = rnd() < sse.dup ? 2 : 1;
      for (let i = 0; i < n; i++) { es.last = Math.max(es.last, R.t + leg(sse)); const when = es.last; at(when, () => { if (!R.offline[es.owner]) es._emit(topic, { data: s }); }); }
    }
  }
  R.broadcast = broadcast;
  function mkES(owner) {
    return class FakeES {
      constructor(url) { this.url = url; this.owner = owner; this.cid = owner + ':es' + streams.length; this.l = {}; this.open = true; this.subs = []; this.last = 0; streams.push(this);
        later(leg(sse), () => this._emit('PB_CONNECT', { lastEventId: this.cid, data: '{}' })); }
      addEventListener(k, fn) { (this.l[k] = this.l[k] || []).push(fn); }
      close() { this.open = false; }
      _emit(k, ev) { if (this.open) (this.l[k] || []).forEach(f => f(ev)); }
    };
  }

  /* ── fetch ── */
  function mkFetch(owner) {
    return (url, init = {}) => new Promise(res => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, ''), method = init.method || 'GET';
      const body = init.body ? JSON.parse(init.body) : null;
      const reply = (status, b) => { if (rnd() < http.loss || R.offline[owner]) return; later(leg(http), () => res({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(clone(b)) })); };
      if (R.offline[owner] || rnd() < http.loss) return;                    // perdida de subida: el cliente agota su timeout
      const times = rnd() < http.dup ? 2 : 1;
      later(leg(http), () => {
        if (R.offline[owner]) return;
        let r;
        if (path === '/api/realtime' && method === 'POST') { const es = streams.find(s => s.cid === body.clientId); if (es) es.subs = body.subscriptions.slice(); r = { status: es ? 204 : 404, body: {} }; }
        else if (method === 'GET' && path.startsWith('/api/collections/rooms/records/')) r = R.gone || path.split('/').pop() !== room.id ? { status: 404, body: { message: 'not found' } } : { status: 200, body: clone(room) };
        else if (path.startsWith('/api/party/')) {
          const action = path.slice('/api/party/'.length);
          R.log.req.push({ at: R.t, owner, action });
          for (let i = 0; i < times; i++) r = serve(action, body, owner);
        } else r = { status: 404, body: {} };
        reply(r.status, r.body);
      });
    });
  }

  /* ── WebRTC falso ── */
  const pcs = {}; let pcN = 0;
  const pairKey = (a, b) => a < b ? a + '-' + b : b + '-' + a;
  R.pair = (a, b) => p2p.pairs[pairKey(a, b)] || p2p.def;
  R.setPair = (k, st) => {
    const [a, b] = k.split('-'); p2p.pairs[pairKey(a, b)] = st;
    if (st === 'closed' || st === 'fail') for (const pc of Object.values(pcs)) if (pc._peer && pairKey(pc.owner, pc._peer.owner) === pairKey(a, b)) pc._fail();
  };
  function mkChan(pc, label, opts) {
    const ch = { label, readyState: 'connecting', bufferedAmount: 0, ordered: !(opts && opts.ordered === false), onmessage: null, onopen: null, onclose: null, peer: null, lastAt: 0, sent: 0,
      send(data) {
        if (ch.readyState !== 'open') throw new Error('InvalidStateError');
        ch.sent++; R.log.p2p++;
        const other = ch.peer; if (!other) return;
        if (R.pair(pc.owner, other._pc.owner) !== 'open' || R.offline[pc.owner] || R.offline[other._pc.owner]) return;   // agujero negro
        let d;
        if (label === 'f') { if (rnd() < p2p.f.loss) return; d = leg(p2p.f) + (rnd() < p2p.f.reorder ? p2p.f.delay * 3 : 0); later(d, () => { if (other.readyState === 'open' && other.onmessage) other.onmessage({ data }); }); }
        else { ch.lastAt = Math.max(ch.lastAt, R.t + leg(p2p.r)); at(ch.lastAt, () => { if (other.readyState === 'open' && other.onmessage) other.onmessage({ data }); }); }
      },
      close() { if (ch.readyState === 'closed') return; ch.readyState = 'closed'; if (ch.onclose) ch.onclose(); if (ch.peer) ch.peer.close(); } };
    ch._pc = pc;
    return ch;
  }
  function mkRTC(owner) {
    return class FakePC {
      constructor(cfg) { this.cfg = cfg; this.owner = owner; this.uid = ++pcN; pcs[this.uid] = this; this.connectionState = 'new'; this.signalingState = 'stable';
        this.localDescription = null; this.remoteDescription = null; this._ch = []; this._peer = null; this.cands = []; }
      createDataChannel(label, opts) { const c = mkChan(this, label, opts); this._ch.push(c); return c; }
      createOffer() { return Promise.resolve({ type: 'offer', sdp: 'fake:' + this.uid }); }
      createAnswer() { return Promise.resolve({ type: 'answer', sdp: 'fake:' + this.uid }); }
      setLocalDescription(d) { this.localDescription = d; this.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable';
        later(5, () => { if (this.onicecandidate && this.connectionState !== 'closed') this.onicecandidate({ candidate: { candidate: 'cand:' + this.uid, toJSON() { return { candidate: 'cand:' + this.uid }; } } }); });
        this._try(); return Promise.resolve(); }
      setRemoteDescription(d) { this.remoteDescription = d; this._rid = +String(d.sdp).split(':')[1]; if (d.type === 'answer') this.signalingState = 'stable'; this._try(); return Promise.resolve(); }
      addIceCandidate(c) { this.cands.push(c); return Promise.resolve(); }
      close() { if (this.connectionState === 'closed') return; this.connectionState = 'closed'; this._ch.forEach(c => c.close()); }
      _fail() { if (this.connectionState === 'closed') return; this.connectionState = 'failed'; this._ch.forEach(c => c.close()); if (this.onconnectionstatechange) this.onconnectionstatechange(); }
      _try() {
        const other = pcs[this._rid];
        if (!other || other._rid !== this.uid || !this.localDescription || !this.remoteDescription || !other.localDescription || !other.remoteDescription || this._peer) return;
        const offerer = this.localDescription.type === 'offer' ? this : other, answerer = offerer === this ? other : this;
        this._peer = other; other._peer = this;
        later(p2p.connect, () => {
          if (offerer.connectionState === 'closed' || answerer.connectionState === 'closed') return;
          if (R.pair(offerer.owner, answerer.owner) !== 'open') { offerer._fail(); answerer._fail(); return; }
          offerer.connectionState = answerer.connectionState = 'connected';
          for (const c of offerer._ch) {
            const m = mkChan(answerer, c.label, { ordered: c.ordered }); answerer._ch.push(m); c.peer = m; m.peer = c;
            if (answerer.ondatachannel) answerer.ondatachannel({ channel: m });
          }
          for (const c of offerer._ch.concat(answerer._ch)) { c.readyState = 'open'; if (c.onopen) c.onopen(); }
          [offerer, answerer].forEach(pc => { if (pc.onconnectionstatechange) pc.onconnectionstatechange(); });
        });
      }
    };
  }

  /* ── dependencias para fiesta-net.create() de un cliente ── */
  R.storage = (init = {}) => { const m = Object.assign({}, init); return { getItem: k => k in m ? m[k] : null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; };
  R.client = (owner, opt = {}) => {
    const base = opt.clockBase !== undefined ? opt.clockBase : 1000 + Math.floor(rnd() * 1e6), skew = opt.skew || 0;
    return {
      api: '', fetch: mkFetch(owner), EventSource: mkES(owner), RTC: opt.rtc === false ? null : mkRTC(owner), AbortController: null,
      clock: () => (R.t + base) / 1000, wall: () => R.epoch + R.t + skew,
      setTimeout: (fn, ms) => later(ms || 0, fn), clearTimeout: ev => { if (ev) ev.off = true; },
      setInterval: (fn, ms) => { const h = { off: false }; const go = () => { if (h.off) return; fn(); h.ev = later(ms, go); }; h.ev = later(ms, go); return h; },
      clearInterval: h => { if (h) { h.off = true; if (h.ev) h.ev.off = true; } },
      storage: opt.storage || R.storage(), log: opt.log || (() => {}), timers: opt.timers, tickMs: opt.tickMs
    };
  };
  /* sienta a un cliente sin pasar por join (sesión ya guardada): devuelve los datos de `join` para N.join */
  R.session = id => ({ code: room.code, id, key: keys[id], ts: R.epoch + R.t });
  return R;
}

module.exports = { memRelay, mulberry32 };
