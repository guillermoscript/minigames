const fs=require('fs'),path=require('path'),os=require('os'),http=require('http');
const cache=path.join(os.homedir(),'.npm/_npx');
const {chromium}=require(fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules/playwright')).find(fs.existsSync));
// LA FIESTA · capturas de f_cerro en práctica (?practica=f_cerro, sin red), estilo snes, 360x640 y 932x430 (y 800x600 si se pide).
// El <script> del juego se inyecta aquí (el integrador aún no lo cablea en fiesta.html).
//   node docs/style-lab/pruebas/fiesta-cerro-capturas.js [estilos] [niveles]   -> pruebas/out/prac-f_cerro-<estilo>-lv<N>-<WxH>.png
const ROOT=path.join(__dirname,'..'), OUT=path.join(__dirname,'out');
fs.mkdirSync(OUT,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(ROOT,u==='/'?'fiesta.html':u);fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);r.end();return;}
  if(u==='/fiesta.html'&&!/fiesta-juego-cerro/.test(b)){b=Buffer.from(String(b).replace(/(<script src="fiesta-juego-chancla\.js[^>]*><\/script>)/,'$1\n<script src="fiesta-juego-cerro.js"></script>\n<script>(function(){var d=FIESTA.LIVE.get("f_cerro"),mk=d.mk;d.mk=function(c){var g=mk(c);window.__cg=g;window.__cc=c;return g;};})();</script>'));}
  r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(b);});});
function chromePath(){const shells=path.join(os.homedir(),'Library/Caches/ms-playwright');try{const d=fs.readdirSync(shells).filter(x=>x.startsWith('chromium_headless_shell-')).sort().pop();if(d){const f=path.join(shells,d),sub=fs.readdirSync(f).find(x=>x.startsWith('chrome'));const p=path.join(f,sub,'chrome-headless-shell');if(fs.existsSync(p))return p;}}catch(_){}const mac='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';return fs.existsSync(mac)?mac:undefined;}
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
 const styles=(process.argv[2]||'snes').split(','), lvs=(process.argv[3]||'1,3').split(','), sizes=[[360,640],[932,430],[800,600]], segs=+process.env.SEGS||9;
 const b=await chromium.launch({executablePath:chromePath()});let errs=0;
 for(const [w,h] of sizes){
  const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:w<500,hasTouch:true,deviceScaleFactor:2});const p=await ctx.newPage();
  p.on('response',r=>{if(r.status()===404)console.log('404',r.url());});p.on('pageerror',e=>{errs++;console.log('PAGEERR',e.message);});p.on('console',m=>{if(m.type()==='error'){errs++;console.log('CONSOLE',m.text());}});
  for(const lv of lvs)for(const s of styles){
   await p.goto(`http://127.0.0.1:${port}/fiesta.html?practica=f_cerro&lv=${lv}&estilo=${s}&step=1`);
   await p.waitForFunction(()=>window.FIESTA_DEBUG&&FIESTA_DEBUG.practica,null,{timeout:15000});
   // avanza `segs` s de juego con el propio ai() del juego manejando el asiento humano (la práctica ya cuenta como mío); SEGS=17 llega a la platabanda
   await p.evaluate(async(segs)=>{const P=FIESTA_DEBUG.practica;const api={press:()=>P.in.tap('a'),hold:()=>{},eje:(x,y)=>P.in.axis(x,y)};for(let i=0;i<30*segs;i++){const c=window.__cc;if(window.__cg&&c&&P.gt()>0)window.__cg.ai(c.yo,1/30,api);P.update(1/30);}},segs);
   await p.waitForTimeout(250);
   await p.screenshot({path:path.join(OUT,`prac-f_cerro-${s}-lv${lv}-${w}x${h}.png`)});console.log('shot',s,'lv'+lv,w,h);
  }
 }
 await b.close();srv.close();console.log(errs?('ERRORES '+errs):'sin excepciones');
})().catch(e=>{console.error(e);process.exit(1)});
