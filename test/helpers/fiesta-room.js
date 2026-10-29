/* Test support for the server side of LA FIESTA M2 (pb_hooks/party.js + party_mj.js): builds a fiesta room that is inside a live minigame
   (board.f === 'mj') with two humans (a = host, b) and two CPU, with a known game/format forced into the queue. No PocketBase, no network. */
"use strict";
const P = require("../../pocketbase/pb_hooks/party.js");

function mkRand(seed) { let s = seed || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
/* the same Map-backed store shape as party_routes.js's ghostLimiter ({get,set,update,remove}) */
function memStore() {
  const m = new Map();
  return { get: (k) => m.get(k), set: (k, v) => { m.set(k, v); }, update: (k, fn) => { m.set(k, fn(m.get(k))); }, remove: (k) => { m.delete(k); }, m };
}
/* opts: { game: 'f_domino', dur: 30, store, seed, ready: true, pres: {a: 200, b: 20}, tipo: 'ffa'|'2v2'|'1v3', eq, solo } -> { room, keys:{a,b}, F, now, store } with board.f==='mj' (or 'carta' if ready:false) */
function liveRoom(opts) {
  opts = opts || {};
  const rand = mkRand(opts.seed), store = opts.store || memStore();
  const F = (room, action, body, now) => P.fiesta(room, action, body || {}, now || 0, rand, action === "join" ? body : null, store);
  const f = P.fiestaNew(opts.code || "MJ01", 0);
  const A = F(f, "join", { name: "Ana" }).you, B = F(f, "join", { name: "Beto" }).you;
  F(f, "ready", { id: "a" }, 1000); F(f, "ready", { id: "b" }, 1000); F(f, "start", { id: "a" }, 2000);
  let now = 2000;
  for (let i = 0; i < 5000 && !(f.board.f === "carta" && f.board.mj); i++) {
    for (const s of ["a", "b"]) if (f.board.pj[s].cpu === "afk") F(f, "back", { id: s }, now);
    now = Math.max(now, f.board.nextAt || now) + 1; P.fiestaTick(f, now, store);
  }
  if (!(f.board.f === "carta" && f.board.mj)) throw new Error("fiesta-room: no minigame reached");
  const mj = f.board.mj, g = opts.game || "f_domino", R = P.reglas();
  const cat = R.CATALOGO.filter((x) => x.g === g)[0];
  mj.cola = [Object.assign({}, mj.cola[0], { g: g, dur: opts.dur || (cat && cat.dur) || 30, lv: 1, modelo: (cat && cat.mo) || "A" })];
  mj.tipo = "ffa"; mj.eq = mj.as.map((s) => [s]); mj.solo = null; mj.rel = 0; mj.clase = (cat && cat.cl) || "rank";
  if (opts.tipo === "2v2") { mj.tipo = "2v2"; mj.eq = opts.eq || [[mj.as[0], mj.as[1]], [mj.as[2], mj.as[3]]]; }                       // M3-TEAMS: formats of two sides
  if (opts.tipo === "1v3") { mj.tipo = "1v3"; mj.solo = opts.solo || mj.as[2]; mj.eq = [[mj.solo], mj.as.filter((s) => s !== mj.solo)]; }
  mj.juez = "a"; mj.suc = ["b"]; mj.e = 0;
  if (opts.pres) for (const s of Object.keys(opts.pres)) store.set("fp:" + f.code + ":" + s, JSON.stringify({ at: now, rtt: opts.pres[s], vis: 1 }));   // presence the judge election reads
  if (opts.ready !== false) {
    F(f, "ready", { id: "a" }, now); F(f, "ready", { id: "b" }, now);
    if (f.board.f !== "mj") throw new Error("fiesta-room: LISTO did not start the game");
  }
  return { room: f, keys: { a: A.key, b: B.key }, F, now, store, rand };
}
module.exports = { liveRoom, memStore, mkRand };
