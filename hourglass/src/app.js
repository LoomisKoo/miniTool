'use strict';

function storeKey(k){return ((window.PLATFORM&&PLATFORM.storagePrefix)||'hourglass_')+k}

function $(id){return document.getElementById(id)}

const ITEM_H=40;
let totalSec=300, remainSec=300, running=false, frameLastT=0, timerLastT=0;
let sessionActive=false, phase='idle', curStick=0, timerStarted=false;
let burnOrder=[], stickBurnElapsed=0;
let censerAsh=[];

const SCENE_NAMES={night:'夜雨',bamboo:'竹林',temple:'古寺',silent:'默照'};
const LIGHT_NAMES={match:'火柴',lighter:'打火机'};
const SCENES={
  night:{bg:['#0a0c14','#060810'],noise:'rain',vol:0.06,img:'night'},
  bamboo:{bg:['#0a100c','#060a08'],noise:'wind',vol:0.04,img:'bamboo'},
  temple:{bg:['#100c08','#080604'],noise:'hum',vol:0.03,img:'temple'},
  silent:{bg:['#080706','#040302'],noise:null,vol:0},
};
let curScene='silent';
let lightMode=localStorage.getItem(storeKey('lightMode'))||'match';

const SZ={s:{len:.36,w:.58},m:{len:.56,w:.78},l:{len:.76,w:.98}};

function stickLayout(sec){
  let sizeList;
  if(sec<=90) sizeList=['s'];
  else if(sec<=360) sizeList=['m'];
  else if(sec<=720) sizeList=['m','s','s'];
  else if(sec<=1200) sizeList=['l','m','s'];
  else if(sec<=1800) sizeList=['l','m','m','s'];
  else{
    const n=Math.min(5,2+Math.ceil(sec/600));
    sizeList=Array.from({length:n},(_,i)=>i===Math.floor(n/2)?'l':i%2?'m':'s');
  }
  const n=sizeList.length, mid=Math.floor(n/2);
  const sorted=sizeList.map(sz=>({sz,len:SZ[sz].len})).sort((a,b)=>b.len-a.len);
  const placed=new Array(n);
  placed[mid]=sorted[0].sz;
  let si=1;
  for(let d=1;si<n;d++){
    if(mid-d>=0&&si<n) placed[mid-d]=sorted[si++].sz;
    if(mid+d<n&&si<n) placed[mid+d]=sorted[si++].sz;
  }
  const maxSpread=censerW*0.32;
  const step=n>1?Math.min(18,maxSpread/(n-1)):0;
  return placed.map((sz,i)=>({sz,x:(i-(n-1)/2)*step,tilt:(i-(n-1)/2)*0.018,slot:i}));
}

function buildLightSequence(n){
  const mid=Math.floor(n/2), seq=[mid];
  for(let d=1;seq.length<n;d++){
    if(mid-d>=0) seq.push(mid-d);
    if(seq.length<n&&mid+d<n) seq.push(mid+d);
  }
  return seq;
}

const COPY={
  idle:['轻触下方点香','选定时长，心随香起'],
  light:{match:['火柴轻划，香烟初起'],lighter:['打火机咔哒，香已点燃']},
  run:[
    {t:0,m:['香火初燃','清香徐来']},{t:60,m:['已燃一分钟']},{t:300,m:['五分钟已至']},
    {t:600,m:['十分钟过去']},{t:900,m:['一刻钟了']},
  ],
  ash:['灰尖已长，点「灰」或触香弹落'],
  done:['香已尽，灰犹在','计时已毕'],
  pause:['香火暂歇'],
  trivia:[
    '古代「一炷香」约计三十分钟，因香材与粗细而异',
    '唐宋时用焚香计时，称「香漏」或「火计时」',
    '「焚香的工夫」即指一段完整计时段',
    '线香约每分钟燃去三四毫米，视长度可估剩余时间',
    '寺庙晨钟暮鼓，中间常以一炷香为功课时段',
    '「弹指」「转瞬间」原也与燃香测时有关',
  ],
};
function pick(a){return a[Math.floor(Math.random()*a.length)]}
function sceneText(){
  if(lighting()) return pick(COPY.light[lightMode]||COPY.light.match);
  if(Math.random()<0.22&&!running&&!lighting()) return pick(COPY.trivia);
  if(!running&&!lighting()) return pick(COPY.idle);
  if(remainSec<=0) return pick(COPY.done);
  const el=totalSec-remainSec;
  let pool=COPY.run[0].m;
  for(let i=COPY.run.length-1;i>=0;i--) if(el>=COPY.run[i].t){pool=COPY.run[i].m;break}
  if(sticks.some(s=>s.ash>ASH_LIMIT*0.65)&&Math.random()>0.65) return pick(COPY.ash);
  if(Math.random()<0.12) return pick(COPY.trivia);
  return pick(pool);
}
function lighting(){return phase==='light'||sticks.some(s=>s.lighting>0&&s.lighting<1)}
function currentStick(){return sticks[burnOrder[curStick]]}
let hintTimer=0,curHint='';

const canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
let W,H,cx,baseY,stickBaseLen,stickBaseW,dpr,censerW,rimY,topLimit=40,uiTop=0;
let censerBox=null;

const bgImgs={};
const CENSER_RIM_NX=0.5, CENSER_RIM_NY=0.33, CENSER_BOTTOM_NY=0.94, CENSER_OPEN_FRAC=0.55;
const hasCenserAsset=()=>window.BG_IMGS&&(window.BG_IMGS['censer-front']||window.BG_IMGS['censer-back']);
if(window.BG_IMGS){
  Object.keys(window.BG_IMGS).forEach(k=>{
    const im=new Image();
    im.onload=()=>{ bgImgs[k]=im; scheduleResize(); };
    im.src=window.BG_IMGS[k];
  });
}
function layoutCenserBox(){
  const img=bgImgs['censer-front']||bgImgs['censer-back'];
  const iw=img?img.width:512, ih=img?img.height:512;
  censerW=Math.min(W*0.20,W*0.18);
  const dispW=(censerW*0.82)/CENSER_OPEN_FRAC;
  const dispH=dispW*(ih/iw);
  const censerBottom=uiTop-12;
  const y=censerBottom-CENSER_BOTTOM_NY*dispH;
  censerBox={x:cx-CENSER_RIM_NX*dispW,y,dispW,dispH};
  rimY=y+CENSER_RIM_NY*dispH;
}
function drawCenserImg(key){
  const img=bgImgs[key];
  if(!img||!censerBox) return false;
  ctx.drawImage(img,censerBox.x,censerBox.y,censerBox.dispW,censerBox.dispH);
  return true;
}

function relayoutSticks(){
  if(!sticks.length) return;
  stickLayout(totalSec).forEach((cfg,i)=>{ if(sticks[i]) sticks[i].cfg=cfg; });
}

let resizePending=false,lastUiH=0;
function resize(){
  dpr=Math.min(devicePixelRatio,2);
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(w!==W||h!==H){
    W=w; H=h;
    canvas.width=W*dpr; canvas.height=H*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  cx=W/2;

  const bottom=document.getElementById('bottom-ui');
  uiTop=H*0.58;
  if(bottom){
    const br=bottom.getBoundingClientRect();
    if(br.height>0&&br.top>0&&br.top<=H) uiTop=br.top;
    lastUiH=br.height|0;
  }
  topLimit=40;
  const toolbarRoot=document.getElementById('toolbar');
  if(toolbarRoot) topLimit=Math.max(topLimit,toolbarRoot.getBoundingClientRect().bottom+10);

  const censerBelow=56,margin=8;
  if(hasCenserAsset()){
    layoutCenserBox();
  }else{
    censerBox=null;
    rimY=Math.min(H*0.72,uiTop-censerBelow-margin);
    rimY=Math.max(rimY,topLimit+56);
  }

  const hintGap=44;
  stickBaseLen=Math.min(H*0.72,W*0.72,rimY-topLimit-hintGap);
  stickBaseLen=Math.max(stickBaseLen,H*0.22);
  stickBaseW=stickBaseLen*0.036;
  if(!hasCenserAsset()) censerW=Math.min(W*0.42,stickBaseLen*0.38);
  baseY=rimY+6;
  relayoutSticks();
}
function scheduleResize(){
  if(resizePending) return;
  resizePending=true;
  requestAnimationFrame(()=>{ resizePending=false; resize(); });
}
addEventListener('resize',scheduleResize); scheduleResize();
const bottomUi=document.getElementById('bottom-ui');
if(bottomUi&&window.ResizeObserver) new ResizeObserver(entries=>{
  const h=entries[0].contentRect.height|0;
  if(Math.abs(h-lastUiH)>3){ lastUiH=h; scheduleResize(); }
}).observe(bottomUi);

let sticks=[],maxBurnLen=1;
function initSticks(){
  sticks=[]; maxBurnLen=0;
  const layout=stickLayout(totalSec);
  burnOrder=buildLightSequence(layout.length);
  curStick=0; stickBurnElapsed=0; phase='idle'; sessionActive=false; timerStarted=false;
  layout.forEach(cfg=>{
    const sp=calcParams(cfg);
    maxBurnLen=Math.max(maxBurnLen,sp.coatLen);
    sticks.push({cfg,progress:0,done:false,ash:0,lighting:0,lit:false,ignited:false,
      ashParticles:[],shakeT:0,smokeEmit:0,smokePhase:Math.random()*6.28,timeShare:0,
      ashFalling:[]});
  });
  const totalCoat=sticks.reduce((s,st)=>s+calcParams(st.cfg).coatLen,0);
  sticks.forEach(st=>{ st.timeShare=totalSec*(calcParams(st.cfg).coatLen/totalCoat); });
}

function recalcTimeShares(){
  if(!sticks.length) return;
  const totalCoat=sticks.reduce((s,st)=>s+calcParams(st.cfg).coatLen,0);
  if(totalCoat<=0) return;
  sticks.forEach(st=>{ st.timeShare=totalSec*(calcParams(st.cfg).coatLen/totalCoat); });
}

const ASH_LIMIT=0.3;
const ASH_AUTO=0.24;
const BOWL_Y=()=>censerBox?rimY+censerBox.dispH*0.07:rimY+10;
const INSERT_DEPTH=()=>stickBaseLen*0.09;
const BAMBOO_LEN=()=>stickBaseLen*0.11;

function calcParams(cfg){
  const s=SZ[cfg.sz];
  const w=stickBaseW*s.w;
  const bambooLen=BAMBOO_LEN();
  const coatLen=Math.max(stickBaseLen*s.len-bambooLen,stickBaseLen*0.06);
  const rimPoint=rimY;
  const bambooTop=rimPoint-bambooLen;
  const top=bambooTop-coatLen;
  const bottom=rimPoint+INSERT_DEPTH();
  return{x:cx+cfg.x,tilt:cfg.tilt||0,len:coatLen+bambooLen,w,bambooLen,coatLen,top,bottom,
    bambooTop,rimPoint,insertDepth:INSERT_DEPTH()};
}

function tipPos(sp,st){
  const y=getBurnY(st,sp)-2,dy=y-sp.rimPoint,t=sp.tilt||0;
  return{x:sp.x-dy*Math.sin(t),y:sp.rimPoint+dy*Math.cos(t)};
}
function emitSmoke(st,stream){
  const tip=tipPos(calcParams(st.cfg),st);
  stream.particles.push({
    x:tip.x+(Math.random()-0.5)*1.4,
    y:tip.y+(Math.random()-0.5)*0.7,
    vx:(Math.random()-0.5)*0.02,
    vy:-0.014-Math.random()*0.006,
    life:1,
    phase:Math.random()*6.28,
    size:0.8+Math.random()*0.7,
    r:0.9+Math.random()*0.9
  });
}
function ensureStreams(st){
  if(!st.streams){
    st.streams=[
      {particles:[],phase:st.smokePhase},
      {particles:[],phase:st.smokePhase+2.1}
    ];
  }
}
const MAX_SMOKE=180;
function updSmoke(st,dt){
  if(!st.lit||st.done||phase!=='burn') return;
  ensureStreams(st);
  st.smokeEmit+=dt;
  while(st.smokeEmit>=70){
    st.smokeEmit-=70;
    st.streams.forEach(s=>{
      emitSmoke(st,s);
      if(s.particles.length>MAX_SMOKE) s.particles.splice(0,s.particles.length-MAX_SMOKE);
    });
  }
  const tc=performance.now()*0.001;
  st.streams.forEach(s=>{
    for(let i=s.particles.length-1;i>=0;i--){
      const p=s.particles[i];
      p.x+=(p.vx+Math.sin(p.phase)*0.006)*dt;
      p.y+=p.vy*dt;
      p.phase+=dt*0.0006;
      p.life-=dt*0.00002;
      if(p.life<=0) s.particles.splice(i,1);
    }
  });
}
function drawSmoke(st){
  if(!st.streams) return;
  ctx.save();
  ctx.globalCompositeOperation='screen';
  for(const s of st.streams){
    const ps=s.particles;
    for(let i=0;i<ps.length;i++){
      const p=ps[i];
      if(p.life<0.03) continue;
      const r=p.r*(1.6+p.life*3.2);
      const a=p.life*0.035;
      if(a<0.003) continue;
      const g=ctx.createRadialGradient(p.x,p.y,r*0.12,p.x,p.y,r);
      g.addColorStop(0,`rgba(236,232,224,${a})`);
      g.addColorStop(0.55,`rgba(228,222,212,${a*0.42})`);
      g.addColorStop(1,'rgba(228,222,212,0)');
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
}
function drawStickSmoke(st){
  if(!st.lit||st.done||!st.streams) return;
  drawSmoke(st);
}

function getBurnY(st,sp){
  if(st.done) return sp.top+sp.coatLen;
  return sp.top+st.progress*sp.coatLen;
}

function stickShake(st,sp){
  if(!st.shakeT) return {dx:0,dRot:0};
  const elapsed=performance.now()-st.shakeT;
  if(elapsed>480){ st.shakeT=0; return {dx:0,dRot:0}; }
  const damp=1-elapsed/480;
  return {
    dx:Math.sin(elapsed*0.048)*sp.w*2.8*damp,
    dRot:Math.sin(elapsed*0.055)*0.028*damp
  };
}

function spawnAshBurst(st,sp,gentle){
  if(st.ash<0.006) return false;
  const burnY=getBurnY(st,sp);
  const ashH=st.ash*sp.coatLen;
  const midY=burnY+ashH*0.45;
  const n=gentle?Math.min(10,Math.floor(3+ashH*0.5)):Math.min(48,Math.floor(10+ashH*1.4));
  for(let i=0;i<n;i++){
    const ang=(Math.random()-0.5)*Math.PI*1.35-Math.PI/2;
    const spd=gentle?(0.2+Math.random()*0.6):(0.6+Math.random()*2.8);
    st.ashParticles.push({
      x:sp.x+(Math.random()-0.5)*sp.w*1.4,
      y:midY+(Math.random()-0.5)*ashH*0.35,
      vx:Math.cos(ang)*spd*0.55+(Math.random()-0.5)*0.8,
      vy:Math.sin(ang)*spd*0.35-Math.random()*1.2,
      life:1,
      decay:0.014+Math.random()*0.012,
      size:0.22+Math.random()*0.95,
      g:0.035+Math.random()*0.025,
      gray:138+Math.random()*28|0
    });
  }
  st.ash=0;
  st.shakeT=performance.now();
  if(!gentle){ sfxAsh(); vibe([6,12,6]); }
  return true;
}

function dropAsh(st,sp,gentle){ return spawnAshBurst(st,sp,gentle); }

function dropAshSegment(st,sp){
  const burnY=getBurnY(st,sp);
  const len=st.ash*sp.coatLen;
  if(len<0.006) return false;
  st.ashFalling.push({
    x:sp.x,
    y:burnY-len,
    len,
    w:sp.w*1.05,
    vy:0.4,
    sway:Math.random()*6.28,
    swaySpd:0.004+Math.random()*0.003,
    rot:0,
    vrot:(Math.random()-0.5)*0.002
  });
  st.ash=0;
  st.shakeT=performance.now();
  return true;
}

function updAshFalling(st,dt){
  const s=Math.min(dt/16,2.5);
  for(let i=st.ashFalling.length-1;i>=0;i--){
    const f=st.ashFalling[i];
    f.vy+=0.06*s;
    f.y+=f.vy*s;
    f.sway+=f.swaySpd*s;
    f.x+=Math.sin(f.sway)*0.05*s;
    f.rot+=f.vrot*s;
    if(f.y>BOWL_Y()+2){
      censerAsh.push({x:Math.min(Math.max((f.x-cx)/(censerW*0.5),-0.8),0.8),y:(Math.random()-0.5)*3,r:1+Math.random()*1.6,a:0.5+Math.random()*0.3});
      st.ashFalling.splice(i,1);
    }
  }
}

function updAshParticles(st,dt){
  const s=Math.min(dt/16,2.5);
  for(let i=st.ashParticles.length-1;i>=0;i--){
    const p=st.ashParticles[i];
    p.vy+=p.g*s;
    p.x+=p.vx*s;
    p.y+=p.vy*s;
    p.vx*=0.985;
    p.life-=p.decay*s;
    if(p.life<=0) st.ashParticles.splice(i,1);
  }
}

function hitStick(st,sp,px,py){
  if(st.done) return false;
  const hw=Math.max(sp.w*2.8,10);
  return Math.abs(px-sp.x)<hw&&py>=sp.top-8&&py<=sp.rimPoint+sp.insertDepth+6;
}

function tryDropAsh(st){
  if(!st||st.done||st.ash<0.006) return false;
  return dropAsh(st,calcParams(st.cfg));
}

function dropAshCurrent(){
  if(!sessionActive) return false;
  const cur=currentStick();
  if(cur&&tryDropAsh(cur)) return true;
  for(const st of sticks) if(tryDropAsh(st)) return true;
  return false;
}

function hasDroppableAsh(){
  return sessionActive&&sticks.some(st=>!st.done&&st.ash>0.004);
}

function drawBg(){
  const sc=SCENES[curScene];
  const bg=sc.img&&bgImgs[sc.img];
  if(bg){
    ctx.save();
    ctx.fillStyle='#000';
    ctx.fillRect(0,0,W,H);
    const s=Math.max(W/bg.width,H/bg.height);
    const iw=W/s,ih=H/s;
    ctx.drawImage(bg,(W-iw)/2,(H-ih)/2,iw,ih);
    ctx.fillStyle='rgba(0,0,0,0.38)';
    ctx.fillRect(0,0,W,H);
    ctx.restore();
    const fadeFrom=Math.max(topLimit,uiTop-80);
    const fg=ctx.createLinearGradient(0,fadeFrom,0,H);
    fg.addColorStop(0,'rgba(0,0,0,0)');
    fg.addColorStop(1,'rgba(0,0,0,0.82)');
    ctx.fillStyle=fg; ctx.fillRect(0,0,W,H);
  }else{
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,sc.bg[0]); g.addColorStop(1,sc.bg[1]);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  }
  const rg=ctx.createRadialGradient(cx,rimY-60,0,cx,rimY,H*0.5);
  rg.addColorStop(0,'rgba(255,180,80,0.03)'); rg.addColorStop(1,'transparent');
  ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);
}

function drawCenserAsh(){
  censerAsh.forEach(a=>{
    ctx.fillStyle=`rgba(120,115,108,${a.a})`;
    ctx.beginPath(); ctx.arc(cx+a.x,BOWL_Y()+a.y,a.r,0,Math.PI*2); ctx.fill();
  });
}
function drawCenserBack(){
  if(drawCenserImg('censer-back')) return;
  const bw=censerW, ry=rimY;
  ctx.beginPath(); ctx.ellipse(cx,ry,bw*0.4,bw*0.08,0,0,Math.PI*2);
  ctx.fillStyle='#4a3c2c'; ctx.fill();
  ctx.strokeStyle='rgba(240,200,120,0.22)'; ctx.lineWidth=1.2; ctx.stroke();
}
function drawCenserFront(){
  if(drawCenserImg('censer-front')) return;
  drawCenserBodyVector();
}
function drawCenserBodyVector(){
  const bw=censerW, ry=rimY;
  ctx.beginPath(); ctx.ellipse(cx,ry+40,bw*0.52,bw*0.1,0,0,Math.PI*2);
  ctx.fillStyle='#080604'; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx-bw*0.38,ry+2);
  ctx.bezierCurveTo(cx-bw*0.46,ry+18,cx-bw*0.34,ry+36,cx-bw*0.24,ry+40);
  ctx.lineTo(cx+bw*0.24,ry+40);
  ctx.bezierCurveTo(cx+bw*0.34,ry+36,cx+bw*0.46,ry+18,cx+bw*0.38,ry+2);
  ctx.lineTo(cx+bw*0.42,ry-2);
  ctx.bezierCurveTo(cx+bw*0.44,ry-6,cx+bw*0.2,ry-8,cx,ry-8);
  ctx.bezierCurveTo(cx-bw*0.2,ry-8,cx-bw*0.44,ry-6,cx-bw*0.42,ry-2);
  ctx.closePath();
  const cg=ctx.createLinearGradient(cx,ry-8,cx,ry+40);
  cg.addColorStop(0,'#6a5840');cg.addColorStop(0.4,'#3a3024');cg.addColorStop(1,'#1a1410');
  ctx.fillStyle=cg; ctx.fill();
  ctx.strokeStyle='rgba(220,180,100,0.12)'; ctx.lineWidth=1; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx,BOWL_Y(),bw*0.26,bw*0.04,0,0,Math.PI*2);
  ctx.fillStyle='rgba(55,50,45,0.7)'; ctx.fill();
  for(const side of [-1,1]){
    ctx.beginPath(); ctx.moveTo(cx+side*bw*0.38,ry+4);
    ctx.quadraticCurveTo(cx+side*bw*0.52,ry+10,cx+side*bw*0.48,ry+20);
    ctx.strokeStyle='rgba(180,140,80,0.25)'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.stroke();
  }
  for(const dx of [-0.22,0,0.22]){
    ctx.beginPath(); ctx.moveTo(cx+bw*dx,ry+40);
    ctx.lineTo(cx+bw*dx*0.85,ry+46);
    ctx.strokeStyle='#252018'; ctx.lineWidth=2.5; ctx.stroke();
  }
}
function drawCenserRimVector(){
  const bw=censerW, ry=rimY;
  ctx.beginPath(); ctx.ellipse(cx,ry,bw*0.4,bw*0.08,0,0,Math.PI*2);
  ctx.fillStyle='#4a3c2c'; ctx.fill();
  ctx.strokeStyle='rgba(240,200,120,0.22)'; ctx.lineWidth=1.2; ctx.stroke();
  sticks.forEach(st=>{
    const sp=calcParams(st.cfg);
    const hw=Math.max(sp.w*0.55,bw*0.028);
    ctx.beginPath(); ctx.ellipse(sp.x,ry+1,hw,hw*0.32,0,0,Math.PI*2);
    ctx.fillStyle='#1a1410'; ctx.fill();
  });
}

function drawStick(st){
  const sp=calcParams(st.cfg);
  const isCur=sticks[burnOrder[curStick]]===st;
  const sh=stickShake(st,sp);
  ctx.save();
  ctx.translate(sp.x+sh.dx,sp.rimPoint);
  ctx.rotate(sp.tilt+sh.dRot);
  ctx.translate(-sp.x-sh.dx,-sp.rimPoint);
  drawBambooRod(sp);
  if(st.done){
    const stubH=Math.max(sp.w*1.6,sp.coatLen*0.07);
    drawAshSeg(sp,sp.bambooTop-stubH,sp.bambooTop);
  }else{
    const burnY=getBurnY(st,sp);
    const ashLen=Math.min(st.ash*sp.coatLen,(burnY-sp.top)*0.6);
    if(burnY<sp.bambooTop-1) drawCoat(sp,burnY,sp.bambooTop);
    if(ashLen>0.004) drawAshSeg(sp,burnY-ashLen,burnY);
    if(isCur&&(st.lit||st.lighting>0)) drawEmber(st,sp,burnY);
  }
  ctx.restore();
  drawAshParticles(st);
  drawAshFalling(st);
}

function drawAshFalling(st){
  if(!st.ashFalling) return;
  for(const f of st.ashFalling){
    ctx.save();
    ctx.translate(f.x,f.y+f.len/2);
    ctx.rotate(f.rot);
    ctx.translate(-f.x,-(f.y+f.len/2));
    const t=f.y,b=f.y+f.len;
    ctx.beginPath(); ctx.moveTo(f.x-f.w/2,b);
    for(let i=0;i<=4;i++){const yy=b-(b-t)*i/4;ctx.lineTo(f.x-f.w/2+Math.sin(i*2+f.x)*f.w*0.05,yy)}
    ctx.lineTo(f.x,t);
    for(let i=4;i>=0;i--){const yy=b-(b-t)*i/4;ctx.lineTo(f.x+f.w/2-Math.sin(i*2.5)*f.w*0.04,yy)}
    ctx.closePath();
    ctx.fillStyle='#a09890'; ctx.fill();
    ctx.restore();
  }
}

function drawAshParticles(st){
  for(const p of st.ashParticles){
    const a=Math.max(0,p.life);
    if(a<0.02) continue;
    ctx.fillStyle=`rgba(${p.gray|0},${(p.gray-8)|0},${(p.gray-16)|0},${a*0.88})`;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.size*a,0,Math.PI*2);
    ctx.fill();
  }
}

function roundRect(x,y,w,h,r){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

function drawBambooRod(sp){
  const rodTop=sp.bambooTop, rodBot=sp.rimPoint+sp.insertDepth;
  if(rodBot-rodTop<2) return;
  const rw=sp.w*0.48;
  roundRect(sp.x-rw/2,rodTop,rw,rodBot-rodTop,rw*0.15);
  const bg=ctx.createLinearGradient(sp.x-rw/2,rodTop,sp.x+rw/2,rodTop);
  bg.addColorStop(0,'#7a6838');bg.addColorStop(0.3,'#9a8450');bg.addColorStop(0.55,'#8a7844');bg.addColorStop(1,'#6a5a30');
  ctx.fillStyle=bg; ctx.fill();
}

function drawCoat(sp,t,b){
  const g=ctx.createLinearGradient(sp.x-sp.w/2,t,sp.x+sp.w/2,t);
  g.addColorStop(0,'#4a3820');g.addColorStop(0.5,'#7a5830');g.addColorStop(1,'#4a3820');
  roundRect(sp.x-sp.w/2,t,sp.w,b-t,sp.w*0.12); ctx.fillStyle=g; ctx.fill();
}

function drawAshSeg(sp,t,b){
  const ah=b-t,w=sp.w*1.05;
  ctx.beginPath(); ctx.moveTo(sp.x-w/2,b);
  for(let i=0;i<=4;i++){const y=b-ah*i/4;ctx.lineTo(sp.x-w/2+Math.sin(i*2+sp.x)*w*0.05,y)}
  ctx.lineTo(sp.x,b-ah-0.5);
  for(let i=4;i>=0;i--){const y=b-ah*i/4;ctx.lineTo(sp.x+w/2-Math.sin(i*2.5)*w*0.04,y)}
  ctx.closePath();
  ctx.fillStyle='#a09890'; ctx.fill();
}

function drawEmberSparks(cx,y,w,t,seed,count,spread,intensity){
  for(let i=0;i<count;i++){
    const s=seed+i*2.399963;
    const flicker=0.35+Math.sin(t*0.022+s)*0.38+Math.sin(t*0.041+i*1.3)*0.12;
    const px=cx+Math.sin(s*1.9+t*0.003)*w*spread+Math.cos(s*0.7)*w*spread*0.35;
    const py=y-Math.abs(Math.sin(s*2.4+t*0.004))*w*spread*0.95;
    const sz=0.12+(Math.sin(t*0.03+s*2)*0.5+0.5)*0.38;
    const warm=155+(Math.sin(s*1.1)*45|0);
    ctx.fillStyle=`rgba(255,${warm},${25+(Math.sin(s*1.7)*30|0)},${flicker*intensity})`;
    ctx.fillRect(px,py,sz,sz*0.85);
  }
}

function drawEmber(st,sp,y){
  const t=performance.now(),p=st.lighting,w=sp.w;
  if(p>0&&p<1){
    if(lightMode==='match'&&p<0.2){
      drawEmberSparks(sp.x,y,w,t,st.cfg.slot,8+p*10|0,0.9+p,0.35+p*0.4);
    }
    drawEmberSparks(sp.x,y,w,t,st.cfg.slot+99,6+((p*14)|0),0.55+p*0.45,0.45+p*0.35);
    if(lightMode==='match'){
      const fh=3+p*5;
      ctx.fillStyle=`rgba(255,${100+p*50|0},15,${0.25+p*0.2})`;
      ctx.beginPath(); ctx.moveTo(sp.x,y); ctx.lineTo(sp.x-w*0.25,y-fh); ctx.lineTo(sp.x+w*0.12,y-fh*0.85); ctx.closePath(); ctx.fill();
    }else{
      const fh=4+p*4;
      ctx.fillStyle=`rgba(255,${130+p*40|0},25,${0.22+p*0.18})`;
      ctx.beginPath(); ctx.moveTo(sp.x,y); ctx.quadraticCurveTo(sp.x+w*0.35,y-fh*0.5,sp.x,y-fh); ctx.fill();
    }
  }else if(st.lit&&!st.done){
    const seed=st.cfg.slot*17;
    drawEmberSparks(sp.x,y,w,t,seed,22,0.32,0.9);
    drawEmberSparks(sp.x,y,w,t,seed+50,10,0.14,1);
    for(let i=0;i<10;i++){
      const s=seed*3.7+i*2.399963;
      const bx=sp.x+Math.sin(s*1.7+t*0.02)*w*0.3;
      const by=y-0.3+Math.sin(s*3.1+t*0.013)*w*0.18;
      ctx.fillStyle=`rgba(255,${190+Math.sin(s*2.3)*40|0},${80+Math.sin(s*1.3)*40|0},${0.4+Math.sin(t*0.04+s)*0.25})`;
      ctx.fillRect(bx,by,0.5,0.5);
    }
  }
}

canvas.addEventListener('pointerdown',e=>{
  if(!sessionActive) return;
  const r=canvas.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
  for(const st of sticks){
    const sp=calcParams(st.cfg);
    if(st.ash>0.004&&hitStick(st,sp,px,py)&&tryDropAsh(st)){ ui(); return; }
  }
});

/* 音效 / 震动 */
let actx=null;
function ensureAudio(){if(!actx)actx=new(window.AudioContext||window.webkitAudioContext)();return actx}
function vibe(ms){try{navigator.vibrate&&navigator.vibrate(ms)}catch(_){}}
function sfxIgnite(mode){
  if(mode==='lighter') sfxLighter(); else sfxMatch();
}
function sfxMatch(){
  const a=ensureAudio();
  const n=a.createBufferSource(),b=a.createBuffer(1,a.sampleRate*0.08,a.sampleRate);
  const d=b.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length)*0.5;
  n.buffer=b; const g=a.createGain(); g.gain.value=0.05;
  n.connect(g); g.connect(a.destination); n.start();
  const o=a.createOscillator(),g2=a.createGain();
  o.type='triangle'; o.frequency.setValueAtTime(220,a.currentTime);
  o.frequency.exponentialRampToValueAtTime(80,a.currentTime+0.12);
  g2.gain.setValueAtTime(0.05,a.currentTime); g2.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.15);
  o.connect(g2); g2.connect(a.destination); o.start(); o.stop(a.currentTime+0.15);
  vibe(10);
}
function sfxLighter(){
  const a=ensureAudio();
  const o=a.createOscillator(),g=a.createGain();
  o.type='square'; o.frequency.setValueAtTime(1200,a.currentTime); o.frequency.exponentialRampToValueAtTime(600,a.currentTime+0.04);
  g.gain.setValueAtTime(0.018,a.currentTime); g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.05);
  o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime+0.05);
  setTimeout(()=>{
    const o2=a.createOscillator(),g2=a.createGain();
    o2.type='sine'; o2.frequency.value=160;
    g2.gain.setValueAtTime(0.04,a.currentTime); g2.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.18);
    o2.connect(g2); g2.connect(a.destination); o2.start(); o2.stop(a.currentTime+0.18);
  },40);
  vibe(8);
}
function sfxLight(){sfxIgnite(lightMode)}
function sfxAsh(){
  const a=ensureAudio(),n=a.createBufferSource(),b=a.createBuffer(1,a.sampleRate*0.05,a.sampleRate);
  const d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*0.3;
  n.buffer=b; const g=a.createGain(); g.gain.value=0.04;
  n.connect(g);g.connect(a.destination); n.start();
}
function sfxDone(){
  const a=ensureAudio();
  [520,660].forEach((f,i)=>{
    const o=a.createOscillator(),g=a.createGain();
    o.frequency.value=f; g.gain.setValueAtTime(0.07,a.currentTime+i*0.25);
    g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+i*0.25+0.6);
    o.connect(g);g.connect(a.destination); o.start(a.currentTime+i*0.25); o.stop(a.currentTime+i*0.25+0.6);
  });
  vibe([20,40,20]);
}

/* 白噪音 */
let noiseNode=null,noiseGain=null;
function startNoise(){
  stopNoise();
  const sc=SCENES[curScene]; if(!sc.noise) return;
  const a=ensureAudio(),buf=a.createBuffer(1,a.sampleRate*2,a.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++){
    const w=Math.random()*2-1;
    d[i]=sc.noise==='rain'?w*0.8:(sc.noise==='wind'?w*0.4:w*0.2);
  }
  noiseNode=a.createBufferSource(); noiseNode.buffer=buf; noiseNode.loop=true;
  const filt=a.createBiquadFilter();
  filt.type=sc.noise==='rain'?'bandpass':(sc.noise==='wind'?'lowpass':'lowpass');
  filt.frequency.value=sc.noise==='rain'?800:400;
  noiseGain=a.createGain(); noiseGain.gain.value=sc.vol;
  noiseNode.connect(filt); filt.connect(noiseGain); noiseGain.connect(a.destination);
  noiseNode.start();
}
function stopNoise(){try{noiseNode&&noiseNode.stop();}catch(_){} noiseNode=null}

/* iOS 滚轮 */
function buildPicker(col,max,val){
  col.innerHTML=''; for(let i=0;i<=max;i++){
    const d=document.createElement('div'); d.className='p-item';
    d.textContent=String(i).padStart(2,'0'); d.dataset.v=i; col.appendChild(d);
  }
  col.scrollTop=val*ITEM_H; highlightCol(col);
}
function highlightCol(col){
  col.querySelectorAll('.p-item').forEach(el=>{
    el.classList.toggle('on',Math.abs(col.scrollTop/ITEM_H-+el.dataset.v)<0.5);
  });
}
const colH=$('colH'),colM=$('colM'),colS=$('colS');
buildPicker(colH,23,0); buildPicker(colM,59,5); buildPicker(colS,59,0);
[colH,colM,colS].forEach(c=>c.addEventListener('scroll',()=>highlightCol(c),{passive:true}));
function readPickerSec(){
  return Math.round(colH.scrollTop/ITEM_H)*3600+Math.round(colM.scrollTop/ITEM_H)*60+Math.round(colS.scrollTop/ITEM_H);
}
function setPickerSec(sec){
  colH.scrollTop=Math.floor(sec/3600)*ITEM_H;
  colM.scrollTop=Math.floor(sec%3600/60)*ITEM_H;
  colS.scrollTop=(sec%60)*ITEM_H;
  highlightCol(colH); highlightCol(colM); highlightCol(colS);
}

const clock=$('clock'),btnGo=$('btnGo'),btnAsh=$('btnAsh'),panel=$('panel');
const mainPresets=$('main-presets'),presetChips=$('presetChips'),toolbarMenus=$('toolbarMenus');
const lblScene=$('lblScene'),lblLight=$('lblLight');

function fmt(sec){
  sec=Math.max(0,Math.ceil(sec));
  const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
  const pad=v=>String(v).padStart(2,'0');
  if(totalSec>=3600) return pad(h)+':'+pad(m)+':'+pad(s);
  return pad(m)+':'+pad(s);
}

let lastClockSec=-1;
function syncClock(){
  const sec=Math.max(0,Math.ceil(remainSec));
  if(sec===lastClockSec) return;
  lastClockSec=sec;
  clock.textContent=fmt(remainSec);
  clock.classList.toggle('urgent',running&&remainSec<=30&&remainSec>0);
}

function ui(){
  lastClockSec=-1;
  lastAshReady=null; lastAshShow=null;
  syncClock();
  btnGo.classList.toggle('run',running);
  const lightingNow=sessionActive&&phase==='light';
  btnGo.classList.toggle('busy',lightingNow);
  btnGo.textContent=running?'⏸':(sessionActive&&phase==='burn'&&!running?'▶':'点香');
  const busy=sessionActive;
  presetChips.classList.toggle('hide',busy);
  toolbarMenus.classList.toggle('hide',busy);
  canvas.style.pointerEvents=sessionActive?'auto':'none';
  syncAshBtn();
}

let lastAshReady=null,lastAshShow=null;
function syncAshBtn(){
  const show=sessionActive;
  const ashReady=hasDroppableAsh();
  if(show===lastAshShow&&ashReady===lastAshReady) return;
  lastAshShow=show;
  lastAshReady=ashReady;
  btnAsh.classList.toggle('show',show);
  btnAsh.disabled=!ashReady;
  btnAsh.classList.toggle('ash-ready',ashReady);
}

function applyTime(sec,sync=true){
  totalSec=Math.max(1,sec); remainSec=totalSec; censerAsh=[];
  document.documentElement.style.setProperty('--clock-w',totalSec>=3600?'8.5ch':'5.5ch');
  initSticks(); if(sync) setPickerSec(totalSec);
  document.querySelectorAll('#presetChips .chip').forEach(c=>c.classList.toggle('on',+c.dataset.s===totalSec));
  curHint=pick(COPY.idle); hintTimer=0;
  lastClockSec=-1;
  syncClock();
}

function ignite(){
  if(sessionActive) return;
  if(remainSec<=0) applyTime(readPickerSec()||300);
  ensureAudio();
  resize();
  recalcTimeShares();
  sticks.forEach(st=>{st.lighting=0;st.lit=false;st.ignited=false;st.progress=0;st.done=false;
    st.ash=0;st.ashParticles=[];st.shakeT=0;st.streams=null;st.smokeEmit=0;st.ashFalling=[]});
  curStick=0; stickBurnElapsed=0;
  frameLastT=performance.now();
  timerLastT=0;
  sessionActive=true; phase='light'; running=false; timerStarted=false;
  sticks[burnOrder[0]].lighting=0.001;
  sfxIgnite(lightMode);
  closePanel(); curHint=pick(COPY.light[lightMode]); hintTimer=0; ui();
}

function pause(){running=false; stopNoise(); timerLastT=0; curHint=pick(COPY.pause); hintTimer=0; ui()}
function resetAll(){
  sessionActive=false; running=false; phase='idle'; curStick=0; stickBurnElapsed=0; timerStarted=false;
  timerLastT=0; frameLastT=0;
  stopNoise(); censerAsh=[]; applyTime(readPickerSec()||totalSec); ui();
}

function openPanel(){if(!sessionActive)panel.classList.add('open')}
function closePanel(){panel.classList.remove('open')}

function closeMenus(){document.querySelectorAll('.menu-wrap').forEach(w=>w.classList.remove('open'))}

function setLightMode(m){
  lightMode=m;
  localStorage.setItem(storeKey('lightMode'),m);
  document.querySelectorAll('.lm').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  lblLight.textContent=LIGHT_NAMES[m];
  closeMenus();
}
function setScene(k){
  curScene=k;
  document.querySelectorAll('.sc').forEach(s=>s.classList.toggle('on',s.dataset.k===k));
  document.body.style.background=SCENES[k].bg[0];
  lblScene.textContent=SCENE_NAMES[k];
  if(running) startNoise(); else stopNoise();
  closeMenus();
}

$('btnPanel').onclick=openPanel;
$('btnGo').onclick=()=>{
  if(running) pause();
  else if(!sessionActive) ignite();
  else if(phase==='burn'){ running=true; startNoise(); timerLastT=performance.now(); frameLastT=performance.now(); ui(); }
};
$('btnReset').onclick=resetAll;
$('btnAsh').onclick=()=>{ if(dropAshCurrent()) ui(); };
$('panel-bg').onclick=closePanel;
$('btnCancel').onclick=closePanel;
$('btnApply').onclick=()=>{applyTime(readPickerSec()||300);closePanel()};
document.querySelectorAll('#presetChips .chip').forEach(c=>c.onclick=()=>{if(!sessionActive)applyTime(+c.dataset.s)});
document.querySelectorAll('.menu-btn').forEach(btn=>{
  btn.onclick=e=>{
    e.stopPropagation();
    if(sessionActive) return;
    const wrap=btn.closest('.menu-wrap');
    const open=wrap.classList.contains('open');
    closeMenus();
    if(!open) wrap.classList.add('open');
  };
});
document.querySelectorAll('.menu-pop').forEach(p=>p.onclick=e=>e.stopPropagation());
document.addEventListener('click',closeMenus);
document.querySelectorAll('.sc').forEach(s=>s.onclick=()=>{if(!running&&!sessionActive)setScene(s.dataset.k)});
document.querySelectorAll('.lm').forEach(b=>b.onclick=()=>{if(!sessionActive)setLightMode(b.dataset.m)});

function stickTipsTop(){
  if(!sticks.length) return rimY-stickBaseLen;
  let t=rimY;
  sticks.forEach(st=>{ t=Math.min(t,calcParams(st.cfg).top); });
  return t;
}
function drawHintText(){
  if(!curHint) return;
  const y=Math.max(topLimit+16,stickTipsTop()-28);
  ctx.save();
  ctx.textAlign='center'; ctx.textBaseline='top';
  const fs=Math.max(12,Math.min(W*0.04,15));
  ctx.font=`${fs}px "PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.shadowColor='rgba(0,0,0,0.55)'; ctx.shadowBlur=6;
  ctx.fillStyle='rgba(255,244,228,0.72)';
  ctx.fillText(curHint,cx,y);
  ctx.restore();
}

function loop(now){
  requestAnimationFrame(loop);
  const rawDt=frameLastT?now-frameLastT:0;
  const dt=Math.min(Math.max(rawDt,0),100);

  if(sessionActive&&phase==='light'){
    const st=currentStick();
    if(st){
      sticks.forEach(s=>{ if(s!==st) s.lighting=0; });
      if(st.lighting>0&&st.lighting<1){
        st.lighting+=dt*(lightMode==='lighter'?0.0013:0.0021);
        if(st.lighting>=1){
          st.lighting=0; st.ignited=true; st.lit=true;
          phase='burn'; running=true; stickBurnElapsed=0;
          ensureStreams(st); st.smokeEmit=0;
          timerStarted=true; timerLastT=now; frameLastT=now;
          if(curStick===0) startNoise();
          ui();
        }
      }
    }
  }

  if(sessionActive&&phase==='burn'&&running){
    const st=currentStick();
    if(st&&!st.done){
      stickBurnElapsed+=dt/1000;
      st.progress=Math.min(1,stickBurnElapsed/st.timeShare);
      st.ash+=Math.min(dt/1000/st.timeShare,0.02);
      if(st.ash>=ASH_AUTO){ const sp=calcParams(st.cfg); dropAshSegment(st,sp); }
      syncAshBtn();
      if(st.progress>=1){
        const sp=calcParams(st.cfg);
        if(st.ash>0.004) dropAshSegment(st,sp);
        st.done=true; st.lit=false; st.streams=null;
        curStick++; stickBurnElapsed=0; timerLastT=now;
        if(curStick<burnOrder.length){
          phase='light'; running=false;
          sticks[burnOrder[curStick]].lighting=0.001;
          sfxIgnite(lightMode); curHint=pick(COPY.light[lightMode]); hintTimer=0;
          ui();
        }else{
          sessionActive=false; running=false; phase='idle';
          remainSec=0; stopNoise(); sfxDone(); curHint=pick(COPY.done);
          ui();
        }
      }
    }
    if(timerStarted){
      const timerDt=Math.min(Math.max(timerLastT?now-timerLastT:0,0),1000);
      timerLastT=now;
      if(timerDt>0){
        remainSec-=timerDt/1000;
        if(remainSec<=0){
          remainSec=0; sessionActive=false; running=false; phase='idle'; timerStarted=false;
          sticks.forEach(st=>{st.done=true;st.lit=false;st.lighting=0;st.streams=null});
          stopNoise(); sfxDone(); curHint=pick(COPY.done);
          ui();
        }else syncClock();
      }
    }
  }

  if(sessionActive) sticks.forEach(st=>updAshParticles(st,dt));
  if(sessionActive) sticks.forEach(st=>updAshFalling(st,dt));

  hintTimer+=dt;
  if(hintTimer>=4000){ hintTimer=0; curHint=sceneText(); }

  const burning=currentStick();
  if(burning&&burning.lit&&!burning.done&&phase==='burn') updSmoke(burning,dt);

  drawBg(); drawCenserBack(); drawCenserAsh();
  const mid=Math.floor(sticks.length/2);
  [...sticks].sort((a,b)=>Math.abs(a.cfg.slot-mid)-Math.abs(b.cfg.slot-mid)).forEach(drawStick);
  drawCenserFront();
  if(burning&&burning.lit&&!burning.done) drawStickSmoke(burning);
  drawHintText();
  frameLastT=now;
}

setLightMode(lightMode);
setScene('silent'); applyTime(300); ui(); requestAnimationFrame(loop);
