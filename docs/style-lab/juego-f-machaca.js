'use strict';
/* LA FIESTA · versus de referencia: ¡MACHACA! Carrera de arepas por la plancha: cada quien machaca SU botón para empujar su arepa
   hasta la meta. 1 botón. Sirve en ffa, 2v2 (suma del equipo) y 1v3. Sirve de plantilla del contrato (ver fiesta-vs.js). */
(function(){
if(!window.FIESTA||!FIESTA.VS||FIESTA.VS.games.machaca)return;
FIESTA.VS.add('machaca',{name:'¡MACHACA!',modos:['ffa','2v2','1v3'],dur:15,botones:1,hint:'MACHACA TU BOTÓN: ¡TU AREPA PRIMERO A LA MEDIA LUNA!',
mk(c){
  const n=c.n,L=gameLeft()+70,R=gameRight()-90,META=R,laneH=(c.campoAbajo-90)/n,STEP=(R-L)/(34+c.lv*4);
  const pos=new Array(n).fill(0),tir=new Array(n).fill(0),win=[];
  const g={scores:new Array(n).fill(0),fin:false,
    update(dt){
      for(let p=0;p<n;p++){tir[p]=Math.max(0,tir[p]-dt*6);const k=c.tap(p,'a');if(k){pos[p]=Math.min(R-L,pos[p]+k*STEP);tir[p]=1;}
        g.scores[p]=pos[p]/(R-L)*100;if(pos[p]>=R-L&&win.indexOf(p)<0)win.push(p);}
      /* gana cuando llega el primero de cada equipo hacia la meta; en equipo el score es la suma, así que se juega hasta la meta del primero */
      if(win.length){g.scores[win[0]]+=10;g.fin=true;}
    },
    ai(p,dt,api){const rate=3+c.skill[p]*5+c.lv*.5;if(c.rng.next()<rate*dt)api.press('a');},
    draw(){
      rr(gameLeft(),0,gameRight()-gameLeft(),c.campoAbajo,0,'#5a3a2a',0);
      for(let p=0;p<n;p++){const y=60+p*laneH,t=c.equipos[p];
        rr(gameLeft()+20,y,gameRight()-gameLeft()-40,laneH-10,12,p%2?'#7a4e36':'#8a5a3e',3);
        rr(META-6,y+4,14,laneH-18,4,'#fff3c4',3);
        const x=L+pos[p],yy=y+(laneH-10)/2,sq=1-tir[p]*.18;
        ell(x,yy+16,34,8,'rgba(0,0,0,.25)',0);ell(x,yy,32*(2-sq),22*sq,c.col[p],3.5);ell(x-8,yy-5,10,6,'#fff6',0);
        txt('P'+(p+1)+(c.cpu[p]?'·CPU':''),gameLeft()+62,yy-laneH*.28,16,c.col[p],0,true);
        if(c.modo!=='ffa')ell(gameLeft()+36,yy,10,10,['#ffd23f','#3fb0ff','#ff5c8a','#5cff7a'][t],3);}
      if(c.modo!=='ffa')txt(c.modo==='1v3'?'1 CONTRA 3: SUMAN LOS PUNTOS DEL TRÍO':'2 CONTRA 2: SUMAN LOS PUNTOS DEL EQUIPO',W/2,36,18,'#fff',0,true);
    }};
  return g;
}});
})();
