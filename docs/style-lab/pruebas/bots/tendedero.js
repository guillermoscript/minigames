/* Bot de ¡JÁLALA! (ver ../probar.js). P().prendas = [{x, y, on, left}]: dónde está cada prenda ahora, si sigue colgada y
   cuántos jalones le faltan; P().done / P().total. */
(function(){
const jalon=(T,q,dx=0,seg=.09)=>{T.drag(q.x+dx,q.y,q.x+dx,q.y+130,seg);T.S(.08);};
const colgadas=T=>T.P().prendas.filter(q=>q.on);
BOTS.tendedero={
  gana(T){T.S(.3);T.foto('trueno');let n=0;while(!T.listo()&&n++<8){jalon(T,colgadas(T)[0]);if(n===1)T.foto('un-jalon');}},
  ganaAlReves(T){T.S(.3);let n=0;while(!T.listo()&&n++<8)jalon(T,colgadas(T).pop());},
  ganaTeclas(T){T.S(.3);let n=0;while(!T.listo()&&n++<8){T.tecla(n%2?'ArrowDown':'Space');T.S(.1);}},
  /* un toque, un trazo hacia arriba y uno de lado no cuentan ni castigan */
  ganaConTitubeo(T){T.S(.3);const q=colgadas(T)[0];T.tap(q.x,q.y);T.S(.05);T.drag(q.x,q.y+120,q.x,q.y,.08);T.S(.05);T.drag(q.x-80,q.y,q.x+80,q.y+10,.08);T.S(.05);
    if(T.P().done||T.P().prendas[0].left!==q.left)throw new Error('un trazo que no baja arrancó la prenda');
    let n=0;while(!T.listo()&&n++<8)jalon(T,colgadas(T)[0]);},
  /* se queda con una sola y lo agarra el aguacero */
  pierde(T){T.S(.3);jalon(T,colgadas(T).pop());T.hasta(()=>T.listo(),8);T.S(.8);T.foto('barro');},
  nada:'lose',
  humano(T,o){T.S(.4+o.reac);let n=0;while(!T.listo()&&n++<14){const q=colgadas(T)[0];if(!q)break;jalon(T,q,(T.rnd()-.5)*o.err*260,.1+o.reac*.3);T.S(.1+o.reac*.7);}}
};
})();
