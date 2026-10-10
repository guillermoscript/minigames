/* Bot de ¡LLEGÓ LA LUZ! (ver ../probar.js). P().on = ya llegó la luz; P().T = cuándo llega; P().grace = cuánto perdona;
   P().fake = cuándo es el amago (-9 si no hay) y P().amago = está parpadeando ahora.
   Nivel 3: P().tp = cuándo arranca la planta del vecino (-9 si no hay) y P().planta = ya está andando. */
(function(){
const llega=T=>T.hasta(()=>T.listo()||T.P().on,8);
BOTS.llego={
  gana(T){T.S(.4);T.foto('oscuro');llega(T);T.S(.18);T.foto('luz');T.tap(400,300);},
  ganaTecla(T){llega(T);T.S(.1);T.tecla('Space');},
  ganaAlFilo(T){llega(T);T.S(T.P().grace-.08);T.tap(400,300);},
  /* se adelanta: grita solo, a oscuras */
  pierdePronto(T){T.S(.3);T.tap(400,300);T.S(.6);T.foto('pronto');},
  /* cae en el amago (si esta vez no hay, igual se adelanta) */
  pierdeAmago(T){T.hasta(()=>T.listo()||T.P().amago||T.P().on||T.G.t>1,8);if(!T.P().on)T.tap(400,300);else T.S(T.P().grace+.1);},
  /* nivel 3: cae con la planta del vecino (y tiene que salir ese final); en los otros niveles se adelanta y ya */
  pierdePlanta(T){if(T.P().tp<0){T.S(.3);T.tap(400,300);return;}T.hasta(()=>T.listo()||T.P().planta,8);T.S(.12);T.foto('planta');T.tap(400,300);
    if(T.P().kind!=='planta')throw new Error('gritó con la planta andando y salió «'+T.P().kind+'»');T.S(.6);T.foto('era-la-planta');},
  /* nivel 2+: tiene que haber amago; nivel 3: también planta, y las dos antes de la luz. Aguanta las dos y grita bien */
  ganaTrasTrampas(T){const p=T.P();if(p.lv>1&&!(p.fake>0&&p.fake<p.T))throw new Error('nivel '+p.lv+' sin amago');
    if(p.lv>2&&!(p.tp>0&&p.tp<p.T))throw new Error('nivel 3 sin planta');llega(T);T.S(.15);T.tap(400,300);},
  pierdeTarde(T){llega(T);T.S(T.P().grace+.1);T.tap(400,300);},
  nada:'lose',
  humano(T,o){llega(T);T.S(o.reac+T.rnd()*.12);if(!T.listo())T.tap(400,300);}
};
})();
