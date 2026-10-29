/* LA FIESTA M2, server side: the 'fiesta' branch of sigPayload (scopes b / m:<k>), judge election, the relay cache, bounds. No PocketBase. */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const P = require("../pocketbase/pb_hooks/party.js");
const { liveRoom, memStore } = require("./helpers/fiesta-room.js");

const status = (fn, st, msg) => { try { fn(); } catch (e) { assert.ok(e instanceof P.PartyError, String(e)); assert.equal(e.status, st, e.message); if (msg) assert.match(e.message, msg); return; } assert.fail("did not throw"); };
const sig = (room, id, sc, m, now, store) => P.sigPayload(room, id, 0, m, now, store, sc);
const o = (d) => ({ t: "o", d: Object.assign({ q: 0 }, d || {}) });

test("scopes: b needs no game, m:<k> needs the live game and a seat in it", () => {
  const t = liveRoom(), f = t.room, k = f.board.mj.k, now = 5000;
  assert.deepEqual(sig(f, "a", "b", [{ t: "hb", d: { rtt: 40 } }], now, t.store).m.map((x) => x.t), ["hb"]);
  assert.equal(sig(f, "a", "m:" + k, [o()], now, t.store).from, "a", "`from` is set by the server");
  assert.equal(sig(f, "a", "m:" + k, [o()], now, t.store).at, now);
  status(() => sig(f, "a", "m:" + (k + 1), [o()], now, t.store), 409, /Round is over/);
  status(() => sig(f, "a", "m:" + k, [{ t: "frame", d: {} }], now, t.store), 400);
  status(() => sig(f, "a", "m:x", [o()], now, t.store), 400, /scope/);
  status(() => sig(f, "a", undefined, [o()], now, t.store), 400);
  status(() => sig(f, "a", "b", [o()], now, t.store), 400, /Bad message/);            // 'o' only travels in the game scope
  status(() => sig(f, "zz", "b", [{ t: "hb" }], now, t.store), 403);
  status(() => sig(f, "a", "b", [], now, t.store), 400);
  status(() => sig(f, "a", "b", new Array(11).fill({ t: "hb" }), now, t.store), 400);
  f.board.f = "turno";
  status(() => sig(f, "a", "m:" + k, [o()], now, t.store), 409, /Round is over/);
  assert.equal(sig(f, "a", "b", [{ t: "hb" }], now, t.store).sc, "b", "scope b is valid in any phase");
});

test("types: allow list, x* names, reserved names, sizes", () => {
  const t = liveRoom(), f = t.room, k = f.board.mj.k, sc = "m:" + k, now = 5000;
  const ok = (m) => sig(f, "a", sc, m, now, t.store);
  assert.equal(ok([{ t: "xtiro", d: { q: 0, d: [1, 2] } }]).m.length, 1);
  for (const bad of ["xTiro", "x", "xabcdefghijkl", "x_a", "frame", "sab", "cheer", "ping", "S"]) status(() => ok([{ t: bad, d: { q: 0 } }]), 400);
  status(() => sig(f, "a", "b", [{ t: "xtiro", d: { q: 0 } }], now, t.store), 400, /Bad message/);
  status(() => ok([{ t: "xtiro", d: { q: 0, d: "y".repeat(200) } }]), 413);                  // x* <= 200 B
  status(() => ok([{ t: "o", d: { q: 0, pad: "y".repeat(430) } }]), 413);                     // any message <= 420 B
  status(() => ok([o({ pad: "y".repeat(240) }), o({ pad: "y".repeat(240) })]), 413);        // whole batch <= 512 B
  assert.equal(ok([{ t: "xtiro", d: { q: 0, d: 1 }, n: 4, l: true, v: "ab12" }]).m[0].n, 4, "retry metadata is kept");
  assert.equal(ok(new Array(10).fill(o())).m.length, 10);
});

test("judge-only types: dropped quietly unless from the judge of this epoch and game", () => {
  const t = liveRoom(), f = t.room, mj = f.board.mj, sc = "m:" + mj.k, now = 5000;
  const s = (e, q) => ({ t: "s", d: { q: q, e: e, t: 100, p: [1] } });
  assert.equal(sig(f, "a", sc, [s(0, 0)], now, t.store).m.length, 1, "the judge is a");
  assert.equal(sig(f, "b", sc, [s(0, 0)], now, t.store), null, "not the judge: nothing left to relay");
  assert.equal(sig(f, "a", sc, [s(1, 0)], now, t.store), null, "old/new epoch");
  assert.equal(sig(f, "a", sc, [s(0, 1)], now, t.store), null, "another game of the queue");
  const mixed = sig(f, "b", sc, [s(0, 0), { t: "hb", d: { rtt: 30 } }, o(), o({ q: 9 }), { t: "ev", d: { q: 0, e: 0, ty: "cpu", p: 2 } }, { t: "ev", d: { q: 0, ty: "out", p: 1 } }, { t: "end", d: { q: 0, e: 0 } }], now, t.store);
  assert.deepEqual(mixed.m.map((x) => x.t), ["hb", "o", "ev"], "the legit hb/o/ev survive the batch; the stale s, cpu-ev, end and q=9 are dropped");
  for (const ty of ["s2", "w", "ok", "jg", "end"]) assert.equal(sig(f, "b", sc, [{ t: ty, d: { q: 0, e: 0 } }], now, t.store), null, ty);
  assert.equal(sig(f, "a", sc, [{ t: "ev", d: { q: 0, e: 0, ty: "hum", p: 1 } }], now, t.store).m.length, 1);
  assert.equal(sig(f, "b", sc, [{ t: "cl", d: { q: 0, id: "tr1", t: 12 } }], now, t.store).m.length, 1, "any human may claim");
  assert.equal(sig(f, "b", sc, [{ t: "cl", d: { q: 2, id: "tr1", t: 12 } }], now, t.store), null);
});

test("aim: <= 64 B and <= 5 Hz; react: needs an id and is rate limited", () => {
  const t = liveRoom(), f = t.room, now = 9000;
  const aim = (at, d) => sig(f, "a", "b", [{ t: "aim", d: d || { x: 1, y: 2 } }], at, t.store);
  assert.ok(aim(now)); assert.equal(aim(now + 100), null, "5 Hz max"); assert.ok(aim(now + 250));
  assert.equal(aim(now + 900, { pad: "z".repeat(80) }), null, "over 64 B");
  assert.ok(aim(now + 900), "a dropped aim does not use up the slot");
  status(() => sig(f, "a", "b", [{ t: "react", d: {} }], now, t.store), 400);
  status(() => sig(f, "a", "b", [{ t: "react", d: { id: "x".repeat(30) } }], now, t.store), 400);
  let n = 0, e;
  const t2 = liveRoom({ code: "MJ02" });
  try { for (; n < 50; n++) sig(t2.room, "a", "b", [{ t: "react", d: { id: "heart" } }], 20000, t2.store); } catch (err) { e = err; }
  assert.ok(e && e.status === 429 && n >= 6 && n <= 12, "burst of ~8 then 429, got " + n);
});

test("hb writes the presence the judge election reads", () => {
  const t = liveRoom(), f = t.room;
  sig(f, "b", "b", [{ t: "hb", d: { rtt: 77.4, vis: 0 } }], 12345, t.store);
  assert.deepEqual(JSON.parse(t.store.get("fp:" + f.code + ":b")), { at: 12345, rtt: 77, vis: 0 });
  sig(f, "b", "m:" + f.board.mj.k, [{ t: "hb", d: { rtt: 99999 } }], 12400, t.store);
  assert.deepEqual(JSON.parse(t.store.get("fp:" + f.code + ":b")), { at: 12400, rtt: 5000, vis: 1 }, "rtt is clamped, vis defaults to visible");
});

test("per-sender bucket: 25 msg/s, burst 40, one key per seat", () => {
  const t = liveRoom(), f = t.room, sc = "m:" + f.board.mj.k;
  let sent = 0, e;
  try { for (let i = 0; i < 100; i++) { sig(f, "a", sc, [o()], 30000, t.store); sent++; } } catch (err) { e = err; }
  assert.equal(sent, 40); assert.equal(e.status, 429); assert.match(e.message, /Too many/);
  assert.ok(sig(f, "b", sc, [o()], 30000, t.store), "b has its own bucket");
  sent = 0; e = null;
  try { for (let i = 0; i < 100; i++) { sig(f, "a", sc, [o()], 31000, t.store); sent++; } } catch (err) { e = err; }
  assert.equal(sent, 25, "one second later: 25 tokens back"); assert.equal(e.status, 429);
  status(() => sig(f, "b", sc, new Array(10).fill(o()), 30000, t.store) && sig(f, "b", sc, new Array(10).fill(o()), 30000, t.store) && sig(f, "b", sc, new Array(10).fill(o()), 30000, t.store) && sig(f, "b", sc, new Array(10).fill(o()), 30000, t.store), 429);   // a batch costs one token per message
});

test("elegirJuez: lowest RTT, ties rotate with k, 1v3 solo steps aside, no data keeps the provisional, hidden tab is out", () => {
  const pj = { a: { cpu: null }, b: { cpu: null }, c: { cpu: null }, d: { cpu: "auto" } };
  const mj = (x) => Object.assign({ as: ["a", "b", "c", "d"], tipo: "ffa", solo: null, k: 1, juez: "a", suc: ["b", "c"] }, x);
  const pres = (r) => { const p = {}; for (const s in r) p[s] = { at: 10000, rtt: r[s], vis: 1 }; return p; };
  const now = 11000;
  assert.deepEqual(P.elegirJuez(mj(), pj, pres({ a: 120, b: 40, c: 90 }), now), { juez: "b", suc: ["c", "a"] });
  assert.equal(P.elegirJuez(mj({ k: 4 }), pj, pres({ a: 40, b: 50, c: 90 }), now).juez, "a", "a/b within 15 ms: k % 2 picks");
  assert.equal(P.elegirJuez(mj({ k: 5 }), pj, pres({ a: 40, b: 50, c: 90 }), now).juez, "b");
  assert.equal(P.elegirJuez(mj({ k: 6 }), pj, pres({ a: 40, b: 50, c: 90 }), now).juez, "a");
  assert.equal(P.elegirJuez(mj({ k: 7 }), pj, pres({ a: 40, b: 56, c: 90 }), now).juez, "a", "16 ms apart is not a tie: the best RTT wins whatever k is");
  assert.deepEqual(P.elegirJuez(mj(), pj, {}, now), { juez: "a", suc: ["b", "c"] }, "no presence: provisional stays");
  assert.deepEqual(P.elegirJuez(mj(), pj, { a: { at: 1000, rtt: 10, vis: 1 } }, now).juez, "a", "stale presence (>4 s) is no data");
  const hid = pres({ a: 20, b: 60, c: 90 }); hid.a.vis = 0;
  assert.equal(P.elegirJuez(mj(), pj, hid, now).juez, "b", "a hidden tab is not a candidate");
  assert.ok(P.elegirJuez(mj(), pj, hid, now).suc.indexOf("a") > 0, "but it stays in the succession list");
  assert.equal(P.elegirJuez(mj({ tipo: "1v3", solo: "a" }), pj, pres({ a: 30, b: 60, c: 90 }), now).juez, "b", "the solo yields when someone is within 40 ms");
  assert.equal(P.elegirJuez(mj({ tipo: "1v3", solo: "a" }), pj, pres({ a: 30, b: 90, c: 150 }), now).juez, "a", "...and keeps it when everybody is far");
});

test("relay cache: <= 1 s, invalidate forces a reload, and a judge CAS is visible to the very next relay", () => {
  const t = liveRoom(), f = t.room, store = memStore(), cache = P.relayCache(store);
  let loads = 0;
  const loader = () => { loads++; return P.slimRoom(JSON.parse(JSON.stringify(f))); };
  const a = cache.get(f.code, loader, 1000), b = cache.get(f.code, loader, 1900);
  assert.equal(loads, 1); assert.equal(JSON.stringify(a), JSON.stringify(b));
  cache.get(f.code, loader, 2001); assert.equal(loads, 2, "expires after 1 s");
  assert.ok(!JSON.stringify(a).includes('"u:'), "no account ids"); assert.ok(!JSON.stringify(a).includes("_f"), "no reducer secrets");
  assert.equal(a.keys.a, f.keys.a); assert.equal(a.board.mj.juez, "a");
  // judge a dies, b claims the judging (CAS), the route invalidates after the commit, b's snapshot goes through
  const mk = f.board.mj.k, snap = (e) => [{ t: "s", d: { q: 0, e: e, t: 300, p: [1, 2] } }];
  const relay = (id, m, now) => P.sigPayload(cache.get(f.code, loader, now), id, 0, m, now, store, "m:" + mk);
  assert.equal(relay("a", snap(0), 2100).m.length, 1);
  t.store.set("fs:" + f.code + ":a", "1000");   // the judge has been silent for > 1 s: b (first successor) may take over
  t.F(f, "juez", { id: "b", k: mk, e: 0, q: 0 }, 2150);
  assert.equal(relay("b", snap(1), 2200), null, "without invalidation the cached room still says a is the judge");
  cache.invalidate(f.code);
  assert.equal(relay("b", snap(1), 2210).m.length, 1, "after invalidate the new judge passes");
  assert.equal(relay("a", snap(0), 2220), null, "and the old one is silenced");
  const sinStore = { get: () => "", set() {} }; assert.doesNotThrow(() => P.relayCache(sinStore).invalidate("ZZZZ"), "a store without remove falls back to set");
});

test("auth on a slim room is the same as on the real one", () => {
  const t = liveRoom(), slim = P.slimRoom(t.room);
  assert.equal(P.auth(slim, "a", t.keys.a).id, "a");
  status(() => P.auth(slim, "a", t.keys.b), 403);
  status(() => P.auth(slim, "c", "x"), 403);   // CPU seats never have a key
});

test("classic rooms are untouched by the fiesta branch", () => {
  const room = P.newRoom("CLAS", "duo", 0);
  P.addPlayer(room, { name: "A" }, Math.random); P.addPlayer(room, { name: "B" }, Math.random);
  room.state = "round"; room.round = 3;
  const r = P.sigPayload(room, "a", 3, [{ t: "x", d: 1 }], 1000, memStore());
  assert.deepEqual(r, { from: "a", round: 3, m: [{ t: "x", d: 1 }] }, "same shape as before (no sc, no at)");
  status(() => P.sigPayload(room, "a", 2, [{ t: "x", d: 1 }], 1000, memStore()), 409);
});

test("request budget: the cadences of the spec fit the per-sender bucket for a whole game", () => {
  // the spec cadences per sender (M2-SPEC 2.2): o 12 Hz, i keepalive 4 Hz (<= 20 Hz while it changes), judge s 10 Hz, hb 1 Hz; the client batches into <= 20 POST/s.
  const t = liveRoom(), f = t.room, sc = "m:" + f.board.mj.k;
  const run = (id, perSec, seconds, build) => {
    let sent = 0;
    for (let ms = 0; ms < seconds * 1000; ms += 50) {   // one POST every 50 ms (20 req/s), carrying whatever is due
      const m = build(ms); if (!m.length) continue;
      sig(f, id, sc, m, 50000 + ms, t.store); sent += m.length;
    }
    return sent / seconds;
  };
  const due = (ms, hz) => Math.floor((ms + 50) * hz / 1000) > Math.floor(ms * hz / 1000);
  const player = (ms) => [].concat(due(ms, 12) ? [o()] : [], due(ms, 4) ? [{ t: "i", d: { q: 0, b: 0 } }] : [], due(ms, 1) ? [{ t: "hb", d: { rtt: 50 } }] : []);
  const rate = run("b", 0, 45, player);
  assert.ok(rate >= 14 && rate <= 20, "an owner sends ~17 msg/s for 45 s without a 429, got " + rate);
  const judge = (ms) => player(ms).filter((x) => x.t !== "o").concat(due(ms, 10) ? [{ t: "s", d: { q: 0, e: 0, t: ms, p: [1] } }] : []);
  assert.ok(run("a", 0, 45, judge) <= 16, "a judge sends ~15 msg/s");
  // one POST of <= 10 messages is one request but 10 tokens: the bucket, not the request count, bounds the traffic
  status(() => { for (let i = 0; i < 5; i++) sig(f, "b", sc, new Array(10).fill(o()), 99000, t.store); }, 429);
});

test("election hook: after the last LISTO the lowest-RTT human is judge (needs JUEZ_ELEGIR in the reducer)", (t) => {
  const R = P.reglas();
  if (typeof R.hashRes !== "function") { t.diagnostic("reducer has no JUEZ_ELEGIR/hashRes yet (M2-SPEC 3.2): election hook is wired but the reducer ignores it; skipped"); return; }
  const x = liveRoom({ pres: { a: 200, b: 20 } });
  assert.equal(x.room.board.mj.juez, "b"); assert.equal(x.room.board.mj.jz, 1);
});

/* ───── M3-TEAMS: formatos de equipo en mjfin (puntaje binario por asiento, recorte, puestos y pagos) ───── */
const fin = (id, o) => Object.assign({ id: id, q: 0, e: 0, kk: 900, sc: [0, 0, 0, 0], cpu: ["c", "d"] }, o);
const catDe = (g) => P.reglas().CATALOGO.filter((x) => x.g === g)[0];
/* cambia la línea de catálogo de un juego durante `fn` y la deja como estaba (el catálogo es un objeto compartido) */
function conCatalogo(g, patch, fn) {
  const c = catDe(g), antes = {};
  Object.keys(patch).forEach((k) => { antes[k] = c[k]; if (patch[k] === undefined) delete c[k]; else c[k] = patch[k]; });
  try { return fn(); } finally { Object.keys(antes).forEach((k) => { if (antes[k] === undefined) delete c[k]; else c[k] = antes[k]; }); }
}

test("2v2 f_futbolito: el marcador del equipo es la suma de sus goles, empata igual y paga 7/2 y 4/4", () => {
  const R = P.reglas(), lim = catDe("f_futbolito").lim;
  assert.deepEqual(lim, { scoreMax: 15, scoreRate: 0.5, minT: 44, finTemprano: 1 });
  let t = liveRoom({ game: "f_futbolito", dur: 60, tipo: "2v2" }), f = t.room, mj = f.board.mj;
  assert.deepEqual(mj.eq, [["a", "b"], ["c", "d"]]);
  status(() => t.F(f, "mjfin", fin("a", { sc: [3, 1, 2, 0] }), mj.startAt + 43000), 409, /early/i);   // minT 44 s
  const r = t.F(f, "mjfin", fin("a", { sc: [3, 1, 2, 0] }), mj.startAt + 44000);
  assert.equal(r.aj, false, "goles reales caben en los topes: el servidor no recorta");
  assert.deepEqual(f.board.mj.res.sc, [3, 1, 2, 0]);
  assert.deepEqual(f.board.mj.res.puestos, [1, 1, 2, 2], "4 goles contra 2");
  assert.deepEqual(f.board.mj.res.pagos, R.pagosMJ("2v2", [1, 1, 2, 2], f.board.r, { tot: f.board.tot, eq: [0, 0, 1, 1], solo: -1 }));
  assert.equal(f.board.mj.res.pagos[0], f.board.mj.res.pagos[1], "los dos compañeros cobran igual");
  // empate de equipos (2+1 contra 0+3): 4 monedas cada uno
  t = liveRoom({ game: "f_futbolito", dur: 60, tipo: "2v2" }); f = t.room; mj = f.board.mj;
  assert.equal(t.F(f, "mjfin", fin("a", { sc: [2, 1, 0, 3] }), mj.startAt + 50000).aj, false);
  assert.deepEqual(f.board.mj.res.puestos, [1, 1, 1, 1]);
  assert.deepEqual(f.board.mj.res.pagos, R.pagosMJ("2v2", [1, 1, 1, 1], f.board.r, { tot: f.board.tot, eq: [0, 0, 1, 1], solo: -1 }));
  // los equipos se arman por mj.eq, no por orden de asiento: a+c contra b+d
  t = liveRoom({ game: "f_futbolito", dur: 60, tipo: "2v2", eq: [["a", "c"], ["b", "d"]] }); f = t.room; mj = f.board.mj;
  t.F(f, "mjfin", fin("a", { sc: [1, 5, 1, 0] }), mj.startAt + 50000);
  assert.deepEqual(f.board.mj.res.puestos, [2, 1, 2, 1], "b+d (5) gana a a+c (2)");
});

test("2v2: un puntaje fuera de tope se recorta (nunca se rechaza) y queda marcado", () => {
  const t = liveRoom({ game: "f_futbolito", dur: 60, tipo: "2v2" }), f = t.room, mj = f.board.mj;
  const r = t.F(f, "mjfin", fin("a", { sc: [40, -3, 2.4, 1e9] }), mj.startAt + 44000);
  assert.equal(r.aj, true);
  assert.deepEqual(f.board.mj.res.sc, [15, 0, 2, 15], "[0, scoreMax] y enteros");
});

test("1v3 f_patilla (umbral): el solo gana con 3 golpes (30 > 25), con 2 gana el trío; el trío (25) nunca se recorta", () => {
  const R = P.reglas(), lim = catDe("f_patilla").lim;
  assert.deepEqual(lim, { scoreMax: 90, scoreRate: 12, minT: 6, finTemprano: 1 });
  for (const [hits, soloGana] of [[0, false], [2, false], [3, true], [9, true]]) {
    const t = liveRoom({ game: "f_patilla", dur: 35, tipo: "1v3", solo: "c" }), f = t.room, mj = f.board.mj;
    assert.equal(mj.solo, "c"); assert.deepEqual(mj.eq, [["c"], ["a", "b", "d"]]);
    const r = t.F(f, "mjfin", fin("a", { sc: [25, 25, 10 * hits, 25] }), mj.startAt + 20000);
    assert.equal(r.aj, false, hits + " golpes: sin recorte");
    const pu = f.board.mj.res.puestos;
    assert.deepEqual(pu, soloGana ? [2, 2, 1, 2] : [1, 1, 2, 1], hits + " golpes");
    assert.deepEqual(f.board.mj.res.pagos, R.pagosMJ("1v3", pu, f.board.r, { tot: f.board.tot, eq: [1, 1, 0, 1], solo: 2 }));
    assert.equal(f.board.mj.res.pagos[2], soloGana ? 12 : 0);
  }
});

test("1v3 f_patilla con dur=4 (el e2e): minT efectivo 3 s, el 25 del trío cabe en el ritmo y 9 golpes en 3 s se recortan", () => {
  const t = liveRoom({ game: "f_patilla", dur: 4, tipo: "1v3", solo: "c" }), f = t.room, mj = f.board.mj;
  status(() => t.F(f, "mjfin", fin("a", { sc: [25, 25, 30, 25] }), mj.startAt + 2000), 409);
  const r = t.F(f, "mjfin", fin("a", { sc: [25, 25, 90, 25] }), mj.startAt + 3000);
  assert.equal(r.aj, true, "12 pts/s · 4,5 s = 54 < 90");
  assert.deepEqual(f.board.mj.res.sc, [25, 25, 54, 25]);
  assert.deepEqual(f.board.mj.res.puestos, [2, 2, 1, 2]);
});

test("clampSc binary (DM3-16): TODOS los asientos se miden contra el tiempo real; en survival el mejor sigue valiendo el nominal", () => {
  // juego de equipo inventado (f_cava es 2v2 binary del catálogo sin runtime): rate 2/s, tope 100, finTemprano
  conCatalogo("f_cava", { lim: { scoreMax: 100, scoreRate: 2, minT: 3, finTemprano: 1 } }, () => {
    const t = liveRoom({ game: "f_cava", dur: 45, tipo: "2v2" }), f = t.room, mj = f.board.mj;
    const r = t.F(f, "mjfin", fin("a", { sc: [50, 10, 20, 0] }), mj.startAt + 5000);
    assert.equal(r.aj, true);
    assert.deepEqual(f.board.mj.res.sc, [13, 10, 13, 0], "2·(5+1,5) = 13 para todos, también el de mayor puntaje");
  });
  // survival con finTemprano: el superviviente (el mayor) usa dur completo (ya cubierto por f_mecate en party.test.js): aquí se comprueba que NO cambió
  const t2 = liveRoom({ game: "f_mecate", dur: 4 }), f2 = t2.room;
  t2.F(f2, "mjfin", fin("a", { sc: [121, 119, 100, 90] }), f2.board.mj.startAt + 3000);
  assert.deepEqual(f2.board.mj.res.sc, [121, 121, 100, 90]);
});

test("LIM_DEFECTO: sin `lim` en el catálogo, las líneas de futbolito y patilla recortan igual que con él", () => {
  for (const [g, tipo, dur, at, sc, extra] of [["f_futbolito", "2v2", 60, 44000, [40, 2, 0, 9], {}], ["f_patilla", "1v3", 35, 7000, [25, 25, 95, 25], { solo: "c" }]]) {
    const a = liveRoom(Object.assign({ game: g, dur: dur, tipo: tipo }, extra)); a.F(a.room, "mjfin", fin("a", { sc: sc }), a.room.board.mj.startAt + at);
    const b = conCatalogo(g, { lim: undefined }, () => {
      const x = liveRoom(Object.assign({ game: g, dur: dur, tipo: tipo }, extra)); x.F(x.room, "mjfin", fin("a", { sc: sc }), x.room.board.mj.startAt + at); return x;
    });
    assert.deepEqual(b.room.board.mj.res.sc, a.room.board.mj.res.sc, g);
    assert.equal(b.room.board.mj.res.aj, a.room.board.mj.res.aj, g);
  }
});

test("eqIdx: el reductor, el servidor y el cliente leen el mismo mapa asiento -> equipo", () => {
  const R = P.reglas();
  assert.equal(typeof R.eqIdx, "function");
  const mk = (tipo, eq, solo) => ({ tipo: tipo, as: ["a", "b", "c", "d"], eq: eq, solo: solo });
  const casos = [mk("ffa", [["a"], ["b"], ["c"], ["d"]], null), mk("2v2", [["a", "c"], ["b", "d"]], null), mk("1v3", [["b"], ["a", "c", "d"]], "b"), { tipo: "1v1", as: ["a", "b"], eq: [["a"], ["b"]], solo: null }];
  global.window = global; const LIVE = require("../docs/style-lab/fiesta-live.js"); global.FIESTA.reglas = R;
  for (const mj of casos) {
    assert.deepEqual(LIVE.util.eqIdx(mj), R.eqIdx(mj), mj.tipo);
    assert.deepEqual(R.eqIdx(mj), mj.tipo === "ffa" || mj.tipo === "1v1" ? mj.as.map((s, i) => i) : mj.as.map((s) => (mj.eq[0].indexOf(s) >= 0 ? 0 : 1)), mj.tipo);
  }
});
