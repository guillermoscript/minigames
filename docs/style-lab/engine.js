'use strict';
const W=800,H=600,INK='#14101c',TAU=Math.PI*2,PW=267,PH=200;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,k)=>a+(b-a)*k,ease=k=>k*k*(3-2*k);
const view=document.getElementById('c'),vctx=view.getContext('2d');
const small=document.createElement('canvas');small.width=PW;small.height=PH;const sctx=small.getContext('2d');
let ctx=vctx,now=0,sid=0,FRJ=0,style='tinta',gameId='parada',G=null,SP=1;

/* ───────── helpers ───────── */
const hash=(a,b,c)=>{let h=(a*374761393+b*668265263+c*2147483647)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295;};
const rgb=c=>c.length===4?[1,2,3].map(i=>parseInt(c[i]+c[i],16)):[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
const mix=(a,b,k)=>{const A=rgb(a),B=rgb(b);return'#'+A.map((v,i)=>Math.round(lerp(v,B[i],k)).toString(16).padStart(2,'0')).join('');};
const dark=(c,k=.25)=>mix(c,INK,k);
const lum=c=>{const[r,g,b]=rgb(c);return(r*.3+g*.59+b*.11)/255;};

/* ───────── sound ───────── */
let AC=null;const A=()=>AC||(AC=new(window.AudioContext||window.webkitAudioContext)());
function snd(f,d,type='square',v=.06,sl=0){try{const a=A(),o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=f;if(sl)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+sl),a.currentTime+d);g.gain.setValueAtTime(v,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+d);}catch(e){}}
function nz(d,v=.1){try{const a=A(),n=a.sampleRate*d|0,b=a.createBuffer(1,n,a.sampleRate),c=b.getChannelData(0);for(let i=0;i<n;i++)c[i]=(Math.random()*2-1)*(1-i/n);const s=a.createBufferSource(),g=a.createGain();s.buffer=b;g.gain.value=v;s.connect(g).connect(a.destination);s.start();}catch(e){}}
const sfx={ding(){snd(1568,.35,'sine',.12);snd(2093,.3,'sine',.07);},screech(){nz(.45,.1);snd(900,.45,'sawtooth',.03,-600);},thud(){nz(.15,.2);snd(110,.25,'sine',.25,-60);},
  whoosh(){nz(.25,.07);snd(400,.25,'sine',.03,-250);},win(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>snd(f,.18,'square',.05),i*70));},lose(){snd(330,.3,'sawtooth',.06,-200);},
  boing(){snd(300,.3,'sine',.12,500);},crash(){nz(.4,.22);snd(90,.4,'sawtooth',.1,-40);},cluck(){snd(700,.08,'square',.04,300);setTimeout(()=>snd(800,.08,'square',.04,-200),90);}};

/* ───────── primitives (polygons) ───────── */
const FONT={riso:'"Arial Black",Impact,sans-serif',acuarela:'"Marker Felt","Chalkboard SE","Comic Sans MS",cursive',snes:'"Arial Black",Impact,sans-serif',hose:'Georgia,"Times New Roman",serif',clay:'"Arial Rounded MT Bold","Arial Black",sans-serif',anime:'Impact,"Arial Black",sans-serif',toon:'Impact,"Arial Black",sans-serif',rotu:'Impact,"Arial Black",sans-serif',exvoto:'Georgia,"Times New Roman",serif',cromo:'Impact,"Arial Black",sans-serif',gb:'"Arial Black",Impact,sans-serif',ps1:'"Arial Black",Impact,sans-serif',gw:'"Arial Black",Impact,sans-serif',wii:'"Arial Rounded MT Bold","Arial Black",sans-serif',pixar:'"Arial Rounded MT Bold","Arial Black",sans-serif',mario:'"Arial Black",Impact,sans-serif',bean:'"Arial Rounded MT Bold","Arial Black",sans-serif',splat:'Impact,"Arial Black",sans-serif',candy:'"Arial Rounded MT Bold","Arial Black",sans-serif',acnh:'"Arial Rounded MT Bold","Arial Black",sans-serif',ww:'"Arial Rounded MT Bold","Arial Black",sans-serif',ghibli:'Georgia,"Times New Roman",serif',alma:'Georgia,"Times New Roman",serif',vitral:'Georgia,"Times New Roman",serif',etiq:'Georgia,"Times New Roman",serif',mola:'"Arial Black",Impact,sans-serif',xstitch:'"Arial Black",Impact,sans-serif',cordel:'Impact,"Arial Black",sans-serif',lote:'Georgia,"Times New Roman",serif',felt:'"Arial Rounded MT Bold","Arial Black",sans-serif',arcade:'Impact,"Arial Black",sans-serif',vhs:'"Arial Black",Impact,sans-serif',tinta:'"Arial Black",Impact,sans-serif',garabato:'"Marker Felt","Chalkboard SE","Comic Sans MS",cursive',recorte:'"Arial Black",Impact,sans-serif',pixel:'"Arial Black",Impact,sans-serif'};
const fnt=size=>`${style==='garabato'||style==='acuarela'||style==='hose'||style==='lote'||style==='exvoto'||style==='alma'||style==='vitral'||style==='etiq'||style==='ghibli'?'bold ':''}${size}px ${FONT[style]}`;
const ellP=(cx,cy,rx,ry,n)=>{n=n||(style==='recorte'||style==='ps1'?clamp(Math.round((rx+ry)/10)+7,8,16):clamp(Math.round((rx+ry)/4)+12,14,40));const a=[];for(let i=0;i<n;i++){const t=i/n*TAU;a.push([cx+Math.cos(t)*rx,cy+Math.sin(t)*ry]);}return a;};
const rrP=(x,y,w,h,r)=>{r=Math.min(r,w/2,h/2);if(r<1)return[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];const a=[],st=style==='recorte'||style==='ps1'?1:3;
  for(const[cx,cy,s]of[[x+w-r,y+r,-Math.PI/2],[x+w-r,y+h-r,0],[x+r,y+h-r,Math.PI/2],[x+r,y+r,Math.PI]])for(let i=0;i<=st;i++){const t=s+i/st*Math.PI/2;a.push([cx+Math.cos(t)*r,cy+Math.sin(t)*r]);}return a;};
const capP=(x1,y1,x2,y2,w)=>{const a=Math.atan2(y2-y1,x2-x1),r=w/2,p=[],n=style==='recorte'||style==='ps1'?2:5;
  for(let i=0;i<=n;i++){const t=a-Math.PI/2+i/n*Math.PI;p.push([x2+Math.cos(t)*r,y2+Math.sin(t)*r]);}
  for(let i=0;i<=n;i++){const t=a+Math.PI/2+i/n*Math.PI;p.push([x1+Math.cos(t)*r,y1+Math.sin(t)*r]);}return p;};
const path=(pts,close=true)=>{ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);if(close)ctx.closePath();};
const bbox=pts=>{let a=1e9,b=1e9,c=-1e9,d=-1e9;for(const p of pts){a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1]);}return[a,b,c,d];};
const closeP=p=>p.concat([p[0]]);

/* paper grain for cutouts */
const GRAIN=(()=>{const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');const id=x.createImageData(96,96);
  for(let i=0;i<id.data.length;i+=4){const v=hash(i,3,9)<.5?255:30;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=hash(i,5,1)*46;}x.putImageData(id,0,0);
  x.strokeStyle='rgba(255,255,255,.10)';x.lineWidth=1;for(let i=0;i<26;i++){x.beginPath();const px=hash(i,1,1)*96,py=hash(i,2,2)*96;x.moveTo(px,py);x.lineTo(px+(hash(i,3,3)-.5)*30,py+(hash(i,4,4)-.5)*10);x.stroke();}return c;})();
let GRAINP=null;

/* cel shading (tinta + pixel): shade crescent + a glint */
function cel(pts,f,hard){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];if(w<14||h<14||lum(f)>.97)return;
  ctx.save();path(pts);ctx.clip();ctx.fillStyle=mix(f,'#35205c',.26);ctx.fillRect(b[0],b[1],w,h);
  const k=Math.max(2.5,Math.min(w,h)*.13);ctx.translate(-k,-k*1.1);path(pts);ctx.fillStyle=f;ctx.fill();ctx.restore();
  if(w>34&&h>26&&!hard){ctx.save();ctx.fillStyle='rgba(255,255,255,.34)';ctx.beginPath();ctx.ellipse(b[0]+w*.27,b[1]+h*.24,w*.13,h*.07,-.5,0,TAU);ctx.fill();ctx.restore();}}


const RISO_P=['#f3ead2','#ffc83d','#ff8a3d','#ff4f6d','#ffa593','#2b6fd6','#7fc4e8','#3aa86a','#6b4fa8','#1a1a2e'].map(c=>[c,rgb(c)]);
const RMAP={};function risoMap(c){if(RMAP[c])return RMAP[c];const[r,g,b]=rgb(c);let best=1e9,bc=RISO_P[0][0];for(const[pc,q]of RISO_P){const e=(q[0]-r)**2*.9+(q[1]-g)**2*1.2+(q[2]-b)**2*.8;if(e<best){best=e;bc=pc;}}return RMAP[c]=bc;}
const HPC={};function halftone(color){if(HPC[color+style])return HPC[color+style];const c=document.createElement('canvas');c.width=c.height=7;const x=c.getContext('2d');x.fillStyle=color;x.beginPath();x.arc(3.5,3.5,1.9,0,TAU);x.fill();return HPC[color+style]=ctx.createPattern(c,'repeat');}
const SATC={};function satur(c,k){const key=c+k;if(SATC[key])return SATC[key];const[r,g,b]=rgb(c),l=(r+g+b)/3,f=v=>clamp(Math.round(l+(v-l)*k),0,255);return SATC[key]='#'+[f(r),f(g),f(b)].map(v=>v.toString(16).padStart(2,'0')).join('');}
const S2W=400,S2H=300,s2=document.createElement('canvas');s2.width=S2W;s2.height=S2H;const s2ctx=s2.getContext('2d',{willReadFrequently:true});
let vhsOn=false,OUTX=null;
const buf=document.createElement('canvas');buf.width=W;buf.height=H;const bctx=buf.getContext('2d',{willReadFrequently:true});

const LOTE_P=['#f2e3c0','#d9372f','#f2c230','#2c5aa0','#3f8f4a','#f0c9a0','#b5714a','#2a1a10','#e87a2e','#8a4fa0'].map(c=>[c,rgb(c)]);
const LMAP={};function loteMap(c){if(LMAP[c])return LMAP[c];const[r,g,b]=rgb(c);let best=1e9,bc=LOTE_P[0][0];for(const[pc,q]of LOTE_P){const e=(q[0]-r)**2*.9+(q[1]-g)**2*1.2+(q[2]-b)**2*.8;if(e<best){best=e;bc=pc;}}return LMAP[c]=bc;}
function star4(x,y,r,col){ctx.save();ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.quadraticCurveTo(x,y,x,y+r);ctx.quadraticCurveTo(x,y,x-r,y);ctx.quadraticCurveTo(x,y,x,y-r);ctx.fill();ctx.restore();}

const CMAP={};function cordelMap(c){if(CMAP[c])return CMAP[c];const[r,g,b]=rgb(c),l=(r*.3+g*.59+b*.11)/255;let o;if(l<.3)o='#1a1410';else if(l>.78)o='#f1e7d0';else if(r>b+25)o='#d23b2a';else o='#f1e7d0';return CMAP[c]=o;}
const MOLA_C=['#ffd23f','#ff7a1a','#ffffff','#3fd0ff','#ff3b6a'];
function insetPts(q,b,k){const w=b[2]-b[0],h=b[3]-b[1],cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,kx=1-k/(w/2),ky=1-k/(h/2);if(kx<.18||ky<.18)return null;return q.map(p=>[cx+(p[0]-cx)*kx,cy+(p[1]-cy)*ky]);}
const P1W=320,P1H=240,pc=document.createElement('canvas');pc.width=P1W;pc.height=P1H;const pctx=pc.getContext('2d',{willReadFrequently:true});
const gbPrev=document.createElement('canvas');gbPrev.width=200;gbPrev.height=150;const gwGhost=document.createElement('canvas');gwGhost.width=400;gwGhost.height=300;const gwInk=document.createElement('canvas');gwInk.width=400;gwInk.height=300;const gwBg=document.createElement('canvas');gwBg.width=400;gwBg.height=300;
const XW=200,XH=150,xc=document.createElement('canvas');xc.width=XW;xc.height=XH;const xctx=xc.getContext('2d',{willReadFrequently:true});

const VIT_P=['#c4283a','#2a6ad6','#1f9f5a','#f2a92a','#7a3fb0','#4ab4e8','#d9602a','#2aa3b8','#14101c'].map(c=>[c,rgb(c)]);
const VMAP={};function vitMap(c){if(VMAP[c])return VMAP[c];const[r,g,b]=rgb(c);if((r*.3+g*.59+b*.11)/255>.9)return VMAP[c]='#f6e9bc';let best=1e9,bc=VIT_P[0][0];for(const[pc,q]of VIT_P){const e=(q[0]-r)**2*.9+(q[1]-g)**2*1.2+(q[2]-b)**2*.8;if(e<best){best=e;bc=pc;}}return VMAP[c]=bc;}
const ET_P=['#f3e6c4','#c4283a','#1c2e5c','#d9a520','#2a7a6a','#f0c9a0','#7a4a2a','#14101c','#e0c080'].map(c=>[c,rgb(c)]);
const EMAP={};function etMap(c){if(EMAP[c])return EMAP[c];const[r,g,b]=rgb(c);let best=1e9,bc=ET_P[0][0];for(const[pc,q]of ET_P){const e=(q[0]-r)**2*.9+(q[1]-g)**2*1.2+(q[2]-b)**2*.8;if(e<best){best=e;bc=pc;}}return EMAP[c]=bc;}

const NEON_P=['#ff2e93','#7cff00','#ffd800','#ff7a00','#00d8ff','#9b3bff','#ffffff','#1a0a30'].map(c=>[c,rgb(c)]);
const NMAP={};function neonMap(c){if(NMAP[c])return NMAP[c];const[r,g,b]=rgb(c);let best=1e9,bc=NEON_P[0][0];for(const[pc,q]of NEON_P){const e=(q[0]-r)**2*.9+(q[1]-g)**2*1.2+(q[2]-b)**2*.8;if(e<best){best=e;bc=pc;}}return NMAP[c]=bc;}
const SPL_ALT={'#ff2e93':'#00d8ff','#7cff00':'#ff2e93','#ffd800':'#9b3bff','#ff7a00':'#00d8ff','#00d8ff':'#ff2e93','#9b3bff':'#ffd800','#ffffff':'#00d8ff','#1a0a30':'#1a0a30'};
/* ───────── styles ───────── */
const STY={
  riso:{name:'serigrafía',fps:0,paper:'#f3ead2',col:c=>risoMap(c),darkText:1,
    desc:'Afiche de serigrafía: 3 tintas (amarillo, rojo, azul) sobre papel crema, color corrido, sombra de puntos de trama y grano.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1],PAPER='#f3ead2';
      ctx.save();if(f!==PAPER)ctx.translate(2.8,-2.2);path(pts);ctx.fillStyle=f;ctx.fill();
      if(o>=3&&w>16&&h>16&&f!==PAPER){ctx.save();path(pts);ctx.clip();ctx.globalCompositeOperation='multiply';ctx.fillStyle=halftone(mix(f,'#1a1a2e',.5));
        ctx.beginPath();ctx.moveTo(b[0]+w*.38,b[3]);ctx.lineTo(b[2],b[1]+h*.38);ctx.lineTo(b[2],b[3]);ctx.closePath();ctx.fill();ctx.restore();}
      ctx.restore();
      if(o){path(pts);ctx.lineJoin='round';ctx.lineWidth=Math.max(2.4,o*1.05);ctx.strokeStyle='#1a1a2e';ctx.stroke();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=w;ctx.strokeStyle=c;ctx.stroke();}},
  acuarela:{name:'acuarela',fps:0,paper:'#fbf6ea',col:c=>mix(c,'#ffffff',.2),darkText:1,
    desc:'Acuarela sobre papel: capas translúcidas, bordes con pigmento acumulado, lápiz suelto y manchas.',
    paint(pts,f,o){const sd=sid,b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1],J=(k,a)=>pts.map((p,i)=>[p[0]+(hash(sd,i,k)-.5)*a,p[1]+(hash(sd,i,k+9)-.5)*a]);
      ctx.save();ctx.globalAlpha=.3;ctx.translate(4+(hash(sd,0,1)-.5)*5,3+(hash(sd,1,2)-.5)*5);path(J(2,9));ctx.fillStyle=f;ctx.fill();ctx.restore();
      ctx.save();path(J(1,3));ctx.clip();
      if(w>8&&h>8){const cx=b[0]+w*.4,cy=b[1]+h*.35,r=Math.max(w,h)*.8,g=ctx.createRadialGradient(cx,cy,2,cx,cy,r);
        g.addColorStop(0,mix(f,'#ffffff',.4));g.addColorStop(.65,f);g.addColorStop(1,dark(f,.22));ctx.globalAlpha=.93;ctx.fillStyle=g;ctx.fillRect(b[0]-4,b[1]-4,w+8,h+8);
        ctx.globalAlpha=.14;for(let k=0;k<3;k++){ctx.fillStyle=dark(f,.35);ctx.beginPath();ctx.ellipse(b[0]+hash(sd,k,5)*w,b[1]+hash(sd,k,6)*h,w*.2,h*.15,hash(sd,k,7)*3,0,TAU);ctx.fill();}}
      else{ctx.globalAlpha=.9;ctx.fillStyle=f;ctx.fillRect(b[0]-2,b[1]-2,w+4,h+4);}
      ctx.restore();
      if(o){ctx.save();ctx.globalAlpha=.45;path(pts);ctx.lineJoin='round';ctx.lineWidth=3.4;ctx.strokeStyle=dark(f,.3);ctx.stroke();ctx.restore();
        ctx.save();ctx.globalAlpha=.85;ctx.lineJoin=ctx.lineCap='round';for(let pass=0;pass<2;pass++){const q=J(20+pass*13,2.4),st=pass?Math.floor(q.length*.3):0;path(q.slice(st).concat(q.slice(0,st)),false);
        ctx.lineWidth=pass?1:1.8;ctx.strokeStyle='#4a4560';ctx.stroke();}ctx.restore();}},
    line(pts,w,c,close){const sd=sid;ctx.save();ctx.globalAlpha=.9;ctx.lineCap=ctx.lineJoin='round';path(pts.map((p,i)=>[p[0]+(hash(sd,i,3)-.5)*1.6,p[1]+(hash(sd,i,4)-.5)*1.6]),close);
      ctx.lineWidth=Math.max(1.8,w*.55);ctx.strokeStyle=c===INK?'#4a4560':c;ctx.stroke();ctx.restore();}},
  snes:{name:'super 16 bits',fps:0,paper:'#6cc8ff',grad:true,col:c=>satur(c,1.2),
    desc:'Videojuego de Super Nintendo / Mega Drive: 400×300 con sprites cuadrados, posiciones en cuadrícula y 2 cuadros de animación (balanceo a 6 fps).',
    paint(pts,f,o){path(pts);ctx.lineJoin='round';if(o){ctx.lineWidth=Math.max(3.5,o*1.5);ctx.strokeStyle=dark(f,.6);ctx.stroke();}ctx.fillStyle=f;ctx.fill();if(o>=3)cel(pts,f,true);},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';if(c!==INK){ctx.lineWidth=w+4;ctx.strokeStyle=dark(c,.6);ctx.stroke();}ctx.lineWidth=w;ctx.strokeStyle=c;ctx.stroke();}},
  arcade:{name:'arcade 90s',fps:0,paper:'#4aa8ff',grad:true,col:c=>satur(c,1.25),
    desc:'Arcade de peleas de los 90 (Capcom / Neo Geo): contorno negro grueso, degradado aerógrafo, brillo de borde y letras cromadas.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];path(pts);ctx.lineJoin='round';if(o){ctx.lineWidth=o*2.2;ctx.strokeStyle=INK;ctx.stroke();}
      if(h>10){const g=ctx.createLinearGradient(0,b[1],0,b[3]);g.addColorStop(0,mix(f,'#ffffff',.4));g.addColorStop(.45,f);g.addColorStop(1,mix(f,'#2a1650',.4));ctx.fillStyle=g;}else ctx.fillStyle=f;
      ctx.fill();
      if(o>=3&&w>20&&h>20){ctx.save();path(pts);ctx.clip();ctx.translate(2.5,3);path(pts);ctx.lineWidth=3;ctx.strokeStyle='rgba(255,255,255,.55)';ctx.stroke();ctx.restore();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';if(c!==INK){ctx.lineWidth=w+7;ctx.strokeStyle=INK;ctx.stroke();}ctx.lineWidth=w;ctx.strokeStyle=c;ctx.stroke();}},
  hose:{name:'dibujo antiguo 1930',fps:12,paper:'#e6d8b4',col:c=>satur(mix(c,'#d9c9a0',.25),.7),darkText:1,
    desc:'Dibujo animado de los años 30: brazos de fideo, ojos de pastel, todo rebota al ritmo. Película vieja con grano y parpadeo.',
    paint(pts,f,o){const fr=FRJ,q=pts.map((p,i)=>[p[0]+(hash(sid,i,fr*2)-.5)*1.9,p[1]+(hash(sid,i,fr*2+1)-.5)*1.9]);
      path(q);ctx.lineJoin='round';if(o){ctx.lineWidth=Math.max(4.5,o*1.7);ctx.strokeStyle='#1a1410';ctx.stroke();}ctx.fillStyle=f;ctx.fill();
      if(o>=3){const b=bbox(q),w=b[2]-b[0],h=b[3]-b[1];if(w>18&&h>18&&lum(f)<.95){ctx.save();path(q);ctx.clip();ctx.fillStyle='rgba(80,50,20,.16)';ctx.translate(w*.1,h*.1);path(q);ctx.lineWidth=w*.28;ctx.strokeStyle='rgba(80,50,20,.16)';ctx.stroke();ctx.restore();}}},
    line(pts,w,c,close){const fr=FRJ,q=pts.map((p,i)=>[p[0]+(hash(sid,i,fr*2)-.5)*1.6,p[1]+(hash(sid,i,fr*2+1)-.5)*1.6]);path(q,close);ctx.lineCap=ctx.lineJoin='round';
      if(c!==INK){ctx.lineWidth=w+6;ctx.strokeStyle='#1a1410';ctx.stroke();}ctx.lineWidth=w;ctx.strokeStyle=c===INK?'#1a1410':c;ctx.stroke();}},
  clay:{name:'plastilina',fps:8,paper:'#e9c79a',col:c=>satur(c,1.12),
    desc:'Plastilina en stop-motion a 8 fps: bolitas y salchichas, sin contorno, con grumos y sombra suave. Se ve como si la hubieran movido a mano.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1],fr=FRJ,
        q=pts.map((p,i)=>[p[0]+(hash(sid,i,3)-.5)*3+(hash(sid,i,fr*5)-.5)*1.6,p[1]+(hash(sid,i,4)-.5)*3+(hash(sid,i,fr*5+1)-.5)*1.6]);
      if(o){ctx.save();ctx.translate(3,6);path(q);ctx.fillStyle='rgba(70,35,10,.3)';ctx.fill();ctx.restore();}
      path(q);
      if(w>6&&h>6){const cx=b[0]+w*.34,cy=b[1]+h*.28,g=ctx.createRadialGradient(cx,cy,1,cx,cy,Math.max(w,h)*.9);g.addColorStop(0,mix(f,'#ffffff',.45));g.addColorStop(.5,f);g.addColorStop(1,mix(f,'#3a1a40',.4));ctx.fillStyle=g;}else ctx.fillStyle=f;
      ctx.fill();
      if(w>10&&h>10){ctx.save();path(q);ctx.clip();ctx.globalAlpha=.55;GRAINP=GRAINP||ctx.createPattern(GRAIN,'repeat');ctx.fillStyle=GRAINP;ctx.fillRect(b[0],b[1],w,h);
        if(o>=3&&w>14&&h>14){ctx.globalAlpha=1;ctx.translate(1.8,2.2);path(q);ctx.lineWidth=2.6;ctx.strokeStyle='rgba(255,255,255,.5)';ctx.stroke();}ctx.restore();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.save();ctx.translate(2,4);ctx.lineWidth=w;ctx.strokeStyle='rgba(70,35,10,.3)';ctx.stroke();ctx.restore();
      ctx.lineWidth=w;ctx.strokeStyle=c===INK?'#3a2418':c;ctx.stroke();ctx.lineWidth=Math.max(1.5,w*.25);ctx.strokeStyle='rgba(255,255,255,.4)';ctx.save();ctx.translate(-1,-1.5);ctx.stroke();ctx.restore();}},
  mario:{name:'2 · PLÁSTICO 3D (estilo Nintendo)',fps:0,paper:'#5c94fc',grad:true,col:c=>satur(c,1.3),
    desc:'Nintendo 3D de plástico: colores primarios saturados, contorno suave del tono de cada pieza, brillo especular duro, guantes blancos y marcador de mundo arriba.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];
      if(o){ctx.save();ctx.translate(0,5);path(pts);ctx.fillStyle='rgba(20,30,70,.22)';ctx.fill();ctx.restore();}
      path(pts);if(h>8){const g=ctx.createLinearGradient(b[0],b[1],b[0]+w*.4,b[3]);g.addColorStop(0,mix(f,'#ffffff',.35));g.addColorStop(.5,f);g.addColorStop(1,dark(f,.24));ctx.fillStyle=g;}else ctx.fillStyle=f;ctx.fill();
      if(o){ctx.lineJoin='round';ctx.lineWidth=Math.max(3,o*1.3);ctx.strokeStyle=dark(f,.58);ctx.stroke();}
      if(o>=3&&w>22&&h>22){ctx.save();path(pts);ctx.clip();ctx.fillStyle='rgba(255,255,255,.7)';ctx.beginPath();ctx.ellipse(b[0]+w*.3,b[1]+h*.22,Math.max(3,w*.12),Math.max(2,h*.07),-.5,0,TAU);ctx.fill();ctx.fillStyle='rgba(255,255,255,.4)';ctx.beginPath();ctx.ellipse(b[0]+w*.52,b[1]+h*.14,Math.max(2,w*.04),Math.max(2,h*.03),-.5,0,TAU);ctx.fill();ctx.restore();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';if(c!==INK){ctx.lineWidth=w+5;ctx.strokeStyle=dark(c,.6);ctx.stroke();}ctx.lineWidth=w;ctx.strokeStyle=c===INK?'#2a1a14':c;ctx.stroke();}},
  bean:{name:'3 · FALL GUYS (frijol)',fps:0,paper:'#ffb6e6',grad:true,col:c=>satur(mix(c,'#ffffff',.06),1.18),
    desc:'Estilo Fall Guys: personajes frijol de plástico gelatinoso con brillo, mundo pastel de colores caramelo y confeti cayendo.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];
      if(o){ctx.save();ctx.translate(0,6);path(pts);ctx.fillStyle='rgba(90,40,110,.2)';ctx.fill();ctx.restore();}
      path(pts);if(w>6&&h>6){const cx=b[0]+w*.35,cy=b[1]+h*.25,g=ctx.createRadialGradient(cx,cy,1,cx,cy,Math.max(w,h)*.9);g.addColorStop(0,mix(f,'#ffffff',.5));g.addColorStop(.5,f);g.addColorStop(1,dark(f,.24));ctx.fillStyle=g;}else ctx.fillStyle=f;ctx.fill();
      if(o>=3&&w>24&&h>24){ctx.save();path(pts);ctx.clip();ctx.fillStyle='rgba(255,255,255,.75)';ctx.beginPath();ctx.ellipse(b[0]+w*.3,b[1]+h*.2,Math.max(3,w*.12),Math.max(3,h*.07),-.6,0,TAU);ctx.fill();ctx.restore();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(2.4,w*.8);ctx.strokeStyle=c===INK?'#3a2060':c;ctx.stroke();}},
  splat:{name:'4 · SPLATOON (tinta neón)',fps:0,paper:'#1b0a38',col:c=>neonMap(c),
    desc:'Tinta neón estilo Splatoon: colores fosforescentes sobre fondo oscuro, contorno negro grueso, sombra de color corrido, salpicaduras y barra de territorio.',
    paint(pts,f,o){if(o){ctx.save();ctx.translate(4,4);path(pts);ctx.fillStyle=SPL_ALT[f]||'#00d8ff';ctx.fill();ctx.restore();ctx.lineJoin='round';ctx.lineWidth=o*2.1;ctx.strokeStyle='#0a0418';path(pts);ctx.stroke();}
      path(pts);ctx.fillStyle=f;ctx.fill();},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';if(c!==INK){ctx.lineWidth=w+7;ctx.strokeStyle='#0a0418';ctx.stroke();}ctx.lineWidth=w;ctx.strokeStyle=c===INK?'#0a0418':c;ctx.stroke();}},
  candy:{name:'5 · CASUAL MÓVIL (caramelo)',fps:0,paper:'#b78cff',grad:true,col:c=>satur(mix(c,'#ffffff',.04),1.25),
    desc:'Casual de móvil tipo caramelo: todo brillante, contorno grueso del tono oscuro, reflejo de gel, destellos que titilan y marcador de movimientos.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];
      path(pts);if(h>8){const g=ctx.createLinearGradient(0,b[1],0,b[3]);g.addColorStop(0,mix(f,'#ffffff',.3));g.addColorStop(.5,f);g.addColorStop(1,dark(f,.2));ctx.fillStyle=g;}else ctx.fillStyle=f;ctx.fill();
      if(o){ctx.lineJoin='round';ctx.lineWidth=Math.max(3.5,o*1.5);ctx.strokeStyle=dark(f,.6);ctx.stroke();}
      if(o>=3&&w>26&&h>24){ctx.save();path(pts);ctx.clip();ctx.fillStyle='rgba(255,255,255,.5)';ctx.beginPath();ctx.ellipse(b[0]+w*.5,b[1]+h*.2,w*.4,h*.13,0,0,TAU);ctx.fill();ctx.restore();
        if(w>60&&h>50){const t=(Math.sin(now*4+hash(sid,1,1)*7)+1)/2;star4(b[0]+w*.8,b[1]+h*.22,3+t*6,'rgba(255,255,255,'+(.4+t*.5)+')');}}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=w+5;ctx.strokeStyle=c===INK?'#3a1a60':dark(c,.55);ctx.stroke();ctx.lineWidth=w;ctx.strokeStyle=c===INK?'#5a3a8a':c;ctx.stroke();}},
  pixar:{name:'pixar',fps:0,paper:'#ffd9a8',grad:true,col:c=>satur(mix(c,'#ffeede',.06),1.08),
    desc:'Película de animación 3D: volúmenes suaves con luz de rebote cálida, luz de contorno, ojos enormes con brillos, resplandor y barras de cine.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];
      if(o&&w>12){ctx.save();for(let k=0;k<3;k++){ctx.translate(0,3);path(pts);ctx.fillStyle='rgba(70,35,50,.07)';ctx.fill();}ctx.restore();}
      path(pts);if(w>6&&h>6){const cx=b[0]+w*.32,cy=b[1]+h*.28,g=ctx.createRadialGradient(cx,cy,1,cx,cy,Math.max(w,h)*.95);g.addColorStop(0,mix(f,'#ffffff',.42));g.addColorStop(.45,f);g.addColorStop(.85,dark(f,.16));g.addColorStop(1,mix(dark(f,.12),'#ff9a5a',.28));ctx.fillStyle=g;}else ctx.fillStyle=f;ctx.fill();
      if(o>=3&&w>16&&h>16){ctx.save();path(pts);ctx.clip();ctx.beginPath();ctx.rect(b[0]+w*.45,b[1],w*.55,h*.55);ctx.clip();path(pts);ctx.lineWidth=7;ctx.strokeStyle='rgba(255,255,255,.34)';ctx.stroke();ctx.restore();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(2.2,w*.75);ctx.strokeStyle=c===INK?'#4a2f3a':c;ctx.stroke();}},
  acnh:{name:'animal crossing',fps:0,paper:'#bfe8d0',grad:true,col:c=>mix(satur(c,.85),'#ffffff',.2),
    desc:'Estilo Animal Crossing: todo redondito y pastel, sin contornos, personajes bolita con ojitos de punto, y desenfoque tipo maqueta arriba y abajo.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];
      if(o){ctx.save();ctx.translate(0,4);path(pts);ctx.fillStyle='rgba(60,90,60,.14)';ctx.fill();ctx.restore();}
      path(pts);if(h>10){const g=ctx.createLinearGradient(0,b[1],0,b[3]);g.addColorStop(0,mix(f,'#ffffff',.2));g.addColorStop(1,dark(f,.07));ctx.fillStyle=g;}else ctx.fillStyle=f;ctx.fill();
      if(o>=3&&w>26&&h>22){ctx.save();path(pts);ctx.clip();ctx.fillStyle='rgba(255,255,255,.45)';ctx.beginPath();ctx.ellipse(b[0]+w*.28,b[1]+h*.22,Math.max(3,w*.07),Math.max(3,h*.05),-.5,0,TAU);ctx.fill();ctx.restore();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(2.4,w*.8);ctx.strokeStyle=c===INK?'#5a4a42':c;ctx.stroke();}},
  ww:{name:'wind waker',fps:0,paper:'#7ed0ff',grad:true,col:c=>satur(c,1.15),
    desc:'Cel-shading de Nintendo (Wind Waker): contorno fino del color de cada pieza, sombra plana de 2 tonos, brillos de dibujo y nubes en espiral. Hojas de corazones y rupias arriba.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];path(pts);ctx.fillStyle=f;ctx.fill();
      if(o>=3&&w>14&&h>14&&lum(f)<.97)cel(pts,f,true);
      if(o){path(pts);ctx.lineJoin='round';ctx.lineWidth=Math.max(2,o*.62);ctx.strokeStyle=dark(f,.6);ctx.stroke();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(2.2,w*.8);ctx.strokeStyle=c===INK?'#2a1a3a':dark(c,.5);ctx.stroke();}},
  ghibli:{name:'ghibli',fps:0,paper:'#cfe9f5',grad:true,col:c=>satur(mix(c,'#fff4dc',.12),.95),
    desc:'Estilo Ghibli: pintura de fondo con nubes grandes, trazos suaves, contorno café fino, ojitos de punto y luz cálida con grano.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];path(pts);
      if(h>8){const g=ctx.createLinearGradient(0,b[1],0,b[3]);g.addColorStop(0,mix(f,'#ffffff',.18));g.addColorStop(.6,f);g.addColorStop(1,dark(f,.14));ctx.fillStyle=g;}else ctx.fillStyle=f;ctx.fill();
      if(w>20&&h>20){ctx.save();path(pts);ctx.clip();ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=3;ctx.lineCap='round';for(let i=0;i<Math.min(10,w*h/400);i++){const x=b[0]+hash(sid,i,5)*w,y=b[1]+hash(sid,i,6)*h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+10+hash(sid,i,7)*14,y-3);ctx.stroke();}ctx.restore();}
      if(o){ctx.save();ctx.globalAlpha=.78;path(pts);ctx.lineJoin='round';ctx.lineWidth=Math.max(1.6,o*.4);ctx.strokeStyle=dark(f,.55);ctx.stroke();ctx.restore();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(1.8,w*.65);ctx.strokeStyle=c===INK?'#4a3426':c;ctx.stroke();}},
  gb:{name:'game boy',fps:15,paper:'#8bac0f',col:c=>c,
    desc:'Game Boy original: 4 verdes, tramado ordenado, rejilla de LCD y fantasma de la imagen anterior (ghosting).',
    paint(pts,f,o){STY.tinta.paint(pts,f,o);},line(pts,w,c,close){STY.tinta.line(pts,w,c,close);}},
  ps1:{name:'playstation 1',fps:15,paper:'#8ab0d8',grad:true,col:c=>satur(c,1.1),
    desc:'3D de PS1: polígonos facetados, vértices que se pegan a la cuadrícula y bailan al moverse, sombreado Gouraud, color de 15 bits con tramado y niebla.',
    paint(pts,f,o){const q=pts.map(p=>[Math.round(p[0]/2.5)*2.5,Math.round(p[1]/2.5)*2.5]),b=bbox(q),w=b[2]-b[0],h=b[3]-b[1];path(q);
      if(h>6){const g=ctx.createLinearGradient(b[0],b[1],b[2],b[3]);g.addColorStop(0,mix(f,'#ffffff',.3));g.addColorStop(1,dark(f,.3));ctx.fillStyle=g;}else ctx.fillStyle=f;ctx.fill();
      if(o){path(q);ctx.lineJoin='miter';ctx.lineWidth=1.6;ctx.strokeStyle='rgba(10,10,30,.45)';ctx.stroke();}},
    line(pts,w,c,close){const q=pts.map(p=>[Math.round(p[0]/2.5)*2.5,Math.round(p[1]/2.5)*2.5]);path(q,close);ctx.lineCap='butt';ctx.lineJoin='miter';ctx.lineWidth=Math.max(2.5,w*.8);ctx.strokeStyle=c===INK?'#101020':c;ctx.stroke();}},
  gw:{name:'game & watch',fps:8,paper:'#c9cdb8',col:c=>c,
    desc:'Game & Watch (LCD de los 80): fondo pastel impreso con segmentos negros que saltan entre posiciones fijas, y fantasma tenue de las posiciones anteriores.',
    paint(pts,f,o){STY.tinta.paint(pts,f,o);},line(pts,w,c,close){STY.tinta.line(pts,w,c,close);}},
  wii:{name:'1 · WII (Mii) ♥',fps:0,paper:'#e6f0fa',grad:true,col:c=>satur(mix(c,'#ffffff',.06),1.05),
    desc:'Wii Sports / Mii: figuras suaves sin contorno, brillo de plástico, sombra ligera, caras mínimas de punto y cuerpo de pastilla, en un canal de menú Wii.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];
      if(o){ctx.save();ctx.translate(1.5,4);path(pts);ctx.fillStyle='rgba(40,70,110,.2)';ctx.fill();ctx.restore();}
      path(pts);if(h>10){const g=ctx.createLinearGradient(0,b[1],0,b[3]);g.addColorStop(0,mix(f,'#ffffff',.28));g.addColorStop(.55,f);g.addColorStop(1,dark(f,.13));ctx.fillStyle=g;}else ctx.fillStyle=f;ctx.fill();
      if(o>=3&&w>26&&h>22){ctx.save();path(pts);ctx.clip();ctx.fillStyle='rgba(255,255,255,.32)';ctx.beginPath();ctx.ellipse(b[0]+w*.5,b[1]+h*.18,w*.36,h*.1,0,0,TAU);ctx.fill();ctx.restore();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(2.4,w*.8);ctx.strokeStyle=c===INK?'#3a3a4a':c;ctx.stroke();}},
  cromo:{name:'cromo',fps:0,paper:'#0b2a6b',col:c=>satur(c,1.25),
    desc:'Barajita de béisbol de álbum: figura brillante en cartulina con borde tricolor, placa con el nombre, estadísticas y brillo de foil que barre la carta.',
    paint(pts,f,o){path(pts);ctx.lineJoin='round';if(o){ctx.lineWidth=o*2;ctx.strokeStyle=INK;ctx.stroke();}ctx.fillStyle=f;ctx.fill();if(o>=3)cel(pts,f,false);},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';if(c!==INK){ctx.lineWidth=w+6;ctx.strokeStyle=INK;ctx.stroke();}ctx.lineWidth=w;ctx.strokeStyle=c;ctx.stroke();}},
  alma:{name:'almanaque',fps:0,paper:'#f0e0b8',col:c=>satur(mix(c,'#f6e7c8',.12),.9),
    desc:'Almanaque de bodega: ilustración de aerógrafo suave en cartulina amarillenta, con el calendario del mes y el nombre del negocio abajo.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];path(pts);
      if(h>8){const g=ctx.createLinearGradient(b[0],b[1],b[0]+w*.4,b[3]);g.addColorStop(0,mix(f,'#ffffff',.32));g.addColorStop(.5,f);g.addColorStop(1,dark(f,.24));ctx.fillStyle=g;}else ctx.fillStyle=f;ctx.fill();
      if(o){ctx.save();ctx.globalAlpha=.5;ctx.lineJoin='round';ctx.lineWidth=2;ctx.strokeStyle=dark(f,.5);ctx.stroke();ctx.restore();}
      if(o>=3&&w>30&&h>26){ctx.save();path(pts);ctx.clip();ctx.fillStyle='rgba(255,255,255,.22)';ctx.beginPath();ctx.ellipse(b[0]+w*.3,b[1]+h*.22,w*.22,h*.09,-.4,0,TAU);ctx.fill();ctx.restore();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(2,w*.7);ctx.strokeStyle=c===INK?'#3a2a1a':c;ctx.stroke();}},
  vitral:{name:'vitral',fps:0,paper:'#14101c',col:c=>vitMap(c),
    desc:'Vitral de iglesia: piezas de vidrio de colores joya con plomo grueso, luz que atraviesa por detrás y arco gótico de piedra.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];path(pts);
      if(w>6&&h>6){const cx=b[0]+w*.5,cy=b[1]+h*.45,g=ctx.createRadialGradient(cx,cy,1,cx,cy,Math.max(w,h)*.7);const sh=.18*Math.sin(now*1.6+hash(sid,1,1)*6);g.addColorStop(0,mix(f,'#ffffff',.5+sh));g.addColorStop(.6,f);g.addColorStop(1,dark(f,.3));ctx.fillStyle=g;}else ctx.fillStyle=f;ctx.fill();
      ctx.save();path(pts);ctx.clip();ctx.globalAlpha=.35;GRAINP=GRAINP||ctx.createPattern(GRAIN,'repeat');ctx.fillStyle=GRAINP;ctx.fillRect(b[0],b[1],w,h);ctx.restore();
      if(o){path(pts);ctx.lineJoin='round';ctx.lineWidth=Math.max(4,o*1.9);ctx.strokeStyle='#141018';ctx.stroke();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(3.5,w*.9);ctx.strokeStyle='#141018';ctx.stroke();}},
  etiq:{name:'etiqueta',fps:0,paper:'#f3e6c4',col:c=>etMap(c),darkText:1,
    desc:'Etiqueta de producto antigua (tipo harina o cerveza): litografía de pocos colores con grabado fino, borde ondulado, medalla y listón de marca.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];path(pts);ctx.fillStyle=f;ctx.fill();
      if(o>=3&&w>16&&h>16&&f!=='#14101c'){ctx.save();path(pts);ctx.clip();ctx.strokeStyle=f==='#f3e6c4'?'rgba(28,46,92,.4)':'rgba(20,16,28,.35)';ctx.lineWidth=1;ctx.beginPath();for(let k=-h;k<w+h;k+=3.6){ctx.moveTo(b[0]+k,b[3]);ctx.lineTo(b[0]+k+h*.7,b[1]);}ctx.stroke();ctx.restore();}
      if(o){path(pts);ctx.lineJoin='round';ctx.lineWidth=Math.max(2.4,o*.8);ctx.strokeStyle='#1c2e5c';ctx.stroke();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(2,w*.7);ctx.strokeStyle=c===INK?'#1c2e5c':c;ctx.stroke();}},
  exvoto:{name:'ex-voto ♥',fps:0,paper:'#7a8794',col:c=>satur(mix(c,'#c8a878',.14),.88),
    desc:'Ex-voto sobre lámina de lata: pintura ingenua de agradecimiento, trazos de pincel, lámina oxidada y texto de gracias a la Virgen.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];path(pts);ctx.fillStyle=f;ctx.fill();
      if(w>14&&h>14){ctx.save();path(pts);ctx.clip();ctx.lineCap='round';for(let i=0;i<Math.min(16,w*h/260);i++){const x=b[0]+hash(sid,i,5)*w,y=b[1]+hash(sid,i,6)*h,L=8+hash(sid,i,7)*16;ctx.strokeStyle=hash(sid,i,8)>.5?'rgba(255,240,200,.18)':'rgba(40,20,0,.14)';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+L,y-L*.35);ctx.stroke();}ctx.restore();}
      if(o){path(pts);ctx.lineJoin='round';ctx.lineWidth=Math.max(2,o*.72);ctx.strokeStyle='#3a2418';ctx.stroke();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(2,w*.7);ctx.strokeStyle=c===INK?'#3a2418':c;ctx.stroke();}},
  mola:{name:'mola',fps:0,paper:'#0c0a12',col:c=>satur(c,1.35),
    desc:'Mola guna (aplique inverso): capas de tela sobre negro con líneas concéntricas que laten dentro de cada forma.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];path(pts);ctx.lineJoin='round';
      if(o){ctx.lineWidth=Math.max(3,o*1.3);ctx.strokeStyle='#0c0a12';ctx.stroke();}
      ctx.fillStyle=f;ctx.fill();
      if(o>=3&&w>22&&h>22){const br=Math.sin(now*3+hash(sid,1,1)*6)*1.6;ctx.lineWidth=3.4;
        for(let k=1;k<=4;k++){const ip=insetPts(pts,b,9*k+br);if(!ip)break;path(ip);ctx.strokeStyle=k%2?MOLA_C[Math.floor(hash(sid,k,2)*MOLA_C.length)]:mix(f,'#0c0a12',.6);ctx.stroke();}}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(2.4,w*.8);ctx.strokeStyle=c===INK?'#fff3d0':c;ctx.stroke();}},
  xstitch:{name:'punto de cruz',fps:12,paper:'#8fd8ff',col:c=>c,
    desc:'Bordado en punto de cruz sobre tela aida: cada píxel es una puntada en X con hilo, en bastidor de madera.',
    paint(pts,f,o){STY.tinta.paint(pts,f,o);},line(pts,w,c,close){STY.tinta.line(pts,w,c,close);}},
  cordel:{name:'cordel',fps:8,paper:'#f1e7d0',col:c=>cordelMap(c),darkText:1,
    desc:'Cordel de xilografía: tinta negra y un solo color rojo sobre papel de periódico, rayado de gubia y marco grueso.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];path(pts);ctx.fillStyle=f;ctx.fill();
      if(o>=3&&w>16&&h>16&&f!=='#1a1410'){ctx.save();path(pts);ctx.clip();ctx.beginPath();ctx.moveTo(b[0]+w*.3,b[3]);ctx.lineTo(b[2],b[1]+h*.3);ctx.lineTo(b[2],b[3]);ctx.closePath();ctx.clip();
        ctx.strokeStyle='#1a1410';ctx.lineWidth=1.7;ctx.beginPath();for(let k=-h;k<w+h;k+=4.6){ctx.moveTo(b[0]+k,b[3]);ctx.lineTo(b[0]+k+h*.8,b[1]);}ctx.stroke();ctx.restore();}
      if(o){path(pts);ctx.lineJoin='round';ctx.lineWidth=Math.max(2.8,o*1.15);ctx.strokeStyle='#1a1410';ctx.stroke();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(2.4,w*.8);ctx.strokeStyle=c;ctx.stroke();}},
  rotu:{name:'rotulismo',fps:0,paper:'#ffcf3d',col:c=>satur(c,1.3),
    desc:'Pintura de rótulos de buses y camiones: aerógrafo con degradados, doble contorno negro y blanco, brillos cromados que barren y marco con rombos.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];path(pts);ctx.lineJoin='round';
      if(o){ctx.lineWidth=o*2.5;ctx.strokeStyle=INK;ctx.stroke();ctx.lineWidth=o*1.25;ctx.strokeStyle='#fffdf0';ctx.stroke();}
      if(h>10){const g=ctx.createLinearGradient(b[0],b[1],b[0]+w*.3,b[3]);g.addColorStop(0,mix(f,'#ffffff',.45));g.addColorStop(.4,f);g.addColorStop(1,mix(f,'#2a0a40',.45));ctx.fillStyle=g;}else ctx.fillStyle=f;
      ctx.fill();
      if(o>=3&&w>24&&h>24){ctx.save();path(pts);ctx.clip();ctx.fillStyle='rgba(255,255,255,.34)';ctx.beginPath();ctx.ellipse(b[0]+w*.32,b[1]+h*.22,w*.28,h*.1,-.4,0,TAU);ctx.fill();
        const u=((now*.4+hash(sid,1,1)*3)%2.2)-.5,x=b[0]+u*(w+h*.5);ctx.fillStyle='rgba(255,255,255,.38)';ctx.beginPath();ctx.moveTo(x,b[3]);ctx.lineTo(x+w*.1,b[3]);ctx.lineTo(x+w*.1+h*.5,b[1]);ctx.lineTo(x+h*.5,b[1]);ctx.fill();ctx.restore();
        if(w>70&&h>60)star4(b[0]+w*.22,b[1]+h*.17,8,'#ffffff');}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=w+8;ctx.strokeStyle=INK;ctx.stroke();if(c!==INK){ctx.lineWidth=w+3;ctx.strokeStyle='#fffdf0';ctx.stroke();}ctx.lineWidth=w;ctx.strokeStyle=c;ctx.stroke();}},
  lote:{name:'lotería ♥',fps:6,paper:'#f2e3c0',col:c=>loteMap(c),darkText:1,
    desc:'Carta de lotería: litografía de 5 tintas, color corrido, sombreado de rayitas cruzadas, marco con número y listón con el nombre. Cuadros a 6 fps.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1],PAPER='#f2e3c0';
      ctx.save();if(f!==PAPER)ctx.translate(2.4,1.8);path(pts);ctx.fillStyle=f;ctx.fill();ctx.restore();
      if(o>=3&&w>18&&h>18&&f!==PAPER&&f!=='#2a1a10'){ctx.save();path(pts);ctx.clip();ctx.beginPath();ctx.moveTo(b[0]+w*.35,b[3]);ctx.lineTo(b[2],b[1]+h*.35);ctx.lineTo(b[2],b[3]);ctx.closePath();ctx.clip();
        ctx.strokeStyle='rgba(42,26,16,.55)';ctx.lineWidth=1.1;ctx.beginPath();for(let k=-h;k<w+h;k+=5.5){ctx.moveTo(b[0]+k,b[3]);ctx.lineTo(b[0]+k+h,b[1]);}ctx.stroke();ctx.restore();}
      if(o){path(pts);ctx.lineJoin='round';ctx.lineWidth=Math.max(2.2,o*.75);ctx.strokeStyle='#2a1a10';ctx.stroke();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(2,w*.7);ctx.strokeStyle=c;ctx.stroke();}},
  felt:{name:'fieltro ♥',fps:10,paper:'#c9ad82',col:c=>satur(mix(c,'#d8d0c0',.1),.95),
    desc:'Fieltro cosido tipo arpillera: piezas con textura de tela, puntadas, ojos de botón y pelo de lana. Stop-motion a 10 fps.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1],fr=FRJ,q=pts.map((p,i)=>[p[0]+(hash(sid,i,fr*3)-.5)*1.5,p[1]+(hash(sid,i,fr*3+1)-.5)*1.5]);
      if(o){ctx.save();ctx.translate(3,5);path(q);ctx.fillStyle='rgba(40,25,10,.3)';ctx.fill();ctx.restore();}
      path(q);ctx.fillStyle=f;ctx.fill();
      ctx.save();path(q);ctx.clip();ctx.globalAlpha=.8;GRAINP=GRAINP||ctx.createPattern(GRAIN,'repeat');ctx.fillStyle=GRAINP;ctx.fillRect(b[0],b[1],w,h);
      ctx.globalAlpha=.5;ctx.strokeStyle=mix(f,'#ffffff',.4);ctx.lineWidth=1;for(let i=0;i<Math.min(14,w*h/500);i++){const x=b[0]+hash(sid,i,5)*w,y=b[1]+hash(sid,i,6)*h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(hash(sid,i,7)-.5)*9,y+(hash(sid,i,8)-.5)*5);ctx.stroke();}ctx.restore();
      if(o){path(q);ctx.lineJoin='round';ctx.lineWidth=2.6;ctx.strokeStyle=mix(f,'#ffffff',.3);ctx.globalAlpha=.7;ctx.stroke();ctx.globalAlpha=1;}
      if(o>=3&&w>24&&h>24){const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2,kx=Math.max(.3,1-7/(w/2)),ky=Math.max(.3,1-7/(h/2));
        path(q.map(p=>[cx+(p[0]-cx)*kx,cy+(p[1]-cy)*ky]));ctx.setLineDash([6,5]);ctx.lineWidth=2.1;ctx.strokeStyle=lum(f)>.55?dark(f,.45):'#fff6dc';ctx.stroke();ctx.setLineDash([]);}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';
      if(c===INK){ctx.setLineDash([6,4]);ctx.lineWidth=Math.max(2.2,w*.55);ctx.strokeStyle='#2e1c10';ctx.stroke();ctx.setLineDash([]);}
      else{ctx.lineWidth=w;ctx.strokeStyle=c;ctx.stroke();ctx.setLineDash([3,6]);ctx.lineWidth=w*.8;ctx.strokeStyle=dark(c,.25);ctx.globalAlpha=.5;ctx.stroke();ctx.globalAlpha=1;ctx.setLineDash([]);}}},
  anime:{name:'anime 90s',fps:12,paper:'#7fc8ff',grad:true,col:c=>satur(c,1.18),
    desc:'Anime de los 90 en celdas a 12 fps: personajes esbeltos, ojos enormes con brillos, sombra dura y líneas de impacto con destello al frenar o recibir el golpe.',
    paint(pts,f,o){const b=bbox(pts),w=b[2]-b[0],h=b[3]-b[1];path(pts);ctx.lineJoin='round';ctx.fillStyle=f;ctx.fill();
      if(o>=3&&w>14&&h>14&&lum(f)<.97){cel(pts,f,true);ctx.save();path(pts);ctx.clip();ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.ellipse(b[0]+w*.3,b[1]+h*.2,Math.max(2,w*.07),Math.max(3,h*.12),-.5,0,TAU);ctx.fill();ctx.restore();}
      if(o){path(pts);ctx.lineWidth=Math.max(2.4,o*.8);ctx.strokeStyle=dark(f,.66);ctx.stroke();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(2.4,w*.8);ctx.strokeStyle=c===INK?'#241338':dark(c,.5);ctx.stroke();}},
  toon:{name:'caricatura 90s',fps:12,paper:'#ffd93d',col:c=>satur(c,1.3),
    desc:'Dibujos de la tarde de los 90: cabezones con cuerpo mini, contorno negro parejo, colores planos, poses sostenidas que revientan al ritmo y estelas de movimiento.',
    paint(pts,f,o){path(pts);ctx.lineJoin='round';if(o){ctx.lineWidth=7.5;ctx.strokeStyle=INK;ctx.stroke();}ctx.fillStyle=f;ctx.fill();if(o>=3)cel(pts,f,true);},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';if(c!==INK){ctx.lineWidth=w+7;ctx.strokeStyle=INK;ctx.stroke();}ctx.lineWidth=w;ctx.strokeStyle=c;ctx.stroke();}},
  tinta:{name:'tinta',fps:0,paper:'#bfe9ff',col:c=>c,
    desc:'Cartoon limpio de tele: contorno grueso, sombra de celda, brillo, movimiento suave a 60 fps.',
    paint(pts,f,o){path(pts);ctx.lineJoin='round';if(o){ctx.lineWidth=o*2;ctx.strokeStyle=INK;ctx.stroke();}ctx.fillStyle=f;ctx.fill();if(o>=3)cel(pts,f,false);},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';if(c!==INK){ctx.lineWidth=w+6;ctx.strokeStyle=INK;ctx.stroke();}ctx.lineWidth=w;ctx.strokeStyle=c;ctx.stroke();}},
  garabato:{name:'garabato',fps:12,paper:'#fbf1d6',col:c=>mix(c,'#ffffff',.08),
    desc:'Dibujado a mano: línea que tiembla a 12 fps, color corrido fuera de la línea y rayitas.',
    paint(pts,f,o){const fr=FRJ,J=(k,a)=>pts.map((p,i)=>[p[0]+(hash(sid,i,k+fr*3)-.5)*a,p[1]+(hash(sid,i,k+fr*3+1)-.5)*a]);
      const ox=3+(hash(sid,0,77)-.5)*3,oy=2+(hash(sid,1,78)-.5)*3,b=bbox(pts);
      ctx.save();ctx.translate(ox,oy);path(J(1,2.5));ctx.fillStyle=f;ctx.fill();
      if(o>=3&&(b[2]-b[0])*(b[3]-b[1])>2600&&lum(f)<.9){ctx.clip();ctx.strokeStyle=dark(f,.15);ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();
        for(let x=b[0]-(b[3]-b[1]),i=0;x<b[2];x+=13,i++){const j=(hash(sid,i,9+fr)-.5)*4;ctx.moveTo(x+j,b[3]);ctx.lineTo(x+(b[3]-b[1])*.8+j,b[1]);}ctx.stroke();}
      ctx.restore();
      if(!o)return;
      for(let pass=0;pass<2;pass++){const q=J(10+pass*20,pass?3.6:3),s=pass?Math.floor(q.length*.35):0;
        path(q.slice(s).concat(q.slice(0,s)),false);ctx.lineWidth=pass?1.5:3.2;ctx.strokeStyle='#1b1630';ctx.lineJoin=ctx.lineCap='round';ctx.stroke();}},
    line(pts,w,c,close){const fr=FRJ;for(let pass=0;pass<2;pass++){const q=pts.map((p,i)=>[p[0]+(hash(sid,i,5+pass*9+fr*3)-.5)*3,p[1]+(hash(sid,i,6+pass*9+fr*3)-.5)*3]);
        path(q,false);ctx.lineCap=ctx.lineJoin='round';ctx.strokeStyle=pass?'#1b1630':c;ctx.lineWidth=pass?Math.max(1.5,w*.3):w;ctx.stroke();}}},
  recorte:{name:'recorte',fps:9,paper:'#d1ab72',col:c=>mix(c,'#e2c690',.1),
    desc:'Collage de papel: bordes rotos, sombra de cartón en capas, fibra de papel, stop-motion a 9 fps.',
    paint(pts,f,o){const q=tear(pts,sid),b=bbox(q);
      if(o){ctx.save();ctx.translate(5,8);path(q);ctx.fillStyle='rgba(50,30,10,.22)';ctx.fill();ctx.translate(-2.5,-4);ctx.fillStyle='rgba(50,30,10,.2)';ctx.fill();ctx.restore();
        path(q);ctx.lineJoin='round';ctx.lineWidth=8;ctx.strokeStyle='#fffaf0';ctx.stroke();}
      path(q);ctx.fillStyle=f;ctx.fill();
      ctx.save();ctx.clip();ctx.globalAlpha=.7;GRAINP=GRAINP||ctx.createPattern(GRAIN,'repeat');ctx.fillStyle=GRAINP;ctx.fillRect(b[0],b[1],b[2]-b[0],b[3]-b[1]);
      if(o>=3&&b[2]-b[0]>18&&b[3]-b[1]>18){ctx.globalAlpha=.16;ctx.fillStyle='#000';ctx.translate((b[2]-b[0])*.07,(b[3]-b[1])*.07);path(q);ctx.lineWidth=(b[2]-b[0])*.2;ctx.strokeStyle='#000';ctx.stroke();}ctx.restore();
      if(o){path(q);ctx.lineWidth=1.4;ctx.strokeStyle='rgba(60,35,10,.35)';ctx.stroke();}},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';if(w>6){ctx.lineWidth=w+5;ctx.strokeStyle='#fffaf0';ctx.stroke();}ctx.lineWidth=w;ctx.strokeStyle=c;ctx.stroke();}},
  pixel:{name:'píxel',fps:0,paper:'#5fcde4',col:c=>c,
    desc:'267×200, 32 colores (DB32) con tramado ordenado y sombra dura. Se ve como cartucho de 16 bits.',
    paint(pts,f,o){path(pts);ctx.lineJoin='round';if(o){ctx.lineWidth=7;ctx.strokeStyle=INK;ctx.stroke();}ctx.fillStyle=f;ctx.fill();if(o>=3)cel(pts,f,true);},
    line(pts,w,c,close){path(pts,close);ctx.lineCap=ctx.lineJoin='round';if(c!==INK){ctx.lineWidth=w+5;ctx.strokeStyle=INK;ctx.stroke();}ctx.lineWidth=w;ctx.strokeStyle=c;ctx.stroke();}}
};
function tear(pts,seed){const out=[],n=pts.length;for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];out.push([a[0]+(hash(seed,i,5)-.5)*2.4,a[1]+(hash(seed,i,9)-.5)*2.4]);
  const d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d>20){const k=Math.min(4,Math.floor(d/20));for(let j=1;j<=k;j++){const t=j/(k+1);out.push([a[0]+(b[0]-a[0])*t+(hash(seed,i*7+j,3)-.5)*3.2,a[1]+(b[1]-a[1])*t+(hash(seed,i*7+j,4)-.5)*3.2]);}}}return out;}
function paint(pts,f,o=4){sid++;const S=STY[style];S.paint(pts,S.col(f),o,f);}
function line(pts,w,c=INK,close=false){sid++;const S=STY[style];S.line(pts,w,S.col(c),close,c);}
const ell=(cx,cy,rx,ry,f,o=4)=>paint(ellP(cx,cy,rx,ry),f,o);
const rr=(x,y,w,h,r,f,o=4)=>paint(rrP(x,y,w,h,r),f,o);
const limb=(x1,y1,x2,y2,w,f,o=3.5)=>paint(capP(x1,y1,x2,y2,w),f,o);
const poly=(pts,f,o=4)=>paint(pts,f,o);
const arcPts=(cx,cy,r,a0,a1,n=8,sy=1)=>{const p=[];for(let i=0;i<=n;i++){const t=a0+(a1-a0)*i/n;p.push([cx+Math.cos(t)*r,cy+Math.sin(t)*r*sy]);}return p;};
function wash(x,y,w,h,c1,c2,o=0){const S=STY[style];
  if(style==='mola'){ctx.fillStyle='#0c0a12';ctx.fillRect(x,y,w,h);return;}
  if((style==='ghibli'||style==='ww'||style==='acnh'||style==='pixar')&&y<5&&h>250){const[r_,g_,b_]=rgb(c1);if(b_>r_+30){
    const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,S.col(c1));g.addColorStop(1,S.col(c2||c1));ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
    const drift=(now*5)%1100;for(const[cx0,cy0,sc]of[[150,110,1.3],[560,80,1.7],[380,190,1],[820,150,1.4]]){const cx=((cx0+drift)%1100)-150;
      ctx.fillStyle=style==='ww'?'#ffffff':'rgba(255,255,255,.92)';for(const[dx,dy,r]of[[0,0,34],[38,-12,40],[78,0,32],[36,10,36],[-30,8,24],[108,8,22]]){ctx.beginPath();ctx.arc(cx+dx*sc,cy0+dy*sc,r*sc,0,TAU);ctx.fill();if(style==='ww'){ctx.strokeStyle='#4a78b8';ctx.lineWidth=2.4;ctx.stroke();}}
      if(style!=='ww'){ctx.fillStyle='rgba(180,200,230,.35)';ctx.beginPath();ctx.ellipse(cx+40*sc,cy0+26*sc,70*sc,14*sc,0,0,TAU);ctx.fill();}}
    return;}}
  if(style==='splat'){const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#2a0f55');g.addColorStop(1,'#12062a');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
    if(y<5&&h>250){const cols=['#ff2e93','#7cff00','#00d8ff','#ffd800','#9b3bff'];for(let i=0;i<14;i++){const cx=hash(i,1,1)*800,cy=20+hash(i,2,2)*300,r=14+hash(i,3,3)*34;ctx.fillStyle=cols[i%5];ctx.globalAlpha=.8;
      ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);for(let k=0;k<6;k++){const a=hash(i,k,4)*TAU,d=r*(.9+hash(i,k,5)*.9);ctx.moveTo(cx+Math.cos(a)*d,cy+Math.sin(a)*d);ctx.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d,r*(.18+hash(i,k,6)*.22),0,TAU);}ctx.fill();ctx.fillRect(cx-r*.1,cy,r*.2,r*(1.2+hash(i,7,7)));}ctx.globalAlpha=1;}return;}
  if(style==='candy'&&y<5&&h>250){const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#8a5cff');g.addColorStop(1,'#ff8fd8');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
    for(let i=0;i<16;i++){ctx.fillStyle='rgba(255,255,255,'+(.12+hash(i,2,2)*.2)+')';ctx.beginPath();ctx.arc(hash(i,1,1)*800,hash(i,3,3)*h,10+hash(i,4,4)*38,0,TAU);ctx.fill();}return;}
  if(style==='bean'&&y<5&&h>250){const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#ffa8ec');g.addColorStop(.6,'#ffe0a0');g.addColorStop(1,'#c8ffd8');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);return;}
  if(style==='vitral'){const jc=vitMap(c1);ctx.fillStyle=jc;ctx.fillRect(x,y,w,h);ctx.strokeStyle='#141018';ctx.lineWidth=5;for(let gx=x;gx<=x+w;gx+=100){ctx.beginPath();ctx.moveTo(gx,y);ctx.lineTo(gx,y+h);ctx.stroke();}for(let gy=y;gy<=y+h;gy+=90){ctx.beginPath();ctx.moveTo(x,gy);ctx.lineTo(x+w,gy);ctx.stroke();}return;}
  if(S.grad){const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,S.col(c1));g.addColorStop(1,S.col(c2||c1));ctx.fillStyle=g;ctx.fillRect(x,y,w,h);}
  else paint(rrP(x,y,w,h,0),c1,o);}
function txt(s,x,y,size,fill='#fff',rot=0,plain=false){
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.font=fnt(size);ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  const f=STY[style].col(fill);
  if(style==='splat'){const col=neonMap(fill===INK?'#1a0a30':fill);if(!plain){ctx.fillStyle=SPL_ALT[col]||'#00d8ff';ctx.fillText(s,4,5);ctx.lineWidth=size*.26;ctx.strokeStyle='#0a0418';ctx.strokeText(s,0,0);}ctx.fillStyle=col;ctx.fillText(s,0,0);}
  else if(style==='candy'||style==='bean'||style==='mario'){if(!plain){ctx.lineWidth=size*.3;ctx.strokeStyle=style==='mario'?'#14101c':'#4a2a7a';ctx.strokeText(s,0,0);ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillText(s,2,4);}
    const g=ctx.createLinearGradient(0,-size*.5,0,size*.5);g.addColorStop(0,mix(fill,'#ffffff',.5));g.addColorStop(.55,fill);g.addColorStop(1,dark(fill,.2));ctx.fillStyle=g;ctx.fillText(s,0,0);}
  else if(style==='cordel'){ctx.fillStyle=cordelMap(fill===INK?'#1a1410':fill==='#fff'||fill==='#ffffff'?'#f1e7d0':fill);if(!plain){ctx.lineWidth=size*.2;ctx.strokeStyle='#1a1410';ctx.strokeText(s,0,0);}ctx.fillText(s,0,0);}
  else if(style==='rotu'){if(!plain){ctx.fillStyle='#c4283a';ctx.fillText(s,4,6);ctx.lineWidth=size*.3;ctx.strokeStyle=INK;ctx.strokeText(s,0,0);ctx.lineWidth=size*.14;ctx.strokeStyle='#fffdf0';ctx.strokeText(s,0,0);}
    const g=ctx.createLinearGradient(0,-size*.5,0,size*.5);g.addColorStop(0,mix(fill,'#ffffff',.6));g.addColorStop(.5,fill);g.addColorStop(1,mix(fill,'#7a1e00',.4));ctx.fillStyle=g;ctx.fillText(s,0,0);}
  else if(style==='lote'){ctx.fillStyle=loteMap(fill===INK?'#2a1a10':fill==='#fff'||fill==='#ffffff'?'#f2e3c0':fill);if(!plain){ctx.lineWidth=size*.14;ctx.strokeStyle='#2a1a10';ctx.strokeText(s,0,0);}ctx.fillText(s,0,0);}
  else if(style==='felt'){if(!plain){ctx.fillStyle='rgba(40,25,10,.35)';ctx.fillText(s,2,4);ctx.setLineDash([5,4]);ctx.lineWidth=size*.06;ctx.strokeStyle='#fff6dc';ctx.strokeText(s,0,0);ctx.setLineDash([]);}ctx.fillStyle=fill==='#fff'||fill==='#ffffff'?'#f6efe0':fill;ctx.fillText(s,0,0);}
  else if(style==='toon'){if(!plain){ctx.fillStyle=INK;ctx.fillText(s,4,6);ctx.lineWidth=size*.26;ctx.strokeStyle=INK;ctx.strokeText(s,0,0);}ctx.fillStyle=fill;ctx.fillText(s,0,0);}
  else if(style==='clay'){ctx.fillStyle='rgba(60,30,10,.35)';ctx.fillText(s,3,5);ctx.lineWidth=size*.14;ctx.strokeStyle=dark(fill==='#fff'||fill==='#ffffff'?'#f0e6d0':fill,.35);ctx.strokeText(s,0,0);ctx.fillStyle=fill==='#fff'||fill==='#ffffff'?'#f6efe0':fill;ctx.fillText(s,0,0);ctx.globalAlpha=.4;ctx.fillStyle='#fff';ctx.fillText(s,-1.5,-2);}
  else if(style==='arcade'||style==='anime'){if(style==='anime')ctx.transform(1,0,-.2,1,0,0);ctx.lineWidth=size*.3;ctx.strokeStyle=INK;if(!plain)ctx.strokeText(s,0,0);const g=ctx.createLinearGradient(0,-size*.5,0,size*.5);g.addColorStop(0,mix(fill,'#ffffff',.65));g.addColorStop(.5,fill);g.addColorStop(1,mix(fill,'#7a1e00',.4));
    if(!plain){ctx.lineWidth=size*.1;ctx.strokeStyle='#ffffff';ctx.strokeText(s,0,0);}ctx.fillStyle=g;ctx.fillText(s,0,0);}
  else if(style==='riso'){ctx.fillStyle=risoMap(fill===INK?'#1a1a2e':fill==='#fff'||fill==='#ffffff'?'#f3ead2':fill);if(!plain){ctx.lineWidth=size*.16;ctx.strokeStyle='#1a1a2e';ctx.strokeText(s,0,0);ctx.fillText(s,-2,2);}ctx.fillText(s,0,0);}
  else if(style==='acuarela'){ctx.fillStyle=fill==='#fff'||fill==='#ffffff'?'#f2f2f2':fill;if(!plain){ctx.lineWidth=size*.14;ctx.strokeStyle='#4a4560';ctx.strokeText(s,0,0);}ctx.globalAlpha=.92;ctx.fillText(s,0,0);}
  else if(style==='garabato'){const j=Math.floor(now*12);ctx.translate((hash(7,j,3)-.5)*2.5,(hash(7,j,4)-.5)*2.5);if(!plain){ctx.lineWidth=size*.17;ctx.strokeStyle='#1b1630';ctx.strokeText(s,0,0);}ctx.fillStyle=f;ctx.fillText(s,0,0);}
  else if(style==='recorte'){if(!plain){ctx.fillStyle='rgba(40,25,10,.3)';ctx.fillText(s,3,5);ctx.lineWidth=size*.24;ctx.strokeStyle='#fffaf0';ctx.strokeText(s,0,0);}ctx.fillStyle=f;ctx.fillText(s,0,0);}
  else{if(!plain){ctx.lineWidth=size*.2;ctx.strokeStyle=INK;ctx.strokeText(s,0,0);}ctx.fillStyle=f;ctx.fillText(s,0,0);}
  ctx.restore();}
const tw=(s,size)=>{ctx.font=fnt(size);return ctx.measureText(s).width;};
function bubble(x,y,s,size,tx,ty,col='#fff'){const w=tw(s,size)+40,h=size+30;
  poly([[x-12,y+h/2-4],[x+12,y+h/2-4],[tx,ty]],col,3.5);rr(x-w/2,y-h/2,w,h,16,col,3.5);rr(x-12,y+h/2-9,24,8,0,col,0);txt(s,x,y+1,size,INK,0,true);}

/* ───────── particles ───────── */
const PT=[];
function spawn(x,y,n,kind,cols,sp=260,g=700,life=.9){for(let i=0;i<n;i++){const a=Math.random()*TAU,v=sp*(.3+Math.random()*.7);PT.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-sp*.4,g,t:0,life:life*(.7+Math.random()*.6),kind,col:cols[i%cols.length],r:5+Math.random()*6,rot:Math.random()*6,vr:(Math.random()-.5)*14});}}
function updP(dt){for(const p of PT){p.t+=dt;p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;}for(let i=PT.length-1;i>=0;i--)if(PT[i].t>PT[i].life)PT.splice(i,1);}
function drawP(){for(const p of PT){const a=1-p.t/p.life;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=clamp(a*2,0,1);
  if(p.kind==='conf')rr(-p.r,-p.r*.6,p.r*2,p.r*1.2,2,p.col,0);
  else if(p.kind==='bill')rr(-p.r*1.4,-p.r*.7,p.r*2.8,p.r*1.4,2,'#5cd06a',2.5);
  else if(p.kind==='feather')ell(0,0,p.r*1.3,p.r*.5,p.col,2);
  else if(p.kind==='bit')poly([[-p.r,-p.r*.4],[p.r*.8,-p.r],[p.r,p.r*.6],[-p.r*.4,p.r]],p.col,2.5);
  else txt(p.kind,0,0,22+p.r,p.col);
  ctx.restore();}}

/* ═════════ CHARACTERS: busts with real personality ═════════ */
const HY=-64;
function bust(o){
  if(CHAR[style])return CHAR[style](o);
  const s=o.s||1,fl=o.flip?-1:1,sk=o.skin||'#e8b48a',skD=dark(sk,.2),skL=mix(sk,'#ffffff',.38),sh=o.shirt||'#e8553d',hc=o.hairCol||'#2a1a14';
  const hw=o.hw||40,hh=o.hh||42,m=o.mood||'calm',bw=o.bw||54,es=o.eyeS||17,er=o.eyeR||9.5,look=o.look||0,talk=o.talk||0;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s,s*(o.sy||1));
  if(o.legs){const[pc,sc,len,sc2]=o.legs;rr(-34,100,28,len,10,pc,4);rr(6,100,28,len,10,pc,4);ell(-24,100+len,24,10,sc,3.5);ell(24,100+len,24,10,sc2||sc,3.5);}
  if(o.under)o.under();
  /* torso */
  rr(-bw,-10,bw*2,o.th||170,36,sh,4.5);
  const p2=o.sh2||'#ffffff';
  if(o.pat==='stripes'){for(let i=0;i<4;i++)rr(-bw+9,22+i*26,bw*2-18,11,5,p2,0);}
  else if(o.pat==='jersey'){rr(-bw+4,-8,20,22,8,p2,0);rr(bw-24,-8,20,22,8,p2,0);rr(-24,70,48,12,5,p2,0);}
  else if(o.pat==='floral'){for(let i=0;i<9;i++)ell(-38+(i%4)*25+(i>3?12:0),26+Math.floor(i/4)*36,8,8,p2,0);for(let i=0;i<9;i++)ell(-38+(i%4)*25+(i>3?12:0),26+Math.floor(i/4)*36,3,3,'#ffd23f',0);}
  else if(o.pat==='apron'){rr(-31,16,62,160,16,p2,3.5);rr(-18,34,36,30,8,dark(p2,.12),2.5);}
  else if(o.pat==='suit'){poly([[-18,-10],[0,46],[18,-10]],'#ffffff',3);poly([[-5,8],[5,8],[8,70],[0,80],[-8,70]],p2,3);}
  else if(o.pat==='tank'){rr(-bw,-10,28,40,14,sk,4);rr(bw-28,-10,28,40,14,sk,4);poly([[-bw+24,-8],[-12,-8],[0,26],[12,-8],[bw-24,-8],[bw-24,40],[-bw+24,40]],sh,0);}
  else if(o.pat==='hoodie'){ell(0,-8,34,16,dark(sh,.15),3.5);line([[-10,6],[-12,40]],3.5,'#fff');line([[10,6],[12,40]],3.5,'#fff');}
  if(o.chain){line(arcPts(0,-6,26,Math.PI*.1,Math.PI*.9,10,1.5),4.5,'#ffd23f');ell(0,40,8,8,'#ffd23f',2.5);}
  /* arms */
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.78,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,4,ex,ey,a.w||21,a.col||sh,4);ell(ex,ey,13,13,sk,3.5);if(a.hand)a.hand(ex,ey,a.a);}
  /* neck + hair behind + ears */
  rr(-14,-32,28,36,8,skD,3.5);
  if(o.hair==='afro')ell(0,HY-12,hw+20,hh+14,hc,5);
  if(o.hair==='mullet')rr(-hw-13,HY-16,2*hw+26,hh+84,24,hc,4.5);
  if(o.hair==='rolos')ell(0,HY-14,hw+10,hh+4,hc,5);
  if(o.hair==='long')rr(-hw-12,HY-18,2*hw+24,hh+110,26,hc,4.5);
  ell(-hw-1,HY+2,9,13,sk,3.5);ell(hw+1,HY+2,9,13,sk,3.5);
  if(o.earring)ell(-hw-5,HY+18,4.5,4.5,'#ffd23f',2);
  /* head */
  paint(rrP(-hw,HY-hh,hw*2,hh*2,o.hr||Math.min(hw,hh)*.92),sk,5);
  if(o.cheeks){ell(-hw*.62,HY+15,10,6.5,'#ff8aa5',0);ell(hw*.62,HY+15,10,6.5,'#ff8aa5',0);}
  if(o.stubble){for(let i=0;i<9;i++)ell(-18+i*4.5,HY+hh*.7+Math.sin(i*2)*3,1.6,1.6,dark(sk,.5),0);}
  /* nose */
  const nk=o.nose||'bulb',nS=o.noseS||1;
  if(nk==='bulb'){ell(0,HY+9,12*nS,10*nS,mix(sk,'#d9604a',.24),3);ell(-3.5,HY+5,4,2.8,skL,0);}
  else if(nk==='long'){poly([[-5,HY-8],[6,HY-8],[11,HY+16],[0,HY+22],[-11,HY+15]],mix(sk,'#d9604a',.18),3);ell(-2,HY+2,2.6,5,skL,0);}
  else ell(0,HY+9,6.5,5.5,mix(sk,'#d9604a',.22),2.5);
  /* eyes */
  const ey=HY-6;
  for(const sx of[-es,es]){
    if(m==='sleep'){line([[sx-er,ey],[sx,ey+5],[sx+er,ey]],4);continue;}
    if(m==='happy'){line(arcPts(sx,ey+5,er-1,Math.PI*1.1,Math.PI*1.9,6),4.5);continue;}
    if(m==='dizzy'){line([[sx-7,ey-7],[sx+7,ey+7]],4);line([[sx+7,ey-7],[sx-7,ey+7]],4);continue;}
    const big=(m==='yell'||m==='panic')?1.22:1;
    ell(sx,ey,er*big,er*1.15*big,'#fff',3);
    const px=sx+look*er*.42,py=ey+(o.down?4:1);
    ell(px,py,m==='panic'?3:er*.52,m==='panic'?3:er*.58,o.iris||INK,0);
    if(m!=='panic')ell(px-2,py-2.6,2.3,2.3,'#fff',0);
    if(o.lids)rr(sx-er-2,ey-er*1.25-2,(er+2)*2,er*1.25+2,4,sk,2.5);}
  /* brows */
  const bc=o.browCol||hc,bt=o.brow==='thin'?4:o.brow==='uni'?9:8,by=HY-hh*.42,ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  if(o.brow!=='none'){for(const sg of[-1,1])limb(sg*(es+11),by-ang*5.5,sg*(es-9),by+ang*5.5,bt,bc,2.5);if(o.brow==='uni')limb(-es+9,by+ang*5.5,es-9,by+ang*5.5,bt,bc,2.5);}
  /* mouth */
  const my=HY+hh*.56;
  if(m==='yell'){ell(0,my,15+talk*5,11+talk*9,'#5a0f1f',3.5);ell(0,my+8+talk*3,9,5,'#ff7a90',0);if(o.teeth)rr(-10,my-12,20,7,2,'#fff',0);}
  else if(m==='o'||m==='panic')ell(0,my,8,9,'#5a0f1f',3);
  else if(m==='smile'||m==='happy')line(arcPts(0,my-13,19,Math.PI*.2,Math.PI*.8,6),4.5);
  else if(m==='grin'){ell(0,my-2,19,12,'#5a0f1f',3.5);rr(-15,my-13,30,8,3,'#fff',0);if(o.gold)rr(5,my-13,8,8,2,'#ffd23f',1.5);}
  else if(m==='sleep'){ell(6,my,7,8,'#5a0f1f',3);}
  else if(m==='angry'){line([[-12,my+1],[-4,my-2],[4,my+2],[12,my-1]],4.5);if(o.teeth)rr(-9,my-5,18,8,2,'#fff',2);}
  else if(m==='frown')line(arcPts(0,my+13,17,Math.PI*1.2,Math.PI*1.8,6),4.5);
  else{line([[-10,my],[10,my]],4.5);if(o.teeth==='buck'){rr(-7,my,14,12,3,'#fff',2.5);line([[0,my+1],[0,my+11]],1.8,INK);}}
  /* stache / goatee */
  if(o.stache)poly([[-26,HY+16],[-9,HY+12],[0,HY+17],[9,HY+12],[26,HY+16],[19,HY+28],[0,HY+22],[-19,HY+28]],hc,3);
  if(o.goatee)poly([[-9,my+8],[9,my+8],[6,my+26],[0,my+30],[-6,my+26]],hc,3);
  /* glasses */
  if(o.glasses==='round'){for(const sg of[-1,1])line(closeP(ellP(sg*es,ey,er+7,er+7,16)),3.5,'#4a3a2a');line([[-es+er+7,ey],[es-er-7,ey]],3.5,'#4a3a2a');}
  if(o.glasses==='shades'){for(const sg of[-1,1]){rr(sg*es-18,ey-11,36,23,9,'#15131c',3);ell(sg*es-7,ey-4,5,3,'#6a6a88',0);}line([[-es+18,ey-3],[es-18,ey-3]],4,INK);}
  if(o.wrinkles){line([[-17,HY-hh*.66],[0,HY-hh*.7],[17,HY-hh*.66]],2.4,dark(sk,.38));line([[-16,HY-hh*.55],[0,HY-hh*.58],[16,HY-hh*.55]],2.2,dark(sk,.38));
    line(arcPts(-hw*.6,HY+10,10,Math.PI*1.7,Math.PI*.3+TAU,5),2.2,dark(sk,.38));line(arcPts(hw*.6,HY+10,10,Math.PI*.7,Math.PI*1.3,5),2.2,dark(sk,.38));}
  /* hair in front / headwear */
  const ht=HY-hh;
  if(o.hair==='slick')poly([[-hw,HY-8],[-hw+2,ht+4],[-10,ht-10],[hw-4,ht-4],[hw,HY-8],[hw-8,ht+14],[0,ht+6],[-hw+8,ht+14]],hc,4);
  else if(o.hair==='bald'){line([[-hw+2,HY-10],[-hw+6,HY-26]],5,hc);line([[hw-2,HY-10],[hw-6,HY-26]],5,hc);ell(-10,ht+12,10,5,skL,0);}
  else if(o.hair==='curly'){for(let i=0;i<5;i++)ell(-32+i*16,ht+2-Math.abs(i-2)*5+8,12,11,hc,3.5);}
  else if(o.hair==='afro'){for(let i=0;i<4;i++)ell(-26+i*17,ht+10,12,10,hc,3.5);}
  else if(o.hair==='bun'){ell(0,ht-12,17,16,hc,4);rr(-hw+2,ht-4,hw*2-4,22,10,hc,4);}
  else if(o.hair==='rolos'){rr(-hw,ht+2,hw*2,18,8,hc,4);for(let i=0;i<7;i++){const a=Math.PI*1.08+i/6*Math.PI*.84,px=Math.cos(a)*(hw+2),py=HY-8+Math.sin(a)*(hh+3);ctx.save();ctx.translate(px,py);ctx.rotate(a+Math.PI/2);rr(-7,-14,14,26,6,i%2?'#ff9ec7':'#7fd8ff',3);line([[-5,-4],[5,-4]],2,'#fff');line([[-5,4],[5,4]],2,'#fff');ctx.restore();}}
  else if(o.hair==='long'||o.hair==='mullet')rr(-hw+2,ht+2,hw*2-4,20,10,hc,4);
  if(o.cap){const cc=o.cap;if(o.capBack){rr(-hw-2,ht-16,hw*2+4,34,16,cc,4.5);rr(-hw-30,ht+6,36,12,6,dark(cc,.2),3.5);}
    else{rr(-hw-2,ht-16,hw*2+4,34,16,cc,4.5);rr(hw-14,ht+8,52,13,6,dark(cc,.2),3.5);}ell(0,ht-1,9,9,'#fff',2.5);}
  if(o.hat){ell(0,ht+8,hw+40,13,o.hat,4.5);rr(-hw+4,ht-26,hw*2-8,40,16,o.hat,4.5);rr(-hw+4,ht+2,hw*2-8,10,3,'#c0392b',2.5);}
  if(o.band){rr(-hw,ht+6,hw*2,14,6,o.band,3.5);}
  if(o.sweat){ell(hw-2,ht+16,5,8,'#9fe3ff',2.5);if(o.sweat>1)ell(-hw+4,ht+30,4,7,'#9fe3ff',2.5);}
  if(o.vein){line([[hw-18,ht+18],[hw-8,ht+24]],3.5,'#ff3b4e');line([[hw-8,ht+18],[hw-18,ht+24]],3.5,'#ff3b4e');line([[hw-24,ht+26],[hw-26,ht+36]],3.5,'#ff3b4e');line([[hw-14,ht+30],[hw-4,ht+34]],3.5,'#ff3b4e');}
  if(o.over)o.over();
  ctx.restore();}
/* ═════════ PER-STYLE CHARACTER SETS (own proportions + own animation) ═════════ */
const CHAR={};
function hairBackP(o,hw,hh){const hc=o.hairCol||'#2a1a14';
  if(o.hair==='afro')ell(0,HY-12,hw+20,hh+14,hc,4.5);
  if(o.hair==='mullet')rr(-hw-13,HY-16,2*hw+26,hh+84,24,hc,4);
  if(o.hair==='rolos')ell(0,HY-14,hw+10,hh+4,hc,4.5);
  if(o.hair==='long')rr(-hw-12,HY-18,2*hw+24,hh+110,26,hc,4);}
function hairFrontP(o,hw,hh){const hc=o.hairCol||'#2a1a14',ht=HY-hh;
  if(o.hair==='slick')poly([[-hw,HY-8],[-hw+2,ht+4],[-10,ht-10],[hw-4,ht-4],[hw,HY-8],[hw-8,ht+14],[0,ht+6],[-hw+8,ht+14]],hc,4);
  else if(o.hair==='bald'){line([[-hw+2,HY-10],[-hw+6,HY-26]],5,hc);line([[hw-2,HY-10],[hw-6,HY-26]],5,hc);}
  else if(o.hair==='curly'){for(let i=0;i<5;i++)ell(-32+i*16,ht+10-Math.abs(i-2)*5,12,11,hc,3.5);}
  else if(o.hair==='afro'){for(let i=0;i<4;i++)ell(-26+i*17,ht+10,12,10,hc,3.5);}
  else if(o.hair==='bun'){ell(0,ht-12,17,16,hc,4);rr(-hw+2,ht-4,hw*2-4,22,10,hc,4);}
  else if(o.hair==='rolos'){rr(-hw,ht+2,hw*2,18,8,hc,4);for(let i=0;i<7;i++){const a=Math.PI*1.08+i/6*Math.PI*.84,px=Math.cos(a)*(hw+2),py=HY-8+Math.sin(a)*(hh+3);ctx.save();ctx.translate(px,py);ctx.rotate(a+Math.PI/2);rr(-7,-14,14,26,6,i%2?'#ff9ec7':'#7fd8ff',3);ctx.restore();}}
  else if(o.hair==='long'||o.hair==='mullet')rr(-hw+2,ht+2,hw*2-4,20,10,hc,4);
  if(o.cap){rr(-hw-2,ht-16,hw*2+4,34,16,o.cap,4.5);if(o.capBack)rr(-hw-30,ht+6,36,12,6,dark(o.cap,.2),3.5);else rr(hw-14,ht+8,52,13,6,dark(o.cap,.2),3.5);ell(0,ht-1,9,9,'#fff',2.5);}
  if(o.hat){ell(0,ht+8,hw+40,13,o.hat,4.5);rr(-hw+4,ht-26,hw*2-8,40,16,o.hat,4.5);rr(-hw+4,ht+2,hw*2-8,10,3,'#c0392b',2.5);}}
function accP(o,hw,hh,es,ey,my){const hc=o.hairCol||'#2a1a14',sk=o.skin||'#e8b48a';
  if(o.stache)poly([[-26,HY+16],[-9,HY+12],[0,HY+17],[9,HY+12],[26,HY+16],[19,HY+28],[0,HY+22],[-19,HY+28]],hc,3);
  if(o.goatee)poly([[-9,my+8],[9,my+8],[6,my+26],[0,my+30],[-6,my+26]],hc,3);
  if(o.glasses==='round'){for(const sg of[-1,1])line(closeP(ellP(sg*es,ey,16,16,16)),3.5,'#4a3a2a');line([[-es+16,ey],[es-16,ey]],3.5,'#4a3a2a');}
  if(o.glasses==='shades'){for(const sg of[-1,1]){rr(sg*es-18,ey-11,36,23,9,'#15131c',3);ell(sg*es-7,ey-4,5,3,'#6a6a88',0);}line([[-es+18,ey-3],[es-18,ey-3]],4,INK);}
  if(o.earring)ell(-hw-5,HY+18,4.5,4.5,'#ffd23f',2);
  if(o.sweat){ell(hw-2,HY-hh+16,5,8,'#9fe3ff',2.5);if(o.sweat>1)ell(-hw+4,HY-hh+30,4,7,'#9fe3ff',2.5);}
  if(o.vein){const ht=HY-hh;line([[hw-18,ht+18],[hw-8,ht+24]],3.5,'#ff3b4e');line([[hw-8,ht+18],[hw-18,ht+24]],3.5,'#ff3b4e');line([[hw-24,ht+26],[hw-26,ht+36]],3.5,'#ff3b4e');}
  if(o.wrinkles){line([[-17,HY-hh*.66],[0,HY-hh*.7],[17,HY-hh*.66]],2.4,dark(sk,.38));}}
function torsoPat(o,bw,sk,sh){const p2=o.sh2||'#ffffff';
  if(o.pat==='stripes'){for(let i=0;i<4;i++)rr(-bw+9,22+i*26,bw*2-18,11,5,p2,0);}
  else if(o.pat==='jersey'){rr(-bw+4,-8,20,22,8,p2,0);rr(bw-24,-8,20,22,8,p2,0);rr(-24,70,48,12,5,p2,0);}
  else if(o.pat==='floral'){for(let i=0;i<9;i++){ell(-38+(i%4)*25+(i>3?12:0),26+Math.floor(i/4)*36,8,8,p2,0);}}
  else if(o.pat==='apron'){rr(-31,16,62,160,16,p2,3.5);}
  else if(o.pat==='suit'){poly([[-18,-10],[0,46],[18,-10]],'#ffffff',3);poly([[-5,8],[5,8],[8,70],[0,80],[-8,70]],p2,3);}
  else if(o.pat==='tank'){rr(-bw,-10,28,40,14,sk,3);rr(bw-28,-10,28,40,14,sk,3);}
  else if(o.pat==='hoodie'){ell(0,-8,34,16,dark(sh,.15),3);line([[-10,6],[-12,40]],3.5,'#fff');line([[10,6],[12,40]],3.5,'#fff');}
  if(o.chain){line(arcPts(0,-6,26,Math.PI*.1,Math.PI*.9,10,1.5),4.5,'#ffd23f');ell(0,40,8,8,'#ffd23f',2.5);}}
function mouthP(m,my,talk,o,k=1){
  if(m==='yell'){ell(0,my,(15+talk*5)*k,(11+talk*9)*k,'#5a0f1f',3.5);ell(0,my+8*k+talk*3,9*k,5*k,'#ff7a90',0);if(o.teeth)rr(-10*k,my-12*k,20*k,7*k,2,'#fff',0);}
  else if(m==='o'||m==='panic')ell(0,my,8*k,9*k,'#5a0f1f',3);
  else if(m==='smile'||m==='happy')line(arcPts(0,my-13*k,19*k,Math.PI*.2,Math.PI*.8,6),4.5);
  else if(m==='grin'){ell(0,my-2*k,19*k,12*k,'#5a0f1f',3.5);rr(-15*k,my-13*k,30*k,8*k,3,'#fff',0);if(o.gold)rr(5*k,my-13*k,8*k,8*k,2,'#ffd23f',1.5);}
  else if(m==='sleep')ell(6*k,my,7*k,8*k,'#5a0f1f',3);
  else if(m==='angry'){line([[-12*k,my+1],[-4*k,my-2],[4*k,my+2],[12*k,my-1]],4.5);if(o.teeth)rr(-9*k,my-5*k,18*k,8*k,2,'#fff',2);}
  else if(m==='frown'||m==='worry')line(arcPts(0,my+13*k,17*k,Math.PI*1.2,Math.PI*1.8,6),4.5);
  else{line([[-10*k,my],[10*k,my]],4.5);if(o.teeth==='buck'){rr(-7*k,my,14*k,12*k,3,'#fff',2.5);}}}

/* ── DIBUJO ANTIGUO 1930: cuerpo de pera, brazos de fideo con guantes, ojos de pastel, todo rebota al ritmo ── */
CHAR.hose=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=mix(o.skin||'#e8b48a','#f3e6cc',.5),sh=o.shirt||'#e8553d',hw=(o.hw||40)+3,hh=(o.hh||42)+1,bw=o.bw||54,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,es=o.eyeS||17;
  const ph=now*7+(o.x||0)*.07,bn=Math.sin(ph)*.04;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s*(1-bn*.5),s*(o.sy||1)*(1+bn));
  const noodle=(x1,y1,x2,y2,w,amp,k)=>{const p=[],n=9,dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;for(let i=0;i<=n;i++){const t=i/n,wv=Math.sin(t*Math.PI*1.7+ph*.9+k)*amp*Math.sin(t*Math.PI);p.push([x1+dx*t+nx*wv,y1+dy*t+ny*wv]);}line(p,w,INK);};
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){noodle(sg*14,96,sg*26,96+len,12,5,sg);ell(sg*28,100+len+4,17,9,'#f6ecd6',3);ell(sg*34,100+len+10,28,13,sg<0?'#1a1410':'#1a1410',3.5);}}
  rr(-bw*.92,-10,bw*1.84,Math.min(o.th||170,160),bw*.95,sh,5);
  torsoPat(o,bw*.92,sk,sh);
  if((o.th||170)>90){ell(-10,50,5,5,INK,0);ell(10,50,5,5,INK,0);}
  poly([[-16,-6],[0,4],[-16,16]],'#c4283a',3);poly([[16,-6],[0,4],[16,16]],'#c4283a',3);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.78,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);
    noodle(sx,4,ex,ey,12,7,a.side*2);ell(ex,ey,15,14,'#fffdf4',3.5);for(let i=-1;i<=1;i++)ell(ex+i*8,ey-11,5,6,'#fffdf4',2.5);if(a.hand)a.hand(ex,ey,a.a);}
  hairBackP(o,hw,hh);
  ell(-hw+2,HY-4,9,11,sk,3.5);ell(hw-2,HY-4,9,11,sk,3.5);
  ell(0,HY,hw,hh,sk,5);ell(0,HY+17,hw*.62,hh*.42,mix(sk,'#ffffff',.45),0);
  ell(0,HY+6,10,8,INK,0);ell(-3,HY+3,3,2,'#fffdf4',0);
  const blink=Math.sin(now*1.9+(o.x||0))>.985;
  for(const sg of[-1,1]){const cx=sg*es,cy=HY-12;
    if(blink||m==='sleep'){line([[cx-10,cy],[cx,cy+4],[cx+10,cy]],4);}
    else if(m==='happy'){line(arcPts(cx,cy+5,9,Math.PI*1.1,Math.PI*1.9,6),4.5);}
    else if(m==='dizzy'){line([[cx-7,cy-7],[cx+7,cy+7]],4);line([[cx+7,cy-7],[cx-7,cy+7]],4);}
    else{const big=(m==='yell'||m==='panic')?1.15:1;ell(cx,cy,11*big,13*big,INK,0);const wx=look*3;poly([[cx+wx,cy],[cx+wx+9*big,cy-10*big],[cx+wx+9*big,cy+2*big]],'#fffdf4',0);}}
  if(m==='angry'||m==='yell'){line([[-es-12,HY-30],[-es+8,HY-22]],5.5);line([[es+12,HY-30],[es-8,HY-22]],5.5);}
  mouthP(m,HY+hh*.62,talk,o,1.1);
  hairFrontP(o,hw,hh);accP(o,hw,hh,es,HY-8,HY+hh*.62);
  if(o.cheeks)ell(0,0,0,0,'#fff',0);
  ctx.restore();};

/* ── PLASTILINA: bolitas y salchichas de plastilina, sin contorno, grumos, stop-motion a 8 fps ── */
CHAR.clay=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=o.skin||'#e8b48a',sh=o.shirt||'#e8553d',hw=(o.hw||40)+2,hh=(o.hh||42)+2,bw=o.bw||54,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,es=o.eyeS||17;
  const sq=Math.sin(now*5+(o.x||0)*.05)*.025;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s*(1-sq),s*(o.sy||1)*(1+sq));
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){limb(sg*18,100,sg*24,100+len,26,pc,4);ell(sg*30,100+len+4,28,14,sg<0?sc:(sc2||sc),4);}}
  rr(-bw,-10,bw*2,Math.min(o.th||170,200),bw*.75,sh,4);
  if(o.pat==='stripes'){for(let i=0;i<3;i++)limb(-bw+16,30+i*30,bw-16,30+i*30,10,o.sh2||'#fff',3);}
  else if(o.pat==='floral'){for(let i=0;i<7;i++)ell(-34+(i%4)*24+(i>3?12:0),30+Math.floor(i/4)*36,9,9,o.sh2||'#ffe08a',3);}
  else torsoPat(o,bw,sk,sh);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.8,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,4,ex,ey,(a.w||20)+4,a.col||sh,4);ell(ex,ey,15,14,sk,4);if(a.hand)a.hand(ex,ey,a.a);}
  hairBackP(o,hw,hh);
  ell(-hw+1,HY,10,13,sk,3.5);ell(hw-1,HY,10,13,sk,3.5);
  ell(0,HY,hw,hh,sk,5);
  ell(-hw*.62,HY+15,10,7,mix(sk,'#ff6a7a',.55),0);ell(hw*.62,HY+15,10,7,mix(sk,'#ff6a7a',.55),0);
  ell(0,HY+8,13,11,mix(sk,'#d9604a',.2),3);
  for(const sg of[-1,1]){const cx=sg*es,cy=HY-8;
    if(m==='sleep')limb(cx-8,cy+2,cx+8,cy+2,6,dark(sk,.4),2);
    else if(m==='happy')line(arcPts(cx,cy+5,8,Math.PI*1.1,Math.PI*1.9,6),5,dark(sk,.5));
    else if(m==='dizzy'){limb(cx-7,cy-7,cx+7,cy+7,6,INK,2);limb(cx+7,cy-7,cx-7,cy+7,6,INK,2);}
    else{const big=(m==='yell'||m==='panic')?1.2:1;ell(cx,cy,11*big,12*big,'#fffdf4',3);ell(cx+look*3.5,cy+1,m==='panic'?2.6:4.6,m==='panic'?2.6:5,INK,0);ell(cx+look*3.5-1.5,cy-1.5,1.7,1.7,'#fff',0);}}
  const hc=o.hairCol||'#2a1a14',ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  for(const sg of[-1,1])limb(sg*(es+11),HY-26-ang*5,sg*(es-9),HY-26+ang*5,8,hc,3);
  mouthP(m,HY+hh*.6,talk,o,1);
  hairFrontP(o,hw,hh);accP(o,hw,hh,es,HY-8,HY+hh*.6);
  ctx.restore();};

/* ── ANIME 90s: cuerpo esbelto, mentón en punta, ojos enormes con brillos, líneas de impacto ── */
CHAR.anime=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=o.skin||'#e8b48a',sh=o.shirt||'#e8553d',hw=(o.hw||40)-3,hh=(o.hh||42)+2,bw=(o.bw||54)-4,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,es=o.eyeS||16;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s,s*(o.sy||1));
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){limb(sg*14,100,sg*18,100+len,17,pc,3.5);poly([[sg*18-16,100+len-4],[sg*18+16,100+len-4],[sg*18+22,100+len+10],[sg*18-22,100+len+10]],sg<0?sc:(sc2||sc),3);}}
  poly([[-bw,-6],[-bw+8,-14],[bw-8,-14],[bw,-6],[bw*.78,Math.min(o.th||170,170)],[-bw*.78,Math.min(o.th||170,170)]],sh,3.5);
  torsoPat(o,bw,sk,sh);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.8,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,4,ex,ey,(a.w||20)-5,a.col||sh,3);ell(ex,ey,10,10,sk,3);if(a.hand)a.hand(ex,ey,a.a);}
  rr(-10,-30,20,34,5,dark(sk,.18),3);
  hairBackP(o,hw,hh);
  const head=[];for(let i=0;i<=10;i++){const t=Math.PI+i/10*Math.PI;head.push([Math.cos(t)*hw,HY+Math.sin(t)*hh*.95]);}
  head.push([hw*.92,HY+hh*.3],[hw*.5,HY+hh*.8],[0,HY+hh*1.1],[-hw*.5,HY+hh*.8],[-hw*.92,HY+hh*.3]);
  poly(head,sk,4);
  ell(-hw-1,HY+2,6,9,sk,2.5);ell(hw+1,HY+2,6,9,sk,2.5);
  const ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  for(const sg of[-1,1]){const cx=sg*es,cy=HY+2;
    if(m==='sleep'){line([[cx-9,cy],[cx,cy+5],[cx+9,cy]],3.5);continue;}
    if(m==='happy'){line(arcPts(cx,cy+5,10,Math.PI*1.1,Math.PI*1.9,6),4);continue;}
    if(m==='dizzy'){line([[cx-7,cy-7],[cx+7,cy+7]],4);line([[cx+7,cy-7],[cx-7,cy+7]],4);continue;}
    const rage=m==='yell',big=(m==='panic')?1.1:1;
    ell(cx,cy,10.5*big,15*big,'#ffffff',2.8);
    if(!rage){const ic=o.iris&&o.iris!==INK?o.iris:(sg<0?'#5a2d1a':'#5a2d1a');ell(cx+look*3,cy+2,m==='panic'?4:7.5,m==='panic'?5:11,ic,0);ell(cx+look*3,cy+3,m==='panic'?2:3.6,m==='panic'?3:6,'#14101c',0);
      ell(cx+look*3-3,cy-4,3.4,3.8,'#fff',0);ell(cx+look*3+3,cy+7,1.8,1.8,'#fff',0);}
    line(arcPts(cx,cy-1,10.5,Math.PI*1.02,Math.PI*1.98,8,1.4),4.2);}
  for(const sg of[-1,1])line([[sg*(es+12),HY-20-ang*6],[sg*(es-8),HY-20+ang*6]],3);
  line([[2,HY+16],[0,HY+20],[4,HY+21]],2.4,dark(sk,.45));
  if(m==='happy'||o.cheeks){for(const sg of[-1,1])for(let i=0;i<3;i++)line([[sg*(es+4)+i*4-4,HY+16],[sg*(es+4)+i*4,HY+23]],1.8,'#ff6a8a');}
  const my=HY+hh*.62;
  if(m==='yell'){ell(0,my,13+talk*4,10+talk*9,'#5a0f1f',3);rr(-9,my-9,18,6,2,'#fff',0);}
  else mouthP(m,my,talk,o,.8);
  if(m==='panic'||o.sweat)ell(hw-2,HY-hh+22,4.5,8,'#8fdcff',2);
  hairFrontP(o,hw,hh);accP(o,hw,hh,es,HY+2,my);
  if(m==='angry'||m==='yell'||o.vein)accP({vein:1,hairCol:o.hairCol},hw,hh,es,HY,my);
  ctx.restore();};

/* ── 16 BITS: sprite chibi cuadrado, posiciones en cuadrícula, 2 cuadros de animación ── */
CHAR.snes=function(o){
  const sn=v=>Math.round(v/4)*4,s=o.s||1,fl=o.flip?-1:1,sk=o.skin||'#e8b48a',sh=o.shirt||'#e8553d',hw=(o.hw||40)+2,hh=(o.hh||42)-2,bw=o.bw||54,m=o.mood||'calm',look=o.look||0,es=o.eyeS||17;
  const fr=Math.floor(now*6+(o.x||0)*.02)%2,lean=Math.abs(o.rot||0)>.08?sn(Math.sign(o.rot)*14):0,bob=fr?0:-4;
  ctx.save();ctx.translate(sn(o.x),sn(o.y));ctx.scale(fl*s,s*(o.sy||1));
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){rr(sg*16-10,100,20,len,3,pc,3);rr(sg*16-14+(sg>0?2:-2),100+len-6,28,14,3,sg<0?sc:(sc2||sc),3);}}
  ctx.translate(lean*.4,bob);
  rr(-bw*.85,-8,bw*1.7,Math.min(o.th||170,150),6,sh,3.5);
  if(o.pat==='stripes'){for(let i=0;i<3;i++)rr(-bw*.85+4,22+i*28,bw*1.7-8,12,0,o.sh2||'#fff',0);}
  else torsoPat(o,bw*.85,sk,sh);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.85,ex=sn(sx+a.len*Math.sin(a.a)),ey=sn(4+a.len*Math.cos(a.a));limb(sx,4,ex,ey,16,a.col||sh,3);rr(ex-9,ey-9,18,18,3,sk,3);if(a.hand)a.hand(ex,ey,a.a);}
  ctx.translate(lean*.6,0);
  hairBackP(o,hw,hh);
  rr(-hw,HY-hh,hw*2,hh*2,10,sk,4);
  rr(-hw*.6,HY+14,10,6,0,mix(sk,'#ff6a7a',.55),0);rr(hw*.6-10,HY+14,10,6,0,mix(sk,'#ff6a7a',.55),0);
  rr(-5,HY+6,10,8,0,mix(sk,'#d9604a',.3),0);
  for(const sg of[-1,1]){const cx=sn(sg*es)-5,cy=HY-8;
    if(m==='sleep'||m==='happy'){rr(cx-3,cy+6,16,4,0,INK,0);}
    else if(m==='dizzy'){rr(cx,cy,10,4,0,INK,0);rr(cx+3,cy-3,4,10,0,INK,0);}
    else{rr(cx-2,cy-2,14,16,0,'#fffdf4',2.5);rr(cx+(look>.3?4:look<-.3?0:2),cy+2,8,12,0,INK,0);rr(cx+(look>.3?7:look<-.3?3:5),cy+3,3,3,0,'#fff',0);}}
  if(m==='angry'||m==='yell'){rr(-es-14,HY-26,20,5,0,INK,0);rr(es-6,HY-26,20,5,0,INK,0);}
  const my=HY+hh*.55;
  if(m==='yell'||m==='o'||m==='panic')rr(-10,my-4,20,14,0,'#5a0f1f',3);
  else if(m==='grin'){rr(-14,my-6,28,12,0,'#5a0f1f',3);rr(-12,my-6,24,4,0,'#fff',0);}
  else if(m==='smile'||m==='happy'){rr(-12,my,24,4,0,INK,0);rr(-16,my-4,4,4,0,INK,0);rr(12,my-4,4,4,0,INK,0);}
  else rr(-9,my,18,4,0,INK,0);
  hairFrontP(o,hw,hh);accP(o,hw,hh,es,HY-6,my);
  ctx.restore();};


/* ── CARICATURA 90s: cabezón, cuerpo mini, palitos con guantes, poses sostenidas que revientan al ritmo ── */
CHAR.toon=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=o.skin||'#e8b48a',sh=o.shirt||'#e8553d',hw=(o.hw||40)+9,hh=(o.hh||42)+7,bw=(o.bw||54)*.8,m=o.mood||'calm',look=o.look||0,talk=o.talk||0;
  const beat=Math.floor(now*4.2+(o.x||0)*.011)%2,sq=beat?1.05:.955,shk=(m==='yell'||m==='panic')?(Math.floor(now*14)%2?2.5:-2.5):0;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s/sq,s*(o.sy||1)*sq);
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){line([[sg*14,96],[sg*17,100+len]],10,INK);ell(sg*25,100+len+7,26,13,sg<0?sc:(sc2||sc),4.5);}}
  rr(-bw,-8,bw*2,Math.min(o.th||170,124),bw*.85,sh,5);
  torsoPat(o,bw,sk,sh);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.9,ex=sx+a.len*.9*Math.sin(a.a),ey=4+a.len*.9*Math.cos(a.a);line([[sx,4],[ex,ey]],10,INK);ell(ex,ey,15,14,sk,4.5);if(a.hand)a.hand(ex,ey,a.a);}
  ctx.translate(shk,-8);
  hairBackP(o,hw,hh);
  if(Math.abs(o.rot||0)>.14){ctx.save();ctx.globalAlpha=.32;ell(-Math.sign(o.rot)*16,HY,hw,hh,sk,0);ctx.restore();}
  ell(0,HY,hw,hh,sk,6);
  ell(-hw*.62,HY+16,10,9,mix(sk,'#ff5a7a',.6),0);ell(hw*.62,HY+16,10,9,mix(sk,'#ff5a7a',.6),0);
  const ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  for(const sg of[-1,1]){const cx=sg*13,cy=HY-6;
    if(m==='sleep'){line([[cx-11,cy+2],[cx,cy+7],[cx+11,cy+2]],5);continue;}
    if(m==='happy'){line(arcPts(cx,cy+7,11,Math.PI*1.1,Math.PI*1.9,6),5);continue;}
    if(m==='dizzy'){line([[cx-8,cy-8],[cx+8,cy+8]],5);line([[cx+8,cy-8],[cx-8,cy+8]],5);continue;}
    const big=(m==='yell'||m==='panic')?1.12:1;ell(cx,cy,15*big,17*big,'#ffffff',4.5);ell(cx+look*5,cy+(o.down?4:1),m==='panic'?2.6:4.8,m==='panic'?2.6:5.6,INK,0);}
  if(m!=='sleep'&&m!=='happy'&&m!=='dizzy'){for(const sg of[-1,1])limb(sg*27,HY-30-ang*6,sg*5,HY-26+ang*8,9,INK,0);}
  ell(0,HY+13,4.5,3.5,dark(sk,.35),2);
  mouthP(m,HY+hh*.62,talk,o,1.1);
  hairFrontP(o,hw,hh);accP(o,hw,hh,13,HY-6,HY+hh*.62);
  ctx.restore();};

/* ── ROTULISMO: caricatura de camión pintada con aerógrafo: torso de V, brazos de bíceps, ojos de almendra con brillo ── */
CHAR.rotu=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=o.skin||'#e8b48a',sh=o.shirt||'#e8553d',hw=o.hw||40,hh=(o.hh||42)+2,bw=(o.bw||54)*1.12,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,es=o.eyeS||17;
  const gl=Math.sin(now*3+(o.x||0)*.03)*.02,hc=o.hairCol||'#2a1a14',TH=Math.min(o.th||170,150);
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s*(1+gl),s*(o.sy||1)*(1-gl));
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){limb(sg*18,100,sg*22,100+len,28,pc,4.5);rr(sg*22-20,100+len-6,40,20,7,sg<0?sc:(sc2||sc),4.5);}}
  poly([[-bw,-8],[bw,-8],[bw*.66,TH],[-bw*.66,TH]],sh,5);
  torsoPat(o,bw*.85,sk,sh);
  if((o.th||170)>90){line(arcPts(-bw*.4,30,bw*.38,Math.PI*.15,Math.PI*.9,6),3,dark(sh,.4));line(arcPts(bw*.4,30,bw*.38,Math.PI*.1,Math.PI*.85,6),3,dark(sh,.4));}
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.9,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,4,ex,ey,(a.w||20)+10,a.col||sh,4.5);ell(sx+(ex-sx)*.45,4+(ey-4)*.45,15,15,a.col||sh,0);ell(ex,ey,17,16,sk,4.5);if(a.hand)a.hand(ex,ey,a.a);}
  rr(-17,-32,34,38,7,dark(sk,.15),4);
  hairBackP(o,hw,hh);
  ell(-hw+1,HY+2,9,12,sk,4);ell(hw-1,HY+2,9,12,sk,4);
  ell(0,HY,hw,hh,sk,5.5);ell(0,HY+hh*.5,hw*.74,hh*.52,sk,0);
  if(o.cheeks||m==='happy'){ell(-hw*.6,HY+14,10,7,'#ff7a8a',0);ell(hw*.6,HY+14,10,7,'#ff7a8a',0);}
  const ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  for(const sg of[-1,1]){const cx=sg*es,cy=HY-6;
    if(m==='sleep'){line([[cx-11,cy],[cx,cy+6],[cx+11,cy]],4.5);continue;}
    if(m==='happy'){line(arcPts(cx,cy+6,11,Math.PI*1.1,Math.PI*1.9,6),5);continue;}
    if(m==='dizzy'){line([[cx-8,cy-8],[cx+8,cy+8]],4.5);line([[cx+8,cy-8],[cx-8,cy+8]],4.5);continue;}
    const big=(m==='yell'||m==='panic')?1.2:1;poly([[cx-14*big,cy+1],[cx,cy-11*big],[cx+14*big,cy+1],[cx,cy+9*big]],'#ffffff',3.5);
    ell(cx+look*4,cy,6.5*big,7.5*big,o.iris||'#3a1f10',0);ell(cx+look*4,cy,3.2*big,3.8*big,INK,0);ell(cx+look*4-2.5,cy-3,2.6,2.6,'#fff',0);
    line([[cx-15*big,cy+1],[cx,cy-11*big],[cx+15*big,cy+1]],4.5);}
  for(const sg of[-1,1])limb(sg*(es+13),HY-27-ang*6,sg*(es-9),HY-24+ang*9,10,hc,2.5);
  ell(0,HY+9,12,10,mix(sk,'#d9604a',.25),3.5);ell(-3.5,HY+5,4,3,'#ffffff',0);
  mouthP(m,HY+hh*.6,talk,o,1.15);
  hairFrontP(o,hw,hh);accP(o,hw,hh,es,HY-6,HY+hh*.6);
  if(m==='happy'||m==='grin'){poly([[hw+8,HY-hh+4],[hw+11,HY-hh-4],[hw+14,HY-hh+4],[hw+22,HY-hh+7],[hw+14,HY-hh+10],[hw+11,HY-hh+18],[hw+8,HY-hh+10],[hw,HY-hh+7]],'#fffbe0',2);}
  ctx.restore();};

/* ── LOTERÍA: figura de carta, frontal y seria, ojos pequeños, cejas gruesas, nariz larga, rubor rojo ── */
CHAR.lote=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=o.skin||'#e8b48a',sh=o.shirt||'#e8553d',hw=(o.hw||40)*.95,hh=(o.hh||42)+3,bw=o.bw||54,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,es=o.eyeS||15;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s,s*(o.sy||1));
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){rr(sg*18-11,100,22,len,5,pc,3.5);poly([[sg*18-15,100+len-2],[sg*18+17,100+len-2],[sg*18+22,100+len+12],[sg*18-20,100+len+12]],sg<0?sc:(sc2||sc),3);}}
  poly([[-bw*.82,-8],[bw*.82,-8],[bw*1.02,Math.min(o.th||170,160)],[-bw*1.02,Math.min(o.th||170,160)]],sh,3.5);
  line([[0,0],[0,Math.min(o.th||170,150)]],2.2,dark(sh,.4));
  torsoPat(o,bw*.85,sk,sh);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.82,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,4,ex,ey,(a.w||20)-2,a.col||sh,3.5);ell(ex,ey,11,11,sk,3.5);if(a.hand)a.hand(ex,ey,a.a);}
  rr(-12,-30,24,34,5,dark(sk,.18),3);
  hairBackP(o,hw,hh);
  ell(-hw-1,HY+2,7,10,sk,3);ell(hw+1,HY+2,7,10,sk,3);
  ell(0,HY,hw,hh,sk,3.8);
  ell(-hw*.55,HY+12,9,6,'#e8705a',0);ell(hw*.55,HY+12,9,6,'#e8705a',0);
  const ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  for(const sg of[-1,1]){const cx=sg*es,cy=HY-4;
    if(m==='sleep'||m==='happy'){line([[cx-8,cy+1],[cx,cy+5],[cx+8,cy+1]],3);continue;}
    if(m==='dizzy'){line([[cx-6,cy-6],[cx+6,cy+6]],3);line([[cx+6,cy-6],[cx-6,cy+6]],3);continue;}
    const big=(m==='yell'||m==='panic')?1.35:1;ell(cx,cy,8*big,5.5*big,'#fffdf0',2.5);ell(cx+look*2.5,cy,3.4*big,3.4*big,INK,0);}
  for(const sg of[-1,1])limb(sg*(es+11),HY-19-ang*5,sg*(es-8),HY-17+ang*6,7,o.hairCol||'#2a1a14',2);
  line([[0,HY-8],[-3,HY+12],[5,HY+13]],2.8,INK);
  mouthP(m,HY+hh*.6,talk,o,.75);
  hairFrontP(o,hw,hh);accP(o,hw,hh,es,HY-4,HY+hh*.6);
  ctx.restore();};

/* ── FIELTRO / ARPILLERA: piezas de fieltro cosidas, ojos de botón, puntadas, pelo de lana ── */
CHAR.felt=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=o.skin||'#e8b48a',sh=o.shirt||'#e8553d',hw=(o.hw||40)+3,hh=(o.hh||42)+3,bw=o.bw||54,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,es=o.eyeS||17;
  const sq=Math.sin(now*4+(o.x||0)*.05)*.02;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s*(1-sq),s*(o.sy||1)*(1+sq));
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){limb(sg*18,100,sg*24,100+len,26,pc,4);ell(sg*30,100+len+4,27,13,sg<0?sc:(sc2||sc),4);}}
  rr(-bw,-10,bw*2,Math.min(o.th||170,190),bw*.65,sh,4.5);
  if(o.pat==='stripes'){for(let i=0;i<3;i++)rr(-bw+10,28+i*30,bw*2-20,12,6,o.sh2||'#fff',3);}
  else torsoPat(o,bw,sk,sh);
  if((o.th||170)>90){for(let i=0;i<2;i++){ell(0,34+i*26,7,7,'#ffd23f',3);ell(-2,32+i*26,1.3,1.3,INK,0);ell(2,36+i*26,1.3,1.3,INK,0);}}
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.8,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,4,ex,ey,(a.w||20)+2,a.col||sh,4);ell(ex,ey,14,13,sk,4);if(a.hand)a.hand(ex,ey,a.a);}
  hairBackP(o,hw,hh);
  ell(-hw+1,HY,10,12,sk,3.5);ell(hw-1,HY,10,12,sk,3.5);
  ell(0,HY,hw,hh,sk,4.5);
  ell(-hw*.62,HY+15,10,7,mix(sk,'#ff6a7a',.6),0);ell(hw*.62,HY+15,10,7,mix(sk,'#ff6a7a',.6),0);
  const ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  for(const sg of[-1,1]){const cx=sg*es,cy=HY-6;
    if(m==='sleep'||m==='dizzy'||m==='happy'){line([[cx-8,cy-8],[cx+8,cy+8]],3.5);line([[cx+8,cy-8],[cx-8,cy+8]],3.5);continue;}
    const big=(m==='yell'||m==='panic')?1.15:1;ell(cx,cy,13*big,13*big,'#fffdf4',3);ell(cx+look*2.5,cy,9.5*big,9.5*big,'#6b4226',2.5);ell(cx+look*2.5,cy,6.5*big,6.5*big,'#8a5a34',0);
    for(const[hx,hy]of[[-2.2,-2.2],[2.2,-2.2],[-2.2,2.2],[2.2,2.2]])ell(cx+look*2.5+hx,cy+hy,1.3,1.3,INK,0);}
  for(const sg of[-1,1])limb(sg*(es+11),HY-26-ang*6,sg*(es-9),HY-24+ang*7,8,o.hairCol||'#4a2f22',2.5);
  ell(0,HY+9,9,8,'#ff6a7a',3);
  mouthP(m,HY+hh*.6,talk,o,1);
  hairFrontP(o,hw,hh);accP(o,hw,hh,es,HY-6,HY+hh*.6);
  ctx.restore();};

CHAR.mola=CHAR.lote;CHAR.cordel=CHAR.lote;CHAR.exvoto=CHAR.toon;CHAR.xstitch=CHAR.snes;

/* ── VITRAL: figuras facetadas de polígonos (cubista), cada rasgo es una pieza de vidrio ── */
CHAR.vit=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=o.skin||'#e8b48a',sh=o.shirt||'#e8553d',hw=o.hw||40,hh=(o.hh||42)+2,bw=o.bw||54,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,es=o.eyeS||16;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s,s*(o.sy||1));
  const TH=Math.min(o.th||170,160);
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){poly([[sg*6,100],[sg*30,100],[sg*34,100+len],[sg*10,100+len]],pc,4);poly([[sg*6,100+len],[sg*34,100+len],[sg*44,100+len+12],[sg*4,100+len+12]],sg<0?sc:(sc2||sc),4);}}
  poly([[-bw,-8],[bw,-8],[bw*.8,TH],[-bw*.8,TH]],sh,5);
  poly([[-bw,-8],[0,TH*.55],[-bw*.4,TH]],dark(sh,.12),3.5);poly([[bw,-8],[0,TH*.55],[bw*.4,TH]],mix(sh,'#fff',.18),3.5);
  torsoPat(o,bw,sk,sh);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.85,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a),nx=Math.cos(a.a)*10,ny=-Math.sin(a.a)*10;
    poly([[sx-nx,4-ny],[sx+nx,4+ny],[ex+nx*.7,ey+ny*.7],[ex-nx*.7,ey-ny*.7]],a.col||sh,4);poly([[ex-12,ey-6],[ex+12,ey-6],[ex+10,ey+12],[ex-10,ey+12]],sk,3.5);if(a.hand)a.hand(ex,ey,a.a);}
  poly([[-14,-30],[14,-30],[12,4],[-12,4]],dark(sk,.2),3.5);
  hairBackP(o,hw,hh);
  const head=[[-hw*.62,HY-hh],[hw*.62,HY-hh],[hw,HY-hh*.3],[hw*.82,HY+hh*.7],[0,HY+hh*1.08],[-hw*.82,HY+hh*.7],[-hw,HY-hh*.3]];
  poly(head,sk,5);
  poly([[-hw,HY-hh*.3],[-hw*.3,HY+hh*.1],[-hw*.82,HY+hh*.7]],dark(sk,.1),3);poly([[hw,HY-hh*.3],[hw*.3,HY+hh*.1],[hw*.82,HY+hh*.7]],mix(sk,'#fff',.15),3);
  poly([[-hw*.62,HY-hh],[hw*.62,HY-hh],[hw,HY-hh*.3],[-hw,HY-hh*.3]],mix(sk,'#fff',.1),3);
  const ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  for(const sg of[-1,1]){const cx=sg*es,cy=HY-4;
    if(m==='sleep'||m==='happy'){line([[cx-10,cy],[cx,cy+(m==='happy'?-5:5)],[cx+10,cy]],4);continue;}
    if(m==='dizzy'){line([[cx-7,cy-7],[cx+7,cy+7]],4);line([[cx+7,cy-7],[cx-7,cy+7]],4);continue;}
    const big=(m==='yell'||m==='panic')?1.25:1;poly([[cx-12*big,cy],[cx,cy-9*big],[cx+12*big,cy],[cx,cy+9*big]],'#fffbe8',3);poly([[cx+look*3-5,cy],[cx+look*3,cy-6],[cx+look*3+5,cy],[cx+look*3,cy+6]],'#1a1020',0);}
  for(const sg of[-1,1])poly([[sg*(es+13),HY-20-ang*7],[sg*(es-10),HY-20+ang*8],[sg*(es-10),HY-12+ang*8],[sg*(es+13),HY-12-ang*7]],o.hairCol||'#2a1a14',2.5);
  poly([[-3,HY-6],[5,HY-6],[9,HY+14],[-9,HY+14]],dark(sk,.16),3);
  const my=HY+hh*.6;
  if(m==='yell'||m==='o'||m==='panic')poly([[-14-talk*3,my-6],[14+talk*3,my-6],[10,my+10+talk*8],[-10,my+10+talk*8]],'#5a0f1f',3.5);
  else if(m==='grin')poly([[-18,my-6],[18,my-6],[12,my+8],[-12,my+8]],'#5a0f1f',3.5);
  else if(m==='smile'||m==='happy')poly([[-14,my-4],[14,my-4],[8,my+6],[-8,my+6]],'#7a1a2a',3);
  else poly([[-11,my-1],[11,my-1],[11,my+3],[-11,my+3]],'#4a1020',2.5);
  hairFrontP(o,hw,hh);accP(o,hw,hh,es,HY-4,my);
  ctx.restore();};
CHAR.cromo=CHAR.rotu;CHAR.alma=CHAR.anime;CHAR.vitral=CHAR.vit;CHAR.etiq=CHAR.hose;


/* ── Mii / Wii: cabeza redonda, ojos de punto, ceja corta, nariz mínima, cuerpo de pastilla, sin contorno ── */
CHAR.mii=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=mix(o.skin||'#e8b48a','#ffe0c8',.25),sh=o.shirt||'#e8553d',hw=(o.hw||40)+4,hh=(o.hh||42)+3,bw=o.bw||54,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,hc=o.hairCol||'#2a1a14';
  const bob=Math.sin(now*3+(o.x||0)*.04)*1.5;
  ctx.save();ctx.translate(o.x,o.y+bob);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s,s*(o.sy||1));
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){limb(sg*16,100,sg*18,100+len,24,pc,0);ell(sg*22,100+len+6,22,11,sg<0?sc:(sc2||sc),0);}}
  rr(-bw*.85,-10,bw*1.7,Math.min(o.th||170,150),bw*.8,sh,0);
  torsoPat(o,bw*.85,sk,sh);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.8,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,4,ex,ey,(a.w||20)-1,a.col||sh,0);ell(ex,ey,12,12,sk,0);if(a.hand)a.hand(ex,ey,a.a);}
  hairBackP(o,hw,hh);
  ell(-hw+1,HY+4,8,10,sk,0);ell(hw-1,HY+4,8,10,sk,0);
  ell(0,HY,hw,hh,sk,0);
  const ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  for(const sg of[-1,1]){const cx=sg*14,cy=HY-2;
    if(m==='sleep'||m==='happy'){line([[cx-6,cy+(m==='happy'?2:-1)],[cx,cy+(m==='happy'?-3:2)],[cx+6,cy+(m==='happy'?2:-1)]],3.5);continue;}
    if(m==='dizzy'){line([[cx-5,cy-5],[cx+5,cy+5]],3.5);line([[cx+5,cy-5],[cx-5,cy+5]],3.5);continue;}
    const big=(m==='yell'||m==='panic')?1.25:1;ell(cx+look*2,cy,4.6*big,6.6*big,'#1a1418',0);ell(cx+look*2-1.3,cy-2,1.6,1.9,'#fff',0);}
  if(m!=='sleep'&&m!=='happy')for(const sg of[-1,1])line([[sg*(24),HY-14-ang*4],[sg*6,HY-14+ang*5]],4,hc);
  line([[0,HY+2],[2,HY+9],[-1,HY+10]],2.6,dark(sk,.28));
  const my=HY+hh*.58;
  if(m==='yell'||m==='o'||m==='panic')ell(0,my,9+talk*3,8+talk*7,'#7a1a2a',0);
  else if(m==='grin'){ell(0,my-1,13,9,'#7a1a2a',0);rr(-10,my-8,20,5,2,'#fff',0);}
  else if(m==='smile'||m==='happy')line(arcPts(0,my-9,14,Math.PI*.2,Math.PI*.8,6),3.8,'#7a1a2a');
  else if(m==='angry')line([[-9,my+1],[9,my-1]],3.8,'#7a1a2a');
  else line([[-7,my],[7,my]],3.6,'#7a1a2a');
  ell(-hw*.55,HY+12,9,5.5,mix(sk,'#ff7a8a',.45),0);ell(hw*.55,HY+12,9,5.5,mix(sk,'#ff7a8a',.45),0);
  hairFrontP(o,hw,hh);accP(o,hw,hh,14,HY-2,my);
  ctx.restore();};
CHAR.gb=CHAR.snes;CHAR.ps1=CHAR.vit;CHAR.gw=CHAR.toon;CHAR.wii=CHAR.mii;


/* ── PIXAR / CGI: cabezota, ojos enormes con brillos, nariz suave, cuerpo regordete que respira ── */
CHAR.pixar=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=mix(o.skin||'#e8b48a','#ffe0c8',.12),sh=o.shirt||'#e8553d',hw=(o.hw||40)+5,hh=(o.hh||42)+5,bw=(o.bw||54)*.95,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,hc=o.hairCol||'#2a1a14';
  const br=Math.sin(now*2.6+(o.x||0)*.04)*.018;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s*(1-br),s*(o.sy||1)*(1+br));
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){limb(sg*18,100,sg*22,100+len,28,pc,4);ell(sg*26,100+len+6,27,14,sg<0?sc:(sc2||sc),4);}}
  rr(-bw,-10,bw*2,Math.min(o.th||170,170),bw*.85,sh,4);torsoPat(o,bw,sk,sh);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.82,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,4,ex,ey,(a.w||20)+5,a.col||sh,4);ell(ex,ey,14,13,sk,4);if(a.hand)a.hand(ex,ey,a.a);}
  hairBackP(o,hw,hh);
  ell(-hw+1,HY+3,9,12,sk,3);ell(hw-1,HY+3,9,12,sk,3);
  ell(0,HY,hw,hh,sk,5);
  ell(-hw*.6,HY+17,12,9,mix(sk,'#ff7a7a',.4),0);ell(hw*.6,HY+17,12,9,mix(sk,'#ff7a7a',.4),0);
  ell(0,HY+10,10,8,mix(sk,'#e08a70',.25),3);
  const blink=Math.sin(now*1.7+(o.x||0)*.1)>.985,ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  for(const sg of[-1,1]){const cx=sg*18,cy=HY-6;
    if(blink||m==='sleep'){line([[cx-12,cy+1],[cx,cy+6],[cx+12,cy+1]],3.6,dark(sk,.5));continue;}
    if(m==='happy'){line(arcPts(cx,cy+6,12,Math.PI*1.1,Math.PI*1.9,6),4.2,dark(sk,.5));continue;}
    if(m==='dizzy'){line([[cx-8,cy-8],[cx+8,cy+8]],4);line([[cx+8,cy-8],[cx-8,cy+8]],4);continue;}
    const big=(m==='yell'||m==='panic')?1.15:1;ell(cx,cy,14*big,16*big,'#fffefa',3);
    const ic=o.iris&&o.iris!==INK?o.iris:'#5a3a22',px=cx+look*4;ell(px,cy+1,(m==='panic'?5.5:9)*big,(m==='panic'?6:10)*big,ic,0);ell(px,cy+1,(m==='panic'?2.6:4.6)*big,(m==='panic'?3:5.2)*big,INK,0);
    ell(px-3.4,cy-4,3.4,3.4,'#fff',0);ell(px+3.6,cy+4.5,1.8,1.8,'#fff',0);
    line(arcPts(cx,cy-3,14*big,Math.PI*1.04,Math.PI*1.96,8,1.1),3.4,dark(sk,.55));}
  if(m!=='sleep'&&m!=='happy')for(const sg of[-1,1])limb(sg*(18+13),HY-28-ang*6,sg*(18-9),HY-26+ang*8,7.5,hc,2);
  mouthP(m,HY+hh*.6,talk,o,1.05);
  hairFrontP(o,hw,hh);accP(o,hw,hh,18,HY-6,HY+hh*.6);
  ctx.restore();};

/* ── ANIMAL CROSSING: bolita redonda, ojitos de punto muy separados, carrillos, boca mínima, manitas cortas ── */
CHAR.acnh=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=mix(o.skin||'#e8b48a','#ffe9d6',.3),sh=o.shirt||'#e8553d',hw=(o.hw||40)+8,hh=(o.hh||42)+2,bw=o.bw||54,m=o.mood||'calm',look=o.look||0,talk=o.talk||0;
  const sq=Math.sin(now*4+(o.x||0)*.05)*.03;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s*(1-sq),s*(o.sy||1)*(1+sq));
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){limb(sg*16,100,sg*18,100+len,22,pc,3);ell(sg*22,100+len+6,22,12,sg<0?sc:(sc2||sc),3);}}
  ell(0,40,bw*1.02,Math.min(o.th||170,170)*.46,sh,3);
  if(o.pat==='stripes'){for(let i=0;i<3;i++)limb(-bw*.6,20+i*26,bw*.6,20+i*26,9,o.sh2||'#fff',0);}else torsoPat(o,bw*.8,sk,sh);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.9,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,8,ex,ey,(a.w||20)-2,a.col||sh,3);ell(ex,ey,11,11,sk,3);if(a.hand)a.hand(ex,ey,a.a);}
  hairBackP(o,hw,hh);
  ell(0,HY,hw,hh,sk,3);
  for(const sg of[-1,1]){const cx=sg*20,cy=HY-2;
    if(m==='sleep'||m==='happy'){line(arcPts(cx,cy+3,6,Math.PI*1.1,Math.PI*1.9,5),3.2);continue;}
    if(m==='dizzy'){line([[cx-5,cy-5],[cx+5,cy+5]],3);line([[cx+5,cy-5],[cx-5,cy+5]],3);continue;}
    const big=(m==='yell'||m==='panic')?1.3:1;ell(cx+look*2,cy,4.6*big,5.6*big,'#1a1418',0);ell(cx+look*2-1.4,cy-2,1.6,1.7,'#fff',0);}
  ell(-hw*.7,HY+12,10,6.5,'#ff9aa8',0);ell(hw*.7,HY+12,10,6.5,'#ff9aa8',0);
  ell(0,HY+7,5,4,dark(sk,.22),0);
  const my=HY+hh*.5;
  if(m==='yell'||m==='o'||m==='panic')ell(0,my,7+talk*3,7+talk*6,'#7a2a3a',0);
  else if(m==='grin'){ell(0,my-1,11,8,'#7a2a3a',0);}
  else if(m==='smile'||m==='happy')line(arcPts(0,my-7,10,Math.PI*.2,Math.PI*.8,5),3.2,'#7a2a3a');
  else if(m==='angry')line([[-7,my+1],[7,my-1]],3.2,'#7a2a3a');
  else line([[-5,my],[5,my]],3,'#7a2a3a');
  hairFrontP(o,hw,hh);accP(o,hw,hh,20,HY-2,my);
  ctx.restore();};

/* ── WIND WAKER: cel-shading de Nintendo: ojos grandes con iris y brillo, cejas finas, cabeza grande ── */
CHAR.ww=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=o.skin||'#e8b48a',sh=o.shirt||'#e8553d',hw=(o.hw||40)+4,hh=(o.hh||42)+3,bw=o.bw||54,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,hc=o.hairCol||'#2a1a14';
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s,s*(o.sy||1));
  const TH=Math.min(o.th||170,160);
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){limb(sg*16,100,sg*20,100+len,20,pc,3);rr(sg*22-16,100+len-4,34,18,8,sg<0?sc:(sc2||sc),3);}}
  poly([[-bw*.78,-8],[bw*.78,-8],[bw*1.0,TH],[-bw*1.0,TH]],sh,3.5);
  line([[-bw*.9,TH*.55],[bw*.9,TH*.55]],7,dark(sh,.45));rr(-9,TH*.55-8,18,16,3,'#ffd23f',2.5);
  torsoPat(o,bw*.85,sk,sh);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.8,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,4,ex,ey,(a.w||20)-3,a.col||sh,3);ell(ex,ey,11,11,sk,3);if(a.hand)a.hand(ex,ey,a.a);}
  rr(-11,-28,22,32,5,dark(sk,.18),3);
  hairBackP(o,hw,hh);
  ell(-hw-1,HY+4,7,10,sk,3);ell(hw+1,HY+4,7,10,sk,3);
  ell(0,HY,hw,hh,sk,3.5);
  const ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  for(const sg of[-1,1]){const cx=sg*17,cy=HY-2;
    if(m==='sleep'||m==='happy'){line(arcPts(cx,cy+4,9,Math.PI*1.1,Math.PI*1.9,6),3.6);continue;}
    if(m==='dizzy'){line([[cx-6,cy-6],[cx+6,cy+6]],3.6);line([[cx+6,cy-6],[cx-6,cy+6]],3.6);continue;}
    const big=(m==='yell'||m==='panic')?1.15:1;ell(cx,cy,10.5*big,14*big,'#ffffff',2.8);
    const ic=o.iris&&o.iris!==INK?o.iris:'#3a62c0';ell(cx+look*3,cy+1,7*big,11*big,ic,0);ell(cx+look*3,cy+1,3.4*big,6.4*big,'#14101c',0);ell(cx+look*3-2.6,cy-3,2.8,3.6,'#fff',0);}
  for(const sg of[-1,1])line([[sg*(17+10),HY-19-ang*5],[sg*(17-9),HY-18+ang*6]],2.8,hc);
  ell(0,HY+9,4,3,dark(sk,.25),0);
  mouthP(m,HY+hh*.58,talk,o,.85);
  hairFrontP(o,hw,hh);accP(o,hw,hh,17,HY-2,HY+hh*.58);
  ctx.restore();};

/* ── GHIBLI: cara redonda, ojitos de punto, nariz de puntito, mejillas rosadas, contorno color café ── */
CHAR.ghibli=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=mix(o.skin||'#e8b48a','#ffe6cc',.18),sh=o.shirt||'#e8553d',hw=(o.hw||40)+1,hh=(o.hh||42)+2,bw=(o.bw||54)*.9,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,hc=o.hairCol||'#3a2a20';
  const sw=Math.sin(now*1.6+(o.x||0)*.03)*.012;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot+sw);else ctx.rotate(sw);ctx.scale(fl*s,s*(o.sy||1));
  const TH=Math.min(o.th||170,165);
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){limb(sg*15,100,sg*17,100+len,19,pc,2.5);ell(sg*20,100+len+5,19,9,sg<0?sc:(sc2||sc),2.5);}}
  poly([[-bw*.8,-8],[bw*.8,-8],[bw*.95,TH],[-bw*.95,TH]],sh,2.8);
  torsoPat(o,bw*.85,sk,sh);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.78,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,4,ex,ey,(a.w||20)-4,a.col||sh,2.5);ell(ex,ey,9.5,9.5,sk,2.5);if(a.hand)a.hand(ex,ey,a.a);}
  rr(-10,-28,20,30,5,dark(sk,.14),2.5);
  hairBackP(o,hw,hh);
  ell(-hw-1,HY+3,6,9,sk,2.5);ell(hw+1,HY+3,6,9,sk,2.5);
  ell(0,HY,hw,hh,sk,3);
  ell(-hw*.62,HY+13,10,6,'#ff9a8a',0);ell(hw*.62,HY+13,10,6,'#ff9a8a',0);
  for(const sg of[-1,1]){const cx=sg*15,cy=HY-2;
    if(m==='sleep'||m==='happy'){line(arcPts(cx,cy+3,6,Math.PI*1.1,Math.PI*1.9,5),2.8);continue;}
    if(m==='dizzy'){line([[cx-4,cy-4],[cx+4,cy+4]],2.8);line([[cx+4,cy-4],[cx-4,cy+4]],2.8);continue;}
    const big=(m==='yell'||m==='panic')?1.4:1;ell(cx+look*2,cy,3.8*big,4.6*big,'#1a1418',0);ell(cx+look*2-1.2,cy-1.6,1.3,1.4,'#fff',0);}
  const ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  for(const sg of[-1,1])line([[sg*(15+9),HY-14-ang*4],[sg*(15-8),HY-13+ang*5]],2.2,hc);
  ell(0,HY+7,3.4,2.6,dark(sk,.25),0);
  mouthP(m,HY+hh*.55,talk,o,.7);
  hairFrontP(o,hw,hh);accP(o,hw,hh,15,HY-2,HY+hh*.55);
  ctx.restore();};


/* ── MARIO / plástico: nariz enorme, bigote gigante, ojos altos, guantes blancos, overol y gorra ── */
CHAR.mario=function(o){
  const s=o.s||1,fl=o.flip?-1:1,sk=mix(o.skin||'#e8b48a','#ffd2b0',.22),sh=o.shirt||'#e8553d',hw=(o.hw||40)+4,hh=(o.hh||42)+2,bw=o.bw||54,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,hc=o.hairCol||'#2a1a14',capc=o.cap||'#e8302a',TH=Math.min(o.th||170,170);
  const bn=Math.sin(now*5+(o.x||0)*.05)*.02;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s*(1-bn),s*(o.sy||1)*(1+bn));
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){limb(sg*18,100,sg*22,100+len,30,pc,4);ell(sg*28,100+len+7,31,15,sg<0?sc:(sc2||sc),4);}}
  rr(-bw,-10,bw*2,TH,bw*.8,sh,4.5);
  torsoPat(o,bw,sk,sh);
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.85,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,4,ex,ey,(a.w||20)+6,a.col||sh,4);ell(ex,ey,18,17,'#ffffff',4);line([[ex-6,ey-10],[ex-6,ey-1]],2.4,'#9a9ab0');line([[ex+4,ey-11],[ex+4,ey-2]],2.4,'#9a9ab0');if(a.hand)a.hand(ex,ey,a.a);}
  hairBackP(o,hw,hh);
  ell(-hw+1,HY+4,9,12,sk,3.5);ell(hw-1,HY+4,9,12,sk,3.5);
  ell(0,HY,hw,hh,sk,5);
  const ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  for(const sg of[-1,1]){const cx=sg*12,cy=HY-8;
    if(m==='sleep'||m==='happy'){line(arcPts(cx,cy+6,8,Math.PI*1.1,Math.PI*1.9,5),4.2);continue;}
    if(m==='dizzy'){line([[cx-6,cy-6],[cx+6,cy+6]],4);line([[cx+6,cy-6],[cx-6,cy+6]],4);continue;}
    const big=(m==='yell'||m==='panic')?1.15:1;ell(cx,cy,8.5*big,12.5*big,'#ffffff',3);ell(cx+look*2.5,cy+1,m==='panic'?2.6:4,m==='panic'?3:7,'#2a5ac8',0);ell(cx+look*2.5,cy+1,m==='panic'?1.4:2.4,m==='panic'?1.6:4.2,INK,0);ell(cx+look*2.5-1,cy-3,1.4,1.8,'#fff',0);}
  for(const sg of[-1,1])limb(sg*(12+9),HY-26-ang*5,sg*(12-8),HY-24+ang*6,7,hc,2);
  mouthP(m,HY+hh*.64,talk,o,.9);
  ell(0,HY+12,16,13.5,mix(sk,'#ff8a7a',.3),4.5);ell(-4.5,HY+6.5,4.5,3.4,'#ffffff',0);
  if(o.stache)poly([[-31,HY+20],[-12,HY+13],[0,HY+18],[12,HY+13],[31,HY+20],[25,HY+34],[0,HY+27],[-25,HY+34]],hc,4);
  hairFrontP(o,hw,hh);
  accP(Object.assign({},o,{stache:0}),hw,hh,12,HY-8,HY+hh*.64);
  ctx.restore();};

/* ── FALL GUYS / frijol de gelatina: cápsula de plástico, ojos grandes, bracitos y patitas ── */
CHAR.bean=function(o){
  const s=o.s||1,fl=o.flip?-1:1,col=o.shirt||'#e8553d',sk=o.skin||'#e8b48a',hw=(o.hw||40)+6,hh=(o.hh||42),bw=(o.bw||54)*.95,m=o.mood||'calm',look=o.look||0,talk=o.talk||0,TH=Math.min(o.th||170,170);
  const bn=Math.sin(now*4.5+(o.x||0)*.05)*.04;
  ctx.save();ctx.translate(o.x,o.y);if(o.rot)ctx.rotate(o.rot);ctx.scale(fl*s*(1-bn),s*(o.sy||1)*(1+bn));
  if(o.legs){const[pc,sc,len,sc2]=o.legs;for(const sg of[-1,1]){rr(sg*20-13,96,26,len+4,12,col,3);ell(sg*24,100+len+8,24,12,'#ffffff',3);}}
  rr(-bw,HY-hh-10,bw*2,TH-(HY-hh-10),bw,col,3.5);
  if(o.pat==='stripes'){for(let i=0;i<3;i++)rr(-bw+4,20+i*28,bw*2-8,12,5,o.sh2||'#fff',0);}else if(o.pat){torsoPat(o,bw*.9,sk,col);}
  if(o.arms)for(const a of o.arms){const sx=a.side*bw*.9,ex=sx+a.len*Math.sin(a.a),ey=4+a.len*Math.cos(a.a);limb(sx,6,ex,ey,17,col,3);ell(ex,ey,10,10,col,3);if(a.hand)a.hand(ex,ey,a.a);}
  for(const sg of[-1,1]){const cx=sg*15,cy=HY-2;
    if(m==='sleep'||m==='happy'){line(arcPts(cx,cy+4,10,Math.PI*1.1,Math.PI*1.9,6),4.4);continue;}
    if(m==='dizzy'){line([[cx-7,cy-7],[cx+7,cy+7]],4);line([[cx+7,cy-7],[cx-7,cy+7]],4);continue;}
    const big=(m==='yell'||m==='panic')?1.15:1;ell(cx,cy,13*big,15*big,'#ffffff',3);ell(cx+look*4,cy+1,m==='panic'?3:5.4,m==='panic'?3.2:6.4,'#14101c',0);ell(cx+look*4-2,cy-2.6,2,2.2,'#fff',0);}
  const ang=(m==='angry'||m==='yell')?1:(m==='worry'||m==='panic')?-1:0;
  if(ang)for(const sg of[-1,1])limb(sg*27,HY-22-ang*5,sg*6,HY-19+ang*7,6.5,dark(col,.5),2);
  mouthP(m,HY+hh*.62,talk,o,.9);
  hairFrontP(o,hw*.9,hh);accP(o,hw*.9,hh,15,HY-2,HY+hh*.62);
  ctx.restore();};
CHAR.splat=CHAR.toon;CHAR.candy=CHAR.pixar;CHAR.mario=CHAR.mario;

/* props */
function hen(x,y,s,look){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ell(0,0,36,26,'#f1ece2',4);ell(-6,4,20,14,'#b3552d',3);poly([[30,-6],[48,-18],[44,2]],'#f1ece2',3.5);
  ell(40,-26,15,16,'#f1ece2',4);poly([[34,-42],[40,-52],[46,-42],[50,-52],[53,-38]],'#e8293f',3);poly([[50,-26],[64,-22],[50,-18]],'#ffb300',3);
  ell(43+look*2,-28,5,5.5,'#fff',2);ell(44+look*3,-28,2.4,2.6,INK,0);poly([[34,-12],[46,-12],[40,0]],'#e8293f',3);ctx.restore();}
function goat(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);for(const lx of[-26,-10,12,28])limb(lx,-30,lx,0,9,'#e9e4d8',3);
  ell(0,-44,40,24,'#f4f0e6',4);ell(46,-62,17,15,'#f4f0e6',4);poly([[40,-76],[48,-98],[54,-76]],'#8a7a5a',3);poly([[54,-70],[70,-84],[62,-66]],'#8a7a5a',3);
  poly([[58,-52],[66,-40],[56,-36]],'#f4f0e6',3);ell(50,-64,4,5,'#ffe14d',2);rr(48,-66,5,2,0,INK,0);ell(-38,-48,10,8,'#f4f0e6',3);ctx.restore();}
function dog(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);for(const lx of[-24,-8,12,26])limb(lx,-22,lx,0,8,'#c28a4e',3);
  ell(0,-34,36,18,'#d9a05b',4);ell(40,-48,15,13,'#d9a05b',4);ell(52,-44,8,6,'#7a4a2a',3);ell(36,-62,5,12,'#8a5a30',3);ell(46,-52,3,3.5,INK,0);limb(-34,-40,-48,-56,7,'#d9a05b',3);ctx.restore();}
function baby(x,y,s,mood){bust({x,y,s,skin:'#f0b995',shirt:'#fff3a8',hw:46,hh:46,hr:40,bw:40,th:60,hair:'curly',hairCol:'#3a2a20',mood:mood||'calm',eyeS:19,eyeR:11,nose:'button',cheeks:1,brow:'none',
  over(){ell(0,HY+26,10,10,'#ff4d6d',3);ell(0,HY+26,5,5,'#ffd0d8',0);}});}
function chanclaP(x,y,rot=0,s=1){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);
  ell(0,0,36,15,'#2f7fe0',3.5);ell(-4,-3,28,8,'#6fb0ff',0);line([[-16,5],[4,-7],[18,5]],6.5,'#fff');ell(4,-6,4.5,4.5,'#fff',2);ctx.restore();}
function pole(x,y1,y2){line([[x,y1],[x,y2]],10,'#c4cad6');line([[x-2,y1+4],[x-2,y2-4]],2.5,'#ffffff');}
function hand(x,y,rot=0,s=1,sk='#e8b48a'){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);rr(-11,-8,22,18,7,sk,3);for(let i=0;i<4;i++)rr(-11+i*5.6,-20,6,16,3,sk,2.5);ctx.restore();}

/* ───────── input ───────── */
function press(k){A().resume&&A().resume();if(G)G.press(k);}
addEventListener('keydown',e=>{if(e.repeat)return;
  if(e.code==='ArrowUp'||e.code==='KeyW')press('up');else if(e.code==='ArrowDown'||e.code==='KeyS')press('down');
  else if(e.code==='Space'||e.code==='Enter'){e.preventDefault();press('any');}
  else if(e.code>='Digit1'&&e.code<='Digit9')setStyle(['wii','mario','bean','splat','candy','pixar','acnh','ww','ghibli'][+e.code.slice(5)-1]);});
let pdown=null;
view.addEventListener('pointerdown',e=>{pdown={x:e.clientX,y:e.clientY};});
view.addEventListener('pointerup',e=>{if(!pdown)return;const dy=e.clientY-pdown.y,r=view.getBoundingClientRect();
  if(gameId!=='chancla')press('any');else if(Math.abs(dy)>30)press(dy<0?'up':'down');else press(e.clientY-r.top<r.height/2?'up':'down');pdown=null;});

/* mic: shout to play PARADA */
let micOn=false,an=null,mbuf=null,micStream=null;
async function toggleMic(){const b=document.getElementById('mic');
  if(micOn){micStream&&micStream.getTracks().forEach(t=>t.stop());micOn=false;b.textContent='🎤 mic: off';return;}
  try{micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true}});const ac=A();const src=ac.createMediaStreamSource(micStream);an=ac.createAnalyser();an.fftSize=512;src.connect(an);mbuf=new Uint8Array(an.fftSize);micOn=true;b.textContent='🎤 mic: ON (grita)';}
  catch(e){b.textContent='🎤 sin permiso';}}
function micLevel(){if(!micOn)return 0;an.getByteTimeDomainData(mbuf);let s=0;for(const v of mbuf){const x=(v-128)/128;s+=x*x;}return Math.sqrt(s/mbuf.length);}

/* ═════════ GAME 1: ¡PARADA! (bus clásico visto desde afuera) ═════════ */
const FACES=[
 {skin:'#c68a5c',shirt:'#ff7ab0',hair:'curly',hairCol:'#2a1a14',mood:'grin',cheeks:1,gold:1},
 {skin:'#e8b48a',shirt:'#3fb0ff',hair:'slick',hairCol:'#14101c',stache:1,mood:'calm',brow:'thick'},
 {skin:'#a96f48',shirt:'#9b6bd1',hair:'bun',hairCol:'#d8d8e0',glasses:'round',mood:'sleep',wrinkles:1,pat:'floral',sh2:'#ffe08a'},
 {skin:'#d9a07a',shirt:'#4fd06a',cap:'#e8553d',mood:'yell',teeth:'buck'},
 {skin:'#8a5a3a',shirt:'#ffd23f',hair:'afro',hairCol:'#14101c',mood:'happy',earring:1},
 {skin:'#e9a77c',shirt:'#e8e8ee',hair:'rolos',hairCol:'#3b2a22',mood:'angry',brow:'thick',vein:1},
 {skin:'#c98a5a',shirt:'#2f7fe0',hair:'bald',brow:'uni',stubble:1,mood:'o',pat:'tank'},
 {skin:'#f0b995',shirt:'#ff5ca8',hair:'long',hairCol:'#5a3a22',mood:'smile',cheeks:1,earring:1},
 {skin:'#b87b50',shirt:'#fffdf2',hair:'mullet',hairCol:'#14101c',glasses:'shades',mood:'grin',chain:1},
 {skin:'#e0a070',shirt:'#e8553d',pat:'jersey',sh2:'#ffd23f',hair:'curly',hairCol:'#3b2a22',mood:'yell',sweat:1},
 {skin:'#d9a07a',shirt:'#6ee0c0',hair:'bun',hairCol:'#2a1a14',mood:'worry',glasses:'round',cheeks:1},
 {skin:'#9a6a46',shirt:'#c4283a',cap:'#14101c',capBack:1,mood:'grin',stache:1}];
/* nivel de maldad 1/2/3: el modo niveles fija window.NIVEL antes de mk(); en el laboratorio suelto sale del botón de velocidad. NO es la velocidad (SP va aparte) */
const NV=()=>window.NIVEL||(SP>=1.7?3:SP>=1.3?2:1);
/* ¡PARADA! · Nivel 1: frena con la abuela frente a la puerta (señuelos: la cabra y el perro).
   Nivel 2: la zona es más angosta (58) y ANTES de la abuela pasa una señora parecida que también saluda (pelo esponjado, sin lentes, sin bastón, con cartera, pide «¡TAXI!»): frenarle es perder.
   Nivel 3: lo del 2 + el chofer cambia el paso una sola vez poco antes de la abuela (acelera x1.38 o afloja x.62) y el bus patina más al frenar (.62 s en vez de .35): hay que gritar antes. */
function mkParada(){
  const N=NV(),rs=Math.sqrt(SP),V=300*rs,tT=3.1/rs,ZX=505,ZW=N>=2?58:75,BT=N>=3?.62:.35,STOP=N>=3?Math.round(V*BT/3):30,SPC=330,WX0=ZX+V*tT+STOP;
  const items=[{wx:WX0,stop:'abuela'},{wx:WX0-SPC,stop:N>=2?'senora':'cabra'},{wx:WX0-2*SPC,stop:'perro'},{wx:WX0+SPC,stop:'cabra'}];
  const MSG={cabra:'¿AQUÍ? ¡ESO ES UNA CABRA!',perro:'¿AQUÍ? ¡ESE ES UN PERRO!',senora:'¿AQUÍ? ¡ESA NO ES TU ABUELA!',none:'¿AQUÍ? ¡NO HAY NADIE!',late:'¡YA PASÓ, MI AMOR!'};
  /* sd: lo que va a patinar el bus si frenas YA (en nivel 3 depende del paso que lleve el chofer) */
  const sd=()=>N>=3?V*g.pace*BT/3:STOP;
  const sacks=[{x:110,r:26},{x:182,r:30},{x:266,r:26},{x:354,r:32},{x:444,r:26}].map((s,i)=>({...s,dy:0,vy:0,rot:0,dir:i%2?1:.6}));
  const g={get impact(){return this.braking?clamp(1-this.tb/.5,0,1):0;},t:0,dur:5/rs,result:null,why:'',kind:'',endT:0,scroll:0,vmul:1,pace:1,pc:0,pk:0,braking:false,tb:0,btn:0,cmd:'¡PARADA!',
    hint:'GRITA ¡PARADA! (o toca / ESPACIO) cuando la abuela quede frente a la puerta',
    press(){if(g.result||g.braking)return;g.braking=true;g.tb=0;g.btn=1;sfx.ding();sfx.screech();
      const px=it=>it.wx-g.scroll-sd();
      if(Math.abs(px(items[0])-ZX)<=ZW){g.result='win';g.why='¡LLEGASTE!';sfx.win();spawn(ZX,330,24,'conf',['#ffd23f','#ff5c8a','#5cff7a','#3fb0ff']);spawn(ZX,250,5,'♥',['#ff4d6d']);}
      else{g.result='lose';g.why='¡NO ERA!';sfx.lose();const near=items.find(it=>it.stop!=='abuela'&&Math.abs(px(it)-ZX)<=ZW+40);g.kind=near?near.stop:(px(items[0])<ZX?'late':'none');}},
    update(dt){g.t+=dt;g.btn=Math.max(0,g.btn-dt*2);
      if(g.braking){g.tb+=dt;g.vmul=Math.pow(Math.max(0,1-g.tb/BT),2);
        for(const s of sacks)if(g.tb>.18){s.vy+=900*dt;s.dy=Math.min(s.dy+s.vy*dt,300);s.rot+=dt*4*s.dir;}}
      /* nivel 3: a 280 px de la puerta el chofer cambia el paso (pc: +1 acelera, -1 afloja) */
      else if(N>=3){if(!g.pc&&items[0].wx-g.scroll-STOP-ZX<280){g.pc=Math.random()<.5?1:-1;g.pk=0;g.pc>0?sfx.boing():sfx.whoosh();}
        if(g.pc){g.pk+=dt;g.pace+=((g.pc>0?1.38:.62)-g.pace)*Math.min(1,dt*7);}}
      if(g.vmul>0)g.scroll+=V*g.vmul*g.pace*dt;
      if(!g.result&&(items[0].wx-g.scroll-sd()-ZX<-ZW+8||g.t>=g.dur)){g.result='lose';g.why='¡SE PASÓ!';g.kind='late';sfx.lose();}
      if(g.result)g.endT+=dt;
      if(Math.random()<dt*2.4)PT.push({x:600+Math.random()*80,y:100,vx:(Math.random()-.5)*60,vy:-60,g:0,t:0,life:1.3,kind:'♪',col:'#fff',r:5,rot:(Math.random()-.5)*.6,vr:0});
      if(g.result==='win'&&g.endT<.05)spawn(500,120,10,'feather',['#f1ece2','#b3552d'],220,300,1.2);
      if(g.result==='win'&&g.endT>.4&&Math.random()<dt*9)PT.push({x:ZX+(Math.random()-.5)*80,y:420,vx:0,vy:-90,g:0,t:0,life:.9,kind:'♥',col:'#ff4d6d',r:6,rot:0,vr:0});},
    draw(){
      const beat=(now*2.1)%1,pulse=Math.sin(beat*TAU)*.5+.5,ph=now*2.1*TAU,tb=g.braking?g.tb:0;
      const L=g.braking?(1-Math.exp(-tb*25))*Math.exp(-2.6*tb)*Math.cos(tb*6):0,mv=g.vmul>0,K=g.pc&&!g.braking?g.pc*Math.exp(-g.pk*3):0;
      /* street background */
      wash(0,0,800,380,'#8fd8ff','#e8f8ff');ell(90,70,34,34,'#ffe14d',0);
      const bo=-(g.scroll*.25%1000);
      for(let k=0;k<2;k++){const o=bo+k*1000;[[0,190,150,170,'#ffb36b'],[160,150,130,210,'#a9a0ff'],[300,200,170,160,'#ff9ec7'],[480,170,140,190,'#6ecf8f'],[630,210,160,150,'#ffd23f'],[800,180,150,180,'#8aa0ff']].forEach(([x,y,w,h,c])=>{rr(o+x,y,w,h,6,c,3.5);for(let i=0;i<3;i++)rr(o+x+14+i*(w/3.4),y+20,w/5,26,4,'#fff',2.5);});}
      rr(0,438,800,90,0,'#4d4a6e',0);rr(0,432,800,10,0,'#d8d2c4',0);
      for(let i=0;i<6;i++)rr(((i*180-g.scroll*1.3)%1080+1080)%1080-60,486,90,8,4,'#ffe14d',0);
      /* bus group: nose dives when braking */
      ctx.save();ctx.translate(650,470);ctx.rotate(.025*L-.03*K);ctx.translate(-650,-470+(mv?Math.sin(now*34)*1.4:0));
      /* roof: sacks, hen, speaker */
      for(const s of sacks){const dx=L*30*s.dir;ctx.save();ctx.translate(s.x+dx,142+s.dy);ctx.rotate(s.rot);ell(0,0,s.r,s.r*.62,'#e8d7a8',4);line([[-s.r*.5,-4],[s.r*.5,-4]],2.5,'#a98a4a');ctx.restore();}
      const pz=1+pulse*.1;ctx.save();ctx.translate(640,118);ctx.scale(pz,pz);rr(-42,-26,84,52,8,'#2b2b3a',4.5);ell(0,0,18,18,'#4a4a5e',3);ell(0,0,8,8,'#9a9ab4',2.5);ctx.restore();
      hen(540,128,.55+Math.max(0,g.braking?tb*.6:0),-.5);
      /* body */
      rr(40,150,720,302,38,'#ff6b3d',5);rr(40,150,720,34,26,'#fff3c4',4);
      rr(40,366,720,40,0,'#ffd23f',0);rr(40,406,720,14,0,'#2f7fe0',0);line([[40,366],[760,366]],4,INK);line([[40,420],[760,420]],4,INK);
      for(let i=0;i<7;i++)poly([[560+i*30,452],[574+i*30,396],[588+i*30,452]],i%2?'#ffd23f':'#ff3b4e',2.5);
      txt('DIOS ES AMOR  ·  VIRGEN DEL VALLE  ·  CATIA - PETARE',360,388,17,'#14101c',0,true);
      txt('LA GUAIRA EXPRESS',250,167,15,'#c4283a',0,true);
      for(let i=0;i<12;i++){poly([[56+i*60,184],[86+i*60,184],[71+i*60,200]],['#ff3b4e','#ffd23f','#3fa0ff','#5cff7a'][i%4],2);}
      /* windows with people */
      const wins=[[62,206],[154,206],[246,206],[338,206]];
      wins.forEach(([wx,wy],i)=>{const ww=82,wh=124;
        ctx.save();path(rrP(wx,wy,ww,wh,10));ctx.clip();ctx.fillStyle=STY[style].col('#5a4a78');ctx.fillRect(wx,wy,ww,wh);
        for(let k=0;k<3;k++){const sp=FACES[(i*3+k)%FACES.length],xx=wx+16+k*(ww-32)/2+(k===1?0:0),yy=wy+wh*(k===1?.86:.95),pan=g.braking&&tb<.9;
          const you=(i===3&&k===1);
          bust(Object.assign({},sp,{x:xx+L*16+(pan?5:0),y:yy,s:k===1?.6:.53,th:50,bw:50,rot:L*.4,look:.6,sweat:(pan&&k!==1)?1:0,
            mood:you?(g.result==='win'?'happy':g.result==='lose'?'worry':(Math.abs(items[0].wx-g.scroll-STOP-ZX)<ZW+120?'yell':'calm')):(pan?(k===0?'panic':'yell'):sp.mood),
            talk:you?pulse:0,cheeks:1},you?{skin:'#e9a77c',shirt:'#3fb0ff',hair:'curly',hairCol:'#2a1a14',pat:'hoodie',cap:null,glasses:null,stache:0}:{}));}
        ctx.restore();line(closeP(rrP(wx,wy,ww,wh,10)),6,'#c9ced6');});
      rr(362,176,56,24,8,'#ffd23f',3.5);txt('TÚ ↓',390,189,14,INK,0,true);
      /* big door */
      rr(436,176,148,276,12,'#2d2640',4.5);
      ctx.save();path(rrP(442,182,136,264,8));ctx.clip();
      bust({...FACES[3],x:470+L*18,y:370,s:.6,th:60,mood:g.braking?'yell':'worry',rot:L*.4});bust({...FACES[10],x:552+L*18,y:360,s:.6,th:60,mood:g.braking?'panic':'calm',rot:L*.4});
      ctx.restore();
      pole(446,176,452);pole(574,176,452);rr(436,452,148,14,4,'#ffd23f',3.5);for(let i=0;i<7;i++)poly([[440+i*21,454],[450+i*21,454],[440+i*21,464],[430+i*21,464]],'#14101c',0);
      /* colector bailando en la puerta */
      const dance=g.braking?0:1,sw=Math.sin(ph)*dance,fly=g.braking?70*L:0;
      bust({x:510+sw*14+fly,y:318-Math.abs(sw)*10-Math.abs(fly)*.2,s:.82,skin:'#c98a5a',shirt:'#ffd23f',pat:'jersey',sh2:'#e8553d',cap:'#2b2b3a',capBack:1,hair:'curly',hairCol:'#14101c',earring:1,
        mood:g.result==='win'?'happy':g.braking?'panic':'grin',gold:1,talk:pulse,rot:sw*.14+fly*.01,th:120,legs:['#2b2b3a','#fff',60],bw:46,hw:36,hh:40,
        arms:[{side:-1,a:g.braking?-2.4-L*.3:-2.6+sw*.5,len:88,w:20},{side:1,a:g.braking?2.4+L*.3:2.2-sw*.5,len:88,w:20,hand:(x,y)=>{for(let i=0;i<3;i++){ctx.save();ctx.translate(x,y-8);ctx.rotate(-.4+i*.35);rr(-3,-30,26,38,3,['#5cd06a','#7be48a','#48b85a'][i],2.5);ctx.restore();}}}]});
      /* chofer en el parabrisas */
      rr(592,176,152,160,14,'#5a4a78',4.5);
      ctx.save();path(rrP(596,180,144,152,10));ctx.clip();wash(596,180,144,152,'#7fd0ff','#cfeeff');
      bust({x:668+L*10,y:342-(pulse*5),s:.66,skin:'#b87b50',shirt:'#fffdf2',pat:'tank',hair:'slick',hairCol:'#14101c',stache:1,chain:1,glasses:'shades',earring:1,mood:g.result==='lose'&&g.kind!=='late'?'yell':'grin',gold:1,talk:g.result==='lose'?pulse:0,rot:Math.sin(ph)*.06+L*.2,bw:58,hw:44,hh:43,
        arms:[{side:-1,a:.5,len:70,w:22},{side:1,a:-.5,len:70,w:22}]});
      ctx.save();ctx.translate(668,330);line(closeP(ellP(0,0,52,18,20)),9,'#3b3550');ctx.restore();
      ctx.restore();line(closeP(rrP(596,180,144,152,10)),6,'#c9ced6');
      /* mirror, bumper, wheels */
      rr(752,230,30,44,6,'#c9ced6',3.5);rr(730,408,56,26,8,'#c9ced6',3.5);
      ctx.save();path(rrP(0,0,0,0,0));ctx.restore();
      for(const wx of[160,650]){ell(wx,454,62,52,'#ff6b3d',4.5);ell(wx,462,46,46,'#14101c',3);ell(wx,462,19,19,'#c9ced6',3);for(let i=0;i<5;i++){const a=now*(mv?12:0)+i*TAU/5;line([[wx+Math.cos(a)*6,462+Math.sin(a)*6],[wx+Math.cos(a)*16,462+Math.sin(a)*16]],3,'#7a7f92');}}
      ctx.restore();
      /* sidewalk + signs (foreground) */
      rr(0,508,800,100,0,'#d8d2c4',0);line([[0,508],[800,508]],5,INK);
      for(let i=0;i<6;i++)rr(((i*160-g.scroll*1.5)%960+960)%960-80,560,70,6,3,'#c4bba8',0);
      for(const it of items){const sx=it.wx-g.scroll;if(sx<-90||sx>900)continue;
        pole(sx,396,596);rr(sx-42,356,84,48,8,'#2f7fe0',4.5);txt('PARADA',sx,380,15,'#fff',0,true);
        if(it.stop==='abuela'){bust({x:sx-56,y:470,s:.72,skin:'#d99a6c',shirt:'#fff',pat:'apron',sh2:'#ff5ca8',hair:'bun',hairCol:'#cfcfd6',mood:g.result==='win'?'happy':'smile',cheeks:1,glasses:'round',wrinkles:1,legs:['#5a3a8a','#2b2b3a',74],th:120,
            arms:N>=2?[{side:1,a:-2.5+Math.sin(now*9)*.5,len:84,w:20},{side:-1,a:-.2,len:62,w:20,hand:(x,y)=>line([[x+12,y-8],[x+4,y-18],[x-5,y-12],[x-5,y],[x-9,184]],7,'#7a5230')}]   /* del nivel 2 en adelante anda con su bastón */
              :[{side:1,a:-2.5+Math.sin(now*9)*.5,len:84,w:20}],rot:Math.sin(now*4)*.03});
          const b=Math.sin(now*6)*4;rr(sx-140,300+b,104,28,8,'#ffd23f',3.5);txt('¡MI NIETO!',sx-88,314+b,13,INK,0,true);}
        /* la señora parecida: canosa y saludando igualito, pero pelo esponjado, sin lentes, sin bastón, vestido de rayas y cartera */
        else if(it.stop==='senora'){bust({x:sx-56,y:470,s:.72,skin:'#c98a5a',shirt:'#8a5ad0',pat:'stripes',sh2:'#d9c4ff',hair:'afro',hairCol:'#b9b9c6',mood:g.kind==='senora'?'o':'calm',earring:1,legs:['#c98a5a','#c4283a',74],th:120,
            arms:[{side:1,a:-2.5+Math.sin(now*9+2)*.5,len:84,w:20},{side:-1,a:-.25,len:64,w:20,hand:(x,y)=>{line([[x-11,y+6],[x,y-8],[x+11,y+6]],4,INK);rr(x-18,y+4,36,28,7,'#c4283a',3.5);}}],rot:Math.sin(now*4+1)*.03});
          const b=Math.sin(now*6+2)*4;rr(sx-128,300+b,80,28,8,'#fff',3.5);txt('¡TAXI!',sx-88,314+b,13,INK,0,true);}
        else if(it.stop==='cabra')goat(sx-62,590,1);else dog(sx-62,590,1);}
      /* zona */
      if(!g.result){line([[ZX-ZW,604],[ZX-ZW,592],[ZX+ZW,592],[ZX+ZW,604]],5,'#ffe14d');}
      /* reactions */
      if(g.pc&&!g.result&&g.pk<.9)bubble(630,116,g.pc>0?'¡VOY TARDE!':'SUAVECITO…',18,668,214);
      if(g.result==='lose'&&g.endT>.15)bubble(400,64+60,MSG[g.kind]||MSG.none,22,640,200);
      if(g.result==='win'&&g.endT>.3)bubble(400,64+60,'¡CAMBIO, MI REINA!',26,520,230);
      drawP();
    },
    /* para el banco de pruebas: d = cuánto le falta a la abuela para el centro de la puerta si frenas YA (gana con |d|<=ZW); ds = lo mismo con la señora */
    probe:()=>({N,ZW,pace:g.pace,pc:g.pc,d:items[0].wx-g.scroll-sd()-ZX,ds:N>=2?items[1].wx-g.scroll-sd()-ZX:null})};
  return g;
}

/* ═════════ GAME 2: ¡CHANCLA! (mamá grande, de lado) ═════════ */
/* ¡CHANCLA! · Nivel 1: 2 chancletazos (salta el bajo, agáchate con el alto).
   Nivel 2: 3 chancletazos, y uno (nunca el primero) viene con amago: mamá carga, amaga, se aguanta .45 s con la chancla en la mano y la sonrisita, y ahí sí la suelta.
   Nivel 3: 4 chancletazos (uno con amago), y otro rebota en la pared de atrás («¡BOING!») y vuelve por la espalda a la misma altura: ese hay que esquivarlo dos veces. */
function mkChancla(){
  const N=NV(),NT=N+1,rs=Math.sqrt(SP),FT=.5/rs,names=['¡JOSÉ GREGORIO!','¡LUIS ALFREDO!','¡MIGUEL ÁNGEL!','¡YORMAN JESÚS!','¡CARLOS EDUARDO!'];
  const nm=names[Math.floor(Math.random()*names.length)];
  const kinds=[Math.random()<.5?'hi':'lo'];for(let i=1;i<NT;i++)kinds.push(Math.random()<.65?(kinds[i-1]==='hi'?'lo':'hi'):kinds[i-1]);
  /* FI: el tiro del amago · BI: el que rebota (ninguno es el primero, y no son el mismo) */
  const FI=N>=2?1+Math.floor(Math.random()*(NT-1)):-1,BI=N>=3?[1,2,3].filter(i=>i!==FI)[Math.floor(Math.random()*2)]:-1;
  /* horario en centésimas (el nivel 1 queda igualito: carga .95 / suelta 1.3, brinco 1.75-2.2, carga 2.25 / suelta 2.6). fk = momento del amago; tras el rebote hay medio segundo más de aire */
  const T=[],HOPS=[];for(let i=0,c=95;i<NT;i++){const f=i===FI?45:0;T.push({wind:c/100/rs,fk:f?(c+35)/100/rs:0,rel:(c+35+f)/100/rs,fd:0});c+=35+f;if(i<NT-1)HOPS.push([(c+45)/100/rs,(c+90)/100/rs]);c+=95+(i===BI?50:0);}
  const WALL={hi:150,lo:120},TY={hi:335,lo:505},HB=.16/rs,RB=.54/rs;
  const KX=250,KFEET=548,MX=650,MY=262,MS=1.5,ARML=95,JD=.55;
  let jumpT=0,duckT=0;
  const th=kinds.map((k,i)=>({kind:k,i,state:'idle',x:0,y:0,rot:0,sx:0,sy:0,tt:0}));
  const broke={tv:false,vase:false};
  const handAt=a=>[MX-MS*(42+ARML*Math.sin(a)),MY+MS*(4+ARML*Math.cos(a))];
  const REL={hi:1.7,lo:1.3},WIND={hi:3.5,lo:-1.0};
  const g={get impact(){return this.result==='lose'?clamp(1-this.endT/.5,0,1):clamp(this.shock/.5,0,1);},kinds,T,t:0,dur:(N>=3?7.4:N>=2?6:4.6)/rs,result:null,why:'',endT:0,boing:0,bx:0,by:0,cmd:'¡ESQUIVA!',hint:'↑ / TOCA ARRIBA: SALTA (tiro bajo) · ↓ / TOCA ABAJO: AGÁCHATE (tiro alto)',lastBroke:'',shock:0,
    press(k){if(g.result)return;if(k==='up'||k==='any'){if(jumpT<=0&&duckT<=.1){jumpT=JD;sfx.boing();}}else if(k==='down'){if(duckT<=0&&jumpT<=.1){duckT=.62;sfx.whoosh();}}},
    jumpH(){return jumpT>0?Math.sin((1-jumpT/JD)*Math.PI)*125:0;},
    update(dt){g.t+=dt;jumpT=Math.max(0,jumpT-dt);duckT=Math.max(0,duckT-dt);g.shock=Math.max(0,g.shock-dt);g.boing=Math.max(0,g.boing-dt);
      for(const h of th){const tm=T[h.i];
        if(tm.fk&&!tm.fd&&g.t>=tm.fk){tm.fd=1;sfx.whoosh();}
        if(h.state==='idle'&&g.t>=tm.rel){const a=handAt(REL[h.kind]);h.sx=a[0];h.sy=a[1];h.state='fly';h.tt=0;sfx.whoosh();}
        /* el rebote: se aplasta HB contra la pared y vuelve en RB hasta el niño; si lo esquiva otra vez, sigue de largo hasta mamá */
        if(h.state==='back'){h.tt+=dt;const u=(h.tt-HB)/RB;h.x=h.sx+(KX-10-h.sx)*Math.max(0,u);h.y=TY[h.kind]-Math.sin(clamp(u,0,1)*Math.PI)*16;if(u>0)h.rot+=dt*20;
          if(u>=1){const safe=h.kind==='hi'?duckT>0:g.jumpH()>55;
            if(safe){h.state='ret';g.shock=.5;g.lastBroke='¡NI DE REBOTE!';}else{h.state='stuck';g.result='lose';g.why='¡PLAF!';sfx.thud();sfx.lose();spawn(KX,380,10,'★',['#ffe14d'],200,400,.8);}}}
        else if(h.state==='ret'){h.x+=560*rs*dt;h.rot+=dt*20;if(h.x>=MX-80){h.state='done';g.shock=.5;sfx.thud();spawn(MX-80,h.y,8,'★',['#ffe14d'],200,400,.7);}}
        else if(h.state==='fly'||h.state==='pass'){h.tt+=dt;const u=h.tt/FT,ty=h.kind==='hi'?335:505;
          h.x=h.sx+(KX+10-h.sx)*u;h.y=h.sy+(ty-h.sy)*Math.min(1,u*1.1)-Math.sin(clamp(u,0,1)*Math.PI)*(h.kind==='hi'?30:-10);h.rot-=dt*20;
          if(h.state==='fly'&&u>=1){const safe=h.kind==='hi'?duckT>0:g.jumpH()>55;
            if(safe){h.state='pass';g.shock=.5;}else{h.state='stuck';g.result='lose';g.why='¡PLAF!';sfx.thud();sfx.lose();spawn(KX,380,10,'★',['#ffe14d'],200,400,.8);}}
          if(h.state==='pass'&&h.x<=WALL[h.kind]&&h.i===BI){h.state='back';h.tt=0;h.sx=h.x;g.boing=.7;g.bx=h.x;g.by=h.y;sfx.boing();spawn(h.x-16,h.y,6,'★',['#ffe14d'],180,500,.6);}
          else if(h.state==='pass'&&h.x<=WALL[h.kind]){h.state='wall';
            if(h.kind==='hi'){broke.tv=true;g.lastBroke='¡LA TELE!';}else{broke.vase=true;g.lastBroke='¡EL FLORERO!';spawn(100,500,16,'bit',['#ff8a3d','#ffd23f','#2f9fe3'],300,900,1);}
            sfx.crash();spawn(110,h.kind==='hi'?340:500,8,'bit',['#ffffff','#bfe9ff'],240,800,.8);}}}
      if(!g.result&&th.every(h=>h.state==='wall'||h.state==='ret'||h.state==='done')){g.result='win';g.why='¡FALLASTE!';sfx.win();spawn(KX,380,26,'conf',['#ffd23f','#ff5c8a','#5cff7a','#3fb0ff']);}
      if(g.result)g.endT+=dt;},
    draw(){
      const t=g.t;
      /* sala */
      wash(0,0,800,480,'#ffd9a0','#ffe9c4');for(let i=0;i<10;i++)rr(i*90+8,0,44,480,0,'#f5c27a',0);
      rr(0,470,800,130,0,'#b97a46',0);for(let i=0;i<9;i++)rr(i*95-20,470,3,130,0,'#8a5530',0);rr(0,462,800,14,0,'#f7e7c4',4);
      const fa=now*(style==='recorte'?3:9);line([[400,0],[400,40]],6,'#8f8fa8');for(let i=0;i<4;i++){const a=fa+i*Math.PI/2;limb(400,54,400+Math.cos(a)*100,54+Math.sin(a)*14,18,'#c9ced6',3);}ell(400,54,13,13,'#5a5274',3);
      /* ventana */
      rr(300,120,110,130,6,'#7a5230',4.5);rr(310,130,90,110,4,'#bfe9ff',3);rr(300,120,26,130,6,'#ff5c8a',3.5);rr(384,120,26,130,6,'#ff5c8a',3.5);
      /* virgen */
      rr(450,300,100,12,3,'#fff',3.5);rr(466,200,68,100,8,'#3fa0ff',4);ell(500,230,13,13,'#f2b88c',2.5);poly([[480,244],[500,238],[520,244],[528,300],[472,300]],'#fff',3);ell(448,285,7,13,'#ffe14d',2.5);ell(448+Math.sin(now*9)*1.5,267,4,7,'#ff8a3d',0);
      /* sofá */
      rr(330,360,190,16,0,'#7a3b2a',0);rr(326,370,200,110,22,'#4fa66a',4.5);rr(342,328,168,60,18,'#5fbd7c',4.5);line([[372,392],[400,352]],5,'#fff');line([[420,392],[448,352]],5,'#fff');
      /* tele */
      ctx.save();if(broke.tv)ctx.translate(Math.sin(now*50)*1.5,0);
      rr(24,296,170,122,14,'#3b3550',5);rr(38,310,142,92,10,broke.tv?'#9ca0b5':'#7fe0d0',3.5);
      if(!broke.tv){ell(84,358,19,22,'#f2b88c',3);ell(134,358,19,22,'#c98a5a',3);if(Math.sin(now*3)>0)txt('♥',109,326,24,'#ff4d6d');}
      else{line([[56,324],[160,392]],5,INK);line([[160,324],[56,392]],5,INK);}
      rr(14,418,190,16,4,'#8a5530',4);ctx.restore();
      /* florero */
      if(!broke.vase){rr(72,478,60,56,16,'#2f9fe3',4);rr(90,458,24,26,6,'#2f9fe3',4);ell(102,444,12,12,'#ff4d6d',3);ell(84,452,9,9,'#ffd23f',3);ell(120,450,9,9,'#ff8aa5',3);}
      /* mamá */
      const sideArm=(i)=>{const k=kinds[i],w=T[i].wind,r=T[i].rel,f=T[i].fk||r;if(t<w)return .3+Math.sin(now*14)*.05;
        if(t<f)return lerp(.3,WIND[k],ease((t-w)/(f-w)));
        if(t<r){const q=(t-f)/.18;return q<1?lerp(WIND[k],REL[k],.5*Math.sin(q*Math.PI)):WIND[k]+Math.sin(now*40)*.04;}   /* amago: medio latigazo, se devuelve y se aguanta temblando */
        if(t<r+.12)return lerp(WIND[k],REL[k],(t-r)/.12);return lerp(REL[k],.3,clamp((t-r-.12)/.6,0,1));};
      let i=0;while(i<NT-1&&t>=HOPS[i][0])i++;const a=sideArm(i);
      const holding=i===0?t<T[0].rel+.05:(t>=HOPS[i-1][1]-.15&&t<T[i].rel+.05);
      const hj=HOPS.findIndex(h=>t>h[0]&&t<h[1]),hop=hj>=0?Math.abs(Math.sin((t-HOPS[hj][0])/(HOPS[hj][1]-HOPS[hj][0])*Math.PI*2))*-34:0;
      const amago=i===FI&&t>=T[i].fk&&t<T[i].rel;
      const mood=g.result==='win'?'panic':g.result==='lose'?'angry':(amago?'grin':g.shock>0?'o':(t<1.15/rs?'yell':'angry'));
      const talk=(t>.2&&t<1.15/rs)?Math.abs(Math.sin(now*15)):.15;
      const bare1=t>=HOPS[0][0];
      bust({x:MX,y:MY+hop,s:MS,flip:true,skin:'#d9a07a',shirt:'#ff7ab0',pat:'floral',sh2:'#fff0a0',hair:'rolos',hairCol:'#3b2a22',mood,talk,look:1,earring:1,brow:'thick',wrinkles:1,
        hw:44,hh:44,bw:54,vein:mood==='yell'||mood==='angry',sweat:g.result==='win'?2:0,th:130,teeth:1,legs:['#d9a07a','#d9a07a',70,bare1?'#d9a07a':'#2f7fe0'],
        rot:t<.95/rs?Math.sin(now*14)*.015:0,
        arms:g.result==='win'?[{side:1,a:2.5,len:64,w:22},{side:-1,a:-2.5,len:64,w:22}]
          :[{side:1,a:a,len:ARML,w:23,hand:holding?(x,y)=>chanclaP(x,y-12,.3,1.2):null},{side:-1,a:-.9,len:62,w:23}]});
      /* globo con el nombre */
      if(t>.25&&t<1.5/rs){const k=clamp((t-.25)/.18,0,1);ctx.save();ctx.translate(430,210);ctx.scale(.6+.4*k+Math.sin(now*30)*.02,.6+.4*k);bubble(0,0,nm,30,150,40,'#fff');ctx.restore();}
      if(hj>=1&&!g.result)bubble(455,172,'¡TENGO MÁS!',20,640,255);
      if(g.result==='win'&&g.endT>.2)bubble(430,210,g.lastBroke,32,650,260);
      if(g.result==='lose'&&g.endT>.3)bubble(430,210,'¡TE LO DIJE!',32,650,260);
      /* niño */
      const jh=g.jumpH(),duck=duckT>0,standing=!duck&&jh===0;
      const viene=th.some(h=>h.state==='fly'||h.state==='back'),kmood=g.result==='lose'?'dizzy':g.result==='win'?'happy':viene?'panic':duck?'worry':'calm';
      const sy=duck?.6:1,ky=duck?KFEET-145*.6*.85:KFEET-145*.85-jh;
      bust({x:KX,y:ky,s:.85,sy,skin:'#e9a77c',shirt:'#3fb0ff',pat:'hoodie',hair:'curly',hairCol:'#2a1a14',cheeks:1,brow:'thin',mood:kmood,look:1,th:110,legs:['#2f3a7a','#fff',60],bw:50,hw:38,hh:40,eyeR:10,
        sweat:viene?1:0,rot:g.result==='lose'?Math.sin(now*9)*.15:0,
        arms:[{side:1,a:jh>5||g.result==='win'?2.7:.2,len:80,w:20},{side:-1,a:jh>5||g.result==='win'?-2.7:-.2,len:80,w:20}]});
      rr(KX-28,KFEET-262,56,28,10,'#ffd23f',3.5);txt('TÚ',KX,KFEET-248,18,INK,0,true);
      if(g.result==='lose'){chanclaP(KX+14,KFEET-142,-.3,1.5);for(let i=0;i<3;i++){const aa=now*5+i*TAU/3;txt('★',KX+Math.cos(aa)*46,KFEET-206+Math.sin(aa)*10,22,'#ffe14d');}}
      /* chanclas volando */
      for(const h of th){if(h.state==='fly'||h.state==='pass'||h.state==='ret')chanclaP(h.x,h.y,h.rot,1.3);
        /* rebote: aplastada de canto contra la pared, y después de vuelta con rayitas de velocidad detrás */
        else if(h.state==='back'){const q=clamp(h.tt/HB,0,1);
          if(q<1){ctx.save();ctx.translate(h.x-8,h.y);ctx.scale(.5+.5*q,1.5-.5*q);chanclaP(0,0,Math.PI/2,1.3);ctx.restore();}
          else{for(let k=0;k<3;k++)line([[h.x-40-k*10,h.y-14+k*14],[h.x-70-k*10,h.y-14+k*14]],4);chanclaP(h.x,h.y,h.rot,1.3);}}}
      if(g.boing>0){const q=1-g.boing/.7;txt('¡BOING!',g.bx+8,g.by-64-q*16,30+Math.sin(q*Math.PI)*10,'#ffe14d',-.12);}
      drawP();
    },
    /* para el banco de pruebas */
    probe:()=>({N,FI,BI,jumpT,duckT,th:th.map(h=>({k:h.kind,st:h.state,x:h.x}))})};
  return g;
}

/* ───────── loop / ui ───────── */
const GAMES={parada:{name:'¡PARADA!',mk:mkParada},chancla:{name:'¡CHANCLA!',mk:mkChancla}};
function restart(){PT.length=0;G=GAMES[gameId].mk();if(document.getElementById('help'))document.getElementById('help').textContent=STY[style].desc+'  ·  Teclas 1-9 cambian de estilo.';}
function setStyle(s){style=s;GRAINP=null;
  document.querySelectorAll('#styles button,#styles2 button').forEach(b=>b.classList.toggle('on',b.dataset.k===s));if(document.getElementById('help'))document.getElementById('help').textContent=STY[s].desc+'  ·  Teclas 1-9 cambian de estilo.';lastPaint=-9;}
function setGame(k){gameId=k;document.querySelectorAll('#games button').forEach(b=>b.classList.toggle('on',b.dataset.k===k));restart();}

const PAL=['#000000','#222034','#45283c','#663931','#8f563b','#df7126','#d9a066','#eec39a','#fbf236','#99e550','#6abe30','#37946e','#4b692f','#524b24','#323c39','#3f3f74','#306082','#5b6ee1','#639bff','#5fcde4','#cbdbfc','#ffffff','#9badb7','#847e87','#696a6a','#595652','#76428a','#ac3232','#d95763','#d77bba','#8f974a','#8a6f30'].map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
const LUT=new Int8Array(1<<18).fill(-1),BAY=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function postPixel(){const id=sctx.getImageData(0,0,PW,PH),d=id.data;
  for(let y=0;y<PH;y++)for(let x=0;x<PW;x++){const i=(y*PW+x)*4,o=(BAY[(y&3)*4+(x&3)]/16-.5)*26;
    const r=clamp(d[i]+o,0,255)|0,g=clamp(d[i+1]+o,0,255)|0,b=clamp(d[i+2]+o,0,255)|0,key=((r>>2)<<12)|((g>>2)<<6)|(b>>2);let p=LUT[key];
    if(p<0){const rr_=(r|2),gg=(g|2),bb=(b|2);let best=1e9;p=0;for(let j=0;j<32;j++){const q=PAL[j],e=(q[0]-rr_)**2*.9+(q[1]-gg)**2*1.2+(q[2]-bb)**2*.8;if(e<best){best=e;p=j;}}LUT[key]=p;}
    const q=PAL[p];d[i]=q[0];d[i+1]=q[1];d[i+2]=q[2];d[i+3]=255;}
  sctx.putImageData(id,0,0);OUTX.setTransform(1,0,0,1,0,0);OUTX.imageSmoothingEnabled=false;OUTX.drawImage(small,0,0,W,H);}
function hud(){
  const p=clamp(G.t/G.dur,0,1);
  ctx.save();
  if(!G.result){const k=G.t<.9?1+Math.sin(G.t*20)*.05:1;ctx.translate(400,40);ctx.scale(k,k);txt(G.cmd,0,0,50,'#ffe14d');}
  else{const k=Math.min(1,G.endT*5);ctx.translate(400,300);ctx.scale(.4+.6*k,.4+.6*k);ctx.rotate(-.05);if(G.endT<1.6)txt(G.why,0,0,70,G.result==='win'?'#5cff7a':'#ff4d5e');}
  ctx.restore();
  if(!G.result)txt(G.hint,400,586,15,(STY[style].darkText||style==='recorte')?'#14101c':'#ffffff');
  rr(250,70,300,12,6,'#ffffff',3);if(p<1)rr(252,72,Math.max(6,296*(1-p)),8,4,'#ff8a3d',0);
}
let last=performance.now(),lastPaint=-9;
function postSNES(){const id=s2ctx.getImageData(0,0,S2W,S2H),d=id.data,B=[0,2,3,1];const L=[6,7,5];
  for(let y=0;y<S2H;y++)for(let x=0;x<S2W;x++){const i=(y*S2W+x)*4,o=(B[(y&1)*2+(x&1)]-1.5)*7;
    for(let c=0;c<3;c++){const n=L[c]-1,v=clamp(d[i+c]+o,0,255);d[i+c]=Math.round(v/255*n)*255/n;}d[i+3]=255;}
  s2ctx.putImageData(id,0,0);OUTX.setTransform(1,0,0,1,0,0);OUTX.imageSmoothingEnabled=false;OUTX.drawImage(s2,0,0,W,H);}
function grainOverlay(al){ctx.save();ctx.globalCompositeOperation='multiply';ctx.globalAlpha=al;GRAINP=GRAINP||ctx.createPattern(GRAIN,'repeat');ctx.fillStyle=GRAINP;ctx.fillRect(0,0,W,H);ctx.restore();}
function postVHS(){
  const id=bctx.getImageData(0,0,W,H),d=id.data,o=new Uint8ClampedArray(d);const sh=3;
  for(let y=0;y<H;y++){const row=y*W*4,fl=1+(hash(y,Math.floor(now*20),3)-.5)*.06;
    for(let x=0;x<W;x++){const i=row+x*4,xl=row+Math.max(0,x-sh)*4,xr=row+Math.min(W-1,x+sh)*4;
      d[i]=Math.min(255,o[xl]*fl*1.04);d[i+1]=o[i+1]*fl;d[i+2]=Math.min(255,o[xr+2]*fl*.98);}}
  vctx.setTransform(1,0,0,1,0,0);vctx.putImageData(id,0,0);
  const ty=((now*70)%760)-80;vctx.drawImage(vctx.canvas,0,ty,W,26,14,ty,W,26);
  vctx.fillStyle='rgba(255,255,255,.14)';vctx.fillRect(0,ty+26,W,2);
  for(let i=0;i<14;i++){const y=hash(i,Math.floor(now*15),1)*H;vctx.fillStyle='rgba(255,255,255,'+(.08+hash(i,3,3)*.15)+')';vctx.fillRect(hash(i,5,5)*W*.7,y,60+hash(i,7,7)*140,1.5);}
  vctx.fillStyle='rgba(0,0,0,.2)';for(let y=0;y<H;y+=3)vctx.fillRect(0,y,W,1);
  const gr=vctx.createRadialGradient(400,300,260,400,300,560);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.45)');vctx.fillStyle=gr;vctx.fillRect(0,0,W,H);
  vctx.font='bold 22px "Courier New",monospace';vctx.textBaseline='top';vctx.fillStyle='#fff';vctx.shadowColor='#f0f';vctx.shadowBlur=4;
  vctx.fillText('▶ PLAY',14,12);vctx.textAlign='right';vctx.fillText('SP 0:0'+Math.min(9,Math.floor(G.t)),W-14,12);vctx.textAlign='left';
  if(Math.floor(now*2)%2===0){vctx.fillStyle='#ff3b3b';vctx.fillText('● REC',14,H-32);}vctx.shadowBlur=0;}
function focusLines(k){ctx.save();ctx.translate(400,300);const n=48,fr=Math.floor(now*12);
  for(let i=0;i<n;i++){const a=i/n*TAU+hash(i,fr,1)*.08,r0=190+hash(i,fr,2)*110,r1=520,wd=.014+hash(i,3,3)*.01;
    ctx.fillStyle=i%2?'rgba(255,255,255,'+(.6*k)+')':'rgba(25,10,50,'+(.4*k)+')';ctx.beginPath();ctx.moveTo(Math.cos(a-wd)*r1,Math.sin(a-wd)*r1);ctx.lineTo(Math.cos(a)*r0,Math.sin(a)*r0);ctx.lineTo(Math.cos(a+wd)*r1,Math.sin(a+wd)*r1);ctx.closePath();ctx.fill();}
  ctx.restore();if(k>.75){ctx.fillStyle='rgba(255,255,255,'+((k-.75)*2.2)+')';ctx.fillRect(0,0,W,H);}}
function filmOverlay(){const fr=Math.floor(now*24);ctx.save();
  ctx.globalAlpha=.04+.07*hash(fr,1,1);ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=.55;ctx.globalCompositeOperation='multiply';ctx.translate(hash(fr,2,2)*96,hash(fr,3,3)*96);ctx.fillStyle=ctx.createPattern(GRAIN,'repeat');ctx.fillRect(-100,-100,W+200,H+200);
  ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.5;
  for(let i=0;i<2;i++){const x=hash(fr,i+4,5)*W;if(hash(fr,i,7)>.45){ctx.fillStyle='#fff8e8';ctx.fillRect(x,0,1.4,H);}}
  ctx.globalAlpha=.6;for(let i=0;i<6;i++){ctx.fillStyle=i%2?'#1a1410':'#fff8e8';ctx.beginPath();ctx.arc(hash(fr,i,11)*W,hash(fr,i,12)*H,1+hash(fr,i,13)*2,0,TAU);ctx.fill();}
  ctx.globalAlpha=1;const gr=ctx.createRadialGradient(400,300,280,400,300,560);gr.addColorStop(0,'rgba(60,30,0,0)');gr.addColorStop(1,'rgba(60,30,0,.5)');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);ctx.restore();}
function frameRotu(){ctx.save();const t=20;ctx.fillStyle='#c4283a';ctx.fillRect(0,0,W,t);ctx.fillRect(0,H-t,W,t);ctx.fillRect(0,0,t,H);ctx.fillRect(W-t,0,t,H);
  ctx.fillStyle='#ffd23f';for(let x=14;x<W;x+=30)for(const y of[t/2,H-t/2]){ctx.beginPath();ctx.moveTo(x,y-7);ctx.lineTo(x+7,y);ctx.lineTo(x,y+7);ctx.lineTo(x-7,y);ctx.fill();}
  for(let y=44;y<H-20;y+=30)for(const x of[t/2,W-t/2]){ctx.beginPath();ctx.moveTo(x,y-7);ctx.lineTo(x+7,y);ctx.lineTo(x,y+7);ctx.lineTo(x-7,y);ctx.fill();}
  ctx.lineWidth=4;ctx.strokeStyle=INK;ctx.strokeRect(t,t,W-2*t,H-2*t);ctx.lineWidth=2;ctx.strokeStyle='#fffdf0';ctx.strokeRect(t+4,t+4,W-2*t-8,H-2*t-8);ctx.lineWidth=4;ctx.strokeRect(1,1,W-2,H-2);ctx.restore();}
function frameLote(){ctx.save();ctx.strokeStyle='#d9372f';ctx.lineWidth=6;ctx.strokeRect(14,12,W-28,H-24);ctx.strokeStyle='#2c5aa0';ctx.lineWidth=2.5;ctx.strokeRect(22,20,W-44,H-40);
  ctx.fillStyle='#f2e3c0';ctx.beginPath();ctx.arc(54,48,30,0,TAU);ctx.fill();ctx.lineWidth=4;ctx.strokeStyle='#d9372f';ctx.stroke();
  ctx.fillStyle='#2a1a10';ctx.font='bold 26px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(gameId==='parada'?'23':'7',54,50);
  ctx.fillStyle='#d9372f';ctx.beginPath();ctx.moveTo(190,H-50);ctx.lineTo(W-190,H-50);ctx.lineTo(W-170,H-26);ctx.lineTo(W-190,H-6);ctx.lineTo(190,H-6);ctx.lineTo(170,H-26);ctx.closePath();ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#2a1a10';ctx.stroke();
  ctx.fillStyle='#f2e3c0';ctx.font='bold 30px Georgia,serif';ctx.fillText(gameId==='parada'?'EL AUTOBÚS':'LA CHANCLA',W/2,H-27);
  const lines=ctx.createLinearGradient(0,0,W,0);ctx.restore();}
function frameFelt(){ctx.save();ctx.setLineDash([9,7]);ctx.lineWidth=3;ctx.strokeStyle='#fff6dc';ctx.strokeRect(12,12,W-24,H-24);ctx.setLineDash([]);
  const gr=ctx.createRadialGradient(400,300,300,400,300,560);gr.addColorStop(0,'rgba(60,35,10,0)');gr.addColorStop(1,'rgba(60,35,10,.4)');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);ctx.restore();}

function frameExvoto(){ctx.save();
  /* heavenly apparition, top-left */
  ctx.fillStyle='rgba(255,236,150,.5)';for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(100,70);const a=-Math.PI*.1+i*.2;ctx.lineTo(100+Math.cos(a)*230,70+Math.sin(a)*230);ctx.lineTo(100+Math.cos(a+.07)*230,70+Math.sin(a+.07)*230);ctx.closePath();ctx.fill();}
  ell(70,86,44,20,'#f4f1ea',3);ell(112,76,40,22,'#f4f1ea',3);ell(140,92,36,16,'#ffffff',3);
  poly([[84,44],[116,44],[130,92],[70,92]],'#3d5fb8',3.5);ell(100,36,13,14,'#e8b48a',3);ell(100,36,22,22,'#ffe14d',0);ell(100,36,13,14,'#e8b48a',3);
  ctx.restore();}
function exvotoPlate(){ctx.fillStyle='#6f7b88';ctx.fillRect(0,0,W,H);
  for(let i=0;i<46;i++){ctx.fillStyle=`rgba(${120+hash(i,1,1)*60|0},${60+hash(i,2,2)*30|0},20,${.1+hash(i,3,3)*.18})`;ctx.beginPath();ctx.ellipse(hash(i,4,4)*W,hash(i,5,5)*H,6+hash(i,6,6)*26,4+hash(i,7,7)*16,hash(i,8,8)*3,0,TAU);ctx.fill();}
  ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;for(let i=0;i<30;i++){ctx.beginPath();const x=hash(i,9,9)*W,y=hash(i,10,10)*H;ctx.moveTo(x,y);ctx.lineTo(x+hash(i,11,11)*60-30,y+hash(i,12,12)*20-10);ctx.stroke();}
  ctx.fillStyle='#3a2418';for(const[x,y]of[[18,18],[W-18,18],[18,H-18],[W-18,H-18]]){ctx.beginPath();ctx.arc(x,y,5,0,TAU);ctx.fill();}}
function captionExvoto(){ctx.save();const T=gameId==='parada'?['DOY GRACIAS A LA VIRGEN DEL VALLE POR HABERME','BAJADO EN MI PARADA. CARACAS, 2026']:['AGRADEZCO A LA VIRGEN Y AL NIÑO JESÚS POR HABER','ESQUIVADO LA CHANCLA DE MI MADRE. CARACAS, 2026'];
  ctx.fillStyle='#2a1a10';ctx.fillRect(56,544,W-112,48);ctx.strokeStyle='#d9b878';ctx.lineWidth=2;ctx.strokeRect(60,548,W-120,40);
  ctx.fillStyle='#f4e6c0';ctx.font='bold 15px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(T[0],W/2,notch(560));ctx.fillText(T[1],W/2,notch(578));ctx.restore();}
const notch=v=>v;
function frameMola(){ctx.save();const t=18;ctx.fillStyle='#0c0a12';ctx.fillRect(0,0,W,t);ctx.fillRect(0,H-t,W,t);ctx.fillRect(0,0,t,H);ctx.fillRect(W-t,0,t,H);
  for(let x=0;x<W;x+=26){for(const[y,dir]of[[t,-1],[H-t,1]]){ctx.fillStyle=(x/26)%2?'#ff7a1a':'#ffd23f';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+13,y+dir*11);ctx.lineTo(x+26,y);ctx.fill();}}
  for(let y=0;y<H;y+=26){for(const[x,dir]of[[t,-1],[W-t,1]]){ctx.fillStyle=(y/26)%2?'#3fd0ff':'#ff3b6a';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dir*11,y+13);ctx.lineTo(x,y+26);ctx.fill();}}
  ctx.restore();}
function frameCordel(){ctx.save();ctx.strokeStyle='#1a1410';ctx.lineWidth=9;ctx.strokeRect(10,10,W-20,H-20);ctx.lineWidth=2;ctx.strokeRect(24,24,W-48,H-48);
  ctx.fillStyle='#1a1410';ctx.fillRect(170,H-44,W-340,32);ctx.fillStyle='#f1e7d0';ctx.font='20px Impact,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(gameId==='parada'?'EL AUTOBÚS DE LA ABUELA · CORDEL':'LA CHANCLA DE MAMÁ · CORDEL',W/2,H-28);ctx.restore();}
function frameWood(){ctx.save();const t=22;ctx.fillStyle='#8a5a30';ctx.fillRect(0,0,W,t);ctx.fillRect(0,H-t,W,t);ctx.fillRect(0,0,t,H);ctx.fillRect(W-t,0,t,H);
  ctx.strokeStyle='rgba(60,30,10,.5)';ctx.lineWidth=1.5;for(let i=0;i<40;i++){ctx.beginPath();const y=hash(i,1,1)*t;ctx.moveTo(hash(i,2,2)*W,y);ctx.lineTo(hash(i,2,2)*W+60,y+1);ctx.stroke();}
  ctx.strokeStyle='#3a2410';ctx.lineWidth=4;ctx.strokeRect(t,t,W-2*t,H-2*t);ctx.strokeRect(1,1,W-2,H-2);
  ctx.fillStyle='#c9ced6';for(const[x,y]of[[11,11],[W-11,11],[11,H-11],[W-11,H-11]]){ctx.beginPath();ctx.arc(x,y,6,0,TAU);ctx.fill();ctx.strokeStyle='#3a2410';ctx.lineWidth=2;ctx.stroke();}ctx.restore();}
const XPAL=PAL;const XLUT=new Int8Array(1<<18).fill(-1);
function postXStitch(){const id=xctx.getImageData(0,0,XW,XH),d=id.data,paths=XPAL.map(()=>new Path2D());
  for(let y=0;y<XH;y++)for(let x=0;x<XW;x++){const i=(y*XW+x)*4,r=d[i],g=d[i+1],b=d[i+2],key=((r>>2)<<12)|((g>>2)<<6)|(b>>2);let p=XLUT[key];
    if(p<0){const rr_=r|2,gg=g|2,bb=b|2;let best=1e9;p=0;for(let j=0;j<32;j++){const q=XPAL[j],e=(q[0]-rr_)**2*.9+(q[1]-gg)**2*1.2+(q[2]-bb)**2*.8;if(e<best){best=e;p=j;}}XLUT[key]=p;}
    const P=paths[p],X=x*4,Y=y*4;P.moveTo(X+.9,Y+.9);P.lineTo(X+3.1,Y+3.1);P.moveTo(X+3.1,Y+.9);P.lineTo(X+.9,Y+3.1);}
  ctx=OUTX;ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#efe6cf';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(120,100,60,.12)';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<W;x+=4){ctx.moveTo(x,0);ctx.lineTo(x,H);}for(let y=0;y<H;y+=4){ctx.moveTo(0,y);ctx.lineTo(W,y);}ctx.stroke();
  ctx.lineCap='round';ctx.lineWidth=2.2;
  XPAL.forEach((q,j)=>{ctx.save();ctx.translate(.7,1);ctx.strokeStyle='rgba(40,25,10,.28)';ctx.stroke(paths[j]);ctx.restore();ctx.strokeStyle='rgb('+q[0]+','+q[1]+','+q[2]+')';ctx.stroke(paths[j]);});}

function frameCromo(){ctx.save();
  /* foil sweep over the whole card */
  const u=((now*.35)%1.8)-.4,gx=u*W;const g=ctx.createLinearGradient(gx-160,0,gx+160,H*.5);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.28)');g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.lineWidth=14;ctx.strokeStyle='#f6f2e4';ctx.strokeRect(7,7,W-14,H-14);
  ctx.fillStyle='#ffd23f';ctx.fillRect(14,H-100,W-28,10);ctx.fillStyle='#1e4fc4';ctx.fillRect(14,H-90,W-28,10);ctx.fillStyle='#d9372f';ctx.fillRect(14,H-80,W-28,10);
  ctx.fillStyle='#14101c';ctx.fillRect(14,H-70,W-28,56);
  ctx.fillStyle='#ffd23f';ctx.font='34px Impact,sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(gameId==='parada'?'EL COLECTOR':'MAMÁ CHANCLA',30,H-48);
  ctx.fillStyle='#ffffff';ctx.font='bold 14px Arial,sans-serif';ctx.fillText(gameId==='parada'?'COLECTOR  ·  BUSETA CATIA-PETARE  ·  #23':'LANZADORA  ·  SALA FAMILIAR  ·  #07',32,H-24);
  ctx.textAlign='right';ctx.fillStyle='#fff';ctx.font='bold 15px Arial,sans-serif';ctx.fillText(gameId==='parada'?'PARADAS 1.000 · BAILE 99':'PUNTERÍA 99 · FUERZA 87',W-30,H-24);
  ctx.fillStyle='#d9372f';ctx.beginPath();for(let i=0;i<10;i++){const a=i/10*TAU-Math.PI/2,r=i%2?16:32;ctx.lineTo(70+Math.cos(a)*r,70+Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.lineWidth=4;ctx.strokeStyle='#fff';ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='bold 13px Arial,sans-serif';ctx.textAlign='center';ctx.fillText('LEYENDA',70,72);ctx.restore();}
function frameAlma(){ctx.save();
  const vg=ctx.createRadialGradient(400,300,280,400,300,600);vg.addColorStop(0,'rgba(160,110,30,0)');vg.addColorStop(1,'rgba(160,110,30,.28)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#b3261e';ctx.fillRect(40,498,W-80,30);ctx.fillStyle='#fff3d0';ctx.font='bold 17px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('BODEGA LA ESPERANZA  ·  "AQUÍ SÍ SE FÍA MAÑANA"  ·  Tlf. 0212-555-0123',W/2,513);
  ctx.fillStyle='#fffbea';ctx.fillRect(40,528,W-80,62);ctx.strokeStyle='#b3261e';ctx.lineWidth=3;ctx.strokeRect(40,528,W-80,62);
  ctx.fillStyle='#b3261e';ctx.font='bold 30px Georgia,serif';ctx.textAlign='left';ctx.fillText('OCT',54,548);ctx.font='bold 18px Georgia,serif';ctx.fillStyle='#2a1a10';ctx.fillText('2026',58,574);
  ctx.font='bold 14px Georgia,serif';ctx.textAlign='center';for(let d=1;d<=31;d++){const col=(d-1)%16,row=Math.floor((d-1)/16);const x=150+col*34,y=543+row*26;ctx.fillStyle=(d%7===4)?'#b3261e':'#2a1a10';ctx.fillText(String(d),x,y);}
  ctx.strokeStyle='rgba(60,40,10,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(40,598);ctx.lineTo(W-40,598);ctx.setLineDash([6,5]);ctx.stroke();ctx.restore();}
function frameVitral(){ctx.save();ctx.fillStyle='#5a5560';ctx.fillRect(0,0,W,H);ctx.strokeStyle='rgba(20,16,28,.5)';ctx.lineWidth=2;
  for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();for(let x=((y/40)%2)*40;x<W;x+=80){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+40);ctx.stroke();}}
  ctx.restore();}
function vitralArch(){const p=new Path2D();p.moveTo(70,560);p.lineTo(70,250);p.bezierCurveTo(70,130,260,20,400,6);p.bezierCurveTo(540,20,730,130,730,250);p.lineTo(730,560);p.closePath();return p;}
function frameVitralTop(){ctx.save();const arch=vitralArch();ctx.lineWidth=10;ctx.strokeStyle='#2a2630';ctx.stroke(arch);ctx.lineWidth=3;ctx.strokeStyle='#8a8494';ctx.translate(0,0);ctx.stroke(arch);
  ctx.globalCompositeOperation='lighter';for(let i=0;i<6;i++){ctx.fillStyle='rgba(255,230,150,'+(.05+.04*Math.sin(now*1.3+i))+')';ctx.beginPath();const a=-1.15+i*.4;ctx.moveTo(400,0);ctx.lineTo(400+Math.cos(a+1.57)*700,Math.sin(a+1.57)*700);ctx.lineTo(400+Math.cos(a+1.57+.12)*700,Math.sin(a+1.57+.12)*700);ctx.fill();}
  ctx.globalCompositeOperation='source-over';ctx.fillStyle='#2a2630';ctx.fillRect(70,560,660,38);ctx.fillStyle='#e8c25a';ctx.font='bold 22px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(gameId==='parada'?'SAN CHOFER DE LA BUSETA':'NUESTRA SEÑORA DE LA CHANCLA',W/2,580);ctx.restore();}
function frameEtiq(){ctx.save();
  ctx.fillStyle='#1c2e5c';ctx.fillRect(0,0,W,H);ctx.fillStyle='#f3e6c4';ctx.fillRect(16,16,W-32,H-32);
  ctx.fillStyle='#1c2e5c';for(let x=30;x<W-20;x+=22){for(const y of[16,H-16]){ctx.beginPath();ctx.arc(x,y,9,0,TAU);ctx.fill();}}for(let y=30;y<H-20;y+=22){for(const x of[16,W-16]){ctx.beginPath();ctx.arc(x,y,9,0,TAU);ctx.fill();}}
  ctx.lineWidth=4;ctx.strokeStyle='#d9a520';ctx.strokeRect(30,30,W-60,H-60);ctx.lineWidth=2;ctx.strokeStyle='#1c2e5c';ctx.strokeRect(38,38,W-76,H-76);
  ctx.fillStyle='#c4283a';ctx.beginPath();ctx.moveTo(120,H-78);ctx.lineTo(W-120,H-78);ctx.lineTo(W-100,H-50);ctx.lineTo(W-120,H-22);ctx.lineTo(120,H-22);ctx.lineTo(100,H-50);ctx.closePath();ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#1c2e5c';ctx.stroke();
  ctx.fillStyle='#f3e6c4';ctx.font='bold 28px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(gameId==='parada'?'BUSETA EXPRESS · LA DE SIEMPRE':'CHANCLA ORIGINAL · DE MAMÁ',W/2,H-52);
  ctx.fillStyle='#d9a520';ctx.beginPath();ctx.arc(76,82,36,0,TAU);ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#1c2e5c';ctx.stroke();ctx.fillStyle='#1c2e5c';ctx.font='bold 22px Georgia,serif';ctx.fillText('Nº 1',76,82);
  ctx.font='11px Georgia,serif';ctx.fillText('MARCA REGISTRADA',W-110,52);ctx.restore();}
function etiqTop(){ctx.save();ctx.fillStyle='#d9a520';ctx.beginPath();ctx.arc(76,82,36,0,TAU);ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#1c2e5c';ctx.stroke();ctx.fillStyle='#1c2e5c';ctx.font='bold 22px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Nº 1',76,82);ctx.font='11px Georgia,serif';ctx.fillText('MARCA REGISTRADA',W-110,52);ctx.restore();}

const BAY4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function postGB(){const id=xctx.getImageData(0,0,XW,XH),d=id.data,G4=[[15,56,15],[48,98,48],[139,172,15],[155,188,15]];
  for(let y=0;y<XH;y++)for(let x=0;x<XW;x++){const i=(y*XW+x)*4;let l=(d[i]*.3+d[i+1]*.59+d[i+2]*.11)/255;l=clamp((l-.55)*1.9+.5,0,1)+((BAY4[(y&3)*4+(x&3)]/16)-.5)*.1;
    const k=l<.3?0:l<.52?1:l<.75?2:3,c=G4[k];d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255;}
  xctx.putImageData(id,0,0);
  OUTX.setTransform(1,0,0,1,0,0);OUTX.imageSmoothingEnabled=false;OUTX.globalAlpha=1;OUTX.drawImage(xc,0,0,W,H);OUTX.globalAlpha=.16;OUTX.drawImage(gbPrev,0,0,W,H);OUTX.globalAlpha=1;
  const g=gbPrev.getContext('2d');g.drawImage(xc,0,0);
  OUTX.fillStyle='rgba(15,56,15,.12)';for(let x=0;x<W;x+=4)OUTX.fillRect(x,0,1,H);for(let y=0;y<H;y+=4)OUTX.fillRect(0,y,W,1);
  const gr=OUTX.createRadialGradient(400,300,300,400,300,560);gr.addColorStop(0,'rgba(15,56,15,0)');gr.addColorStop(1,'rgba(15,56,15,.4)');OUTX.fillStyle=gr;OUTX.fillRect(0,0,W,H);
  OUTX.fillStyle='rgba(15,56,15,.9)';OUTX.font='bold 14px "Arial Black",sans-serif';OUTX.textAlign='left';OUTX.textBaseline='top';OUTX.fillText('DOT MATRIX WITH STEREO SOUND',14,H-24);}
function postPS1(){const id=pctx.getImageData(0,0,P1W,P1H),d=id.data;
  for(let y=0;y<P1H;y++)for(let x=0;x<P1W;x++){const i=(y*P1W+x)*4,o=(BAY4[(y&3)*4+(x&3)]/16-.5)*14;for(let c=0;c<3;c++){const v=clamp(d[i+c]+o,0,255);d[i+c]=Math.round(v/255*31)/31*255;}d[i+3]=255;}
  pctx.putImageData(id,0,0);OUTX.setTransform(1,0,0,1,0,0);OUTX.imageSmoothingEnabled=false;OUTX.drawImage(pc,0,0,W,H);
  const fog=OUTX.createLinearGradient(0,0,0,H*.55);fog.addColorStop(0,'rgba(170,190,215,.0)');fog.addColorStop(1,'rgba(170,190,215,.0)');OUTX.fillStyle=fog;OUTX.fillRect(0,0,W,H);
  OUTX.fillStyle='rgba(0,0,0,.1)';for(let y=0;y<H;y+=2.5)OUTX.fillRect(0,y,W,1);}
function postGW(){const id=s2ctx.getImageData(0,0,S2W,S2H),d=id.data,bg=new ImageData(S2W,S2H),ink=new ImageData(S2W,S2H),B=bg.data,K=ink.data;
  for(let i=0;i<d.length;i+=4){const l=(d[i]*.3+d[i+1]*.59+d[i+2]*.11)/255;
    if(l<.3){B[i]=190;B[i+1]=194;B[i+2]=172;B[i+3]=255;K[i]=24;K[i+1]=26;K[i+2]=22;K[i+3]=255;}
    else{B[i]=d[i]*.38+201*.62;B[i+1]=d[i+1]*.38+205*.62;B[i+2]=d[i+2]*.38+184*.62;B[i+3]=255;}}
  gwBg.getContext('2d').putImageData(bg,0,0);gwInk.getContext('2d').putImageData(ink,0,0);
  const g=gwGhost.getContext('2d');g.globalCompositeOperation='destination-out';g.fillStyle='rgba(0,0,0,.1)';g.fillRect(0,0,S2W,S2H);g.globalCompositeOperation='source-over';g.globalAlpha=.3;g.drawImage(gwInk,0,0);g.globalAlpha=1;
  OUTX.setTransform(1,0,0,1,0,0);OUTX.imageSmoothingEnabled=true;OUTX.drawImage(gwBg,0,0,W,H);OUTX.globalAlpha=.55;OUTX.drawImage(gwGhost,0,0,W,H);OUTX.globalAlpha=1;OUTX.drawImage(gwInk,0,0,W,H);
  const gr=OUTX.createRadialGradient(400,300,280,400,300,560);gr.addColorStop(0,'rgba(60,60,40,0)');gr.addColorStop(1,'rgba(60,60,40,.25)');OUTX.fillStyle=gr;OUTX.fillRect(0,0,W,H);}
function frameGW(){ctx.save();ctx.fillStyle='#d6b25a';ctx.fillRect(0,0,W,34);ctx.fillRect(0,H-58,W,58);ctx.fillRect(0,0,26,H);ctx.fillRect(W-26,0,26,H);
  ctx.strokeStyle='#6a5320';ctx.lineWidth=4;ctx.strokeRect(26,34,W-52,H-92);ctx.fillStyle='#2a2a2a';ctx.font='bold 17px "Arial Black",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('BUSETA & WATCH  ·  MULTI SCREEN',W/2,17);
  ctx.fillStyle='#b8352a';for(const[x,t]of[[200,'GAME A'],[400,'GAME B'],[600,'TIME']]){ctx.beginPath();ctx.arc(x,H-30,13,0,TAU);ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#4a1510';ctx.stroke();ctx.fillStyle='#2a2a2a';ctx.font='bold 12px Arial,sans-serif';ctx.fillText(t,x,H-12);ctx.fillStyle='#b8352a';}
  ctx.restore();}
function frameWii(){ctx.save();const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#f4f8fc');g.addColorStop(1,'#cfdbe8');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(120,160,200,.14)';for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(60+i*190,560,80+i*6,0,TAU);ctx.fill();}
  ctx.restore();}
function wiiTop(){ctx.save();ctx.lineWidth=6;ctx.strokeStyle='#ffffff';rrP2(46,22,W-92,H-110,26);ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='#8fb4dc';rrP2(46,22,W-92,H-110,26);ctx.stroke();
  ctx.fillStyle='#ffffff';rrP2(20,H-70,W-40,56,28);ctx.fill();ctx.strokeStyle='#c3d3e4';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='#4a6a8a';ctx.font='bold 22px "Arial Rounded MT Bold",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(gameId==='parada'?'Canal ¡Parada!':'Canal ¡Chancla!',W/2,H-42);
  ctx.fillStyle='#e8f1fb';rrP2(40,H-62,110,40,20);ctx.fill();ctx.stroke();rrP2(W-150,H-62,110,40,20);ctx.fill();ctx.stroke();
  ctx.fillStyle='#4a6a8a';ctx.font='bold 17px Arial,sans-serif';ctx.fillText('Menú Wii',95,H-42);ctx.fillText('vie 9/10',W-95,H-42);ctx.restore();}
function rrP2(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

const fxc=document.createElement('canvas');fxc.width=W;fxc.height=H;const fxx=fxc.getContext('2d');
function bloomFX(a){try{fxx.setTransform(1,0,0,1,0,0);fxx.globalCompositeOperation='source-over';fxx.clearRect(0,0,W,H);fxx.filter='blur(9px) brightness(1.15)';fxx.drawImage(OUTX.canvas,0,0);fxx.filter='none';
  OUTX.save();OUTX.setTransform(1,0,0,1,0,0);OUTX.globalCompositeOperation='screen';OUTX.globalAlpha=a;OUTX.drawImage(fxc,0,0);OUTX.restore();}catch(e){}}
function tiltShift(){try{fxx.setTransform(1,0,0,1,0,0);fxx.globalCompositeOperation='source-over';fxx.clearRect(0,0,W,H);fxx.filter='blur(5px)';fxx.drawImage(OUTX.canvas,0,0);fxx.filter='none';
  fxx.globalCompositeOperation='destination-in';const g=fxx.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.2,'rgba(0,0,0,0)');g.addColorStop(.74,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,1)');fxx.fillStyle=g;fxx.fillRect(0,0,W,H);fxx.globalCompositeOperation='source-over';
  OUTX.save();OUTX.setTransform(1,0,0,1,0,0);OUTX.drawImage(fxc,0,0);OUTX.restore();}catch(e){}}
function heartP(x,y,sz,col){ctx.save();ctx.translate(x,y);ctx.scale(sz,sz);ctx.beginPath();ctx.moveTo(0,6);ctx.bezierCurveTo(-14,-4,-8,-14,0,-6);ctx.bezierCurveTo(8,-14,14,-4,0,6);ctx.closePath();ctx.fillStyle=col;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#2a1a3a';ctx.stroke();ctx.restore();}
function frameLetterbox(){ctx.save();ctx.fillStyle='#0a0810';ctx.fillRect(0,0,W,28);ctx.fillRect(0,H-28,W,28);const gr=ctx.createRadialGradient(400,300,300,400,300,560);gr.addColorStop(0,'rgba(40,10,0,0)');gr.addColorStop(1,'rgba(40,10,0,.3)');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);ctx.restore();}
function frameAcnh(){ctx.save();ctx.fillStyle='#a8dcc0';ctx.beginPath();ctx.rect(0,0,W,H);{const x=18,y=18,w=W-36,h=H-36,r=36;ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}ctx.fill('evenodd');ctx.strokeStyle='#ffffff';ctx.lineWidth=5;rrP2(18,18,W-36,H-36,36);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.55)';for(let i=0;i<24;i++){const x=(i*37)%W,y=i%2?7:H-7;ctx.beginPath();ctx.arc(x+10,y,4,0,TAU);ctx.fill();}ctx.restore();}
function frameWW(){ctx.save();for(let i=0;i<4;i++)heartP(34+i*30,48,1.1,i<3?'#ff4d5e':'#ffd0d4');
  ctx.fillStyle='#3ddc7a';ctx.beginPath();ctx.moveTo(W-74,36);ctx.lineTo(W-62,28);ctx.lineTo(W-50,36);ctx.lineTo(W-50,58);ctx.lineTo(W-62,66);ctx.lineTo(W-74,58);ctx.closePath();ctx.fill();ctx.lineWidth=2.4;ctx.strokeStyle='#14501f';ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='bold 22px "Arial Rounded MT Bold",sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';ctx.strokeStyle='#14101c';ctx.lineWidth=4;ctx.strokeText('1000',W-82,48);ctx.fillText('1000',W-82,48);ctx.restore();}

function frameMario(){ctx.save();ctx.font='bold 16px "Arial Black",sans-serif';ctx.textBaseline='middle';ctx.lineWidth=4;ctx.strokeStyle='#14101c';ctx.fillStyle='#fff';
  const T=[['BUSETA',70],['000150',70],['◉ × 05',300],['MUNDO',460],['1-1',460],['TIEMPO',690],['300',690]];ctx.textAlign='center';
  for(const[t,x]of[['BUSETA',90],['MUNDO',330],['TIEMPO',560],['MONEDAS',730]]){ctx.strokeText(t,x,16);ctx.fillText(t,x,16);}
  for(const[t,x]of[['000150',90],['1-1',330],['300',560],['× 05',730]]){ctx.strokeText(t,x,38);ctx.fillText(t,x,38);}ctx.restore();}
function frameBean(){ctx.save();for(let i=0;i<26;i++){const t=(now*.18+hash(i,1,1))%1,x=hash(i,2,2)*W,y=t*(H+40)-20;ctx.save();ctx.translate(x,y);ctx.rotate(t*8+i);ctx.fillStyle=['#ff4d9a','#ffd23f','#4dd0ff','#7cff7a','#a56bff'][i%5];ctx.fillRect(-6,-3,12,6);ctx.restore();}ctx.restore();}
function frameSplat(){ctx.save();ctx.fillStyle='#0a0418';rrP2(W-258,10,248,26,13);ctx.fill();ctx.save();rrP2(W-254,14,240,18,9);ctx.clip();ctx.fillStyle='#ff2e93';ctx.fillRect(W-254,14,100,18);ctx.fillStyle='#7cff00';ctx.fillRect(W-154,14,140,18);ctx.restore();
  ctx.fillStyle='#fff';ctx.font='bold 12px Arial,sans-serif';ctx.textBaseline='middle';ctx.fillText('41.7%',W-246,23);ctx.textAlign='right';ctx.fillText('58.3%',W-20,23);ctx.restore();}
function frameCandy(){ctx.save();const pill=(x,y,w,t,c)=>{ctx.fillStyle='#3a1a60';rrP2(x,y,w,30,15);ctx.fill();ctx.fillStyle=c;rrP2(x+3,y+3,w-6,24,12);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 15px "Arial Rounded MT Bold",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,x+w/2,y+15);};
  pill(14,12,190,'MOVIMIENTOS 5','#ff5da8');pill(W-204,12,190,'PUNTOS 3.200','#ffb12a');ctx.restore();}
function paintFrame(){const S=STY[style],f=S.fps;lastPaint=now;FRJ=f?Math.floor(now*f):0;sid=0;
  OUTX=vhsOn?bctx:vctx;
  if(style==='pixel'){ctx=sctx;ctx.setTransform(PW/W,0,0,PH/H,0,0);}else if(style==='xstitch'||style==='gb'){ctx=xctx;ctx.setTransform(XW/W,0,0,XH/H,0,0);}else if(style==='ps1'){ctx=pctx;ctx.setTransform(P1W/W,0,0,P1H/H,0,0);}else if(style==='gw'){ctx=s2ctx;ctx.setTransform(S2W/W,0,0,S2H/H,0,0);}else if(style==='snes'){ctx=s2ctx;ctx.setTransform(S2W/W,0,0,S2H/H,0,0);}else{ctx=OUTX;ctx.setTransform(1,0,0,1,0,0);}
  ctx.fillStyle=S.paper;ctx.fillRect(0,0,W,H);
  if(style==='gw'){ctx.save();ctx.translate(30,38);ctx.scale(.9,.9);ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();G.draw();hud();ctx.restore();}
  else if(style==='wii'){frameWii();ctx.save();ctx.translate(58,34);ctx.scale(.85,.8);ctx.beginPath();rrP2(0,0,W,H,40);ctx.clip();G.draw();hud();ctx.restore();wiiTop();}
  else if(style==='cromo'){ctx.save();ctx.translate(36,22);ctx.scale(.9,.84);ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();G.draw();hud();ctx.restore();frameCromo();}
  else if(style==='alma'){ctx.save();ctx.translate(60,14);ctx.scale(.84,.84);ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();G.draw();hud();ctx.restore();frameAlma();}
  else if(style==='vitral'){frameVitral();ctx.save();ctx.translate(70,40);ctx.scale(.82,.82);ctx.save();ctx.translate(-70/.82,-40/.82);ctx.restore();ctx.restore();
    ctx.save();ctx.clip(vitralArch());ctx.translate(70,52);ctx.scale(.825,.84);G.draw();hud();ctx.restore();frameVitralTop();}
  else if(style==='etiq'){frameEtiq();ctx.save();ctx.translate(58,50);ctx.scale(.82,.76);ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();G.draw();hud();ctx.restore();etiqTop();}
  else if(style==='exvoto'){exvotoPlate();ctx.save();ctx.translate(56,20);ctx.scale(.86,.86);ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();G.draw();hud();ctx.restore();frameExvoto();captionExvoto();}
  else if(style==='cordel'){ctx.save();ctx.translate(40,26);ctx.scale(.9,.88);ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();G.draw();hud();ctx.restore();frameCordel();}
  else if(style==='lote'){ctx.save();ctx.translate(46,24);ctx.scale(.885,.885);ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();G.draw();hud();ctx.restore();frameLote();}
  else{G.draw();
    if(style==='anime'&&G.impact>0)focusLines(G.impact);
    hud();
    if(style==='rotu')frameRotu();else if(style==='felt')frameFelt();else if(style==='mola')frameMola();}
  if(style==='pixel')postPixel();
  else if(style==='gb')postGB();
  else if(style==='ps1')postPS1();
  else if(style==='gw'){postGW();ctx=OUTX;ctx.setTransform(1,0,0,1,0,0);frameGW();}
  else if(style==='xstitch'){postXStitch();frameWood();}
  else if(style==='snes')postSNES();
  else if(style==='arcade'){ctx.fillStyle='rgba(0,0,0,.12)';for(let y=0;y<H;y+=3)ctx.fillRect(0,y,W,1);const gr=ctx.createRadialGradient(400,300,300,400,300,540);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(10,0,30,.35)');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);}
  else if(style==='hose')filmOverlay();
  else if(style==='riso')grainOverlay(.55);
  else if(style==='acuarela'){grainOverlay(.65);const gr=ctx.createRadialGradient(400,300,330,400,300,560);gr.addColorStop(0,'rgba(120,90,40,0)');gr.addColorStop(1,'rgba(120,90,40,.2)');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);}
  else if(style==='tinta'){const gr=ctx.createRadialGradient(400,300,300,400,300,520);gr.addColorStop(0,'rgba(20,16,28,0)');gr.addColorStop(1,'rgba(20,16,28,.22)');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);}
  if(style==='mario'){ctx=OUTX;ctx.setTransform(1,0,0,1,0,0);frameMario();}
  else if(style==='bean'){bloomFX(.15);ctx=OUTX;ctx.setTransform(1,0,0,1,0,0);frameBean();}
  else if(style==='splat'){ctx=OUTX;ctx.setTransform(1,0,0,1,0,0);frameSplat();}
  else if(style==='candy'){bloomFX(.25);ctx=OUTX;ctx.setTransform(1,0,0,1,0,0);frameCandy();}
  else if(style==='pixar'){bloomFX(.3);ctx=OUTX;ctx.setTransform(1,0,0,1,0,0);frameLetterbox();}
  else if(style==='acnh'){tiltShift();ctx=OUTX;ctx.setTransform(1,0,0,1,0,0);frameAcnh();}
  else if(style==='ww'){ctx=OUTX;ctx.setTransform(1,0,0,1,0,0);frameWW();}
  else if(style==='ghibli'){bloomFX(.22);ctx=OUTX;ctx.setTransform(1,0,0,1,0,0);grainOverlay(.3);const gr=ctx.createRadialGradient(400,300,330,400,300,570);gr.addColorStop(0,'rgba(255,200,120,0)');gr.addColorStop(1,'rgba(255,180,100,.18)');ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);}
  if(vhsOn)postVHS();
  if(document.getElementById('info'))document.getElementById('info').textContent=micOn?'mic '+Math.round(micLevel()*100):'';}
function tick(dt){now+=dt;G.update(dt);updP(dt);
  if(micOn&&gameId==='parada'&&micLevel()>.22)G.press('any');
  if(G.result&&G.endT>2.3)restart();}
function frame(ts){const dt=Math.min(.05,(ts-last)/1000);last=ts;
  if(G||window.CAMP){tick(dt);const f=STY[style].fps;if(!f||now-lastPaint>=1/f)paintFrame();}
  requestAnimationFrame(frame);}
requestAnimationFrame(frame);
