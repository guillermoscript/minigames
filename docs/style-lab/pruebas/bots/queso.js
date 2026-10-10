/* Bot de ¡PÉSALO! (ver ../probar.js). P().w es el peso de VERDAD (el que se juzga) y P().d lo que marca la balanza (en el nivel 3
   va atrasado y rebota; en los demás es igual a w). La ventana buena va de P().lo a P().hi; el pedido (P().obj) cambia desde el nivel 2. */
(function(){
const pesa=(T,hasta)=>T.hasta(()=>T.listo()||T.P().w>=hasta,8);
BOTS.queso={
  gana(T){T.S(.2);const o=T.P().obj;T.down(400,300);pesa(T,o*.6);T.foto('echando');pesa(T,o-.003);T.up(400,300);T.S(.15);T.foto('rebote');},
  /* suelta corto y completa a pellizcos */
  ganaPellizcos(T){T.S(.2);const o=T.P().obj;T.down(400,300);pesa(T,o-.06);T.up(400,300);T.S(.12);let n=0;while(!T.listo()&&T.P().w<o-.008&&n++<40){T.down(400,300);T.S(.05);T.up(400,300);T.S(.07);}},
  ganaTecla(T){T.S(.2);T.key('Space');pesa(T,T.P().obj-.003);T.keyup('Space');},
  pierde(T){T.S(.2);T.down(400,300);T.hasta(()=>T.listo(),8);T.S(1.2);T.foto('alud');},            /* no suelta: se pasa */
  pierdeFalta(T){T.S(.2);T.down(400,300);T.S(.3);T.up(400,300);},
  nada:'lose',
  /* suelta cuando VE el número que quiere (o sea, tarde por su tiempo de reacción) y remata con pellizcos imprecisos.
     En el nivel 3 ya sabe que marca atrasado: apunta más abajo y espera a que se asiente antes de cada pellizco. */
  humano(T,o){const lo=T.P().lo,l3=T.P().lv>2,ve=()=>T.P().d;T.S(.3+o.reac);T.down(400,300);
    T.hasta(()=>T.listo()||ve()>=lo-(l3?.05:.02)-T.P().R*o.reac*.6+(T.rnd()-.5)*o.err*.2,8);T.S(o.reac*.4);T.up(400,300);
    let n=0;while(!T.listo()&&n++<12){T.S(.18+o.reac*.5+(l3?.35:0));if(T.listo()||ve()>=lo)break;T.down(400,300);T.S(.04+T.rnd()*(.05+o.err*.3));T.up(400,300);}}
};
})();
