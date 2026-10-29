/* LA FIESTA, M2: servidor de los minijuegos EN VIVO (docs/mario-party/M2-SPEC.md §3). Sin DOM, ES2015 para Goja (sin ?. ?? spread de objetos async).
   module.exports = function make(D) -> { fiestaSig, slimRoom, relayCache, elegirJuez, validarFin, validarAck, mejorTestigo, clampSc, K }
   D = { fail, PartyError, player, reglas, SIG_MAX, SIG_COUNT, reactLimit }. Nada de aquí escribe en la sala: el relé es la ruta caliente. */
module.exports = function make(D) {
  const fail = D.fail;
  const K = {
    BUCKET_BURST: 40, BUCKET_PER_S: 25,      // tope por emisor: 25 mensajes/s, ráfaga 40 (cubeta fl:<code>:<id>)
    AIM_MS: 200, AIM_MAX: 64,                // `aim`: ≤5 Hz y ≤64 B
    X_MAX: 200, MSG_MAX: 420,                // tipos x* ≤200 B, cualquier mensaje ≤420 B
    CACHE_MS: 1000,                          // TTL de la sala delgada del relé
    PRES_MS: 4000, RTT_TIE: 15, SOLO_RTT: 40, // elección de juez
    EARLY_SLACK_MS: 400,
    CLAIM_SLACK_MS: 3000, CLAIM_FUT_MS: 500, // ventana del `t` de un claim respecto a la hora real
    JUEZ_SIL_MS: 1000, JUEZ_SIL_ANY_MS: 3000, // silencio del juez que habilita un relevo (el sucesor 1.º / cualquiera)
  };
  const BASE = ["hb", "aim", "react", "_net_ping", "_net_pong"];                                          // alcance 'b'
  const MJ_TYPES = ["hb", "i", "o", "s", "s2", "w", "ev", "end", "cl", "ok", "jg", "rdy", "react", "_net_ping", "_net_pong"];
  const JUDGE_TYPES = ["s", "s2", "w", "ok", "jg", "end"];
  const Q_TYPES = ["i", "o", "ev", "cl"];
  const X_RE = /^x[a-z0-9]{1,11}$/;
  const LIM_DEFECTO = {   // respaldo si el catálogo del reductor aún no trae `lim` (la fuente es FIESTA.reglas.CATALOGO, DM2-3)
    f_mecate: { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: 1 },
    f_domino: { scoreMax: 1000, scoreRate: 40, minT: 27, finTemprano: 0 },
    f_toro: { scoreMax: 700, scoreRate: 40, minT: 27, finTemprano: 0 },
    f_harina: { scoreMax: 800, scoreRate: 25, minT: 27, finTemprano: 0 },
    f_futbolito: { scoreMax: 15, scoreRate: 0.5, minT: 44, finTemprano: 1 },   // M3-TEAMS: 2v2, puntaje binario por asiento (goles)
    f_patilla: { scoreMax: 90, scoreRate: 12, minT: 6, finTemprano: 1 },       // M3-TEAMS: 1v3 de umbral (solo = 10·golpes, trío = 25 constante)
    f_cotufas: { scoreMax: 120, scoreRate: 5, minT: 27, finTemprano: 0 },
    f_cava: { scoreMax: 30, scoreRate: 1, minT: 30, finTemprano: 0 },
    f_alcabala: { scoreMax: 30, scoreRate: 8, minT: 5, finTemprano: 1 },
    f_cola: { scoreMax: 125, scoreRate: 30, minT: 4, finTemprano: 1 },
    f_tequeno: { scoreMax: 300, scoreRate: 10, minT: 27, finTemprano: 0 },
    f_abuela: { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: 1 },
    f_cerro: { scoreMax: 2100, scoreRate: 150, minT: 8, finTemprano: 1 },
    f_bolas: { scoreMax: 12, scoreRate: 1, minT: 26, finTemprano: 1 },
    f_vagon: { scoreMax: 1501, scoreRate: 31, minT: 6, finTemprano: 1 },
    f_bombillo: { scoreMax: 1351, scoreRate: 31, minT: 3, finTemprano: 1 },
    f_silbon: { scoreMax: 16, scoreRate: 8, minT: 5, finTemprano: 1 },
    f_bombita: { scoreMax: 1201, scoreRate: 31, minT: 3, finTemprano: 1 },
    f_hallacas: { scoreMax: 16, scoreRate: 0.45, minT: 44, finTemprano: 0 },
    f_bono: { scoreMax: 60, scoreRate: 8, minT: 6, finTemprano: 1 },
    f_perro: { scoreMax: 950, scoreRate: 200, minT: 4, finTemprano: 1 },
  };
  const num = (x) => typeof x === "number" && isFinite(x);
  const clamp = (lo, hi, v) => Math.max(lo, Math.min(hi, v));
  const int = (x) => (num(+x) ? Math.round(+x) : 0);
  const upd = (store, key, fn) => { if (typeof store.update === "function") store.update(key, fn); else store.set(key, fn(store.get(key))); };
  const parse = (raw) => { try { const v = JSON.parse(raw); return v && typeof v === "object" ? v : null; } catch (_) { return null; } };

  /* ───── relé: alcances 'b' y 'm:<k>' ───── */
  function fiestaSig(room, id, sc, m, now, store) {
    now = num(now) ? now : Date.now();
    const p = D.player(room, id);
    if (!p || p.left) fail("Not in this room", 403);
    if (typeof sc !== "string" || !/^(b|m:\d{1,6})$/.test(sc)) fail("Bad scope", 400);
    if (!Array.isArray(m) || !m.length || m.length > D.SIG_COUNT) fail("Bad message", 400);
    const b = room.board, mj = b && b.mj, inM = sc !== "b";
    if (inM) {
      if (!mj || +sc.slice(2) !== mj.k || (b.f !== "carta" && b.f !== "mj")) fail("Round is over", 409);
      if (mj.as.indexOf(id) < 0) fail("Not in this round", 403);
    }
    const out = [];
    for (let j = 0; j < m.length; j++) {
      const x = m[j];
      const raw = x && x.t !== undefined && x.t !== null ? String(x.t) : "";
      const isX = X_RE.test(raw);
      if (isX ? !inM : (inM ? MJ_TYPES : BASE).indexOf(raw) < 0) fail("Bad message", 400);
      const o = { t: raw, d: x.d !== undefined ? x.d : null };
      if (Number.isSafeInteger(x.n) && x.n > 0) {
        o.n = x.n; o.l = x.l === true;
        if (typeof x.v === "string" && /^[a-z0-9]{1,24}$/.test(x.v)) o.v = x.v;
      }
      const d = o.d, ds = JSON.stringify(d);
      if (ds && ds.length > K.MSG_MAX) fail("Message too big", 413);
      if (isX) {
        if (!d || typeof d !== "object" || Array.isArray(d)) fail("Bad message", 400);
        if (ds.length > K.X_MAX) fail("Message too big", 413);
        if (d.q !== mj.i) continue;
        out.push(o); continue;
      }
      if (raw === "aim") {
        if (ds.length > K.AIM_MAX) continue;
        if (store) {
          let pass = true;
          upd(store, "fa:" + room.code + ":" + id, (old) => { const at = +old || 0; if (now - at < K.AIM_MS) { pass = false; return old; } return String(now); });
          if (!pass) continue;
        }
        out.push(o); continue;
      }
      if (raw === "react") {
        if (!d || typeof d.id !== "string" || d.id.length > 24) fail("Bad react", 400);
        D.reactLimit(room, id, now, store);
        out.push(o); continue;
      }
      if (raw === "hb" && store) {
        const dd = d && typeof d === "object" ? d : {};
        store.set("fp:" + room.code + ":" + id, JSON.stringify({ at: now, rtt: clamp(0, 5000, int(dd.rtt)), vis: dd.vis === 0 ? 0 : 1 }));
      }
      if (inM && store && id === mj.juez) store.set("fs:" + room.code + ":" + id, String(now));   // el juez está vivo mientras habla (no solo en el `hb` de 2 s)
      if (inM) {
        if (raw === "ev" && d && d.ty !== "cpu" && d.ty !== "hum" && id !== mj.juez && d.p !== mj.as.indexOf(id)) continue;   // un evento solo vale para el asiento de quien lo manda (el juez puede hablar por sus CPU)
        if (raw === "cl" && d && mj.startAt != null) {   // el `t` del claim se acota a la hora real de la ronda (si no, t=-1e9 gana siempre)
          const rel = now - mj.startAt, tt = num(d.t) ? d.t : rel;
          if (tt < rel - K.CLAIM_SLACK_MS || tt > rel + K.CLAIM_FUT_MS) { o.d = Object.assign({}, d, { t: clamp(rel - K.CLAIM_SLACK_MS, rel + K.CLAIM_FUT_MS, tt) }); }
        }
        const judgeT = JUDGE_TYPES.indexOf(raw) >= 0 || (raw === "ev" && d && (d.ty === "cpu" || d.ty === "hum"));
        if (judgeT) {
          if (id !== mj.juez || !d || d.e !== mj.e || d.q !== mj.i) continue;       // DM2-8: se descarta en silencio
        } else if (Q_TYPES.indexOf(raw) >= 0 && (!d || d.q !== mj.i)) continue;
      }
      out.push(o);
    }
    if (store) {   // cubeta por emisor (una clave por asiento: nada de serializar la sala entera)
      let ok = true;
      upd(store, "fl:" + room.code + ":" + id, (old) => {
        const s = parse(old), have = s ? Math.min(K.BUCKET_BURST, (+s[0] || 0) + Math.max(0, now - (+s[1] || 0)) * K.BUCKET_PER_S / 1000) : K.BUCKET_BURST;
        if (have < m.length) { ok = false; return old; }
        return JSON.stringify([have - m.length, now]);
      });
      if (!ok) fail("Too many messages", 429);
    }
    if (!out.length) return null;
    if (JSON.stringify(out).length > D.SIG_MAX) fail("Message too big", 413);
    return { from: id, sc: sc, at: now, m: out };
  }

  /* relevo de juez (CAS `juez`): el juez actual debe llevar callado > JUEZ_SIL_MS (hb de presencia o cualquier mensaje suyo) y quien pide ser el 1.º sucesor;
     cualquier otro humano solo tras JUEZ_SIL_ANY_MS.  */
  function relevoPermitido(room, id, now, store) {
    const mj = room.board.mj, j = mj.juez;
    const a = parse(store.get("fp:" + room.code + ":" + j)), b = +store.get("fs:" + room.code + ":" + j);
    const last = Math.max(a && num(a.at) ? a.at : -Infinity, num(b) && b ? b : -Infinity);
    const sinDato = last === -Infinity;   // sin rastro del juez: solo cuenta como silencio pasados JUEZ_SIL_ANY_MS desde el arranque
    const age = sinDato ? (mj.startAt != null ? now - mj.startAt : 0) : now - last;
    const primero = (mj.suc || [])[0] === id;
    if (sinDato ? age > K.JUEZ_SIL_ANY_MS : (primero && age > K.JUEZ_SIL_MS) || age > K.JUEZ_SIL_ANY_MS) return;
    fail("Judge changed", 409);
  }

  /* ───── sala delgada y caché del relé (DM2-12) ───── */
  function slimRoom(o) {
    const players = [], keys = {}, pj = {}, bd = o.board || {};
    for (let i = 0; i < o.players.length; i++) {
      const p = o.players[i];
      players.push({ id: p.id, left: !!p.left, cpu: !!p.cpu });
      if (o.keys && typeof o.keys[p.id] === "string") keys[p.id] = o.keys[p.id];
    }
    const src = bd.pj || {};
    for (const s in src) pj[s] = { cpu: src[s].cpu === undefined ? null : src[s].cpu };
    const mj = bd.mj ? { k: bd.mj.k, i: bd.mj.i, juez: bd.mj.juez, e: bd.mj.e, as: bd.mj.as, startAt: bd.mj.startAt, cierre: bd.mj.cierre, cartaHasta: bd.mj.cartaHasta, rel: bd.mj.rel, jz: bd.mj.jz } : null;
    return { code: o.code, mode: o.mode, ver: o.ver || 0, players: players, keys: keys, board: { f: bd.f, pj: pj, mj: mj } };
  }
  function relayCache(store) {
    return {
      get: (code, loader, now) => {
        now = num(now) ? now : Date.now();
        const seq = String(store.get("fx:" + code) || "0");   // contador de invalidaciones: una carga que cruza un commit no repuebla la caché con la sala vieja
        const hit = parse(store.get("fr:" + code));
        if (hit && num(hit.at) && now - hit.at < K.CACHE_MS && hit.v && hit.s === seq) return hit.v;
        const v = loader();
        if (v && String(store.get("fx:" + code) || "0") === seq) store.set("fr:" + code, JSON.stringify({ at: now, s: seq, v: v }));
        return v || null;
      },
      invalidate: (code) => { store.set("fx:" + code, String((+store.get("fx:" + code) || 0) + 1)); if (typeof store.remove === "function") store.remove("fr:" + code); },
      purge: (room) => {   // al borrar la sala (gc): fuera todas sus claves del almacén
        const code = room.code, ks = ["fr:" + code, "fx:" + code];
        (room.players || []).forEach((p) => { ["fp:", "fl:", "fa:", "fs:"].forEach((x) => ks.push(x + code + ":" + p.id)); });
        ks.forEach((k) => { if (typeof store.remove === "function") store.remove(k); else store.set(k, ""); });
      },
    };
  }

  /* ───── elección del juez (DM2-9, pura) ───── */
  function elegirJuez(mj, pj, pres, now) {
    pres = pres || {};
    const humanos = mj.as.filter((s) => pj[s] && pj[s].cpu === null);
    let cand = humanos.filter((s) => pres[s] && now - pres[s].at <= K.PRES_MS && pres[s].vis !== 0);
    if (!cand.length) return { juez: mj.juez, suc: mj.suc || [] };
    const rtt = (s) => (pres[s] && num(pres[s].rtt) ? pres[s].rtt : 9999);
    if (mj.tipo === "1v3" && mj.solo && cand.indexOf(mj.solo) >= 0 && cand.some((c) => c !== mj.solo && rtt(c) <= rtt(mj.solo) + K.SOLO_RTT)) cand = cand.filter((s) => s !== mj.solo);
    const byRtt = (a, c) => rtt(a) - rtt(c) || (a < c ? -1 : a > c ? 1 : 0);
    cand = cand.slice().sort(byRtt);
    const best = rtt(cand[0]), G = cand.filter((s) => rtt(s) <= best + K.RTT_TIE).sort();
    const juez = G[(mj.k | 0) % G.length];
    const suc = cand.filter((s) => s !== juez).concat(humanos.filter((s) => cand.indexOf(s) < 0 && s !== juez).sort());
    return { juez: juez, suc: suc };
  }

  /* ───── resultados: respaldos de lo que el reductor exporta (hashRes/normSurvival/puestos, §3.2) ───── */
  function hashRes(sc, pl, kk) {
    const R = D.reglas();
    if (R.hashRes) return R.hashRes(sc, pl, kk);
    const str = sc.join(",") + "|" + pl.join(",") + "|" + kk;
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function normSurvival(sc) {
    const R = D.reglas();
    if (R.normSurvival) return R.normSurvival(sc);
    const idx = sc.map((v, i) => i).sort((a, c) => sc[c] - sc[a] || a - c), out = sc.slice();
    let from = 0;
    for (let i = 1; i <= idx.length; i++) {
      if (i === idx.length || sc[idx[i - 1]] - sc[idx[i]] > 3) {
        const top = sc[idx[from]];
        for (let j = from; j < i; j++) out[idx[j]] = top;
        from = i;
      }
    }
    return out;
  }
  const eqIdx = (mj) => {
    const R = D.reglas();
    if (R && typeof R.eqIdx === "function") return R.eqIdx(mj);   // una sola definición del mapa asiento -> equipo (reductor); la copia de abajo es el respaldo
    return mj.as.map((s, i) => {
      if (mj.tipo === "ffa" || mj.tipo === "1v1") return i;
      for (let j = 0; j < mj.eq.length; j++) if (mj.eq[j].indexOf(s) >= 0) return j;
      return i;
    });
  };
  function puestos(mj, sc, cl) {
    const R = D.reglas();
    if (R.puestos) return R.puestos(mj.tipo, eqIdx(mj), sc, cl);
    const s2 = cl === "survival" ? normSurvival(sc) : sc;
    return R.compara(mj.tipo === "1v3" ? "1v3" : mj.tipo === "2v2" ? "2v2" : "ffa", eqIdx(mj), s2).puestos;
  }
  function catOf(room) {
    const mj = room.board.mj, g = mj.cola[mj.i], R = D.reglas();
    const cat = R.CATALOGO.filter((x) => x.g === g.g)[0] || { g: g.g, cl: mj.clase || "rank" };
    const lim = cat.lim || LIM_DEFECTO[g.g] || { scoreMax: 100000, scoreRate: 100000, minT: 1, finTemprano: 0 };
    return { cl: mj.rel ? "rank" : cat.cl || "rank", lim: lim, dur: g.dur };
  }
  /* recorta (nunca rechaza) los puntajes a [0, min(scoreMax, scoreRate·(t+1,5))] y normaliza `survival`.
     finTemprano en rank/survival: el superviviente que acaba antes de tiempo vale el nominal dur·30+1, así que SOLO el asiento de mayor puntaje se mide
     contra la duración completa (los demás, contra el tiempo real).
     binary (2v2 / 1v3, M3-TEAMS DM3-16): los puntajes son recuentos por asiento (goles, golpes) o constantes de umbral, nada vale «el nominal»: TODO
     asiento se mide contra el tiempo real transcurrido, también con finTemprano. Si no, un juez tramposo podría cerrar en minT con el tope entero. */
  function clampSc(room, sc, elapsed) {
    const c = catOf(room), real = clamp(0, c.dur, elapsed), nominal = !!c.lim.finTemprano && c.cl !== "binary";
    const cap = Math.floor(Math.min(c.lim.scoreMax, c.lim.scoreRate * ((nominal ? c.dur : real) + 1.5)));
    let aj = false;
    let top = -1;
    if (nominal) sc.forEach((v, i) => { if (top < 0 || v > sc[top]) top = i; });
    const capR = Math.floor(Math.min(cap, c.lim.scoreRate * (real + 1.5)));
    const out = sc.map((v, i) => { const r = Math.round(v), w = clamp(0, i === top ? cap : capR, r); if (w !== r) aj = true; return w; });
    return { sc: c.cl === "survival" ? normSurvival(out) : out, aj: aj, cl: c.cl };
  }
  function validarFin(room, id, body, now) {
    const b = room.board, mj = b.mj, n = mj ? mj.as.length : 0;
    if (!mj) fail("Not now", 409);
    const cpu = body.cpu === undefined ? [] : body.cpu;
    if (!mj || !Array.isArray(body.sc) || body.sc.length !== n || !body.sc.every(num) || !Array.isArray(cpu) || cpu.length > 4 ||
        !cpu.every((s) => typeof s === "string" && mj.as.indexOf(s) >= 0) || !num(body.kk) || !num(body.q) || !num(body.e)) fail("Bad result", 400);
    if (mj.as.indexOf(id) < 0) fail("Not your seat", 403);
    if (b.f !== "mj" || body.q !== mj.i) fail("Not now", 409);
    if (id !== mj.juez || body.e !== mj.e) fail("Judge changed", 409);
    const c = catOf(room), minT = Math.min(c.lim.minT, c.dur - 1);
    if (now < mj.startAt + minT * 1000 - K.EARLY_SLACK_MS) fail("Too early", 409);
    const r = clampSc(room, body.sc, (now - mj.startAt) / 1000);
    const h = hashRes(r.sc, puestos(mj, r.sc, r.cl), int(body.kk));
    const w = ackDe(room);
    let dis = 0, ok = 0;
    const liar = !r.aj && body.h !== h;   // el juez anunció un hash que no es el del servidor sin que el recorte lo explique
    for (const s in w) {
      if (w[s].h === h) ok++;
      if (w[s].h !== h && (liar || w[s].h !== body.h)) dis++;   // un testigo que ve lo mismo que el juez anunció no disputa (aunque el servidor recorte)
    }
    /* el juez no decide solo: si >=2 testigos coinciden en otro `sc` y superan a los que coinciden con el servidor, paga la mayoría (equipos: el juez suele ser del bando que gana) */
    let por = "juez", sc = r.sc, hh = h;
    if (dis >= 2) {
      const grp = {};
      for (const s in w) if (w[s].h !== h && Array.isArray(w[s].sc) && w[s].sc.length === n) {
        const k = w[s].sc.join(","), g = grp[k] || (grp[k] = { n: 0, sc: w[s].sc, kk: w[s].kk });
        g.n++;
      }
      let best = null;
      for (const k in grp) if (!best || grp[k].n > best.n) best = grp[k];
      if (best && best.n >= 2 && best.n > ok) {
        const rw = clampSc(room, best.sc.slice(), (now - mj.startAt) / 1000);
        sc = rw.sc; hh = hashRes(sc, puestos(mj, sc, rw.cl), int(best.kk)); por = "testigo";
      }
    }
    return { sc: sc, aj: r.aj, h: hh, cpu: Array.from(new Set(cpu)), disputado: dis >= 2, por: por };
  }
  function ackDe(room) {
    const mw = room.extra && room.extra.mjw, mj = room.board.mj;
    return mw && mj && mw.k === mj.k && mw.i === mj.i && mw.w ? mw.w : {};
  }
  function validarAck(room, id, body, now) {
    const b = room.board, mj = b.mj;
    if (!mj) fail("Not now", 409);
    if (mj.as.indexOf(id) < 0) fail("Not your seat", 403);
    if (b.f !== "mj" || body.q !== mj.i) fail("Not now", 409);
    if (!num(body.kk) || !num(body.e) || !num(body.h) || !Array.isArray(body.sc) || body.sc.length !== mj.as.length || !body.sc.every(num)) fail("Bad result", 400);
    if (num(now) && mj.startAt != null && now < mj.startAt) fail("Not now", 409);
    const dur = catOf(room).dur, ela = num(now) && mj.startAt != null ? Math.max(0, (now - mj.startAt) / 1000) : dur;
    const kmax = Math.round(Math.min(dur, ela + 1) * 30);   // un testigo no puede declarar más tick de los que han pasado
    return { e: int(body.e), kk: clamp(0, kmax, int(body.kk)), h: body.h >>> 0, sc: body.sc.map(int) };
  }
  /* el testigo vale por mayoría de coincidencia en `sc` (un testigo solo no decide con otros discrepando); a igualdad, mayor kk */
  function mejorTestigo(mjw, k, i) {
    if (!mjw || mjw.k !== k || mjw.i !== i || !mjw.w) return null;
    const grp = {};
    Object.keys(mjw.w).sort().forEach((s) => {
      const w = mjw.w[s];
      if (!w || !Array.isArray(w.sc)) return;
      const key = w.sc.join(",");
      const g = grp[key] || (grp[key] = { n: 0, sc: w.sc, kk: -1, seat: s });
      g.n++; if (w.kk > g.kk) { g.kk = w.kk; g.seat = s; }
    });
    let best = null;
    Object.keys(grp).forEach((key) => { const g = grp[key]; if (!best || g.n > best.n || (g.n === best.n && g.kk > best.kk)) best = g; });
    return best ? { sc: best.sc, kk: best.kk, seat: best.seat } : null;
  }

  return { relevoPermitido, fiestaSig, slimRoom, relayCache, elegirJuez, validarFin, validarAck, mejorTestigo, clampSc, hashRes, normSurvival, puestos, K };
};
