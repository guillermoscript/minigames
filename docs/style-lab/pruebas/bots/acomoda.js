/* Bot de ¡ACOMODA! (ver ../probar.js). Las rutas revisan además QUÉ final salió (kind), no solo si ganó o perdió. */
(function(){
/* arrastra una silla ('L' o 'R') por su punto de agarre hasta dejar el borde del asiento en x */
function silla(T,lado,x,seg=.2){const c=T.P()[lado];T.drag(c.gx,c.gy,c.gx+(x-c.x),c.gy,seg);}
/* arrima la derecha hasta dejar `ranura` px entre los asientos */
function arrima(T,ranura,seg=.2){silla(T,'R',T.P().L.x+ranura,seg);T.S(.2);}
function chaqueta(T,seg=.2){const p=T.P();T.drag(p.jh.x,p.jh.y,p.bed.x,p.bed.y,seg);T.S(.2);}
function nino(T,seg=.22){const p=T.P();T.drag(p.kid.x,p.kid.y,p.bed.x,p.bed.y-10,seg);}
/* nivel 3: espera el caderazo del tío y vuelve a arrimar la silla */
function tio(T){const p=T.P();if(p.tB&&!p.bumped)T.hasta(()=>T.listo()||T.P().bumped,4);T.S(.35);if(!T.listo()&&T.P().gap>T.P().tol)arrima(T,T.P().tol*.3);}
function fin(T,kind){T.hasta(()=>T.listo(),9);const g=T.g0;if(g.kind!==kind)throw new Error('esperaba el final "'+kind+'" y salió "'+g.kind+'" ('+g.result+' '+g.why+')');}
/* teclado: echa a deslizar la silla y la frena pegadita */
function frena(T){T.tecla('Space');T.hasta(()=>T.listo()||T.P().gapv<=T.P().tol*.5,5);T.tecla('Space');T.S(.3);}
const armar=T=>{T.S(.25);silla(T,'L',392);T.S(.1);arrima(T,T.P().tol*.3);};
BOTS.acomoda={
  gana(T){armar(T);T.foto('sillas');tio(T);chaqueta(T);T.foto('colchon');const p=T.P();T.down(p.kid.x,p.kid.y);T.move(p.bed.x-90,p.bed.y-90);T.S(.12);T.foto('cargado');T.move(p.bed.x,p.bed.y-10);T.S(.05);T.up(p.bed.x,p.bed.y-10);fin(T,'');},
  /* la estrella la silla contra la otra: tiene que rebotar y dejar ranura; después la arrima bien */
  ganaRebote(T){T.S(.25);silla(T,'L',392);T.S(.1);silla(T,'R',T.P().L.x-120);T.S(.35);const p=T.P();if(p.gap<p.ov*p.bk-1)throw new Error('no rebotó: ranura '+p.gap);T.foto('rebote');tio(T);chaqueta(T);nino(T);fin(T,'');},
  ganaTeclado(T){T.S(.25);T.tecla('Space');T.S(.35);T.tecla('Space');T.S(.3);T.foto('deslizando');T.hasta(()=>T.listo()||T.P().gapv<=T.P().tol*.5,5);T.tecla('Space');T.S(.3);
    const p=T.P();if(p.tB&&!p.bumped)T.hasta(()=>T.listo()||T.P().bumped,4);T.S(.35);if(T.P().gap>T.P().tol)frena(T);T.tecla('Space');T.S(.3);T.tecla('Space');fin(T,'');},
  /* el gag del guion: sillas con ranura, el niño se cuela (con chaqueta y todo) */
  pierde(T){T.S(.25);silla(T,'L',392);T.S(.1);arrima(T,T.P().tol+25);chaqueta(T);T.foto('ranura');nino(T);fin(T,'ranura');},
  /* sillas pegaditas pero sin chaqueta: se le espanta el sueño */
  pierdeDura(T){armar(T);tio(T);nino(T);fin(T,'dura');},
  /* todo listo pero se queda con el niño cargado hasta que se acaba el reloj */
  pierdeBerrinche(T){armar(T);chaqueta(T);const p=T.P();T.down(p.kid.x,p.kid.y);T.move(300,250);T.S(.3);T.hasta(()=>T.listo(),9);T.up(300,250);fin(T,'time');},
  /* machacar ESPACIO: frena la silla lejos y el niño se cuela */
  pierdeMachaca(T){T.S(.2);while(!T.listo()){T.tecla('Space');T.S(.12);}},
  /* toques al azar por toda la pantalla: no arma nada */
  pierdeToques(T){while(!T.listo()){T.tap(40+T.rnd()*720,120+T.rnd()*440);T.S(.09);}},
  nada:'lose',
  /* jugador torpe: o.reac = lo que tarda en reaccionar; entre un arrastre y otro pierde o.reac + .12 s (llevar la mano) y cada
     arrastre le dura .3 s + o.reac. o.err = puntería (la silla le queda con un error de ±o.err*180 px, y la chaqueta y el niño
     más) y probabilidad de despistarse: no vuelve a mirar la ranura antes de acostar al niño (en el nivel 3, el caderazo). */
  humano(T,o){const N=()=>(T.rnd()+T.rnd()+T.rnd()-1.5)*2,seg=.3+o.reac,pausa=.12+o.reac,sig=o.err*180,despiste=T.rnd()<o.err;let n=0;
    const junta=()=>{while(!T.listo()&&n++<7){const p=T.P();if(p.gap<=p.tol)break;silla(T,'R',p.L.x+p.tol*.35+N()*sig,seg);T.S(.15+pausa);}};
    T.S(.3+o.reac*1.5);silla(T,'L',392+N()*30,seg);T.S(pausa);junta();
    for(let i=0;i<3&&!T.listo()&&T.P().jk!=='bed';i++){const p=T.P();T.drag(p.jh.x,p.jh.y,p.bed.x+N()*sig*1.5,p.bed.y+N()*sig,seg);T.S(pausa);}
    /* ve venir al tío (¡UEPA!) y lo espera; después vuelve a mirar la ranura, salvo que ande despistado */
    if(!despiste){const p=T.P();if(p.tB&&!p.bumped&&T.g0.t>p.tB-.5){T.hasta(()=>T.listo()||T.P().bumped,2);T.S(.2+o.reac);}junta();}
    for(let i=0;i<3&&!T.listo();i++){const p=T.P();T.drag(p.kid.x,p.kid.y,p.bed.x+N()*sig*1.5,p.bed.y-10+N()*sig,seg);T.S(.1+pausa);}}
};
})();
