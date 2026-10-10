/* Bot de ¡TRÁNCALO! (ver ../probar.js). Mantener = acelerar, soltar = frenar: 'p' maneja con el puntero y 'k' con ESPACIO. */
(function(){
const DN={p:T=>T.down(400,300),k:T=>T.key('Space')},UP={p:T=>T.up(400,300),k:T=>T.keyup('Space')};
const final=(T,k)=>{if(T.g0.kind!==k)throw new Error('esperaba el final "'+k+'" y salió "'+T.g0.kind+'"');};
/* chofer fino: acelera mientras, aun soltando en el próximo cuadro, quedaría antes del centro del PEGADITO */
function maneja(T,m){let h=false,f=0;
  while(!T.listo()){const p=T.P(),v1=Math.min(p.VM,p.v+p.AC/60),w=p.go&&p.gap-v1/60-v1*v1/(2*p.BR)>p.Z*.5;
    if(w&&!h){DN[m](T);h=true;}else if(!w&&h){UP[m](T);h=false;}
    if(!f&&p.v>100){f=1;T.foto('acelera');}
    if(f===1&&p.otra){f=2;T.S(.2);T.foto('rueda-otra-vez');}
    T.S(1/60);}
  if(h)UP[m](T);final(T,'win');}
BOTS.trancalo={
  gana(T){maneja(T,'p');},
  ganaTeclado(T){maneja(T,'k');},
  /* arranca tarde, da un pisoncito y se queda corto: el vivo se mete (el final de la ficha) */
  pierde(T){T.hasta(()=>T.P().go);T.S(.3);T.down(400,300);T.S(.35);T.up(400,300);T.hasta(()=>T.listo()||T.P().u>.85);T.foto('casi');T.hasta(()=>T.listo(),9);final(T,'coleo');},
  /* no suelta nunca: se lleva al de adelante */
  pierdeChoca(T){T.hasta(()=>T.P().go);T.down(400,300);T.hasta(()=>T.listo(),9);T.up(400,300);final(T,'choque');},
  /* machacar toquecitos no sirve: el carro es pesado y casi ni se mueve */
  pierdeMachaca(T){while(!T.listo()){T.key('Space');T.S(.04);T.keyup('Space');T.S(.06);}final(T,'coleo');},
  nada:'lose',
  /* jugador torpe: ve al de adelante con o.reac de retraso, suelta a destiempo (±o.err y, mientras más lento, más tarde),
     espera a quedar parado, se toma o.reac+0.1 s para ver cómo quedó y, si quedó corto, da otro pisón */
  humano(T,o){const hist=[],lag=Math.round(o.reac*60);
    const ojo=()=>{const p=T.P();hist.push(p.ax);return{p,gap:hist[Math.max(0,hist.length-1-lag)]-p.px};};
    const mira=s=>{for(let i=Math.round(s*60);i-->0&&!T.listo();){ojo();T.S(1/60);}};
    T.hasta(()=>T.listo()||T.P().go);mira(o.reac);
    while(!T.listo()){const e=(T.rnd()*2-1)*o.err+o.reac*.25;
      T.down(400,300);
      while(!T.listo()){const{p,gap}=ojo();if(gap-p.v*p.v/(2*p.BR)+p.v*e<=p.Z*.5)break;T.S(1/60);}
      T.up(400,300);
      while(!T.listo()&&T.P().v>0){ojo();T.S(1/60);}
      mira(o.reac+.1);
      while(!T.listo()){const{p,gap}=ojo();if(gap>p.Z)break;T.S(1/60);}}}
};
})();
