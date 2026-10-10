/* Bot de ¡ENCHUFA! (ver ../probar.js). P() = {x, y} de la toma AHORA; el dedo se suelta en (x, y+tip) porque la punta del
   enchufe queda tip px por encima; r = tolerancia; en(dt) = dónde estará la toma en dt s; paso = lo que mueve una flecha.
   Nivel 3: x, y es la toma BUENA, mala = {x, y} de la quemada (null en los otros niveles) y jalon = la regleta va brincando. */
(function(){
const mete=T=>{const p=T.P();T.move(p.x,p.y+p.tip);T.up(p.x,p.y+p.tip);};
BOTS.enchufa={
  gana(T){T.S(.3);T.foto('inicio');T.down(400,430);T.S(.5);const p=T.P();T.move(p.x-90,p.y+120);T.S(.05);T.foto('persigue');mete(T);},
  /* al filo de la tolerancia */
  ganaAlFilo(T){T.S(.4);T.down(400,430);T.S(.1);const p=T.P(),d=p.r-3;T.move(p.x+d,p.y+p.tip);T.up(p.x+d,p.y+p.tip);},
  /* pela una vez (corrientazo: un fallo, y el reloj salta), espera el reposo y enchufa */
  ganaTrasPelar(T){T.S(.3);const t0=T.G.t;T.tap(720,520);if(T.P().miss!==1)throw new Error('un toque lejos contó '+T.P().miss+' fallos');
    if(Math.abs(T.G.t-t0-T.P().pen)>.01)throw new Error('el corrientazo no le quitó '+T.P().pen+' s al reloj');
    T.S(.15);T.foto('corrientazo');T.S(.25);T.down(400,430);T.S(.1);mete(T);},
  /* flechas hasta el punto de la cuadrícula más cercano a la toma, y ESPACIO */
  ganaTeclas(T){T.S(.3);const p=T.P(),nx=Math.round((p.x-p.px)/p.paso),ny=Math.round((p.y+p.tip-p.py)/p.paso);
    for(let i=0;i<Math.abs(nx);i++)T.tecla(nx<0?'ArrowLeft':'ArrowRight');for(let i=0;i<Math.abs(ny);i++)T.tecla(ny<0?'ArrowUp':'ArrowDown');T.tecla('Space');},
  /* enchufa donde no es, una y otra vez, hasta que el reloj se acaba */
  pierde(T){T.S(.3);let n=0;while(!T.listo()&&n++<40){T.tap(720,520);T.S(.36);if(n===2)T.foto('pelando');}},
  /* nivel 3: enchufa en la toma QUEMADA una y otra vez (cada una cuenta como fallo); en los otros niveles pela lejos */
  pierdeQuemada(T){T.S(.3);let n=0;while(!T.listo()&&n++<40){const p=T.P(),q=p.mala,m0=p.miss;if(q){T.down(q.x,q.y+p.tip);T.up(q.x,q.y+p.tip);if(!T.listo()&&T.P().miss!==m0+1)throw new Error('la toma quemada no dio corrientazo');}else T.tap(720,520);
    T.S(.36);if(n===2)T.foto('quemada');}},
  /* nivel 3: espera el jalón y enchufa en pleno brinco */
  ganaEnElJalon(T){T.S(.2);T.down(400,430);T.hasta(()=>T.listo()||T.P().jalon||T.G.t>T.G.dur*.7,6);T.S(.04);T.foto('jalon');mete(T);},
  /* justo fuera de la tolerancia no entra */
  pierdePorPoco(T){let n=0;while(!T.listo()&&n++<40){T.S(.34);const p=T.P(),d=p.r+4;T.down(p.x,p.y+p.tip+d);T.up(p.x,p.y+p.tip+d);}},
  nada:'lose',
  /* persigue la toma con retraso (apunta adonde estaba hace o.reac s) y con puntería torcida */
  humano(T,o){T.S(.3+T.rnd()*.2);T.down(400,430);let n=0;
    while(!T.listo()&&n++<12){T.S(.25+T.rnd()*.2);const v=T.P(),a=v.en(-o.reac*.5),k=20+o.err*90,x=a.x+(T.rnd()-.5)*k,y=a.y+v.tip+(T.rnd()-.5)*k;
      T.move(x,y);T.up(x,y);T.S(.32);if(!T.listo())T.down(x,y);}}
};
})();
