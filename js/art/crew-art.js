'use strict';
/* Shared crew drawing kit, following docs/ART-STYLE.md. Decorative variation is deterministic;
   nothing here consumes the room RNG or changes a game verdict. Static scenery is baked once. */
const CrewArt = (() => {
  const TAU = Math.PI * 2, backgrounds = new Map();
  let X = ctx;
  function rr(x,y,w,h,r=12) { X.beginPath();X.moveTo(x+r,y);X.arcTo(x+w,y,x+w,y+h,r);X.arcTo(x+w,y+h,x,y+h,r);X.arcTo(x,y+h,x,y,r);X.arcTo(x,y,x+w,y,r);X.closePath(); }
  function el(x,y,rx,ry,rot=0) { X.beginPath();X.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),rot,0,TAU); }
  function ink(fill,o=4,col=INK) { X.lineJoin='round';X.lineCap='round';if(o){X.lineWidth=o*2;X.strokeStyle=col;X.stroke();}if(fill){X.fillStyle=fill;X.fill();} }
  function panel(x,y,w,h,col,shade,light,r=12,o=4) {
    rr(x,y,w,h,r);ink(shade,o);X.save();X.clip();X.translate(-4,-5);rr(x,y,w,h,r);X.fillStyle=col;X.fill();X.restore();
    if(light){X.save();rr(x,y,w,h,r);X.clip();X.fillStyle=light;rr(x+7,y+5,w-19,7,3);X.fill();X.restore();}
  }
  function celOval(x,y,rx,ry,col,shade,light,o=4,rot=0) {
    el(x,y,rx,ry,rot);ink(shade,o);X.save();X.clip();el(x-5,y-5,rx,ry,rot);X.fillStyle=col;X.fill();
    if(light){el(x-rx*.3,y-ry*.45,rx*.34,ry*.18,-.4);X.fillStyle=light;X.fill();}X.restore();
  }
  function tube(points,col,w=5) { X.beginPath();points.forEach(([x,y],i)=>i?X.lineTo(x,y):X.moveTo(x,y));X.lineWidth=w+7;X.lineJoin=X.lineCap='round';X.strokeStyle=INK;X.stroke();X.lineWidth=w;X.strokeStyle=col;X.stroke(); }
  function gradient(y0,y1,stops) { const g=X.createLinearGradient(0,y0,0,y1);stops.forEach(([at,col])=>g.addColorStop(at,col));return g; }
  function eyes(x,y,r,look,mood,T) {
    for(const s of [-1,1]) {
      const ex=x+s*r*1.3;
      if(mood==='happy'||mood==='bonk'||Math.sin(T*1.9+s*.2)>.985){X.beginPath();if(mood==='bonk'){X.moveTo(ex-r*.6,y-r*.5);X.lineTo(ex+r*.5,y);X.lineTo(ex-r*.6,y+r*.5);}else X.arc(ex,y+r*.3,r*.7,Math.PI*1.1,Math.PI*1.9);X.strokeStyle=INK;X.lineWidth=4;X.stroke();continue;}
      el(ex,y,r,mood==='panic'?r*1.3:r*1.08);ink('#fff',2.5);
      const px=ex+look*r*.35;el(px,y+r*.1,r*.5,r*.58);X.fillStyle=INK;X.fill();el(px-r*.15,y-r*.15,r*.18,r*.18);X.fillStyle='#fff';X.fill();
    }
  }
  function mouth(x,y,mood,width=18) {
    if(mood==='eat'||mood==='panic'){el(x,y,width,width*.68);ink('#6e1838',3);el(x,y+width*.35,width*.6,width*.2);X.fillStyle='#ff92ad';X.fill();}
    else {X.beginPath();X.moveTo(x-width,y);X.quadraticCurveTo(x,y+(mood==='sad'||mood==='bonk'?-8:10),x+width,y);X.strokeStyle=INK;X.lineWidth=4;X.stroke();}
  }
  function tag(x,y,label,col) {
    X.beginPath();X.moveTo(x-7,y+10);X.lineTo(x,y+20);X.lineTo(x+7,y+10);X.closePath();ink(col,2.5);
    panel(x-48,y-11,96,23,col,'#8f88a6','rgba(255,255,255,.4)',11,2.5);txt(label,x,y+1,15,INK,'center',85);
  }
  function actor(x,y,u,col,mood,T,label,look=0) {
    shadow(x,y+7,6*u,u,.2);X.save();X.translate(x,y+Math.sin(T*2.3)*2);
    if(mood==='happy')X.translate(0,-Math.abs(Math.sin(T*9))*9);
    tube([[-6*u,-5*u],[-9*u,-8*u],[-9*u,-10*u]],col,u);tube([[6*u,-5*u],[9*u,-7*u],[9*u,mood==='happy'?-11*u:-6*u]],col,u);
    claude(0,0,u,{col,mood:mood==='bonk'?'sad':mood});
    // Cover the old square eyes and dress the familiar silhouette in the updated stage art.
    rr(-5*u,-8.1*u,10*u,4.5*u,3);X.fillStyle=col;X.fill();eyes(0,-6.1*u,u*1.2,look,mood,T);
    X.fillStyle='rgba(255,255,255,.24)';rr(-5.3*u,-8.8*u,3*u,u,3);X.fill();
    for(const s of [-1,1]){el(s*4.3*u,-4.3*u,u*.8,u*.4);X.fillStyle='rgba(255,110,165,.5)';X.fill();}
    X.restore();if(label)tag(x,y-12*u,label,col);
  }
  function cloud(x,y,s) { X.save();X.translate(x,y);X.scale(s,s);for(const [a,b,r] of [[0,0,22],[24,-12,26],[50,0,20],[24,7,22]]){el(a,b,r,r);ink('#e4f5ff',3);}for(const [a,b,r]of [[0,0,22],[24,-12,26],[50,0,20]]){el(a-3,b-5,r*.8,r*.8);X.fillStyle='#fff';X.fill();}X.restore(); }
  function tree(x,y,s) { X.save();X.translate(x,y);X.scale(s,s);panel(-9,-28,18,58,'#8a5a34','#5b3d24','#ba8c56',4,3);for(const [a,b,r]of [[-25,-52,30],[20,-60,35],[0,-85,32]])celOval(a,b,r,r,'#3fb260','#2f7a49','#5bcf72',3);X.restore(); }
  function fence(y) {for(let x=25;x<800;x+=95){panel(x,y-36,17,70,'#e3a868','#c4874e','#f2c184',4,3);}for(const yy of [y-16,y+10])panel(0,yy,800,12,'#e3a868','#c4874e','#f2c184',4,3);}
  function background(kind) {
    if(backgrounds.has(kind))return backgrounds.get(kind);
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;const old=X;X=canvas.getContext('2d');
    try {
      if(kind===0||kind===1||kind===4) {
        X.fillStyle=gradient(0,450,[[0,kind===0?'#88cde3':'#d9a86a'],[1,kind===0?'#e3f6fb':'#ffe0a8']]);X.fillRect(0,0,800,600);
        for(let i=0;i<12;i++){X.fillStyle='rgba(200,120,70,.12)';X.fillRect(i*70,0,22,445);}
        X.fillStyle=gradient(445,600,[[0,'#b97a46'],[1,'#8a5530']]);X.fillRect(0,445,800,155);tube([[0,445],[800,445]],'#e3a868',4);
        for(let y=464;y<600;y+=29)tube([[0,y],[800,y]],'#a16a40',1);
        for(let i=0;i<8;i++)tube([[i*112+(i%2?50:0),445],[i*112+(i%2?50:0),600]],'#8a5530',1);
        // Rounded shop windows, shelves, screws and deliberately small background props.
        for(const x of [28,642]) { panel(x,170,128,175,'#d9944f','#a5622c','#f2b878',12,4);panel(x+10,180,108,145,'#86d8fb','#3c6fb4','#d6f7ff',8,3);tube([[x+64,180],[x+64,325]],'#d9944f',5); }
        if(kind===1){panel(44,352,132,20,'#d9944f','#a5622c','#f2b878',5,3);for(let i=0;i<3;i++)panel(60+i*32,318,20,32,['#ff4d5e','#ffd23f','#5CFF7A'][i],'#8f88a6','#fff',6,2);}
        if(kind===4){for(let i=0;i<7;i++){tube([[200+i*60,162],[218+i*60,177]],['#ff5c8a','#ffd23f','#6EA8FE'][i%3],5);}}
      } else {
        X.fillStyle=gradient(0,390,[[0,'#36b0ea'],[.55,'#86d8fb'],[1,'#d6f7ff']]);X.fillRect(0,0,800,600);
        for(let i=0;i<3;i++){el(140+i*320,372,300,130);X.fillStyle=i%2?'#87d19b':'#a9dfc6';X.fill();}
        X.fillStyle=gradient(374,600,[[0,'#8fdc5c'],[1,'#5fb944']]);X.fillRect(0,374,800,226);tube([[0,374],[800,374]],'#4f9a6a',3);
        tree(52,386,.9);tree(748,389,1);fence(375);
        for(let i=0;i<18;i++){const x=(i*137)%800,y=398+i*37%140;tube([[x-6,y],[x-10,y-7]],'#3f8f35',1);tube([[x,y],[x+2,y-10]],'#3f8f35',1);}
        if(kind===3||kind===5){el(400,440,355,75);ink('#f4d998',4);el(400,445,340,64);X.fillStyle=gradient(381,509,[[0,'#62d3f0'],[1,'#2a8fcb']]);X.fill();}
        if(kind===2){panel(45,228,21,204,'#d9944f','#a5622c','#f2b878',7,4);panel(731,228,21,204,'#d9944f','#a5622c','#f2b878',7,4);tube([[54,229],[742,229]],'#e3a868',8);for(let i=0;i<10;i++){X.beginPath();X.moveTo(74+i*66,235);X.lineTo(119+i*66,235);X.lineTo(97+i*66,265);X.closePath();ink(['#ff5c8a','#FFE14D','#6EA8FE'][i%3],2);}}
        if(kind===6){panel(90,245,620,22,'#d9944f','#a5622c','#f2b878',8,4);panel(116,262,18,180,'#d9944f','#a5622c','#f2b878',5,3);panel(666,262,18,180,'#d9944f','#a5622c','#f2b878',5,3);}
      }
    } finally {X=old;}
    backgrounds.set(kind,canvas);return canvas;
  }
  function idle(kind,T) {
    if(kind!==0&&kind!==1&&kind!==4){for(let i=0;i<3;i++)cloud((T*(4+i)+i*290)%1050-120,165+i%2*32,.6+i*.1);celOval(705,111,28,28,'#ffe14d','#ffd84a','#fff3a0',3);}
    // A tiny bird outside the shop / duck in the pond keeps the place alive.
    const x=kind===3||kind===5?620+Math.sin(T*.7)*35:80+Math.sin(T*.9)*12,y=kind===3||kind===5?465:336;
    celOval(x,y,18,10,'#fffbea','#d9d3ea','#fff',2);celOval(x+13,y-10,9,10,'#fffbea','#d9d3ea','#fff',2);tube([[x+20,y-9],[x+28,y-8]],'#ffd23f',3);el(x+15,y-13,2,2);X.fillStyle=INK;X.fill();
  }
  function frog(x,y,s,col,mood,T,look=0) {
    const shade=col==='#b49cf0'?'#7a63b9':'#2f7a49', light=col==='#b49cf0'?'#cdbdf5':'#b2f27f';
    X.save();X.translate(x,y);X.scale(s*(1+Math.sin(T*3)*.02),s*(1-Math.sin(T*3)*.02));
    for(const side of [-1,1]){celOval(side*68,30,35,23,col,shade,light,4);celOval(side*33,-40,24,29,col,shade,light,4);}
    celOval(0,0,77,55,col,shade,light,5);celOval(0,18,56,28,'#d8f0b0','#9ec97b','#e6f7c8',3);
    eyes(0,-34,20,look,mood,T);mouth(0,21,mood,25);
    for(const side of [-1,1]){el(side*54,6,12,6);X.fillStyle='rgba(255,110,165,.55)';X.fill();}
    X.restore();
  }
  function dragon(x,y,s,col,mood,T) {
    X.save();X.translate(x,y);X.scale(s,s);X.rotate(Math.sin(T*2)*.025);
    for(const side of [-1,1]){X.beginPath();X.moveTo(side*54,-10);X.quadraticCurveTo(side*99,-77,side*125,-42);X.lineTo(side*114,18);X.quadraticCurveTo(side*93,-7,side*70,38);X.closePath();ink('#ffe0a8',4);tube([[side*65,0],[side*106,-38]],'#d9944f',3);}
    celOval(0,18,77,89,col,'#7a63b9','rgba(255,255,255,.32)',5);celOval(-9,48,40,52,'#ffe0a8','#d9a86a','#fff4d8',3);
    for(const side of [-1,1]){X.beginPath();X.moveTo(side*36,-49);X.quadraticCurveTo(side*67,-100,side*57,-32);X.closePath();ink('#fff3b0',3);}
    celOval(0,-12,58,45,col,'#7a63b9','rgba(255,255,255,.32)',4);eyes(0,-20,16,0,mood,T);mouth(0,8,mood,20);X.restore();
  }
  function hen(x,y,T,mood) {
    X.save();X.translate(x,y);X.rotate(Math.sin(T*4)*.04);celOval(0,0,40,28,'#fffbea','#d9d3ea','#fff',4);celOval(1,5,23,15,'#e3ac66','#b98042','#f7d297',2);
    for(let i=0;i<3;i++)celOval(24+i*7,-37,7,10,'#ff4d5e','#b8283a','#ff9d9d',2);
    celOval(27,-21,22,25,'#fffbea','#d9d3ea','#fff',3);eyes(31,-26,5,1,mood,T);tube([[45,-17],[60,-14]],'#ffd23f',5);tube([[-12,23],[-17,34]],'#d9944f',3);tube([[12,23],[18,34]],'#d9944f',3);X.restore();
  }
  function scoreboard(progress,role,n,T) {
    tube([[364,58],[364,78]],'#e6c58c',3);tube([[594,58],[594,78]],'#e6c58c',3);panel(338,78,282,67,'#d9944f','#a5622c','#f2b878',15,4);
    for(let i=0;i<n;i++){const x=370+i*236/n;celOval(x,110,18,20,'#fffbea','#d9d3ea','#fff',2.5);el(x,114,12,12);X.fillStyle=progress[i]>=1?'#5CFF7A':progress[i]>0?['#4DB8FF','#FF4D9E','#FFE14D','#5CFF7A'][i]:'#8f88a6';X.fill();txt(''+(i+1),x,114,18,INK);X.beginPath();X.arc(x,110,16,-Math.PI/2,-Math.PI/2+Math.max(.001,progress[i])*TAU);X.lineWidth=3;X.strokeStyle=progress[i]>=1?'#24803a':'#c99512';X.stroke();if(i===role){star(x,86,7,3,5,T*.2,'#FFE14D',2);}}
    txt(Math.round(progress[role]*100)+'%',597,112,17,INK,'center',34);
  }
  function control(label,lit,pressed,result,key,kind) {
    if(result) label=(result==='win'?['ALL CLEAN!','RESCUED!','BALANCED!','FULL TUMMY!','READY TO FLY!','BRIDGE READY!','EGGS SAVED!']:['MUD AGAIN!','OOPS!','DROPPED IT!','MISSED!','POP!','SPLASH!','CRACK!'])[kind];
    const y=pressed?464:458,col=result?'#d3cfe0':lit?'#4fd06a':'#ffd23f',dk=result?'#8f88a6':lit?'#24803a':'#c99512';
    shadow(405,539,200,9,.25);panel(200,466,400,68,dk,dk,null,20,4);panel(200,y,400,68,col,dk,'rgba(255,255,255,.4)',20,4);
    if(TOUCH) label=label.replace(' / HOLD SPACE','');
    txt(label,400,y+23,25,result?'#f6f4fb':INK,'center',370);
    if(!TOUCH && !result){panel(334,y+40,132,20,'#fff','#c9ced6',null,6,2);txt(key,400,y+50,13,INK,'center',118);}
    else if(!result) {celOval(400,y+50,10,6,'#fff','#c9ced6',null,2);}
  }
  function payoff(result,x,y,T) {
    if(!result)return;for(let i=0;i<3;i++){const a=T*5+i*TAU/3;star(x+Math.cos(a)*57,y+Math.sin(a)*18,9,4,5,a,result==='win'?'#FFE14D':'#9fe3ff',2);}
  }
  function draw(v) {
    X=ctx;const {kind,role,progress,value,target,c,charge,flash,result,n,colors,end=0}=v;
    const lost=result==='lose', won=result==='win', gag=Math.min(1,end/.7);
    const T=now||c,col=colors[role],mean=progress.reduce((a,b)=>a+b,0)/n;
    const mood=result==='win'||flash>0?'happy':result==='lose'||flash<0?'bonk':charge>.9?'panic':'idle';
    X.drawImage(background(kind),0,0);idle(kind,T);
    const label=t('YOU');
    if(kind===0){
      // Bus wash: the duck driver appears only as the glass gets clean.
      for(const x of [210,600]){celOval(x,440,38,38,'#3b3550','#211d32','#5a5274',5);celOval(x,440,19,19,'#cfd8e6','#8f9cb3','#fff',3);}
      panel(99,201,606,232,'#ffd23f','#c99512','#fff3a0',34,5);panel(116,220,572,175,'#86d8fb','#3c6fb4','#d6f7ff',20,4);
      actor(530,385,6.2,'#D97757',mood,T,null,-1);tube([[610,266],[610,384]],'#d9944f',5);
      X.save();rr(122,226,560,163,16);X.clip();for(let i=0;i<25;i++){el(142+i*97%520,245+i*53%122,17+i%4*4,12);X.fillStyle=`rgba(122,82,55,${.9*(1-progress[role])})`;X.fill();}X.restore();
      if(lost){X.save();X.globalAlpha=gag;celOval(530,296,34,23,'#8e6b4d','#795032','#b98042',3);X.restore();}
      const x=110+value*580;panel(x-21,242,43,127,'#ffd23f','#c99512','#fff3a0',12,3);tube([[x,369],[x,400]],'#cfd8e6',7);celOval(x,411,17,18,col,'#8f88a6','#fff',3);
      actor(64,454,5.6,col,mood,T,label,1);control('SWEEP LEFT / RIGHT',progress[role]>=1,false,result,'← → / A D',kind);payoff(result,530,273,T);
    }else if(kind===1){
      // Workshop crane: turning the original wheel lifts an expressive sleeping critter.
      tube([[311,205],[580,205],[580,294-mean*64]],'#cfd8e6',8);panel(200,239,219,193,'#d9944f','#a5622c','#f2b878',18,4);
      celOval(310,334,90,90,'#cfd8e6','#8f9cb3','#fff',5);celOval(310,334,68,68,'#ffd23f','#c99512','#fff3a0',4);
      const a=progress[role]*TAU*3;for(let i=0;i<5;i++)tube([[310,334],[310+Math.cos(a+i*TAU/5)*60,334+Math.sin(a+i*TAU/5)*60]],'#d9944f',7);
      celOval(310,334,16,16,'#cfd8e6','#8f9cb3','#fff',3);celOval(310+Math.cos(a)*78,334+Math.sin(a)*78,21,21,col,'#8f88a6','#fff',4);
      frog(579,361-mean*62+(lost?gag*42:0),.8,'#b49cf0',result==='lose'?'bonk':result==='win'?'happy':mean>.5?'panic':'idle',T);
      actor(118,444,5.8,col,mood,T,label,1);control('DRAG IN CIRCLES / HOLD SPACE',progress[role]>=1,false,result,'SPACE',kind);payoff(result,579,256,T);
    }else if(kind===2){
      tube([[110,370],[690,370]],'#d9944f',14);panel(110+(target-.08)*580,356,.16*580,29,'#5CFF7A','#24803a','#b2f27f',8,3);
      const x=110+value*580;shadow(x,403,48,9,.2);celOval(x,339,43,35,'#a4b1f2','#8492e2','#c9d0fb',5);celOval(x-3,330,34,27,'#c9d0fb','#a4b1f2','#f6f8ff',3);eyes(x,320,8,(target-value)*3,mood,T);mouth(x,344,mood,12);
      for(const s of [-1,1])tube([[x+s*24,354],[x+s*50,365]],'#a4b1f2',10);celOval(x+(lost?gag*100:0),279+Math.sin(T*5)*2+(lost?gag*gag*110:0),24,24,col,'#8f88a6','#fff',4);
      actor(58,448,5.4,col,mood,T,label,1);control('KEEP THE BALL IN GREEN',Math.abs(value-target)<.08,false,result,'← → / A D',kind);payoff(result,x,255,T);
    }else if(kind===3){
      celOval(400,417,143,25,'#78cc72','#3fa64a','#b2f27f',4);frog(400,350,1.15,'#6fd660',flash>0?'eat':mood,T,Math.sin(c*3));
      const x=400+Math.sin(c*3)*220,y=225;celOval(x,y,13,10,'#5a5274','#3b3550','#c9c3d6',3);for(const s of [-1,1])celOval(x+s*10,y-10,14,7,'#e4f5ff','#9fc6df','#fff',2,s*.5);eyes(x,y-1,3,0,'idle',T);
      if(flash>0||lost)tube([[400,373],[lost?400-gag*70:x,lost?425:225]],'#ff92ad',12);
      actor(125,446,5.4,col,mood,T,label,1);control(Math.abs(Math.sin(c*3))<.38?'FEED NOW!':'WAIT FOR THE FLY',Math.abs(Math.sin(c*3))<.38,flash>0,result,'SPACE',kind);payoff(result,400,260,T);
    }else if(kind===4){
      tube([[232,393],[286,393],[297,439],[430,439],[446,369]],'#e6c58c',7);panel(153,356,89,62,'#d9944f','#a5622c','#f2b878',15,4);tube([[197,355],[197,301-charge*42]],'#cfd8e6',11);panel(157,287-charge*42,80,22,col,'#8f88a6','#fff',9,4);
      dragon(537,318+(lost?gag*73:0),(.75+mean*.25+charge*.08)*(lost?1-gag*.55:1),'#b49cf0',mood,T);tube([[537,400],[537,435],[492,445]],'#e6c58c',2);
      panel(303,189,230,25,'#fffbea','#d9d3ea','#fff',9,3);panel(303+.55/1.05*230,189,.4/1.05*230,25,'#5CFF7A','#24803a',null,7,2);tube([[303+Math.min(1,charge/1.05)*230,182],[303+Math.min(1,charge/1.05)*230,222]],'#ff4d5e',3);
      actor(77,448,5.4,col,mood,T,label,1);control(charge>=.55&&charge<=.95?'RELEASE NOW!':'HOLD TO PUMP',charge>=.55&&charge<=.95,charge>0,result,'SPACE',kind);payoff(result,537,215,T);
    }else if(kind===5){
      tube([[91,313],[708,313]],'#e6c58c',5);tube([[91,385],[708,385]],'#e6c58c',5);
      const w=580/(n*3);for(let i=0;i<n;i++)for(let j=0;j<3;j++){const x=111+(i*3+j)*w;panel(x,350+(lost&&i===role&&j===1?gag*gag*60:0),w-6,51,progress[i]*3>j?colors[i]:'#8f88a6','#a5622c','#f2b878',6,3);tube([[x+5,365],[x+w-13,365]],'rgba(255,255,255,.2)',1);}
      actor(80,343,5.4,col,mood,T,label,1);actor(720,343,5.4,colors[(role+1)%n],mood,T,'P'+((role+1)%n+1),-1);
      const hx=400+Math.sin(c*3.5)*190;panel(333,193,134,17,'#5CFF7A','#24803a','#b2f27f',7,3);celOval(hx,202,7,10,'#ff4d5e','#b8283a','#ff9d9d',2);
      X.save();X.translate(hx,252);X.rotate(flash>0?.4:Math.sin(c*3.5)*.2);tube([[0,0],[0,75]],'#d9944f',12);panel(-40,-23,80,40,'#6EA8FE','#3c6fb4','#c9d0fb',14,4);for(const side of [-1,1])panel(side*37-8,-27,16,47,'#ffd23f','#c99512','#fff3a0',7,3);X.restore();
      control(Math.abs(Math.sin(c*3.5))<.35?'HAMMER NOW!':'WAIT FOR GREEN',Math.abs(Math.sin(c*3.5))<.35,flash>0,result,'SPACE',kind);payoff(result,720,249,T);
    }else{
      const cycle=Math.floor(c/1.2),phase=c%1.2/1.2,ex=110+580*(.18+((cycle*.37+target)%.64));hen(ex,206,T,mood);
      if(phase<.87)celOval(ex,278+phase*145,13,19,'#fffbea','#d9d3ea','#fff',3,.1);
      const x=110+value*580;actor(x,423,6,col,mood,T,label,0);panel(x-51,408,102,32,'#e3ac66','#b98042','#f7d297',13,4);for(let i=0;i<6;i++)tube([[x-40+i*16,412],[x-40+i*16,435]],'#c98443',2);tube([[x-45,424],[x+44,424]],'#f7d297',2);
      if(lost){celOval(608,437,23,8,'#ffd23f','#c99512','#fff3a0',2);tube([[592,429],[602,420],[615,433]],'#fffbea',4);}
      control('MOVE TO CATCH THE EGGS',flash>0,false,result,'← → / A D',kind);payoff(result,ex,180,T);
    }
    scoreboard(progress,role,n,T);vignette(.16);
  }
  return { draw };
})();
