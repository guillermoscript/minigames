/* Bot de ¡PÉSALO! (ver ../probar.js). P().w es lo que marca la balanza; la ventana buena va de P().lo a P().hi. */
(function(){
const pesa=(T,hasta)=>T.hasta(()=>T.listo()||T.P().w>=hasta,8);
BOTS.queso={
  gana(T){T.S(.2);T.down(400,300);pesa(T,.3);T.foto('echando');pesa(T,.497);T.up(400,300);},
  /* suelta corto y completa a pellizcos */
  ganaPellizcos(T){T.S(.2);T.down(400,300);pesa(T,.44);T.up(400,300);T.S(.12);let n=0;while(!T.listo()&&T.P().w<.492&&n++<40){T.down(400,300);T.S(.05);T.up(400,300);T.S(.07);}},
  ganaTecla(T){T.S(.2);T.key('Space');pesa(T,.497);T.keyup('Space');},
  pierde(T){T.S(.2);T.down(400,300);T.hasta(()=>T.listo(),8);T.S(1.2);T.foto('alud');},            /* no suelta: se pasa */
  pierdeFalta(T){T.S(.2);T.down(400,300);T.S(.5);T.up(400,300);},
  nada:'lose',
  /* suelta cuando VE el número que quiere (o sea, tarde por su tiempo de reacción) y remata con pellizcos imprecisos */
  humano(T,o){T.S(.3+o.reac);T.down(400,300);pesa(T,.47-T.P().R*o.reac*.6+(T.rnd()-.5)*o.err*.2);T.S(o.reac*.4);T.up(400,300);
    let n=0;while(!T.listo()&&n++<12){T.S(.18+o.reac*.5);if(T.listo()||T.P().w>=.49)break;T.down(400,300);T.S(.04+T.rnd()*(.05+o.err*.3));T.up(400,300);}}
};
})();
