/* Bot de «¡NO TE MANCHES!» (ver ../probar.js). Control PD sobre la torta: c = posición en el plato, v = velocidad;
   cuando avisan un tropezón (from) la arrima hacia el lado por donde viene, como haría alguien con práctica. */
(function(){
const quiere=T=>{const q=T.P(),u=q.c-q.from*30+q.v*.3;return u>6?-1:u<-6?1:0;};
BOTS.torta={
  /* puntero: mantener apretado un lado de la pantalla */
  gana(T){let cur=0,n=0;while(!T.listo()){const w=quiere(T);if(w!==cur){if(cur)T.up(cur<0?200:600,300);if(w)T.down(w<0?200:600,300);cur=w;}
      if(++n===120)T.foto('medio');T.S(1/60);}if(cur)T.up(400,300);},
  /* teclado: flechas sostenidas */
  ganaTeclado(T){let cur=0;const K={'-1':'ArrowLeft','1':'ArrowRight'};while(!T.listo()){const w=quiere(T);if(w!==cur){if(cur)T.keyup(K[cur]);if(w)T.key(K[w]);cur=w;}T.S(1/60);}if(cur)T.keyup(K[cur]);},
  /* inclina para un solo lado: la torta se va */
  pierde(T){T.hold(0,1);T.hasta(()=>T.listo(),9);T.hold(0,0);},
  nada:'lose'                                                  /* el plato de cartón se dobla solo */
};
})();
