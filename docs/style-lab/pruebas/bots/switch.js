/* Bot de ¡PRENDE! (ver ../probar.js). P().taps / P().need = cuántos toques van y cuántos hacen falta; P().teases = los toques de los amagos
   (uno en el nivel 1, dos desde el 2; P().tease = el primero); P().on = palanca arriba; P().sw = dónde está el interruptor (igual sirve
   tocar en cualquier parte). Nivel 3: P().vela = {x, y, on}; apagada, los toques no cuentan hasta tocarla (o FLECHA IZQUIERDA). */
(function(){
const dale=T=>{const s=T.P().sw;T.tap(s.x,s.y);};
BOTS.switch={
  gana(T){T.S(.25);T.foto('oscuro');let n=0,f=0;
    while(!T.listo()&&n++<80){const a=T.P();
      if(!a.vela.on){T.S(.12);T.foto('vela-apagada');dale(T);if(T.P().taps!==a.taps)throw new Error('un toque al switch contó con la vela apagada');
        T.S(.05);T.foto('no-se-ve');T.tap(a.vela.x,a.vela.y);if(!T.P().vela.on)throw new Error('tocar la vela no la prendió');T.S(.07);continue;}
      dale(T);const b=T.P();
      if(!T.listo()&&(b.taps!==a.taps+1||b.on===a.on))throw new Error('un toque no volteó el switch o no contó ('+a.taps+' → '+b.taps+')');
      T.S(.07);if(f<a.teases.length&&b.flash&&a.teases[f]===b.taps){f++;T.S(.1);T.foto('amago'+(f>1?f:''));}}},
  ganaTeclas(T){T.S(.2);let n=0;while(!T.listo()&&n++<80){T.tecla(T.P().vela.on?(n%3?'Space':'Enter'):'ArrowLeft');T.S(.08);}},
  /* le da con flojera: se queda a mitad de camino y se acaba el tiempo */
  pierde(T){T.S(.3);for(let i=0;i<5&&!T.listo();i++){dale(T);T.S(.3);}T.foto('flojo');T.hasta(()=>T.listo(),8);},
  nada:'lose',
  /* machaca a su ritmo: mientras peor el jugador, más lento, y se queda viendo el amago (y la vela apagada, antes de ir a prenderla) */
  humano(T,o){T.S(.25+o.reac);let n=0,f=0;
    while(!T.listo()&&n++<120){const p=T.P();
      if(!p.vela.on){T.S(.2+o.reac*1.5);T.tap(p.vela.x,p.vela.y);T.S(.12+o.reac*.5);continue;}
      dale(T);T.S(.1+o.reac*.25+T.rnd()*.07+(T.rnd()<o.err?.25:0));if(f<p.teases.length&&T.P().flash&&p.teases[f]===T.P().taps){f++;T.S(o.reac);}}}
};
})();
