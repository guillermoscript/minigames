/* Bot de ¡PRENDE! (ver ../probar.js). P().taps / P().need = cuántos toques van y cuántos hacen falta; P().tease = el toque del amago;
   P().on = palanca arriba; P().sw = dónde está el interruptor (igual sirve tocar en cualquier parte). */
(function(){
const dale=T=>{const s=T.P().sw;T.tap(s.x,s.y);};
BOTS.switch={
  gana(T){T.S(.25);T.foto('oscuro');let n=0,f=0;
    while(!T.listo()&&n++<80){const a=T.P();dale(T);const b=T.P();
      if(!T.listo()&&(b.taps!==a.taps+1||b.on===a.on))throw new Error('un toque no volteó el switch o no contó ('+a.taps+' → '+b.taps+')');
      T.S(.07);if(!f&&b.flash){f=1;T.S(.1);T.foto('amago');}}},
  ganaTeclas(T){T.S(.2);let n=0;while(!T.listo()&&n++<80){T.tecla(n%3?'Space':'Enter');T.S(.08);}},
  /* le da con flojera: se queda a mitad de camino y se acaba el tiempo */
  pierde(T){T.S(.3);for(let i=0;i<5&&!T.listo();i++){dale(T);T.S(.3);}T.foto('flojo');T.hasta(()=>T.listo(),8);},
  nada:'lose',
  /* machaca a su ritmo: mientras peor el jugador, más lento, y se queda viendo el amago */
  humano(T,o){T.S(.25+o.reac);let n=0,f=0;
    while(!T.listo()&&n++<120){dale(T);T.S(.1+o.reac*.25+T.rnd()*.07+(T.rnd()<o.err?.25:0));if(!f&&T.P().flash){f=1;T.S(o.reac);}}}
};
})();
