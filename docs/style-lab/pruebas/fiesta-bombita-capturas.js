const fs=require('fs'),path=require('path'),os=require('os'),http=require('http');
const cache=path.join(os.homedir(),'.npm/_npx');
const {chromium}=require(fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules/playwright')).find(fs.existsSync));
// LA FIESTA · capturas de f_bombita en práctica (sin red), 360x640 y 932x430. Como el juego aún no está en fiesta.html ni en CATALOGO,
// se sirve fiesta.html con un <script> extra EN MEMORIA (no se edita el archivo) y se completa el catálogo desde la página.
// node docs/style-lab/pruebas/fiesta-bombita-capturas.js [estilos] [niveles]  -> pruebas/out/prac-f_bombita-<estilo>-lv<n>-<WxH>.png
const ROOT=path.join(__dirname,'..'), OUT=path.join(__dirname,'out');
fs.mkdirSync(OUT,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(ROOT,u==='/'?'fiesta.html':u);fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);r.end();return;}
  if(path.basename(f)==='fiesta.html'){b=Buffer.from(String(b).replace('<script src="fiesta-juego-perro.js','<script src="fiesta-juego-bombita.js?v=1"></script>\n<script src="fiesta-juego-perro.js'));}
  r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(b);});});
function chromePath(){const shells=path.join(os.homedir(),'Library/Caches/ms-playwright');try{const d=fs.readdirSync(shells).filter(x=>x.startsWith('chromium_headless_shell-')).sort().pop();if(d){const f=path.join(shells,d),sub=fs.readdirSync(f).find(x=>x.startsWith('chrome'));const p=path.join(f,sub,'chrome-headless-shell');if(fs.existsSync(p))return p;}}catch(_){}const mac='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';return fs.existsSync(mac)?mac:undefined;}
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
 const styles=(process.argv[2]||'snes').split(','), lvs=(process.argv[3]||'1,3').split(','), sizes=[[360,640],[932,430]];
 const b=await chromium.launch({executablePath:chromePath()});
 for(const [w,h] of sizes){
  const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true,deviceScaleFactor:2});const p=await ctx.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
  for(const s of styles)for(const lv of lvs){
   await p.goto(`http://127.0.0.1:${port}/fiesta.html?practica=f_bombita&lv=${lv}&estilo=${s}&step=1`);
   await p.waitForFunction(()=>window.FIESTA_DEBUG&&FIESTA_DEBUG.practica);
   // avanzar ~7 s de juego (la bombita ya anda) moviendo
   await p.evaluate(async(lv)=>{const P=FIESTA_DEBUG.practica;const n=7;let ax=1,ay=0;for(let i=0;i<30*n;i++){if(i%40===0){ax=Math.cos(i/17);ay=Math.sin(i/11);}P.in.axis&&P.in.axis(ax,ay);P.update(1/30);}},lv);
   await p.waitForTimeout(250);
   await p.screenshot({path:path.join(OUT,`prac-f_bombita-${s}-lv${lv}-${w}x${h}.png`)});console.log('shot',s,lv,w,h);
  }
 }
 await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1)});
