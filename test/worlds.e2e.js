// Local browser smoke: WORLD_BASE_URL=http://127.0.0.1:8766 node test/worlds.e2e.js
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const npmCache=path.join(os.homedir(),'.npm/_npx');
const playwright=process.env.PLAYWRIGHT_MODULE || fs.readdirSync(npmCache).map(d=>path.join(npmCache,d,'node_modules/playwright')).find(p=>fs.existsSync(p));
const {chromium}=require(playwright);
const shellCache=path.join(os.homedir(),'Library/Caches/ms-playwright');
const shellVersion=fs.readdirSync(shellCache).filter(d=>d.startsWith('chromium_headless_shell-')).sort().pop();
const shellFolder=path.join(shellCache,shellVersion);
const executable=process.env.CHROMIUM_EXECUTABLE || path.join(shellFolder,fs.readdirSync(shellFolder).find(d=>d.startsWith('chrome')),'chrome-headless-shell');
const base=process.env.WORLD_BASE_URL || 'http://127.0.0.1:8766';
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:executable});
 const errors=[];
 for(const viewport of [{width:1280,height:800},{width:844,height:390},{width:390,height:844}]){
  const context=await browser.newContext({viewport,locale:'es-VE',serviceWorkers:'block',isMobile:viewport.width<640,hasTouch:viewport.width<640});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const resources=[];page.on('request',r=>resources.push(r.url()));
  await page.addInitScript(()=>{
    window.__labControlsSeen=false;
    new MutationObserver(()=>{
      if(document.querySelector('#games,#styles,#styles2,#help,.bar'))window.__labControlsSeen=true;
    }).observe(document,{subtree:true,childList:true});
  });
  await page.route('https://**/*',r=>r.abort());
  const tap = async(x,y)=>{
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const point=await page.evaluate(({x,y})=>{
    const c=document.getElementById('c'),r=c.getBoundingClientRect();
    const width=window.CAMP?800:VW,offset=window.CAMP?0:OX;
    return {x:r.x+(x+offset)/width*r.width,y:r.y+y/600*r.height};
   },{x,y});
   await page.mouse.click(point.x,point.y);
  };
  const rootState=expected=>page.waitForFunction(expected=>typeof state!=='undefined'&&state===expected,expected);
  const campState=expected=>page.waitForFunction(expected=>window.CAMP?.state===expected,expected);
  const checkLandscape=async()=>{
   if(page.viewportSize().width<=page.viewportSize().height)return;
   for(const selector of ['#c','#camp-ov']){
    const box=await page.locator(selector).boundingBox(),size=page.viewportSize();
    for(const [actual,expected] of [[box.x,0],[box.y,0],[box.width,size.width],[box.height,size.height]]){
     assert.ok(Math.abs(actual-expected)<2,`${selector} fills landscape: ${JSON.stringify({box,size})}`);
    }
   }
  };
  await page.goto(base+'/?lang=es');
  await page.keyboard.press('Enter');await rootState('worlds');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.world-menu').count(),0,'no replacement DOM menus');
  if(process.env.WORLD_SCREENSHOTS) await page.screenshot({path:`/tmp/minicaos-worlds-${viewport.width}.png`});
  await tap(210,270);await rootState('menu');
  await page.waitForTimeout(400);
  if(process.env.WORLD_SCREENSHOTS) await page.screenshot({path:`/tmp/minicaos-classic-${viewport.width}.png`});
  assert.equal(await page.evaluate(()=>save.unlocked),1);
  await tap(140,165);await rootState('stagein');
  assert.equal(await page.evaluate(()=>stageIdx),0);
  await page.keyboard.press('Escape');await rootState('menu');
  await tap(550,490);await rootState('worlds');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  await campState('menu');await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>CAMP.ETAPAS.length),5);
  assert.equal(await page.evaluate(()=>window.__labControlsSeen),false,'lab controls never enter the public DOM');
  assert.equal(resources.some(url=>/\/(engine\.html|lab-ui\.js|jugar\.html)(?:[?]|$)/.test(url)),false,'public entry never loads laboratory HTML or controls');
  assert.equal(await page.locator('.world-menu').count(),0,'Venezuela uses original canvas UI');
  await checkLandscape();
  if(viewport.width<viewport.height){
   await page.setViewportSize({width:844,height:390});
   await checkLandscape();
   await page.setViewportSize(viewport);
  }
  if(process.env.WORLD_SCREENSHOTS) await page.screenshot({path:`/tmp/minicaos-venezuela-${viewport.width}.png`});
  await tap(550,450);await campState('options');
  await tap(400,210);assert.equal(await page.evaluate(()=>CAMP.info.nivel),2);
  await tap(180,400);assert.equal(await page.evaluate(()=>CAMP.info.selectedStyle),'felt');
  await tap(730,400);assert.equal(await page.evaluate(()=>CAMP.info.selectedStyle),'mezcla');
  await page.keyboard.press('Escape');await campState('menu');
  await page.waitForTimeout(400);await tap(160,110);
  await campState('play');assert.equal(await page.evaluate(()=>CAMP.info.stage),0);
  await checkLandscape();
  await page.keyboard.press('Escape');await campState('menu');
  await tap(80,32);await rootState('worlds');
  console.log(`OK ${viewport.width}: native worlds and classic UI, Venezuela settings/gameplay, return to worlds`);
  await context.close();
 }
 assert.deepEqual(errors,[]);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
