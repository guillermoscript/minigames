// LA FIESTA · arte del mapa: capa «relieve» (orden 30). Los Andes nevados (cordillera con crestas, valles y pinos), el Ávila dominando Caracas,
// cadenas bajas de la costa/Falcón/Oriente, tres tepuyes grandes agrupados (Auyán con el Salto Ángel y Roraima) más tepuyes pequeños.
// Vista oblicua: luz arriba-izquierda; la cara se decide por la pendiente de la silueta (sube hacia la derecha = iluminada, baja = en sombra).
// Todo determinista (A.hash / A.vn).
(function(root){'use strict';const F=root.FIESTA=root.FIESTA||{};
if(typeof module!=='undefined'&&typeof require!=='undefined'&&!F.arte)require('./fiesta-mapa-arte.js');
F.arte.capa('relieve',30,function(A){
  const P=A.PAL,W=A.W,H=A.H,buf=A.buf,tierra=A.tierra,vn=A.vn,hash=A.hash,rgb=A.rgb,mez=A.mezcla,som=A.sombrea,acl=A.aclara;
  const cl=(v,a,b)=>v<a?a:v>b?b:v;
  const OC=A.ocupado,oc0=new Uint8Array(OC);                 // oc0: ocupación previa a esta capa (casillas y caminos)
  // casillas: un claro (r 12 px) alrededor de cada una, el relieve se pinta alrededor
  const nm=new Uint8Array(W*H);
  A.nodos.forEach(n=>{const r=7,r2=r*r;for(let y=Math.max(0,Math.floor(n.y-r));y<=Math.min(H-1,Math.ceil(n.y+r));y++)for(let x=Math.max(0,Math.floor(n.x-r));x<=Math.min(W-1,Math.ceil(n.x+r));x++)
    if((x-n.x)*(x-n.x)+(y-n.y)*(y-n.y)<=r2)nm[y*W+x]=1;});
  const mid=new Uint16Array(W*H);                            // id de la montaña que pintó cada píxel (para los pinos)
  const ok=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&tierra[y*W+x]===1&&nm[y*W+x]===0;
  const put=(x,y,c)=>{x=x|0;y=y|0;if(ok(x,y))buf[y*W+x]=c;};
  const putp=(x,y,c)=>{x=x|0;y=y|0;if(ok(x,y)){buf[y*W+x]=c;OC[y*W+x]=1;}};
  const mixp=(x,y,c,a)=>{x=x|0;y=y|0;if(ok(x,y)){const i=y*W+x;buf[i]=mez(buf[i],c,a);}};
  const blob=(cx,cy,rx,ry,c,a)=>{c=rgb(c);for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){
    const u=(x-cx)/rx,v=(y-cy)/ry;if(u*u+v*v<=1)mixp(x,y,c,a);}};
  const lejosDeNodo=(x,y,r)=>{for(let i=0;i<A.nodos.length;i++){const n=A.nodos[i],dx=n.x-x,dy=n.y-y;if(dx*dx+dy*dy<r*r)return false;}return true;};
  const SOMB=rgb(P.sombra),PIN2=rgb(mez(P.pino,P.selvaOscura,.4)),PINL2=rgb(mez(P.selvaMedia,P.pino,.5)),BRU=rgb(mez(P.nube,P.nubeSombra,.4));

  /* ── estilos de montaña ── */
  function estilo(luz,med,som_,foot,o){const s={luz:rgb(luz),med:rgb(med),som:rgb(som_),foot:rgb(foot),mix:rgb(mez(med,som_,.5)),osc:rgb(som(som_,.3)),
    p:1.0,rug:6,verde:0,marron:false};for(const k in o)s[k]=o[k];s.cont=rgb(som(som_,.5));s.lm=rgb(mez(luz,med,.5));return s;}
  const NIEVE=rgb(P.nieve),NIEVES=rgb(P.nieveSombra),NIEVEM=rgb(mez(P.nieve,P.nieveSombra,.35)),NIEVEO=rgb(mez(P.nieveSombra,P.pizarraSombra,.3)),ROCA=rgb(P.roca);
  const ST={
    andes:estilo(acl(P.pizarra,.3),P.pizarra,P.pizarraSombra,P.pino,{marron:true,rug:5,p:1.0}),
    avila:estilo(mez(P.selvaLuz,P.selvaMedia,.25),P.selva,P.selvaOscura,P.selvaMedia,{rug:6,p:.95,verde:1}),
    costa:estilo(mez(P.selvaLuz,P.pastoOscuro,.35),P.selvaMedia,P.selvaOscura,P.selvaMedia,{rug:8,p:.8,verde:1}),
    oriente:estilo(mez(P.selvaLuz,P.pasto,.2),P.selva,P.selvaOscura,P.selvaMedia,{rug:7,p:.85,verde:1}),
    seco:estilo(mez(P.pastoSombra,P.arena,.45),mez(P.pastoOscuro,P.roca,.5),mez(P.rocaSombra,P.pastoOscuro,.3),P.pastoSombra,{rug:7,p:.9}),
    roca:estilo(acl(P.roca,.3),P.roca,P.rocaSombra,P.pastoSombra,{rug:5,p:.95})};

  /* ── picos de un macizo: uno dominante cerca del centro, hombros y picos menores a ambos lados ── */
  function picos(cx,hw,h,n,seed){
    const L=[[cx+(hash(seed,1,1)-.5)*hw*.4,h*(1+.12*hash(seed,6,1)),hw*(.55+.3*hash(seed,2,1))]];
    for(let i=1;i<n+1;i++){const side=hash(seed,i,7)>.45?1:-1,k=(i+1)>>1,dx=side*hw*(.2+.3*k)*(.6+.8*hash(seed,i,3));
      L.push([cx+dx,h*(.82-.12*k)*(.55+.6*hash(seed,i,4)),hw*(.34+.34*hash(seed,i,5))]);}
    return L;}

  /* ── montaña oblicua: silueta con varios picos, cara por pendiente, estrías y espolones, nieve por cota absoluta ── */
  function monte(o){
    const cx=o.cx,base=o.base,hw=o.hw,h=o.h,st=o.st,seed=o.seed,pk=o.peaks||picos(cx,hw,h,o.np||3,seed),snowH=o.snowH||0;
    const x0=Math.floor(cx-hw)-2,n=Math.ceil(hw*2)+6,ty=new Int16Array(n),L=new Int8Array(n);
    blob(cx+hw*.4,base+1,hw*.9,3,SOMB,.22);
    for(let k=0;k<n;k++){const x=x0+k;let top=0;
      for(let i=0;i<pk.length;i++){const d=Math.abs(x-pk[i][0])/pk[i][2];if(d<1){const v=pk[i][1]*Math.pow(1-d,st.p);if(v>top)top=v;}}
      top*=.62+.62*vn(x/st.rug,seed*.13,seed+3)+.22*(1-Math.abs(2*vn(x/3.1,seed*.9,seed+17)-1))*(top/h);top+=(h*.12)*(vn(x/2.3,seed*.7,seed+9)-.5);
      ty[k]=top>1.5?Math.round(base-top):base+1;}
    for(let k=0;k<n;k++){const a=ty[Math.max(0,k-3)],b=ty[Math.min(n-1,k+3)];L[k]=b<a?1:(b>a?0:(x0+k<cx?1:0));}
    for(let k=1;k<n-1;k++){const x=x0+k;if(ty[k]>base)continue;const lit=L[k]===1;
      for(let y=ty[k];y<=base;y++){
        if(!ok(x,y))continue;
        const depth=y-ty[k],height=base-y,rel=height/h,sv=hash((lit?x+((y*.7)|0):x-((y*.7)|0))>>1,seed,5);let c;
        const spur=Math.abs(vn((x+y*.45)/8,seed,seed+21)-.5)<.035;
        if(snowH&&height>snowH+(vn(x/3.3,seed,seed+11)-.5)*9&&!(sv<.1&&depth>2)){
          c=lit?(sv>.55?NIEVE:NIEVEM):(sv>.7?NIEVES:NIEVEO);if(spur&&depth>2)c=lit?NIEVEM:NIEVEO;
        }else{
          c=lit?(sv>.66?st.luz:(sv<.18?st.lm:st.med)):(sv>.72?st.mix:(sv<.14?st.osc:st.som));
          if(spur)c=lit?st.mix:st.osc;
          if(st.marron&&rel<.5)c=mez(c,ROCA,.4*(1-rel/.5));
          if(st.marron){const fw=cl((330-x)/330,0,1)*.5+cl(.45-rel,0,.45)*.9;c=mez(c,lit?PINL2:PIN2,cl(fw*(.6+.8*hash(x>>1,y>>1,seed+31)),0,.85));if(x<330){c=mez(c,BRU,.22*cl((330-x)/330,0,1));}}
        }
        if(st.verde&&!(snowH&&height>snowH)){const cm=hash(x>>1,(y>>1)+((x>>3)&1),seed+51);
          if(cm>.78&&!spur)c=lit?st.luz:st.med;else if(cm<.22)c=lit?st.med:st.osc;
          if(depth<2&&lit)c=mez(c,rgb(P.selvaLuz),.55);
          if(o.avila&&spur)c=lit?st.mix:rgb(som(P.selvaOscura,.35));}
        if(rel<.14&&(((x+y)&1)===0||rel<.05))c=mez(c,st.foot,.6);
        if(!st.marron&&height<7+3*vn(x/5,seed,seed+61)&&hash(x,y,seed+62)<(7-height)/7*.75+.1*(depth<2?1:0))continue;
        if(y===ty[k]||y<ty[k-1]||y<ty[k+1]){c=mez(c,st.cont,y===ty[k]?.55:.4);}
        const i=y*W+x;buf[i]=c;mid[i]=o.id;if(rel>.1)OC[i]=1;}}
    if(o.pines)PINS.push({id:o.id,x0:x0,n:n,ty:ty,base:base,h:h,v:st.verde});
  }
  const PINS=[];

  /* ── lista de obras (de atrás hacia delante por su línea de base) ── */
  const obras=[];let sid=7;
  const add=(y,f)=>obras.push({y:y,f:f,i:obras.length});
  const DX=A.dx,DY=A.dy;

  /* cadena de macizos a lo largo de una poligonal en px; filas con desplazamiento perpendicular; tamaño por callback */
  function cadena(pts,filas,paso,seed,tam,filtro){
    const seg=[];let tot=0;for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(l);tot+=l;}
    filas.forEach((off,r)=>{let s=hash(r,seed,1)*paso*.8,j=0;
      while(s<tot){
        let a=s,i=0;while(i<seg.length-1&&a>seg[i]){a-=seg[i];i++;}
        const t=a/seg[i],ax=pts[i][0],ay=pts[i][1],bx=pts[i+1][0],by=pts[i+1][1],dx=(bx-ax)/seg[i],dy=(by-ay)/seg[i];
        const nx=-dy,ny=dx,sg=nx+ny>0?1:-1,jo=(hash(j,r,seed+2)-.5)*(seed===11?34:16)+(seed===11?(vn(s/40,r,seed)-.5)*30:0);
        const x=Math.round(ax+(bx-ax)*t+sg*nx*(off+jo)),y=Math.round(ay+(by-ay)*t+sg*ny*(off+jo));
        const f=s/tot,tm=tam(f,off,x,y,j,r);
        if(tm&&x>2&&y>4&&x<W-2&&y<H-2&&tierra[y*W+x]===1&&(!filtro||filtro(x,y))&&lejosDeNodo(x,y,tm.hw>40?11:9)){
          const id=sid++;add(y,()=>monte(Object.assign({cx:x,base:y,id:id,seed:id},tm)));}
        s+=paso*(.7+.6*hash(j,r,seed+3));j++;}});
  }

  // 2) EL ÁVILA: una gran cresta detrás de Caracas (pico dominante sobre el teleférico) con hombros a ambos lados y una fila trasera
  (function(){
    const id=sid++,base=296,pk=[[1012,112,50],[1096,116,46],[1052,84,30],[1150,92,40],[1196,66,34],[950,70,46],[1250,46,46],[1086,70,100],[1230,64,26],[990,92,22]];
    add(base,()=>monte({cx:1100,base:base,hw:190,h:112,peaks:pk,avila:true,st:Object.assign({},ST.avila,{p:1.12,rug:5}),id:id,seed:id,pines:true}));
    const id2=sid++,b2=268,pk2=[[1000,30,40],[1066,44,26],[1160,36,50],[1232,24,34],[940,20,38]];
    add(b2,()=>monte({cx:1090,base:b2,hw:170,h:40,peaks:pk2,st:Object.assign({},ST.avila,{p:.9,rug:6}),id:id2,seed:id2,pines:true}));
  })();

  // 3) cadenas bajas: Cordillera de la Costa (Valencia–Caracas), Serranía de Falcón, Turimiquire y Paria
  const noMar=function(x,y){const b=A.bioma[y*W+x];return b!==A.BIO.mar&&A.d(x,y)>5&&b!==A.BIO.manglar;};
  cadena([[668,322],[740,300],[820,282],[890,268],[935,262]],[-8,18],54,21,function(f,off,x,y,j){
    const g=vn(x/50,y/50,33),h=(10+26*Math.sin(f*3.1+1)*(.5+g))*(.75+.5*hash(x,y,221));if(h<9)return null;return {h:h*(.6+.9*vn(x/30,y/30,36)),hw:30+h*1.1+hash(x,y,37)*30,np:3,st:Object.assign({},ST.costa,{p:.7,rug:11}),snowH:0,pines:true};},noMar);
  cadena([[540,205],[620,228],[690,254]],[0,16],34,22,function(f,off,x,y){
    const h=(11+9*hash(x,y,231));return {h:h,hw:28+h,np:2,st:ST.seco};},noMar);
  cadena([[1550,368],[1650,340],[1760,316],[1860,296]],[-16,10],36,23,function(f,off,x,y){
    const h=(20+16*Math.sin(f*3+.3))*(.8+.4*hash(x,y,241));return {h:h*(.6+.9*vn(x/28,y/28,38)),hw:26+h*1.1+hash(x,y,39)*26,np:3,st:ST.oriente,pines:true};},noMar);
  cadena([[1790,300],[1850,282],[1925,296]],[-8,10],34,24,function(f,off,x,y){
    const h=26+16*Math.sin(f*3.1)*(.8+.4*hash(x,y,251));return {h:h,hw:34+h,np:3,st:ST.oriente,pines:true};},noMar);
  // roquedos del desierto de Paraguaná
  [[228,72],[255,66],[270,86],[248,100]].forEach(p=>{const x=Math.round(DX(p[0])),y=Math.round(DY(p[1])),id=sid++;
    if(ok(x,y))add(y,()=>monte({cx:x,base:y,hw:14+hash(x,y,3)*8,h:15+hash(x,y,4)*8,np:2,st:ST.roca,id:id,seed:id}));});
  // cerros rocosos sueltos del Llano alto
  [[410,432,20,16],[500,420,18,14],[355,388,18,15],[505,334,22,17]].forEach(p=>{const x=Math.round(DX(p[0])),y=Math.round(DY(p[1])),id=sid++;
    if(ok(x,y)&&lejosDeNodo(x,y,20))add(y,()=>monte({cx:x,base:y,hw:p[2]+8,h:p[3],np:2,st:ST.roca,id:id,seed:id}));});

  /* ── tepuy: lóbulos irregulares, paredes con estrías, repisas con vegetación, talud, cascadas con bruma ── */
  const CAPS=[P.selvaOscura,P.selvaMedia,P.selva,P.selvaLuz].map(rgb),CAPSECO=[P.selvaMedia,P.pastoOscuro,P.selva,P.pastoSombra].map(rgb);
  const WAL=[P.acantiladoLuz,P.acantilado,P.acantiladoSombra,som(P.acantiladoSombra,.35)].map(rgb);
  const CONT=rgb(P.contorno),RIO=rgb(P.rio),RIOC=rgb(P.rioClaro),ROCAL=rgb(acl(P.acantilado,.2));
  let CD=0,CX=0,CY=0,CH=0;
  function copa(x,y,sd){const S=6,cx=Math.floor(x/S),cy=Math.floor(y/S);let bd=1e9;
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const gx=cx+i,gy=cy+j,px=(gx+.15+.7*hash(gx,gy,sd))*S,py=(gy+.15+.7*hash(gx,gy,sd+1))*S,dx=x-px,dy=y-py,d=dx*dx+dy*dy*1.35;
      if(d<bd){bd=d;CX=dx;CY=dy;CH=hash(gx,gy,sd+2);}}CD=bd;}
  function arbol(cx,cy,r,sd,caps){
    for(let yy=-r;yy<=r;yy++)for(let xx=-r;xx<=r;xx++){const d2=xx*xx+yy*yy*1.15;if(d2>r*r+.5)continue;
      const s=-(xx+yy*.8)/(r*1.5)+(hash(cx+xx,cy+yy,sd)-.5)*.35;
      let c=s>.38?caps[3]:(s>.02?caps[2]:(s>-.38?caps[1]:caps[0]));
      if(d2>(r-1)*(r-1)&&(xx+yy>0||yy>r-2))c=mez(caps[0],CONT,.5);
      if(yy>=r-1&&xx>=-1)c=mez(caps[0],CONT,.6);
      putp(cx+xx,cy+yy,c);}}
  function tepuy(o){
    const cx=o.cx,base=o.base,hw=o.hw,wall=o.wall,dep=o.dep,seed=o.seed,caps=o.seco?CAPSECO:CAPS;
    const lobes=[{cx:cx,hw:hw,dep:dep,wall:wall,dy:0}];
    if(o.mesa){lobes.push({cx:cx+hw*.1,hw:hw*.7,dep:dep*.8,wall:wall*1.08,dy:-2});}
    else if(hw>40){const q=hash(seed,3,3)-.5;lobes.push({cx:cx-hw*(.45+q*.4),hw:hw*(.35+.3*hash(seed,4,3)),dep:dep*.7,wall:wall*(.6+.4*hash(seed,5,3)),dy:4});lobes.push({cx:cx+hw*(.6-q*.3),hw:hw*(.28+.25*hash(seed,6,3)),dep:dep*.6,wall:wall*(.55+.35*hash(seed,7,3)),dy:7});if(hw>70)lobes.push({cx:cx+hw*(.1+q),hw:hw*.3,dep:dep*.5,wall:wall*1.12,dy:-3});}
    else if(hw>28)lobes.push({cx:cx+hw*.45*(hash(seed,1,2)>.5?1:-1),hw:hw*.5,dep:dep*.65,wall:wall*.8,dy:3});
    const xa=Math.floor(cx-hw*1.5)-2,n=Math.ceil(hw*3)+6,ct=new Int16Array(n).fill(32000),cf=new Int16Array(n).fill(-32000),wb=new Int16Array(n).fill(-32000);
    blob(cx+hw*.55,base+3,hw*1.05,dep*.55+4,SOMB,.32);
    lobes.forEach(function(lb,li){const cy=base+lb.dy-lb.wall-lb.dep;
      for(let k=0;k<n;k++){const x=xa+k,u=(x-lb.cx)/(lb.hw*(.8+.4*vn(x/8,seed+li*5,seed+1)));if(u<=-1||u>=1)continue;
        const e=Math.pow(1-u*u,.4),t=Math.round(cy-lb.dep*e)-((vn(x/2.5,seed+li,seed+33)*4.5)|0),
          f=Math.round(cy+lb.dep*e)+((vn(x/5,seed+li,seed+35)-.5)*7|0),
          bu=hash(x>>3,seed+li,5)>.62?lb.wall*.14:(hash(x>>3,seed+li,6)>.8?-lb.wall*.1:0),
          b=f+Math.round(lb.wall*(.8+.4*vn(x/6,seed+2+li,seed+4))+bu);
        if(t<ct[k])ct[k]=t;if(f>cf[k])cf[k]=f;if(b>wb[k])wb[k]=b;}});
    let kmin=-1,kmax=-1;for(let k=0;k<n;k++)if(ct[k]<32000){if(kmin<0)kmin=k;kmax=k;}
    if(kmin<0)return;
    const span=kmax-kmin||1;
    for(let k=kmin;k<=kmax;k++){if(ct[k]>=32000)continue;const x=xa+k,t=(k-kmin)/span,borde=(k===kmin||k===kmax);
      // talud: piedras sueltas en pendiente
      const tl=8+((hash(x,seed,12)*6)|0);
      for(let j=1;j<=tl;j++){const y=wb[k]+j,r=hash(x,y,seed);
        put(x,y,r<.16?ROCAL:(r<.5-j*.02?WAL[2]:(r<.62+j*.05?CAPS[0]:CAPS[1])));}
      const hg=wb[k]-cf[k]+1,wv=vn(x/14,seed,41),crk=hash(x,seed,3)>.9;
      for(let y=cf[k];y<=wb[k];y++){
        const wy=y-cf[k],sy=wy+((vn(x/26,seed,43)-.5)*8|0),band=Math.floor(sy/7),by=((sy%7)+7)%7,bh=hash(band,seed,1),r=wy/hg;
        let lv=t<.4?0:(t<.68?1:2);
        if(bh>.72)lv--;else if(bh<.25)lv++;
        if(by===0)lv=3;else if(by===1&&t<.7)lv--;
        if(t>.9)lv++;
        if(r>.88)lv++;
        if(wv<.28)lv--;
        if(crk&&hash(x,(wy/16)|0,seed+4)>.3)lv+=2;
        if(wy<2)lv=3;
        if(hash(x,y,seed+8)>.975)lv++;
        lv=cl(lv,0,3);let c=WAL[lv];
        if(wy>3&&by<=1&&hash(band,seed,2)>.5&&vn(x/9,band,seed+6)>.42)c=caps[by?1:(t>.6?0:2)];
        else if(wy>3&&by>=2&&by<=3&&hash(band,seed,2)>.5&&vn(x/9,band,seed+6)>.42&&hash(x,band,seed+9)>.55)c=caps[0];
        if(y===wb[k]||borde)c=mez(c,CONT,.55);
        putp(x,y,c);}
      // tapa con claros de roca
      for(let y=ct[k];y<cf[k];y++){
        copa(x,y,seed+60);const rr=Math.sqrt(CD),r=hash(x,y,seed+2),sh=(CX+CY)/(rr+.8);
        const tn=CH*.45-sh*.5+.1+(.5-t)*.2+(r<.08?.15:0);
        let c=tn>.62?caps[3]:(tn>.38?caps[2]:(tn>.12?caps[1]:caps[0]));
        if(rr>2.9)c=mez(caps[0],CONT,.45);
        if(vn(x/6,y/4,seed+15)>.82&&r<.5)c=mez(WAL[1],caps[2],.3);
        if(y===ct[k]||borde)c=mez(caps[0],CONT,.5);
        putp(x,y,c);}
    }
    // copas redondeadas que desbordan el borde de la cima y arboles al pie
    for(let k=kmin;k<=kmax;k+=1){if(ct[k]>=32000)continue;const x=xa+k;
      if(hash(x,seed,70)>.78)arbol(x,cf[k]-1,2+((hash(x,seed,71)*3)|0),seed+72,caps);
      if(hash(x,seed,73)>.9)arbol(x,ct[k]+1,2+((hash(x,seed,74)*2)|0),seed+75,caps);
      if(hash(x,seed,76)>.84)arbol(x,wb[k]+2,3+((hash(x,seed,77)*3)|0),seed+78,caps);}
    // cascadas: finas y largas, tramos de espuma, estanque blanco-azul
    (o.falls||[]).forEach(function(fl,fi){const fx=Math.round(cx+hw*fl.u),k=fx-xa;if(k<kmin||k>kmax||ct[k]>=32000)return;
      const yT=cf[k]-1,yB=wb[k]+4,ww=fl.w,len=yB-yT;
      const dir=fl.u>0?-1:1;for(let i=0;i<9+ww*3;i++)put(fx+dir*i,yT-3-(i*.35|0),i<3?RIOC:(i&1?RIOC:RIO));
      for(let y=yT;y<=yB;y++){const q=(y-yT)/len,foam=hash(y>>3,fx,seed+fi)>.55,wig=((y>>4)&1)&&ww>1?1:0,wd=ww+(foam&&ww>1?1:0)+(q>.9?1:0);
        for(let d=-wd;d<=wd;d++){const xx=fx+d+wig,e=Math.abs(d)===wd;
          let c=e?(d>0?RIO:RIOC):(d>0&&ww>1?(hash(xx,y,3)<.5?RIOC:NIEVE):NIEVE);
          if(!e&&!foam&&hash(xx,y>>1,seed)<.2)c=RIOC;
          if(q>.93)c=mez(c,NIEVE,.5);
          put(xx,y,c);}}
      for(let i=0;i<3+ww*2;i++){const bx=fx+(hash(i,fx,seed)-.5)*(8+ww*5),by2=yB+hash(i,fx,seed+1)*3-1;blob(bx,by2,2.5+hash(i,fx,seed+2)*2,1.6,P.rioClaro,.8);blob(bx,by2-.5,1.8,1.1,P.nieve,.95);}
    });
  }


  // 4) TEPUYES: tres grandes agrupados (Auyán con el Salto Ángel, Churí y Roraima) y otros pequeños; coordenadas px
  const TEP=[
    {cx:1560,by:985,hw:136,wall:140,dep:28,mesa:1,falls:[{u:-.8,w:2,bruma:22},{u:.25,w:1,bruma:6},{u:.55,w:1,bruma:6}]},       // Auyán-tepui + Salto Ángel (foco)
    {cx:1716,by:1052,hw:52,wall:96,dep:16,mesa:1,falls:[{u:.4,w:1,bruma:5}]},                                                   // Churí
    {cx:1846,by:1070,hw:80,wall:96,dep:19,falls:[{u:-.55,w:2,bruma:8},{u:.5,w:1,bruma:5}]},                              // Roraima
    {cx:1372,by:1030,hw:36,wall:78,dep:11,mesa:1,falls:[{u:-.3,w:1,bruma:4}]},
    {cx:1244,by:1092,hw:34,wall:38,dep:9,falls:[]},
    {cx:1452,by:1148,hw:38,wall:34,dep:10,falls:[{u:.3,w:1,bruma:3}]},
    {cx:1652,by:1136,hw:26,wall:28,dep:8,falls:[]},
    {cx:1130,by:1196,hw:24,wall:22,dep:7,falls:[]}];
  TEP.forEach((t,i)=>{
    if(!ok(t.cx,t.by-t.wall)&&!ok(t.cx,t.by)){A.errores.push('relieve: tepuy '+i+' fuera de tierra');return;}
    add(t.by,()=>tepuy({cx:t.cx,base:t.by,hw:t.hw,wall:t.wall,dep:t.dep,mesa:t.mesa,seed:300+i*17,falls:t.falls}));});

  // 0) LOS ANDES: campo de alturas con macizos de roca gris-marrón facetada, nieve en parches sobre cumbres y repisas, pinos en faldas y hondonadas
  const ELE=new Uint8Array(W*H),ZN=new Uint8Array(W*H);            // ZN: 1 bosque · 2 nieve · 3 roca
  const HF=new Float32Array(W*H);
  const ROK=['#d6ccba','#b4a794','#8e7f72','#665853'].map(rgb),ROKB=rgb('#8c6a4c'),ROKBS=rgb('#85694f');
  (function(){
    const X0=0,X1=800,Y0=300,Y1=1060;
    const ax=590,ay=400,bx=40,by=840,dl=Math.hypot(bx-ax,by-ay),ux=(bx-ax)/dl,uy=(by-ay)/dl;
    const hf=(x,y)=>{
      const wx=x+60*(vn(x/120,y/120,601)-.5)+14*(vn(x/31,y/31,602)-.5),wy=y+60*(vn(x/120+7,y/120,603)-.5)+14*(vn(x/29,y/29+5,604)-.5);
      const d=Math.abs((x-ax)*uy-(y-ay)*ux),tt=((x-ax)*ux+(y-ay)*uy)/dl,env=.28+.72*Math.exp(-Math.pow(d/(215+60*Math.sin(tt*5)),2));
      let r1=1-Math.abs(2*vn(wx/42,wy/30,501)-1);r1=Math.pow(r1,1.7);
      const r2=1-Math.abs(2*vn(wx/17,wy/13,503)-1),r3=vn(wx/7,wy/6,505);
      return env*(.56*r1+.32*r2*(.35+.9*r1)+.14*r3)*(1.15-.2*tt);};
    const EDG=new Uint8Array(W*H),ANB=A.BIO.andes,an=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&A.bioma[y*W+x]===ANB;
    for(let y=Y0;y<Y1;y++)for(let x=X0;x<X1;x++){const k=y*W+x;if(tierra[k]!==1)continue;
      const ox=((vn(x/9,y/9,821)-.5)*30)|0,oy=((vn(x/9,y/9+40,822)-.5)*22)|0;
      if(!an(x+ox,y+oy))continue;if(A.bioma[k]!==ANB&&oc0[k])continue;
      HF[k]=hf(x,y)+.001;if(!(an(x+ox-18,y+oy)&&an(x+ox+18,y+oy)&&an(x+ox,y+oy-14)&&an(x+ox,y+oy+14)))EDG[k]=1;}
    const T=new Uint8Array(W*H);
    const hv=(x,y)=>{const v=HF[y*W+x];return v;};
    const nd=A.nodos.map(n=>[n.x,n.y]);
    const dn=(x,y)=>{let m=1e9;for(let i=0;i<nd.length;i++){const dx=nd[i][0]-x,dy=nd[i][1]-y,q=dx*dx+dy*dy;if(q<m)m=q;}return Math.sqrt(m);};
    for(let y=Y0;y<Y1;y++)for(let x=X0;x<X1;x++){const k=y*W+x;
      if(!HF[k]||nm[k])continue;
      const e=HF[k],gx=(hv(x+2,y)||e)-(hv(x-2,y)||e),gy=(hv(x,y+2)||e)-(hv(x,y-2)||e),steep=(Math.abs(gx)+Math.abs(gy))*5;
      const lit=(gx*.8+gy*1.0)*14+.12,dz=hash(x>>1,y>>1,77),nz=vn(x/7,y/6,707)-.5,nz2=vn(x/16,y/12,709)-.5;
      const near=dn(x,y),clear=near<20;
      ELE[k]=Math.min(255,e*330|0);
      let c;const lv=cl(lit+(dz-.5)*.35,-1,1);
      const F=e+.2*nz2+steep*.25-(EDG[k]?.14:0);
      if(F<.4+ (clear?.1:0)){            // bosque
        const FOR=[P.pino,P.selvaOscura,P.selvaMedia,P.selva];
        const q=lv>.3?3:(lv>-.15?2:(lv>-.5?1:0));c=rgb(FOR[Math.max(0,Math.min(3,q+(dz>.82?1:(dz<.18?-1:0))))]);
        ZN[k]=1;T[k]=q>2?2:1;
      }else{
        const sn=!clear&&(e+.2*nz*2-steep*.35+(lv>0?.05:-.03)>.47);
        const q=lv>.2?3:(lv>-.2?2:(lv>-.55?1:0));          // 3 luz · 2 media · 1 sombra · 0 oscura
        if(sn){c=q>=3?NIEVE:(q===2?NIEVEM:(q===1?NIEVES:NIEVEO));ZN[k]=2;T[k]=q;}
        else{const lowb=cl((.46-e)/.2,0,1)*(.5+nz);c=ROK[3-q];if(lowb>.15)c=mez(c,q>1?ROKB:ROKBS,lowb*.5);ZN[k]=3;T[k]=q;
          if(dz>.9&&q>0)c=ROK[Math.max(0,3-q-1)];else if(dz<.1&&q<3)c=ROK[Math.min(3,3-q+1)];
          if(Math.abs(vn((x+y*.7)/4.5,(y-x*.35)/8,731)-.5)<.045&&q>0)c=ROK[Math.min(3,3-q+1)];}
        // transición bosque-roca irregular
        if(F<.46&&hash(x,y,79)<(.46-F)/.08*.7){c=rgb(P.selvaOscura);ZN[k]=1;}
      }
      buf[k]=c;}
    // aristas: la cara en sombra junto a la luz lleva contorno oscuro; cresta clara
    for(let y=Y0+1;y<Y1-1;y++)for(let x=X0+1;x<X1-1;x++){const k=y*W+x;if(!HF[k]||nm[k]||ZN[k]===1)continue;
      const t=T[k],tl=T[k-1],tu=T[k-W];
      if(ZN[k]===3){if(t<=1&&(tl>=3||tu>=3)&&ZN[k-1]!==2)buf[k]=ROK[3];else if(t===3&&T[k+1]<=1&&ZN[k+1]===3)buf[k]=ROK[0];}
      else if(ZN[k]===2){if(ZN[k+W]===3||ZN[k+W]===1)buf[k]=mez(NIEVEO,SOMB,.2);else if(t===1&&tu>=2)buf[k]=NIEVEO;}}
    // neblina suave al borde oeste
    for(let y=Y0;y<Y1;y++)for(let x=X0;x<300;x++){const k=y*W+x;if(!HF[k]||nm[k])continue;const f=1-x/300;buf[k]=mez(buf[k],mez(rgb(P.nube),rgb(P.nubeSombra),.4),.12*f*f);}
    // arroyos azules que bajan de las cumbres hacia los llanos
    const cand=[];for(let q=0;q<4;q++){let best=null,be=0;for(let i=0;i<160;i++){const x=(40+hash(i,q,811)*600)|0,y=(380+hash(i,q,812)*450)|0,e=HF[y*W+x];if(e>be&&e<.62&&e>.34&&dn(x,y)>40&&x>150&&x%1===0){const ok2=(q===0&&x>380)||(q===1&&x<380&&x>250)||(q===2&&x<250)||(q===3);if(ok2){be=e;best=[x,y];}}}if(best)cand.push(best);}
    cand.forEach(function(s0,qi){let x=s0[0],y=s0[1],dx=.7,dy=.7;
      for(let st=0;st<1100;st++){
        const xi=x|0,yi=y|0;if(xi<3||yi<3||xi>=W-3||yi>=H-3||A.bioma[yi*W+xi]!==A.BIO.andes||tierra[yi*W+xi]!==1)break;
        const g0=HF[yi*W+xi];let gx=((HF[yi*W+xi+3]||g0)-(HF[yi*W+xi-3]||g0)),gy=((HF[(yi+3)*W+xi]||g0)-(HF[(yi-3)*W+xi]||g0));
        let ex=-gx*60+.35+(vn(st/12,qi,813)-.5)*.9,ey=-gy*60+.12+(vn(st/12,qi,814)-.5)*.9;const l=Math.hypot(ex,ey)||1;ex/=l;ey/=l;
        dx=dx*.72+ex*.4;dy=dy*.72+ey*.4;const l2=Math.hypot(dx,dy)||1;dx/=l2;dy/=l2;x+=dx*1.2;y+=dy*1.2;
        const steepF=Math.hypot(gx,gy)>.035,px=x|0,py=y|0;
        for(let d=-1;d<=1;d++){const ox=px+(Math.abs(dy)>.6?d:0),oy=py+(Math.abs(dy)>.6?0:d);
          if(ok(ox,oy)&&oc0[oy*W+ox]===0)buf[oy*W+ox]=d===0?(steepF&&(st&1)?NIEVE:RIO):(hash(ox,oy,5)<.5?RIOC:RIO);}
        if(ok(px,py)&&steepF&&st%9===0)mixp(px,py,NIEVE,.7);}});
  })();

  obras.sort((a,b)=>a.y-b.y||a.i-b.i);
  obras.forEach(o=>o.f());

  // cascada andina (La Cascada de La Azulita): hilo blanco y azul por una ladera con bruma al pie
  (function(){const c=[[260,600],[330,560],[250,660],[400,520],[190,700]];let n=0;
    for(let q=0;q<c.length&&n<2;q++){const fx=c[q][0],fy=c[q][1];let y0=-1;
      for(let y=fy;y<fy+60;y++)if(ok(fx,y)&&mid[y*W+fx]){y0=y;break;}
      if(y0<0||ELE[y0*W+fx]>0&&false)continue;
      const len=20;let good=true;for(let i=0;i<len;i++)if(!ok(fx,y0+i)||!mid[(y0+i)*W+fx]){good=i>12;break;}
      if(!good)continue;
      for(let i=0;i<len;i++){const w=i>14?2:1;for(let d=-w;d<=w;d++)put(fx+d+((i>>3)&1),y0+i,Math.abs(d)===w&&w>1?RIOC:(hash(fx+d,y0+i>>1,5)<.25?RIOC:NIEVE));}
      blob(fx+1,y0+len,7,3,P.nube,.5);blob(fx+1,y0+len-1,4,2,P.rioClaro,.6);n++;}
  })();
  // 5) pinos: sobre las laderas bajas de cada montaña (solo si el píxel sigue siendo de ella) y en las faldas de los Andes
  const PIN=rgb(P.pino),PINL=rgb(mez(P.pino,P.selvaLuz,.4)),PIND=rgb(som(P.pino,.35)),PINO=rgb(som(P.pino,.6));
  function pino(x,y,hh,id){
    const mx=hh>=8?3:2;
    for(let j=0;j<hh;j++){const m=Math.min(mx,1+((j*(mx+.5)/hh*1.15)|0)),mm=j<1?0:(j%3===0?m-1:m);for(let d=-mm;d<=mm;d++){const px=x+d,py=y-hh+1+j;if(!ok(px,py))continue;
      const i=py*W+px;if(id&&mid[i]!==id)continue;buf[i]=(d===mm&&mm>0)?PIND:(d<0||(d===0&&j%3===1)?PINL:PIN);if(j===hh-1||(d===-mm&&mm>1&&j%3===0))buf[i]=PIND;}}
    for(let t=1;t<=2;t++)if(ok(x,y+t)&&(!id||mid[(y+t)*W+x]===id))buf[(y+t)*W+x]=PINO;}
  PINS.forEach(function(m){
    for(let k=2;k<m.n-2;k++){const x=m.x0+k;if(m.ty[k]>m.base)continue;
      for(let y=m.ty[k]+((m.base-m.ty[k])*.32|0);y<=m.base;y+=2+(hash(x,y,47)*2|0)){
        const rel=(m.base-y)/m.h;if(rel>.5||hash(x,y,46)>(m.v?.1:.07)*(1.2-rel))continue;
        if(mid[y*W+x]!==m.id||nm[y*W+x])continue;
        pino(x,y,m.v?4+(hash(x,y,48)*2|0):5+(hash(x,y,49)*2|0),m.id);}}});
  for(let gy=330;gy<=1050;gy+=4)for(let gx=4;gx<=780;gx+=5){
    const x=Math.round(gx+(hash(gx,gy,41)-.5)*5),y=Math.round(gy+(hash(gx,gy,42)-.5)*4);
    if(x<2||y<8||x>=W-2||y>=H||tierra[y*W+x]!==1||A.bioma[y*W+x]!==A.BIO.andes||oc0[y*W+x]||mid[y*W+x]||nm[y*W+x])continue;
    const zn=ZN[y*W+x];if(zn===2||!zn)continue;
    let near=false;for(let i=0;i<A.nodos.length;i++){const dx=A.nodos[i].x-x,dy=A.nodos[i].y-y;if(dx*dx+dy*dy<400){near=true;break;}}if(near)continue;
    const e=ELE[y*W+x];
    if(zn===1){if(hash(x,y,43)>.75||vn(x/9,y/7,78)<.22)continue;}else{if(e>160||hash(x,y,43)>.16||vn(x/14,y/10,78)<.4)continue;}
    pino(x,y,9+(hash(x,y,45)*5|0),0);}
  // protege todo el bioma andino de la vegetación redonda posterior
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(A.bioma[i]===A.BIO.andes&&tierra[i]===1)OC[i]=1;}
});
})(typeof window!=='undefined'?window:globalThis);
