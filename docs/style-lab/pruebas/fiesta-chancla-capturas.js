const fs=require('fs'),path=require('path'),os=require('os');
const cache=path.join(os.homedir(),'.npm/_npx');
const {chromium}=require(fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules/playwright')).find(fs.existsSync));
// node docs/style-lab/pruebas/fiesta-chancla-capturas.js [niveles]  (servidor en :8765) -> pruebas/out/chancla-lvN-K.png
const OUT=path.join(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
function chromePath(){const shells=path.join(os.homedir(),'Library/Caches/ms-playwright');try{const d=fs.readdirSync(shells).filter(x=>x.startsWith('chromium_headless_shell-')).sort().pop();if(d){const f=path.join(shells,d),sub=fs.readdirSync(f).find(x=>x.startsWith('chrome'));const q=path.join(f,sub,'chrome-headless-shell');if(fs.existsSync(q))return q;}}catch(_){}const mac='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';return fs.existsSync(mac)?mac:undefined;}
(async()=>{
 const b=await chromium.launch({executablePath:chromePath(),args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});let errs=0;
 for(const lv of (process.argv[2]||'1,3').split(',')){
  for(const [W,H] of [[932,430],[360,640]]){const p=await b.newPage({viewport:{width:W,height:H}});
  p.on('pageerror',e=>{errs++;console.log('PAGEERR',e.message);});p.on('console',m=>{if(m.type()==='error'){errs++;console.log('CONSOLE',m.text());}});
  await p.goto(`http://localhost:8765/docs/style-lab/fiesta.html?practica=f_chancla&lv=${lv}`);
  for(let k=0;k<3;k++){await p.waitForTimeout(k?5000:9000);await p.screenshot({path:path.join(OUT,`chancla-lv${lv}-${W}x${H}-${k}.png`)});}
  await p.close();}
 }
 await b.close();console.log(errs?'ERRORES '+errs:'sin errores');
})();
