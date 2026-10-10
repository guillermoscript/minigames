/* Bot de ¡AGÁRRALA! (la cava de anime; ver ../probar.js). El puntero arrastra la cava; el teclado da dos jalones. */
(function(){
const libre=T=>T.hasta(()=>T.listo()||T.P().libre,9);                       /* el tío ya saltó de la cava */
const jala=(T,px,seg)=>{const p=T.P();T.drag(p.x,p.y,p.x,p.y-px,seg);};
BOTS.cava={
  /* espera al olón (el tío sale corriendo) y arrastra la cava hasta la arena seca */
  gana(T){for(const o of T.P().olas){T.hasta(()=>T.listo()||T.G.t>=o.tp-.08,9);T.foto(o.am?'amague':'olita');}libre(T);T.S(.1);T.foto('olon');jala(T,200,.14);},
  ganaTeclado(T){libre(T);T.S(.12);T.tecla('ArrowUp');T.S(.08);T.tecla('Space');},
  /* jala de una vez: el tío lo regaña (no pasa nada más) y todavía alcanza a salvarla */
  ganaReganado(T){T.S(.25);jala(T,120,.1);T.S(.15);T.foto('regano');libre(T);T.S(.1);jala(T,200,.14);},
  /* el gag de la spec: se queda corto y la ola le pega a la cava */
  pierde(T){libre(T);T.S(T.P().win*.55);T.foto('pared');jala(T,60,.1);},
  /* machaca desde el principio: el tío nunca se para y la ola se lo lleva con todo y cava */
  pierdeTio(T){while(!T.listo()){T.tecla('Space');T.S(.12);}},
  nada:'lose',
  /* jugador torpe: con probabilidad o.err se deja engañar por una olita (el doble con el amague) y jala antes de tiempo;
     con el olón tarda o.reac en reaccionar, arrastra más lento mientras más torpe, y a veces se queda corto y repite */
  humano(T,o){
    for(const w of T.P().olas)if(T.rnd()<o.err*(w.am?2:1)){T.hasta(()=>T.listo()||T.G.t>=w.tp-.2+o.reac*.5,9);if(T.listo())return;jala(T,130,.12+o.reac*.3);}
    T.hasta(()=>T.listo()||T.P().alarma,9);T.S(o.reac*(.8+T.rnd()*.4));
    for(let i=0;i<5&&!T.listo();i++){const p=T.P(),x=p.x+(T.rnd()-.5)*80;
      T.drag(x,p.y+(T.rnd()-.5)*30,x,p.y-(T.rnd()<o.err?80:190),.1+o.reac*.4);if(!T.listo())T.S(.06+o.reac*.5);}
  }
};
})();
