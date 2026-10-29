// Banco headless de los minijuegos VERSUS de LA FIESTA.  Uso: node docs/style-lab/pruebas/vs-probar.js [id ...]  (sin ids = todos los de juegos-vs-lista.js)
// Para cada juego x modo x nivel x semilla, juega con 4 CPU hasta el final y comprueba: sin errores, termina, puestos/ganadores válidos,
// los scores son números finitos y se dibuja en 3 estilos sin excepción. Guarda un PNG por juego en pruebas/out/.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const root=path.resolve(__dirname,'../../..'),lab=path.join(root,'docs/style-lab');
const cache=path.join(os.homedir(),'.npm/_npx');
const {chromium}=require(fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules/playwright')).find(fs.existsSync));
const shells=path.join(os.homedir(),'Library/Caches/ms-playwright');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
function exe(){ // headless shell de Playwright si existe; si no, el Chrome instalado
  try{const f=path.join(shells,fs.readdirSync(shells).filter(d=>d.startsWith('chromium_headless_shell-')).sort().pop());return path.join(f,fs.readdirSync(f).find(d=>d.startsWith('chrome')),'chrome-headless-shell');}catch(e){return CHROME;}}
const lista=fs.readFileSync(path.join(lab,'juegos-vs-lista.js'),'utf8').match(/\[(.*)\]/)[1].split(',').map(s=>s.replace(/['"\s]/g,'')).filter(Boolean);
const ids=process.argv.slice(2).length?process.argv.slice(2):(process.env.VS_EXTRA?process.env.VS_EXTRA.split(','):lista);
const srv=http.createServer((req,res)=>{const f=path.join(lab,decodeURIComponent(req.url.split('?')[0]));
  if(!f.startsWith(lab)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}
  res.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':'application/octet-stream'});fs.createReadStream(f).pipe(res);});
(async()=>{
  await new Promise(r=>srv.listen(0,r));const base='http://127.0.0.1:'+srv.address().port;
  const browser=await chromium.launch({executablePath:exe(),headless:true});
  fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});
  let bad=0;
  try{
    for(const id of ids){
      const page=await browser.newPage({viewport:{width:900,height:620}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.route(u=>!u.href.startsWith(base),r=>r.abort());
      await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
      await page.goto(`${base}/vs.html?juego=vs-${id}&humanos=0&seed=1&extra=${[id].concat((process.env.VS_EXTRA||'').split(',')).filter(Boolean).join(',')}`);
      await page.waitForFunction(()=>window.FIESTA&&FIESTA.VS&&typeof setGame==='function'&&FIESTA.VS.games,null,{timeout:8000}).catch(()=>{});
      const def=await page.evaluate(i=>FIESTA.VS.games[i]&&{modos:FIESTA.VS.games[i].modos||['ffa'],dur:FIESTA.VS.games[i].dur},id);
      if(!def){console.log('✗',id,'no registrado',errors.join('|'));bad++;await page.close();continue;}
      const out=await page.evaluate(({id,modos})=>{
        snd=()=>{};try{nz=()=>{};}catch(e){}
        const res=[];
        for(const modo of modos)for(const nivel of [1,2,3])for(let seed=1;seed<=6;seed++){
          FIESTA.VS.cfg.modo=modo;FIESTA.VS.cfg.lv=nivel;FIESTA.VS.cfg.seed=seed;FIESTA.VS.cfg.humanos=0;FIESTA.VS.cfg.n=4;FIESTA.VS.cfg.solo=-1;
          window.NIVEL=nivel;gameId='vs-'+id;restart();
          let t=0;try{while(!G.result&&t<400){tick(1/30);t+=1/30;}
            const u=FIESTA.VS.ultimo,ok=!!G.result&&u&&u.puestos.length===4&&u.ganadores.length>=1&&u.scores.every(Number.isFinite);
            res.push({modo,nivel,seed,ok,t:+t.toFixed(1),sc:u&&u.scores.map(x=>+x.toFixed(1)),gan:u&&u.ganadores});
          }catch(e){res.push({modo,nivel,seed,ok:false,err:String(e)});}
        }
        const draw=[];for(const st of ['snes','felt','tinta']){try{setStyle(st);gameId='vs-'+id;restart();for(let i=0;i<40;i++)tick(1/30);paintFrame();draw.push([st,true]);}catch(e){draw.push([st,String(e)]);}}
        return{res,draw};
      },{id,modos:def.modos});
      const fallos=out.res.filter(r=>!r.ok),dfail=out.draw.filter(d=>d[1]!==true);
      const ts=out.res.map(r=>r.t).filter(Boolean),ws=new Set(out.res.map(r=>(r.gan||[]).join())).size;
      console.log((fallos.length||dfail.length||errors.length?'✗':'✓'),id,'runs',out.res.length,'fallos',fallos.length,'t',Math.min(...ts),'-',Math.max(...ts),'s · ganadores distintos',ws,errors.length?'· ERR '+errors.slice(0,3).join('|'):'');
      if(fallos.length)console.log('  ',JSON.stringify(fallos.slice(0,3)));if(dfail.length)console.log('  dibujo',JSON.stringify(dfail));
      if(fallos.length||dfail.length||errors.length)bad++;
      await page.evaluate(i=>{FIESTA.VS.cfg.modo=FIESTA.VS.games[i].modos?FIESTA.VS.games[i].modos[0]:'ffa';FIESTA.VS.cfg.seed=3;gameId='vs-'+i;restart();for(let k=0;k<(FIESTA.VS.games[i].dur||20)*15;k++)tick(1/30);paintFrame();},id).catch(()=>{});
      await page.screenshot({path:path.join(__dirname,'out',`vs-${id}.png`)}).catch(()=>{});
      await page.close();
    }
  }finally{await browser.close();srv.close();}
  process.exit(bad?1:0);
})();
