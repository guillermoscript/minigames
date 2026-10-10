/* Bot de «¡QUITA EL ANUNCIO!» (ver ../probar.js). El botón gris está en P().sx/sy cuando P().vis; en el nivel 3 espera a que brinque (P().hopped). */
(function(){
const sale=T=>T.hasta(()=>{const p=T.P();return T.listo()||(p.vis&&(p.lv<3||p.hopped));},6);
BOTS.anuncio={
  gana(T){sale(T);T.S(.15);T.foto('boton');if(T.listo())return;const p=T.P();T.tap(p.sx,p.sy);},
  ganaTeclado(T){sale(T);T.S(.1);if(T.listo())return;T.tecla('ArrowLeft');T.S(.05);T.foto('foco');T.tecla('Space');},
  pierde(T){T.hasta(()=>T.listo()||T.P().ad,3);T.S(.4);T.foto('anuncio');if(T.listo())return;const f=T.P().fk[0];T.tap(f.x,f.y);},   /* le da al ¡HAZ CLIC! */
  pierdeMachaca(T){for(let i=0;i<40&&!T.listo();i++){T.tecla('Space');T.S(.13);}},                                              /* machacar ESPACIO cae en ¡HAZ CLIC! */
  nada:'lose'
};
})();
