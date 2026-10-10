/* Bot de ¡TÚMBALO! (ver ../probar.js). P().tx = por dónde va el pote; P().mx = el mango maduro; P().nests = los avisperos;
   P().tol / P().nt = cuánto perdona el mango / el avispero; P().yank = la vara está en pleno jalón (no oye toques). */
(function(){
const bajo=(T,x,d)=>T.hasta(()=>T.listo()||(!T.P().yank&&Math.abs(T.P().tx-x)<d),8);
BOTS.mango={
  gana(T){T.S(.3);T.foto('paseo');bajo(T,T.P().mx,T.P().tol*.4);T.foto('alineado');T.tap(400,300);},
  ganaTecla(T){bajo(T,T.P().mx,T.P().tol*.4);T.tecla('Space');},
  /* un jalón al aire no mata: se le va un ratico y todavía le da tiempo */
  ganaTrasPelar(T){const p=T.P();T.hasta(()=>T.listo()||(Math.abs(T.P().tx-p.mx)>p.tol+30&&p.nests.every(n=>Math.abs(T.P().tx-n)>p.nt+30)),4);T.tap(400,300);
    if(T.P().miss!==1)throw new Error('el jalón al aire contó '+T.P().miss);T.S(.5);bajo(T,T.P().mx,T.P().tol*.4);T.tap(400,300);},
  pierde(T){bajo(T,T.P().nests[0],12);T.tap(400,300);T.S(.9);T.foto('avispas');},
  nada:'lose',
  humano(T,o){while(!T.listo()){bajo(T,T.P().mx,T.P().tol*(.5+o.err));T.S(o.reac*.35+T.rnd()*.06);if(!T.listo())T.tap(400,300);T.S(.2);}}
};
})();
