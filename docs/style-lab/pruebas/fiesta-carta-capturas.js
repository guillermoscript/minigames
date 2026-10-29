// LA FIESTA · capturas de las pantallas del minijuego (fiesta-carta.js) con datos falsos, sin servidor ni red.
// node docs/style-lab/pruebas/fiesta-carta-capturas.js [pantallas] [estilos] [WxH,..] [juego]
//   pantallas: ruleta,tarjeta,cuenta,juego,fin,podio · estilos: snes,tinta,felt,ww,anime,garabato · juego: f_mecate|f_domino|f_harina
// Salida: docs/style-lab/pruebas/out/carta-<juego>-<pantalla>-<estilo>-<WxH>.png (mírelas con Read y corrija solapes con el reloj/los controles).
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http');
const cache=path.join(os.homedir(),'.npm/_npx');
const {chromium}=require(fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules/playwright')).find(fs.existsSync));
const ROOT=path.join(__dirname,'..'), OUT=path.join(__dirname,'out');
fs.mkdirSync(OUT,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png'};
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(ROOT,u==='/'?'fiesta.html':u);fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});r.end(b);});});
function chromePath(){const mac='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';return fs.existsSync(mac)?mac:undefined;}
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
 const pantallas=(process.argv[2]||'ruleta,tarjeta,cuenta,juego,fin,podio').split(','), styles=(process.argv[3]||'snes,tinta,felt').split(','), sizes=(process.argv[4]||'932x430,360x640').split(',').map(s=>s.split('x').map(Number));
 const b=await chromium.launch({executablePath:chromePath()});
 for(const [w,h] of sizes){
  const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true,deviceScaleFactor:2});const p=await ctx.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
  for(const s of styles){
   await p.goto(`http://127.0.0.1:${port}/fiesta.html?estilo=${s}`);
   await p.waitForFunction(()=>window.FIESTA_DEBUG&&FIESTA_DEBUG.carta);
   for(const pa of pantallas){
    const tipos=pa==='ruleta'?['ffa','2v2','1v3']:['ffa'];
    for(const tipo of tipos){
    await p.evaluate(({pa,tipo,gj})=>{
      const F=FIESTA_DEBUG.F, T=F.reglas.T;
      const ch=['mama','tio','abuela','pana'];
      const pj={};['a','b','c','d'].forEach((s,i)=>{pj[s]={ch:ch[i],name:i===3?'CPU · EL PORTU':['ANA','BETO','CARLA'][i],cpu:i===3?'auto':null,mon:10+i};});
      const NOW=1e12, mj={k:3,i:0,tipo,as:['a','b','c','d'],eq:tipo==='2v2'?[['a','b'],['c','d']]:tipo==='1v3'?[['b'],['a','c','d']]:[['a'],['b'],['c'],['d']],solo:tipo==='1v3'?'b':null,
        cartaHasta:NOW+(pa==='ruleta'?T.carta-1500:9000),startAt:null,cierre:null,listos:{c:1},rel:0,
        cola:[{g:'f_mecate',seed:5,dur:45,lv:1,modelo:'A'}],juez:'a',e:0,res:null,clase:'survival'};
      let sn=NOW, f='carta', over=false, cuenta=null;
      if(pa==='ruleta') sn=NOW+ (tipo==='ffa'?800:3600)-(0);
      if(pa==='ruleta') sn=mj.cartaHasta-T.carta+ (window.__rt||3600);
      if(pa==='cuenta'){f='mj';mj.startAt=NOW+2200;cuenta={n:3,frac:.3};}
      if(pa==='juego'){f='mj';mj.startAt=NOW-5000;}
      if(pa==='fin'){f='mj';mj.startAt=NOW-5000;over=true;}
      if(pa==='podio'){f='res';mj.res={sc:[1351,300,412,380],puestos:[1,4,2,3],pagos:[10,1,6,3],empate:0,cpu:['d']};}
      const S={f,ver:5,pj,mj,nextAt:NOW+4000};
      const def=F.LIVE.get(pa==='ruleta'||pa==='tarjeta'||pa==='cuenta'||pa==='juego'||pa==='fin'||pa==='podio'?gj:'f_mecate');
      const sess={key:'3:0',id:def.id,def:def,over,listos:{c:1},phase:f==='mj'?(over?'fin':'juego'):'carta',
        c:{yo:0,modo:tipo,lv:1,mio:()=>true,seats:[]},draw:()=>{},cuenta:()=>cuenta,close:()=>{},ready:()=>{},
        in:{down(){},up(){},tap(){},axis(){}},
        hud:()=>({gt:5,dur:45,quedan:40,over,fase:over?'fin':'juego',juez:'a',items:['a','b','c','d'].map((s,i)=>({i,id:s,name:pj[s].name,ch:pj[s].ch,team:i,yo:i===0,cpu:i===3,caido:false,vivo:i!==1,sc:[0,100,200,300][i]}))})};
      const C=FIESTA_DEBUG.carta; C.cerrar(); C.abrir(sess);
      G.draw=function(){ const e=FIESTA_DEBUG.estadoVm||null; C.dibujar({S,D:{board:S},yo:'a',serverNow:sn,izq:gameLeft(),der:gameRight(),compacto:innerWidth<innerHeight||false,seats:[],sess,net:null,ahoraMs:performance.now()}); };
    },{pa,tipo,gj:process.argv[5]||'f_mecate'});
    await p.waitForTimeout(700);
    await p.screenshot({path:path.join(OUT,`carta-${process.argv[5]||'f_mecate'}-${pa}${pa==='ruleta'?'-'+tipo:''}-${s}-${w}x${h}.png`)});console.log('shot',pa,tipo,s,w,h);
    }
   }
  }
 }
 await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1)});
