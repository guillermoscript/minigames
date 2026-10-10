/* Bot de ¡VOLTEA! (ver ../probar.js). P() da cook (cocción 0..1) y la ventana buena lo..hi; un toque en cualquier parte voltea. */
(function(){
const toca=T=>T.tap(450,330);
BOTS.voltea={
  gana(T){T.S(.3);T.foto('cruda');const p=T.P();T.hasta(()=>T.P().cook>=(p.lo+p.hi)/2);T.foto('doradita');toca(T);},
  ganaTecla(T){const p=T.P();T.hasta(()=>T.P().cook>=p.lo+.03);T.tecla('Space');},
  pierdeCruda(T){T.S(.1);toca(T);},
  pierdeCarbon(T){const p=T.P();T.hasta(()=>T.P().cook>=p.hi+.08);T.foto('humo');toca(T);},
  nada:'lose',
  /* espera a verla dorada, reacciona con su demora y a veces se queda pegado mirando */
  humano(T,o){const p=T.P();T.hasta(()=>T.P().cook>=p.lo+.01);T.S(o.reac*(.4+T.rnd()));if(T.rnd()<o.err)T.S(.25+T.rnd()*.5);toca(T);}
};
})();
