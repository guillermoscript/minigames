/* Bot de JEFE «EL TRANSFORMADOR» (ver ../probar.js). Un solo botón: tocar rápido hasta que la palanca (P().v) llegue a 1.
   Nivel 3 (P().lv): la primera vez que llega arriba se cae a la mitad (P().bajo) y hay que subirla otra vez.
   Ojo: estas rutas tocan 15 veces por segundo; a ritmo de un solo dedo (8/s) solo alcanza el nivel 1 a velocidad 1. */
(function(){
BOTS.transformador={
  gana(T){T.S(.3);T.foto('jalando');const lv=T.P().lv;let n=0,cayo=false;
    while(!T.listo()&&n++<400){T.tap(400,300);if(!cayo&&T.P().bajo&&!T.listo()){cayo=true;if(Math.abs(T.P().v-.5)>.01)throw new Error('se bajó a '+T.P().v+' y no a la mitad');T.S(.12);T.foto('se-bajo');}T.S(.06);}
    if(cayo!==(lv>2))throw new Error('nivel '+lv+': la palanca '+(cayo?'se bajó':'no se bajó'));},
  /* se duerme hasta que el transformador se alebresta (aviso y rayo) y después sí jala */
  ganaTarde(T){T.hasta(()=>T.P().rageT>=0,4);T.S(.05);T.foto('aviso');T.hasta(()=>T.P().rageT>.5,2);T.foto('rayo');let n=0;while(!T.listo()&&n++<400){T.tap(400,300);T.S(.06);}},
  ganaTeclas(T){T.S(.2);let n=0;while(!T.listo()&&n++<400){T.tecla('Space');T.S(.06);}},
  nada:'lose'
};
})();
