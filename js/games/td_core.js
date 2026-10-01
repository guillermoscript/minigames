'use strict';
/* 3D toolkit for the "3D" stage. Games render with three.js (js/vendor/three.min.js, r128, global THREE) into ONE offscreen
   WebGL canvas that is copied onto the normal 2D canvas, so HUD, input, results, sfx and 2D overlays all work as in any
   other microgame. Typical game:

     reg3('td_x', sp => {
       const S = T3.scene({ bg: 0x9ad8ff, cam: [0, 6, 10], look: [0, 1, 0] });   // fresh scene; the previous one is disposed
       const m = T3.box(S, 2, 1, 2, 0xff7755, [0, .5, 0]);                       // outlined cartoon mesh, added to S.scene
       const g = { cmd: 'GO!', hint: 'DO IT', dur: 5,
         update(dt, t) {...}, down(p) {...}, move(p) {...}, key(e) {...},
         draw(t) { T3.render(S); } };   // then paint 2D overlays
       return g;
     }, 'Name');

   Coordinates: p.x/p.y in game input are 800x600 canvas px. Use T3.ray(S, p) to cast into the scene, T3.ground(S, p, y)
   for the point where the pointer hits the plane y=…, T3.screen(S, vec3) to project a world point to canvas px. */
const T3 = (() => {
  let R = null, last = null, fail = false;
  const API = { ok: false };
  const init = () => {
    if (R || fail) return;
    try {
      if (typeof THREE === 'undefined') throw 0;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      R = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: false, preserveDrawingBuffer: true });
      R.setSize(W, H, false); R.setPixelRatio(1); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
      API.ok = true;
    } catch (e) { fail = true; API.ok = false; }
  };
  const col = c => new THREE.Color(c);
  const disposeScene = S => {
    if (!S) return;
    S.scene.traverse(o => { if (o.geometry && !o.geometry._keep) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => m.dispose()); });
  };
  let INKM = null;
  const ink = () => INKM || (INKM = new THREE.MeshBasicMaterial({ color: 0x14101c, side: THREE.BackSide }));
  /* adds a back-face "inverted hull" outline to a mesh: the chunky cartoon look */
  const outline = (m, k = 1.07) => { const o = new THREE.Mesh(m.geometry, ink()); o.scale.setScalar(k); o.userData.outline = true; m.add(o); return m; };
  const mat = c => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0, specular: 0x000000 });
  const put = (S, m, pos, rot) => { if (pos) m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); m.castShadow = true; m.receiveShadow = true; (S.scene || S).add(m); return m; };

  Object.assign(API, {
    init,
    /* new scene. opts: bg colour, fog [near,far], cam [x,y,z], look [x,y,z], fov, sun [x,y,z], ground colour (adds a big floor, receives shadows) */
    scene(o = {}) {
      init(); if (!R) return null;
      disposeScene(last);
      const scene = new THREE.Scene(); scene.background = col(o.bg == null ? 0x9ad8ff : o.bg);
      if (o.fog) scene.fog = new THREE.Fog(scene.background, o.fog[0], o.fog[1]);
      const cam = new THREE.PerspectiveCamera(o.fov || 50, W / H, .1, 200);
      const cp = o.cam || [0, 6, 10], lk = o.look || [0, 0, 0]; cam.position.set(cp[0], cp[1], cp[2]); cam.lookAt(lk[0], lk[1], lk[2]);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7aa8, .85));
      const sun = new THREE.DirectionalLight(0xffffff, .75), sp = o.sun || [5, 12, 6]; sun.position.set(sp[0], sp[1], sp[2]);
      sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 50;
      scene.add(sun);
      const S = { scene, camera: cam, sun, look: lk, ray: new THREE.Raycaster(), t: 0 };
      if (o.ground != null) { const f = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(o.ground)); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; scene.add(f); S.floor = f; }
      last = S; return S;
    },
    mat,
    /* outlined primitives: all return the mesh (already added to S.scene) */
    box: (S, w, h, d, c, pos, rot, ol = 1.07) => outline(put(S, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)), pos, rot), ol),
    sphere: (S, r, c, pos, ol = 1.08) => outline(put(S, new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(c)), pos), ol),
    cyl: (S, rt, rb, h, c, pos, rot, ol = 1.08) => outline(put(S, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 18), mat(c)), pos, rot), ol),
    cone: (S, r, h, c, pos, rot, ol = 1.08) => outline(put(S, new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), mat(c)), pos, rot), ol),
    torus: (S, r, tube, c, pos, rot, ol = 1.08) => outline(put(S, new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 24), mat(c)), pos, rot), ol),
    /* same primitives but WITHOUT being added to the scene (to build groups): T3.mk.box(w,h,d,c) */
    mk: {
      box: (w, h, d, c, ol = 1.07) => outline(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)), ol),
      sphere: (r, c, ol = 1.08) => outline(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(c)), ol),
      cyl: (rt, rb, h, c, ol = 1.08) => outline(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 18), mat(c)), ol),
      cone: (r, h, c, ol = 1.08) => outline(new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), mat(c)), ol),
    },
    add(S, o, pos) { if (pos) o.position.set(pos[0], pos[1], pos[2]); o.traverse(m => { if (m.isMesh && !m.userData.outline) { m.castShadow = true; m.receiveShadow = true; } }); S.scene.add(o); return o; },
    /* 3D Claude mascot, same blocky crab as the 2D one. origin = bottom centre of feet, ~2.2 units tall at s=1.
       returns a Group with .legs[4], .armL, .armR, .eyes[2] for animation. */
    claude(S, s = 1, c = OR, pos) {
      const g = new THREE.Group(), M = T3.mk;
      const body = M.box(3, 1.75, 1.8, c); body.position.y = 1.65; g.add(body);
      const armL = M.box(.5, .6, .6, c); armL.position.set(-1.75, 1.45, 0); g.add(armL);
      const armR = M.box(.5, .6, .6, c); armR.position.set(1.75, 1.45, 0); g.add(armR);
      g.legs = [-1.25, -.65, .35, .95].map(x => { const l = M.box(.3, .8, .4, c); l.position.set(x + .15, .4, 0); g.add(l); return l; });
      const eyes = [-.7, .7].map(x => { const e = new THREE.Mesh(new THREE.BoxGeometry(.3, .6, .2), new THREE.MeshBasicMaterial({ color: 0x14101c })); e.position.set(x, 1.75, .92); g.add(e); return e; });
      g.eyes = eyes; g.armL = armL; g.armR = armR; g.body = body; g.scale.setScalar(s);
      if (S) T3.add(S, g, pos);
      return g;
    },
    /* cast a ray from canvas px p into the scene against `objs` (array of Object3D, recursive); returns first hit or null */
    ray(S, p, objs) {
      S.ray.setFromCamera(new THREE.Vector2(p.x / W * 2 - 1, -(p.y / H) * 2 + 1), S.camera);
      const h = S.ray.intersectObjects(objs || S.scene.children, true).filter(i => !i.object.userData.outline);
      return h[0] || null;
    },
    /* world point where the pointer's ray crosses the horizontal plane y=h (null if parallel) */
    ground(S, p, h = 0) {
      S.ray.setFromCamera(new THREE.Vector2(p.x / W * 2 - 1, -(p.y / H) * 2 + 1), S.camera);
      const r = S.ray.ray; if (Math.abs(r.direction.y) < 1e-4) return null;
      const k = (h - r.origin.y) / r.direction.y; return k < 0 ? null : r.origin.clone().addScaledVector(r.direction, k);
    },
    /* world → canvas px {x,y,z(depth -1..1)} */
    screen(S, v) { const q = v.clone().project(S.camera); return { x: (q.x + 1) / 2 * W, y: (1 - q.y) / 2 * H, z: q.z }; },
    /* draw the scene onto the 2D canvas (call first in g.draw, then paint 2D overlays on top) */
    render(S) { S.camera.updateMatrixWorld(); R.render(S.scene, S.camera); ctx.drawImage(R.domElement, 0, 0, W, H); },
    shakeCam(S, a = .15) { S.camera.position.x += (Math.random() - .5) * a; S.camera.position.y += (Math.random() - .5) * a; },
  });
  return API;
})();

/* register a 3D microgame. Falls back to a "tap to win" card where WebGL / three.js is unavailable, so the stage never breaks. */
function reg3(id, fn, name) {
  reg(id, sp => {
    T3.init();
    if (!T3.ok) {
      const g = { cmd: 'TAP!', hint: '3D NEEDS WEBGL', thint: '3D NEEDS WEBGL', dur: 2, down() { g.result = 'win'; }, update() {}, draw(t) { bg('#cbb4ff', '#bba2f5', t); txt('3D NOT SUPPORTED', W / 2, H / 2, 40, '#fff', 'center', 700); } };
      return g;
    }
    return fn(sp);
  }, name);
}
