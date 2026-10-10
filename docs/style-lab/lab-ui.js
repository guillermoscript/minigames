'use strict';
// Development controls belong only to the standalone style laboratory.
for(const k in GAMES){const b=document.createElement('button');b.textContent=GAMES[k].name;b.dataset.k=k;b.onclick=()=>setGame(k);document.getElementById('games').append(b);}
const NEWSET=['wii','mario','bean','splat','candy','pixar','acnh','ww','ghibli'];
for(const k in STY){const b=document.createElement('button');b.textContent=STY[k].name;b.dataset.k=k;b.onclick=()=>setStyle(k);
  if(NEWSET.includes(k)){document.getElementById('styles').append(b);}else{b.style.opacity='.55';b.style.fontSize='12px';document.getElementById('styles2').append(b);}}
const vb=document.createElement('button');vb.textContent='📼 filtro VHS: off';vb.onclick=()=>{vhsOn=!vhsOn;vb.textContent='📼 filtro VHS: '+(vhsOn?'ON':'off');vb.classList.toggle('on',vhsOn);lastPaint=-9;};document.getElementById('styles2').append(vb);
document.getElementById('retry').onclick=restart;
document.getElementById('mic').onclick=toggleMic;
document.getElementById('spd').onclick=e=>{SP=SP===1?1.4:SP===1.4?1.8:1;e.target.textContent='vel '+SP+'x';restart();};

setStyle('hose');setGame('parada');
window.__lab={press,setStyle,setGame,restart,get G(){return G;},step(sec,dt=1/60){for(let t=0;t<sec;t+=dt)tick(dt);paintFrame();}};
