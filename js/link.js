'use strict';
/* Room mesh (at most three peers per player): unordered latest state and reliable events.
   HTTP/SSE remains available while any peer is disconnected. Screens use a separate relay request. */
const newLink = () => ({ id: '', pc: null, fast: null, rel: null, state: 'off', s: '', early: {}, since: 0, rx: 0, hello: 0, tries: 0, tryFor: '', rtt: 0, via: '', lastPong: 0, pingAt: 0 });
const link = newLink(), roomLinks = new Map();
const mainLink = link;
let linkRoom = '';
const lnow = () => performance.now() / 1000;
const partnersOf = R => R && party.you ? R.players.filter(p => !p.left && p.id !== party.you.id) : [];
const peerLink = id => { if (!roomLinks.has(id)) roomLinks.set(id, newLink()); return roomLinks.get(id); };
const linkReady = peer => peer.state === 'open' && lnow() - peer.rx < 2.5;
const linkUsable = () => { const peers = partnersOf(party.room); return peers.length > 0 && peers.every(p => roomLinks.has(p.id) && linkReady(roomLinks.get(p.id))); };
const linkChan = (w, peer) => { const c = w === 'f' ? peer.fast : peer.rel; return c && c.readyState === 'open' ? c : null; };
function linkRaw(w, obj, peer) { const c = linkChan(w, peer); if (c && c.bufferedAmount < (w === 'f' ? 16384 : 65536)) { try { c.send(JSON.stringify(obj)); return true; } catch (e) {} } return false; }
/* items = [{t, d, l}] from party.sig.q: `l` (latest-wins) ones go unordered, the rest reliably */
function linkSend(round, items) {
  const sent = [];
  for (const [channel, latest] of [['f', true], ['r', false]]) {
    const batch = items.filter(x => !!x.l === latest);
    if (!batch.length) continue;
    const packet = { round, m: batch.map(x => ({ t: x.t, d: x.d, n: x.n, v: x.v, l: !!x.l })) };
    let delivered = true;
    for (const p of partnersOf(party.room)) if (!linkRaw(channel, packet, peerLink(p.id))) delivered = false;
    if (delivered) sent.push(...batch);
  }
  return sent;
}
function linkClose(peer) {
  if (!peer) { for (const p of roomLinks.values()) linkClose(p); roomLinks.clear(); linkRoom = ''; Object.assign(mainLink, newLink()); return; }
  const link = peer;
  for (const ch of [link.fast, link.rel]) if (ch) ch.onmessage = ch.onopen = ch.onclose = null;
  try { if (link.pc) { link.pc.onicecandidate = link.pc.onconnectionstatechange = link.pc.ondatachannel = null; link.pc.close(); } } catch (e) {}
  link.pc = link.fast = link.rel = null; link.state = 'off'; link.early = {}; link.rtt = 0; link.via = '';
}
function gotPong(ts, via, peer = mainLink) { const link = peer; const r = lnow() - ts; if (r < 0 || r > 10) return; link.rtt = link.rtt && link.via === via ? link.rtt * .7 + r * .3 : r; link.via = via; link.lastPong = lnow(); }
function linkRx(raw, link) {
  let d; try { d = JSON.parse(raw); } catch (e) { return; }
  link.rx = lnow();
  if (d.p !== undefined) { linkRaw('f', { q: d.p }, link); return; }                 // ping -> pong straight back
  if (d.q !== undefined) { gotPong(d.q, 'p2p', link); return; }
  if (d.m && link.id) onSig({ from: link.id, round: d.round, m: d.m });
}
function hook(ch, link) {
  ch.onmessage = e => linkRx(e.data, link);
  const chk = () => { if (linkChan('f', link) && linkChan('r', link)) { link.state = 'open'; link.rx = lnow(); } };
  ch.onopen = chk; ch.onclose = () => { if (link.state === 'open') link.state = 'bad'; };
  chk();
}
function linkMake(X, link) {
  linkClose(link); link.id = X; link.state = 'wait'; link.since = lnow();
  const pc = link.pc = new RTCPeerConnection({ iceServers: rtcIceServers() });
  pc.onicecandidate = e => { if (e.candidate && link.pc === pc) vsend(X, 'dice', { s: link.s, c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
  pc.onconnectionstatechange = () => { if (link.pc === pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) link.state = 'bad'; };
  pc.ondatachannel = e => { link[e.channel.label === 'f' ? 'fast' : 'rel'] = e.channel; hook(e.channel, link); };
  return pc;
}
async function linkFlushEarly(link) {
  const pc = link.pc;
  const list = link.early[link.s] || []; delete link.early[link.s];
  for (const c of list) { try { await pc.addIceCandidate(c); } catch (e) {} }
}
async function linkOffer(X, link) {
  if (link.tryFor !== X) { link.tryFor = X; link.tries = 0; }
  if (link.tries >= 4) return; link.tries++;
  const pc = linkMake(X, link); link.s = Math.random().toString(36).slice(2, 8);
  link.fast = pc.createDataChannel('f', { ordered: false, maxRetransmits: 0 }); link.rel = pc.createDataChannel('r');
  hook(link.fast, link); hook(link.rel, link);
  try { const o = await pc.createOffer(); await pc.setLocalDescription(o); if (link.pc !== pc) return; vsend(X, 'doffer', { s: link.s, t: o.type, sdp: o.sdp }); } catch (e) { if (link.pc === pc) link.state = 'bad'; }
}
const linkNeedsOffer = (X, link) => !link.pc || link.id !== X || (link.state !== 'open' && lnow() - link.since > 6);
/* a link setup message from the partner (topic rooms/<id>/vsig) */
async function onLinkSig(d) {
  if (!d || !party.you || d.to !== party.you.id || !/^d/.test(d.k)) return;
  linkSync();
  const X = partnersOf(party.room).find(p => p.id === d.from); if (!X) return;
  const link = peerLink(X.id);
  const mine = party.you.id, g = d.d || {};
  try {
    if (d.k === 'dhello') { if (mine < X.id && link.state !== 'open' && (!link.pc || lnow() - link.since > 1.5)) linkOffer(X.id, link); }
    else if (d.k === 'doffer' && mine > X.id && g.sdp) {
      const early = link.early[g.s]; const pc = linkMake(X.id, link); if (early) link.early[g.s] = early; link.s = g.s; link.tryFor = X.id;
      await pc.setRemoteDescription({ type: g.t, sdp: g.sdp }); if (link.pc !== pc) return; await linkFlushEarly(link);
      const a = await pc.createAnswer(); await pc.setLocalDescription(a); if (link.pc !== pc) return; vsend(X.id, 'danswer', { s: g.s, t: a.type, sdp: a.sdp });
    } else if (d.k === 'danswer' && link.pc && g.s === link.s && g.sdp && link.pc.signalingState === 'have-local-offer') { await link.pc.setRemoteDescription({ type: g.t, sdp: g.sdp }); await linkFlushEarly(link); }
    else if (d.k === 'dice' && g.c) {
      if (link.pc && g.s === link.s && link.pc.remoteDescription) { try { await link.pc.addIceCandidate(g.c); } catch (e) {} }
      else { const q = link.early[g.s] = link.early[g.s] || []; if (q.length < 40) q.push(g.c); }
    }
  } catch (e) {}
}
function linkSync() {
  const roomId = party.room && party.room.id || '';
  if (roomId !== linkRoom) { linkClose(); linkRoom = roomId; }
  const active = new Set(partnersOf(party.room).map(p => p.id));
  for (const [id, peer] of roomLinks) if (!active.has(id)) { linkClose(peer); roomLinks.delete(id); }
}
function linkUpdate() {
  linkSync();
  const R = party.room, peers = partnersOf(R), t = lnow();
  if (!peers.length || !window.RTCPeerConnection) return;
  let relayPing = false;
  for (const X of peers) {
    const link = peerLink(X.id);
    if (link.state === 'open' && t - link.rx > 5) { link.state = 'bad'; link.since = t - 7; }
    if (link.tries >= 4 && t - link.since > 30) link.tries = 0;
    if (link.state !== 'open' && link.tries < 4) {
      if (party.you.id < X.id) { if (linkNeedsOffer(X.id, link)) linkOffer(X.id, link); }
      else if (t - link.hello > 1.5) { link.hello = t; vsend(X.id, 'dhello'); }
    }
    if (t - link.pingAt > 1) {
      link.pingAt = t;
      if (link.state === 'open') linkRaw('f', { p: t }, link);
      else relayPing = true;
    }
  }
  if (relayPing && R.state === 'round' && party.sig.round === R.round && !party.sig.q.some(m => m.t === '_net_ping')) party.sig.q.push({ t: '_net_ping', d: t, l: true });
  const measured = [...roomLinks.values()].filter(p => t - p.lastPong < 4 && p.rtt).sort((a, b) => b.rtt - a.rtt)[0];
  if (measured && linkUsable()) Object.assign(link, { rtt: measured.rtt, lastPong: measured.lastPong, via: 'p2p' });
}
setInterval(linkUpdate, 200);
/* text for the HUD / lobby */
const linkMs = () => lnow() - link.lastPong < 4 && link.rtt ? Math.round(link.rtt * 1000) : 0;
function linkLabel() { const ms = linkMs(); return ms ? t('{ms} MS · {via}', { ms, via: link.via === 'p2p' ? 'DIRECT' : 'RELAY' }) : ''; }
