/* Bot de «¡HASTA LA RAYITA!» (ver ../probar.js). Mantener = echar; suelta cuando lo que falta de inercia (v·tau) deja la espuma a media franja. */
(function(){
const punto=T=>{const p=T.P();return T.listo()||p.h+p.v*p.tau>=(p.lo+1)/2;};
BOTS.rayita={
  gana(T){T.S(.3);T.down(300,400);T.hasta(()=>T.listo()||T.P().h>.5,4);T.foto('echando');T.hasta(()=>punto(T),4);T.up(300,400);T.hasta(()=>T.listo(),2);},
  ganaTeclado(T){T.S(.3);T.key('Space');T.hasta(()=>punto(T),4);T.keyup('Space');T.hasta(()=>T.listo(),2);},
  /* echa un poquito, para, y completa: se puede rellenar */
  ganaDosTragos(T){T.S(.2);T.down(300,400);T.hasta(()=>T.listo()||T.P().h>.45,3);T.up(300,400);T.S(.7);T.down(300,400);T.hasta(()=>punto(T),4);T.up(300,400);T.hasta(()=>T.listo(),2);},
  pierde(T){T.S(.3);T.down(300,400);T.hasta(()=>T.listo(),6);T.up(300,400);},                       /* no suelta: se bota */
  pierdeCorto(T){T.S(.3);T.down(300,400);T.hasta(()=>T.listo()||T.P().h>.4,3);T.up(300,400);},      /* se queda corto: pichirre */
  pierdeMachaca(T){T.S(.3);for(let i=0;i<60&&!T.listo();i++){T.key('Space');T.S(.09);T.keyup('Space');T.S(.07);}},   /* machacar no deja asentar: se bota */
  nada:'lose'
};
})();
