/* Bot de «¡AGARRA LA CINTURA!» (ver ../probar.js). Mantener apretado y seguir el sitio seguro (probe().safe) del próximo estorbo. */
(function(){
BOTS.trencito={
  gana(T){T.S(.25);T.down(400,400);let k=0,f=0;while(!T.listo()){T.move(T.P().safe,400);T.S(1/60);k++;if(!f&&T.P().next-T.G.t<.35&&k>40){f=1;T.foto('esquivando');}}T.up(400,400);},
  /* solo flechas, soltándolas cuando ya está en su sitio: el agarre por teclado no se suelta */
  ganaTeclado(T){T.S(.25);let l=0,r=0,f=0;
    while(!T.listo()){const p=T.P(),d=p.safe-p.tx,wl=d<-12,wr=d>12;
      if(wl!==!!l){l=wl?1:0;wl?T.key('ArrowLeft'):T.keyup('ArrowLeft');}if(wr!==!!r){r=wr?1:0;wr?T.key('ArrowRight'):T.keyup('ArrowRight');}T.S(1/60);
      if(!f&&T.G.t>1.2&&!l&&!r){f=1;T.foto('agarrado-sin-teclas');}}
    T.keyup('ArrowLeft');T.keyup('ArrowRight');},
  /* un toque a ESPACIO agarra; sin moverse choca, pero no se "suelta" */
  pierdeEspacio(T){T.S(.25);T.tecla('Space',.05);T.hasta(()=>T.listo(),8);},
  pierde(T){T.S(.25);T.down(400,400);T.hasta(()=>T.listo(),8);T.up(400,400);},          /* agarra pero no se mueve: se lleva el primer estorbo */
  pierdeSuelta(T){T.S(.25);T.down(400,400);T.S(.4);T.up(400,400);T.hasta(()=>T.listo(),8);},   /* se suelta: el tren sigue sin él */
  nada:'lose'
};
})();
