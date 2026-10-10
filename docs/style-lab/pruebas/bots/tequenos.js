/* Bot de «¡AGARRA!» (los tequeños) (ver ../probar.js). probe(): items[] = lo que hay en la bandeja (x, y, on, nap = servilleta,
   tg = un primo ya le va a meter la mano), lock = la mano está temblando, HX = donde agarra el teclado. */
(function(){
const reales=T=>T.P().items.filter(q=>q.on&&!q.nap&&q.x>40&&q.x<760);
/* toca n tequeños de verdad que ningún primo tenga en la mira */
function toca(T,n,foto){let k=0;while(!T.listo()&&k<n){const c=reales(T).filter(q=>!q.tg);
    if(T.P().lock<=0&&c.length){const q=c[c.length-1];T.tap(q.x,q.y);k++;if(foto&&k===1){T.S(.12);T.foto(foto);}if(k<n)T.S(.3);}else T.S(1/60);}}
BOTS.tequenos={
  gana(T){T.S(.45);T.foto('bandeja');toca(T,2,'uno');},
  /* teclado: ESPACIO cuando un tequeño de verdad pasa encima de la mano */
  ganaTeclado(T){let k=0;while(!T.listo()){const p=T.P();if(p.lock<=0&&p.items.some(q=>q.on&&!q.nap&&Math.abs(q.x-p.HX)<7)){if(!k++)T.foto('ritmo');T.tecla('Space');}T.S(1/120,1/120);}},
  /* dos dedos a la vez: agarrar bien no bloquea */
  ganaDosDedos(T){T.hasta(()=>T.listo()||reales(T).filter(q=>!q.tg).length>=2,6);const c=reales(T).filter(q=>!q.tg);if(c.length<2)return;
    T.down(c[0].x,c[0].y);T.down(c[1].x,c[1].y);T.up(c[0].x,c[0].y);T.up(c[1].x,c[1].y);},
  /* el final del guion: puro manotazo al aire (y a la servilleta, si hay) hasta que el primo barre */
  pierde(T){T.S(.9);const s=T.P().items.find(q=>q.on&&q.nap&&q.x>40&&q.x<760);if(s){T.tap(s.x,s.y);T.S(.12);T.foto('servilleta');T.S(.6);}
    let k=0;while(!T.listo()){const p=T.P();T.tap(clamp(p.cx,60,740),p.IY-110);if(!k++){T.S(.12);T.foto('aire');}T.S(.7);}},
  pierdeUno(T){T.S(.45);toca(T,1);T.S(.5);T.foto('uno-solo');},           /* agarra uno y se queda mirando */
  pierdeMachacando(T){let i=0;while(!T.listo()){if(i++%2)T.tecla('Space');else T.tap(400,T.P().IY);T.S(.1);}},   /* dedo y ESPACIO a lo loco */
  nada:'lose',
  /* jugador torpe con el dedo: tarda o.reac en decidirse; el dedo llega atrasado y con un error de ±o.err s de recorrido de la
     bandeja; y de vez en cuando (o.err) escoge mal: la servilleta o uno que un primo ya tiene en la mira */
  humano(T,o){T.S(.3+o.reac);
    while(!T.listo()){const p=T.P(),v=p.items.filter(q=>q.on&&q.x>30&&q.x<770);
      if(p.lock>0||!v.length){T.S(1/30);continue;}
      let c=v.filter(q=>!q.nap&&!q.tg);if(!c.length||T.rnd()<o.err)c=v;
      const q=c[Math.floor(T.rnd()*c.length)];T.S(o.reac);if(T.listo())break;
      const q2=T.P().items[q.i];T.tap(q2.x-p.V*o.err*.5+(T.rnd()*2-1)*p.V*o.err*1.2,q2.y+(T.rnd()*2-1)*24);T.S(.12);}}
};
})();
