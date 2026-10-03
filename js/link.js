'use strict';
/* DUO direct link: a WebRTC DataChannel between the two players of a DUO room, used instead of the server relay (POST /api/party/sig +
   realtime) while it works: no HTTP round trip per message, no head-of-line wait. Two channels: 'f' (unordered, no retransmits) for
   "latest value wins" messages such as positions, and 'r' (ordered, reliable) for events. Setup messages travel through
   POST /api/party/vsig (kinds dhello/doffer/danswer/dice). If the link can't open (strict networks, no WebRTC) or goes quiet, sigFlush in
   party.js simply keeps using the relay, so a round never depends on it. Also measures the round-trip time shown in the DUO HUD. */
const link = { id: '', pc: null, fast: null, rel: null, state: 'off', s: '', early: {}, since: 0, rx: 0, hello: 0, tries: 0, tryFor: '', rtt: 0, via: '', lastPong: 0, pingAt: 0 };
const lnow = () => performance.now() / 1000;
const partnerOf = R => {
  if (!R || R.mode !== 'duo' || !party.you) return null;
  const act = R.players.filter(p => !p.left); return act.length === 2 ? act.find(p => p.id !== party.you.id) || null : null;
};
const linkUsable = () => link.state === 'open' && lnow() - link.rx < 2.5;
const linkChan = w => { const c = w === 'f' ? link.fast : link.rel; return c && c.readyState === 'open' ? c : null; };
function linkRaw(w, obj) { const c = linkChan(w); if (c) { try { c.send(JSON.stringify(obj)); return true; } catch (e) {} } return false; }
/* items = [{t, d, l}] from party.sig.q: `l` (latest-wins) ones go unordered, the rest reliably */
function linkSend(round, items) {
  const fast = items.filter(x => x.l).map(x => ({ t: x.t, d: x.d })), rel = items.filter(x => !x.l).map(x => ({ t: x.t, d: x.d }));
  if (fast.length) linkRaw('f', { round, m: fast });
  if (rel.length) linkRaw('r', { round, m: rel });
}
function linkClose() {
  try { if (link.pc) { link.pc.onicecandidate = link.pc.onconnectionstatechange = link.pc.ondatachannel = null; link.pc.close(); } } catch (e) {}
  link.pc = link.fast = link.rel = null; link.state = 'off'; link.early = {}; link.rtt = 0; link.via = '';
}
function gotPong(ts, via) { const r = lnow() - ts; if (r < 0 || r > 10) return; link.rtt = link.rtt && link.via === via ? link.rtt * .7 + r * .3 : r; link.via = via; link.lastPong = lnow(); }
function linkRx(raw) {
  let d; try { d = JSON.parse(raw); } catch (e) { return; }
  link.rx = lnow();
  if (d.p !== undefined) { linkRaw('f', { q: d.p }); return; }                 // ping -> pong straight back
  if (d.q !== undefined) { gotPong(d.q, 'p2p'); return; }
  if (d.m && link.id) onSig({ from: link.id, round: d.round, m: d.m });
}
function hook(ch) {
  ch.onmessage = e => linkRx(e.data);
  const chk = () => { if (linkChan('f') && linkChan('r')) { link.state = 'open'; link.rx = lnow(); } };
  ch.onopen = chk; ch.onclose = () => { if (link.state === 'open') link.state = 'bad'; };
  chk();
}
function linkMake(X) {
  linkClose(); link.id = X; link.state = 'wait'; link.since = lnow();
  const pc = link.pc = new RTCPeerConnection({ iceServers: VOICE_ICE });
  pc.onicecandidate = e => { if (e.candidate && link.pc === pc) vsend(X, 'dice', { s: link.s, c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
  pc.onconnectionstatechange = () => { if (link.pc === pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) link.state = 'bad'; };
  pc.ondatachannel = e => { link[e.channel.label === 'f' ? 'fast' : 'rel'] = e.channel; hook(e.channel); };
  return pc;
}
async function linkFlushEarly() {
  const list = link.early[link.s] || []; delete link.early[link.s];
  for (const c of list) { try { await link.pc.addIceCandidate(c); } catch (e) {} }
}
async function linkOffer(X) {
  if (link.tryFor !== X) { link.tryFor = X; link.tries = 0; }
  if (link.tries >= 4) return; link.tries++;
  const pc = linkMake(X); link.s = Math.random().toString(36).slice(2, 8);
  link.fast = pc.createDataChannel('f', { ordered: false, maxRetransmits: 0 }); link.rel = pc.createDataChannel('r');
  hook(link.fast); hook(link.rel);
  try { const o = await pc.createOffer(); await pc.setLocalDescription(o); vsend(X, 'doffer', { s: link.s, t: o.type, sdp: o.sdp }); } catch (e) { link.state = 'bad'; }
}
const linkNeedsOffer = X => !link.pc || link.id !== X || (link.state !== 'open' && lnow() - link.since > 6);
/* a link setup message from the partner (topic rooms/<id>/vsig) */
async function onLinkSig(d) {
  const X = partnerOf(party.room); if (!X || !d || d.from !== X.id || d.to !== party.you.id || !/^d/.test(d.k)) return;
  const mine = party.you.id, g = d.d || {};
  try {
    if (d.k === 'dhello') { if (mine < X.id && link.state !== 'open' && (!link.pc || lnow() - link.since > 1.5)) linkOffer(X.id); }
    else if (d.k === 'doffer' && mine > X.id && g.sdp) {
      const pc = linkMake(X.id); link.s = g.s; link.tryFor = X.id;
      await pc.setRemoteDescription({ type: g.t, sdp: g.sdp }); await linkFlushEarly();
      const a = await pc.createAnswer(); await pc.setLocalDescription(a); vsend(X.id, 'danswer', { s: g.s, t: a.type, sdp: a.sdp });
    } else if (d.k === 'danswer' && link.pc && g.s === link.s && g.sdp && link.pc.signalingState === 'have-local-offer') { await link.pc.setRemoteDescription({ type: g.t, sdp: g.sdp }); await linkFlushEarly(); }
    else if (d.k === 'dice' && g.c) {
      if (link.pc && g.s === link.s && link.pc.remoteDescription) { try { await link.pc.addIceCandidate(g.c); } catch (e) {} }
      else { const q = link.early[g.s] = link.early[g.s] || []; if (q.length < 40) q.push(g.c); }
    }
  } catch (e) {}
}
setInterval(() => {
  const R = party.room, X = partnerOf(R), t = lnow();
  if (!X || !window.RTCPeerConnection) { if (link.pc) linkClose(); return; }
  if (link.id && link.id !== X.id) linkClose();
  if (link.state !== 'open' && link.tries < 4) {
    if (party.you.id < X.id) { if (linkNeedsOffer(X.id)) linkOffer(X.id); }
    else if (t - link.hello > 1.5) { link.hello = t; vsend(X.id, 'dhello'); }        // I'm the one who waits for the offer: poke the other side
  }
  if (t - link.pingAt > 1) {
    link.pingAt = t;
    if (linkUsable()) linkRaw('f', { p: t });
    else if (R.state === 'round' && party.sig.round === R.round) party.sig.q.push({ t: 'ping', d: t, l: true });   // through the relay
  }
}, 200);
/* text for the HUD / lobby */
const linkMs = () => lnow() - link.lastPong < 4 && link.rtt ? Math.round(link.rtt * 1000) : 0;
function linkLabel() { const ms = linkMs(); return ms ? t('{ms} MS · {via}', { ms, via: link.via === 'p2p' ? 'DIRECT' : 'RELAY' }) : ''; }
