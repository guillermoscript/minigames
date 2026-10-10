/* Bot de ¡AGÁRRATE! (ver ../probar.js; correr con --archivo=docs/style-lab/juegos-bus.js). P().d / v = el punto y su velocidad, P().zw = medio ancho del verde,
   P().grip, P().tD = el frenazo, P().tD2 = el segundo (solo nivel 3; si no, 1e9), P().jolt = cuántos frenazos han pegado. */
(function(){
BOTS.agarrate={
  gana(T){let k=0,f1=false,f2=false;
    while(!T.listo()){const p=T.P(),u=p.d*5+p.v,nk=u>.02?-1:u<-.02?1:0;
      if(nk!==k){T.keyup('ArrowLeft');T.keyup('ArrowRight');if(nk)T.key(nk<0?'ArrowLeft':'ArrowRight');k=nk;}
      if(!f1&&p.jolt>=1&&T.G.t>p.tD+.25){f1=true;T.foto('frenazo');}if(!f2&&p.jolt>=2&&T.G.t>p.tD2+.25){f2=true;T.foto('frenazo2');}
      if(p.jolt>(p.tD2<100?2:1))throw new Error('frenazos de más: '+p.jolt);
      T.S(1/60);}
    },
  pierde(T){T.key('ArrowLeft');T.hasta(()=>T.listo(),8);T.keyup('ArrowLeft');},
  nada:'lose'
};
})();
