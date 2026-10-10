/* Bot de JEFE «EL DESAYUNO CRIOLLO SUPREMO» (ver ../probar.js). Todo con el puntero, como en un teléfono. */
(function(){
const fase=(T,n)=>T.hasta(()=>T.listo()||(T.P().ph===n&&T.P().gap<=0),8);
function amasa(T,vel=.16){T.S(.3);let a=0;T.down(500,352);while(!T.listo()&&T.P().ph===0&&a<200){a+=vel;T.move(410+Math.cos(a)*90,352+Math.sin(a)*70);T.S(1/60);}T.up(410,352);fase(T,1);}
function palmea(T,cada=.12){let n=0;while(!T.listo()&&T.P().ph===1&&n<90){T.tap(n%2?200:600,300);T.S(cada);n++;}fase(T,2);}
function voltea(T,extra=.25){for(let s=0;s<2&&!T.listo();s++){T.hasta(()=>T.listo()||(T.P().lado===s&&!T.P().flip&&T.P().c>=T.P().t0+extra),12);T.drag(400,420,400,350,.08);T.S(.6);}fase(T,3);}
function rellena(T,orden){for(const k of orden){if(T.listo())break;const b=T.P().BOL.find(b=>b[0]===k);T.drag(b[1],b[2],T.P().AX,T.P().AY-20,.18);T.S(.1);}}
BOTS.arepa={
  gana(T){amasa(T);palmea(T);T.S(1);T.foto('budare');voltea(T);T.S(.9);rellena(T,['pollo','agua','mayo','pollo']);T.foto('relleno');rellena(T,['mayo']);},
  pierde(T){amasa(T);palmea(T);T.hasta(()=>T.listo(),12);},                    /* nunca la voltea: se quema */
  pierdeGrietas(T){amasa(T);T.S(.3);for(let i=0;i<5&&!T.listo();i++){T.tap(200,300);T.S(.2);}},
  pierdeRelleno(T){amasa(T);palmea(T);voltea(T);rellena(T,['pollo','pollo','pollo','pollo','pollo']);},
  nada:'lose'
};
})();
