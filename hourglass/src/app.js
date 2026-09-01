'use strict';

function storeKey(k){return ((window.PLATFORM&&PLATFORM.storagePrefix)||'hourglass_')+k}

function $(id){return document.getElementById(id)}

const ITEM_H=40;
let totalSec=300, remainSec=300, running=false, lastT=0;
let sessionActive=false, phase='idle', curStick=0, timerStarted=false;
let burnOrder=[], stickBurnElapsed=0;
let censerAsh=[];

const SCENE_NAMES={night:'夜雨',bamboo:'竹林',temple:'古寺',silent:'默照'};
const LIGHT_NAMES={match:'火柴',lighter:'打火机'};
const SCENES={
  night:{bg:['#0a0c14','#060810'],noise:'rain',vol:0.06},
  bamboo:{bg:['#0a100c','#060a08'],noise:'wind',vol:0.04},
  temple:{bg:['#100c08','#080604'],noise:'hum',vol:0.03},
  silent:{bg:['#080706','#040302'],noise:null,vol:0},
};
let curScene='night';
let lightMode=localStorage.getItem(storeKey('lightMode'))||'match';

const SZ={s:{len:.28,w:.62},m:{len:.46,w:.85},l:{len:.62,w:1.05}};

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
  ash:['灰尖已长，可轻触落灰'],
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
let W,H,cx,baseY,stickBaseLen,stickBaseW,dpr,censerW,rimY;

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
  const toolbarEl=document.getElementById('toolbar');
  let uiTop=H*0.58;
  if(bottom){
    const br=bottom.getBoundingClientRect();
    if(br.height>0&&br.top>0&&br.top<=H) uiTop=br.top;
    lastUiH=br.height|0;
  }
  let topLimit=40;
  if(toolbarEl&&!toolbarEl.classList.contains('hide')){
    topLimit=Math.max(topLimit,toolbarEl.getBoundingClientRect().bottom+10);
  }

  const censerBelow=48,margin=12;
  rimY=Math.min(H*0.665,uiTop-censerBelow-margin);
  rimY=Math.max(rimY,topLimit+72);

  stickBaseLen=Math.min(H*0.34,W*0.44,rimY-topLimit-16);
  stickBaseLen=Math.max(stickBaseLen,H*0.11);
  stickBaseW=stickBaseLen*0.013;
  censerW=Math.min(W*0.42,stickBaseW*22);
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
      ashPieces:[],smokeEmit:0,smokePhase:Math.random()*6.28,timeShare:0});
  });
  const totalCoat=sticks.reduce((s,st)=>s+calcParams(st.cfg).coatLen,0);
  sticks.forEach(st=>{ st.timeShare=totalSec*(calcParams(st.cfg).coatLen/totalCoat); });
}

const ASH_LIMIT=0.12;
const ASH_AUTO=0.11;
const BOWL_Y=()=>rimY+10;
const INSERT_DEPTH=()=>stickBaseLen*0.04;
const BAMBOO_LEN=()=>stickBaseLen*0.055;

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
    x:tip.x+(Math.random()-0.5)*0.8,
    y:tip.y+(Math.random()-0.5)*0.4,
    vx:(Math.random()-0.5)*0.01,
    vy:-0.007-Math.random()*0.003,
    life:1,
    phase:Math.random()*6.28
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
function updSmoke(st,dt){
  if(!st.lit||st.done||phase!=='burn') return;
  ensureStreams(st);
  st.smokeEmit+=dt;
  while(st.smokeEmit>=48){
    st.smokeEmit-=48;
    st.streams.forEach(s=>emitSmoke(st,s));
  }
  const tc=performance.now()*0.001;
  st.streams.forEach(s=>{
    for(let i=s.particles.length-1;i>=0;i--){
      const p=s.particles[i];
      p.x+=(p.vx+Math.sin(tc*0.75+p.phase)*0.012)*dt;
      p.y+=p.vy*dt;
      p.life-=dt*0.000065;
      if(p.life<=0) s.particles.splice(i,1);
    }
  });
}
function drawSmoke(st){
  if(!st.streams) return;
  ctx.save();
  ctx.globalCompositeOperation='screen';
  ctx.lineCap='round';
  for(const s of st.streams){
    const ps=s.particles,n=ps.length;
    for(let i=0;i<n;i++){
      const p=ps[i],a=p.life*0.038;
      if(a<0.002) continue;
      if(i>0){
        const q=ps[i-1];
        if(Math.hypot(p.x-q.x,p.y-q.y)>16) continue;
        ctx.beginPath();
        ctx.moveTo(q.x,q.y);
        ctx.lineTo(p.x,p.y);
        ctx.filter='blur(3px)';
        ctx.strokeStyle=`rgba(248,245,240,${a*0.45})`;
        ctx.lineWidth=0.8+p.life*0.6;
        ctx.stroke();
        ctx.filter='blur(5px)';
        ctx.strokeStyle=`rgba(228,224,218,${a*0.22})`;
        ctx.lineWidth=1.6+p.life*0.9;
        ctx.stroke();
      }
    }
  }
  ctx.filter='none';
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

function mergeAshToBowl(a){
  censerAsh.push({
    x:a.x-cx+(Math.random()-0.5)*4,
    y:(Math.random()-0.5)*2,
    r:1.5+Math.random()*2.5,
    a:0.45+Math.random()*0.25
  });
  if(censerAsh.length>50) censerAsh.shift();
}

function dropAsh(st,sp){
  if(st.ash<0.006) return;
  const burnY=getBurnY(st,sp);
  st.ashPieces.push({
    x:sp.x,y:burnY+st.ash*sp.coatLen*0.45,
    len:st.ash*sp.coatLen,w:sp.w*1.1,
    vy:0,vx:(Math.random()-0.5)*0.3,rot:0,a:1,landed:false,settle:0
  });
  st.ash=0;
  sfxAsh(); vibe(8);
}

function updAshPieces(st){
  const floor=BOWL_Y();
  for(let i=st.ashPieces.length-1;i>=0;i--){
    const a=st.ashPieces[i];
    if(a.landed){
      a.settle+=16;
      a.y=floor-a.len*0.15+Math.sin(a.settle*0.08)*0.4;
      if(a.settle>400){
        mergeAshToBowl(a);
        st.ashPieces.splice(i,1);
      }
      continue;
    }
    a.vy+=0.1; a.y+=a.vy; a.x+=a.vx;
    if(a.y>=floor-a.len*0.2){
      a.y=floor-a.len*0.15; a.vy=0; a.vx=0; a.landed=true; a.settle=0;
    }
  }
}

function drawBg(){
  const sc=SCENES[curScene];
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,sc.bg[0]); g.addColorStop(1,sc.bg[1]);
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  const rg=ctx.createRadialGradient(cx,rimY-60,0,cx,rimY,H*0.5);
  rg.addColorStop(0,'rgba(255,180,80,0.03)'); rg.addColorStop(1,'transparent');
  ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);
}

function drawCenserBody(){
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
  censerAsh.forEach(a=>{
    ctx.fillStyle=`rgba(120,115,108,${a.a})`;
    ctx.beginPath(); ctx.arc(cx+a.x,BOWL_Y()+a.y,a.r,0,Math.PI*2); ctx.fill();
  });
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
function drawCenserRim(){
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
function drawCenser(){drawCenserBody()}

function drawStick(st){
  const sp=calcParams(st.cfg);
  const isCur=sticks[burnOrder[curStick]]===st;
  ctx.save();
  ctx.translate(sp.x,sp.rimPoint); ctx.rotate(sp.tilt); ctx.translate(-sp.x,-sp.rimPoint);
  drawBambooRod(sp);
  if(st.done){
    const stubH=Math.max(sp.w*1.6,sp.coatLen*0.07);
    drawAshSeg(sp,sp.bambooTop-stubH,sp.bambooTop);
  }else{
    const burnY=getBurnY(st,sp), ashBot=burnY+st.ash*sp.coatLen;
    if(ashBot<sp.bambooTop-1) drawCoat(sp,ashBot,sp.bambooTop);
    if(st.ash>0.004) drawAshSeg(sp,burnY,ashBot);
    if(isCur&&(st.lit||st.lighting>0)) drawEmber(st,sp,burnY);
  }
  drawAshFall(st);
  ctx.restore();
}

function drawBambooRod(sp){
  const rodTop=sp.bambooTop, rodBot=sp.rimPoint;
  if(rodBot-rodTop<2) return;
  const rw=sp.w*0.48;
  roundRect(sp.x-rw/2,rodTop,rw,rodBot-rodTop,rw*0.15);
  const bg=ctx.createLinearGradient(sp.x-rw/2,rodTop,sp.x+rw/2,rodTop);
  bg.addColorStop(0,'#7a6838');bg.addColorStop(0.3,'#9a8450');bg.addColorStop(0.55,'#8a7844');bg.addColorStop(1,'#6a5a30');
  ctx.fillStyle=bg; ctx.fill();
  for(let i=0;i<3;i++){
    const ly=rodTop+(rodBot-rodTop)*(0.25+i*0.22);
    ctx.strokeStyle='rgba(60,50,25,0.2)'; ctx.lineWidth=0.4;
    ctx.beginPath(); ctx.moveTo(sp.x-rw*0.4,ly); ctx.lineTo(sp.x+rw*0.4,ly); ctx.stroke();
  }
  const bandY=sp.rimPoint-sp.w*0.55;
  if(bandY>rodTop+1){
    roundRect(sp.x-rw*0.38,bandY,rw*0.76,sp.w*0.45,0.5);
    ctx.fillStyle='#a82820'; ctx.fill();
  }
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

function drawEmber(st,sp,y){
  const t=performance.now(),p=st.lighting;
  if(p>0&&p<1){
    if(lightMode==='match'){
      if(p<0.2){
        const flash=(1-p/0.2)*0.5;
        ctx.fillStyle=`rgba(255,200,120,${flash})`;
        ctx.fillRect(sp.x-sp.w*4,y-sp.w*6,sp.w*8,sp.w*8);
      }
      const fh=3+p*5;
      const gr=ctx.createRadialGradient(sp.x,y,0,sp.x,y-fh*0.2,sp.w*3);
      gr.addColorStop(0,`rgba(255,150,40,${0.25+p*0.35})`);
      gr.addColorStop(1,'transparent');
      ctx.fillStyle=gr;
      ctx.beginPath(); ctx.arc(sp.x,y-fh*0.15,sp.w*3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,${100+p*50|0},15,${0.35+p*0.25})`;
      ctx.beginPath(); ctx.moveTo(sp.x,y); ctx.lineTo(sp.x-sp.w*0.3,y-fh); ctx.lineTo(sp.x+sp.w*0.15,y-fh*0.85); ctx.closePath(); ctx.fill();
    }else{
      const fh=4+p*4;
      const gr=ctx.createRadialGradient(sp.x,y,0,sp.x,y-fh*0.3,sp.w*2.8);
      gr.addColorStop(0,`rgba(180,220,255,${0.15+p*0.2})`);
      gr.addColorStop(0.35,`rgba(255,140,30,${0.2+p*0.3})`);
      gr.addColorStop(1,'transparent');
      ctx.fillStyle=gr;
      ctx.beginPath(); ctx.arc(sp.x,y-fh*0.2,sp.w*2.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,${130+p*40|0},25,${0.3+p*0.2})`;
      ctx.beginPath(); ctx.moveTo(sp.x,y); ctx.quadraticCurveTo(sp.x+sp.w*0.4,y-fh*0.5,sp.x,y-fh); ctx.fill();
    }
    for(let i=0;i<5;i++){
      const px=sp.x+(Math.sin(t*0.02+i*2.1)-0.5)*sp.w;
      const py=y-1-Math.abs(Math.sin(t*0.015+i))*sp.w*(0.4+p);
      ctx.fillStyle=`rgba(255,200,80,${0.2+p*0.25})`;
      ctx.beginPath(); ctx.arc(px,py,0.4+Math.sin(t*0.03+i*1.7)*0.25+0.25,0,Math.PI*2); ctx.fill();
    }
  } else if(st.lit&&!st.done){
    const pulse=0.88+Math.sin(t*0.006)*0.07;
    const gr=ctx.createRadialGradient(sp.x,y,0,sp.x,y,sp.w*2.8);
    gr.addColorStop(0,'rgba(255,110,35,0.42)');
    gr.addColorStop(0.35,'rgba(255,70,15,0.14)');
    gr.addColorStop(1,'transparent');
    ctx.fillStyle=gr;
    ctx.beginPath(); ctx.arc(sp.x,y,sp.w*2.8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#b83018';
    ctx.beginPath(); ctx.arc(sp.x,y,sp.w*0.24*pulse,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ee9928';
    ctx.beginPath(); ctx.arc(sp.x,y,sp.w*0.1,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff4c8';
    ctx.beginPath(); ctx.arc(sp.x,y-0.5,sp.w*0.04,0,Math.PI*2); ctx.fill();
    for(let i=0;i<14;i++){
      const seed=st.cfg.slot*17+i*2.618;
      const flicker=0.35+Math.sin(t*0.018+seed)*0.28;
      const r=sp.w*(0.12+Math.sin(t*0.012+seed*1.3)*0.1);
      const ang=t*0.0025+seed;
      const px=sp.x+Math.cos(ang)*r;
      const py=y-0.5-Math.abs(Math.sin(t*0.014+seed))*sp.w*0.55;
      const sz=0.35+Math.sin(t*0.022+seed*2)*0.25;
      ctx.fillStyle=`rgba(255,${170+(Math.sin(seed)*40|0)},${50+(Math.sin(seed*2)*35|0)},${flicker})`;
      ctx.beginPath(); ctx.arc(px,py,sz,0,Math.PI*2); ctx.fill();
    }
  }
}

function drawAshFall(st){
  for(const a of st.ashPieces){
    ctx.save(); ctx.translate(a.x,a.y); ctx.globalAlpha=Math.min(1,a.a);
    ctx.fillStyle='#989088'; ctx.fillRect(-a.w/2,-a.len*0.35,a.w,a.len*0.5);
    ctx.restore();
  }
}

function roundRect(x,y,w,h,r){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

canvas.addEventListener('pointerdown',e=>{
  if(!running) return;
  const r=canvas.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
  sticks.forEach(st=>{
    if(st.done) return;
    const sp=calcParams(st.cfg);
    const burnY=getBurnY(st,sp),ashBot=burnY+st.ash*sp.coatLen;
    if(st.ash>0.004&&Math.abs(px-sp.x)<sp.w*4&&py>burnY-5&&py<ashBot+5) dropAsh(st,sp);
  });
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

const clock=$('clock'),btnGo=$('btnGo'),panel=$('panel');
const mainPresets=$('main-presets'),toolbar=$('toolbar');
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
  syncClock();
  btnGo.classList.toggle('run',running);
  const lightingNow=sessionActive&&phase==='light';
  btnGo.classList.toggle('busy',lightingNow);
  btnGo.textContent=running?'⏸':(sessionActive&&phase==='burn'&&!running?'▶':'点香');
  const busy=sessionActive;
  mainPresets.classList.toggle('hide',busy);
  toolbar.classList.toggle('hide',busy);
  canvas.style.pointerEvents=running&&sessionActive?'auto':'none';
}

function applyTime(sec,sync=true){
  totalSec=Math.max(1,sec); remainSec=totalSec; censerAsh=[];
  document.documentElement.style.setProperty('--clock-w',totalSec>=3600?'8.5ch':'5.5ch');
  initSticks(); if(sync) setPickerSec(totalSec);
  document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',+c.dataset.s===totalSec));
  curHint=pick(COPY.idle); hintTimer=0;
  lastClockSec=-1;
  syncClock();
}

function ignite(){
  if(sessionActive) return;
  if(remainSec<=0) applyTime(readPickerSec()||300);
  ensureAudio();
  sticks.forEach(st=>{st.lighting=0;st.lit=false;st.ignited=false;st.progress=0;st.done=false;
    st.ash=0;st.ashPieces=[];st.streams=null;st.smokeEmit=0});
  curStick=0; stickBurnElapsed=0; lastT=performance.now();
  sessionActive=true; phase='light'; running=false; timerStarted=false;
  sticks[burnOrder[0]].lighting=0.001;
  sfxIgnite(lightMode);
  closePanel(); curHint=pick(COPY.light[lightMode]); hintTimer=0; ui();
}

function pause(){running=false; stopNoise(); curHint=pick(COPY.pause); hintTimer=0; ui()}
function resetAll(){
  sessionActive=false; running=false; phase='idle'; curStick=0; stickBurnElapsed=0; timerStarted=false;
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
  else if(phase==='burn'){ running=true; startNoise(); lastT=performance.now(); ui(); }
};
$('btnReset').onclick=resetAll;
$('panel-bg').onclick=closePanel;
$('btnCancel').onclick=closePanel;
$('btnApply').onclick=()=>{applyTime(readPickerSec()||300);closePanel()};
document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{if(!sessionActive)applyTime(+c.dataset.s)});
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

function loop(now){
  requestAnimationFrame(loop);
  const dt=now-(lastT||now);

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
          timerStarted=true; lastT=now; if(curStick===0) startNoise();
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
      st.ash+=(dt/1000/st.timeShare)*0.16;
      if(st.ash>=ASH_AUTO) dropAsh(st,calcParams(st.cfg));
      if(st.progress>=1){
        const sp=calcParams(st.cfg);
        if(st.ash>0.004) dropAsh(st,sp);
        st.done=true; st.lit=false; st.streams=null;
        curStick++; stickBurnElapsed=0;
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
      remainSec-=dt/1000;
      if(remainSec<=0){
        remainSec=0; sessionActive=false; running=false; phase='idle'; timerStarted=false;
        sticks.forEach(st=>{st.done=true;st.lit=false;st.lighting=0;st.streams=null});
        stopNoise(); sfxDone(); curHint=pick(COPY.done);
        ui();
      }else syncClock();
    }else syncClock();
  }

  if(sessionActive) sticks.forEach(updAshPieces);
  const burning=currentStick();
  if(burning&&burning.lit&&!burning.done&&phase==='burn') updSmoke(burning,dt);

  drawBg(); drawCenserBody();
  const mid=Math.floor(sticks.length/2);
  [...sticks].sort((a,b)=>Math.abs(a.cfg.slot-mid)-Math.abs(b.cfg.slot-mid)).forEach(drawStick);
  drawCenserRim();
  if(burning&&burning.lit&&!burning.done) drawStickSmoke(burning);
  lastT=now;
}

setLightMode(lightMode);
setScene('night'); applyTime(300); ui(); requestAnimationFrame(loop);
