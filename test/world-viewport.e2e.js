// Verify geometry and input, not just whether CSS fills the phone screen.
// node test/world-viewport.e2e.js
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..');
const cache=path.join(os.homedir(),'.npm/_npx');
const modulePath=process.env.PLAYWRIGHT_MODULE||fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules/playwright')).find(p=>fs.existsSync(p));
const {chromium}=require(modulePath);
const shells=path.join(os.homedir(),'Library/Caches/ms-playwright');
const folder=path.join(shells,fs.readdirSync(shells).filter(d=>d.startsWith('chromium_headless_shell-')).sort().pop());
const executablePath=process.env.CHROMIUM_EXECUTABLE||path.join(folder,fs.readdirSync(folder).find(d=>d.startsWith('chrome')),'chrome-headless-shell');
(async()=>{
 const browser=await chromium.launch({executablePath});
 try{
  for(const deviceScaleFactor of [1,3]){
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',e=>{if(e.type()==='error'&&e.text().startsWith('[campana]'))errors.push(e.text());});
   await page.route('https://**/*',r=>r.abort());
   await page.addInitScript(()=>{
    window.requestAnimationFrame=()=>0;
    localStorage.setItem('minicaos-lab-niveles-v1',JSON.stringify({musica:false}));
    Element.prototype.requestFullscreen=()=>Promise.reject(new Error('unsupported'));
   });
   await page.goto('file://'+path.join(root,'docs/style-lab/public.html'));
   for(const viewport of [{width:844,height:390},{width:932,height:360},{width:896,height:414},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await page.waitForFunction(()=>Math.abs(GAME_VIEW.width-600*Math.max(4/3,innerWidth/innerHeight))<.01,null,{polling:50});
    const result=await page.evaluate(()=>{
     CAMP.estilo('felt');CAMP.nivel=1;CAMP.startPractice('encaleta');tick(1);tick(1.5);tick(.016);paintFrame();
     const c=view.getBoundingClientRect(),k=c.height/600;
     // A real draggable object starts at (350,300); drag it into the sock.
     const pointer=(type,x,y)=>view.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'touch',
      clientX:c.left+c.width/2+(x-400)*k,clientY:c.top+y*k}));
     pointer('pointerdown',350,300);pointer('pointermove',150,540);pointer('pointerup',150,540);
     const drag=G.probe();
     // The visible output must keep a circle round, with its centre at the
     // same screen position used for input. Scan pixels from the actual canvas.
     G.draw=()=>{ctx.fillStyle='#000';ctx.fillRect(gameLeft(),0,GAME_VIEW.width,600);ctx.fillStyle='#00ff00';ctx.beginPath();ctx.arc(400,300,50,0,Math.PI*2);ctx.fill();};
     paintFrame();
     const g=view.getContext('2d'),pixels=g.getImageData(0,0,view.width,view.height).data;
     let x0=view.width,x1=0,y0=view.height,y1=0;
     for(let y=0;y<view.height;y++)for(let x=0;x<view.width;x++){
      const i=(y*view.width+x)*4;
      if(pixels[i+1]>200&&pixels[i]<30&&pixels[i+2]<30){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
     }
     const p=canvasPoint({clientX:c.left+c.width/2-150*k,clientY:c.top+450*k});
     return {drag,c:c.toJSON(),circle:{w:(x1-x0+1)*c.width/view.width,h:(y1-y0+1)*c.height/view.height,
      x:c.left+(x0+x1+1)/2*c.width/view.width,y:c.top+(y0+y1+1)/2*c.height/view.height},p,
      native:{width:vctx.canvas.width,height:vctx.canvas.height}};
    });
    assert.deepEqual(result.native,{width:Math.ceil(600*Math.max(4/3,viewport.width/viewport.height)),height:600});
    assert.equal(result.drag.hid,true,'dragging the visible phone reaches its hiding spot');
    assert.ok(Math.abs(result.circle.w-result.circle.h)<2,JSON.stringify(result.circle));
    assert.ok(Math.abs(result.circle.x-viewport.width/2)<1);
    assert.ok(Math.abs(result.circle.y-viewport.height/2)<1);
    assert.ok(Math.abs(result.p.x-250)<.01&&Math.abs(result.p.y-450)<.01);
    if(viewport.width>viewport.height){
     assert.ok(Math.abs(result.c.width-viewport.width)<1&&Math.abs(result.c.height-viewport.height)<1);
    }else assert.ok(Math.abs(result.c.width/result.c.height-4/3)<.001);
    console.log(`OK geometry: ${viewport.width}×${viewport.height}, DPR ${deviceScaleFactor}`);
   }
   await page.setViewportSize({width:932,height:360});
   await page.waitForFunction(()=>Math.abs(GAME_VIEW.width-600*innerWidth/innerHeight)<.01,null,{polling:50});
   const fields=await page.evaluate(()=>{
    const start=id=>{CAMP.nivel=1;CAMP.estilo('tinta');CAMP.startPractice(id);tick(1);tick(1.5);tick(.016);};
    const pointer=(type,x,y)=>{const r=view.getBoundingClientRect();view.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'touch',clientX:r.left+(x+GAME_VIEW.offsetX)*r.width/GAME_VIEW.width,clientY:r.top+y*r.height/600}));};
    start('baja');const bus=G.probe();for(let i=0;i<bus.need;i++)G.press();const busWin=G.result;
    start('chancla');const chancla=G.probe();
    start('trencito');pointer('pointerdown',gameLeft()+150,300);const train=G.probe();pointer('pointercancel',0,0);
    start('tendedero');const cloth=G.probe().prendas.at(-1);pointer('pointerdown',cloth.x,cloth.y);pointer('pointermove',cloth.x,cloth.y+90);pointer('pointerup',cloth.x,cloth.y+90);const collected=G.probe().done;
    start('zancudo');let mosquito=null;for(let i=0;i<120;i++){G.update(.035);const m=G.probe();if(m.x>800){mosquito=m;break;}}
    if(mosquito){pointer('pointerdown',mosquito.x,mosquito.y);pointer('pointerup',mosquito.x,mosquito.y);}
    return {width:GAME_VIEW.width,bus,busWin,chancla,train,cloth,collected,mosquito,mosquitoWin:G.result};
   });
   assert.ok(fields.bus.X1-fields.bus.X0>1000,'bus play journey grows with the screen');
   assert.equal(fields.busWin,'win');
   assert.ok(fields.chancla.MX-fields.chancla.KX>1000,'mother and player use opposite sides of the scene');
   assert.ok(fields.train.tx<0,'the train can be steered into the added play field');
   assert.ok(fields.cloth.x>800,'clothes are distributed across the actual viewport');
   assert.equal(fields.collected,1,'a real gesture collects a target beyond the old 800px field');
   assert.ok(fields.mosquito,'mosquito flies into the extended scene');
   assert.equal(fields.mosquitoWin,'win','a real touch hits the mosquito beyond the old boundary');
   const beforeRotation=await page.evaluate(()=>{CAMP.startPractice('baja');tick(1);tick(1.5);tick(.016);G.press();return CAMP.info;});
   await page.setViewportSize({width:390,height:844});
   await page.waitForFunction(()=>GAME_VIEW.width===800,null,{polling:50});
   const afterRotation=await page.evaluate(()=>({info:CAMP.info,bounds:G.probe()}));
   assert.equal(afterRotation.info.lives,beforeRotation.lives);assert.equal(afterRotation.info.played,beforeRotation.played);
   assert.equal(afterRotation.bounds.X0,92);assert.equal(afterRotation.bounds.X1,644);
   await page.setViewportSize({width:932,height:360});
   await page.waitForFunction(()=>GAME_VIEW.width>1500,null,{polling:50});
   console.log('OK: extended play fields, gestures outside old bounds, and rotation without losing stage progress');
   const rounds=await page.evaluate(()=>{
    let rounds=0;
    for(const id of [...CAMP.TODOS,...Object.keys(CAMP.JEFES)])for(const level of [1,2,3])for(const style of ['snes','felt','ww','anime','tinta','garabato']){
     CAMP.nivel=level;CAMP.estilo(style);CAMP.startPractice(id);tick(1);tick(1.5);tick(.016);paintFrame();
     if(vctx.canvas.width!==Math.ceil(GAME_VIEW.width)||vctx.canvas.height!==600)throw new Error(id+' changed its viewport');
     if(id!=='parada'&&id!=='chancla'){
      let received=null;G.down=p=>{received=p;};
      const r=view.getBoundingClientRect(),k=r.height/600;
      view.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,pointerType:'touch',
       clientX:r.left+r.width/2-170*k,clientY:r.top+300*k}));
      view.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1,pointerType:'touch'}));
      if(!received||Math.abs(received.x-230)>.01||Math.abs(received.y-300)>.01)throw new Error(id+' input does not match drawing');
     }
     rounds++;
    }
    return rounds;
   });
   assert.deepEqual(errors,[]);
   console.log(`OK: ${rounds} game/level/style combinations with native viewports and matching touch coordinates, DPR ${deviceScaleFactor}`);
   if(process.env.WORLD_SCREENSHOTS&&deviceScaleFactor===3){
    for(const [id,style] of [['baja','felt'],['chancla','snes'],['metro','anime'],['tendedero','tinta'],['mango','tinta'],['trencito','felt']]){
     await page.evaluate(({id,style})=>{CAMP.nivel=1;CAMP.estilo(style);CAMP.startPractice(id);tick(1);tick(1.5);tick(.1);paintFrame();},{id,style});
     await page.screenshot({path:`/tmp/minicaos-viewport-${id}.png`});
    }
   }
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
