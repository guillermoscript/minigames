/* Bot de JEFE «EL TRANSFORMADOR» (ver ../probar.js). Un solo botón: tocar rápido hasta que la palanca (P().v) llegue a 1. */
(function(){
BOTS.transformador={
  gana(T){T.S(.3);T.foto('jalando');let n=0;while(!T.listo()&&n++<400){T.tap(400,300);T.S(.06);}},
  /* se duerme hasta que el transformador se alebresta (aviso y rayo) y después sí jala */
  ganaTarde(T){T.hasta(()=>T.P().rageT>=0,4);T.S(.05);T.foto('aviso');T.hasta(()=>T.P().rageT>.5,2);T.foto('rayo');let n=0;while(!T.listo()&&n++<400){T.tap(400,300);T.S(.06);}},
  ganaTeclas(T){T.S(.2);let n=0;while(!T.listo()&&n++<400){T.tecla('Space');T.S(.06);}},
  nada:'lose'
};
})();
