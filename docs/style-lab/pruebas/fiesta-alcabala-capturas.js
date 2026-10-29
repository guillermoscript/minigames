const fs=require('fs'),path=require('path'),os=require('os'),http=require('http');
const cache=path.join(os.homedir(),'.npm/_npx');
const {chromium}=require(fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules/playwright')).find(fs.existsSync));
// LA FIESTA · capturas de f_alcabala con ?practica=f_alcabala (sin red). fiesta.html aún no carga el juego (otro agente lo registrará): aquí se inyecta la etiqueta al servir.
// node docs/style-lab/pruebas/fiesta-alcabala-capturas.js [lv=1,3] [roles=solo,trio]   -> pruebas/out/prac-f_alcabala-<rol>-lv<N>-<WxH>.png  (solo estilo snes)
const ROOT=path.join(__dirname,'..'), OUT=path.join(__dirname,'out');
fs.mkdirSync(OUT,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(ROOT,u==='/'?'fiesta.html':u);fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);r.end();return;}
  if(path.basename(f)==='fiesta.html'&&!b.toString().includes('fiesta-juego-alcabala.js'))b=Buffer.from(b.toString().replace(/(<script src="fiesta-juego-patilla\.js[^>]*><\/script>)/,'$1\n<script src="fiesta-juego-alcabala.js"></script>'));
  r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(b);});});
function chromePath(){const shells=path.join(os.homedir(),'Library/Caches/ms-playwright');try{const d=fs.readdirSync(shells).filter(x=>x.startsWith('chromium_headless_shell-')).sort().pop();if(d){const f=path.join(shells,d),sub=fs.readdirSync(f).find(x=>x.startsWith('chrome'));const p=path.join(f,sub,'chrome-headless-shell');if(fs.existsSync(p))return p;}}catch(_){}const mac='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';return fs.existsSync(mac)?mac:undefined;}
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
 const lvs=(process.argv[2]||'1,3').split(','), roles=(process.argv[3]||'solo,trio').split(','), sizes=[[360,640],[932,430]];
 const b=await chromium.launch({executablePath:chromePath()});
 for(const [w,h] of sizes){
  const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true,deviceScaleFactor:2});const p=await ctx.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
  for(const lv of lvs)for(const rol of roles){
   await p.goto(`http://127.0.0.1:${port}/fiesta.html?practica=f_alcabala&lv=${lv}&rol=${rol}&estilo=snes&step=1`);
   await p.waitForFunction(()=>window.FIESTA_DEBUG&&FIESTA_DEBUG.practica);
   const secs=lv==='3'?11:7;
   await p.evaluate(async({rol,secs})=>{const P=FIESTA_DEBUG.practica;for(let i=0;i<30*secs;i++){P.update(1/30);if(rol==='solo'&&i%40===0)P.in.tap('a');if(rol==='trio'&&i>60)P.in.axis(0,-.3);}},{rol,secs});
   await p.waitForTimeout(250);
   await p.screenshot({path:path.join(OUT,`prac-f_alcabala-${rol}-lv${lv}-${w}x${h}.png`)});console.log('shot',rol,lv,w,h);
  }
 }
 await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1)});
