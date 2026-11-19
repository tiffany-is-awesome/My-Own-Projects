/* ---------- Plate drawing ---------- */
function rng(seed){let h=2166136261>>>0;for(const ch of seed){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return()=>{h^=h<<13;h>>>=0;h^=h>>>17;h^=h<<5;h>>>=0;return (h%100000)/100000}}
function drawPlate(cv,r,bg){
  const x=cv.getContext("2d"),W=cv.width,H=cv.height,R=rng(r.title),pal=r.palette;
  const k=W/800; x.setTransform(1,0,0,1,0,0); x.clearRect(0,0,W,H); x.scale(k,k);
  const w=800,h=1000;
  if(bg){const s=Math.max(w/bg.width,h/bg.height),iw=bg.width*s,ih=bg.height*s;x.drawImage(bg,(w-iw)/2,(h-ih)/2,iw,ih);x.fillStyle="rgba(0,0,0,.08)";x.fillRect(0,0,w,h);}
  else{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,"#EDEBE6");g.addColorStop(1,"#DCD8D0");x.fillStyle=g;x.fillRect(0,0,w,h);
    x.strokeStyle="rgba(0,0,0,.035)";x.lineWidth=1;for(let i=0;i<140;i++){const yy=R()*h;x.beginPath();x.moveTo(0,yy);x.lineTo(w,yy+(R()-.5)*20);x.stroke();}}
  const cx=400,cy=500;
  const shadow=(b,oy)=>{x.shadowColor="rgba(0,0,0,.28)";x.shadowBlur=b;x.shadowOffsetY=oy};
  const noShadow=()=>{x.shadowColor="transparent";x.shadowBlur=0;x.shadowOffsetY=0};
  const blob=(bx,by,rad,col,pts=9)=>{x.fillStyle=col;x.beginPath();for(let i=0;i<=pts;i++){const a=i/pts*Math.PI*2,rr=rad*(.75+R()*.4);const px=bx+Math.cos(a)*rr,py=by+Math.sin(a)*rr;i?x.lineTo(px,py):x.moveTo(px,py)}x.closePath();x.fill()};
  const specks=(n,rad,col,sz)=>{x.fillStyle=col;for(let i=0;i<n;i++){const a=R()*Math.PI*2,d=Math.sqrt(R())*rad;x.beginPath();x.ellipse(cx+Math.cos(a)*d,cy+Math.sin(a)*d,sz*(.6+R()*.8),sz*.5,R()*3,0,Math.PI*2);x.fill()}};
  const egg=(ex,ey,s)=>{x.fillStyle="#FBF8F1";x.beginPath();x.ellipse(ex,ey,38*s,28*s,R(),0,Math.PI*2);x.fill();x.fillStyle="#F2AE2E";x.beginPath();x.arc(ex+2,ey,15*s,0,Math.PI*2);x.fill();x.fillStyle="rgba(255,255,255,.35)";x.beginPath();x.arc(ex-3,ey-4,5*s,0,Math.PI*2);x.fill()};
  const hasEgg=r.ingredients.some(i=>i.k==="egg"||/egg/i.test(i.n||i.name||""));
  if(r.plating==="skillet"){
    shadow(40,18); x.save();x.translate(cx,cy);x.rotate(.75);x.fillStyle="#1A1A1A";x.beginPath();x.roundRect(250,-28,260,56,26);x.fill();x.restore();
    x.fillStyle="#232323";x.beginPath();x.arc(cx,cy,300,0,Math.PI*2);x.fill();noShadow();
    x.fillStyle="#303030";x.beginPath();x.arc(cx,cy,272,0,Math.PI*2);x.fill();
    x.fillStyle=pal[0];x.globalAlpha=.95;x.beginPath();x.arc(cx,cy,258,0,Math.PI*2);x.fill();x.globalAlpha=1;
    for(let i=0;i<26;i++){const a=R()*Math.PI*2,d=Math.sqrt(R())*215;x.save();x.translate(cx+Math.cos(a)*d,cy+Math.sin(a)*d);x.rotate(R()*Math.PI);x.fillStyle=pal[1];x.beginPath();x.roundRect(-30,-14,60,28,14);x.fill();x.fillStyle="rgba(120,40,20,.35)";x.fillRect(-26,4,52,6);x.restore();}
    for(let i=0;i<5;i++){const a=R()*Math.PI*2,d=R()*140;blob(cx+Math.cos(a)*d,cy+Math.sin(a)*d,34,pal[2]);}
    if(hasEgg){egg(cx-60,cy-30,1.1);egg(cx+70,cy+40,1.1);}
    specks(70,240,pal[3],7);
  }else if(r.plating==="board"){
    shadow(36,16);x.fillStyle="#B98A57";x.beginPath();x.roundRect(110,150,580,720,28);x.fill();noShadow();
    x.strokeStyle="rgba(80,45,15,.18)";x.lineWidth=2;for(let i=0;i<26;i++){const xx=130+R()*540;x.beginPath();x.moveTo(xx,165);x.bezierCurveTo(xx+(R()-.5)*30,400,xx+(R()-.5)*30,650,xx+(R()-.5)*20,855);x.stroke();}
    const spots=[[300,330],[500,500],[300,680]];
    spots.forEach(([tx,ty],j)=>{shadow(14,6);x.fillStyle="#EAD7A6";x.beginPath();x.ellipse(tx,ty,150,120,-.25,0,Math.PI*2);x.fill();noShadow();
      x.fillStyle="rgba(110,70,30,.18)";for(let s=0;s<14;s++){x.beginPath();x.arc(tx+(R()-.5)*240,ty+(R()-.5)*190,4+R()*6,0,Math.PI*2);x.fill();}
      for(let b=0;b<9;b++)blob(tx+(R()-.5)*170,ty+(R()-.5)*110,22,pal[b%2?0:1]);
      x.fillStyle=pal[2];for(let s=0;s<26;s++){x.beginPath();x.ellipse(tx+(R()-.5)*190,ty+(R()-.5)*130,6,3,R()*3,0,Math.PI*2);x.fill();}
      x.fillStyle="#F3EEDF";for(let s=0;s<10;s++){x.fillRect(tx+(R()-.5)*170,ty+(R()-.5)*110,9,9);}});
    [[590,250],[620,760]].forEach(([lx,ly])=>{x.fillStyle="#7DA944";x.beginPath();x.arc(lx,ly,40,Math.PI*.1,Math.PI*1.1);x.fill();x.fillStyle="#D9E8A0";x.beginPath();x.arc(lx,ly,30,Math.PI*.1,Math.PI*1.1);x.fill();});
  }else if(r.plating==="bowl"){
    shadow(40,20);const g=x.createRadialGradient(cx-60,cy-80,40,cx,cy,330);g.addColorStop(0,"#FFFFFF");g.addColorStop(1,"#E4E1DA");x.fillStyle=g;x.beginPath();x.arc(cx,cy,320,0,Math.PI*2);x.fill();noShadow();
    x.fillStyle="#EEEBE4";x.beginPath();x.arc(cx,cy,282,0,Math.PI*2);x.fill();
    const n=4;for(let s=0;s<n;s++){const a0=s/n*Math.PI*2+.3;for(let b=0;b<16;b++){const a=a0+R()*(Math.PI*2/n)*.85,d=70+R()*180;blob(cx+Math.cos(a)*d,cy+Math.sin(a)*d,30+R()*16,pal[s%pal.length]);}}
    if(hasEgg){egg(cx-20,cy-10,1.4);egg(cx+50,cy+35,1.2);} else blob(cx,cy,60,pal[3]);
    specks(40,250,"#3D6B2C",5);x.fillStyle="rgba(255,255,255,.85)";x.beginPath();x.ellipse(cx+120,cy-120,60,24,-.5,0,Math.PI*2);x.fill();
  }else{
    shadow(36,16);x.fillStyle="#FAFAF7";x.beginPath();x.arc(cx,cy,330,0,Math.PI*2);x.fill();noShadow();
    x.strokeStyle="rgba(0,0,0,.06)";x.lineWidth=3;x.beginPath();x.arc(cx,cy,250,0,Math.PI*2);x.stroke();
    x.strokeStyle=pal[0];x.lineCap="round";x.lineWidth=34;x.beginPath();x.arc(cx,cy+20,180,Math.PI*.15,Math.PI*.85);x.stroke();
    for(let b=0;b<22;b++){const a=R()*Math.PI*2,d=Math.sqrt(R())*130;blob(cx+Math.cos(a)*d,cy-20+Math.sin(a)*d,34,pal[1+b%3]);}
    if(hasEgg)egg(cx,cy-40,1.3);
    specks(30,160,"#3D6B2C",6);
  }
  x.setTransform(1,0,0,1,0,0);
}

