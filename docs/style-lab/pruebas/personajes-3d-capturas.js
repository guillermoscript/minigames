const fs=require('fs'),path=require('path'),os=require('os'),http=require('http');
const cache=path.join(os.homedir(),'.npm/_npx');
const {chromium}=require(fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules/playwright')).find(fs.existsSync));
// Personajes 3D: hojas de contacto y tiras de cuadros de personajes-3d.html (sin red, WebGL por software).
//   node docs/style-lab/pruebas/personajes-3d-capturas.js hoja <anim|uno> <nombre,nombre,...> [personaje=tu] [t=1.2] [yaw=.55]   -> out/pj-hoja-<tipo>.png (un cuadro por animación)
//   node docs/style-lab/pruebas/personajes-3d-capturas.js tira <anim|uno|impacto|volar|mirar> <nombre> [personaje] [cuadros=8] [dt=.12] [yaw]  -> out/pj-tira-<nombre>.png
const ROOT=path.join(__dirname,'..'), OUT=path.join(__dirname,'out');
fs.mkdirSync(OUT,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.css':'text/css','.json':'application/json','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(ROOT,'..','..',u.startsWith('/js/')||u.startsWith('/fonts/')?u:'docs/style-lab'+u);fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(b);});});
function chromePath(){const shells=path.join(os.homedir(),'Library/Caches/ms-playwright');try{const d=fs.readdirSync(shells).filter(x=>x.startsWith('chromium_headless_shell-')).sort().pop();if(d){const f=path.join(shells,d),sub=fs.readdirSync(f).find(x=>x.startsWith('chrome'));const p=path.join(f,sub,'chrome-headless-shell');if(fs.existsSync(p))return p;}}catch(_){}const mac='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';return fs.existsSync(mac)?mac:undefined;}
(async()=>{
 const [modo,tipo,lista,quien='tu',a4,a5,a6]=process.argv.slice(2);
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
 const b=await chromium.launch({executablePath:chromePath()});
 const ctx=await b.newContext({viewport:{width:420,height:520},deviceScaleFactor:1});const p=await ctx.newPage();
 p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
 await p.goto(`http://127.0.0.1:${port}/personajes-3d.html`);await p.waitForFunction(()=>window.VISOR);
 const idx=await p.evaluate((q)=>VISOR.pjs.findIndex(x=>x.id===q),quien);
 const yaw=parseFloat(modo==='hoja'?(a5||'.55'):(a6||'.55'));
 const dist=(modo==='tira'&&(tipo==='volar'||tipo==='impacto'))?(tipo==='volar'?12:8.3):8.3;
await p.evaluate(([i,y,d])=>{VISOR.pjs[i].g.position.set(0,.3,0);VISOR.set({foco:i,yaw:y,pitch:.1,dist:d,tope:d,pausa:true,ui:false,solo:i});},[idx,yaw,dist]);
 const raf=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const tiles=[];
 async function toma(label){await raf();const buf=await p.screenshot({clip:{x:40,y:40,width:340,height:440}});tiles.push({label,src:'data:image/png;base64,'+buf.toString('base64')});}
 if(modo==='hoja'){
  const t=parseFloat(a4||'1.2');
  for(const n of lista.split(',')){
   await p.evaluate(([i,tipo,n,t])=>{const pj=VISOR.pjs[i];pj.g.position.set(0,.3,0);pj.rumbo(0);pj.prop(false);pj.anim('quieto');pj.cara('normal');for(let k=0;k<30;k++)pj.update(1/30);
     if(tipo==='anim'){pj.anim(n,{vel:1});for(let k=0;k<Math.round(t*30);k++)pj.update(1/30);}
     else{pj.anim('quieto');pj.uno(n);for(let k=0;k<Math.round(t*30);k++)pj.update(1/30);} },[idx,tipo,n,t]);
   await toma(n);
  }
 } else {
  const N=parseInt(a4||'8'),dt=parseFloat(a5||'.12'),n=lista;
  if(tipo==='volar')await p.evaluate(([i])=>{VISOR.pjs[i].g.position.set(-2.4,.3,0);},[idx]);
  await p.evaluate(([i,tipo,n])=>{const pj=VISOR.pjs[i];pj.rumbo(0);pj.prop(false);pj.anim('quieto');pj.cara('normal');for(let k=0;k<30;k++)pj.update(1/30);
    if(tipo==='anim')pj.anim(n,{vel:1}); else if(tipo==='uno')pj.uno(n); else if(tipo==='impacto')pj.impacto(1,0,parseFloat(n)||1.5); else if(tipo==='volar')pj.volar(1,0,parseFloat(n)||1.5); else if(tipo==='mirar')pj.mirar(parseFloat(n)||1,0);
    if(tipo==='anim')for(let k=0;k<30;k++)pj.update(1/30);},[idx,tipo,n]);
  for(let f=0;f<N;f++){await toma((f*dt).toFixed(2)+'s');await p.evaluate(([i,dt])=>{const pj=VISOR.pjs[i];const n=Math.round(dt*60);for(let k=0;k<n;k++)pj.update(1/60);},[idx,dt]);}
 }
 // compone la hoja
 const cols=modo==='hoja'?Math.min(6,tiles.length):Math.min(8,tiles.length), W=Math.floor(1500/cols), H=Math.round(W*440/340);
 const pg=await ctx.newPage();await pg.setViewport&&0;await pg.setViewportSize({width:cols*W,height:Math.ceil(tiles.length/cols)*(H+18)});
 await pg.setContent('<body style="margin:0;background:#1a2438;display:grid;grid-template-columns:repeat('+cols+',1fr);font:12px sans-serif;color:#fff">'+tiles.map(t=>`<div style="text-align:center"><img src="${t.src}" style="width:${W}px;height:${H}px;display:block"><span>${t.label}</span></div>`).join('')+'</body>');
 const name=modo==='hoja'?`pj-hoja-${tipo}-${(lista.split(',')[0]||'x')}`:`pj-tira-${tipo}-${lista}-${quien}`;
 await pg.screenshot({path:path.join(OUT,name+'.png'),fullPage:true});console.log(path.join(OUT,name+'.png'));
 await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1)});
