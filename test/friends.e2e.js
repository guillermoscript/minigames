// Friends (follows) rules (password login is off, so the test impersonates users with the superuser) against a RUNNING PocketBase. Users can only be created through Google, so this needs a superuser:
//   pocketbase/pocketbase superuser upsert a@test.dev secret12345 --dir=<scratch>/pb   (before starting the server)
//   PB=http://127.0.0.1:8099 ADMIN=a@test.dev:secret12345 node test/friends.e2e.js
const B = process.env.PB || 'http://127.0.0.1:8099', [AE, AP] = (process.env.ADMIN || '').split(':');
const ok = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
const rq = async (m, p, body, tok) => { const r = await fetch(B + '/api' + p, { method: m, headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: tok } : {}), body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; };
(async () => {
  if (!AE) { console.log('skipped: set ADMIN=email:password'); return; }
  const adm = (await rq('POST', '/collections/_superusers/auth-with-password', { identity: AE, password: AP })).j.token;
  const mk = async n => { const c = await rq('POST', '/collections/users/records', { username: n, password: 'pass12345', passwordConfirm: 'pass12345' }, adm); const a = await rq('POST', '/collections/users/impersonate/' + c.j.id, { duration: 600 }, adm); return { id: c.j.id, tok: a.j.token }; };
  const sfx = Math.random().toString(36).slice(2, 7), A = await mk('fa_' + sfx), Bq = await mk('fb_' + sfx), C = await mk('fc_' + sfx);
  const fol = (u, to) => rq('POST', '/collections/friends/records', { from: u.id, to }, u.tok);
  ok((await rq('POST', '/collections/friends/records', { from: A.id, to: Bq.id })).s >= 400, 'anonymous cannot follow');
  ok((await fol(A, A.id)).s >= 400, 'cannot follow yourself');
  ok((await rq('POST', '/collections/friends/records', { from: Bq.id, to: C.id }, A.tok)).s >= 400, 'cannot follow on behalf of someone else');
  const f1 = await fol(A, Bq.id); ok(f1.s === 200, 'A follows B');
  ok((await fol(A, Bq.id)).s >= 400, 'duplicate follow rejected');
  const la = await rq('GET', '/collections/friends/records?filter=' + encodeURIComponent(`from='${A.id}'`), null, A.tok); ok(la.j.items.length === 1, 'A sees own follow');
  const lb = await rq('GET', '/collections/friends/records?filter=' + encodeURIComponent(`to='${Bq.id}'`), null, Bq.tok); ok(lb.j.items.length === 1, 'B sees A as a follower');
  const lc = await rq('GET', '/collections/friends/records', null, C.tok); ok(lc.j.items.length === 0, 'C (uninvolved) sees nothing');
  ok((await rq('GET', '/collections/friends/records/' + f1.j.id, null, C.tok)).s === 404, 'C cannot view the row');
  ok((await rq('GET', '/collections/friends/records')).j.items.length === 0, 'anonymous sees nothing');
  ok((await rq('PATCH', '/collections/friends/records/' + f1.j.id, { to: C.id }, A.tok)).s >= 400, 'rows cannot be edited');
  ok((await rq('DELETE', '/collections/friends/records/' + f1.j.id, null, Bq.tok)).s >= 400, 'B cannot remove A\'s follow');
  ok((await fol(Bq, A.id)).s === 200, 'B follows A back (mutual)');
  ok((await rq('DELETE', '/collections/friends/records/' + f1.j.id, null, A.tok)).s === 204, 'A unfollows');
  console.log('done');
})();
