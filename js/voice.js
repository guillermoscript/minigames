'use strict';
/* Voice chat for PARTY rooms: WebRTC audio in a mesh (a room has at most 4 players, so at most 3 connections each).
   Audio goes straight between the browsers. The server only relays the tiny setup messages (offer / answer / ICE candidates)
   through POST /api/party/vsig, pushed to the room over realtime (topic rooms/<id>/vsig). Off by default: nothing connects and no
   permission is asked until the player turns the mic on. Everything fails soft; the game never depends on it.
   Only STUN is configured: players behind very strict networks may not connect (a TURN server would fix that). */
const VOICE_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
// Deployments can supply temporary TURN credentials before opening a connection.
const rtcIceServers = () => Array.isArray(window.CLAUDEWARE_ICE_SERVERS) && window.CLAUDEWARE_ICE_SERVERS.length ? window.CLAUDEWARE_ICE_SERVERS : VOICE_ICE;
const voice = { on: false, muted: false, busy: false, stream: null, peers: {}, mutedBy: {}, talkAt: {}, an: {}, ac: null };
const vnow = () => performance.now() / 1000;
const vsend = (to, k, d) => { if (party.room && party.you) pcall('vsig', Object.assign(auth(), { to, k, d })); };
const talking = id => vnow() - (voice.talkAt[id] || -9) < .3;
const voiceState = id => { const p = voice.peers[id]; return !p ? 'none' : p.pc.connectionState === 'connected' ? 'ok' : p.pc.connectionState === 'failed' || p.pc.connectionState === 'closed' ? 'bad' : 'wait'; };

/* tap cycle: off -> mic on -> muted -> off */
function voiceToggle() {
  if (!voice.on) return voiceStart();
  if (!voice.muted) return voiceSetMuted(true);
  voiceStop(true);
}
function voiceSetMuted(m) { voice.muted = m; if (voice.stream) voice.stream.getAudioTracks().forEach(tr => { tr.enabled = !m; }); }
function voiceMuteOther(id) { voice.mutedBy[id] = !voice.mutedBy[id]; const p = voice.peers[id]; if (p && p.audio) p.audio.muted = !!voice.mutedBy[id]; }

async function voiceStart() {
  if (voice.on || voice.busy || !party.room) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.RTCPeerConnection) { say('VOICE NOT SUPPORTED HERE', '#FF4D4D'); return; }
  voice.busy = true;
  try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch (e) {}   // iOS: keeps the mic alive while the game plays its own sounds
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); }
  catch (e) { voice.busy = false; say(e && e.name === 'NotAllowedError' ? 'MIC BLOCKED - ALLOW IT IN YOUR BROWSER' : 'NO MICROPHONE FOUND', '#FF4D4D'); return; }
  voice.busy = false;
  if (!party.room) { stream.getTracks().forEach(tr => tr.stop()); return; }          // left the room while the permission prompt was open
  for (const id of Object.keys(voice.peers)) closePeer(id);      // listen-only peers have no mic track: rebuild them
  voice.stream = stream; voice.on = true; voiceSetMuted(false); watchLevel('me', stream);
  stream.getAudioTracks().forEach(tr => { tr.onended = () => { if (voice.stream === stream) voiceRestart(); }; });
  vsend('*', 'hello');
  track('voice_on', { players: party.room.players.length });
}
async function voiceRestart() {            // the OS took the mic away (call, lock screen...): get it back
  if (!voice.on || voice.busy) return;
  const was = voice.muted; voiceStop(true); await voiceStart(); if (was && voice.on) voiceSetMuted(true);
}
function voiceStop(notify) {
  if (notify && party.room && voice.on) vsend('*', 'bye');
  for (const id of Object.keys(voice.peers)) closePeer(id);
  if (voice.stream) voice.stream.getTracks().forEach(tr => tr.stop());
  voice.stream = null; voice.on = false; voice.muted = false; delete voice.an.me; delete voice.talkAt.me;
}

function watchLevel(id, stream) {
  try {
    voice.ac = voice.ac || new (window.AudioContext || window.webkitAudioContext)();
    if (voice.ac.state === 'suspended') voice.ac.resume();
    const an = voice.ac.createAnalyser(); an.fftSize = 256; voice.ac.createMediaStreamSource(stream).connect(an);   // not connected to the speakers: the <audio> element plays it
    voice.an[id] = { an, buf: new Uint8Array(an.fftSize) };
  } catch (e) {}
}
setInterval(() => {
  const R = party.room;
  if (!voice.on && !Object.keys(voice.peers).length) return;
  if (!R) { voiceStop(false); return; }
  for (const id of Object.keys(voice.peers)) { const p = R.players.find(q => q.id === id); if (!p || p.left) closePeer(id); }   // player left
  if (voice.on && vnow() - (voice.helloAt || 0) > 3) {          // someone joined after I turned the mic on: introduce myself
    voice.helloAt = vnow();
    for (const p of R.players) if (!p.left && p.id !== party.you.id && !voice.peers[p.id]) vsend(p.id, 'hello');
  }
  for (const id of Object.keys(voice.peers)) { const a = voice.peers[id].audio; if (a && a.paused) { const go = a.play(); if (go && go.catch) go.catch(() => {}); } }   // phones pause it on game sounds / lock
  for (const id of Object.keys(voice.an)) {
    const a = voice.an[id]; a.an.getByteTimeDomainData(a.buf);
    let s = 0; for (let i = 0; i < a.buf.length; i++) { const v = (a.buf[i] - 128) / 128; s += v * v; }
    if (Math.sqrt(s / a.buf.length) > .035 && !(id === 'me' && voice.muted) && !voice.mutedBy[id]) voice.talkAt[id] = vnow();
  }
}, 100);

function closePeer(id) {
  const p = voice.peers[id]; if (!p) return;
  try { p.pc.onconnectionstatechange = p.pc.onicecandidate = p.pc.ontrack = null; p.pc.close(); } catch (e) {}
  if (p.audio) { try { p.audio.pause(); p.audio.srcObject = null; } catch (e) {} }
  delete voice.peers[id]; delete voice.an[id]; delete voice.talkAt[id];
}
function peerOf(id) {
  let p = voice.peers[id]; if (p) return p;
  const pc = new RTCPeerConnection({ iceServers: rtcIceServers() });
  p = voice.peers[id] = { pc, offered: false, pend: [], audio: null };
  if (voice.stream) voice.stream.getTracks().forEach(tr => pc.addTrack(tr, voice.stream)); else pc.addTransceiver('audio', { direction: 'recvonly' });   // mic off: still hear the others
  pc.onicecandidate = e => { if (e.candidate) vsend(id, 'ice', e.candidate.toJSON ? e.candidate.toJSON() : e.candidate); };
  pc.ontrack = e => {
    if (p.audio) return;
    const a = new Audio(); a.autoplay = true; a.srcObject = e.streams[0]; a.muted = !!voice.mutedBy[id]; p.audio = a;
    const go = a.play(); if (go && go.catch) go.catch(() => {});
    watchLevel(id, e.streams[0]);
  };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') track('voice_failed', {}); };
  return p;
}
async function voiceOffer(id) {
  const p = peerOf(id); if (p.offered) return; p.offered = true;
  try { const o = await p.pc.createOffer(); await p.pc.setLocalDescription(o); vsend(id, 'offer', { type: o.type, sdp: o.sdp }); } catch (e) {}
}
async function flushIce(p) { for (const c of p.pend.splice(0)) { try { await p.pc.addIceCandidate(c); } catch (e) {} } }

/* a setup message from another player (called by party.js for topic rooms/<id>/vsig) */
async function onVsig(d) {
  if (!d || !party.you || !party.room || d.from === party.you.id || (d.to !== '*' && d.to !== party.you.id)) return;
  const X = d.from, mine = party.you.id;
  try {
    if (d.k === 'hello') { closePeer(X); vsend(X, 'here'); peerOf(X); if (mine < X) voiceOffer(X); }   // the smaller id always makes the offer: no glare
    else if (d.k === 'here') { peerOf(X); if (mine < X) voiceOffer(X); }
    else if (d.k === 'bye') closePeer(X);
    else if (d.k === 'offer' && d.d) {
      const p = peerOf(X); await p.pc.setRemoteDescription(d.d); await flushIce(p);
      const a = await p.pc.createAnswer(); await p.pc.setLocalDescription(a); vsend(X, 'answer', { type: a.type, sdp: a.sdp });
    } else if (d.k === 'answer' && d.d) { const p = voice.peers[X]; if (p && p.pc.signalingState === 'have-local-offer') { await p.pc.setRemoteDescription(d.d); await flushIce(p); } }
    else if (d.k === 'ice' && d.d) { const p = peerOf(X); if (p.pc.remoteDescription) await p.pc.addIceCandidate(d.d); else p.pend.push(d.d); }
  } catch (e) {}
}

/* ───────────── UI bits (drawn inside the party screens) ───────────── */
function voiceButton(x, y, w, h) {
  const lbl = voice.busy ? '...' : !voice.on ? 'VOICE OFF' : voice.muted ? 'MIC MUTED' : 'MIC ON', fill = !voice.on ? '#fff' : voice.muted ? '#FFE14D' : '#5CFF7A';
  if (typeof pui === 'function' && typeof PARTY_UI !== 'undefined') {   // the party shell's plate (art only: same rectangle, same callback)
    if (voice.on && !voice.muted && talking('me')) { ctx.save(); ctx.globalAlpha = .55 + .35 * Math.sin(now * 12); PARTY_UI.rr(x - 5, y - 5, w + 10, h + 10, 20); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
    pui().btn(x, y, w, h, lbl, voiceToggle, { size: 17, fill, depth: 5 });
    return;
  }
  button(x, y, w, h, lbl, voiceToggle, { size: 18, fill });
  if (voice.on && !voice.muted && talking('me')) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(x - 4, y - 4, w + 8, h + 8); }
}
const VCOL = { ok: '#5CFF7A', wait: '#FFE14D', bad: '#FF4D4D' };
/* per-player voice marks on a lobby card at (x, y, 172x178) */
function voiceCardMarks(p, x, y) {
  if (!voice.on || (party.you && p.id === party.you.id)) return;
  const s = voiceState(p.id);
  if (s !== 'none') { circ(x + 156, y + 166, 6, VCOL[s], 2); }
  if (talking(p.id)) { ctx.strokeStyle = '#5CFF7A'; ctx.lineWidth = 5; ctx.strokeRect(x - 3, y - 3, 178, 184); }
  button(x + 106, y + 32, 60, 26, voice.mutedBy[p.id] ? 'MUTED' : 'HEAR', () => voiceMuteOther(p.id), { size: 12, fill: voice.mutedBy[p.id] ? '#FF4D4D' : '#fff', col: voice.mutedBy[p.id] ? '#fff' : INK });
}
