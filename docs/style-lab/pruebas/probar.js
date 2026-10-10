#!/usr/bin/env node
/* MiniCaos · laboratorio de estilos: banco de pruebas sin ventana (Playwright + chrome-headless-shell, igual que scripts/art/shoot.js).
   Abre index.html por file://, le suma juegos-bus.js + el archivo del juego + su bot, congela requestAnimationFrame y maneja
   el reloj a mano (tick/paintFrame del laboratorio), con Math.random sembrado para que cada fallo se pueda repetir.

   node docs/style-lab/pruebas/probar.js <id> [--modo=humo|fotos|humano] [opciones]

   --modo=humo (por defecto)  cada ruta del bot (gana*, pierde*) y la ruta 'nada' (no tocar nada) en cada estilo y nivel:
                              revisa el resultado esperado, que no haya excepciones, y que el final termine y el juego reinicie.
   --modo=fotos               corre cada ruta una vez y guarda PNG: 00-inicio, los T.foto('nombre') del bot y el final a +0.5/1.3/2.1/2.9 s.
   --modo=humano              si el bot define humano(T, o): porcentaje de victorias por nivel con jugadores torpes (o.reac, o.err).

   --estilos=todos|tinta,wii   (humo: todos; fotos: tinta)      --niveles=1,1.4,1.8   (fotos: 1)
   --rep=2                     repeticiones por combinación (humano: 20)
   --rapido                    atajo de humo: solo tinta + hose, rep 2 (para iterar)
   --solo=gana                 una sola ruta                   --semilla=123   semilla base (se imprime siempre)
   --bots=<archivo>            por defecto pruebas/bots/<id>.js  --archivo=<juego.js>  por defecto juego-<id>.js (o juego-jefe-<id>.js)
   --todos                     carga TODOS los juego-*.js (para cazar interferencias entre juegos: listeners globales, nombres repetidos)
   --out=<carpeta>             dónde van las fotos (por defecto <tmp>/minicaos-fotos/<id>)

   El bot es un script de NAVEGADOR:   BOTS['<id>']={ gana(T){...}, pierde(T){...}, nada:'lose', humano(T,o){...} };
   Las rutas que empiezan por "gana" deben terminar en win y las que empiezan por "pierde" en lose. Dentro tienes T:
     T.G            el juego en curso            T.P()          su probe()
     T.S(seg)       avanza el reloj              T.hasta(fn,max=30)  avanza hasta que fn() sea verdad (devuelve si lo logró)
     T.listo()      ya hay resultado (o el laboratorio ya reinició): úsalo para cortar los bucles
     T.down/move/up(x,y), T.tap(x,y), T.drag(x0,y0,x1,y1,seg)   puntero REAL sobre el canvas (coordenadas 800x600)
     T.key('Space'), T.keyup('Space'), T.tecla('ArrowLeft',seg)  teclado REAL (code: Space, Enter, ArrowLeft/Right/Up/Down)
     T.hold(l,r)    izquierda/derecha sostenidas (lo que lee BUS.steer())
     T.foto('nombre')  guarda el cuadro (solo en --modo=fotos)      T.rnd()  aleatorio sembrado */
const fs = require('fs'), path = require('path'), os = require('os');
const LAB = path.resolve(__dirname, '..');
const pwDir = (() => { const base = path.join(os.homedir(), '.npm/_npx'); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'node_modules/playwright'); if (fs.existsSync(p)) return p; } throw new Error('playwright no está en ' + base + ' (corre una vez: npx playwright --version)'); })();
const exe = (() => { const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  for (const v of fs.readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse()) for (const d of fs.readdirSync(path.join(cache, v))) { const p = path.join(cache, v, d, 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  throw new Error('chrome-headless-shell no está en ' + cache); })();
const { chromium } = require(pwDir);

const flags = {}, pos = [];
for (const a of process.argv.slice(2)) { const m = /^--([a-z]+)(?:=(.*))?$/s.exec(a); if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; else pos.push(a); }
if (!pos.length) { console.error('uso: node docs/style-lab/pruebas/probar.js <id> [--modo=humo|fotos|humano] [--rapido] [--estilos=..] [--niveles=..] [--rep=N] [--solo=ruta] [--semilla=N] [--todos] [--out=dir]'); process.exit(2); }
const id = pos[0], modo = flags.modo || 'humo';
const semilla = flags.semilla == null ? (Date.now() % 100000) : +flags.semilla;
const archivo = flags.archivo ? path.resolve(flags.archivo) : [`juego-${id}.js`, `juego-jefe-${id}.js`].map(f => path.join(LAB, f)).find(f => fs.existsSync(f));
const botFile = flags.bots ? path.resolve(flags.bots) : path.join(__dirname, 'bots', id + '.js');
const outDir = flags.out ? path.resolve(flags.out) : path.join(os.tmpdir(), 'minicaos-fotos', id);

/* lo que corre dentro de la página */
const EN_PAGINA = `
window.BOTS={};
(function(){
  const mul=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  window.snd=function(){};window.nz=function(){};          /* sin sonido: miles de osciladores solo estorban */
  const T=window.T={pintar:0,pa:0,fotos:[],sacar:false,g0:null,reloj:0,tRes:0,tFin:0,rnd:Math.random,
    get G(){return __lab.G;},
    P(){const g=__lab.G;return g&&g.probe?g.probe():{};},
    listo(){return !T.g0||__lab.G!==T.g0||!!T.g0.result;},
    S(sec,dt=1/60){const n=Math.max(1,Math.round(sec/dt));for(let i=0;i<n;i++){tick(dt);T.reloj+=dt;if(!T.tRes&&T.g0&&T.g0.result)T.tRes=T.reloj;if(!T.tFin&&T.g0&&__lab.G!==T.g0)T.tFin=T.reloj;
      if(T.reloj>120)throw new Error('TIEMPO: el bot lleva 120 s simulados sin terminar (¿un bucle que no mira T.listo()?)');
      if(T.pintar){T.pa+=dt;if(T.pa>=T.pintar){T.pa=0;paintFrame();}}}},
    hasta(fn,max=30,dt=1/60){let t=0;while(t<max){if(fn())return true;T.S(dt,dt);t+=dt;}return !!fn();},
    xy(x,y){const r=view.getBoundingClientRect();return{clientX:r.left+x*r.width/W,clientY:r.top+y*r.height/H};},
    ptr(type,x,y){view.dispatchEvent(new PointerEvent(type,Object.assign({pointerId:1,bubbles:true,cancelable:true,isPrimary:true,pointerType:'mouse',buttons:type==='pointerup'?0:1},T.xy(x,y))));},
    down(x,y){T.ptr('pointerdown',x,y);},move(x,y){T.ptr('pointermove',x,y);},up(x,y){T.ptr('pointerup',x,y);},
    tap(x,y){T.down(x,y);T.up(x,y);},
    drag(x0,y0,x1,y1,sec=.2){T.down(x0,y0);const n=Math.max(2,Math.round(sec*60));for(let i=1;i<=n;i++){T.move(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n);T.S(1/60);}T.up(x1,y1);},
    key(code){dispatchEvent(new KeyboardEvent('keydown',{code,key:code,bubbles:true,cancelable:true}));},
    keyup(code){dispatchEvent(new KeyboardEvent('keyup',{code,key:code,bubbles:true,cancelable:true}));},
    tecla(code,sec=0){T.key(code);if(sec)T.S(sec);T.keyup(code);},
    hold(l,r){__lab.hold&&__lab.hold(l,r);},
    foto(n){if(!T.sacar)return;paintFrame();T.fotos.push([n,view.toDataURL('image/png')]);},
  };
  function suelta(){for(const c of['Space','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'])T.keyup(c);T.hold(0,0);T.ptr('pointerup',400,300);}
  window.__rutas=id=>Object.keys(BOTS[id]||{}).filter(k=>/^(gana|pierde)/.test(k)&&typeof BOTS[id][k]==='function');
  window.__correr=function(o){
    const out={ruta:o.ruta,estilo:o.estilo,sp:o.sp,semilla:o.semilla},bot=BOTS[o.id]||{};
    try{
      Math.random=T.rnd=mul(o.semilla);SP=o.sp;__lab.setStyle(o.estilo);T.fotos=[];T.sacar=!!o.fotos;T.pintar=o.pintar||0;T.pa=0;T.reloj=0;T.tRes=0;T.tFin=0;T.g0=null;
      suelta();__lab.setGame(o.id);const g0=T.g0=__lab.G;
      const hud=[];if(typeof g0.cmd!=='string'||!g0.cmd)hud.push('cmd');if(typeof g0.hint!=='string'||!g0.hint)hud.push('hint');if(!(g0.dur>0)||!isFinite(g0.dur))hud.push('dur');if(!isFinite(g0.t))hud.push('t');if(typeof g0.press!=='function')hud.push('press');
      if(hud.length)out.hud=hud.join(',');
      if(o.fotos){T.S(.5);T.foto('00-inicio');}
      let esperado;
      if(o.ruta==='nada'){esperado=bot.nada||'lose';T.hasta(()=>T.listo(),45);}
      else if(o.ruta==='humano'){esperado=null;bot.humano(T,o.h||{});T.hasta(()=>T.listo(),20);}
      else{esperado=/^gana/.test(o.ruta)?'win':'lose';bot[o.ruta](T,o);T.hasta(()=>T.listo(),20);}
      out.result=g0.result;out.why=g0.why;out.esperado=esperado;out.t=+(T.tRes||T.reloj).toFixed(2);out.ok=esperado==null||g0.result===esperado;
      if(g0.result){let t=0;const m=[.5,1.3,2.1,2.9];
        while(__lab.G===g0&&t<9){T.S(.1);t+=.1;if(o.fotos&&m.length&&t>=m[0]-1e-9)T.foto('final-'+m.shift().toFixed(1));}
        out.final=+((T.tFin||T.reloj)-T.tRes).toFixed(1);if(__lab.G===g0){out.ok=false;out.cuelga=true;}}
      suelta();
    }catch(e){out.ok=false;out.err=String(e&&e.stack||e).slice(0,600);try{suelta();}catch(_){}}
    out.fotos=T.fotos;T.fotos=[];return out;
  };
})();`;

(async () => {
  const b = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
  const consola = [];
  p.on('pageerror', e => consola.push('pageerror: ' + String(e.stack || e).slice(0, 400)));
  p.on('console', m => { if (m.type() === 'error') consola.push('console.error: ' + m.text().slice(0, 300)); });
  await p.addInitScript(() => { window.__raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; });
  await p.goto('file://' + path.join(LAB, 'index.html'));
  await p.waitForFunction(() => !!window.__lab);
  await p.addScriptTag({ path: path.join(LAB, 'juegos-bus.js') });
  const juegos = flags.todos ? fs.readdirSync(LAB).filter(f => /^juego-.*\.js$/.test(f)).sort().map(f => path.join(LAB, f)) : archivo ? [archivo] : [];
  for (const f of juegos) await p.addScriptTag({ path: f });
  await p.addScriptTag({ content: EN_PAGINA });
  const bots = flags.todos ? fs.readdirSync(path.join(__dirname, 'bots')).filter(f => f.endsWith('.js')).map(f => path.join(__dirname, 'bots', f)) : fs.existsSync(botFile) ? [botFile] : [];
  for (const f of bots) await p.addScriptTag({ path: f });
  const info = await p.evaluate(id => ({ existe: !!GAMES[id], estilos: Object.keys(STY), rutas: window.__rutas(id), humano: !!(BOTS[id] && BOTS[id].humano), juegos: Object.keys(GAMES) }), id);
  if (!info.existe) { console.error(`✗ el juego '${id}' no se registró (GAMES tiene: ${info.juegos.join(', ')})` + (archivo ? '' : `\n  no encontré juego-${id}.js`)); consola.forEach(c => console.error('  ' + c)); await b.close(); process.exit(1); }
  const rutas = flags.solo ? [flags.solo] : [...info.rutas, 'nada'];
  console.log(`▶ ${id} · modo ${modo} · semilla ${semilla} · rutas: ${rutas.join(', ')}${bots.length ? '' : '  (SIN BOT: ' + botFile + ' no existe, solo corre "nada")'}${flags.todos ? ' · con TODOS los juegos cargados (' + juegos.length + ')' : ''}`);
  let fallos = 0, n = 0;
  const correr = o => p.evaluate(o => window.__correr(o), Object.assign({ id }, o));

  if (modo === 'fotos') {
    fs.mkdirSync(outDir, { recursive: true });
    const estilos = (flags.estilos || 'tinta').split(','), niveles = (flags.niveles || '1').split(',').map(Number);
    for (const estilo of estilos) for (const sp of niveles) for (const ruta of rutas) {
      const r = await correr({ ruta, estilo, sp, semilla: semilla + n++, fotos: true });
      const tag = `${ruta}${estilos.length > 1 ? '.' + estilo : ''}${niveles.length > 1 ? '.x' + sp : ''}`;
      for (const [nombre, url] of r.fotos) fs.writeFileSync(path.join(outDir, `${tag}-${nombre.replace(/[^a-z0-9_.-]/gi, '_')}.png`), Buffer.from(url.split(',')[1], 'base64'));
      if (!r.ok) fallos++;
      console.log(`${r.ok ? '✓' : '✗'} ${tag}: ${r.result || 'sin resultado'} "${r.why || ''}" a los ${r.t}s, final ${r.final || '-'}s, ${r.fotos.length} fotos${r.err ? '\n   ' + r.err : ''}${r.cuelga ? '  ¡EL FINAL NO TERMINA (endT no pasa de 2.3)!' : ''}`);
    }
    console.log('fotos en ' + outDir + ':\n  ' + fs.readdirSync(outDir).sort().join('\n  '));
  } else if (modo === 'humano') {
    if (!info.humano) { console.log('el bot no define humano(T,o)'); }
    else for (const sp of (flags.niveles || '1,1.4,1.8').split(',').map(Number)) for (const h of [{ reac: .15, err: .04 }, { reac: .25, err: .1 }, { reac: .35, err: .18 }]) {
      const N = +(flags.rep || 20); let w = 0, e = 0;
      for (let i = 0; i < N; i++) { const r = await correr({ ruta: 'humano', estilo: 'tinta', sp, semilla: semilla + n++, h }); if (r.err) { e++; if (e === 1) console.log('   ' + r.err); } else if (r.result === 'win') w++; }
      console.log(`nivel x${sp} · reacción ${h.reac}s, error ${h.err}: gana ${w}/${N}${e ? ' (' + e + ' con excepción)' : ''}`); fallos += e;
    }
  } else {
    const estilos = flags.rapido ? ['tinta', 'hose'] : !flags.estilos || flags.estilos === 'todos' ? info.estilos : flags.estilos.split(',');
    const niveles = (flags.niveles || '1,1.4,1.8').split(',').map(Number), rep = +(flags.rep || 2);
    const st = {};
    for (const estilo of estilos) for (const sp of niveles) for (const ruta of rutas) for (let i = 0; i < rep; i++) {
      const r = await correr({ ruta, estilo, sp, semilla: semilla + n++, pintar: .3 });
      const k = `${ruta} x${sp}`, s = st[k] || (st[k] = { n: 0, ok: 0, t: [], fin: [], malos: [] });
      s.n++; if (r.ok) s.ok++; else { fallos++; if (s.malos.length < 4) s.malos.push(r); }
      if (r.t != null) s.t.push(r.t); if (r.final != null) s.fin.push(r.final);
      if (r.hud) { fallos++; console.log(`✗ HUD: al juego le falta ${r.hud}`); }
    }
    const rg = a => a.length ? `${Math.min(...a).toFixed(1)}–${Math.max(...a).toFixed(1)}s` : '-';
    for (const k of Object.keys(st)) { const s = st[k];
      console.log(`${s.ok === s.n ? '✓' : '✗'} ${k.padEnd(22)} ${s.ok}/${s.n}   resultado a los ${rg(s.t)}   el final dura ${rg(s.fin)}`);
      for (const r of s.malos) console.log(`    ✗ [${r.estilo} · semilla ${r.semilla}] esperado ${r.esperado}, salió ${r.result || 'sin resultado'} "${r.why || ''}"${r.cuelga ? ' · EL FINAL NO TERMINA' : ''}${r.err ? '\n      ' + r.err.split('\n').slice(0, 4).join('\n      ') : ''}`);
    }
    console.log(`${n} corridas en ${estilos.length} estilos`);
  }
  if (consola.length) { fallos += consola.length; console.log(`✗ ${consola.length} errores de consola:`); [...new Set(consola)].slice(0, 12).forEach(c => console.log('   ' + c)); }
  console.log(fallos ? `✗ ${fallos} FALLOS` : '✓ TODO BIEN');
  await b.close(); process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
