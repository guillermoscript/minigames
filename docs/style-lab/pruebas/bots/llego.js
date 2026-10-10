/* Bot de ¡LLEGÓ LA LUZ! (ver ../probar.js). P().on = ya llegó la luz; P().T = cuándo llega; P().grace = cuánto perdona;
   P().fake = cuándo es el amago (-9 si no hay) y P().amago = está parpadeando ahora. */
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
  pierdeTarde(T){llega(T);T.S(T.P().grace+.1);T.tap(400,300);},
  nada:'lose',
  humano(T,o){llega(T);T.S(o.reac+T.rnd()*.12);if(!T.listo())T.tap(400,300);}
};
})();
