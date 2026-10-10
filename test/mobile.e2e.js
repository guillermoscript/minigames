// Phone rotation, fullscreen fallback and the bus game's touch controls.
// node test/mobile.e2e.js
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
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**/*',r=>r.abort());
    await page.addInitScript(()=>{
      window.requestAnimationFrame=()=>0;
      window.fullscreenRequests=0;
      // Simulate browsers that deny fullscreen: layout and controls must still work.
      Element.prototype.requestFullscreen=function(){window.fullscreenRequests++;return Promise.reject(new Error('unsupported'));};
    });
    const open=relative=>page.goto('file://'+path.join(root,relative));
    const fillsScreen=async selector=>{
      await page.waitForFunction(selector=>{
        const r=document.querySelector(selector).getBoundingClientRect();
        return Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2;
      },selector,{polling:50});
      const box=await page.locator(selector).boundingBox(),size=page.viewportSize();
      for(const [actual,expected] of [[box.x,0],[box.y,0],[box.width,size.width],[box.height,size.height]])assert.ok(Math.abs(actual-expected)<2,JSON.stringify({box,size}));
    };
    await open('docs/style-lab/public.html');
    await page.touchscreen.tap(195,422);
    assert.equal(await page.evaluate(()=>fullscreenRequests),1);
    for(const size of [{width:844,height:390},{width:932,height:360}]){
      await page.setViewportSize(size);
      await fillsScreen('#c');await fillsScreen('#camp-ov');
    }
    await page.setViewportSize({width:390,height:844});
    const portrait=await page.locator('#c').boundingBox();
    assert.ok(Math.abs(portrait.width/portrait.height-4/3)<.01);
    await page.setViewportSize({width:844,height:390});await fillsScreen('#c');
    await open('index.html');
    await page.setViewportSize({width:932,height:360});await fillsScreen('#c');
    await open('docs/style-lab/index.html');
    await page.addScriptTag({path:path.join(root,'docs/style-lab/juegos-bus.js')});
    const results=await page.evaluate(()=>{
      const ptr=(type,x)=>{
        const r=view.getBoundingClientRect();
        view.dispatchEvent(new PointerEvent(type,{pointerId:1,pointerType:'touch',bubbles:true,clientX:r.left+x/W*r.width,clientY:r.top+r.height*.7}));
      };
      setGame('agarrate');
      ptr('pointerdown',240);const left=BUS.steer();
      ptr('pointermove',560);const right=BUS.steer();
      ptr('pointermove',400);const center=BUS.steer();
      ptr('pointermove',480);const partial=BUS.steer();
      ptr('pointercancel',480);const released=BUS.steer();
      dispatchEvent(new DeviceOrientationEvent('deviceorientation',{gamma:80,beta:40}));
      const tilted=BUS.steer();
      ptr('pointerdown',560);dispatchEvent(new Event('blur'));const blurred=BUS.steer();
      const rounds=[];
      for(const sp of [1,1.4,1.8])for(let seed=1;seed<=12;seed++){
        let n=seed;Math.random=()=>((n=Math.imul(n,1664525)+1013904223|0)>>>0)/4294967296;
        SP=sp;setGame('agarrate');const g=G;
        // A player corrects only every 200ms, with small imprecise finger movements.
        ptr('pointerdown',400);
        for(let frame=0;frame<400&&!g.result;frame++){
          if(frame%12===0){const p=g.probe(),u=clamp(-(p.d*5+p.v),-1,1);ptr('pointermove',400+160*u+(Math.random()-.5)*20);}
          g.update(1/60);
        }
        ptr('pointerup',400);rounds.push(g.result);
      }
      setGame('agarrate');ptr('pointerdown',0);
      for(let frame=0;frame<400&&!G.result;frame++)G.update(1/60);
      ptr('pointerup',0);
      return{left,right,center,partial,released,tilted,blurred,rounds,wrongDirection:G.result};
    });
    assert.deepEqual([results.left,results.right,results.center,results.partial,results.released,results.tilted,results.blurred],[-1,1,0,.5,0,0,0]);
    assert.ok(results.rounds.every(r=>r==='win'),JSON.stringify(results.rounds));
    assert.equal(results.wrongDirection,'lose');
    await page.addScriptTag({path:path.join(root,'docs/style-lab/juego-jefe-metro.js')});
    const gestures=await page.evaluate(()=>{
      const ptr=(type,x,y)=>{
        const r=view.getBoundingClientRect();
        view.dispatchEvent(new PointerEvent(type,{pointerId:1,pointerType:'touch',bubbles:true,clientX:r.left+x/W*r.width,clientY:r.top+y/H*r.height}));
      };
      const seen=new Set(),moves=[];
      for(let i=0;i<60&&seen.size<4;i++){
        setGame('metro');const p=G.probe(),k=p.dir;seen.add(k);
        const dx=k==='left'?-120:k==='right'?120:0,dy=k==='up'?-120:k==='down'?120:0;
        ptr('pointerdown',400,300);ptr('pointermove',400+dx,300+dy);
        ptr('pointermove',400+dx*2,300+dy*2);ptr('pointerup',400+dx*2,300+dy*2);
        moves.push(G.probe().px-p.px);
      }
      setGame('metro');let p=G.probe();
      const buttonX={left:250,down:350,up:450,right:550}[p.dir];
      ptr('pointerdown',buttonX,538);const beforeRelease=G.probe().px-p.px;
      ptr('pointerup',buttonX,538);const tap=G.probe().px-p.px;
      setGame('metro');p=G.probe();
      ptr('pointerdown',400,300);ptr('pointermove',402,301);ptr('pointerup',402,301);
      const jitter=G.probe().px-p.px;
      ptr('pointerdown',250,538);ptr('pointercancel',250,538);
      const cancelled=G.probe().px-p.px;
      const k=p.dir,dx=k==='left'?-120:k==='right'?120:0,dy=k==='up'?-120:k==='down'?120:0;
      ptr('pointerdown',250,538);ptr('pointermove',250+dx,538+dy);ptr('pointerup',250+dx,538+dy);
      const fromButton=G.probe().px-p.px;
      setGame('metro');p=G.probe();
      ptr('pointerdown',400,300);ptr('pointerup',400+(p.dir==='right'?-120:120),300);
      const wrong=G.probe().px-p.px;
      return{seen:[...seen],moves,beforeRelease,tap,jitter,cancelled,fromButton,wrong};
    });
    assert.equal(gestures.seen.length,4);
    for(const delta of [...gestures.moves,gestures.tap,gestures.fromButton])assert.ok(Math.abs(delta+.08)<1e-8,JSON.stringify(gestures));
    assert.deepEqual([gestures.beforeRelease,gestures.jitter,gestures.cancelled],[0,0,0]);
    assert.ok(Math.abs(gestures.wrong-.055)<1e-8);
    const chancla=await page.evaluate(()=>{
      const ptr=(type,x,y)=>{
        const r=view.getBoundingClientRect();
        view.dispatchEvent(new PointerEvent(type,{pointerId:2,pointerType:'touch',bubbles:true,clientX:r.left+x/W*r.width,clientY:r.top+y/H*r.height}));
      };
      const rounds=[];
      for(const sp of [1,1.4,1.8])for(let seed=1;seed<=24;seed++){
        let n=seed;Math.random=()=>((n=Math.imul(n,1664525)+1013904223|0)>>>0)/4294967296;
        SP=sp;setGame('chancla');const g=G,seen={},handled=new Set();
        while(!g.result&&g.t<g.dur){
          for(const [i,h] of g.probe().th.entries()){
            if(h.st!=='fly'&&h.st!=='back')continue;
            const id=i+':'+h.st;
            if(seen[id]===undefined)seen[id]=g.t;
            // React 300ms after seeing the throw/rebound, with a real vertical gesture.
            if(!handled.has(id)&&g.t-seen[id]>=.3){
              handled.add(id);const y=h.k==='hi'?420:180;
              ptr('pointerdown',600,300);ptr('pointerup',600,y);
            }
          }
          g.update(1/60);
        }
        rounds.push({sp,seed,result:g.result,t:g.t,dur:g.dur});
      }
      SP=1;setGame('chancla');const g=G;
      while(g.t<g.T[0].rel)g.update(1/60);
      const launchX=g.probe().th[0].x;
      while(!g.result&&g.t<g.dur)g.update(1/60);
      return{rounds,launchX,withoutInput:g.result};
    });
    assert.ok(chancla.rounds.every(r=>r.result==='win'),JSON.stringify(chancla.rounds.filter(r=>r.result!=='win')));
    assert.ok(chancla.launchX>500,'The phone layout leaves visible travel space after the throw');
    assert.equal(chancla.withoutInput,'lose');
    assert.deepEqual(errors,[]);
    if(process.env.MOBILE_SCREENSHOTS){
      const visual=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
      const preview=await visual.newPage();
      await preview.route('https://**/*',r=>r.abort());
      await preview.goto('file://'+path.join(root,'docs/style-lab/public.html')+'?juego=agarrate');
      await preview.waitForTimeout(700);
      await preview.screenshot({path:'/tmp/minicaos-mobile-landscape.png'});
      await preview.goto('file://'+path.join(root,'docs/style-lab/public.html')+'?juego=chancla');
      await preview.waitForFunction(()=>gameId==='chancla'&&G&&G.t>G.T[0].rel+.2);
      await preview.screenshot({path:'/tmp/minicaos-chancla-mobile.png'});
      await preview.route('http://egg-preview.test/**',async route=>{
        const pathname=decodeURIComponent(new URL(route.request().url()).pathname);
        const file=path.resolve(root,'.'+pathname);
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){await route.fulfill({status:404,body:''});return;}
        await route.fulfill({path:file});
      });
      await preview.goto('http://egg-preview.test/docs/style-lab/public.html');
      await preview.keyboard.press('KeyZ');
      await preview.evaluate(()=>{EGGS.stage();EGGS.begin('hello');});
      await preview.waitForFunction(()=>EGGS.play('alert'),null,{polling:100});
      await preview.waitForTimeout(200);
      await preview.screenshot({path:'/tmp/minicaos-easter-egg-mobile.png'});
      await visual.close();
    }
    console.log('OK: mobile rotation and controls; 36 bus rounds; boss gestures; 72 chancla rounds with 300ms reactions, including feints and rebounds');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
