/* Bot de «¡SUELTA EL CLOCHE!» (ver ../probar.js). Mantener = pisar el cloche; soltar con la aguja dentro del verde. */
(function(){
/* espera a que la aguja esté dentro del verde, a una fracción k del ancho (y todavía subiendo) */
const alVerde=(T,k=.3)=>T.hasta(()=>{const p=T.P();return T.listo()||p.v>=p.b0+(p.b1-p.b0)*k;},8);
BOTS.cloche={
  gana(T){T.S(.4);T.down(400,300);T.S(.5);T.foto('empujando');alVerde(T);T.foto('verde');T.up(400,300);},
  ganaTeclado(T){T.S(.4);T.key('Space');alVerde(T,.4);T.keyup('Space');},
  /* suelta fuera del canvas (el dedo se salió): igual cuenta como soltar */
  ganaAfuera(T){T.S(.3);T.down(700,500);alVerde(T,.5);T.up(900,700);},
  /* aguanta de más y lo salva cuando la aguja se devuelve por el verde */
  ganaDeVuelta(T){T.S(.2);T.down(400,300);T.hasta(()=>T.listo()||T.P().fase===2,8);T.hasta(()=>{const p=T.P();return T.listo()||p.v<=p.b1-(p.b1-p.b0)*.3;},8);T.up(400,300);},
  pierde(T){T.S(.4);T.down(400,300);T.S(.45);T.up(400,300);},                       /* suelta antes del verde: ¡MUY LENTO! */
  pierdeTarde(T){T.S(.4);T.down(400,300);T.hasta(()=>T.listo()||T.P().v>T.P().b1+.03,8);T.foto('rojo');T.up(400,300);},   /* ¡TE PASASTE! */
  pierdeAguanta(T){T.S(.4);T.key('Space');T.hasta(()=>T.listo()||T.P().fase===2,8);T.foto('sin-aire');T.hasta(()=>T.listo(),9);T.keyup('Space');},   /* nunca suelta: ¡SE CANSARON! */
  pierdeToque(T){T.S(.5);for(let i=0;i<8&&!T.listo();i++){T.tap(400,300);T.S(.12);}},   /* machacar: el primer toque ya es soltar en cero */
  pierdeAmague(T){T.S(.3);T.down(400,300);T.hasta(()=>T.listo()||T.P().v>=T.P().b0-.045,8);T.up(400,300);},   /* suelta por adelantado, con la aguja a punto de entrar */
  nada:'lose',                                                                      /* ¡NI LO PISASTE! */
  /* jugador torpe: tarda en empezar a pisar, y suelta o.reac (± o.err) segundos después de VER la aguja en el verde.
     A veces (más mientras más torpe) se adelanta y suelta cuando la aguja apenas se está acercando. */
  humano(T,o){T.S(.35+o.reac);T.down(400,300);const pronto=T.rnd()<o.err*1.5;
    T.hasta(()=>{const p=T.P();return T.listo()||p.v>=p.b0-(pronto?.05:0);},8);
    T.S(Math.max(1/60,o.reac+(T.rnd()*2-1)*o.err));T.up(400,300);}
};
})();
