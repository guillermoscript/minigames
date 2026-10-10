/* Bot de ¡CIERRA LA NEVERA! (ver ../probar.js). P().o = cuánto se abrió la puerta (0..1); P().surge = le está dando el jalón. */
(function(){
const machaca=(T,cada,tecla)=>{let n=0;while(!T.listo()&&n++<400){if(tecla)T.tecla('Space');else T.tap(300,380);T.S(cada);}};
BOTS.nevera={
  /* toca parejo, sin parar */
  gana(T){let n=0;while(!T.listo()&&n++<400){T.tap(300,380);T.S(.08);if(n===8)T.foto('empujando');if(T.P().surge&&!T.j){T.j=1;T.foto('jalon');}}},
  ganaTecla(T){machaca(T,.08,true);},
  /* solo cuando ya va por la mitad: aguanta igual */
  ganaAlFilo(T){let n=0;while(!T.listo()&&n++<2000){if(T.P().o>.5)T.tap(300,380);T.S(1/60);}},
  /* empuja un ratico y se cansa */
  pierde(T){for(let i=0;i<6&&!T.listo();i++){T.tap(300,380);T.S(.1);}T.S(.9);T.foto('abriendose');},
  /* toques flojos: no alcanza */
  pierdeLento(T){machaca(T,.7);},
  nada:'lose',
  humano(T,o){const cada=.11+o.reac*.25;let n=0;while(!T.listo()&&n++<400){if(T.rnd()>o.err*.5)T.tap(300,380);T.S(cada*(.8+T.rnd()*.4));}}
};
})();
