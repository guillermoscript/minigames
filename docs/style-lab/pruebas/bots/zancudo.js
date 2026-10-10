/* Bot de ¡MATA EL ZANCUDO! (ver ../probar.js). El bicho está en P().x, P().y; la luz en P().px, P().py; P().cool = reposo tras pelar. */
(function(){
const lejos=p=>[p.x<400?690:110,490];
BOTS.zancudo={
  /* alumbra lejos (solo se ven los ojos), arrastra la luz hasta el bicho y suelta encima; si se le va, repite */
  gana(T){T.S(.3);T.foto('inicio');const[lx,ly]=lejos(T.P());T.down(lx,ly);T.S(.25);T.foto('ojos');
    let n=0;while(!T.listo()&&n++<12){let p=T.P();T.move(p.x,p.y);T.S(.05);if(n===1)T.foto('alumbrado');
      p=T.P();T.move(p.x,p.y);T.up(p.x,p.y);if(T.listo())break;T.S(.36);p=T.P();T.down(p.x,p.y);}},
  /* pela uno lejos, el toque dentro del reposo no cuenta, y después sí le da */
  ganaTrasPelar(T){T.S(.3);const[lx,ly]=lejos(T.P());T.tap(lx,ly);if(T.listo())throw new Error('un chancletazo lejos contó');
    T.S(.1);T.foto('pelaste');let p=T.P();T.tap(p.x,p.y);if(T.listo())throw new Error('el chancletazo dentro del reposo contó');
    T.S(.3);p=T.P();T.tap(p.x,p.y);},
  ganaTeclas(T){T.S(.2);let n=0;while(!T.listo()&&n++<200){const p=T.P(),dx=p.x-p.px,dy=p.y-p.py;
      if(Math.hypot(dx,dy)<p.R-6&&p.cool<=0)T.tecla('Space');
      else if(Math.abs(dx)>=Math.abs(dy))T.tecla(dx>0?'ArrowRight':'ArrowLeft');else T.tecla(dy>0?'ArrowDown':'ArrowUp');
      T.S(.03);}},
  nada:'lose'
};
})();
