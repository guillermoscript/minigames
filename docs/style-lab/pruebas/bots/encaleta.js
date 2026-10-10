/* Bot de ¡ENCALETA! (ver ../probar.js; correr con --archivo=docs/style-lab/juegos-bus.js). P().tM = cuándo se monta el ladrón, P().RE = cuánto tarda
   en llegar, P().decoy = sale el vendedor, P().its = [{x,y,hid,w}] lo que hay que esconder (nivel 3: teléfono y cartera), P().SPOTS = los escondites. */
(function(){
const roban=T=>T.hasta(()=>T.listo()||T.G.t>=T.P().tM,8);
BOTS.encaleta={
  gana(T){roban(T);T.S(.12);T.foto('quietos');const p=T.P(),orden=[2,0,1];
    p.its.forEach((it,i)=>{const s=p.SPOTS[orden[i]];T.drag(it.x,it.y,s.x,s.y,.18);T.S(.05);if(!it.hid)throw new Error('la cosa '+i+' no quedó escondida');T.foto('escondido'+i);});
    T.hasta(()=>T.listo(),6);},
  ganaTeclas(T){roban(T);T.S(.1);const n=T.P().its.length;T.tecla('ArrowRight',.05);T.S(.1);if(n>1){T.tecla('Space',.05);T.S(.1);}T.hasta(()=>T.listo(),6);},
  /* dos cosas en el mismo escondite: la segunda no cabe (nivel 3). En los otros niveles: no esconder nada */
  pierdeMismo(T){roban(T);T.S(.1);const p=T.P();if(p.its.length>1){T.tecla('ArrowRight',.05);T.S(.1);T.tecla('ArrowRight',.05);T.S(.1);T.foto('no-cabe');
      if(p.its[1].hid)throw new Error('dos cosas quedaron en el mismo escondite');}T.hasta(()=>T.listo(),6);},
  /* nivel 3: esconder solo el teléfono no basta */
  pierdeUna(T){roban(T);T.S(.1);const p=T.P();if(p.its.length>1){const s=p.SPOTS[2];T.drag(p.its[0].x,p.its[0].y,s.x,s.y,.18);}T.hasta(()=>T.listo(),6);T.S(.3);T.foto('robo');},
  pierdeFalsa(T){T.S(.15);T.tecla('Space',.05);T.hasta(()=>T.listo(),6);},
  nada:'lose'
};
})();
