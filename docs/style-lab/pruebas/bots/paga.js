/* Bot de ¡PAGA Y CORRE! (ver ../probar.js). P().ph: 1 doblar, 2 correr. En el nivel 3 el colector voltea: P().mira 1 = avisa, 2 = te mira. */
(function(){
const dobla=T=>{T.S(.25);let n=0;while(!T.listo()&&T.P().ph===1&&T.P().nf<T.P().NF&&n++<6){T.tecla(n%2?'ArrowRight':'ArrowDown',.02);T.S(.2);}T.hasta(()=>T.listo()||T.P().ph===2,2);};
const corre=(T,ciego)=>{let n=0;while(!T.listo()&&n++<200){if(ciego||T.P().mira!==2)T.tecla('Space',.02);else T.foto('quieto');T.S(ciego?.09:.05);if(T.P().mira===1)T.foto('ojo');}};
BOTS.paga={
  gana(T){dobla(T);T.foto('doblado');corre(T,false);},
  /* dobla con el dedo y corre a toques */
  ganaDedo(T){T.S(.25);let n=0;while(!T.listo()&&T.P().ph===1&&T.P().nf<T.P().NF&&n++<6){T.drag(300,400,460,400,.08);T.S(.2);}T.hasta(()=>T.listo()||T.P().ph===2,2);
    n=0;while(!T.listo()&&n++<200){if(T.P().mira!==2)T.tap(400,300);T.S(.07);}},
  pierdeLento(T){T.S(.25);T.tecla('ArrowRight',.02);},                      /* un solo doblez: lo pilla doblando */
  pierdeAgarra(T){dobla(T);T.tecla('Space',.02);T.S(.1);T.tecla('Space',.02);},   /* dos pasitos y se queda: lo agarra */
  /* nivel 3: machaca sin mirar (a ritmo de gente, unos 9 toques por segundo) y lo ven. En los niveles 1 y 2 no hay volteada, así que se queda parado y lo agarran. */
  pierdeVisto(T){dobla(T);if(T.P().lv>2)corre(T,true);},
  nada:'lose'
};
})();
