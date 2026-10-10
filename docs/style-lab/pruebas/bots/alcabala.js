/* Bot de JEFE «LA ALCABALA NOCTURNA» (ver ../probar.js). Fase 1 por teclado, fase 2 con el puntero, fase 3 con ESPACIO. */
(function(){
const fase=(T,n)=>T.hasta(()=>T.listo()||(T.P().ph===n&&T.P().gap<=0),8);
function tablero(T){T.S(.3);for(const c of['ArrowLeft','ArrowDown','ArrowUp']){T.tecla(c);T.S(.1);}fase(T,1);}
/* arrastra a un lado lo que tape cada papel y lo toca */
function guantera(T){let n=0;while(!T.listo()&&T.P().ph===1&&n++<80){const p=T.P(),d=p.DOC.find(d=>!d.found);if(!d){T.S(.1);continue;}
    if(p.tapado(d))T.drag(d.x,d.y,d.x<400?84:716,d.y+(n%2?30:-30),.12);else T.tap(d.x,d.y);T.S(.05);}fase(T,2);}
function latido(T,desfase){while(!T.listo()){const p=T.P();if(p.SPK.find(s=>!s.st&&Math.abs(s.t+desfase-p.pt)<.012))T.tecla('Space');T.S(1/120,1/120);}}
BOTS.alcabala={
  gana(T){tablero(T);guantera(T);T.foto('fase3');latido(T,0);},
  pierde(T){tablero(T);guantera(T);latido(T,.3);},           /* toca a destiempo: ¡QUÉ NERVIOS! */
  pierdeGuantera(T){tablero(T);T.S(3);T.foto('guantera');},   /* llega el guardia y no hay papeles */
  nada:'lose',
  /* jugador torpe: se tarda en leer el tablero, y en el latido toca con un error de ±o.err segundos */
  humano(T,o){T.S(.3+o.reac*2);for(const c of['ArrowLeft','ArrowDown','ArrowUp']){T.tecla(c);T.S(o.reac*2);}fase(T,1);
    let n=0;while(!T.listo()&&T.P().ph===1&&n++<80){const p=T.P(),d=p.DOC.find(d=>!d.found);if(!d){T.S(.1);continue;}
      if(p.tapado(d))T.drag(d.x,d.y,d.x<400?84:716,d.y,.25+o.reac);else T.tap(d.x,d.y);T.S(o.reac);}fase(T,2);
    const off=new Map();while(!T.listo()){const p=T.P();for(const s of p.SPK){if(!off.has(s))off.set(s,(T.rnd()*2-1)*o.err*1.4);if(!s.st&&!s.hecho&&p.pt>=s.t+off.get(s)){s.hecho=1;T.tecla('Space');}}T.S(1/120,1/120);}}
};
})();
