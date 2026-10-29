// Play the adapted fields at a phone landscape size using the existing game bots.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),cache=path.join(os.homedir(),'.npm/_npx');
const {chromium}=require(fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules/playwright')).find(fs.existsSync));
const shells=path.join(os.homedir(),'Library/Caches/ms-playwright');
const folder=path.join(shells,fs.readdirSync(shells).filter(d=>d.startsWith('chromium_headless_shell-')).sort().pop());
(async()=>{
 const browser=await chromium.launch({executablePath:path.join(folder,fs.readdirSync(folder).find(d=>d.startsWith('chrome')),'chrome-headless-shell')});
 try{
  const page=await browser.newPage({viewport:{width:932,height:360},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error'&&e.text().startsWith('[campana]'))errors.push(e.text());});
  await page.route('https://**/*',r=>r.abort());
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await page.goto('file://'+root+'/docs/style-lab/public.html');
  await page.addScriptTag({content:'var BOTS={};'});
  const games=['baja','trencito','mango','tendedero','zancudo'];
  for(const id of games)await page.addScriptTag({path:root+'/docs/style-lab/pruebas/bots/'+id+'.js'});
  const results=await page.evaluate(games=>{
   snd=()=>{};nz=()=>{};
   const results=[];
   const start=(id,level)=>{CAMP.nivel=level;CAMP.startPractice(id);tick(1);tick(1.5);tick(.016);return G;};
   const pointer=(type,x,y)=>{
    const r=view.getBoundingClientRect();
    view.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'touch',
     clientX:r.left+(x+GAME_VIEW.offsetX)*r.width/GAME_VIEW.width,clientY:r.top+y*r.height/600}));
   };
   for(const id of games)for(const level of [1,2,3])for(let seed=1;seed<=12;seed++){
    let n=seed;Math.random=()=>((n=Math.imul(n,1664525)+1013904223|0)>>>0)/4294967296;
    const g=start(id,level);
    const T={
     get G(){return g;},P:()=>g.probe(),listo:()=>!!g.result,
     S(sec){for(let i=0;i<Math.ceil(sec*60);i++)g.update(1/60);},foto(){},
     hasta(fn,sec){for(let i=0;i<Math.ceil(sec*60)&&!fn();i++)g.update(1/60);},
     down(x,y){pointer('pointerdown',x,y);},move(x,y){pointer('pointermove',x,y);},up(x,y){pointer('pointerup',x,y);},
     tap(x,y){this.down(x,y);this.up(x,y);},
     drag(x,y,x1,y1,sec){this.down(x,y);this.move(x1,y1);this.up(x1,y1);this.S(sec);}
    };
    try{BOTS[id].gana(T);results.push({id,level,seed,result:g.result});}
    catch(e){results.push({id,level,seed,error:e.message,result:g.result});}
   }
   // The tilted bus needs additional room around the scene and a circular gesture.
   for(const level of [1,2,3])for(const style of ['snes','felt','ww','anime','tinta','garabato']){
    CAMP.estilo(style);const g=start('amarrala',level);paintFrame();
    let q=g.probe();pointer('pointerdown',q.cx+q.R,q.cy);
    for(let i=1;i<=240&&!g.result;i++){
     q=g.probe();const a=i/40*TAU;
     pointer('pointermove',q.cx+Math.cos(a)*q.R,q.cy+Math.sin(a)*q.R);g.update(1/240);
    }
    pointer('pointerup',q.cx,q.cy);paintFrame();results.push({id:'amarrala',level,style,result:g.result});
   }
   return results;
  },games);
  const failures=results.filter(r=>r.result!=='win'||r.error);
  assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
  console.log(`OK: ${results.length} touch-controlled rounds in expanded play fields at 932×360`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
