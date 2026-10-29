/* Editable 1000 × 1000 board. Road corridors are schematic, not routing data. */
(() => {
'use strict';
const svg=document.querySelector('#map'), viewport=document.querySelector('#viewport');
const NS='http://www.w3.org/2000/svg';
function el(tag,attrs={},parent=svg){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
function text(x,y,value,cls,parent=svg){const e=el('text',{x,y,class:cls,'text-anchor':'middle'},parent);e.textContent=value;return e;}
const land='M 137 139 L 154 110 174 94 180 112 168 144 173 174 Q 193 193 215 163 L 233 141 255 146 266 130 258 112 270 95 289 99 303 120 298 146 Q 335 163 366 173 L 404 183 436 181 470 188 510 184 548 193 579 209 610 210 638 195 668 188 691 197 710 184 725 161 755 159 780 171 818 160 842 170 816 184 790 185 778 204 797 224 826 233 850 258 864 292 849 319 873 346 855 378 869 410 843 438 823 471 829 502 800 536 816 561 796 595 808 625 775 648 738 632 706 644 684 671 645 679 623 705 600 703 582 733 555 746 560 781 537 794 545 826 520 849 493 835 479 797 450 774 441 735 422 723 416 682 396 665 403 632 383 600 390 561 373 534 388 500 357 481 315 486 279 466 249 473 225 446 202 441 186 410 159 388 143 360 116 346 101 317 111 284 111 248 126 221 118 191 Z';
const defs=el('defs');el('path',{id:'land',d:land},defs);const clip=el('clipPath',{id:'land-clip'},defs);el('use',{href:'#land'},clip);
const pattern=el('pattern',{id:'waves',width:44,height:38,patternUnits:'userSpaceOnUse'},defs);el('path',{d:'M4 17 Q10 12 16 17 T28 17',fill:'none',stroke:'#effdf3','stroke-width':1,opacity:.35},pattern);
el('rect',{width:1000,height:1000,fill:'url(#waves)'});
el('use',{href:'#land',transform:'translate(0 9)',fill:'#518d80',opacity:.25});el('use',{href:'#land',fill:'#dfdda1',stroke:'#fcf2cc','stroke-width':12,'stroke-linejoin':'round'});
const terrain=el('g',{'clip-path':'url(#land-clip)'});
el('path',{d:'M70 80H400L360 230 210 270 80 300Z',fill:'#e9cd88'},terrain);
el('path',{d:'M80 280L240 260 365 390 280 465 140 390Z',fill:'#a8bb9a'},terrain);
el('path',{d:'M330 140H830V260L615 285 405 233Z',fill:'#9bbb78'},terrain);
el('path',{d:'M378 465Q650 350 880 355V900H360Z',fill:'#72a474'},terrain);
el('path',{d:'M420 590Q530 540 620 670L570 900H400Z',fill:'#4f8d70'},terrain);
el('path',{d:'M760 230L900 240 880 400 755 358 720 310Z',fill:'#b4a6bd'},terrain);
// Lake Maracaibo, open gulf and the Orinoco basin.
el('path',{d:'M177 159Q204 164 217 187L211 214Q240 249 218 286Q191 310 164 281Q147 254 162 221L159 194Z',fill:'#80c8d3',stroke:'#f3e6b7','stroke-width':4});
const river='M407 613Q430 572 416 532Q422 483 478 463Q523 433 559 414Q609 391 671 379Q730 365 775 330';
el('path',{d:river,fill:'none',stroke:'#b4e4df','stroke-width':9,'stroke-linecap':'round'});
['M275 416Q355 440 478 463','M542 594Q585 505 598 404','M748 540Q717 463 734 366','M775 330Q826 309 851 289','M775 330Q836 349 858 374','M775 330Q814 322 864 334'].forEach(d=>el('path',{d,fill:'none',stroke:'#a6dbd8','stroke-width':4}));
// Offshore islands remain separate from the land silhouette.
el('path',{d:'M692 132L703 121 724 125 733 113 751 110 769 124 761 137 740 139 722 132 707 140Z',fill:'#c7ce8b',stroke:'#fff0bc','stroke-width':5});
[[544,104],[562,98],[580,109],[569,119],[548,121]].forEach(([x,y])=>el('ellipse',{cx:x,cy:y,rx:5,ry:3,fill:'#eee5b7',stroke:'#fff6dc','stroke-width':2}));
// Reusable vector landmarks; decorations stay away from road corridors.
function mountain(x,y,s=1){const g=el('g',{transform:`translate(${x} ${y}) scale(${s})`});el('path',{d:'M-24 15L0-25 26 15Z',fill:'#718f80',stroke:'#486d61','stroke-width':2},g);el('path',{d:'M-10-8L0-25 11-7 3-10-2-5Z',fill:'#f6f3dc'},g);return g;}
function palm(x,y,s=1,parent=svg){const g=el('g',{transform:`translate(${x} ${y}) scale(${s})`},parent);el('path',{d:'M0 12Q4 0 0-10',fill:'none',stroke:'#866c45','stroke-width':3},g);el('path',{d:'M0-9Q-17-18-17-3Q-8-10 0-9Q10-24 17-10Q7-14 0-9Q15-9 16 1Q7-6 0-9Q-8-22-12-15Z',fill:'#427e55',stroke:'#346844','stroke-width':1},g);}
function tepui(x,y,s=1){const g=el('g',{transform:`translate(${x} ${y}) scale(${s})`});el('path',{d:'M-36-9L-29 31 31 32 39-8Z',fill:'#bd8355',stroke:'#805c42','stroke-width':2},g);el('path',{d:'M-36-9L-23-18 27-18 39-8 14 0-22-1Z',fill:'#4b8055',stroke:'#386a4a','stroke-width':2},g);el('path',{d:'M8-1Q5 14 10 34',stroke:'#d3f5ed','stroke-width':5,fill:'none'},g);el('path',{d:'M-21 3L-18 24M-9 3L-7 28M24 2L22 24',stroke:'#926044','stroke-width':2},g);}
[[165,345,.7],[189,331,.9],[216,313,1],[240,294,.7],[267,284,.6],[436,194,.5],[465,191,.6],[489,192,.55]].forEach(a=>mountain(...a));
[[584,515,1.25],[677,548,.85],[727,580,.8]].forEach(a=>tepui(...a));
[[323,338],[370,366],[433,399],[511,360],[640,217],[754,120],[711,127]].forEach(a=>palm(...a,.7));
const forest=el('g',{'clip-path':'url(#land-clip)'});for(let i=0;i<65;i++){const x=410+(i*67%360),y=510+(i*43%330);if(x>585&&y<620)continue;const g=el('g',{transform:`translate(${x} ${y})`,opacity:.55},forest);el('path',{d:'M0 8V-3',stroke:'#3d6752','stroke-width':3},g);el('circle',{cx:0,cy:-5,r:8,fill:i%2?'#418165':'#619568'},g);}
// Dunes, lightning, skyline and delta door.
for(let i=0;i<4;i++)el('path',{d:`M${244+i*14} 174q15 -25 28 0q-15 -6 -28 0`,fill:'#d8ad67',stroke:'#b88e52','stroke-width':1});
el('path',{d:'M186 232L176 251H188L179 270 203 243H189L200 232Z',fill:'#fff7ae',stroke:'#7398a6','stroke-width':2});
[[454,219,10,20],[468,215,11,25],[484,228,8,12]].forEach(([x,y,width,height])=>{el('rect',{x,y:y-height,width,height,rx:1,fill:'#deaf73',stroke:'#827d58','stroke-width':1});});
el('path',{d:'M820 293V274L830 270V293Z',fill:'#926d82',stroke:'#f0d8c3','stroke-width':2});
text(561,65,'MAR CARIBE','region-label');text(280,215,'FALCÓN','region-label');text(165,306,'ZULIA','region-label');text(251,367,'LOS ANDES','region-label');text(429,347,'LOS LLANOS','region-label');text(662,475,'GUAYANA','region-label');text(480,695,'AMAZONAS','region-label');text(808,252,'DELTA','region-label');
const cities={
maracaibo:[145,208,'Maracaibo','Zulia'],coro:[287,157,'Coro','Falcón'],barquisimeto:[307,254,'Barquisimeto','Centro-occidente'],valencia:[391,242,'Valencia','Centro'],maracay:[429,233,'Maracay','Centro'],caracas:[493,224,'Caracas','Capital'],guaira:[492,199,'La Guaira','Caribe'],valera:[258,293,'Valera','Andes'],merida:[213,346,'Mérida','Andes'],sancristobal:[171,390,'San Cristóbal','Andes'],acarigua:[327,298,'Acarigua','Llanos'],guanare:[303,330,'Guanare','Llanos'],barinas:[271,370,'Barinas','Llanos'],sanjuan:[437,282,'San Juan de los Morros','Llanos'],calabozo:[443,354,'Calabozo','Llanos'],sanfernando:[440,419,'San Fernando','Apure'],pascua:[517,339,'Valle de la Pascua','Llanos'],barcelona:[640,243,'Barcelona','Oriente'],cumana:[696,217,'Cumaná','Oriente'],carupano:[760,197,'Carúpano','Oriente'],maturin:[762,276,'Maturín','Oriente'],tigre:[632,327,'El Tigre','Oriente'],bolivar:[650,386,'Ciudad Bolívar','Guayana'],ordaz:[716,375,'Puerto Ordaz','Guayana'],upata:[747,417,'Upata','Guayana'],callao:[764,456,'El Callao','Guayana'],eldorado:[775,493,'El Dorado','Guayana'],santaelena:[754,610,'Santa Elena','Gran Sabana'],canaima:[603,505,'Canaima','Tepuyes'],ayacucho:[410,551,'Puerto Ayacucho','Amazonas'],margarita:[741,127,'Margarita','Islas'],roques:[561,108,'Los Roques','Islas'],tucupita:[810,307,'Tucupita','Delta']};
const routes=[
['Centro y occidente','road',['maracaibo','barquisimeto','valencia','maracay','caracas']],
['Falcón–Zulia / costa occidental','road',['maracaibo','coro','valencia']],
['Trasandina','road',['barquisimeto','valera','merida','sancristobal']],
['Corredor de los Llanos','road',['valencia','acarigua','guanare','barinas','sancristobal']],
['Enlace Lara–Portuguesa','road',['barquisimeto','acarigua']],
['Centro–Apure','road',['maracay','sanjuan','calabozo','sanfernando']],
['Caracas–La Guaira','road',['caracas','guaira']],
['Oriente · Troncal 9','road',['caracas','barcelona','cumana','carupano']],
['Llanos orientales','road',['sanjuan','pascua','tigre']],
['Oriente–Guayana · Troncal 16','road',['barcelona','tigre','bolivar','ordaz']],
['Oriente interior','road',['barcelona','maturin','carupano']],
['Troncal 10 · Gran Sabana','road',['maturin','ordaz','upata','callao','eldorado','santaelena']],
['Acceso al Delta','road',['maturin','tucupita']],
['Ferry a Margarita','ferry',['barcelona','margarita']],
['Vuelo a Los Roques','air',['guaira','roques']],
['Vuelo a Canaima','air',['bolivar','canaima']],
['Travesía del Orinoco · conexión de juego','river',['sanfernando','ayacucho']]
];
const edges=new Map(),routeLayer=el('g'),spaces=el('g',{class:'detail'}),cityLayer=el('g');
for(const[name,mode,ids]of routes){for(let i=1;i<ids.length;i++){
 const a=ids[i-1],b=ids[i],A=cities[a],B=cities[b];
 const key=[a,b].sort().join(':');if(edges.has(key))continue;edges.set(key,{a,b,name,mode});
 const d=`M${A[0]} ${A[1]}L${B[0]} ${B[1]}`;
 if(mode==='road'){el('path',{d,stroke:'#8e784d','stroke-width':7,fill:'none','stroke-linecap':'round'},routeLayer);el('path',{d,stroke:'#fff0be','stroke-width':4,fill:'none','stroke-linecap':'round'},routeLayer);
 const count=Math.floor(Math.hypot(B[0]-A[0],B[1]-A[1])/22);for(let j=1;j<count;j++){const t=j/count;el('circle',{cx:A[0]+(B[0]-A[0])*t,cy:A[1]+(B[1]-A[1])*t,r:3.4,fill:j%4===0?'#e9a077':'#fff9dc',stroke:'#9f8554','stroke-width':1},spaces);}}
 else el('path',{d,stroke:mode==='air'?'#798fa9':'#467f94','stroke-width':2,fill:'none','stroke-dasharray':mode==='air'?'2 6':'6 5',opacity:.7},routeLayer);
}}
const major=new Set(['maracaibo','caracas','merida','barcelona','ordaz','santaelena','ayacucho','margarita','barquisimeto','sanfernando']);
for(const[id,[x,y,name]]of Object.entries(cities)){
 const g=el('g',{class:'city'+(id==='caracas'?' selected':''),tabindex:0,role:'button','aria-label':name,'data-city':id},cityLayer);
 el('circle',{cx:x,cy:y,r:11,fill:'transparent'},g);el('circle',{cx:x,cy:y,r:5.5,fill:'#fff8d7',stroke:'#8f784c','stroke-width':2,class:'city-dot'},g);
 text(x,y+(id==='guaira'?-11:19),name,'label '+(major.has(id)?'':'detail'),g);
 g.addEventListener('click',()=>{if(!dragged)select(id,true)});g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(id,true)}});
}
const token=el('g',{'aria-label':'Tu ficha en Caracas',transform:'translate(493 224)'});el('ellipse',{cx:0,cy:1,rx:9,ry:4,fill:'#315b4d',opacity:.25},token);el('path',{d:'M0 0Q-14-17-7-23Q0-30 7-23Q14-17 0 0Z',fill:'#e16f42',stroke:'#fff9dc','stroke-width':2},token);el('circle',{cx:0,cy:-18,r:3,fill:'#fff4cf'},token);
let current='caracas',z=1,cx=500,cy=470,dragged=false;
function render(){const size=1000/z;cx=Math.max(size/2-90,Math.min(1090-size/2,cx));cy=Math.max(size/2-100,Math.min(1040-size/2,cy));svg.setAttribute('viewBox',`${cx-size/2} ${cy-size/2} ${size} ${size}`);svg.classList.toggle('zoomed',z>=1.65);svg.classList.toggle('close',z>=2.7);document.querySelector('#scale').textContent=z.toFixed(1)+'×';}
function focus(x,y,zoom){cx=x;cy=y;z=zoom;render();}
function select(id,zoom=false){current=id;const[x,y,name,region]=cities[id];document.querySelectorAll('.selected').forEach(e=>e.classList.remove('selected'));document.querySelector(`[data-city="${id}"]`).classList.add('selected');document.querySelector('#region').textContent=region.toUpperCase();document.querySelector('#place').textContent=name;const links=[...edges.values()].filter(e=>e.a===id||e.b===id);document.querySelector('#description').textContent=`${links.length} conexiones para continuar el viaje. Elige una parada conectada para explorar la ruta.`;const box=document.querySelector('#connections');box.replaceChildren();for(const edge of links){const to=edge.a===id?edge.b:edge.a;const button=document.createElement('button');button.textContent=(edge.mode==='road'?'→ ':edge.mode==='air'?'✈ ':'≈ ')+cities[to][2];button.title=edge.name;button.addEventListener('click',()=>select(to,true));box.append(button);}if(zoom)focus(x,y,Math.max(z,2.8));}
function zoomBy(factor,clientX,clientY){const rect=svg.getBoundingClientRect(),unit=Math.min(rect.width,rect.height),px=(clientX??(rect.left+rect.width/2))-(rect.left+rect.width/2),py=(clientY??(rect.top+rect.height/2))-(rect.top+rect.height/2),before=1000/z;z=Math.max(1,Math.min(5,z*factor));const after=1000/z;cx+=px/unit*(before-after);cy+=py/unit*(before-after);render();}
document.querySelector('#plus').onclick=()=>zoomBy(1.35);document.querySelector('#minus').onclick=()=>zoomBy(1/1.35);document.querySelector('#overview').onclick=()=>focus(500,470,1);document.querySelector('#player').onclick=()=>select('caracas',true);
viewport.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(-e.deltaY*.0015),e.clientX,e.clientY)},{passive:false});
const pointers=new Map();let lastDistance=0;
viewport.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;dragged=false;pointers.set(e.pointerId,[e.clientX,e.clientY]);lastDistance=0;if(!e.target.closest('.city'))viewport.setPointerCapture(e.pointerId);});
viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);const rect=svg.getBoundingClientRect(),unit=Math.min(rect.width,rect.height);if(pointers.size===2){const[a,b]=[...pointers.values()],distance=Math.hypot(a[0]-b[0],a[1]-b[1]);if(lastDistance)zoomBy(distance/lastDistance,(a[0]+b[0])/2,(a[1]+b[1])/2);lastDistance=distance;dragged=true;}else{const dx=e.clientX-prev[0],dy=e.clientY-prev[1];if(Math.abs(dx)+Math.abs(dy)>2)dragged=true;cx-=dx/unit*1000/z;cy-=dy/unit*1000/z;render();}});
function end(e){pointers.delete(e.pointerId);lastDistance=0;}viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);viewport.addEventListener('lostpointercapture',end);
viewport.addEventListener('keydown',e=>{if(e.target!==viewport)return;const delta=60/z;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')cx-=delta;if(e.key==='ArrowRight')cx+=delta;if(e.key==='ArrowUp')cy-=delta;if(e.key==='ArrowDown')cy+=delta;if(e.key==='+'||e.key==='=')zoomBy(1.35);if(e.key==='-')zoomBy(1/1.35);if(e.key==='Home')focus(500,470,1);render();});
select('caracas');render();
})();
