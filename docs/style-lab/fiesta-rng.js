// RNG determinista (mulberry32) para LA FIESTA. Misma semilla => misma secuencia. Sin dependencias.
(function(root){
var F=root.FIESTA=root.FIESTA||{};
function crear(semilla){
  var s=(semilla>>>0)||1;
  var r={
    next:function(){s=(s+0x6D2B79F5)>>>0;var t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;},
    int:function(a,b){return a+Math.floor(r.next()*(b-a+1));},
    pick:function(arr){return arr[Math.floor(r.next()*arr.length)];},
    shuffle:function(arr){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(r.next()*(i+1));var x=a[i];a[i]=a[j];a[j]=x;}return a;},
    get estado(){return s;},
    set estado(v){s=v>>>0;}
  };
  return r;
}
// Ejecuta fn con Math.random reemplazado por el RNG sembrado (para microjuegos viejos que usan Math.random) y lo restaura siempre.
function withSeed(semilla,fn){
  var orig=Math.random,r=crear(semilla);
  Math.random=r.next;
  try{return fn(r);}finally{Math.random=orig;}
}
// Retoma un RNG desde un estado guardado (el reductor lo guarda en keys._f.rng, nunca en el board).
function desde(estado){var r=crear(1);r.estado=estado;return r;}
// Elige con pesos: lista de [valor, peso>0]. Una sola extracción.
function pesos(r,lista){var t=0,i;for(i=0;i<lista.length;i++)t+=lista[i][1];var x=r.next()*t;for(i=0;i<lista.length;i++){x-=lista[i][1];if(x<0)return lista[i][0];}return lista[lista.length-1][0];}
F.rng={crear:crear,withSeed:withSeed,desde:desde,pesos:pesos};
if(typeof module!=='undefined')module.exports=F.rng;
})(typeof window!=='undefined'?window:globalThis);
