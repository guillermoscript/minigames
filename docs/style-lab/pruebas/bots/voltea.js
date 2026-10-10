/* Bot de ¡VOLTEA! (ver ../probar.js). P() da cook (cocción 0..1 de la más adelantada sin voltear) y la ventana buena lo..hi.
   P().a = las arepas [{x, y, cook, rate, st}]: una en los niveles 1 y 2 (un toque en cualquier parte la voltea) y dos en el 3
   (se toca cada una, o ← y →). P().vela = la vela está apagada y no hay medidor. */
(function(){
const toca=T=>T.tap(450,330);
/* voltea todas, de la más rápida a la más lenta, cuando cada una llega a lo+m; con = cómo se voltea la arepa i */
const todas=(T,m,con)=>{const p=T.P(),ord=p.a.map((a,i)=>i).sort((i,j)=>p.a[j].rate-p.a[i].rate);
  for(const i of ord){T.hasta(()=>T.listo()||T.P().a[i].cook>=p.lo+m);if(T.listo())return;con(i,T.P().a[i]);}};
BOTS.voltea={
  gana(T){T.S(.3);T.foto('cruda');const p=T.P();let k=0;todas(T,(p.hi-p.lo)/2,(i,a)=>{T.foto(k++?'segunda':'doradita');T.tap(a.x,a.y);});},
  ganaTecla(T){const dos=T.P().a.length>1;todas(T,.03,i=>T.tecla(dos?(i?'ArrowRight':'ArrowLeft'):'Space'));},
  /* aguanta el apagón de la vela (nivel 2+) y voltea apenas vuelve el medidor */
  ganaTrasLaVela(T){T.hasta(()=>T.listo()||T.P().vela||T.P().cook>=T.P().lo,8);T.S(.05);T.foto('vela');todas(T,.02,(i,a)=>T.tap(a.x,a.y));},
  pierdeCruda(T){T.S(.1);toca(T);},
  pierdeCarbon(T){const p=T.P();T.hasta(()=>T.P().cook>=p.hi+.08);T.foto('humo');toca(T);},
  /* nivel 3: voltea bien la rápida y deja quemar la otra (en los otros niveles, no toca nada) */
  pierdeUnaSola(T){const p=T.P();if(p.a.length<2)return;const i=p.a[0].rate>p.a[1].rate?0:1;T.hasta(()=>T.P().a[i].cook>=p.lo+.04);T.tap(p.a[i].x,p.a[i].y);
    if(T.listo())throw new Error('con una sola arepa volteada ya hubo resultado');T.S(.5);T.foto('lista');},
  /* nivel 3: ESPACIO no voltea ninguna (no sabe cuál) */
  pierdeEspacio(T){const p=T.P();T.hasta(()=>T.listo()||T.P().cook>=(p.lo+p.hi)/2);if(p.a.length>1)T.tecla('Space');},
  nada:'lose',
  /* espera a verla dorada, reacciona con su demora y a veces se queda pegado mirando */
  humano(T,o){todas(T,.01,(i,a)=>{T.S(o.reac*(.4+T.rnd()));if(T.rnd()<o.err)T.S(.25+T.rnd()*.5);T.tap(a.x,a.y);});}
};
})();
