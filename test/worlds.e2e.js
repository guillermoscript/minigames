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
    const width=window.CAMP?GAME_VIEW.width:VW,offset=window.CAMP?GAME_VIEW.offsetX:OX;
    return {x:r.x+(x+offset)/width*r.width,y:r.y+y/600*r.height};
   },{x,y});
   await page.mouse.click(point.x,point.y);
  };
  // kit menus (title, main menu, worlds): tap a widget by id, wherever the current layout put it (wide or tall)
  const tapId=async id=>{
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const point=await page.evaluate(id=>MCUI.client(id),id);
   assert.ok(point,`kit widget ${id} is on screen`);
   await page.mouse.click(point.x,point.y);
  };
  const rootState=expected=>page.waitForFunction(expected=>typeof state!=='undefined'&&state===expected,expected);
  const campState=expected=>page.waitForFunction(expected=>window.CAMP?.state===expected,expected);
  const checkLandscape=async()=>{
   if(page.viewportSize().width<=page.viewportSize().height)return;
   await page.waitForFunction(()=>Math.abs(document.getElementById('c').getBoundingClientRect().width-innerWidth)<2);
   for(const selector of ['#c','#camp-ov']){
    const box=await page.locator(selector).boundingBox(),size=page.viewportSize();
    for(const [actual,expected] of [[box.x,0],[box.y,0],[box.width,size.width],[box.height,size.height]]){
     assert.ok(Math.abs(actual-expected)<2,`${selector} fills landscape: ${JSON.stringify({box,size})}`);
    }
   }
  };
  await page.goto(base+'/?lang=es');
  await page.waitForFunction(()=>typeof MCUI!=='undefined'&&!MCUI.stale(state));   // the title has drawn its first frame
  await page.keyboard.press('Enter');await rootState('main');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>MCUI.focus()),'m-play','main menu starts on PLAY');
  await page.keyboard.press('Enter');await rootState('worlds');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.world-menu').count(),0,'no replacement DOM menus');
  if(process.env.WORLD_SCREENSHOTS) await page.screenshot({path:`/tmp/minicaos-worlds-${viewport.width}.png`});
  await tapId('w-classic');await rootState('menu');
  await page.waitForTimeout(400);
  if(process.env.WORLD_SCREENSHOTS) await page.screenshot({path:`/tmp/minicaos-classic-${viewport.width}.png`});
  assert.equal(await page.evaluate(()=>save.unlocked),1);
  await tapId('stage-0');await rootState('stagein');
  assert.equal(await page.evaluate(()=>stageIdx),0);
  await page.keyboard.press('Escape');await rootState('menu');
  await page.waitForTimeout(400);
  await tapId('tab1');await rootState('practice');   // PRÁCTICA tab, same shell
  await tapId('back');await rootState('worlds');
  await page.waitForTimeout(400);
  const next=await page.evaluate(()=>TALL?'ArrowDown':'ArrowRight');   // cards sit in a 2×2 grid, or in a column on a phone held upright
  await page.keyboard.press(next);await page.keyboard.press(next);   // first press shows the focus, second moves it
  assert.equal(await page.evaluate(()=>MCUI.focus()),'w-venezuela');
  await page.keyboard.press('Enter');
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
  await tapId('vtab2');await campState('options');   // Venezuela's shell: ETAPAS · PRÁCTICA · OPCIONES tabs (kit)
  await tapId('niv2');assert.equal(await page.evaluate(()=>CAMP.info.nivel),2);
  assert.equal(await page.evaluate(()=>CAMP.info.selectedStyle),'snes','public Venezuela is always 16-bit');
  await tapId('vtab0');await campState('menu');
  await page.waitForTimeout(400);await tapId('vstage-0');
  await campState('play');assert.equal(await page.evaluate(()=>CAMP.info.stage),0);
  await checkLandscape();
  await page.keyboard.press('Escape');await campState('menu');
  await page.waitForTimeout(400);await tapId('back');await rootState('worlds');   // same VOLVER slot as every kit screen
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>MCUI.focus()),'w-venezuela','back from Venezuela lands on its card');
  await page.keyboard.press('Escape');await rootState('main');
  console.log(`OK ${viewport.width}: native worlds and classic UI, Venezuela settings/gameplay, return to worlds`);
  await context.close();
 }
 assert.deepEqual(errors,[]);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
