const fs=require('fs'),path=require('path'),os=require('os'),http=require('http');
const cache=path.join(os.homedir(),'.npm/_npx');
const {chromium}=require(fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules/playwright')).find(fs.existsSync));
// LA FIESTA · capturas de cada minijuego en vivo con ?practica=<id> (sin red), 360x640 y 932x430.
// node docs/style-lab/pruebas/fiesta-juegos-capturas.js [juegos] [estilos]   -> pruebas/out/prac-<juego>-<estilo>-<WxH>.png
const ROOT=path.join(__dirname,'..'), OUT=path.join(__dirname,'out');
fs.mkdirSync(OUT,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(ROOT,u==='/'?'fiesta.html':u);fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(b);});});
function chromePath(){const shells=path.join(os.homedir(),'Library/Caches/ms-playwright');try{const d=fs.readdirSync(shells).filter(x=>x.startsWith('chromium_headless_shell-')).sort().pop();if(d){const f=path.join(shells,d),sub=fs.readdirSync(f).find(x=>x.startsWith('chrome'));const p=path.join(f,sub,'chrome-headless-shell');if(fs.existsSync(p))return p;}}catch(_){}const mac='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';return fs.existsSync(mac)?mac:undefined;}
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
 const games=(process.argv[2]||'f_mecate,f_domino,f_harina').split(','), styles=(process.argv[3]||'snes,tinta,felt').split(','), sizes=[[360,640],[932,430]];
 const b=await chromium.launch({executablePath:chromePath()});
 for(const [w,h] of sizes){
  const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true,deviceScaleFactor:2});const p=await ctx.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
  for(const g of games)for(const s of styles){
   await p.goto(`http://127.0.0.1:${port}/fiesta.html?practica=${g}&lv=2&estilo=${s}&step=1`);
   await p.waitForFunction(()=>window.FIESTA_DEBUG&&FIESTA_DEBUG.practica);
   // avanzar 6 s de juego con A pulsado a ratos
   await p.evaluate(async()=>{const P=FIESTA_DEBUG.practica;for(let i=0;i<30*7;i++){P.update(1/30);if(i%25===0)P.in.tap('a');}});
   await p.waitForTimeout(250);
   await p.screenshot({path:path.join(OUT,`prac-${g}-${s}-${w}x${h}.png`)});console.log('shot',g,s,w,h);
  }
 }
 await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1)});
