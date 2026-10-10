/* Bot de ¡AMÁRRALA! de la hallaca (ver ../probar.js). El centro está en P().C; P().V y P().H son los carriles de cada pasada. */
(function(){
const v=(T,o,dx=0,seg=.12)=>{const c=T.P().C;T.drag(c.x+o-dx,c.y-160,c.x+o+dx,c.y+160,seg);T.S(.1);};
const h=(T,o,dy=0,seg=.12)=>{const c=T.P().C;T.drag(c.x-210,c.y+o-dy,c.x+210,c.y+o+dy,seg);T.S(.1);};
BOTS.hallaca={
  gana(T){T.S(.25);const p=T.P();for(const o of p.V)v(T,o);T.foto('a-lo-largo');for(const o of p.H)h(T,o);},
  ganaAlReves(T){T.S(.25);const p=T.P();for(const o of p.H)h(T,o);for(const o of p.V)v(T,o);},
  ganaTeclas(T){T.S(.25);const p=T.P();for(const o of p.V){T.tecla('ArrowDown');T.S(.1);}for(const o of p.H){T.tecla('ArrowRight');T.S(.1);}},
  /* un toquecito y un trazo cortico no cuentan ni castigan */
  ganaConTitubeo(T){T.S(.25);const p=T.P(),c=p.C;T.tap(c.x,c.y);T.S(.1);T.drag(c.x,c.y-50,c.x,c.y+50,.08);T.S(.1);for(const o of p.V)v(T,o);for(const o of p.H)h(T,o);},
  /* en diagonal: chueco (en el nivel 1 hacen falta dos) */
  pierde(T){T.S(.25);const c=T.P().C;for(let i=0;i<3&&!T.listo();i++){T.drag(c.x-150,c.y-150,c.x+150,c.y+150,.12);T.S(.15);}T.S(.5);T.foto('rajada');},
  pierdeDescentrada(T){T.S(.25);for(let i=0;i<3&&!T.listo();i++)v(T,104);},
  nada:'lose',
  /* trazos de verdad: un poco torcidos y un poco corridos */
  humano(T,o){T.S(.35+o.reac);const p=T.P();
    for(const ax of['V','H'])for(const l of p[ax]){for(let n=0;n<3&&!T.listo();n++){const hecho=T.P().done,cor=(T.rnd()-.5)*o.err*220,tor=(T.rnd()-.5)*o.err*330;
      if(ax==='V')v(T,l+cor,tor/2,.14+o.reac*.3);else h(T,l+cor,tor/2,.14+o.reac*.3);T.S(.12+o.reac*.6);if(T.P().done>hecho)break;}}}
};
})();
