/* Bot de ¡SÓPLALE! (ver ../probar.js). Los dos botones están en P().bt; P().hot va de 1 (hirviendo) a 0 (tibiecita). */
(function(){
const toca=(T,i)=>{const b=T.P().bt[i];T.tap(b[0],b[1]);};
BOTS.sopa={
  gana(T){T.S(.25);let n=0;while(!T.listo()&&n<80){toca(T,n%2);T.S(.09);n++;if(n===6)T.foto('soplando');}},
  ganaTeclas(T){T.S(.25);let n=0;while(!T.listo()&&n<80){T.tecla(n%2?'ArrowRight':'ArrowLeft');T.S(.09);n++;}},
  ganaEspacio(T){T.S(.25);let n=0;while(!T.listo()&&n<80){T.tecla('Space');T.S(.09);n++;}},
  /* siempre el mismo botón: no sopla nada */
  pierde(T){T.S(.25);let n=0;while(!T.listo()&&n<80){toca(T,0);T.S(.09);n++;}},
  pierdeLento(T){T.S(.25);let n=0;while(!T.listo()&&n<40){toca(T,n%2);T.S(.7);n++;}},
  nada:'lose',
  humano(T,o){T.S(.3+o.reac);let n=0,i=0;while(!T.listo()&&n<120){if(T.rnd()>=o.err)i=1-i;toca(T,i);T.S(.1+o.reac*.35+T.rnd()*.05);n++;}}
};
})();
