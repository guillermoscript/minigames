'use strict';
/* LA FIESTA · minijuegos VERSUS (2-4 jugadores a la vez en una sola pantalla). Se carga DESPUÉS de index.html y juegos-bus.js.

   CONTRATO de un juego versus (juego-f-*.js):
     FIESTA.VS.add('id',{ name:'¡NOMBRE!', modos:['ffa','2v2','1v3'], dur:20, botones:1|2, hint:'...', mk(c){ ...; return g; } })
     c  = { n, modo, equipos:[equipo por jugador], solo:id|-1 (el 1 del 1v3), lv:1..3, rng (sembrado: c.rng.next()/int/pick/shuffle),
            cpu:[bool por jugador], skill:[0..1 por CPU], held(p,'a'|'b') -> bool, tap(p,'a'|'b') -> cuenta de toques nuevos (la consume),
            col:[color por jugador], campoAbajo:508 (el campo de juego acaba aquí; debajo van los pads táctiles) }
     g  = { update(dt), draw(), scores:[número por jugador, más = mejor], fin:bool (lo pone el juego cuando acaba),
            finish?() (opcional: se llama al agotarse dur; debe poner fin=true), ai?(p,dt,api) (OBLIGATORIO: mueve a las CPU;
            api.press('a'|'b') toca, api.hold('a'|'b',bool) mantiene; c.skill[p] marca la habilidad),
            hint?, dur? }
   Pantalla: 800x600 de diseño; los 64 px de ARRIBA los pinta el reloj/orden del laboratorio (no dibujar nada importante ahí) y desde y=508 hacia abajo están los pads; usar gameLeft()/gameRight() para el ancho extra. Dibujar SOLO con las primitivas del laboratorio
   (rr, ell, line, poly, txt, bust, FACES, BUS.AP...) para que salga en todos los estilos. Nunca usar Math.random: usar c.rng.
   Resultado (lo calcula este archivo): FIESTA.VS.ultimo = { modo, equipos, scores, puestos:[puesto 1..n por jugador, empates comparten],
            ganadores:[ids], equipoGanador }. Para 2v2 y 1v3 el puntaje de equipo = suma de scores del equipo (1v3: el solo contra
            el MEJOR del trío... ver compara()). */
(function(){
if(!window.BUS||(window.FIESTA&&window.FIESTA.VS))return;
const F=window.FIESTA=window.FIESTA||{};
const PCOL=['#ff5c8a','#3fb0ff','#ffd23f','#5cff7a'];
const KEYS=[['KeyA','KeyS'],['KeyF','KeyG'],['KeyJ','KeyK'],['ArrowLeft','ArrowRight']];
const KEYLBL=[['A','S'],['F','G'],['J','K'],['◄','►']];
const PAD_Y=514,PAD_H=78;
const q=new URLSearchParams(location.search);
const cfg={modo:q.get('modo')||'ffa',n:+q.get('n')||4,humanos:q.has('humanos')?+q.get('humanos'):1,lv:+q.get('nivel')||1,seed:+q.get('seed')||0,solo:q.has('solo')?+q.get('solo'):-1,auto:q.has('auto')};
const held=[0,1,2,3].map(()=>({a:0,b:0})),edge=[0,1,2,3].map(()=>({a:0,b:0})),ptrs=new Map();
let cur=null;                                                   /* contexto del juego en marcha */
const live=()=>typeof gameId==='string'&&gameId.indexOf('vs-')===0&&G&&G.__vs;

/* ───── rng sembrado (mulberry32; mismo algoritmo que fiesta-rng.js) ───── */
function rngMk(seed){let s=(seed>>>0)||1;const r={next(){s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;},
  int(a,b){return a+Math.floor(r.next()*(b-a+1));},pick(a){return a[Math.floor(r.next()*a.length)];},
  shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r.next()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}};return r;}

/* ───── equipos ───── */
function equipos(modo,n,solo){
  if(modo==='2v2'&&n===4)return[0,0,1,1];
  if(modo==='1v3'&&n===4){const s=solo>=0?solo:0;return[0,1,2,3].map(i=>i===s?0:1);}
  return[...Array(n).keys()];                                   /* ffa (y 2-3 jugadores): cada quien su equipo */
}
/* ───── puestos y ganadores ─────
   ffa: por score individual. 2v2: equipos por suma de scores. 1v3: el solo contra el trío por la media del trío (así el 1 no
   lleva ventaja numérica); gana el solo si su score supera la media del trío. */
function compara(modo,eq,sc){
  const n=sc.length,team={};eq.forEach((t,i)=>(team[t]=team[t]||[]).push(i));
  const ts=Object.keys(team).map(t=>({t:+t,ids:team[t],v:modo==='1v3'?(team[t].length===1?sc[team[t][0]]:team[t].reduce((a,i)=>a+sc[i],0)/team[t].length):team[t].reduce((a,i)=>a+sc[i],0)}));
  ts.sort((a,b)=>b.v-a.v);
  const puestoEq={};ts.forEach((x,i)=>{puestoEq[x.t]=i>0&&Math.abs(ts[i-1].v-x.v)<1e-9?puestoEq[ts[i-1].t]:i+1;});
  const puestos=eq.map(t=>puestoEq[t]),best=Math.min(...puestos);
  return{puestos,ganadores:puestos.map((p,i)=>p===best?i:-1).filter(i=>i>=0),equipoGanador:ts[0].t,tabla:ts};
}

/* ───── pads táctiles (también clic en escritorio) ───── */
function padRect(p,n,b,botones){const L=gameLeft(),Wd=gameRight()-L,w=Wd/n,x=L+p*w;
  if(botones===2){const h=(w-12)/2;return{x:x+4+b*(h+4),y:PAD_Y,w:h,h:PAD_H};}
  return{x:x+4,y:PAD_Y,w:w-8,h:PAD_H};}
function hitPad(pt,c){if(pt.y<PAD_Y-10)return null;
  for(let p=0;p<c.n;p++){if(c.cpu[p])continue;for(let b=0;b<c.botones;b++){const r=padRect(p,c.n,b,c.botones);if(pt.x>=r.x-4&&pt.x<=r.x+r.w+4)return{p,b:b?'b':'a'};}}
  return null;}
function press(p,b,on){const h=held[p];if(on&&!h[b])edge[p][b]++;h[b]=on?1:0;}
view.addEventListener('pointerdown',e=>{if(!live()||!cur)return;const h=hitPad(canvasPoint(e),cur);if(!h)return;e.preventDefault();
  try{view.setPointerCapture(e.pointerId);}catch(_){}const a=A();a.resume&&a.resume();ptrs.set(e.pointerId,h);press(h.p,h.b,1);});
const soltar=e=>{const h=ptrs.get(e.pointerId);if(h){ptrs.delete(e.pointerId);press(h.p,h.b,0);}};
addEventListener('pointerup',soltar,true);addEventListener('pointercancel',soltar,true);
addEventListener('keydown',e=>{if(!live()||!cur)return;for(let p=0;p<cur.n;p++){if(cur.cpu[p])continue;const k=KEYS[p].indexOf(e.code);
  if(k>=0){e.preventDefault();if(!e.repeat)press(p,k?'b':'a',1);}}},true);
addEventListener('keyup',e=>{if(!live()||!cur)return;for(let p=0;p<4;p++){const k=KEYS[p].indexOf(e.code);if(k>=0)press(p,k?'b':'a',0);}},true);
addEventListener('blur',()=>{for(let p=0;p<4;p++){held[p].a=held[p].b=0;}ptrs.clear();});

function drawPads(c,fin){
  ctx.save();
  for(let p=0;p<c.n;p++){
    const cpu=c.cpu[p];
    for(let b=0;b<c.botones;b++){const r=padRect(p,c.n,b,c.botones),on=held[p][b?'b':'a'];
      ctx.globalAlpha=cpu?.35:on?1:.82;
      rr(r.x,r.y,r.w,r.h,14,c.col[p],on?2:4);
      ctx.globalAlpha=1;
      const lab=cpu?'CPU':(c.botones===2?(b?'B':'A'):'P'+(p+1));
      txt(lab,r.x+r.w/2,r.y+r.h/2-6,cpu?18:24,'#14101c',0,true);
      if(!cpu)txt(KEYLBL[p][b],r.x+r.w/2,r.y+r.h-14,13,'#14101c',0,true);}
  }
  ctx.restore();
}
function drawFin(c,res,t){
  ctx.save();ctx.globalAlpha=Math.min(1,t*3)*.82;ctx.fillStyle='#14101c';ctx.fillRect(gameLeft(),150,gameRight()-gameLeft(),230);ctx.globalAlpha=1;
  txt(c.modo==='ffa'?'RESULTADOS':'GANA '+(res.ganadores.map(i=>'P'+(i+1)).join(' + ')),W/2,182,34,'#ffd23f',0,true);
  const ord=[...Array(c.n).keys()].sort((a,b)=>res.puestos[a]-res.puestos[b]);
  ord.forEach((p,i)=>{const y=232+i*34;rr(W/2-190,y-14,380,28,8,c.col[p],2);
    txt(res.puestos[p]+'º',W/2-160,y,20,'#14101c',0,true);txt('P'+(p+1)+(c.cpu[p]?' CPU':''),W/2-90,y,18,'#14101c',0,true);txt(String(Math.round(cur.g.scores[p]*10)/10),W/2+150,y,20,'#14101c',0,true);});
  ctx.restore();
}

/* ───── adaptador al motor ───── */
function wrap(id,def){
  const seed=(cfg.seed||((Date.now()&0xffffff)+1)),rng=rngMk(seed);
  const n=Math.max(2,Math.min(4,cfg.n)),modos=def.modos||['ffa'];
  const modo=modos.indexOf(cfg.modo)>=0?cfg.modo:modos[0];
  const solo=modo==='1v3'?(cfg.solo>=0?cfg.solo:rng.int(0,n-1)):-1;
  const eq=equipos(modo,n,solo);
  const c={n,modo,equipos:eq,solo,lv:cfg.lv,rng,botones:def.botones||1,col:PCOL.slice(0,n),campoAbajo:PAD_Y-6,
    cpu:[...Array(n).keys()].map(i=>i>=cfg.humanos),skill:[...Array(n).keys()].map(()=>.45+rng.next()*.3),
    held:(p,b)=>!!held[p][b],tap:(p,b)=>{const k=edge[p][b];edge[p][b]=0;return k;}};
  for(let p=0;p<4;p++){held[p].a=held[p].b=0;edge[p].a=edge[p].b=0;}
  const g=def.mk(c);g.scores=g.scores||new Array(n).fill(0);
  const api=p=>({press:b=>{edge[p][b]++;},hold:(b,on)=>{held[p][b]=on?1:0;}});
  const S={__vs:1,t:0,dur:g.dur||def.dur||20,result:null,why:'',endT:0,cmd:def.name,hint:g.hint||def.hint||'¡CADA QUIEN CON SU BOTÓN!',impact:0,press(){},
    probe:()=>({n,modo,eq,scores:g.scores.slice(),fin:!!g.fin,t:S.t}),
    update(dt){
      if(!g.fin){S.t+=dt;
        for(let p=0;p<n;p++)if(c.cpu[p]&&g.ai)g.ai(p,dt,api(p),c);
        g.update(dt);
        if(!g.fin&&S.t>=S.dur){if(g.finish)g.finish();g.fin=true;}
        for(let p=0;p<n;p++){edge[p].a=0;edge[p].b=0;}
        if(g.fin){S.res=compara(modo,eq,g.scores);S.result='win';F.VS.ultimo=Object.assign({modo,equipos:eq,scores:g.scores.slice()},S.res);
          if(F.VS.onFin)F.VS.onFin(F.VS.ultimo);}
      }else S.endT+=dt;
    },
    draw(){g.draw();drawPads(c);if(S.res)drawFin(c,S.res,S.endT);}};
  cur={g,n,cpu:c.cpu,col:c.col,botones:c.botones,modo};cur.n=n;
  return S;
}
function add(id,def){
  F.VS.games[id]=def;
  const k='vs-'+id;GAMES[k]={name:def.name,mk:()=>wrap(id,def),card:def.name,num:'VS'};
  const menu=document.getElementById('games');
  if(menu){const b=document.createElement('button');b.textContent=def.name;b.dataset.k=k;b.onclick=()=>setGame(k);menu.append(b);
    if(q.get('juego')===k||q.get('juego')===id||cur===null&&F.VS.auto===id)setGame(k);}
}
F.VS={add,games:{},cfg,compara,equipos,rngMk,ultimo:null,onFin:null,PCOL};
if(typeof module!=='undefined')module.exports=F.VS;
})();
