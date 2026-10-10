/* Bot de ¡PENDRIVE! (ver ../probar.js). P().piv = por donde se agarra, P().dock = dónde hay que dejarlo, P().good = el enchufe va derecho.
   Nivel 3: la primera metida buena rebota (P().reb sube y P().mal dice qué lado no sirve): hay que voltearlo (P().volt) y repetir. */
(function(){
/* lo lleva al puerto y lo suelta cuando el ángulo es el que se pide (ok): devuelve cuántos rebotes había antes */
const mete=(T,ok)=>{const h=T.P().piv;T.down(h.x,h.y-60);for(let i=1;i<=12;i++){const d=T.P().dock;T.move(lerp(h.x,d.x,i/12),lerp(h.y-60,d.y,i/12));T.S(1/60);}
  let n=0;while(!T.listo()&&n++<240){const p=T.P(),d=p.dock;T.move(d.x,d.y);if(ok(p))break;T.S(1/60);}const d=T.P().dock;T.up(d.x,d.y);};
const derecho=p=>Math.abs(p.a)<p.tol*.5,torcido=p=>Math.abs(p.a)>p.tol*1.6;
const casa=T=>T.hasta(()=>T.listo()||Math.hypot(T.P().piv.x-T.P().home.x,T.P().piv.y-T.P().home.y)<6,2);
BOTS.pendrive={
  gana(T){T.S(.2);mete(T,derecho);
    if(!T.listo()){T.S(.1);T.foto('rebote');casa(T);T.S(.5);T.foto('voltealo');const h=T.P().piv;T.down(h.x,h.y-60);T.S(.05);T.up(h.x,h.y-60);T.S(.1);T.foto('volteando');casa(T);T.foto('de-espaldas');mete(T,derecho);}},
  /* nivel 3 sin voltearlo: rebota otra vez (no pierde) y a la tercera, ya volteado, entra */
  ganaTerco(T){T.S(.2);mete(T,derecho);if(T.listo())return;casa(T);mete(T,derecho);if(T.listo())return;casa(T);T.tecla('ArrowUp',.02);T.S(.25);mete(T,derecho);},
  ganaTecla(T){T.S(.2);let n=0;while(!T.listo()&&n++<3){T.tecla('Space',.02);T.hasta(()=>T.listo()||Math.hypot(T.P().piv.x-T.P().dock.x,T.P().piv.y-T.P().dock.y)<T.P().rpos*.4,2);
      T.hasta(()=>T.listo()||derecho(T.P()),3);const r=T.P().reb;T.tecla('Space',.02);T.S(.05);if(T.listo())break;if(T.P().reb>r){T.tecla('ArrowUp',.02);T.S(.3);}}},
  pierde(T){T.S(.2);mete(T,torcido);},                                   /* lo mete torcido */
  /* nivel 3: rebota y nunca lo voltea (se le va el tiempo). En los niveles 1 y 2 no hay rebote: lo suelta lejos y se queda mirando. */
  pierdeSinVoltear(T){T.S(.2);if(T.P().lv<3){T.drag(676,480,600,440,.1);return;}let n=0;while(!T.listo()&&n++<8){mete(T,derecho);casa(T);}},
  nada:'lose'
};
})();
