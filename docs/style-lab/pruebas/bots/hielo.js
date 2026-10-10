/* Bot de «¡ESTRÉLLALA!» (ver ../probar.js). Dos trazos con el puntero: arriba (alza) y abajo rápido (azota); o ↑ y ↓ con la barra en verde. */
(function(){
const libre=T=>T.hasta(()=>T.listo()||T.P().st==='hold',3);
/* trazo hacia arriba sin soltar: devuelve la y donde quedó el dedo */
function alza(T,x,y,px=200,sec=.18){T.down(x,y);const n=Math.max(2,Math.round(sec*60));for(let i=1;i<=n;i++){T.move(x,y-px*i/n);T.S(1/60);}return y-px;}
/* trazo hacia abajo de px en sec (la velocidad es la fuerza) y suelta */
function azota(T,x,y,px,sec){const n=Math.max(2,Math.round(sec*60));for(let i=1;i<=n&&!T.listo();i++){T.move(x,y+px*i/n);T.S(1/60);}T.up(x,y+px);}
/* un golpe flojo: la alza (hasta hmin) y la baja sin ganas, a unos 650 px/s; espera a que le pegue en la espinilla */
function flojo(T,hmin=.7){libre(T);if(T.listo())return;const y=alza(T,400,430,200,.12);T.hasta(()=>T.listo()||T.P().h>=hmin,2);azota(T,400,y,200,.3);T.hasta(()=>T.listo()||T.P().paf,1);}
BOTS.hielo={
  gana(T){T.S(.3);const y=alza(T,400,430);T.hasta(()=>T.listo()||T.P().h>=1,2);T.foto('arriba');azota(T,400,y,300,.1);},
  ganaTeclado(T){T.S(.3);T.tecla('ArrowUp');T.hasta(()=>T.listo()||T.P().h>=.5,2);T.foto('alzando');T.hasta(()=>{const p=T.P();return T.listo()||p.pulse>=(p.need+1)/2;},3);T.foto('barra');T.tecla('ArrowDown');},
  pierde(T){T.S(.3);flojo(T);T.S(.05);T.foto('espinilla');},          /* floja: rebota y a la espinilla; después se acaba el tiempo y se le cae */
  pierdeRota(T){T.S(.3);for(let i=0;i<3&&!T.listo();i++){flojo(T,.35);if(i===1){libre(T);T.foto('rasgada');}}},   /* tres flojas: se rompe la bolsa */
  pierdeApurado(T){T.S(.3);for(let i=0;i<8&&!T.listo();i++){libre(T);const y=alza(T,400,430,200,.08);azota(T,400,y,300,.1);}},   /* garabatear rápido arriba-abajo no sirve */
  pierdeMachaca(T){T.S(.3);for(let i=0;i<40&&!T.listo();i++){T.tecla('Space');T.S(.13);}},                                      /* machacar ESPACIO tampoco */
  pierdeAguanta(T){T.S(.3);alza(T,400,430);T.hasta(()=>T.listo()||T.P().topT>.75,3);T.foto('aguanta');},   /* la alza y no la azota: se acaba el tiempo (en el nivel 3, antes se le resbala) */
  nada:'lose',
  /* jugador torpe: tarda o.reac en reaccionar, a veces (o.err) se apura y la azota a medio alzar, y su trazo hacia abajo no siempre sale rápido */
  humano(T,o){T.S(.2+o.reac);let n=0;
    while(!T.listo()&&n++<6){libre(T);if(T.listo())break;T.S(o.reac*(.5+T.rnd()*.5));
      const x=300+T.rnd()*200,y=alza(T,x,430,170+T.rnd()*60,.14+T.rnd()*.1+o.err);
      if(T.rnd()<o.err*1.5)T.S(.05+T.rnd()*.1);
      else{T.hasta(()=>T.listo()||T.P().h>=1,2);T.S(o.reac*(.6+T.rnd()*.8));}
      if(T.listo())break;
      const v=2700*(1-T.rnd()*(.15+o.err*2.5));azota(T,x,y,260,260/v);T.S(.15);}}
};
})();
