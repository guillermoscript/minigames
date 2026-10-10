/* Bot de ¡ELIGE LA LLAVE! (ver ../probar.js). El abanico está en P().keys (la buena es P().good) y la boca del candado en P().K. */
(function(){
const lleva=(T,i,seg=.22)=>{const p=T.P(),k=p.keys[i];T.drag(k.x,k.y,p.K.x,p.K.y+p.L,seg);};
BOTS.llave={
  gana(T){T.S(.3);T.foto('abanico');lleva(T,T.P().good);},
  ganaTeclas(T){T.S(.2);let n=0;while(!T.listo()&&T.P().sel!==T.P().good&&n++<6){T.tecla(T.P().sel<T.P().good?'ArrowRight':'ArrowLeft');T.S(.05);}T.tecla('Space');},
  /* agarra una mala, la suelta lejos (vuelve al manojo) y después lleva la buena */
  ganaSeArrepiente(T){T.S(.2);const p=T.P(),i=(p.good+2)%5,k=p.keys[i];T.drag(k.x,k.y,k.x<400?60:740,550,.12);T.S(.1);if(!T.listo())lleva(T,p.good,.16);},
  pierde(T){T.S(.3);lleva(T,(T.P().good+1)%5);T.S(.6);T.foto('trabada');},
  nada:'lose',
  /* busca la marca (tarda más mientras más señuelos haya) y a veces agarra la que no es */
  humano(T,o){const p=T.P(),sen=p.keys.filter(k=>k.mark&&k.mark!=='roja').length;T.S(.35+o.reac+sen*.12+T.rnd()*.2);
    const mala=T.rnd()<o.err*(.4+sen*.8);lleva(T,mala?(p.good+1+Math.floor(T.rnd()*4))%5:p.good,.22+T.rnd()*.15);}
};
})();
