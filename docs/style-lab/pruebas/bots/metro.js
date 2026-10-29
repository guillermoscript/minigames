/* Bot de JEFE «EL METRO EN HORA PICO» (ver ../probar.js). */
(function(){
const COD={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown'};
const fase=(T,n)=>T.hasta(()=>T.listo()||(T.P().ph===n&&T.P().gap<=0),8);
function anden(T,cada=.3){T.S(.3);while(!T.listo()&&T.P().ph===0){T.tecla(COD[T.P().dir]);T.S(cada);}fase(T,1);}
function puerta(T,cada=.1){let n=0;while(!T.listo()&&T.P().ph===1&&n++<90){T.tap(400,300);T.S(cada);}fase(T,2);}
function viaje(T){while(!T.listo()){const q=T.P(),u=q.d+q.v*.25;T.hold(u>.03?1:0,u<-.03?1:0);T.S(1/60);}T.hold(0,0);}
BOTS.metro={
  ganaGestos(T){
    while(!T.listo()&&T.P().ph===0){
      const k=T.P().dir,dx=k==='left'?-120:k==='right'?120:0,dy=k==='up'?-120:k==='down'?120:0;
      T.drag(400,300,400+dx,300+dy,.08);T.S(.22);
    }
    fase(T,1);puerta(T);viaje(T);
  },
  gana(T){anden(T);T.foto('puerta');puerta(T);T.S(1.5);T.foto('viaje');viaje(T);},
  pierde(T){anden(T);T.S(4);},                                 /* no empuja: la puerta le muerde el bolso */
  pierdeViaje(T){anden(T);puerta(T);T.hold(1,0);T.hasta(()=>T.listo(),9);T.hold(0,0);},
  nada:'lose',                                                 /* se pasa de la raya amarilla */
  humano(T,o){T.S(.3);while(!T.listo()&&T.P().ph===0){T.tecla(T.rnd()<o.err?'Space':COD[T.P().dir]);T.S(.25+o.reac);}fase(T,1);
    puerta(T,.12+o.reac*.3);let k=0,c=0;while(!T.listo()){if(k++%Math.max(1,Math.round(o.reac*60))===0){const d=T.P().d;c=d>.12?-1:d<-.12?1:0;T.hold(c<0?1:0,c>0?1:0);}T.S(1/60);}T.hold(0,0);}
};
})();
