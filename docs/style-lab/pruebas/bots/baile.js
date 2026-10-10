/* Bot de ¡SÍGUELE EL PASO! (ver ../probar.js): espera cada flecha (probe().next) y toca su lado justo en el tiempo. */
(function(){
const X={'-1':200,'1':600},K={'-1':'ArrowLeft','1':'ArrowRight'};
function baila(T,fn){let i=0;while(!T.listo()){const n=T.P().next;if(!n)break;T.hasta(()=>T.listo()||T.G.t>=n.t,8);if(T.listo())break;fn(n.d,i++);T.S(.03);}}
BOTS.baile={
  gana(T){baila(T,(d,i)=>{T.tap(X[d],300);if(i===4)T.foto('medio');});},
  ganaTeclado(T){baila(T,d=>T.tecla(K[d]));},
  pierde(T){baila(T,d=>T.tap(X[-d],300));},                    /* siempre el lado contrario: tres pisotones */
  nada:'lose'                                                   /* no baila: tres flechas pasan de largo */
};
})();
