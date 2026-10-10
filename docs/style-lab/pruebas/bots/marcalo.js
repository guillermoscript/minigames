/* Bot de «¡MÁRCALO!» (ver ../probar.js). Mantener = llama en el borde; soltar con el calor h entre lo (se dobló) y hi (¡FUSH!). */
(function(){
const doblado=(T,k=.3)=>T.hasta(()=>{const p=T.P();return T.listo()||p.h>=p.lo+(p.hi-p.lo)*k;},8);
BOTS.marcalo={
  gana(T){T.S(.4);T.down(520,300);T.S(.5);T.foto('calentando');doblado(T);T.foto('doblado');T.up(520,300);},
  ganaTeclado(T){T.S(.4);T.key('Space');doblado(T,.4);T.keyup('Space');},
  /* un intento fallido (ni se nota) y el segundo bueno; suelta fuera del canvas */
  ganaSegundo(T){T.S(.3);T.down(400,300);T.S(.4);T.up(400,300);T.S(.3);T.down(400,300);doblado(T,.2);T.up(900,700);},
  pierde(T){T.S(.4);T.down(520,300);T.hasta(()=>T.listo(),8);T.up(520,300);},                 /* se queda pegado: ¡FUSH! */
  pierdeTemprano(T){for(let i=0;i<2&&!T.listo();i++){T.S(.4);T.down(520,300);T.S(.35);T.up(520,300);}},   /* dos veces ni se nota: se lo llevan */
  pierdeToques(T){T.S(.3);for(let i=0;i<8&&!T.listo();i++){T.tap(400,300);T.S(.12);}},      /* machacar */
  nada:'lose'
};
})();
