// Console menus (docs/ui/01-menu-redesign.md): every screen reached by keyboard and by touch, back returns where you came from
// with the focus on the button you left by, JOIN routes LA FIESTA codes to their page. MENUS_BASE_URL=http://127.0.0.1:8873 node test/menus.e2e.js
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const npmCache=path.join(os.homedir(),'.npm/_npx');
const playwright=process.env.PLAYWRIGHT_MODULE || fs.readdirSync(npmCache).map(d=>path.join(npmCache,d,'node_modules/playwright')).find(p=>fs.existsSync(p));
const {chromium}=require(playwright);
const shellCache=path.join(os.homedir(),'Library/Caches/ms-playwright');
const shellVersion=fs.readdirSync(shellCache).filter(d=>d.startsWith('chromium_headless_shell-')).sort().pop();
const shellFolder=path.join(shellCache,shellVersion);
const executable=process.env.CHROMIUM_EXECUTABLE || path.join(shellFolder,fs.readdirSync(shellFolder).find(d=>d.startsWith('chrome')),'chrome-headless-shell');
const base=process.env.MENUS_BASE_URL || 'http://127.0.0.1:8873';
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:executable});
 for(const viewport of [{width:1280,height:800},{width:375,height:812},{width:812,height:375}]){
  const touch=viewport.width<900,tag=`${viewport.width}x${viewport.height}`;
  const context=await browser.newContext({viewport,isMobile:touch,hasTouch:touch,serviceWorkers:'block',locale:'es-VE'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/party/kind/FIES',r=>r.fulfill({status:200,contentType:'application/json',body:'{"kind":"fiesta"}'}));
  const at=async s=>{await page.waitForFunction(s=>state===s&&!MCUI.stale(s),s);await page.waitForTimeout(120);};
  const focus=()=>page.evaluate(()=>MCUI.focus());
  const press=async(...keys)=>{for(const k of keys)await page.keyboard.press(k);};
  const tapId=async id=>{
   await page.waitForTimeout(80);
   const p=await page.evaluate(id=>MCUI.client(id),id);assert.ok(p,`${tag}: ${id} is on screen`);
   if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
  };
  await page.goto(base+'/?lang=es');
  await page.waitForFunction(()=>typeof MCUI!=='undefined'&&!MCUI.stale(state));
  assert.equal(await page.evaluate(()=>TALL),viewport.height>viewport.width,'tall layout only when upright');
  if(touch){
   await tapId('go');await at('main');
   for(const [id,screen,backTo] of [['m-play','worlds','m-play'],['m-party','party','m-party'],['m-options','options','m-options'],['m-invite','invite','m-invite']]){
    await tapId(id);await at(screen);await tapId('back');await at('main');
    assert.equal(await focus(),backTo,`${tag}: back from ${screen} lands on ${backTo}`);
   }
   await tapId('m-party');await at('party');await tapId('p-friends');await at('friends');await tapId('back');await at('party');
   await tapId('p-invite');await at('invite');await tapId('back');await at('party');
  }else{
   await press('Enter');await at('main');
   assert.equal(await focus(),'m-play');
   await press('ArrowDown');await press('Enter');await at('party');            // focus already showing after Enter: one press moves it
   await press('Escape');await at('main');assert.equal(await focus(),'m-party');
   await press('ArrowDown','ArrowDown','ArrowDown','Enter');await at('options');
   await press('Backspace');await at('main');assert.equal(await focus(),'m-options');
   await press('KeyF');await at('party');
   await press('Escape');await at('main');
   await press('ArrowUp','ArrowUp','ArrowUp','ArrowUp','Enter');await at('worlds');
   await press('Escape');await at('main');assert.equal(await focus(),'m-play');
   await press('Escape');await at('title');
  }
  // MI PERFIL: a guest picks a character; it sticks on this device and shows on the player chip
  await page.evaluate(()=>{goMain();});await at('main');
  await tapId('m-profile');await at('profile');
  const before=await page.evaluate(()=>perfil.ch);await tapId('ch-next');
  const after=await page.evaluate(()=>perfil.ch);assert.notEqual(after,before);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('minicaos-perfil-v1')).ch),after);
  await tapId('guest');await at('main');assert.equal(await focus(),'m-profile',`${tag}: back from the profile lands on MI PERFIL`);
  await page.evaluate(()=>{setChar(-1);});
  // OPCIONES: the music slider steps by tenths, the value is saved and the music bus follows it after a reload
  await tapId('m-options');await at('options');
  const m0=await page.evaluate(()=>vol.music);await tapId('o-music-dn');
  assert.equal(await page.evaluate(()=>vol.music),Math.round((m0-.1)*10)/10);
  await tapId('o-controls');await at('controls');await tapId('back');await at('options');assert.equal(await focus(),'o-controls');
  await page.reload();await page.waitForFunction(()=>typeof MCUI!=='undefined'&&!MCUI.stale(state));
  assert.equal(await page.evaluate(()=>{audio();return [vol.music,Math.round(MUSIC.gain.value*10)/10];}).then(v=>v[0]===v[1]&&v[0]),Math.round((m0-.1)*10)/10);
  await page.evaluate(()=>{setVolume('music',.8);goMain();});await at('main');
  // RÉCORDS: the stage stepper changes the board, the world tabs switch to Venezuela's device records
  await tapId('m-records');await at('board');
  const tab0=await page.evaluate(()=>lb.tab);await tapId('lb-next');assert.equal(await page.evaluate(()=>lb.tab),(tab0+1)%await page.evaluate(()=>STAGES.length));
  await tapId('lbw1');assert.equal(await page.evaluate(()=>lbWorld),1);await tapId('lbw0');
  await tapId('back');await at('main');assert.equal(await focus(),'m-records',`${tag}: back from records lands on RÉCORDS`);
  // MARGARITA (local only): the kit shell picks the turns, starts the board, Esc asks before leaving, back lands on its card
  await page.evaluate(()=>{goWorlds();});await at('worlds');
  await tapId('w-margarita');await page.waitForURL(/docs\/margarita/);await page.waitForFunction(()=>window.MARGARITA_SHELL&&MARGARITA_SHELL.on);
  await tapId('turnos-15');await tapId('arrancar');
  await page.waitForFunction(()=>!MARGARITA_SHELL.on&&MARGARITA.S.turno>=1);
  assert.match(await page.evaluate(()=>document.getElementById('turno').textContent),/1\/15/);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>MARGARITA_SHELL.on);await tapId('dlg1');
  await page.waitForURL(/from=margarita/);await at('worlds');assert.equal(await focus(),'w-margarita',`${tag}: back from Margarita lands on its card`);
  const autostart=await context.newPage();await autostart.goto(base+'/docs/margarita/?cpu=1&sinmj=1&turnos=1');
  await autostart.waitForFunction(()=>window.MARGARITA&&MARGARITA.S.turno>=1&&!MARGARITA_SHELL.on);await autostart.close();   // ?cpu=1 still skips the shell
  // JOIN: a LA FIESTA code goes to its own page
  await page.evaluate(()=>{goParty('main');});await at('party');
  await page.evaluate(()=>{inCode.value='FIES';});
  await tapId('join');
  await page.waitForURL(/fiesta\.html\?r=FIES/);
  assert.deepEqual(errors,[],`${tag}: no page errors`);
  console.log(`OK ${tag}: title, main menu, worlds, panas, invite, friends, options, profile, records, volumes, controls, margarita; back and focus; character; FIESTA code routing`);
  await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
