/* Bot de ¡MÁTALA! (ver ../probar.js). P().fly = ya va volando hacia ti; P().W = cuánto dura el vuelo. */
(function(){
const vuela=T=>T.hasta(()=>T.listo()||T.P().fly,8);
BOTS.cucaracha={
  gana(T){T.S(.4);T.foto('pared');vuela(T);T.S(.2);T.foto('vuelo');T.tap(400,300);},
  ganaAlFilo(T){vuela(T);T.S(T.P().W-.04);T.tap(400,300);},
  ganaTecla(T){vuela(T);T.S(.1);T.tecla('Space');},
  /* donde se perdona uno (nivel 1): pela una vez, cuenta UN solo cholazo adelantado, y todavía le da en el aire */
  ganaTrasPelar(T){if(T.P().maxMiss>0){T.S(.5);T.tap(400,300);if(T.P().miss!==1)throw new Error('un toque contó '+T.P().miss+' cholazos adelantados');T.S(.05);T.tap(400,300);if(T.P().miss!==1)throw new Error('el toque dentro del reposo contó');}
    vuela(T);T.S(.15);T.tap(400,300);},
  /* se adelanta: cholazo a la pared (en el nivel 1 el primero se perdona) */
  pierde(T){T.S(.3);T.tap(400,300);T.S(.45);T.tap(400,300);T.S(.2);T.foto('pelaste');},
  pierdeTarde(T){vuela(T);T.S(T.P().W+.1);T.tap(400,300);},
  /* machacar la pantalla no sirve */
  pierdeMachaca(T){let n=0;while(!T.listo()&&n++<80){T.tap(400,300);T.S(.12);}},
  nada:'lose',
  humano(T,o){vuela(T);T.S(o.reac+T.rnd()*.12);if(!T.listo())T.tap(400,300);}
};
})();
