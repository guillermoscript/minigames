/* Bot de ¡BAJA! (ver ../probar.js; correr con --archivo=docs/style-lab/juegos-bus.js). P().px / taps / need; desde el nivel 2
   P().emp = la x del vecino que empuja (0 en el nivel 1) y P().did = ya empujó (una sola vez, te devuelve dos pasos). */
(function(){
BOTS.baja={
  gana(T){T.S(.2);let n=0,vio=false;
    while(!T.listo()&&n++<200){const a=T.P();T.tap(400,300);const b=T.P();
      if(!a.did&&b.did){vio=true;if(!(b.px<a.px))throw new Error('el empujón no te devolvió ('+a.px+' → '+b.px+')');T.S(.2);T.foto('empujon');}
      else if(a.did&&!T.listo()&&b.px<a.px)throw new Error('te empujaron dos veces');
      T.S(.07);}
    if(T.P().emp&&!vio)throw new Error('nivel 2+: nadie empujó');if(!T.P().emp&&vio)throw new Error('nivel 1: hubo empujón');},
  pierde(T){T.S(.3);for(let i=0;i<6&&!T.listo();i++){T.tap(400,300);T.S(.35);}T.hasta(()=>T.listo(),8);},
  nada:'lose'
};
})();
