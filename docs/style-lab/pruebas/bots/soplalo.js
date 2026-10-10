/* Bot de ¡SÓPLALO! (ver ../probar.js). Alterna los dos lados de la pantalla (o ← →); P().temp es el queso y P().burn el paladar. */
(function(){
BOTS.soplalo={
  gana(T){T.S(.3);for(let i=0;i<80&&!T.listo();i++){T.tap(i%2?600:200,300);T.S(.09);if(i===5)T.foto('soplando');}},
  ganaTeclado(T){T.S(.3);for(let i=0;i<80&&!T.listo();i++){T.tecla(i%2?'ArrowRight':'ArrowLeft');T.S(.09);}},
  pierde(T){T.S(.3);for(let i=0;i<60&&!T.listo();i++){T.tap(200,300);T.S(.1);if(i===6)T.foto('cachetes');}T.hasta(()=>T.listo(),8);},   /* siempre el mismo lado: puro cachete */
  pierdeEspacio(T){T.S(.3);for(let i=0;i<40&&!T.listo();i++){T.tecla('Space');T.S(.13);}T.hasta(()=>T.listo(),8);},                      /* ESPACIO no sopla */
  nada:'lose'
};
})();
