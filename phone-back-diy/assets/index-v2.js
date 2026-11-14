const It=["😊","😍","🥳","😎","🤩","😜","😇","🥰","🥹","🤭","🫡","🫠","😴","🤤","😵‍💫","🤠","👾","🤖","👻","👽","🎃","😈","💀","⭐","🌟","✨","💫","⚡","💥","🔥","💖","💗","💘","💝","💞","💕","💓","🧡","💛","💚","💙","💜","🖤","🤍","🤎","🌸","🌺","🌻","🌷","🌹","🪷","🌼","🍀","🌿","🍃","🌈","☀️","🌙","⭐","☁️","❄️","🫧","🎀","🎁","🎈","🎉","🎊","🎂","🧁","🍰","🍩","🍪","🍫","🍬","🍭","🍦","🧋","☕","🍕","🍔","🍟","🌮","🍣","🍙","🥟","🍎","🍊","🍋","🍇","🍓","🍒","🍑","🍉","🍌","🥝","🥑","🐰","🐻","🐱","🐶","🐼","🦊","🐯","🐮","🐷","🐸","🐵","🦄","🐝","🦋","🐞","🐢","🐙","🐳","🐬","🐟","🦈","👀","💋","💅","👑","🎩","👓","🕶️","💍","💎","🎧","🎮","📷","📱","🪩","🪄","🔮","🧸","🪀","🪁"],_=[];
function m(e){
  _.push(e)
}function B(e,t,l,n){
  e.beginPath();
  for(let i=0;
  i<n*2;
  i++){
    const o=i%2===0?t:l,a=-Math.PI/2+i*Math.PI/n,r=Math.cos(a)*o,d=Math.sin(a)*o;
    i===0?e.moveTo(r,d):e.lineTo(r,d)
  }e.closePath()
}function ie(e,t){
  const l=t*.36;
  e.beginPath(),e.moveTo(0,l*.9),e.bezierCurveTo(-l*1.15,l*.15,-l*.7,-l*.95,0,-l*.28),e.bezierCurveTo(l*.7,-l*.95,l*1.15,l*.15,0,l*.9),e.closePath()
}function F(e,t,l,n,i){
  e.save(),e.translate(t*.018,t*.028),l(),e.fillStyle="rgba(40,28,20,.2)",e.fill(),e.restore();
  e.save(),e.scale(1.07,1.07),l(),e.fillStyle="#fff",e.fill(),e.restore();
  l(),e.fillStyle=n,e.fill();
  e.save(),l(),e.clip();
  const g=e.createLinearGradient(-t*.35,-t*.4,t*.25,t*.3);
  g.addColorStop(0,"rgba(255,255,255,.55)"),g.addColorStop(.35,"rgba(255,255,255,.12)"),g.addColorStop(1,"rgba(255,255,255,0)");
  e.fillStyle=g,e.fillRect(-t,-t,t*2,t*2);
  e.fillStyle="rgba(255,255,255,.38)",e.beginPath(),e.ellipse(-t*.12,-t*.16,t*.16,t*.1,-.4,0,Math.PI*2),e.fill();
  e.restore();
  i&&(l(),e.lineWidth=Math.max(1.6,t*.024),e.strokeStyle="rgba(44,36,28,.72)",e.lineJoin="round",e.stroke())
}function D(e,t,l,n,i){
  e.save(),e.translate(t*.02,t*.03),l(),e.fillStyle="rgba(40,28,20,.22)",e.fill(),e.restore();
  e.save(),e.scale(1.08,1.08),l(),e.fillStyle="#fff",e.fill(),e.restore(),l();
  const o=e.createLinearGradient(-t*.42,-t*.42,t*.48,t*.48);
  o.addColorStop(0,"#ffffff"),o.addColorStop(.22,n),o.addColorStop(.7,i),o.addColorStop(1,"#ffffff"),e.fillStyle=o,e.fill();
  e.save(),l(),e.clip();
  e.fillStyle="rgba(255,255,255,.6)",e.beginPath(),e.ellipse(-t*.1,-t*.14,t*.14,t*.06,-.55,0,Math.PI*2),e.fill();
  const h=e.createRadialGradient(t*.12,t*.1,0,t*.12,t*.1,t*.35);
  h.addColorStop(0,"rgba(255,255,255,.25)"),h.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=h,e.fillRect(-t,-t,t*2,t*2);
  e.restore();
  l(),e.lineWidth=Math.max(1.4,t*.02),e.strokeStyle="rgba(44,36,28,.55)",e.lineJoin="round",e.stroke()
}function lt(e,t,l,n,i){
  const o=t*.22,a=(r,d)=>{
    for(let f=0;
    f<l;
    f++)e.save(),e.rotate(f/l*Math.PI*2),e.beginPath(),e.ellipse(o*.85*r,0,o*.72*r,o*.4*r,0,0,Math.PI*2),e.fillStyle=d,e.fill(),e.restore()
  };
  e.save(),e.rotate(-Math.PI/2),a(1.12,"#fff"),a(1,n),e.restore(),e.beginPath(),e.arc(0,0,o*.46,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.beginPath(),e.arc(0,0,o*.34,0,Math.PI*2),e.fillStyle=i,e.fill()
}function ft(e,t){
  e.beginPath(),e.moveTo(0,t*.36),e.bezierCurveTo(-t*.42,t*.05,-t*.28,-t*.36,0,-t*.38),e.bezierCurveTo(t*.28,-t*.36,t*.42,t*.05,0,t*.36),e.closePath()
}const Ft=[["heart-coral","珊瑚爱心","#E25B45"],["heart-pink","粉色爱心","#F4A4B8"],["heart-lilac","淡紫爱心","#CDB6E8"],["heart-red","正红爱心","#E23B4A"]];
for(let e=0;
e<Ft.length;
e++){
  const t=Ft[e];
  m({
    id:t[0],name:t[1],group:"cute",anchor:null,draw:(l,n)=>F(l,n,()=>ie(l,n),t[2],!0)
  })
}const At=[["daisy-white","白雏菊","#FFFDF8","#F0C14A"],["daisy-pink","粉雏菊","#F7B6C8","#F08A3E"],["daisy-sun","向日小花","#F6D56A","#E25B45"],["daisy-lilac","紫雏菊","#E3D2F5","#F4A4B8"]];
for(let e=0;
e<At.length;
e++){
  const t=At[e];
  m({
    id:t[0],name:t[1],group:"cute",anchor:null,draw:(l,n)=>lt(l,n,8,t[2],t[3])
  })
}const Tt=[["star-gold","金色星星","#F0C14A"],["star-coral","珊瑚星星","#E25B45"],["star-mint","薄荷星星","#7EBEA6"]];
for(let e=0;
e<Tt.length;
e++){
  const t=Tt[e];
  m({
    id:t[0],name:t[1],group:"cute",anchor:null,draw:(l,n)=>F(l,n,()=>B(l,n*.4,n*.17,5),t[2],!0)
  })
}const Bt=[["tulip-coral","珊瑚郁金香","#E25B45"],["tulip-pink","粉色郁金香","#F4A4B8"],["tulip-orange","橙色郁金香","#F08A3E"]];
for(let e=0;
e<Bt.length;
e++){
  const t=Bt[e];
  m({
    id:t[0],name:t[1],group:"cute",anchor:null,draw(l,n){
      l.fillStyle="#7EAE6A",l.fillRect(-n*.015,n*.02,n*.03,n*.36),F(l,n,()=>{
        l.beginPath(),l.moveTo(0,n*.08),l.bezierCurveTo(-n*.28,n*.02,-n*.24,-n*.28,0,-n*.34),l.bezierCurveTo(n*.24,-n*.28,n*.28,n*.02,0,n*.08),l.closePath()
      },t[2],!0),l.strokeStyle="rgba(255,255,255,0.65)",l.lineWidth=n*.02,l.beginPath(),l.moveTo(0,-n*.28),l.lineTo(0,n*.02),l.stroke()
    }
  })
}const Dt=[["leaf-mint","薄荷叶子","#7EBEA6"],["leaf-green","绿叶子","#6FA15A"],["leaf-olive","橄榄叶子","#9AAA6A"]];
for(let e=0;
e<Dt.length;
e++){
  const t=Dt[e];
  m({
    id:t[0],name:t[1],group:"cute",anchor:null,draw(l,n){
      F(l,n,()=>ft(l,n),t[2],!0),l.strokeStyle="rgba(255,255,255,0.7)",l.lineWidth=n*.02,l.beginPath(),l.moveTo(0,n*.28),l.quadraticCurveTo(n*.02,0,0,-n*.3),l.stroke()
    }
  })
}m({
  id:"cloud-white",name:"白云",group:"cute",anchor:null,draw(e,t){
    const l=(n,i)=>{
      e.fillStyle=i,e.beginPath(),e.arc(-t*.16*n,t*.06,t*.14*n,0,Math.PI*2),e.arc(t*.02*n,-t*.02,t*.18*n,0,Math.PI*2),e.arc(t*.2*n,t*.05,t*.13*n,0,Math.PI*2),e.arc(0,t*.1*n,t*.12*n,0,Math.PI*2),e.fill()
    };
    l(1.12,"#fff"),l(1,"#F7FBFF"),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.stroke()
  }
});
m({
  id:"cloud-blush",name:"腮红云",group:"cute",anchor:null,draw(e,t){
    e.fillStyle="#fff",e.beginPath(),e.arc(-t*.12,t*.04,t*.16,0,Math.PI*2),e.arc(t*.08,-t*.02,t*.2,0,Math.PI*2),e.arc(t*.22,t*.06,t*.12,0,Math.PI*2),e.fill(),e.fillStyle="#F7C2D0",e.globalAlpha=.9,e.beginPath(),e.arc(-t*.1,t*.05,t*.13,0,Math.PI*2),e.arc(t*.08,0,t*.16,0,Math.PI*2),e.fill(),e.globalAlpha=1,e.fillStyle="#E25B45",e.beginPath(),e.arc(-t*.08,t*.02,t*.02,0,Math.PI*2),e.arc(t*.1,t*.02,t*.02,0,Math.PI*2),e.fill()
  }
});
function ht(e,t,l){
  e.save(),e.rotate(-Math.PI/2);
  for(let n=0;
  n<12;
  n++)e.rotate(Math.PI/6),e.fillStyle="#fff",e.fillRect(t*.16,-t*.035,t*.2,t*.07);
  e.restore();
  for(let n=0;
  n<12;
  n++)e.save(),e.rotate(n*Math.PI/6),e.fillStyle=l,e.beginPath(),e.roundRect?e.roundRect(t*.18,-t*.028,t*.16,t*.056,t*.02):e.rect(t*.18,-t*.028,t*.16,t*.056),e.fill(),e.restore();
  e.beginPath(),e.arc(0,0,t*.2,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.beginPath(),e.arc(0,0,t*.16,0,Math.PI*2),e.fillStyle=l,e.fill(),e.fillStyle="#2C241C",e.beginPath(),e.arc(-t*.05,-t*.02,t*.018,0,Math.PI*2),e.arc(t*.05,-t*.02,t*.018,0,Math.PI*2),e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.beginPath(),e.arc(0,t*.02,t*.05,.2,Math.PI-.2),e.stroke()
}m({
  id:"sun-warm",name:"暖阳",group:"cute",anchor:null,draw:(e,t)=>ht(e,t,"#F6D56A")
});
m({
  id:"sun-coral",name:"珊瑚太阳",group:"cute",anchor:null,draw:(e,t)=>ht(e,t,"#F08A3E")
});
function ge(e,t,l,n){
  const i=()=>{
    e.beginPath(),e.moveTo(0,0),e.bezierCurveTo(-t*.08,-t*.28,-t*.42,-t*.22,-t*.32,0),e.bezierCurveTo(-t*.42,t*.2,-t*.08,t*.22,0,0),e.moveTo(0,0),e.bezierCurveTo(t*.08,-t*.28,t*.42,-t*.22,t*.32,0),e.bezierCurveTo(t*.42,t*.2,t*.08,t*.22,0,0),e.moveTo(0,0),e.lineTo(-t*.12,t*.32),e.lineTo(-t*.02,t*.08),e.lineTo(t*.02,t*.08),e.lineTo(t*.12,t*.32),e.closePath()
  };
  n?D(e,t,i,l,"#2C241C"):F(e,t,i,l,!0),e.beginPath(),e.arc(0,0,t*.06,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.beginPath(),e.arc(0,0,t*.04,0,Math.PI*2),e.fillStyle=l,e.fill()
}m({
  id:"bow-pink",name:"粉色蝴蝶结",group:"cute",anchor:null,draw:(e,t)=>ge(e,t,"#F4A4B8",!1)
});
m({
  id:"bow-lilac",name:"淡紫蝴蝶结",group:"cute",anchor:null,draw:(e,t)=>ge(e,t,"#CDB6E8",!1)
});
function ut(e,t,l){
  e.beginPath(),e.arc(0,0,t*.34,0,Math.PI*2),e.fillStyle="#fff",e.fill();
  for(let n=0;
  n<3;
  n++)e.beginPath(),e.arc(0,0,t*(.28-n*.06),n,n+Math.PI*1.4),e.strokeStyle=l,e.lineWidth=t*.07,e.lineCap="round",e.stroke();
  e.beginPath(),e.arc(0,0,t*.06,0,Math.PI*2),e.fillStyle=l,e.fill()
}m({
  id:"rose-red",name:"红玫瑰",group:"cute",anchor:null,draw:(e,t)=>ut(e,t,"#E23B4A")
});
m({
  id:"rose-pink",name:"粉玫瑰",group:"cute",anchor:null,draw:(e,t)=>ut(e,t,"#F4A4B8")
});
function Pe(e,t,l){
  e.beginPath(),e.arc(0,0,t*.34,0,Math.PI*2),e.fillStyle="#fff",e.fill();
  const n=e.createRadialGradient(-t*.08,-t*.1,t*.02,0,0,t*.32);
  n.addColorStop(0,"#ffffff"),n.addColorStop(.35,l),n.addColorStop(1,"#2C241C"),e.beginPath(),e.arc(0,0,t*.28,0,Math.PI*2),e.fillStyle=n,e.fill(),e.beginPath(),e.ellipse(-t*.08,-t*.1,t*.08,t*.04,-.6,0,Math.PI*2),e.fillStyle="rgba(255,255,255,0.85)",e.fill()
}m({
  id:"bead-blue",name:"蓝玻璃珠",group:"cute",anchor:null,draw:(e,t)=>Pe(e,t,"#8EB7D6")
});
m({
  id:"bead-pink",name:"粉玻璃珠",group:"cute",anchor:null,draw:(e,t)=>Pe(e,t,"#F4A4B8")
});
m({
  id:"bead-clear",name:"透明玻璃珠",group:"cute",anchor:null,draw:(e,t)=>Pe(e,t,"rgba(255,255,255,0.65)")
});
m({
  id:"rainbow",name:"彩虹",group:"cute",anchor:null,draw(e,t){
    const l=["#E25B45","#F08A3E","#F6D56A","#7EBEA6","#8EB7D6","#CDB6E8"];
    e.lineCap="round";
    for(let n=0;
    n<l.length;
    n++)e.beginPath(),e.strokeStyle=l[n],e.lineWidth=t*.045,e.arc(0,t*.12,t*(.34-n*.045),Math.PI,0),e.stroke()
  }
});
function pn(e,t,l){
  e.beginPath(),e.arc(0,t*.04,t*.3,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.beginPath(),e.arc(0,t*.04,t*.26,0,Math.PI*2),e.fillStyle=l,e.fill(),e.lineWidth=t*.02,e.strokeStyle="#2C241C",e.stroke()
}m({
  id:"panda",name:"熊猫脸",group:"cute",anchor:null,draw(e,t){
    e.fillStyle="#2C241C",e.beginPath(),e.arc(-t*.18,-t*.22,t*.1,0,Math.PI*2),e.arc(t*.18,-t*.22,t*.1,0,Math.PI*2),e.fill(),pn(e,t,"#F7F4EF"),e.fillStyle="#2C241C",e.beginPath(),e.ellipse(-t*.1,t*0,t*.07,t*.08,-.3,0,Math.PI*2),e.ellipse(t*.1,t*0,t*.07,t*.08,.3,0,Math.PI*2),e.fill(),e.fillStyle="#fff",e.beginPath(),e.arc(-t*.08,-t*.02,t*.02,0,Math.PI*2),e.arc(t*.12,-t*.02,t*.02,0,Math.PI*2),e.fill(),e.fillStyle="#2C241C",e.beginPath(),e.ellipse(0,t*.08,t*.03,t*.02,0,0,Math.PI*2),e.fill()
  }
});
m({
  id:"bunny",name:"小兔",group:"cute",anchor:null,draw(e,t){
    const l=(n,i)=>{
      e.beginPath(),e.ellipse(n,-t*.22,t*.07,t*.2,0,0,Math.PI*2),e.fillStyle=i?"#fff":"#F7F1E6",e.fill(),i||(e.strokeStyle="#2C241C",e.lineWidth=t*.018,e.stroke(),e.beginPath(),e.ellipse(n,-t*.22,t*.035,t*.12,0,0,Math.PI*2),e.fillStyle="#F4A4B8",e.fill())
    };
    l(-t*.1,!0),l(t*.1,!0),l(-t*.1,!1),l(t*.1,!1),pn(e,t,"#F7F1E6"),e.fillStyle="#2C241C",e.beginPath(),e.arc(-t*.08,t*0,t*.02,0,Math.PI*2),e.arc(t*.08,t*0,t*.02,0,Math.PI*2),e.fill(),e.fillStyle="#F4A4B8",e.beginPath(),e.ellipse(0,t*.08,t*.03,t*.02,0,0,Math.PI*2),e.fill()
  }
});
m({
  id:"glass-bear",name:"玻璃熊",group:"cute",anchor:null,draw(e,t){
    const l=e.createLinearGradient(-t*.2,-t*.3,t*.3,t*.3);
    l.addColorStop(0,"rgba(255,255,255,0.95)"),l.addColorStop(.45,"rgba(210, 230, 245, 0.75)"),l.addColorStop(1,"rgba(160, 196, 220, 0.9)"),e.fillStyle="#fff",e.beginPath(),e.arc(-t*.16,-t*.18,t*.1,0,Math.PI*2),e.arc(t*.16,-t*.18,t*.1,0,Math.PI*2),e.arc(0,t*.04,t*.24,0,Math.PI*2),e.fill(),e.fillStyle=l,e.beginPath(),e.arc(-t*.16,-t*.18,t*.08,0,Math.PI*2),e.arc(t*.16,-t*.18,t*.08,0,Math.PI*2),e.arc(0,t*.04,t*.2,0,Math.PI*2),e.fill(),e.strokeStyle="rgba(44,36,28,0.45)",e.lineWidth=t*.015,e.stroke(),e.fillStyle="#2C241C",e.beginPath(),e.arc(-t*.07,t*0,t*.018,0,Math.PI*2),e.arc(t*.07,t*0,t*.018,0,Math.PI*2),e.fill(),e.beginPath(),e.ellipse(-t*.08,-t*.12,t*.05,t*.025,-.5,0,Math.PI*2),e.fillStyle="rgba(255,255,255,0.8)",e.fill()
  }
});
m({
  id:"strawberry",name:"草莓",group:"cute",anchor:null,draw(e,t){
    F(e,t,()=>{
      e.beginPath(),e.moveTo(0,-t*.16),e.bezierCurveTo(t*.32,-t*.16,t*.32,t*.18,0,t*.36),e.bezierCurveTo(-t*.32,t*.18,-t*.32,-t*.16,0,-t*.16),e.closePath()
    },"#E25B45",!0),e.fillStyle="#6FA15A",e.beginPath(),e.moveTo(0,-t*.28),e.lineTo(t*.1,-t*.12),e.lineTo(t*.02,-t*.14),e.lineTo(0,-t*.02),e.lineTo(-t*.02,-t*.14),e.lineTo(-t*.1,-t*.12),e.closePath(),e.fill(),e.fillStyle="#F7F1E6";
    for(let n=0;
    n<6;
    n++){
      const i=-.6+n*.35;
      e.beginPath(),e.ellipse(Math.sin(i)*t*.12,t*.02+n%3*t*.08,t*.018,t*.028,i,0,Math.PI*2),e.fill()
    }
  }
});
m({
  id:"mushroom",name:"小蘑菇",group:"cute",anchor:null,draw(e,t){
    e.fillStyle="#fff",e.fillRect(-t*.08,t*.02,t*.16,t*.28),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.strokeRect(-t*.08,t*.02,t*.16,t*.26),F(e,t,()=>{
      e.beginPath(),e.arc(0,t*.02,t*.28,Math.PI,0),e.closePath()
    },"#E25B45",!0),e.fillStyle="#F7F1E6",e.beginPath(),e.arc(-t*.1,-t*.08,t*.04,0,Math.PI*2),e.arc(t*.08,-t*.04,t*.03,0,Math.PI*2),e.fill()
  }
});
m({
  id:"cherry",name:"樱桃",group:"cute",anchor:null,draw(e,t){
    e.strokeStyle="#6FA15A",e.lineWidth=t*.02,e.beginPath(),e.moveTo(0,-t*.28),e.quadraticCurveTo(-t*.08,-t*.05,-t*.12,t*.05),e.moveTo(0,-t*.28),e.quadraticCurveTo(t*.08,-t*.05,t*.12,t*.05),e.stroke();
    const l=n=>{
      e.beginPath(),e.arc(n,t*.12,t*.14,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.beginPath(),e.arc(n,t*.12,t*.11,0,Math.PI*2),e.fillStyle="#E23B4A",e.fill(),e.beginPath(),e.arc(n-t*.04,t*.08,t*.03,0,Math.PI*2),e.fillStyle="rgba(255,255,255,0.7)",e.fill()
    };
    l(-t*.12),l(t*.12)
  }
});
m({
  id:"clover",name:"四叶草",group:"cute",anchor:null,draw(e,t){
    for(let l=0;
    l<4;
    l++)e.save(),e.rotate(l*Math.PI/2),ie(e,t*.55),e.fillStyle=l===0?"#fff":"#7EBEA6",l===0&&(e.save(),e.scale(1.15,1.15),e.fill(),e.restore()),e.fillStyle="#7EBEA6",e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.015,e.stroke(),e.restore()
  }
});
m({
  id:"spark",name:"闪光",group:"cute",anchor:null,draw(e,t){
    F(e,t,()=>B(e,t*.36,t*.08,4),"#F6D56A",!1),B(e,t*.12,t*.03,4),e.fillStyle="#fff",e.fill()
  }
});
m({
  id:"sprout",name:"新芽",group:"cute",anchor:null,draw(e,t){
    e.strokeStyle="#6FA15A",e.lineWidth=t*.03,e.lineCap="round",e.beginPath(),e.moveTo(0,t*.32),e.quadraticCurveTo(t*.02,0,0,-t*.05),e.stroke(),e.beginPath(),e.ellipse(-t*.1,-t*.08,t*.12,t*.07,-.8,0,Math.PI*2),e.ellipse(t*.1,-t*.08,t*.12,t*.07,.8,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.fillStyle="#8FCB78",e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.015,e.stroke()
  }
});
const Lt=[["plat-gold","铂金星","#FFF6D8","#E2A63B"],["plat-silver","银星","#FFFFFF","#B9C2CC"]];
for(let e=0;
e<Lt.length;
e++){
  const t=Lt[e];
  m({
    id:t[0],name:t[1],group:"y2k",anchor:null,draw:(l,n)=>D(l,n,()=>B(l,n*.4,n*.16,4),t[2],t[3])
  })
}const Rt=[["crystal-pink","粉水晶心","#FFE4F0","#F4A4B8"],["crystal-blue","蓝水晶心","#E7F6FF","#8EB7D6"]];
for(let e=0;
e<Rt.length;
e++){
  const t=Rt[e];
  m({
    id:t[0],name:t[1],group:"y2k",anchor:null,draw:(l,n)=>D(l,n,()=>ie(l,n*.95),t[2],t[3])
  })
}function gn(e,t){
  e.beginPath(),e.moveTo(t*.08,-t*.4),e.lineTo(-t*.16,t*.02),e.lineTo(-t*.02,t*.02),e.lineTo(-t*.1,t*.4),e.lineTo(t*.2,-t*.06),e.lineTo(t*.04,-t*.06),e.closePath()
}const Wt=[["bolt-yellow","黄闪电","#FFF3B0","#F0C14A"],["bolt-pink","粉闪电","#FFD0E4","#F4A4B8"],["bolt-blue","蓝闪电","#D7F0FF","#8EB7D6"]];
for(let e=0;
e<Wt.length;
e++){
  const t=Wt[e];
  m({
    id:t[0],name:t[1],group:"y2k",anchor:null,draw:(l,n)=>D(l,n,()=>gn(l,n),t[2],t[3])
  })
}const Nt=[["pop-pink","粉棒棒糖","#F4A4B8"],["pop-orange","橙棒棒糖","#F08A3E"],["pop-mint","薄荷棒棒糖","#7EBEA6"]];
for(let e=0;
e<Nt.length;
e++){
  const t=Nt[e];
  m({
    id:t[0],name:t[1],group:"y2k",anchor:null,draw(l,n){
      l.fillStyle="#fff",l.fillRect(-n*.035,n*.12,n*.07,n*.26),l.strokeStyle="#2C241C",l.strokeRect(-n*.035,n*.12,n*.07,n*.26),D(l,n,()=>{
        l.beginPath(),l.arc(0,-n*.08,n*.24,0,Math.PI*2)
      },"#fff",t[2]),l.strokeStyle="rgba(255,255,255,0.8)",l.lineWidth=n*.03,l.beginPath(),l.arc(0,-n*.08,n*.12,.4,2.2),l.stroke()
    }
  })
}function mn(e,t,l){
  e.beginPath(),e.arc(0,0,t*.4,0,Math.PI*2),e.fillStyle="#fff",e.fill();
  for(let n=0;
  n<l.length;
  n++)e.beginPath(),e.moveTo(0,0),e.arc(0,0,t*.34,n/l.length*Math.PI*2,(n+1)/l.length*Math.PI*2),e.closePath(),e.fillStyle=l[n],e.fill();
  e.beginPath(),e.arc(0,0,t*.1,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.beginPath(),e.arc(0,0,t*.045,0,Math.PI*2),e.fillStyle="#2C241C",e.fill(),e.strokeStyle="rgba(255,255,255,0.55)",e.lineWidth=t*.03,e.beginPath(),e.arc(0,0,t*.24,0,Math.PI*2),e.stroke()
}m({
  id:"cd-rainbow",name:"彩虹 CD",group:"y2k",anchor:null,draw:(e,t)=>mn(e,t,["#ff5d8f","#ffd15c","#7dffa8","#7ad0ff","#d2b0ff","#ff9ec4"])
});
m({
  id:"cd-silver",name:"银 CD",group:"y2k",anchor:null,draw:(e,t)=>mn(e,t,["#f7f7f8","#d5dbe3","#ffffff","#b7c0cc","#eef2f6","#c5ccd6"])
});
function ct(e,t,l,n){
  const i=o=>{
    e.save(),e.scale(o,1),e.beginPath(),e.ellipse(-t*.16,-t*.08,t*.18,t*.14,-.4,0,Math.PI*2),e.ellipse(-t*.14,t*.12,t*.14,t*.12,.4,0,Math.PI*2),e.fillStyle="#fff",e.fill();
    const a=e.createLinearGradient(-t*.3,-t*.2,0,t*.2);
    a.addColorStop(0,l),a.addColorStop(1,n),e.fillStyle=a,e.beginPath(),e.ellipse(-t*.15,-t*.08,t*.15,t*.11,-.4,0,Math.PI*2),e.ellipse(-t*.13,t*.11,t*.11,t*.09,.4,0,Math.PI*2),e.fill(),e.restore()
  };
  i(1),i(-1),e.fillStyle="#2C241C",e.fillRect(-t*.015,-t*.18,t*.03,t*.36),e.strokeStyle="#2C241C",e.lineWidth=t*.012,e.beginPath(),e.moveTo(0,-t*.16),e.quadraticCurveTo(-t*.08,-t*.28,-t*.12,-t*.24),e.moveTo(0,-t*.16),e.quadraticCurveTo(t*.08,-t*.28,t*.12,-t*.24),e.stroke()
}m({
  id:"fly-lilac",name:"紫蝴蝶",group:"y2k",anchor:null,draw:(e,t)=>ct(e,t,"#E7D6FF","#F4A4B8")
});
m({
  id:"fly-mint",name:"薄荷蝴蝶",group:"y2k",anchor:null,draw:(e,t)=>ct(e,t,"#D9FFF2","#8EB7D6")
});
function pt(e,t,l){
  e.save(),e.rotate(-.5),e.strokeStyle="#fff",e.lineWidth=t*.06,e.beginPath(),e.ellipse(0,0,t*.4,t*.12,0,0,Math.PI*2),e.stroke(),e.restore();
  const n=e.createRadialGradient(-t*.08,-t*.08,t*.02,0,0,t*.24);
  n.addColorStop(0,"#fff"),n.addColorStop(.4,l),n.addColorStop(1,"#2C241C"),e.beginPath(),e.arc(0,0,t*.22,0,Math.PI*2),e.fillStyle=n,e.fill()
}m({
  id:"planet-blue",name:"蓝行星",group:"y2k",anchor:null,draw:(e,t)=>pt(e,t,"#8EB7D6")
});
m({
  id:"planet-pink",name:"粉行星",group:"y2k",anchor:null,draw:(e,t)=>pt(e,t,"#F4A4B8")
});
function gt(e,t,l,n){
  D(e,t,()=>{
    e.beginPath(),e.moveTo(0,-t*.4),e.lineTo(t*.28,-t*.12),e.lineTo(t*.18,t*.36),e.lineTo(-t*.18,t*.36),e.lineTo(-t*.28,-t*.12),e.closePath()
  },l,n),e.strokeStyle="rgba(255,255,255,0.7)",e.lineWidth=t*.015,e.beginPath(),e.moveTo(0,-t*.36),e.lineTo(0,t*.3),e.moveTo(-t*.22,-t*.1),e.lineTo(t*.22,-t*.1),e.stroke()
}m({
  id:"gem-blue",name:"蓝宝石",group:"y2k",anchor:null,draw:(e,t)=>gt(e,t,"#E7F4FF","#6FA8D8")
});
m({
  id:"gem-pink",name:"粉宝石",group:"y2k",anchor:null,draw:(e,t)=>gt(e,t,"#FFE4F2","#F4A4B8")
});
function mt(e,t,l,n){
  D(e,t,()=>{
    e.beginPath(),e.moveTo(0,t*.4),e.bezierCurveTo(-t*.28,t*.1,-t*.22,-t*.15,-t*.05,-t*.28),e.bezierCurveTo(-t*.12,-t*.05,-t*.02,t*.05,t*.02,-t*.08),e.bezierCurveTo(t*.08,-t*.32,t*.02,-t*.42,0,-t*.4),e.bezierCurveTo(t*.22,-t*.18,t*.3,t*.08,0,t*.4),e.closePath()
  },l,n)
}m({
  id:"flame-orange",name:"火焰",group:"y2k",anchor:null,draw:(e,t)=>mt(e,t,"#FFE08A","#E25B45")
});
m({
  id:"flame-pink",name:"粉火焰",group:"y2k",anchor:null,draw:(e,t)=>mt(e,t,"#FFE4F0","#E23B8A")
});
const Ot=[["jag-yellow","锯齿黄星","#FFF3B0","#F0C14A"],["jag-pink","锯齿粉星","#FFD6E8","#F4A4B8"],["jag-blue","锯齿蓝星","#D9F1FF","#8EB7D6"]];
for(let e=0;
e<Ot.length;
e++){
  const t=Ot[e];
  m({
    id:t[0],name:t[1],group:"y2k",anchor:null,draw(l,n){
      D(l,n,()=>B(l,n*.42,n*.32,14),"#fff","#fff"),D(l,n,()=>B(l,n*.34,n*.14,5),t[2],t[3])
    }
  })
}function yt(e,t,l){
  D(e,t,()=>B(e,t*.46,t*.38,12),"#fff","#f4f1ea"),e.beginPath(),e.arc(0,t*.02,t*.22,0,Math.PI*2);
  const n=e.createLinearGradient(0,-t*.2,0,t*.2);
  n.addColorStop(0,"#fff"),n.addColorStop(1,l),e.fillStyle=n,e.fill(),e.fillStyle="#2C241C",e.beginPath(),e.ellipse(-t*.07,-t*.02,t*.025,t*.04,0,0,Math.PI*2),e.ellipse(t*.07,-t*.02,t*.025,t*.04,0,0,Math.PI*2),e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.beginPath(),e.arc(0,t*.04,t*.08,.2,Math.PI-.2),e.stroke()
}m({
  id:"smile-pink",name:"Y2K 笑脸",group:"y2k",anchor:null,draw:(e,t)=>yt(e,t,"#F4A4B8")
});
m({
  id:"smile-lime",name:"柠檬笑脸",group:"y2k",anchor:null,draw:(e,t)=>yt(e,t,"#D6E86A")
});
m({
  id:"y2k-bow-red",name:"红亮蝴蝶结",group:"y2k",anchor:null,draw:(e,t)=>ge(e,t,"#E23B4A",!0)
});
m({
  id:"y2k-bow-black",name:"黑亮蝴蝶结",group:"y2k",anchor:null,draw:(e,t)=>ge(e,t,"#2C241C",!0)
});
m({
  id:"signal",name:"信号贴",group:"y2k",anchor:null,draw(e,t){
    D(e,t,()=>B(e,t*.46,t*.38,10),"#E7F6FF","#8EB7D6"),e.strokeStyle="#2C241C",e.lineWidth=t*.035,e.lineCap="round",e.beginPath(),e.arc(0,t*.08,t*.08,Math.PI*1.15,Math.PI*1.85),e.stroke(),e.lineWidth=t*.03,e.beginPath(),e.arc(0,t*.08,t*.16,Math.PI*1.2,Math.PI*1.8),e.stroke(),e.beginPath(),e.arc(0,t*.1,t*.03,0,Math.PI*2),e.fillStyle="#2C241C",e.fill()
  }
});
m({
  id:"checker",name:"棋盘心",group:"y2k",anchor:null,draw(e,t){
    e.save(),e.scale(1.08,1.08),ie(e,t),e.fillStyle="#fff",e.fill(),e.restore(),e.save(),ie(e,t),e.clip();
    const l=6,n=t*.16;
    for(let i=0;
    i<l;
    i++)for(let o=0;
    o<l;
    o++)e.fillStyle=(o+i)%2===0?"#2C241C":"#F4A4B8",e.fillRect(-t*.48+o*n,-t*.48+i*n,n+.5,n+.5);
    e.restore()
  }
});
function bt(e,t,l){
  if(l==="bunny"){
    const i=(o,a)=>{
      e.save(),e.translate(o,-t*.05),e.rotate(a),e.beginPath(),e.ellipse(0,0,t*.09,t*.28,0,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.fillStyle="#F7F1E6",e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.stroke(),e.beginPath(),e.ellipse(0,0,t*.045,t*.18,0,0,Math.PI*2),e.fillStyle="#F4A4B8",e.fill(),e.restore()
    };
    i(-t*.16,-.15),i(t*.16,.15);
    return
  }if(l==="cat"){
    const i=o=>{
      e.save(),e.scale(o,1),e.beginPath(),e.moveTo(-t*.02,t*.12),e.lineTo(-t*.22,-t*.28),e.lineTo(t*.08,t*.02),e.closePath(),e.fillStyle="#fff",e.fill(),e.fillStyle="#F7C9A5",e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.stroke(),e.beginPath(),e.moveTo(0,t*.06),e.lineTo(-t*.12,-t*.16),e.lineTo(t*.02,0),e.closePath(),e.fillStyle="#F4A4B8",e.fill(),e.restore()
    };
    i(1),i(-1);
    return
  }const n=i=>{
    e.beginPath(),e.arc(i,-t*.02,t*.16,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.fillStyle="#C98A62",e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.stroke(),e.beginPath(),e.arc(i,-t*.02,t*.08,0,Math.PI*2),e.fillStyle="#F4C9B0",e.fill()
  };
  n(-t*.18),n(t*.18)
}m({
  id:"ears-bunny",name:"兔耳",group:"lens",anchor:"above",draw:(e,t)=>bt(e,t,"bunny")
});
m({
  id:"ears-cat",name:"猫耳",group:"lens",anchor:"above",draw:(e,t)=>bt(e,t,"cat")
});
m({
  id:"ears-bear",name:"熊耳",group:"lens",anchor:"above",draw:(e,t)=>bt(e,t,"bear")
});
m({
  id:"horns",name:"恶魔角",group:"lens",anchor:"above",draw(e,t){
    const l=n=>{
      e.save(),e.scale(n,1),e.beginPath(),e.moveTo(-t*.02,t*.16),e.quadraticCurveTo(-t*.2,-t*.05,-t*.08,-t*.36),e.quadraticCurveTo(t*.02,-t*.08,t*.08,t*.12),e.closePath(),e.fillStyle="#fff",e.fill(),e.fillStyle="#E23B4A",e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.018,e.stroke(),e.restore()
    };
    l(1),l(-1)
  }
});
m({
  id:"halo",name:"光环",group:"lens",anchor:"above",draw(e,t){
    e.beginPath(),e.ellipse(0,0,t*.32,t*.1,0,0,Math.PI*2),e.lineWidth=t*.06,e.strokeStyle="#fff",e.stroke(),e.lineWidth=t*.035,e.strokeStyle="#F0C14A",e.stroke()
  }
});
function He(e,t,l,n,i){
  for(let o=0;
  o<n;
  o++)e.save(),e.rotate(o/n*Math.PI*2),e.translate(0,-i),l(o,n),e.restore()
}m({
  id:"wreath",name:"花环",group:"lens",anchor:"wrap",draw(e,t){
    He(e,t,()=>{
      e.rotate(Math.PI),ft(e,t*.42),e.fillStyle="#7EBEA6",e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.012,e.stroke()
    },10,t*.3)
  }
});
m({
  id:"petals",name:"花瓣簇",group:"lens",anchor:"wrap",draw(e,t){
    He(e,t,()=>{
      e.beginPath(),e.ellipse(0,0,t*.07,t*.12,0,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.fillStyle="#F7F1E6",e.fill(),e.strokeStyle="#E25B45",e.lineWidth=t*.012,e.stroke()
    },8,t*.28)
  }
});
m({
  id:"petals-pink",name:"粉花瓣簇",group:"lens",anchor:"wrap",draw(e,t){
    He(e,t,()=>{
      e.beginPath(),e.ellipse(0,0,t*.08,t*.13,0,0,Math.PI*2),e.fillStyle="#F4A4B8",e.fill()
    },9,t*.28)
  }
});
m({
  id:"eyes",name:"眼睛",group:"lens",anchor:"below",draw(e,t){
    const l=n=>{
      e.beginPath(),e.ellipse(n,0,t*.16,t*.18,0,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.stroke(),e.beginPath(),e.arc(n,t*.02,t*.07,0,Math.PI*2),e.fillStyle="#2C241C",e.fill(),e.beginPath(),e.arc(n-t*.02,-t*.02,t*.025,0,Math.PI*2),e.fillStyle="#fff",e.fill()
    };
    l(-t*.18),l(t*.18)
  }
});
m({
  id:"ring-platinum",name:"铂金圈",group:"lens",anchor:"wrap",draw(e,t){
    const R=t*.348,W=Math.max(1.2,t*.046);
    e.beginPath(),e.arc(0,0,R,0,Math.PI*2);
    const l=e.createLinearGradient(-R,-R,R*.6,R);
    l.addColorStop(0,"#ffffff"),l.addColorStop(.28,"#e6eaef"),l.addColorStop(.55,"#b4bac2"),l.addColorStop(.8,"#eceff3"),l.addColorStop(1,"#9aa1aa"),e.strokeStyle=l,e.lineWidth=W,e.stroke();
    e.beginPath(),e.arc(0,0,R-W*.18,0,Math.PI*2),e.strokeStyle="rgba(255,255,255,0.42)",e.lineWidth=Math.max(.8,W*.22),e.stroke()
  }
});
m({
  id:"ring-star",name:"星星圈",group:"lens",anchor:"wrap",draw(e,t){
    He(e,t,()=>{
      B(e,t*.07,t*.03,5),e.fillStyle="#F0C14A",e.fill()
    },8,t*.3)
  }
});
m({
  id:"crown",name:"小皇冠",group:"lens",anchor:"above",draw(e,t){
    D(e,t,()=>{
      e.beginPath(),e.moveTo(-t*.32,t*.12),e.lineTo(-t*.24,-t*.12),e.lineTo(-t*.1,t*.02),e.lineTo(0,-t*.28),e.lineTo(t*.1,t*.02),e.lineTo(t*.24,-t*.12),e.lineTo(t*.32,t*.12),e.closePath()
    },"#FFF6D0","#E2A63B")
  }
});
m({
  id:"bow-top",name:"头顶蝴蝶结",group:"lens",anchor:"above",draw:(e,t)=>ge(e,t*.9,"#F4A4B8",!1)
});
m({
  id:"cheeks",name:"腮红",group:"lens",anchor:"below",draw(e,t){
    e.fillStyle="rgba(244, 164, 184, 0.9)",e.beginPath(),e.ellipse(-t*.2,0,t*.12,t*.07,0,0,Math.PI*2),e.ellipse(t*.2,0,t*.12,t*.07,0,0,Math.PI*2),e.fill()
  }
});
function it(e,t){
  const l=t/100;
  e.beginPath(),e.moveTo(0,-40*l),e.bezierCurveTo(18*l,-40*l,22*l,-18*l,16*l,-6*l),e.bezierCurveTo(42*l,2*l,40*l,40*l,0,42*l),e.bezierCurveTo(-40*l,40*l,-42*l,2*l,-16*l,-6*l),e.bezierCurveTo(-22*l,-18*l,-18*l,-40*l,0,-40*l),e.closePath()
}function St(e,t){
  e.strokeStyle="#6FA15A",e.lineWidth=t*.025,e.lineCap="round",e.beginPath(),e.moveTo(0,-t*.36),e.quadraticCurveTo(t*.04,-t*.46,t*.02,-t*.5),e.stroke(),e.beginPath(),e.ellipse(t*.1,-t*.46,t*.1,t*.04,-.6,0,Math.PI*2),e.fillStyle="#6FA15A",e.fill()
}m({
  id:"pear-bite",name:"咬一口的雪梨",group:"parody",anchor:null,draw(e,t){
    F(e,t,()=>it(e,t*.92),"#D7E25A",!0),e.beginPath(),e.arc(-t*.16,t*.08,t*.12,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.beginPath(),e.arc(-t*.12,t*.06,t*.07,0,Math.PI*2),e.fillStyle="#F6E7A8",e.fill(),St(e,t),e.fillStyle="#2C241C",e.beginPath(),e.arc(t*.04,-t*.02,t*.015,0,Math.PI*2),e.arc(t*.12,-t*.02,t*.015,0,Math.PI*2),e.fill()
  }
});
m({
  id:"apple-core",name:"两口苹果核",group:"parody",anchor:null,draw(e,t){
    F(e,t,()=>{
      const n=t/100;
      e.beginPath(),e.moveTo(0,-34*n),e.bezierCurveTo(30*n,-28*n,36*n,-8*n,14*n,0),e.bezierCurveTo(36*n,8*n,30*n,30*n,0,36*n),e.bezierCurveTo(-30*n,30*n,-36*n,8*n,-14*n,0),e.bezierCurveTo(-36*n,-8*n,-30*n,-28*n,0,-34*n),e.closePath()
    },"#C4A574",!0),e.fillStyle="#2C241C",e.beginPath(),e.ellipse(-t*.04,-t*.04,t*.025,t*.04,-.4,0,Math.PI*2),e.ellipse(t*.05,-t*.02,t*.025,t*.04,.4,0,Math.PI*2),e.ellipse(-t*.03,t*.08,t*.025,t*.04,.2,0,Math.PI*2),e.ellipse(t*.04,t*.1,t*.025,t*.04,-.2,0,Math.PI*2),e.fill(),St(e,t*.8)
  }
});
m({
  id:"orange",name:"橘子",group:"parody",anchor:null,draw(e,t){
    e.beginPath(),e.arc(0,t*.02,t*.34,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.beginPath(),e.arc(0,t*.02,t*.3,0,Math.PI*2),e.fillStyle="#F5A04A",e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.stroke(),e.strokeStyle="rgba(255,255,255,0.45)",e.lineWidth=t*.012;
    for(let l=0;
    l<5;
    l++)e.beginPath(),e.moveTo(0,t*.02),e.lineTo(Math.cos(l/5*Math.PI*2)*t*.26,t*.02+Math.sin(l/5*Math.PI*2)*t*.26),e.stroke();
    e.fillStyle="#6FA15A",e.beginPath(),e.ellipse(t*.08,-t*.28,t*.1,t*.04,-.5,0,Math.PI*2),e.fill(),e.fillStyle="#2C241C",e.beginPath(),e.arc(-t*.08,t*0,t*.02,0,Math.PI*2),e.arc(t*.08,t*0,t*.02,0,Math.PI*2),e.fill(),e.beginPath(),e.arc(0,t*.08,t*.05,.15,Math.PI-.15),e.strokeStyle="#2C241C",e.lineWidth=t*.018,e.stroke()
  }
});
m({
  id:"potato",name:"土豆",group:"parody",anchor:null,draw(e,t){
    F(e,t,()=>{
      e.beginPath(),e.moveTo(-t*.1,-t*.28),e.bezierCurveTo(t*.3,-t*.36,t*.4,t*.05,t*.16,t*.28),e.bezierCurveTo(0,t*.4,-t*.36,t*.3,-t*.32,0),e.bezierCurveTo(-t*.34,-t*.22,-t*.24,-t*.2,-t*.1,-t*.28),e.closePath()
    },"#C49A6C",!0),e.fillStyle="#6FA15A",e.beginPath(),e.ellipse(-t*.02,-t*.3,t*.04,t*.08,-.4,0,Math.PI*2),e.fill(),e.fillStyle="#8A6A48",e.beginPath(),e.arc(-t*.08,-t*.02,t*.02,0,Math.PI*2),e.arc(t*.08,t*.06,t*.018,0,Math.PI*2),e.arc(-t*.02,t*.14,t*.016,0,Math.PI*2),e.fill(),e.fillStyle="#2C241C",e.beginPath(),e.arc(-t*.06,-t*.08,t*.012,0,Math.PI*2),e.arc(t*.06,-t*.06,t*.012,0,Math.PI*2),e.fill()
  }
});
m({
  id:"pear-stickers",name:"贴满的梨",group:"parody",anchor:null,draw(e,t){
    e.save(),it(e,t*.95),e.fillStyle="#E7EE8A",e.fill(),e.clip();
    const l=["#E25B45","#F4A4B8","#F0C14A","#8EB7D6","#CDB6E8","#fff"];
    for(let n=0;
    n<12;
    n++){
      const i=n*1.3,o=n%4*t*.04;
      e.beginPath(),n%2===0&&(B(e,t*.06,t*.025,5),e.translate(Math.cos(i)*(t*.12+o)-t*.08,Math.sin(i)*(t*.12+o))),e.fillStyle=l[n%l.length],e.beginPath(),e.arc(Math.cos(i)*t*.16,Math.sin(i)*t*.18,t*.045,0,Math.PI*2),e.fill()
    }e.restore(),it(e,t*.95),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.stroke(),St(e,t)
  }
});
function yn(e,t,l,n){
  e.beginPath(),e.arc(0,0,t*.36,0,Math.PI*2),e.fillStyle="#fff",e.fill(),e.lineWidth=t*.03,e.strokeStyle=n,e.stroke(),e.beginPath(),e.arc(0,0,t*.3,0,Math.PI*2),e.lineWidth=t*.012,e.stroke(),e.fillStyle=n,e.font="700 "+Math.round(t*.16)+'px "Smiley Sans", sans-serif',e.textAlign="center",e.textBaseline="middle",e.fillText(l,0,t*.01);
  for(let i=0;
  i<6;
  i++){
    const o=i/6*Math.PI*2;
    e.beginPath(),e.arc(Math.cos(o)*t*.22,Math.sin(o)*t*.22,t*.012,0,Math.PI*2),e.fill()
  }
}m({
  id:"seal-supreme",name:"至尊印",group:"parody",anchor:null,draw:(e,t)=>yn(e,t,"至尊","#E25B45")
});
m({
  id:"seal-blessed",name:"开光印",group:"parody",anchor:null,draw:(e,t)=>yn(e,t,"开光","#E2A63B")
});
m({
  id:"ticket-welfare",name:"福利机票",group:"parody",anchor:null,draw(e,t){
    e.save(),e.rotate(-.08),e.fillStyle="#fff",e.fillRect(-t*.4,-t*.18,t*.8,t*.36),e.strokeStyle="#E25B45",e.lineWidth=t*.02,e.strokeRect(-t*.4,-t*.18,t*.8,t*.36),e.fillStyle="#E25B45",e.font=Math.round(t*.16)+'px "Smiley Sans", sans-serif',e.textAlign="center",e.textBaseline="middle",e.fillText("福利机",0,t*.01),e.restore()
  }
});
m({
  id:"stamp-unofficial",name:"非官方章",group:"parody",anchor:null,draw(e,t){
    e.save(),e.rotate(-.12),e.strokeStyle="#E25B45",e.lineWidth=t*.02,e.strokeRect(-t*.4,-t*.16,t*.8,t*.32),e.fillStyle="#E25B45",e.font=Math.round(t*.13)+'px "Smiley Sans", sans-serif',e.textAlign="center",e.textBaseline="middle",e.fillText("非官方",0,0),e.restore()
  }
});
m({
  id:"stamp-nocase",name:"勿戴壳章",group:"parody",anchor:null,draw(e,t){
    e.save(),e.rotate(.1),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.setLineDash([t*.04,t*.03]),e.strokeRect(-t*.42,-t*.16,t*.84,t*.34),e.setLineDash([]),e.fillStyle="#2C241C",e.font=Math.round(t*.14)+'px "Smiley Sans", sans-serif',e.textAlign="center",e.textBaseline="middle",e.fillText("请勿戴壳",0,t*.01),e.restore()
  }
});
const zt=[{
  id:"heart-mint",name:"薄荷爱心",group:"cute",draw:(e,t)=>F(e,t,()=>ie(e,t),"#7EBEA6",!0)
},{
  id:"heart-gold",name:"金色爱心",group:"cute",draw:(e,t)=>F(e,t,()=>ie(e,t),"#F0C14A",!0)
},{
  id:"star-lilac",name:"淡紫星星",group:"cute",draw:(e,t)=>F(e,t,()=>B(e,t*.4,t*.17,5),"#CDB6E8",!0)
},{
  id:"star-white",name:"白星星",group:"cute",draw:(e,t)=>F(e,t,()=>B(e,t*.4,t*.17,5),"#FFFDF8",!0)
},{
  id:"daisy-mint",name:"薄荷雏菊",group:"cute",draw:(e,t)=>lt(e,t,8,"#D9FFF2","#F0C14A")
},{
  id:"tulip-lilac",name:"紫郁金香",group:"cute",draw:(e,t)=>lt(e,t,6,"#E3D2F5","#F4A4B8")
},{
  id:"leaf-gold",name:"秋叶",group:"cute",draw:(e,t)=>F(e,t,()=>ft(e,t),"#E2A63B",!0)
},{
  id:"bow-mint",name:"薄荷蝴蝶结",group:"cute",draw:(e,t)=>ge(e,t,"#7EBEA6",!1)
},{
  id:"rose-coral",name:"珊瑚玫瑰",group:"cute",draw:(e,t)=>ut(e,t,"#E25B45")
},{
  id:"bead-gold",name:"金玻璃珠",group:"cute",draw:(e,t)=>Pe(e,t,"#F0C14A")
},{
  id:"bead-lilac",name:"紫玻璃珠",group:"cute",draw:(e,t)=>Pe(e,t,"#CDB6E8")
},{
  id:"sun-pink",name:"粉太阳",group:"cute",draw:(e,t)=>ht(e,t,"#F4A4B8")
},{
  id:"spark-pink",name:"粉闪光",group:"cute",draw:(e,t)=>F(e,t,()=>B(e,t*.36,t*.08,4),"#F4A4B8",!1)
},{
  id:"spark-blue",name:"蓝闪光",group:"cute",draw:(e,t)=>F(e,t,()=>B(e,t*.36,t*.08,4),"#8EB7D6",!1)
},{
  id:"plat-pink",name:"粉铂星",group:"y2k",draw:(e,t)=>D(e,t,()=>B(e,t*.4,t*.16,4),"#FFE4F0","#F4A4B8")
},{
  id:"bolt-white",name:"白闪电",group:"y2k",draw:(e,t)=>D(e,t,()=>gn(e,t),"#ffffff","#D5DBE3")
},{
  id:"pop-yellow",name:"黄棒棒糖",group:"y2k",draw:(e,t)=>D(e,t,()=>{
    e.beginPath(),e.arc(0,-t*.08,t*.24,0,Math.PI*2)
  },"#FFF3B0","#F0C14A")
},{
  id:"fly-gold",name:"金蝴蝶",group:"y2k",draw:(e,t)=>ct(e,t,"#FFF6D0","#E2A63B")
},{
  id:"planet-gold",name:"金行星",group:"y2k",draw:(e,t)=>pt(e,t,"#F0C14A")
},{
  id:"gem-gold",name:"金宝石",group:"y2k",draw:(e,t)=>gt(e,t,"#FFF6D0","#E2A63B")
},{
  id:"flame-gold",name:"金火焰",group:"y2k",draw:(e,t)=>mt(e,t,"#FFF6D0","#E2A63B")
},{
  id:"jag-gold",name:"锯齿金星",group:"y2k",draw:(e,t)=>D(e,t,()=>B(e,t*.34,t*.14,5),"#FFF3B0","#E2A63B")
},{
  id:"smile-blue",name:"蓝笑脸",group:"y2k",draw:(e,t)=>yt(e,t,"#8EB7D6")
},{
  id:"ring-gold",name:"金圈",group:"lens",draw(e,t){
    const R=t*.348,W=Math.max(1.2,t*.048);
    e.beginPath(),e.arc(0,0,R,0,Math.PI*2);
    const l=e.createLinearGradient(-R,-R,R*.6,R);
    l.addColorStop(0,"#FFE9AE"),l.addColorStop(.45,"#E2A63B"),l.addColorStop(.78,"#C98B26"),l.addColorStop(1,"#F2C766"),e.strokeStyle=l,e.lineWidth=W,e.stroke()
  }}];
for(let e=0;
e<zt.length;
e++){
  const t=zt[e];
  m({
    id:t.id,name:t.name,group:t.group,anchor:t.group==="lens"?"wrap":null,draw:t.draw
  })
}
/* —— extra stickers —— */
m({id:"moon-cream",name:"奶油月亮",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.arc(0,0,t*.34,0,Math.PI*2)},"#F6E7B8",!0);
  e.globalCompositeOperation="destination-out",e.beginPath(),e.arc(t*.16,-t*.08,t*.28,0,Math.PI*2),e.fill(),e.globalCompositeOperation="source-over";
  e.fillStyle="#F0C14A",e.beginPath(),e.arc(-t*.1,-t*.08,t*.035,0,Math.PI*2),e.fill();
}});
m({id:"ghost-soft",name:"软萌幽灵",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.moveTo(-t*.28,t*.08),e.quadraticCurveTo(-t*.3,-t*.34,0,-t*.36),e.quadraticCurveTo(t*.3,-t*.34,t*.28,t*.08),e.lineTo(t*.18,t*.28),e.lineTo(t*.06,t*.16),e.lineTo(0,t*.28),e.lineTo(-t*.06,t*.16),e.lineTo(-t*.18,t*.28),e.closePath()},"#FFFDF8",!0);
  e.fillStyle="#2C241C",e.beginPath(),e.arc(-t*.1,-t*.08,t*.04,0,Math.PI*2),e.fill(),e.beginPath(),e.arc(t*.1,-t*.08,t*.04,0,Math.PI*2),e.fill();
  e.beginPath(),e.arc(0,t*.04,t*.07,0,Math.PI),e.strokeStyle="#2C241C",e.lineWidth=t*.025,e.stroke();
}});
m({id:"cat-face",name:"小猫脸",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.arc(0,t*.04,t*.3,0,Math.PI*2)},"#FFE4B8",!0);
  e.fillStyle="#FFE4B8",e.beginPath(),e.moveTo(-t*.28,-t*.08),e.lineTo(-t*.18,-t*.34),e.lineTo(-t*.04,-t*.12),e.closePath(),e.fill();
  e.beginPath(),e.moveTo(t*.28,-t*.08),e.lineTo(t*.18,-t*.34),e.lineTo(t*.04,-t*.12),e.closePath(),e.fill();
  e.fillStyle="#2C241C",e.beginPath(),e.arc(-t*.1,0,t*.035,0,Math.PI*2),e.fill(),e.beginPath(),e.arc(t*.1,0,t*.035,0,Math.PI*2),e.fill();
  e.beginPath(),e.moveTo(0,t*.04),e.lineTo(-t*.04,t*.12),e.lineTo(t*.04,t*.12),e.closePath(),e.fillStyle="#F4A4B8",e.fill();
}});
m({id:"frog",name:"小青蛙",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.ellipse(0,t*.06,t*.3,t*.24,0,0,Math.PI*2)},"#8FCB6E",!0);
  e.fillStyle="#8FCB6E",e.beginPath(),e.arc(-t*.14,-t*.12,t*.1,0,Math.PI*2),e.fill(),e.beginPath(),e.arc(t*.14,-t*.12,t*.1,0,Math.PI*2),e.fill();
  e.fillStyle="#fff",e.beginPath(),e.arc(-t*.14,-t*.12,t*.07,0,Math.PI*2),e.fill(),e.beginPath(),e.arc(t*.14,-t*.12,t*.07,0,Math.PI*2),e.fill();
  e.fillStyle="#2C241C",e.beginPath(),e.arc(-t*.14,-t*.12,t*.035,0,Math.PI*2),e.fill(),e.beginPath(),e.arc(t*.14,-t*.12,t*.035,0,Math.PI*2),e.fill();
}});
m({id:"chick",name:"小鸡",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.arc(0,0,t*.3,0,Math.PI*2)},"#FFE28A",!0);
  e.fillStyle="#2C241C",e.beginPath(),e.arc(-t*.08,-t*.04,t*.03,0,Math.PI*2),e.fill(),e.beginPath(),e.arc(t*.08,-t*.04,t*.03,0,Math.PI*2),e.fill();
  e.fillStyle="#F0A03A",e.beginPath(),e.moveTo(0,t*.02),e.lineTo(-t*.07,t*.1),e.lineTo(t*.07,t*.1),e.closePath(),e.fill();
}});
m({id:"donut",name:"甜甜圈",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.arc(0,0,t*.34,0,Math.PI*2)},"#E8A878",!0);
  e.beginPath(),e.arc(0,0,t*.34,0,Math.PI*2),e.fillStyle="#F4A4C8",e.fill();
  e.globalCompositeOperation="destination-out",e.beginPath(),e.arc(0,0,t*.12,0,Math.PI*2),e.fill(),e.globalCompositeOperation="source-over";
  for(const[a,b,c]of[[-0.16,-0.1,"#7EBEA6"],[0.12,-0.14,"#F0C14A"],[0.08,0.14,"#8EB7D6"],[-0.1,0.12,"#E25B45"]])e.beginPath(),e.arc(t*a,t*b,t*.035,0,Math.PI*2),e.fillStyle=c,e.fill();
}});
m({id:"icecream",name:"甜筒",group:"cute",draw:(e,t)=>{
  e.fillStyle="#E8C9A0",e.beginPath(),e.moveTo(0,t*.36),e.lineTo(-t*.16,t*.02),e.lineTo(t*.16,t*.02),e.closePath(),e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.stroke();
  F(e,t,()=>{e.beginPath(),e.arc(0,-t*.02,t*.18,0,Math.PI*2)},"#F4A4B8",!0);
  e.fillStyle="#FFFDF8",e.beginPath(),e.arc(0,-t*.2,t*.12,0,Math.PI*2),e.fill();
}});
m({id:"peach",name:"水蜜桃",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.moveTo(0,t*.32),e.bezierCurveTo(-t*.42,t*.1,-t*.34,-t*.28,0,-t*.1),e.bezierCurveTo(t*.34,-t*.28,t*.42,t*.1,0,t*.32)},"#FFB3A8",!0);
  e.strokeStyle="#6FA15A",e.lineWidth=t*.03,e.beginPath(),e.moveTo(0,-t*.1),e.quadraticCurveTo(t*.08,-t*.28,t*.18,-t*.22),e.stroke();
}});
m({id:"watermelon",name:"西瓜片",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.moveTo(-t*.34,t*.1),e.arc(0,t*.1,t*.34,Math.PI,0),e.closePath()},"#F56B6B",!0);
  e.beginPath(),e.moveTo(-t*.34,t*.1),e.arc(0,t*.1,t*.34,Math.PI,0),e.lineWidth=t*.06,e.strokeStyle="#7EBEA6",e.stroke();
  e.fillStyle="#2C241C";for(const x of[-0.12,0,0.12])e.beginPath(),e.ellipse(t*x,t*.02,t*.025,t*.04,0,0,Math.PI*2),e.fill();
}});
m({id:"balloon",name:"气球",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.ellipse(0,-t*.06,t*.22,t*.28,0,0,Math.PI*2)},"#FF7A70",!0);
  e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.beginPath(),e.moveTo(0,t*.2),e.quadraticCurveTo(t*.08,t*.3,0,t*.38),e.stroke();
  e.fillStyle="rgba(255,255,255,.45)",e.beginPath(),e.ellipse(-t*.08,-t*.14,t*.05,t*.09, -.4,0,Math.PI*2),e.fill();
}});
m({id:"kiss",name:"唇印",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.moveTo(-t*.28,0),e.quadraticCurveTo(-t*.2,-t*.2,0,-t*.08),e.quadraticCurveTo(t*.2,-t*.2,t*.28,0),e.quadraticCurveTo(t*.16,t*.22,0,t*.14),e.quadraticCurveTo(-t*.16,t*.22,-t*.28,0)},"#E25B45",!0);
}});
m({id:"tea",name:"奶茶",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.moveTo(-t*.2,-t*.08),e.lineTo(-t*.24,t*.3),e.lineTo(t*.24,t*.3),e.lineTo(t*.2,-t*.08),e.closePath()},"#F3D5B5",!0);
  e.fillStyle="#C98B5A",e.fillRect(-t*.2,-t*.08,t*.4,t*.12);
  e.strokeStyle="#2C241C",e.lineWidth=t*.025,e.beginPath(),e.moveTo(t*.08,-t*.2),e.lineTo(t*.08,t*.28),e.stroke();
}});
m({id:"gift",name:"礼物盒",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.rect(-t*.26,-t*.08,t*.52,t*.36)},"#FF7A70",!0);
  e.fillStyle="#F0C14A",e.fillRect(-t*.06,-t*.08,t*.12,t*.36),e.fillRect(-t*.26,t*.04,t*.52,t*.1);
  e.fillStyle="#FF7A70",e.beginPath(),e.arc(-t*.08,-t*.16,t*.1,Math.PI*.2,Math.PI*1.2),e.arc(t*.08,-t*.16,t*.1,-.2,Math.PI*.8),e.fill();
}});
m({id:"snow",name:"雪花",group:"cute",draw:(e,t)=>{
  e.strokeStyle="#8EB7D6",e.lineWidth=t*.04,e.lineCap="round";
  for(let i=0;i<6;i++){e.save(),e.rotate(i*Math.PI/3),e.beginPath(),e.moveTo(0,0),e.lineTo(0,-t*.32),e.moveTo(0,-t*.18),e.lineTo(-t*.08,-t*.26),e.moveTo(0,-t*.18),e.lineTo(t*.08,-t*.26),e.stroke(),e.restore()}
}});
m({id:"music",name:"音符",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.ellipse(-t*.12,t*.16,t*.12,t*.09, -.3,0,Math.PI*2)},"#5B7CDE",!0);
  e.fillStyle="#5B7CDE",e.fillRect(t*.02,-t*.28,t*.05,t*.42);
  e.beginPath(),e.moveTo(t*.07,-t*.28),e.quadraticCurveTo(t*.28,-t*.2,t*.22,-t*.02),e.lineTo(t*.07,-t*.08),e.closePath(),e.fill();
}});
m({id:"cam-mini",name:"小相机",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.rect(-t*.3,-t*.16,t*.6,t*.4)},"#E8EEF4",!0);
  e.fillStyle="#2C241C",e.beginPath(),e.arc(0,t*.04,t*.14,0,Math.PI*2),e.fill();
  e.fillStyle="#8EB7D6",e.beginPath(),e.arc(0,t*.04,t*.08,0,Math.PI*2),e.fill();
  e.fillStyle="#E25B45",e.beginPath(),e.arc(t*.2,-t*.08,t*.04,0,Math.PI*2),e.fill();
}});
m({id:"ufo",name:"飞碟",group:"y2k",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.ellipse(0,0,t*.34,t*.12,0,0,Math.PI*2)},"#CDB6E8",!0);
  e.fillStyle="#FFFDF8",e.beginPath(),e.ellipse(0,-t*.08,t*.16,t*.12,0,0,Math.PI*2),e.fill();
  for(const x of[-0.18,0,0.18])e.beginPath(),e.arc(t*x,t*.04,t*.035,0,Math.PI*2),e.fillStyle="#F0C14A",e.fill();
}});
m({id:"alien",name:"小外星人",group:"y2k",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.ellipse(0,0,t*.24,t*.3,0,0,Math.PI*2)},"#B6F0A8",!0);
  e.fillStyle="#2C241C",e.beginPath(),e.ellipse(-t*.1,-t*.02,t*.08,t*.12,0,0,Math.PI*2),e.fill(),e.beginPath(),e.ellipse(t*.1,-t*.02,t*.08,t*.12,0,0,Math.PI*2),e.fill();
}});
m({id:"disc-pink",name:"粉碟片",group:"y2k",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.arc(0,0,t*.34,0,Math.PI*2)},"#F4A4C8",!0);
  e.fillStyle="#FFFDF8",e.beginPath(),e.arc(0,0,t*.1,0,Math.PI*2),e.fill();
  e.strokeStyle="rgba(255,255,255,.5)",e.lineWidth=t*.02,e.beginPath(),e.arc(0,0,t*.22,0,Math.PI*2),e.stroke();
}});
m({id:"bolt-mint",name:"薄荷闪电",group:"y2k",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.moveTo(t*.05,-t*.34),e.lineTo(-t*.16,t*.02),e.lineTo(t*.02,t*.02),e.lineTo(-t*.05,t*.34),e.lineTo(t*.16,-t*.02),e.lineTo(-t*.02,-t*.02),e.closePath()},"#7EBEA6",!0);
}});
m({id:"star-jag",name:"锯齿星",group:"y2k",draw:(e,t)=>F(e,t,()=>B(e,t*.38,t*.14,8),"#F0C14A",!0)});
m({id:"heart-neon",name:"霓虹心",group:"y2k",draw:(e,t)=>{
  ie(e,t),e.strokeStyle="#FF5C9A",e.lineWidth=t*.07,e.stroke();
  ie(e,t),e.strokeStyle="#FFF0F6",e.lineWidth=t*.03,e.stroke();
}});
m({id:"glasses",name:"墨镜",group:"y2k",draw:(e,t)=>{
  e.fillStyle="#2C241C",e.fillRect(-t*.34,-t*.1,t*.28,t*.2),e.fillRect(t*.06,-t*.1,t*.28,t*.2);
  e.strokeStyle="#2C241C",e.lineWidth=t*.035,e.beginPath(),e.moveTo(-t*.06,0),e.lineTo(t*.06,0),e.stroke();
}});
m({id:"crown-gold",name:"金冠",group:"lens",anchor:"wrap",draw:(e,t)=>{
  e.translate(0,-t*.42);
  F(e,t,()=>{e.beginPath(),e.moveTo(-t*.28,t*.12),e.lineTo(-t*.28,-t*.08),e.lineTo(-t*.12,t*.04),e.lineTo(0,-t*.16),e.lineTo(t*.12,t*.04),e.lineTo(t*.28,-t*.08),e.lineTo(t*.28,t*.12),e.closePath()},"#F0C14A",!0);
}});
m({id:"sparkles-ring",name:"闪闪圈",group:"lens",anchor:"wrap",draw:(e,t)=>{
  const R=t*.36;
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI*2/10;e.save(),e.translate(Math.cos(a)*R,Math.sin(a)*R),e.rotate(a),B(e,t*.07,t*.025,4),e.fillStyle=i%2?"#FFFDF8":"#F0C14A",e.fill(),e.restore()}
}});
m({id:"leaf-ring",name:"叶子圈",group:"lens",anchor:"wrap",draw:(e,t)=>{
  const R=t*.36;
  for(let i=0;i<8;i++){const a=i*Math.PI/4;e.save(),e.translate(Math.cos(a)*R,Math.sin(a)*R),e.rotate(a+Math.PI/2),e.beginPath(),e.ellipse(0,0,t*.05,t*.1,0,0,Math.PI*2),e.fillStyle="#7EBEA6",e.fill(),e.restore()}
}});
m({id:"stamp-lucky",name:"好运章",group:"parody",draw:(e,t)=>{
  e.strokeStyle="#E25B45",e.lineWidth=t*.04,e.beginPath(),e.arc(0,0,t*.34,0,Math.PI*2),e.stroke();
  e.beginPath(),e.arc(0,0,t*.26,0,Math.PI*2),e.stroke();
  e.fillStyle="#E25B45",e.font=`bold ${Math.round(t*.22)}px sans-serif`,e.textAlign="center",e.textBaseline="middle",e.fillText("好运",0,t*.02);
}});
m({id:"stamp-hot",name:"爆款章",group:"parody",draw:(e,t)=>{
  e.fillStyle="#E25B45",e.beginPath(),e.moveTo(0,-t*.34);for(let i=0;i<16;i++){const a=-Math.PI/2+i*Math.PI/8,r=i%2?t*.28:t*.36;e.lineTo(Math.cos(a)*r,Math.sin(a)*r)}e.closePath(),e.fill();
  e.fillStyle="#FFF8F1",e.font=`bold ${Math.round(t*.2)}px sans-serif`,e.textAlign="center",e.textBaseline="middle",e.fillText("爆款",0,t*.02);
}});
/* —— pack v2: aliases + fresh stickers —— */
m({id:"heart-coral",name:"珊瑚心",group:"cute",draw:(e,t)=>F(e,t,()=>ie(e,t),"#E25B45",!0)});
m({id:"heart-pink",name:"粉红心",group:"cute",draw:(e,t)=>F(e,t,()=>ie(e,t),"#F4A4B8",!0)});
m({id:"daisy-white",name:"白雏菊",group:"cute",draw:(e,t)=>lt(e,t,8,"#FFFDF8","#F0C14A")});
m({id:"daisy-pink",name:"粉雏菊",group:"cute",draw:(e,t)=>lt(e,t,8,"#FFE4F0","#F4A4B8")});
m({id:"star-gold",name:"金星星",group:"cute",draw:(e,t)=>F(e,t,()=>B(e,t*.4,t*.17,5),"#F0C14A",!0)});
m({id:"leaf-mint",name:"薄荷叶",group:"cute",draw:(e,t)=>F(e,t,()=>ft(e,t),"#7EBEA6",!0)});
m({id:"plat-gold",name:"金铂星",group:"y2k",draw:(e,t)=>D(e,t,()=>B(e,t*.4,t*.16,4),"#FFF6D0","#E2A63B")});
m({id:"bolt-yellow",name:"黄闪电",group:"y2k",draw:(e,t)=>D(e,t,()=>gn(e,t),"#FFE28A","#F0C14A")});
m({id:"pop-pink",name:"粉棒棒糖",group:"y2k",draw:(e,t)=>D(e,t,()=>{e.beginPath(),e.arc(0,-t*.08,t*.24,0,Math.PI*2)},"#FFD0E4","#F4A4B8")});
m({id:"jag-pink",name:"锯齿粉星",group:"y2k",draw:(e,t)=>D(e,t,()=>B(e,t*.34,t*.14,8),"#FFE4F0","#F4A4B8")});
m({id:"crystal-pink",name:"粉水晶",group:"y2k",draw:(e,t)=>gt(e,t,"#FFE4F0","#F4A4B8")});
m({id:"balloon",name:"气球",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.ellipse(0,-t*.06,t*.22,t*.28,0,0,Math.PI*2)},"#FF8B7A",!0);
  e.fillStyle="#FF8B7A",e.beginPath(),e.moveTo(0,t*.2),e.lineTo(-t*.05,t*.28),e.lineTo(t*.05,t*.28),e.closePath(),e.fill();
  e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.beginPath(),e.moveTo(0,t*.28),e.quadraticCurveTo(t*.08,t*.4,-t*.02,t*.48),e.stroke();
}});
m({id:"camera-mini",name:"迷你相机",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.moveTo(-t*.24,-t*.2),e.lineTo(t*.24,-t*.2),e.quadraticCurveTo(t*.32,-t*.2,t*.32,-t*.12),e.lineTo(t*.32,t*.12),e.quadraticCurveTo(t*.32,t*.2,t*.24,t*.2),e.lineTo(-t*.24,t*.2),e.quadraticCurveTo(-t*.32,t*.2,-t*.32,t*.12),e.lineTo(-t*.32,-t*.12),e.quadraticCurveTo(-t*.32,-t*.2,-t*.24,-t*.2),e.closePath()},"#FFFDF8",!0);
  e.fillStyle="#2C241C",e.beginPath(),e.arc(0,0,t*.14,0,Math.PI*2),e.fill();
  e.fillStyle="#8EB7D6",e.beginPath(),e.arc(0,0,t*.08,0,Math.PI*2),e.fill();
  e.fillStyle="#E25B45",e.beginPath(),e.arc(t*.2,-t*.1,t*.04,0,Math.PI*2),e.fill();
}});
m({id:"milk-tea",name:"奶茶",group:"cute",draw:(e,t)=>{
  e.fillStyle="#F0C14A",e.fillRect(-t*.16,-t*.34,t*.32,t*.08);
  F(e,t,()=>{e.beginPath(),e.moveTo(-t*.2,-t*.26),e.lineTo(-t*.16,t*.3),e.lineTo(t*.16,t*.3),e.lineTo(t*.2,-t*.26),e.closePath()},"#F6E0C0",!0);
  e.fillStyle="#C48A4A",e.globalAlpha=.55,e.fillRect(-t*.16,-t*.1,t*.32,t*.28),e.globalAlpha=1;
  e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.beginPath(),e.moveTo(t*.06,-t*.34),e.lineTo(t*.06,-t*.48),e.stroke();
}});
m({id:"sushi",name:"寿司",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.ellipse(0,0,t*.34,t*.2,0,0,Math.PI*2)},"#3D4A3A",!0);
  e.fillStyle="#FFFDF8",e.beginPath(),e.ellipse(0,0,t*.22,t*.12,0,0,Math.PI*2),e.fill();
  e.fillStyle="#E25B45",e.beginPath(),e.ellipse(0,0,t*.12,t*.07,0,0,Math.PI*2),e.fill();
}});
m({id:"ramen",name:"拉面",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.arc(0,t*.06,t*.32,0,Math.PI*2)},"#FFFDF8",!0);
  e.fillStyle="#F0C14A",e.beginPath(),e.arc(0,t*.04,t*.24,0,Math.PI*2),e.fill();
  e.strokeStyle="#E8C9A0",e.lineWidth=t*.03,e.beginPath(),e.moveTo(-t*.14,0),e.quadraticCurveTo(0,t*.12,t*.14,0),e.stroke();
  e.fillStyle="#E25B45",e.beginPath(),e.ellipse(-t*.08,-t*.02,t*.07,t*.04, -.3,0,Math.PI*2),e.fill();
}});
m({id:"gamepad",name:"手柄",group:"y2k",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.moveTo(-t*.34,0),e.arc(-t*.18,0,t*.16,Math.PI*.5,Math.PI*1.5),e.lineTo(t*.18,-t*.16),e.arc(t*.18,0,t*.16,-Math.PI*.5,Math.PI*.5),e.closePath()},"#E8ECF2",!0);
  e.fillStyle="#E25B45",e.beginPath(),e.arc(-t*.18,0,t*.05,0,Math.PI*2),e.fill();
  e.fillStyle="#2EC4B6",e.beginPath(),e.arc(t*.14,-t*.05,t*.035,0,Math.PI*2),e.fill();
  e.fillStyle="#F0C14A",e.beginPath(),e.arc(t*.22,t*.04,t*.035,0,Math.PI*2),e.fill();
}});
m({id:"cassette",name:"磁带",group:"y2k",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.rect(-t*.34,-t*.22,t*.68,t*.44)},"#CDB6E8",!0);
  e.fillStyle="#FFFDF8",e.fillRect(-t*.22,-t*.08,t*.44,t*.16);
  e.fillStyle="#2C241C",e.beginPath(),e.arc(-t*.1,0,t*.06,0,Math.PI*2),e.fill(),e.beginPath(),e.arc(t*.1,0,t*.06,0,Math.PI*2),e.fill();
}});
m({id:"dice",name:"骰子",group:"y2k",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.rect(-t*.26,-t*.26,t*.52,t*.52)},"#FFFDF8",!0);
  e.fillStyle="#2C241C";
  for(const[a,b]of[[0,0],[-0.12,-0.12],[0.12,0.12],[-0.12,0.12],[0.12,-0.12]])e.beginPath(),e.arc(t*a,t*b,t*.045,0,Math.PI*2),e.fill();
}});
m({id:"lightning-bolt",name:"闪电图标",group:"y2k",draw:(e,t)=>D(e,t,()=>gn(e,t),"#B8F2E6","#2EC4B6")});
m({id:"star-bubble",name:"泡泡星",group:"cute",draw:(e,t)=>{
  F(e,t,()=>B(e,t*.38,t*.16,5),"#B8E0FF",!0);
  e.fillStyle="rgba(255,255,255,.7)",e.beginPath(),e.arc(-t*.08,-t*.08,t*.06,0,Math.PI*2),e.fill();
}});
m({id:"peach",name:"水蜜桃",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.arc(-t*.08,t*.04,t*.22,0,Math.PI*2),e.arc(t*.08,t*.04,t*.22,0,Math.PI*2)},"#FFB7A5",!0);
  e.fillStyle="#7EBEA6",e.beginPath(),e.ellipse(0,-t*.2,t*.1,t*.06,0,0,Math.PI*2),e.fill();
}});
m({id:"avocado",name:"牛油果",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.ellipse(0,0,t*.24,t*.34,0,0,Math.PI*2)},"#8FCB6E",!0);
  e.fillStyle="#C6E59A",e.beginPath(),e.ellipse(0,0,t*.14,t*.22,0,0,Math.PI*2),e.fill();
  e.fillStyle="#6B4A2A",e.beginPath(),e.ellipse(0,t*.04,t*.07,t*.09,0,0,Math.PI*2),e.fill();
}});
m({id:"boba",name:"珍珠奶茶",group:"cute",draw:(e,t)=>{
  F(e,t,()=>{e.beginPath(),e.moveTo(-t*.18,-t*.2),e.lineTo(-t*.14,t*.3),e.lineTo(t*.14,t*.3),e.lineTo(t*.18,-t*.2),e.closePath()},"#F6E0C0",!0);
  e.fillStyle="#C48A4A",e.globalAlpha=.5,e.fillRect(-t*.14,-t*.05,t*.28,t*.28),e.globalAlpha=1;
  e.fillStyle="#2C241C";for(const[a,b]of[[-0.06,0.18],[0.05,0.2],[0,0.12]])e.beginPath(),e.arc(t*a,t*b,t*.035,0,Math.PI*2),e.fill();
  e.fillStyle="#F0C14A",e.fillRect(-t*.16,-t*.28,t*.32,t*.08);
}});
m({id:"ufo",name:"飞碟",group:"y2k",draw:(e,t)=>{
  e.fillStyle="#B8F2E6",e.beginPath(),e.ellipse(0,-t*.08,t*.14,t*.1,0,0,Math.PI*2),e.fill(),e.strokeStyle="#2C241C",e.lineWidth=t*.02,e.stroke();
  F(e,t,()=>{e.beginPath(),e.ellipse(0,t*.04,t*.34,t*.12,0,0,Math.PI*2)},"#E8ECF2",!0);
  e.fillStyle="#F0C14A";for(let i=-2;i<=2;i++)e.beginPath(),e.arc(t*i*.1,t*.04,t*.03,0,Math.PI*2),e.fill();
}});
m({id:"pixel-heart",name:"像素心",group:"y2k",draw:(e,t)=>{
  const s=t*.08;e.fillStyle="#E25B45";
  const cells=[[-2,-1],[-1,-2],[0,-1],[1,-2],[2,-1],[2,0],[1,1],[0,2],[-1,1],[-2,0],[-1,-1],[0,-1],[0,0],[1,-1],[1,0],[0,1]];
  for(const[a,b]of cells)e.fillRect(a*s,b*s,s*.95,s*.95);
  e.strokeStyle="#2C241C",e.lineWidth=t*.015,e.strokeRect(-2.05*s,-2.05*s,4.1*s,4.6*s);
}});


const AI_PACK=[
  {id:"ai-bunny",name:"小兔",group:"cute",file:"st-bunny.webp"},
  {id:"ai-cat",name:"小猫",group:"cute",file:"st-cat.webp"},
  {id:"ai-bear",name:"小熊",group:"cute",file:"st-bear.webp"},
  {id:"ai-sheep",name:"小羊",group:"cute",file:"st-sheep.webp"},
  {id:"ai-heart",name:"甜心",group:"cute",file:"st-heart.webp"},
  {id:"ai-bow",name:"蝴蝶结",group:"cute",file:"st-bow.webp"},
  {id:"ai-cherry",name:"樱桃",group:"cute",file:"st-cherry.webp"},
  {id:"ai-peach",name:"蜜桃",group:"cute",file:"st-peach.webp"},
  {id:"ai-berry",name:"草莓",group:"cute",file:"st-berry.webp"},
  {id:"ai-daisy",name:"小花",group:"cute",file:"st-daisy.webp"},
  {id:"ai-rose",name:"玫瑰",group:"cute",file:"st-rose.webp"},
  {id:"ai-cloud",name:"软云",group:"cute",file:"st-cloud.webp"},
  {id:"ai-moon",name:"月亮",group:"cute",file:"st-moon.webp"},
  {id:"ai-donut",name:"甜甜圈",group:"cute",file:"st-donut.webp"},
  {id:"ai-boba",name:"奶茶",group:"cute",file:"st-boba.webp"},
  {id:"ai-icecream",name:"甜筒",group:"cute",file:"st-icecream.webp"},
  {id:"ai-cam",name:"相机",group:"cute",file:"st-cam.webp"},
  {id:"ai-star",name:"星星",group:"y2k",file:"st-star.webp"},
  {id:"ai-sparkle",name:"闪光",group:"y2k",file:"st-sparkle.webp"},
  {id:"ai-butterfly",name:"蝴蝶",group:"y2k",file:"st-butterfly.webp"},
  {id:"ai-cd",name:"镭射碟",group:"y2k",file:"st-cd.webp"},
  {id:"ai-lipstick",name:"口红",group:"y2k",file:"st-lipstick.webp"},
  {id:"ai-kiss",name:"唇印",group:"y2k",file:"st-kiss.webp"},
  {id:"ai-rainbow",name:"彩虹",group:"y2k",file:"st-rainbow.webp"},
  {id:"ai-gem",name:"宝石",group:"y2k",file:"st-gem.webp"},
  {id:"ai-ring",name:"珍珠圈",group:"lens",file:"st-ring.webp",anchor:"lens"},
  {id:"ai-lens2",name:"钻戒圈",group:"lens",file:"st-lens2.webp",anchor:"lens"},
  {id:"ai-ears",name:"兔耳",group:"lens",file:"st-ears.webp",anchor:"above"},
  {id:"ai-catears",name:"猫耳",group:"lens",file:"st-catears.webp",anchor:"above"},
  {id:"ai-halo",name:"光环",group:"lens",file:"st-halo.webp",anchor:"above"},
  {id:"ai-wreath",name:"花环",group:"lens",file:"st-wreath.webp",anchor:"badge"},
  {id:"ai-cupcake",name:"纸杯蛋糕",group:"cute",file:"st-cupcake.webp"},
  {id:"ai-balloon",name:"气球狗",group:"cute",file:"st-balloon.webp"},
  {id:"ai-panda",name:"熊猫",group:"cute",file:"st-panda.webp"},
  {id:"ai-headphone",name:"耳机",group:"cute",file:"st-headphone.webp"},
  {id:"ai-milk",name:"牛奶盒",group:"cute",file:"st-milk.webp"},
  {id:"ai-chick",name:"小鸡",group:"cute",file:"st-chick.webp"},
  {id:"ai-tulip",name:"郁金香",group:"cute",file:"st-tulip.webp"},
  {id:"ai-badge",name:"勋章",group:"y2k",file:"st-badge.webp"},
  {id:"ai-crown",name:"皇冠",group:"y2k",file:"st-crown.webp"},
  {id:"ai-pearlring",name:"珍珠链圈",group:"lens",file:"st-pearlring.webp",anchor:"lens"},
  {id:"ai-ring-hollow",name:"奶油圈",group:"lens",file:"st-ring-hollow.webp",anchor:"lens"},
  {id:"ai-ring-star2",name:"星光圈",group:"lens",file:"st-ring-star2.webp",anchor:"lens"},
  {id:"ai-ring-bead",name:"串珠圈",group:"lens",file:"st-ring-bead.webp",anchor:"lens"},
  {id:"ai-hearts",name:"爱心雨",group:"deco",file:"st-hearts.webp"},
  {id:"ai-word-cute",name:"可爱字",group:"deco",file:"st-word-cute.webp"},
  {id:"ai-washi",name:"胶带",group:"deco",file:"st-washi.webp"},
  {id:"ai-glitters",name:"碎钻",group:"deco",file:"st-glitters.webp"},
  {id:"ai-music",name:"音符",group:"deco",file:"st-music.webp"},
  {id:"ai-clover2",name:"四叶草",group:"deco",file:"st-clover2.webp"},
  {id:"ai-stamp",name:"邮票",group:"deco",file:"st-stamp.webp"},
  {id:"ai-banner",name:"横幅",group:"deco",file:"st-banner.webp"},
  {id:"ai-minibow",name:"小蝴蝶结",group:"deco",file:"st-minibow.webp"},
  {id:"ai-wing",name:"蝶翼",group:"deco",file:"st-wing.webp"},
  {id:"ai-ribbon2",name:"丝带结",group:"deco",file:"st-ribbon2.webp"},
  {id:"ai-washi2",name:"紫心胶带",group:"deco",file:"st-washi2.webp"},
  {id:"ai-envelope",name:"信封",group:"deco",file:"st-envelope.webp"},
  {id:"ai-lollipop",name:"棒棒糖",group:"deco",file:"st-lollipop.webp"},
  {id:"ai-macaron",name:"马卡龙",group:"deco",file:"st-macaron.webp"},
  {id:"ai-key",name:"钥匙",group:"deco",file:"st-key.webp"},
  {id:"ai-polaroid",name:"拍立得",group:"deco",file:"st-polaroid.webp"},
  {id:"ai-gamepad",name:"手柄",group:"y2k",file:"st-gamepad.webp"},
  {id:"ai-snow",name:"雪花",group:"deco",file:"st-snow.webp"},
  {id:"ai-candy",name:"糖果",group:"deco",file:"st-candy.webp"},
  {id:"ai-paw",name:"爪印",group:"deco",file:"st-paw.webp"},
  {id:"ai-cam2",name:"粉相机",group:"cute",file:"st-cam2.webp"},
  {id:"ai-lock",name:"小锁",group:"deco",file:"st-lock.webp"},
  {id:"ai-latte",name:"拿铁",group:"deco",file:"st-latte.webp"},
  {id:"ai-crescent",name:"月牙",group:"y2k",file:"st-crescent.webp"},
  {id:"ai-notes",name:"音符",group:"deco",file:"st-notes.webp"},
  {id:"ai-pretzel",name:"蝴蝶脆",group:"deco",file:"st-pretzel.webp"},
  {id:"ai-croissant",name:"可颂",group:"deco",file:"st-croissant.webp"},
  {id:"ai-sunglasses",name:"墨镜",group:"y2k",file:"st-sunglasses.webp"},
  {id:"ai-bouquet",name:"花束",group:"deco",file:"st-bouquet.webp"},
  {id:"ai-cookie",name:"曲奇",group:"deco",file:"st-cookie.webp"},
  {id:"ai-dice",name:"骰子",group:"y2k",file:"st-dice.webp"},
  {id:"ai-frog",name:"小蛙",group:"cute",file:"st-frog.webp"},
  {id:"ai-duck",name:"小鸭",group:"cute",file:"st-duck.webp"},
  {id:"ai-bolt",name:"闪电",group:"y2k",file:"st-bolt.webp"},
  {id:"ai-pearls",name:"珍珠串",group:"deco",file:"st-pearls.webp"},
  {id:"ai-ghost",name:"小幽灵",group:"cute",file:"st-ghost.webp"},
  {id:"ai-waffle",name:"华夫饼",group:"deco",file:"st-waffle.webp"},
  {id:"ai-planet",name:"行星",group:"y2k",file:"st-planet.webp"},
  {id:"ai-fish",name:"小鱼",group:"cute",file:"st-fish.webp"},
  {id:"ai-film",name:"胶卷",group:"deco",file:"st-film.webp"},
  {id:"ai-leaf",name:"叶子",group:"deco",file:"st-leaf.webp"},
  {id:"ai-jellyfish",name:"水母",group:"deco",file:"el-jellyfish.webp"},
  {id:"ai-shell",name:"贝壳",group:"deco",file:"el-shell.webp"},
  {id:"ai-starfish",name:"海星",group:"deco",file:"el-starfish.webp"},
  {id:"ai-coral",name:"珊瑚",group:"deco",file:"el-coral.webp"},
  {id:"ai-seaweed",name:"海草",group:"deco",file:"el-seaweed.webp"},
  {id:"ai-bubbles",name:"气泡",group:"deco",file:"el-bubbles.webp"},
  {id:"ai-seahorse",name:"海马",group:"deco",file:"el-seahorse.webp"},
  {id:"ai-fishschool",name:"鱼群",group:"deco",file:"el-fishschool.webp"},
  {id:"ai-chest",name:"宝箱",group:"deco",file:"el-chest.webp"},
  {id:"ai-fireflies",name:"萤火虫",group:"deco",file:"el-fireflies.webp"},
  {id:"ai-petals",name:"花瓣",group:"deco",file:"el-petals.webp"},
  {id:"ai-mushroom",name:"蘑菇",group:"deco",file:"el-mushroom.webp"},
  {id:"ai-wp-ocean",name:"海底",group:"bg",file:"wp-ocean.webp"},
  {id:"ai-wp-night",name:"仲夏夜",group:"bg",file:"wp-night.webp"},
  {id:"ai-wp-sakura",name:"樱花",group:"bg",file:"wp-sakura.webp"},
  {id:"ai-wp-garden",name:"花园",group:"bg",file:"wp-garden.webp"},
  {id:"ai-wp-coquette",name:"甜心",group:"bg",file:"wp-coquette.webp"},
  {id:"ai-wp-cafe",name:"拿铁暖光",group:"bg",file:"wp-cafe.webp"},
  {id:"ai-wp-galaxy",name:"银河",group:"bg",file:"wp-galaxy.webp"},
  {id:"ai-wp-winter",name:"冬日",group:"bg",file:"wp-winter.webp"},
  {id:"ai-wp-beach",name:"海边日落",group:"bg",file:"wp-beach.webp"},
  {id:"ai-wp-autumn",name:"秋日",group:"bg",file:"wp-autumn.webp"},
  {id:"ai-wp-milk",name:"奶油云海",group:"bg",file:"wp-milk.webp"},
  {id:"ai-wp-strawberry",name:"草莓糖霜",group:"bg",file:"wp-strawberry.webp"},
  {id:"ai-wp-cloudy",name:"云画蓝天",group:"bg",file:"wp-cloudy.webp"},
  {id:"ai-wp-peach",name:"蜜桃黄昏",group:"bg",file:"wp-peach.webp"},
  {id:"ai-wp-matcha",name:"抹茶野餐",group:"bg",file:"wp-matcha.webp"},
  {id:"ai-wp-lemon",name:"柠檬汽水",group:"bg",file:"wp-lemon.webp"},
  {id:"ai-wp-lilac",name:"薰衣草夜",group:"bg",file:"wp-lilac.webp"},
  {id:"ai-wp-butterheart",name:"奶油心心",group:"bg",file:"wp-butterheart.webp"},
  {id:"ai-wp-mint",name:"薄荷海浪",group:"bg",file:"wp-mint.webp"},
  {id:"ai-wp-caramel",name:"焦糖拿铁",group:"bg",file:"wp-caramel.webp"},
  {id:"ai-wp-aurora",name:"极光夜空",group:"bg",file:"wp-aurora.webp"},
  {id:"ai-wp-daisy",name:"雏菊花田",group:"bg",file:"wp-daisy.webp"},
  {id:"ai-wp-cow",name:"奶牛纹",group:"bg",file:"wp-cow.webp"},
  {id:"ai-wp-snow",name:"雪夜小屋",group:"bg",file:"wp-snow.webp"},
  {id:"ai-wp-starfield",name:"星座图谱",group:"bg",file:"wp-starfield.webp"},
  {id:"ai-wp-rainbow",name:"彩虹棉花糖",group:"bg",file:"wp-rainbow.webp"},
  {id:"ai-wp-cherry",name:"夜樱",group:"bg",file:"wp-cherry.webp"}
];
const AI_IMG={};
function aiDraw(id){
  return function(e,t){
    const img=AI_IMG[id];
    if(!img||!img.complete||!img.naturalWidth)return;
    const ar=img.naturalWidth/Math.max(1,img.naturalHeight);
    let w=t,h=t;
    ar>=1?(w=t,h=t/ar):(h=t,w=t*ar);
    if(NV_RING[id]){
      const sz=Math.ceil(Math.max(w,h)*1.2),c=aiDraw._c||(aiDraw._c=document.createElement("canvas"));
      (c.width!==sz||c.height!==sz)&&(c.width=sz,c.height=sz);
      const g=c.getContext("2d");
      g.setTransform(1,0,0,1,0,0),g.clearRect(0,0,sz,sz),g.save(),g.translate(sz/2,sz/2),g.drawImage(img,-w/2,-h/2,w,h);
      g.globalCompositeOperation="destination-out",g.beginPath(),g.arc(0,0,Math.min(w,h)*.32,0,Math.PI*2),g.fill(),g.restore();
      e.drawImage(c,-sz/2,-sz/2)
    }else e.drawImage(img,-w/2,-h/2,w,h)
  }
}
function installAiStickers(){
  _.length=0;
  for(let i=0;i<AI_PACK.length;i++){
    const s=AI_PACK[i];
    m({id:s.id,name:s.name,group:s.group,anchor:s.anchor||null,draw:aiDraw(s.id)})
  }
  for(const k of Object.keys(Ct))delete Ct[k];
  for(let i=0;i<_.length;i++)Ct[_[i].id]=_[i];
  NV_ANCHOR["ai-ring"]="lens",NV_ANCHOR["ai-lens2"]="lens",NV_ANCHOR["ai-pearlring"]="lens",NV_ANCHOR["ai-ring-hollow"]="lens",NV_ANCHOR["ai-ring-star2"]="lens",NV_ANCHOR["ai-ring-bead"]="lens",NV_ANCHOR["ai-ears"]="above",NV_ANCHOR["ai-catears"]="above",NV_ANCHOR["ai-halo"]="above",NV_ANCHOR["ai-wreath"]="badge",NV_ANCHOR["ai-crown"]="above";
  NV_RING["ai-ring"]=1,NV_RING["ai-lens2"]=1,NV_RING["ai-pearlring"]=1,NV_RING["ai-ring-hollow"]=1,NV_RING["ai-ring-star2"]=1,NV_RING["ai-ring-bead"]=1
}
function loadAiStickers(){
  return new Promise(function(resolve){
    let left=AI_PACK.length;
    if(!left){resolve();return}
    for(let i=0;i<AI_PACK.length;i++){
      const s=AI_PACK[i],img=new Image();
      AI_IMG[s.id]=img;
      img.onload=img.onerror=function(){
        if(--left<=0)resolve()
      };
      img.src="./assets/stickers/"+s.file+"?v=76"
    }
  })
}

const Ct={
  
};
for(let e=0;
e<_.length;
e++)Ct[_[e].id]=_[e];
function Wn(){
  return _
}function Nn(){
  return _.length
}function On(e){
  const t=[];
  for(let l=0;
  l<_.length;
  l++)_[l].group===e&&t.push(_[l]);
  return t
}function qe(e){
  return Ct[e]||null
}function zn(e){
  const t=Ct[e];
  return t?t.anchor:null
}function me(){
  return window.xhs||null
}function jn(e,t){
  const l=me();
  if(!(!l||!l.miniTool||!l.miniTool.setStorage))try{
    l.miniTool.setStorage({
      key:e,data:t
    })
  }catch(n){
    
  }
}function Gn(e,t){
  const l=me();
  if(!l||!l.miniTool||!l.miniTool.getStorage){
    t(null);
    return
  }let n=!1;
  const i=a=>{
    n||(n=!0,t(a))
  },o=window.setTimeout(()=>i(null),500);
  try{
    l.miniTool.getStorage({
      key:e,success:a=>{
        window.clearTimeout(o),i(a&&typeof a.data=="string"?a.data:null)
      },fail:()=>{
        window.clearTimeout(o),i(null)
      }
    })
  }catch(a){
    window.clearTimeout(o),i(null)
  }
}function Fe(e){
  const t=e.indexOf(","),l=t>=0?e.slice(0,t):"",n=t>=0?e.slice(t+1):e;
  let i=e;
  try{
    const a=atob(n),r=new Uint8Array(a.length);
    for(let p=0;
    p<a.length;
    p++)r[p]=a.charCodeAt(p);
    const d=(l.indexOf("image/png")>=0,"image/png"),f=new Blob([r],{
      type:d
    });
    i=URL.createObjectURL(f)
  }catch(a){
    i=e
  }const o=document.createElement("a");
  o.href=i,o.download="kaihe-unbox.png",o.rel="noopener",document.body.appendChild(o),o.click(),o.remove(),i.indexOf("blob:")===0&&window.setTimeout(()=>URL.revokeObjectURL(i),4e3)
}function bn(e,t,l,n){
  if(!e.writeTempFile){
    n();
    return
  }
  try{
    e.writeTempFile({
      data:t,success:a=>{
        const r=a&&(a.tempFilePath||a.filePath);
        r?l(r):n()
      },fail:()=>n()
    })
  }catch(a){
    n()
  }
}function Yn(e,t){
  const l=me(),m=l&&l.miniTool;
  if(m&&m.writeTempFile&&m.saveImageToPhotosAlbum){
    bn(m,e,n=>{
      try{
        m.saveImageToPhotosAlbum({
          filePath:n,success:()=>t("已保存到相册"),fail:()=>{
            Fe(e),t("如果没有开始下载，请长按图片保存")
          }
        })
      }catch(i){
        Fe(e),t("如果没有开始下载，请长按图片保存")
      }
    },()=>{
      Fe(e),t("如果没有开始下载，请长按图片保存")
    });
    return
  }Fe(e),t("如果没有开始下载，请长按图片保存")
}function _n(e,t,l){
  const n=me(),i=n&&n.miniTool&&n.miniTool.postNote;
  if(!n||!i){
    l("当前环境不能直接发笔记");
    return
  }const o=a=>{
    try{
      i({
        title:t.slice(0,20),content:t.slice(0,20),pageType:"photo_publish",
        mediaInfo:{image_resources:[{url:a}]},
        fail:()=>l("没能打开发笔记，可以先保存图片")
      })
    }catch(r){
      l("没能打开发笔记，可以先保存图片")
    }
  };
  o(e)
}const ze="kaihe-phone-back-v1",ce={
  
},s={
  modelId:"m17pro",colorId:"silver",items:[],tile:null,backdrop:null,glitter:"off",glitterAmount:.4,glitterBorder:!1,borderStyle:"off",selectedId:null
},H=[],oe=[];
let Y=null;
const ot=[];
function Hn(e){
  ot.push(e)
}function I(){
  for(let e=0;
  e<ot.length;
  e++)ot[e]()
}function Me(){
  return JSON.parse(JSON.stringify(s))
}function qn(e){
  return e==="m17pro"||e==="m16pro"||e==="m17"||e==="m15"
}function W(e,t){
  return typeof e=="number"&&isFinite(e)?e:t
}function Sn(e){
  if(!e||typeof e!="object")return null;
  const t=e;
  return t.type==="builtin"&&typeof t.id=="string"?{
    type:"builtin",id:t.id
  }:t.type==="emoji"&&typeof t.char=="string"?{
    type:"emoji",char:t.char
  }:t.type==="image"&&typeof t.imageId=="string"?{
    type:"image",imageId:t.imageId
  }:null
}function Jn(e){
  if(!e||typeof e!="object")return null;
  const t=e;
  if(typeof t.id!="string")return null;
  if(t.kind==="decal"){
    const l=e,n=Sn(l.source);
    return!n||n.type==="image"&&!ce[n.imageId]?null:{
      id:t.id,kind:"decal",source:n,x:W(l.x,.5),y:W(l.y,.6),scale:W(l.scale,.24),rotation:W(l.rotation,0),aboveCamera:l.aboveCamera===!0,aspect:W(l.aspect,1)||1
    }
  }if(t.kind==="text"){
    const l=e,n=["system","smiley","display","hand"],i=["solid","stroke","gradient","neon","metal","glitter"],o=String(l.font),a=String(l.effect),r=n.indexOf(o)>=0?o:"smiley",d=i.indexOf(a)>=0?a:"solid";
    return{
      id:t.id,kind:"text",text:typeof l.text=="string"?l.text.slice(0,32):"",font:r,effect:d,color:typeof l.color=="string"?l.color:"#E25B45",color2:typeof l.color2=="string"?l.color2:"#FFFFFF",fontScale:W(l.fontScale,.08),curve:W(l.curve,0),x:W(l.x,.5),y:W(l.y,.6),rotation:W(l.rotation,0)
    }
  }if(t.kind==="stroke"){
    const l=e,n=[];
    if(Array.isArray(l.points))for(let i=0;
    i<l.points.length;
    i++){
      const o=l.points[i];
      typeof o.x=="number"&&typeof o.y=="number"&&n.push({
        x:o.x,y:o.y
      })
    }return n.length?{
      id:t.id,kind:"stroke",color:typeof l.color=="string"?l.color:"#2C241C",width:W(l.width,.012),points:n
    }:null
  }return null
}function wt(e){
  if(!e||typeof e!="object")return!1;
  const t=e;
  if(!qn(t.modelId))return!1;
  if(s.modelId=t.modelId,s.colorId=typeof t.colorId=="string"?t.colorId:"silver",s.glitter=t.glitter==="silver"||t.glitter==="gold"?t.glitter:"off",s.glitterAmount=W(t.glitterAmount,.65),s.glitterBorder=t.glitterBorder===!0,s.borderStyle=typeof t.borderStyle=="string"?t.borderStyle:(t.glitterBorder===!0?"sparkle":"off"),s.selectedId=typeof t.selectedId=="string"?t.selectedId:null,s.items=[],Array.isArray(t.items))for(let n=0;
  n<t.items.length;
  n++){
    const i=Jn(t.items[n]);
    i&&s.items.push(i)
  }
  for(let n=0;n<s.items.length;n++)nvSyncCam(s.items[n],s.modelId);
  const l=t.tile;
  if(l&&typeof l=="object"){
    const n=Sn(l.source);
    n&&!(n.type==="image"&&!ce[n.imageId])?s.tile={
      source:n,density:W(l.density,.62),size:W(l.size,.5)
    }:s.tile=null
  }else s.tile=null;
  const bd=t.backdrop;
  if(bd&&typeof bd=="object"){
    const src=Sn(bd);
    src&&!(src.type==="image"&&!ce[src.imageId])?s.backdrop=src:s.backdrop=null
  }else s.backdrop=null;
  return s.selectedId&&!s.items.some(n=>n.id===s.selectedId)&&(s.selectedId=null),!0
}function Xn(){
  const e={
    
  },t=l=>{
    for(let n=0;
    n<l.items.length;
    n++){
      const i=l.items[n];
      i.kind==="decal"&&i.source.type==="image"&&(e[i.source.imageId]=!0)
    }l.tile&&l.tile.source.type==="image"&&(e[l.tile.source.imageId]=!0),l.backdrop&&l.backdrop.type==="image"&&(e[l.backdrop.imageId]=!0)
  };
  t(s);
  for(let l=0;
  l<H.length;
  l++)t(H[l]);
  for(let l=0;
  l<oe.length;
  l++)t(oe[l]);
  return Y&&t(Y),e
}function kt(){
  const e=Xn(),t=Object.keys(ce);
  for(let l=0;
  l<t.length;
  l++)e[t[l]]||delete ce[t[l]]
}function Kn(){
  const e=Me(),t=[];
  for(let n=0;
  n<e.items.length;
  n++){
    const i=e.items[n];
    i.kind==="decal"&&i.source.type==="image"||t.push(i)
  }e.items=t,e.tile&&e.tile.source.type==="image"&&(e.tile=null),e.backdrop&&e.backdrop.type==="image"&&(e.backdrop=null);
  let l=JSON.stringify({
    v:1,snap:e
  });
  return l.length>8e5&&(e.items=e.items.filter(n=>n.kind!=="stroke"),l=JSON.stringify({
    v:1,snap:e
  })),l
}function vt(){
  try{
    const e=Kn();
    localStorage.setItem(ze,e),jn(ze,e)
  }catch(e){
    
  }
}function Cn(e){
  H.push(e),oe.length=0,H.length>30&&H.shift(),kt(),vt()
}function U(){
  Y||(Y=Me())
}function N(){
  if(!Y)return;
  const e=Y;
  Y=null,JSON.stringify(e)!==JSON.stringify(s)&&Cn(e),I()
}function M(e){
  Y&&N();
  const t=Me();
  e(),JSON.stringify(t)!==JSON.stringify(s)&&Cn(t),I()
}function Vn(){
  return H.length>0
}function Un(){
  return oe.length>0
}function jt(){
  if(!H.length)return;
  Y&&(Y=null),oe.push(Me());
  const e=H.pop();
  e&&wt(e),kt(),vt(),I()
}function Gt(){
  if(!oe.length)return;
  H.push(Me());
  const e=oe.pop();
  e&&wt(e),kt(),vt(),I()
}function Yt(){
  if(!s.selectedId)return;
  const e=s.selectedId;
  s.items=s.items.filter(t=>t.id!==e),s.selectedId=null
}function _t(e){
  try{
    const t=JSON.parse(e);
    return!t||t.v!==1?!1:wt(t.snap)
  }catch(t){
    return!1
  }
}function Zn(e){
  if(location.search.indexOf("fresh=1")>=0){
    e(!1);
    return
  }const t=()=>{
    try{
      const l=localStorage.getItem(ze);
      return l?_t(l):!1
    }catch(l){
      return!1
    }
  };
  if(me()){
    Gn(ze,l=>{
      l&&_t(l)?e(!0):e(t())
    });
    return
  }e(t())
}function Ee(){
  if(!s.selectedId)return null;
  for(let e=0;
  e<s.items.length;
  e++)if(s.items[e].id===s.selectedId)return s.items[e];
  return null
}const q={
  paper:"#F3E6D4",ink:"#2C241C",inkSoft:"#7A6A5C",coral:"#E25B45"
},Ze={
  system:'"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif'
};
function z(e,t,l){
  return e<t?t:e>l?l:e
}function Z(){
  return"i"+Math.floor(Math.random()*1e9).toString(36)+Date.now().toString(36).slice(-4)
}function Pt(e){
  let t=e>>>0;
  return function(){
    t|=0,t=t+1831565813|0;
    let l=Math.imul(t^t>>>15,1|t);
    return l=l+Math.imul(l^l>>>7,61|l)^l,((l^l>>>14)>>>0)/4294967296
  }
}function at(e){
  let t=e.replace("#","");
  t.length===3&&(t=t[0]+t[0]+t[1]+t[1]+t[2]+t[2]);
  const l=parseInt(t,16);
  return isFinite(l)?[l>>16&255,l>>8&255,l&255]:[0,0,0]
}function $n(e,t,l){
  const n=i=>z(Math.round(i),0,255).toString(16).padStart(2,"0");
  return"#"+n(e)+n(t)+n(l)
}function be(e,t,l){
  const n=at(e),i=at(t);
  return $n(n[0]+(i[0]-n[0])*l,n[1]+(i[1]-n[1])*l,n[2]+(i[2]-n[2])*l)
}function $(e,t){
  return t>=0?be(e,"#ffffff",t):be(e,"#000000",-t)
}function Ht(e){
  const t=at(e);
  return t[0]*.299+t[1]*.587+t[2]*.114<150
}function T(e,t,l,n,i,o){
  const a=Math.max(0,Math.min(o,n/2,i/2));
  e.beginPath(),e.moveTo(t+a,l),e.arcTo(t+n,l,t+n,l+i,a),e.arcTo(t+n,l+i,t,l+i,a),e.arcTo(t,l+i,t,l,a),e.arcTo(t,l,t+n,l,a),e.closePath()
}function Qn(e,t,l,n,i,o){
  const a=Math.max(0,Math.min(i,l/2,n/2)),r=[],d=(p,c,b,u)=>{
    const w=Math.hypot(b-p,u-c),P=Math.max(1,Math.round(w/o));
    for(let C=0;
    C<P;
    C++){
      const k=C/P;
      r.push({
        x:p+(b-p)*k,y:c+(u-c)*k
      })
    }
  },f=(p,c,b,u)=>{
    const w=Math.abs(u-b)*a,P=Math.max(1,Math.round(w/o));
    for(let C=0;
    C<P;
    C++){
      const k=C/P,E=b+(u-b)*k;
      r.push({
        x:p+Math.cos(E)*a,y:c+Math.sin(E)*a
      })
    }
  };
  return d(e+a,t,e+l-a,t),f(e+l-a,t+a,-Math.PI/2,0),d(e+l,t+a,e+l,t+n-a),f(e+l-a,t+n-a,0,Math.PI/2),d(e+l-a,t+n,e+a,t+n),f(e+a,t+n-a,Math.PI/2,Math.PI),d(e,t+n-a,e,t+a),f(e+a,t+a,Math.PI,Math.PI*1.5),r
}let $e=null;
function xn(){
  if(!$e){
    const t=document.createElement("canvas").getContext("2d");
    if(!t)throw new Error("canvas");
    $e=t
  }return $e
}function el(e){
  return e>=11904&&e<=40959||e>=63744&&e<=64255||e>=65280&&e<=65519
}function tl(e,t){
  return t?e==="system"?Ze.system:'"Smiley Sans", '+Ze.system:e==="display"?'"Lilita One", "Smiley Sans", sans-serif':e==="hand"?'Pangolin, "Smiley Sans", sans-serif':e==="smiley"?'"Smiley Sans", sans-serif':Ze.system
}function wn(e,t,l){
  const n=xn(),i=[],o=Array.from(e);
  for(let a=0;
  a<o.length;
  a++){
    const r=o[a],d=el(r.charCodeAt(0)),f=tl(t,d);
    n.font=l+"px "+f;
    const p=Math.max(l*.25,n.measureText(r).width+l*.06);
    i.push({
      ch:r,font:f,w:p
    })
  }return i
}function Je(e){
  let t=0;
  for(let l=0;
  l<e.length;
  l++)t+=e[l].w;
  return t
}function nl(e,t,l){
  let n=-Je(t)/2;
  for(let i=0;
  i<t.length;
  i++){
    const o=t[i];
    e.save(),e.translate(n+o.w/2,0),l(e,o,i),e.restore(),n+=o.w
  }
}function ll(e,t,l,n){
  const o=Je(t)/Math.abs(l);
  if(l>0){
    let f=-Math.PI/2-l/2;
    const p=o;
    for(let c=0;
    c<t.length;
    c++){
      const b=t[c],u=f+b.w/2/o;
      e.save(),e.translate(Math.cos(u)*o,p+Math.sin(u)*o),e.rotate(u+Math.PI/2),n(e,b,c),e.restore(),f+=b.w/o
    }return
  }const a=-l;
  let r=Math.PI/2+a/2;
  const d=-o;
  for(let f=0;
  f<t.length;
  f++){
    const p=t[f],c=r-p.w/2/o;
    e.save(),e.translate(Math.cos(c)*o,d+Math.sin(c)*o),e.rotate(c-Math.PI/2),n(e,p,f),e.restore(),r-=p.w/o
  }
}function J(e,t,l,n,i,o){
  e.font=l+"px "+t.font,e.textAlign="center",e.textBaseline="middle",i&&(e.lineWidth=o,e.strokeStyle=i,e.strokeText(t.ch,0,0)),e.fillStyle=n,e.fillText(t.ch,0,0)
}const je={
  
};
let rt=0;
function kn(){
  const e=Object.keys(je);
  for(let t=0;
  t<e.length;
  t++)delete je[e[t]];
  rt=0
}function vn(e,t,l){
  const n=Math.max(8,t),i=[e.text,e.font,e.effect,e.color,e.curve.toFixed(2),Math.round(n),Math.round(l)].join("|"),o=je[i];
  if(o)return o;
  const a=wn(e.text||" ",e.font,n),r=Math.max(n,Je(a)),d=e.curve*.9,f=n*(e.effect==="neon"?2.4:1.25),p=Math.max(4,Math.ceil(r+f*2)),c=Math.max(4,Math.ceil(n*(2.1+Math.abs(e.curve)*2.6)+f)),b=document.createElement("canvas");
  b.width=p,b.height=c;
  const u=b.getContext("2d");
  if(!u)return{
    canvas:b,width:r,height:n
  };
  u.translate(p/2,c/2),u.lineJoin="round",u.lineCap="round",u.miterLimit=2;
  const w=C=>{
    Math.abs(d)<.08?nl(u,a,C):ll(u,a,d,C)
  };
  if(e.effect==="stroke")w((C,k)=>J(C,k,n,e.color,"rgba(44,36,28,0.35)",n*.22)),w((C,k)=>J(C,k,n,e.color,"#ffffff",n*.12));
  else if(e.effect==="gradient"){
    const C=u.createLinearGradient(-r/2,0,r/2,0);
    C.addColorStop(0,e.color),C.addColorStop(1,be(e.color,"#FFE7A8",.62)),u.shadowColor="rgba(60,32,18,0.25)",u.shadowBlur=n*.1,u.shadowOffsetY=n*.04,w((k,E)=>J(k,E,n,C,null,0))
  }else if(e.effect==="neon")w((C,k)=>{
    C.shadowColor=e.color,C.shadowBlur=n*.55,J(C,k,n,e.color,null,0),C.shadowBlur=n*.16,J(C,k,n,"#ffffff",null,0),C.shadowBlur=0
  });
  else if(e.effect==="metal"){
    const C=l*n*.03,k=u.createLinearGradient(C,-n*.65,C,n*.7);
    k.addColorStop(0,"#fff8ea"),k.addColorStop(.35,be(e.color,"#ffffff",.25)),k.addColorStop(.5,"#ffffff"),k.addColorStop(.66,$(e.color,-.15)),k.addColorStop(1,be(e.color,"#5a4630",.45)),w((E,L)=>J(E,L,n,k,"rgba(80,60,30,0.25)",n*.04))
  }else if(e.effect==="glitter"){
    w((E,L)=>J(E,L,n,e.color,"#ffffff",n*.08)),u.save(),u.globalCompositeOperation="source-atop";
    const C=Pt(e.text.length*97+Math.round(n)),k=28+a.length*4;
    for(let E=0;
    E<k;
    E++){
      const L=(C()-.5)*r,Q=(C()-.5)*n*1.1;
      u.fillStyle=C()>.45?"#fff":"#FFE7A3",u.globalAlpha=.45+C()*.55,u.beginPath(),u.arc(L,Q,n*(.025+C()*.04),0,Math.PI*2),u.fill()
    }u.restore()
  }else u.shadowColor="rgba(60,32,18,0.28)",u.shadowBlur=n*.12,u.shadowOffsetY=n*.05,w((C,k)=>J(C,k,n,e.color,null,0));
  const P={
    canvas:b,width:r,height:n*(1.15+Math.abs(e.curve)*1.5)
  };
  return rt>48&&kn(),je[i]=P,rt+=1,P
}function il(e,t,l,n,i,o,a){
  const r=wn(t,l,n),d=Je(r);
  let f=o-d/2;
  e.fillStyle=i,e.textAlign="center",e.textBaseline="middle";
  for(let p=0;
  p<r.length;
  p++){
    const c=r[p];
    e.font=n+"px "+c.font,e.fillText(c.ch,f+c.w/2,a),f+=c.w
  }return d
}const qt=["m17pro","m17","m15"],Se=[{
  id:"m17pro",name:"17 Pro 款"
},{
  id:"m17",name:"17 款"
},{
  id:"m15",name:"15 款"
}],Qe=[{
  id:"silver",name:"银色",kind:"solid",base:"#E3E2DE",frame:"#C5C4BE",models:["m17pro"]
},{
  id:"cosmic",name:"宇宙橙",kind:"solid",base:"#E36B32",frame:"#C45520",models:["m17pro"]
},{
  id:"deepblue",name:"深蓝",kind:"solid",base:"#31456F",frame:"#243352",models:["m17pro"]
},{
  id:"black",name:"黑色",kind:"solid",base:"#1D1D1F",frame:"#111113",models:["m17"]
},{
  id:"white",name:"白色",kind:"solid",base:"#F4F4F1",frame:"#D8D8D3",models:["m17"]
},{
  id:"mist",name:"雾蓝",kind:"solid",base:"#A9C4D2",frame:"#8AA8B6",models:["m17"]
},{
  id:"sage",name:"鼠尾草",kind:"solid",base:"#B7C4AE",frame:"#96A48C",models:["m17"]
},{
  id:"lavender",name:"淡紫",kind:"solid",base:"#D0C2DE",frame:"#B4A4C4",models:["m17"]
},{
  id:"pink",name:"粉色",kind:"solid",base:"#F4C9CE",frame:"#E2A8B0",models:["m15"]
},{
  id:"yellow",name:"黄色",kind:"solid",base:"#F6E4A4",frame:"#E0CC80",models:["m15"]
},{
  id:"green",name:"绿色",kind:"solid",base:"#D5E4C2",frame:"#B7C9A4",models:["m15"]
},{
  id:"blue",name:"蓝色",kind:"solid",base:"#C9D6EA",frame:"#A9B8D0",models:["m15"]
},{
  id:"black",name:"黑色",kind:"solid",base:"#353537",frame:"#232325",models:["m15"]
}];
function Ie(e){
  const t=[];
  for(let l=0;
  l<Qe.length;
  l++)Qe[l].models.indexOf(e)>=0&&t.push(Qe[l]);
  return t
}function Xe(e){
  const t=Ie(e.modelId);
  for(let l=0;
  l<t.length;
  l++)if(t[l].id===e.colorId)return t[l];
  return e.colorId=t[0].id,t[0]
}function ol(e){
  for(let t=0;
  t<Se.length;
  t++)if(Se[t].id===e)return Se[t].name;
  return"17 Pro 款"
}function al(e,t){
  const l=Ie(e);
  for(let n=0;
  n<l.length;
  n++)if(l[n].id===t)return l[n].name;
  return l[0].name
}function rl(e){
  return ol(e.modelId)+" · "+al(e.modelId,e.colorId)
}const Ke={
  m17pro:{
    w:71.85,h:150.01,corner:19.43
  },m16pro:{
    w:71.45,h:149.61,corner:19.23
  },m17:{
    w:71.45,h:149.61,corner:19.23
  },m15:{
    w:71.63,h:147.64,corner:17.4
  }
};
function dl(e){
  return Ke[e]
}function pe(e,t,l="m17pro"){
  const n=Ke[l]||Ke.m17pro,i=n.h/n.w,o=Math.max(e*.08,12),a=Math.max(t*.04,8);
  const availW=Math.max(2,e-o*2),availH=Math.max(2,t-a*2);
  let r=availW,d=r*i;
  d>availH&&(d=availH,r=d/i);
  r>availW&&(r=availW,d=r*i);
  return{
    x:(e-r)/2,y:(t-d)/2,w:r,h:d,r:r*.158
  }
}const NV_MM={
  m17pro:{r:8.1,corner:7.6,plate:[4.6,4.6,67.25,42.95],
    lens:[[14.37,14.37],[14.37,33.61],[32.36,23.99]],
    feat:[["flash",58.03,13.82,3.4],["mic",57.7,24.6,.9],["lidar",57.9,34.85,3.29]]},
  m17:{r:8,corner:9.9,plate:[4.0,4.0,23.8,42.8],
    lens:[[13.9,13.9],[13.9,32.9]],
    feat:[["flash",28.6,23.4,3.0],["mic",28.6,29.2,.85]]},
  m15:{r:7.535,corner:7.2,plate:[4.6,4.6,38.4,38.4],
    lens:[[14.53,14.53],[27.44,27.44]],
    feat:[["flash",29.12,12.86,3.1],["mic",35.4,22.0,.85]]}
};
NV_MM.m16=NV_MM.m17;
const NV_CAM={};
for(const k in NV_MM){
  const K=Ke[k]||Ke.m17pro,m=NV_MM[k];
  NV_CAM[k]={lens:m.lens.map(function(q){return{x:q[0]/K.w,y:q[1]/K.h,r:m.r/K.w}})};
}
const NV_IMG={};
function NV(e,t){
  return null;
  const l=e+"-"+t,i=NV_IMG[l];
  if(i)return i.complete&&i.naturalWidth>0?i:null;
  if(typeof Image!="function")return null;
  const n=new Image;
  n.onload=function(){
    typeof Ul=="function"&&Ul()
  },n.src="./models/"+l+".webp?v=3",NV_IMG[l]=n;
  return null
}
function nvCam(e){
  return NV_CAM[e]||NV_CAM.m17pro
}
function nvLensMm(e){
  const m=NV_MM[e]||NV_MM.m17pro;
  return m.lens.map(function(q){return{x:q[0],y:q[1],r:m.r}})
}
function nvPlateauMm(e){
  const K=Ke[e]||Ke.m17pro,m=NV_MM[e]||NV_MM.m17pro,p=m.plate;
  const x0=Math.max(.6,p[0]),y0=Math.max(.6,p[1]),x1=Math.min(K.w-.6,p[2]),y1=Math.min(K.h-.6,p[3]);
  return{
    x0:x0,y0:y0,x1:x1,y1:y1,w:x1-x0,h:y1-y0,r:m.r,feat:m.feat||[],
    corner:Math.min(m.corner||7.6,(x1-x0)/2-.3,(y1-y0)/2-.3)
  }
}
function nvZone(e){
  const K=Ke[e]||Ke.m17pro,P=nvPlateauMm(e);
  return{
    x0:P.x0/K.w,x1:P.x1/K.w,y0:P.y0/K.h,y1:P.y1/K.h
  }
}
function nvHitsCam(modelId,x,y,scale){
  const r=nvZone(modelId),m=.02,i=Math.max(.08,scale||.2);
  return x+i*.5>r.x0-m&&x-i*.5<r.x1+m&&y+i*.5>r.y0-m&&y-i*.5<r.y1+m
}
function nvIsImgItem(a){
  return !!(a&&a.kind==="decal"&&a.source&&a.source.type==="image")
}
function nvImgHalf(a){
  const w=a.scale||.3,h=w/(a.aspect||1),c=Math.abs(Math.cos(a.rotation||0)),s=Math.abs(Math.sin(a.rotation||0));
  return{hw:(w*c+h*s)/2,hh:(w*s+h*c)/2}
}
function nvImgSafeBox(modelId){
  const z=nvZone(modelId);
  const top=Math.min(.93,z.y1+.04),bot=.975;
  return{top:top,bot:bot,h:Math.max(.12,bot-top),w:.9}
}
function nvFitImg(it,modelId){
  if(!it)return;
  const box=nvImgSafeBox(modelId),asp=it.aspect||1;
  const maxW=Math.max(.14,Math.min(box.w,box.h*asp));
  if(!(it.scale>0))it.scale=.36;
  it.scale=Math.min(Math.max(it.scale,.1),maxW);
  it.aboveCamera=!1;
  const{hh,hw}=nvImgHalf(it);
  const xLo=hw+.012,xHi=1-hw-.012;
  it.x=xLo<=xHi?Math.min(Math.max(it.x,xLo),xHi):.5;
  const yLo=box.top+hh,yHi=box.bot-hh;
  it.y=yLo<=yHi?Math.min(Math.max(it.y,yLo),yHi):(box.top+box.bot)/2
}
function nvSyncCam(item,modelId){
  if(!item||item.kind==="stroke")return;
  if(nvIsRing(item)){item.aboveCamera=!0;return}
  if(nvIsImgItem(item)){nvFitImg(item,modelId);return}
  const sc=item.kind==="text"?item.fontScale:item.scale;
  item.aboveCamera=nvHitsCam(modelId,item.x,item.y,sc)
}
function sl(e){
  const t=nvCam(e).lens;
  let l=1,n=0,i=1,o=0,r=0;
  for(let a=0;a<t.length;a++){
    l=Math.min(l,t[a].x),n=Math.max(n,t[a].x),i=Math.min(i,t[a].y),o=Math.max(o,t[a].y),r=Math.max(r,t[a].r)
  }
  return{cx:(l+n)/2,cy:(i+o)/2,span:Math.max(n-l,o-i)+r*2}
}

function fl(e,t,l){
  return e.x+l/t*e.w
}function hl(e,t,l){
  return e.y+l/t*e.h
}function ul(e,t,l){
  return l/t*e.w
}function Be(e,t,l,n,i,o,a){
  const r=Math.max(1.25,n*.012);
  T(e,t,l+r,n,i,o),e.fillStyle=$(a,-.22),e.fill(),T(e,t,l,n,i,o);
  const d=e.createLinearGradient(t,l,t+n*.15,l+i);
  d.addColorStop(0,$(a,.14)),d.addColorStop(.48,a),d.addColorStop(1,$(a,-.06)),e.fillStyle=d,e.fill(),T(e,t,l,n,i,o),e.lineWidth=Math.max(1,n*.008),e.strokeStyle="rgba(255,255,255,0.28)",e.stroke()
}
function nvTint(e,n){
  if(e==="m17pro"){
    const b=n.kind==="glass"?"#D7E6F0":n.base;
    return Ht(b)?null:b
  }
  return null
}


let NV_NOISE=null;
function nvNoise(e){
  if(NV_NOISE===null){
    if(typeof document=="undefined"||!document.createElement){NV_NOISE=!1}
    else{
      const c=document.createElement("canvas");c.width=c.height=48;
      const x=c.getContext("2d"),d=x.createImageData(48,48);
      for(let i=0;i<d.data.length;i+=4){
        const v=Math.random()*255|0;
        d.data[i]=d.data[i+1]=d.data[i+2]=v,d.data[i+3]=255
      }
      x.putImageData(d,0,0),NV_NOISE=e.createPattern(c,"repeat")
    }
  }
  return NV_NOISE||null
}
function nvMetal(base){
  return Ht(base)?$(base,.26):$(base,.42)
}
function nvPlateFill(e,x,y,w,h,rad,base){
  const dark=Ht(base);
  T(e,x,y,w,h,rad);
  const g=e.createLinearGradient(x+w*.08,y,x+w*.72,y+h);
  g.addColorStop(0,$(base,dark?.19:.15));
  g.addColorStop(.26,$(base,dark?.06:.07));
  g.addColorStop(.52,$(base,dark?.02:.075));
  g.addColorStop(.78,$(base,dark?-.09:-.01));
  g.addColorStop(1,$(base,dark?-.05:-.05));
  e.fillStyle=g,e.fill();
}
function nvPlateGlass(e,x,y,w,h,rad,base,tw){
  e.save(),T(e,x,y,w,h,rad),e.clip();
  const hi=e.createLinearGradient(x,y,x,y+h*.30);
  hi.addColorStop(0,Ht(base)?"rgba(255,255,255,0.16)":"rgba(255,255,255,0.55)");
  hi.addColorStop(.55,Ht(base)?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.14)");
  hi.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=hi,e.fillRect(x,y,w,h*.30);
  const lo=e.createLinearGradient(x,y+h*.62,x,y+h);
  lo.addColorStop(0,"rgba(0,0,0,0)"),lo.addColorStop(1,Ht(base)?"rgba(0,0,0,0.16)":"rgba(0,0,0,0.13)"),e.fillStyle=lo,e.fillRect(x,y+h*.62,w,h*.38);
  const sheen=e.createLinearGradient(x,y,x+w*.9,y+h*.55);
  sheen.addColorStop(0,"rgba(255,255,255,0)"),sheen.addColorStop(.42,Ht(base)?"rgba(255,255,255,0.035)":"rgba(255,255,255,0.10)"),sheen.addColorStop(.58,"rgba(255,255,255,0)"),e.fillStyle=sheen,e.fillRect(x,y,w,h);
  const pat=nvNoise(e);
  if(pat){e.save(),e.globalAlpha=Ht(base)?.055:.038,e.globalCompositeOperation="overlay",e.fillStyle=pat,e.fillRect(x,y,w,h),e.restore()}
  e.restore()
}
function nvPlateEdge(e,x,y,w,h,rad,base,tw){
  T(e,x,y,w,h,rad);
  const g=e.createLinearGradient(x,y,x+w*.35,y+h);
  g.addColorStop(0,Ht(base)?"rgba(255,255,255,0.20)":"rgba(255,255,255,0.75)");
  g.addColorStop(.45,Ht(base)?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.22)");
  g.addColorStop(1,Ht(base)?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.10)");
  e.strokeStyle=g,e.lineWidth=Math.max(1,tw*.0024),e.stroke();
  T(e,x,y,w,h,rad),e.strokeStyle=Ht(base)?"rgba(0,0,0,0.16)":"rgba(0,0,0,0.07)";
  e.lineWidth=Math.max(1,tw*.0016),e.stroke()
}
function nvLens(e,cx,cy,R,base){
  const metal=nvMetal(base),TWO=Math.PI*2;
  // 外金属环（车削明暗交替）
  e.beginPath(),e.arc(cx,cy,R,0,TWO);
  const rg=e.createLinearGradient(cx-R*.82,cy-R,cx+R*.74,cy+R);
  rg.addColorStop(0,$(metal,.46)),rg.addColorStop(.10,$(metal,.16)),
  rg.addColorStop(.24,$(metal,.36)),rg.addColorStop(.40,$(metal,-.08)),
  rg.addColorStop(.55,$(metal,.28)),rg.addColorStop(.70,$(metal,-.16)),
  rg.addColorStop(.84,$(metal,.12)),rg.addColorStop(1,$(metal,-.05)),
  e.fillStyle=rg,e.fill();
  e.beginPath(),e.arc(cx,cy,R*.996,0,TWO),e.lineWidth=Math.max(.6,R*.017),e.strokeStyle="rgba(0,0,0,0.20)",e.stroke();
  // 环内壁台阶
  e.beginPath(),e.arc(cx,cy,R*.862,0,TWO);
  const ig=e.createLinearGradient(cx-R*.5,cy-R*.62,cx+R*.5,cy+R*.62);
  ig.addColorStop(0,"#3A3F46"),ig.addColorStop(.42,"#0A0C10"),ig.addColorStop(1,"#1E2329"),
  e.fillStyle=ig,e.fill();
  // 黑镜筒
  e.beginPath(),e.arc(cx,cy,R*.805,0,TWO),e.fillStyle="#07090C",e.fill();
  // 玻璃
  const gl=e.createRadialGradient(cx-R*.24,cy-R*.28,R*.03,cx+R*.04,cy+R*.06,R*.72);
  gl.addColorStop(0,"#171D26"),gl.addColorStop(.22,"#0B0F15"),gl.addColorStop(.55,"#05070B"),gl.addColorStop(1,"#030407"),
  e.beginPath(),e.arc(cx,cy,R*.685,0,TWO),e.fillStyle=gl,e.fill();
  e.beginPath(),e.arc(cx,cy,R*.68,0,TWO),e.lineWidth=Math.max(.5,R*.010),e.strokeStyle="rgba(150,175,205,0.13)",e.stroke();
  e.save(),e.beginPath(),e.arc(cx,cy,R*.685,0,TWO),e.clip();
  const coat=e.createLinearGradient(cx-R*.55,cy+R*.5,cx+R*.32,cy-R*.55);
  coat.addColorStop(0,"rgba(112,90,208,0.16)"),coat.addColorStop(.40,"rgba(62,90,172,0.08)"),
  coat.addColorStop(.72,"rgba(76,124,172,0.03)"),coat.addColorStop(1,"rgba(255,255,255,0)"),
  e.fillStyle=coat,e.fillRect(cx-R,cy-R,R*2,R*2);
  const core=e.createRadialGradient(cx-R*.06,cy-R*.08,R*.012,cx,cy,R*.27);
  core.addColorStop(0,"#0D131C"),core.addColorStop(.5,"#06080D"),core.addColorStop(1,"#03050A"),
  e.beginPath(),e.arc(cx,cy,R*.23,0,TWO),e.fillStyle=core,e.fill();
  e.beginPath(),e.arc(cx,cy,R*.23,0,TWO),e.lineWidth=Math.max(.4,R*.010),e.strokeStyle="rgba(140,170,205,0.10)",e.stroke();
  const hl=e.createRadialGradient(cx-R*.29,cy-R*.33,R*.01,cx-R*.21,cy-R*.23,R*.34);
  hl.addColorStop(0,"rgba(200,222,250,0.34)"),hl.addColorStop(.34,"rgba(132,164,216,0.08)"),hl.addColorStop(1,"rgba(255,255,255,0)"),
  e.fillStyle=hl,e.fillRect(cx-R,cy-R,R*2,R*2);
  const hl2=e.createRadialGradient(cx+R*.28,cy+R*.32,R*.01,cx+R*.24,cy+R*.28,R*.20);
  hl2.addColorStop(0,"rgba(180,206,248,0.14)"),hl2.addColorStop(1,"rgba(255,255,255,0)"),
  e.fillStyle=hl2,e.fillRect(cx-R,cy-R,R*2,R*2);
  e.restore()
}
function nvFlash(e,cx,cy,R,base){
  const metal=nvMetal(base),TWO=Math.PI*2;
  e.beginPath(),e.arc(cx,cy,R,0,TWO);
  const rg=e.createLinearGradient(cx-R,cy-R,cx+R,cy+R);
  rg.addColorStop(0,$(metal,.40)),rg.addColorStop(.32,$(metal,.06)),rg.addColorStop(.66,$(metal,-.22)),rg.addColorStop(1,$(metal,.12)),
  e.fillStyle=rg,e.fill();
  e.beginPath(),e.arc(cx,cy,R*.76,0,TWO);
  const g=e.createRadialGradient(cx-R*.24,cy-R*.28,R*.04,cx,cy,R*.82);
  g.addColorStop(0,"#FFFFFF"),g.addColorStop(.38,"#FDF9EE"),g.addColorStop(.74,"#EDE4CE"),g.addColorStop(1,"#BFB298"),
  e.fillStyle=g,e.fill();
  e.beginPath(),e.arc(cx-R*.20,cy-R*.24,R*.19,0,TWO),e.fillStyle="rgba(255,255,255,0.92)",e.fill();
  e.beginPath(),e.arc(cx+R*.22,cy+R*.26,R*.13,0,TWO),e.fillStyle="rgba(255,255,255,0.35)",e.fill()
}
function nvLidar(e,cx,cy,R,base){
  const metal=nvMetal(base),TWO=Math.PI*2;
  e.beginPath(),e.arc(cx,cy,R,0,TWO);
  const rg=e.createLinearGradient(cx-R,cy-R,cx+R,cy+R);
  rg.addColorStop(0,$(metal,.30)),rg.addColorStop(.5,metal),rg.addColorStop(1,$(metal,-.30)),
  e.fillStyle=rg,e.fill();
  e.beginPath(),e.arc(cx,cy,R*.80,0,TWO),e.fillStyle="#0E1115",e.fill();
  e.beginPath(),e.arc(cx-R*.15,cy-R*.17,R*.36,0,TWO),e.fillStyle="rgba(128,150,180,0.20)",e.fill()
}
function nvMic(e,cx,cy,R,base){
  const metal=nvMetal(base);
  e.beginPath(),e.arc(cx,cy,R*1.55,0,Math.PI*2),e.fillStyle=$(metal,-.22),e.fill();
  e.beginPath(),e.arc(cx,cy,R,0,Math.PI*2),e.fillStyle="#080A0D",e.fill();
  e.beginPath(),e.arc(cx,cy,R*.68,0,Math.PI*2),e.fillStyle="rgba(120,132,148,0.14)",e.fill()
}
function nvCamBody(e,t,l,base){
  const K=Ke[l]||Ke.m17pro,o=c=>t.x+c/K.w*t.w,a=c=>t.y+c/K.h*t.h,r=c=>c/K.w*t.w;
  const P=nvPlateauMm(l),L=nvLensMm(l);
  for(let i=0;i<L.length;i++)nvLens(e,o(L[i].x),a(L[i].y),r(L[i].r),base);
  for(let i=0;i<P.feat.length;i++){
    const f=P.feat[i],X=o(f[1]),Y=a(f[2]),R=r(f[3]);
    f[0]==="flash"?nvFlash(e,X,Y,R,base):f[0]==="lidar"?nvLidar(e,X,Y,R,base):nvMic(e,X,Y,R,base)
  }
}
function cl(e,t,l,n){
  const K=Ke[l]||Ke.m17pro,o=c=>t.x+c/K.w*t.w,a=c=>t.y+c/K.h*t.h,r=c=>c/K.w*t.w;
  const P=nvPlateauMm(l),base=n.kind==="glass"?"#D7E6F0":n.base;
  const x=o(P.x0),y=a(P.y0),w=r(P.w),h=a(P.y1)-a(P.y0),rad=r(P.corner);
  e.save(),T(e,t.x,t.y,t.w,t.h,t.r),e.clip();
  e.save(),T(e,x,y,w,h,rad),e.shadowColor="rgba(0,0,0,0.30)",e.shadowBlur=t.w*.026,e.shadowOffsetY=t.w*.009,e.fillStyle=$(base,-.18),e.fill(),e.restore();
  nvPlateFill(e,x,y,w,h,rad,base);
  nvPlateGlass(e,x,y,w,h,rad,base,t.w);
  nvCamBody(e,t,l,base);
  nvPlateEdge(e,x,y,w,h,rad,base,t.w);
  e.restore()
}
function nvLensTop(e,t,l,base){
  e.save(),T(e,t.x,t.y,t.w,t.h,t.r),e.clip();
  const K=Ke[l]||Ke.m17pro,o=c=>t.x+c/K.w*t.w,a=c=>t.y+c/K.h*t.h,r=c=>c/K.w*t.w;
  const P=nvPlateauMm(l),L=nvLensMm(l),b=base||"#E3E2DE";
  e.beginPath();
  for(let i=0;i<L.length;i++)e.arc(o(L[i].x),a(L[i].y),r(L[i].r),0,Math.PI*2);
  for(let i=0;i<P.feat.length;i++)e.arc(o(P.feat[i][1]),a(P.feat[i][2]),r(P.feat[i][3])*1.6,0,Math.PI*2);
  e.clip(),nvCamBody(e,t,l,b);
  e.restore()
}
function pl(e,t,l){
  const{
    x:n,y:i,w:o,h:a,r
  }=t,d=o*.02,f=d*.45,p=(u,w,P,C)=>{
    T(e,u,w,P,C,f),e.fillStyle=$(l.frame,Ht(l.base)?.12:-.08),e.fill(),e.strokeStyle="rgba(255,255,255,0.28)",e.lineWidth=Math.max(1,o*.003),e.stroke()
  };
  p(n-d*.65,i+a*.34,d,a*.07),p(n-d*.65,i+a*.43,d,a*.07),p(n+o-d*.35,i+a*.37,d,a*.11);
  const c=o*.012;
  if(T(e,n-c*.15,i-c*.15,o+c*.3,a+c*.3,r+c*.2),e.fillStyle=l.frame,e.fill(),T(e,n,i,o,a,r),l.kind==="glass"){
    const u=e.createLinearGradient(n,i,n,i+a);
    u.addColorStop(0,"rgba(255,255,255,0.55)"),u.addColorStop(.5,"rgba(214, 230, 240, 0.38)"),u.addColorStop(1,"rgba(255,255,255,0.48)"),e.fillStyle=u,e.fill()
  }else{
    const u=e.createLinearGradient(n+o*.08,i,n+o*.88,i+a);
    u.addColorStop(0,$(l.base,.15)),u.addColorStop(.18,$(l.base,.05)),u.addColorStop(.42,l.base),u.addColorStop(.62,$(l.base,-.04)),u.addColorStop(.84,$(l.base,.06)),u.addColorStop(1,$(l.base,-.08)),e.fillStyle=u,e.fill()
  }e.save(),T(e,n,i,o,a,r),e.clip();
  const b=e.createRadialGradient(n+o*.35,i+a*.18,o*.02,n+o*.4,i+a*.28,o*.95);
  b.addColorStop(0,l.kind==="glass"?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.16)"),b.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=b,e.fillRect(n,i,o,a),e.restore(),T(e,n+o*.012,i+o*.012,o-o*.024,a-o*.024,r*.94),e.strokeStyle=Ht(l.base)?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.42)",e.lineWidth=Math.max(1,o*.006),e.stroke();
  const bn=e.createLinearGradient(n,i+a*.62,n,i+a);
  bn.addColorStop(0,"rgba(0,0,0,0)"),bn.addColorStop(1,"rgba(0,0,0,0.10)"),T(e,n,i,o,a,r),e.fillStyle=bn,e.fill()
}const Ce=[];
let Xt="";
function gl(e){
  if(Xt===e&&Ce.length)return;
  Xt=e,Ce.length=0;
  const seed=e==="gold"?20261113:e==="rose"?991122:e==="holo"?445566:e==="candy"?778899:e==="star"?112233:e==="heart"?334455:e==="frost"?556677:8675309;
  const t=Pt(seed),n=e==="star"?300:e==="heart"?360:e==="frost"?380:e==="candy"||e==="holo"?460:440;
  for(let l=0;l<n;l++){
    const k=t();
    Ce.push({
      x:t(),y:t(),
      r:e==="star"?(k>.78?.012+t()*.014:.005+t()*.008):k>.85?.008+t()*.009:.004+t()*.006,
      a:e==="star"?(.5+t()*.45):(e==="frost"?(.42+t()*.45):(.45+t()*.5)),
      kind:e==="star"?(k>.72?2:k>.4?1:0):k>.96?2:k>.7?1:0,
      hue:t()
    })
  }
}let we=null,Kt="";
function ml(e,t,l){
  const n=we||document.createElement("canvas");
  we=n,n.width=Math.max(2,Math.round(e)),n.height=Math.max(2,Math.round(t));
  const i=n.getContext("2d");
  if(!i)return n;
  i.clearRect(0,0,n.width,n.height);
  const o=e*(.34-l.density*.22),a=e*(.07+l.size*.16),r=Math.max(o,e*.09);
  let d=0;
  for(let f=r*.35;
  f<t+a;
  f+=r){
    const p=d%2===0?0:r*.5;
    for(let c=-r+p;
    c<e+a;
    c+=r){
      i.save(),i.translate(c,f);
      const b=((d*3+Math.round(c))%7-3)*.04;
      i.rotate(b),Pn(i,l.source,a,1),i.restore()
    }d+=1
  }return n
}function Pn(e,t,l,n){
  if(t.type==="builtin"){
    const d=qe(t.id);
    if(!d)return;
    d.draw(e,l);
    return
  }if(t.type==="emoji"){
    e.font=l*.58+'px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',e.textAlign="center",e.textBaseline="middle",e.fillText(t.char,0,l*.04);
    return
  }const i=ce[t.imageId];
  if(!i)return;
  const o=l,a=l/(n||1),r=Math.max(3,l*.04);
  T(e,-o/2-r,-a/2-r,o+r*2,a+r*2,r*1.4),e.fillStyle="#ffffff",e.fill(),e.drawImage(i,-o/2,-a/2,o,a)
}function yl(e,t,l){
  const n=t.x+l.x*t.w,i=t.y+l.y*t.h,o=l.scale*t.w;
  e.save(),T(e,t.x,t.y,t.w,t.h,t.r),e.clip(),e.translate(n,i),e.rotate(l.rotation),e.shadowColor="rgba(90,40,70,.2)",e.shadowBlur=o*.05,e.shadowOffsetY=o*.02,Pn(e,l.source,o,l.aspect),e.restore()
}function bl(e,t,l){
  const n=l.points;
  if(!n.length)return;
  e.save(),T(e,t.x,t.y,t.w,t.h,t.r),e.clip(),e.strokeStyle=l.color,e.fillStyle=l.color,e.lineWidth=Math.max(1.4,l.width*t.w),e.lineCap="round",e.lineJoin="round";
  const i=a=>t.x+a.x*t.w,o=a=>t.y+a.y*t.h;
  if(n.length===1)e.beginPath(),e.arc(i(n[0]),o(n[0]),e.lineWidth/2,0,Math.PI*2),e.fill();
  else{
    e.beginPath(),e.moveTo(i(n[0]),o(n[0]));
    for(let r=1;
    r<n.length-1;
    r++){
      const d=(i(n[r])+i(n[r+1]))/2,f=(o(n[r])+o(n[r+1]))/2;
      e.quadraticCurveTo(i(n[r]),o(n[r]),d,f)
    }const a=n[n.length-1];
    e.lineTo(i(a),o(a)),e.stroke()
  }e.restore()
}function Sl(e,t,l,n){
  if(!l.text)return;
  const i=vn(l,l.fontScale*t.w,n),o=t.x+l.x*t.w,a=t.y+l.y*t.h;
  e.save(),T(e,t.x,t.y,t.w,t.h,t.r),e.clip(),e.translate(o,a),e.rotate(l.rotation),e.drawImage(i.canvas,-i.canvas.width/2,-i.canvas.height/2),e.restore()
}function Cl(e,t,l,n){
  if(e.save(),T(e,t.x,t.y,t.w,t.h,t.r),e.clip(),l.glitter!=="off"){
    gl(l.glitter);
    const gtype=l.glitter,amt=Math.min(1,l.glitterAmount),d=Math.round(gtype==="star"?90+amt*170:gtype==="heart"?110+amt*210:gtype==="frost"?130+amt*230:150+amt*260);
    const col=p=>{
      if(gtype==="gold")return p%5===0?"#fff":p%3===0?"#FFE6B0":"#F8E8C8";
      if(gtype==="rose")return p%5===0?"#fff":p%3===0?"#FFD0DC":"#FFE8EE";
      if(gtype==="holo"){const h=["#FFD0E4","#D4F0FF","#E8DCFF","#FFF0C8","#fff"];return h[p%5]}
      if(gtype==="candy"){const h=["#FFB7C8","#FFD8A8","#FFF0B0","#C8F5E0","#C8E8FF","#E8D4FF"];return h[p%6]}
      if(gtype==="star"){const h=["#FFF8E0","#FFE8B0","#fff","#E8DCFF"];return h[p%4]}
      if(gtype==="heart"){const h=["#FFB7C8","#FFE0E8","#fff","#FFC8D8"];return h[p%4]}
      if(gtype==="frost")return p%3===0?"#fff":"#F0F6FF";
      return p%4===0?"#fff":"#EEF3F8"
    };
    if(gtype!=="off"&&gtype!=="silver"){
      const wash=e.createLinearGradient(t.x,t.y,t.x+t.w,t.y+t.h*.65);
      const a0=.025+amt*.05,a1=.015+amt*.035;
      if(gtype==="gold")wash.addColorStop(0,"rgba(255,230,180,"+a0+")"),wash.addColorStop(1,"rgba(255,245,220,"+a1+")");
      else if(gtype==="rose")wash.addColorStop(0,"rgba(255,200,215,"+a0+")"),wash.addColorStop(1,"rgba(255,235,240,"+a1+")");
      else if(gtype==="holo")wash.addColorStop(0,"rgba(255,200,230,"+a0+")"),wash.addColorStop(.5,"rgba(200,230,255,"+a1+")"),wash.addColorStop(1,"rgba(230,210,255,"+a0+")");
      else if(gtype==="candy")wash.addColorStop(0,"rgba(255,180,200,"+a0+")"),wash.addColorStop(.5,"rgba(255,230,180,"+a1+")"),wash.addColorStop(1,"rgba(200,230,255,"+a0+")");
      else if(gtype==="star")wash.addColorStop(0,"rgba(255,248,230,"+(.02+amt*.03)+")"),wash.addColorStop(1,"rgba(255,255,255,"+(.015+amt*.025)+")");
      else if(gtype==="heart")wash.addColorStop(0,"rgba(255,200,220,"+a0+")"),wash.addColorStop(1,"rgba(255,235,240,"+a1+")");
      else if(gtype==="frost")wash.addColorStop(0,"rgba(235,245,255,"+(.03+amt*.04)+")"),wash.addColorStop(1,"rgba(255,255,255,"+(.02+amt*.03)+")");
      e.fillStyle=wash,e.fillRect(t.x,t.y,t.w,t.h)
    }else if(gtype==="silver"){
      const wash=e.createLinearGradient(t.x,t.y,t.x+t.w,t.y+t.h*.5);
      wash.addColorStop(0,"rgba(240,245,255,"+(.02+amt*.04)+")"),wash.addColorStop(1,"rgba(255,255,255,"+(.015+amt*.03)+")");
      e.fillStyle=wash,e.fillRect(t.x,t.y,t.w,t.h)
    }
    for(let f=0;f<d&&f<Ce.length;f++){
      const p=Ce[f],c=t.x+p.x*t.w,b=t.y+p.y*t.h,u=Math.max(.3,p.r*t.w);
      e.globalAlpha=Math.min(.92,p.a*(.55+amt*.45));
      if(gtype==="star"&&p.kind===2){
        const L=u*2.4;
        e.strokeStyle=col(f),e.lineWidth=Math.max(.5,u*.24),e.beginPath();
        e.moveTo(c-L,b),e.lineTo(c+L,b),e.moveTo(c,b-L),e.lineTo(c,b+L),e.stroke();
        e.fillStyle="#fff",e.globalAlpha=Math.min(1,e.globalAlpha*1.1),e.beginPath(),e.arc(c,b,Math.max(.5,u*.32),0,Math.PI*2),e.fill()
      }else if(p.kind===2){
        const L=u*1.5;
        e.strokeStyle=col(f),e.lineWidth=Math.max(.45,u*.22),e.globalAlpha*=.8,e.beginPath();
        e.moveTo(c-L,b),e.lineTo(c+L,b),e.moveTo(c,b-L),e.lineTo(c,b+L),e.stroke()
      }else if(p.kind===1){
        e.fillStyle=col(f),e.beginPath(),e.arc(c,b,u*.95,0,Math.PI*2),e.fill();
        e.globalAlpha*=.8,e.fillStyle="#fff",e.beginPath(),e.arc(c-u*.22,b-u*.22,u*.34,0,Math.PI*2),e.fill()
      }else{
        e.fillStyle=col(f),e.beginPath(),e.arc(c,b,u*.85,0,Math.PI*2),e.fill()
      }
    }
    e.globalAlpha=1
  }
  const i=t.x+t.w*z(.32+n.ry/28,.08,.92),o=t.y+t.h*z(.2+n.rx/36,.06,.7),a=e.createRadialGradient(i,o,t.w*.02,i,o,t.w*.95),r=l.glitter==="off"?.1:.14+l.glitterAmount*.08;
  a.addColorStop(0,"rgba(255,255,255,"+r+")"),a.addColorStop(.45,"rgba(255,255,255,0.03)"),a.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=a,e.fillRect(t.x,t.y,t.w,t.h);
  (function(){
    const bs=l.borderStyle||(l.glitterBorder?"sparkle":"off");
    if(bs==="off")return;
    const x0=t.x+t.w*.035,y0=t.y+t.w*.035,bw=t.w*.93,bh=t.h-t.w*.07,br=t.r*.82;
    const sparkleCol=()=>l.glitter==="silver"||l.glitter==="holo"?"#E8F2FF":l.glitter==="rose"||l.glitter==="candy"?"#FFD0DC":"#FFE6A0";
    if(bs==="sparkle"||bs==="pearl"){
      const step=bs==="pearl"?Math.max(t.w*.048,5.5):Math.max(t.w*.038,4.2);
      const d=Qn(x0,y0,bw,bh,br,step);
      for(let f=0;f<d.length;f++){
        if(bs==="sparkle"&&f%2)continue;
        const q=d[f],rr=bs==="pearl"?Math.max(1.2,t.w*.0065):Math.max(.55,t.w*(.0024+((f*17)%7)*.0006));
        e.globalAlpha=bs==="pearl"?.7:.42+((f*13)%10)*.02;
        e.fillStyle=f%3===0?"#fff":sparkleCol();
        e.beginPath(),e.arc(q.x,q.y,rr,0,Math.PI*2),e.fill();
        if(bs==="pearl"&&f%3===0){e.globalAlpha=.4,e.fillStyle="#fff",e.beginPath(),e.arc(q.x-rr*.3,q.y-rr*.3,rr*.3,0,Math.PI*2),e.fill()}
      }
    }else if(bs==="hearts"||bs==="stars"||bs==="flower"){
      const step=bs==="stars"?Math.max(t.w*.11,12):Math.max(t.w*.09,10),d=Qn(x0,y0,bw,bh,br,step),sz=t.w*(bs==="stars"?.018:.016);
      for(let f=0;f<d.length;f++){
        if(f%2)continue;
        const q=d[f];
        e.save(),e.translate(q.x,q.y),e.rotate(f*.55),e.globalAlpha=.72,e.fillStyle=f%4?"#FF9EC0":"#FFE0A8";
        if(bs==="hearts"){e.beginPath(),e.moveTo(0,sz*.3),e.bezierCurveTo(-sz,-sz*.2,-sz*.9,-sz*.9,0,-sz*.35),e.bezierCurveTo(sz*.9,-sz*.9,sz,-sz*.2,0,sz*.3),e.fill()}
        else if(bs==="stars"){e.beginPath();for(let k=0;k<10;k++){const ang=-Math.PI/2+k*Math.PI/5,rad=k%2?sz*.38:sz;e.lineTo(Math.cos(ang)*rad,Math.sin(ang)*rad)}e.closePath(),e.fill();e.fillStyle="#fff",e.globalAlpha=.55,e.beginPath(),e.arc(0,0,sz*.18,0,Math.PI*2),e.fill()}
        else{for(let k=0;k<5;k++){e.rotate(Math.PI*2/5),e.beginPath(),e.ellipse(0,-sz*.45,sz*.28,sz*.5,0,0,Math.PI*2),e.fill()}e.beginPath(),e.arc(0,0,sz*.22,0,Math.PI*2),e.fillStyle="#FFE28A",e.fill()}
        e.restore()
      }
    }else if(bs==="dash"){
      e.save(),T(e,x0,y0,bw,bh,br),e.strokeStyle=sparkleCol(),e.globalAlpha=.45,e.lineWidth=Math.max(1.1,t.w*.005),e.setLineDash([t.w*.022,t.w*.02]),e.stroke(),e.restore()
    }else if(bs==="stroke"){
      e.save(),T(e,x0,y0,bw,bh,br),e.strokeStyle="#FFD0DC",e.globalAlpha=.4,e.lineWidth=Math.max(2,t.w*.01),e.stroke();
      e.strokeStyle="#fff",e.globalAlpha=.55,e.lineWidth=Math.max(1,t.w*.004),e.stroke(),e.restore()
    }else if(bs==="ribbon"){
      e.save(),T(e,x0,y0,bw,bh,br),e.strokeStyle="#FFB7C8",e.globalAlpha=.35,e.lineWidth=Math.max(2.4,t.w*.012),e.stroke();
      e.strokeStyle="#FFF0F5",e.globalAlpha=.65,e.lineWidth=Math.max(1,t.w*.0045),e.stroke(),e.restore();
      const d=Qn(x0,y0,bw,bh,br,Math.max(t.w*.08,8));
      for(let f=0;f<d.length;f+=3){
        e.globalAlpha=.5,e.fillStyle=f%4?"#fff":"#FFD0DC",e.beginPath(),e.arc(d[f].x,d[f].y,Math.max(.9,t.w*.004),0,Math.PI*2),e.fill()
      }
    }
    e.globalAlpha=1
  })();
  e.restore()
}function nvIsRing(a){
  return a&&a.kind==="decal"&&a.source&&a.source.type==="builtin"&&!!NV_RING[a.source.id]
}
function Vt(e,t,l,n,i){
  for(let o=0;
  o<l.length;
  o++){
    const a=l[o];
    if(a.kind==="stroke"){
      n||bl(e,t,a);
      continue
    }if(a.kind==="text"){
      !!a.aboveCamera===n&&Sl(e,t,a,i);
      continue
    }if(nvIsRing(a))continue;
    !!a.aboveCamera===n&&yl(e,t,a)
  }
}
function VtRing(e,t,l){
  for(let o=0;
  o<l.length;
  o++){
    const a=l[o];
    nvIsRing(a)&&a.aboveCamera&&yl(e,t,a)
  }
}const NV_RING={ "ring-platinum":1,"ring-gold":1,"ring-star":1 };
function nvNormalize(e){
  const L=nvCam(e.modelId).lens;
  let k=0;
  for(let i=0;i<e.items.length;i++){
    const it=e.items[i];
    if(!nvIsRing(it))continue;
    const c=L[k%L.length];
    k++,it.x=c.x,it.y=c.y,it.scale=2.05*c.r,it.rotation=0,it.aboveCamera=!0
  }
}
function nvBackdropImg(bd){
  if(!bd)return null;
  if(bd.type==="builtin"){const im=AI_IMG[bd.id];return im&&im.complete&&im.naturalWidth?im:null}
  if(bd.type==="image"){const im=ce[bd.imageId];return im||null}
  return null
}
function nvDrawBackdrop(e,t,bd){
  const img=nvBackdropImg(bd);
  if(!img)return;
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
  if(!iw||!ih)return;
  const scale=Math.max(t.w/iw,t.h/ih),dw=iw*scale,dh=ih*scale;
  e.drawImage(img,t.x+(t.w-dw)/2,t.y+(t.h-dh)/2,dw,dh)
}
function Mn(e,t,l,n,i){
  nvNormalize(l);
  const o=Xe(l),a=null;
  if(a)e.save(),e.shadowColor="rgba(62,36,20,0.26)",e.shadowBlur=t.w*.07,e.shadowOffsetY=t.w*.025,e.drawImage(a,t.x,t.y,t.w,t.h),e.restore(),e.drawImage(a,t.x,t.y,t.w,t.h);
  else pl(e,t,o);
  if(e.save(),T(e,t.x,t.y,t.w,t.h,t.r),e.clip(),l.backdrop&&nvDrawBackdrop(e,t,l.backdrop),l.tile){
    const r=JSON.stringify(l.tile)+"|"+Math.round(t.w);
    (r!==Kt||!we)&&(ml(t.w,t.h,l.tile),Kt=r),we&&e.drawImage(we,t.x,t.y,t.w,t.h)
  }if(Cl(e,t,l,n),e.restore(),Vt(e,t,l.items,!1,n.ry),a||cl(e,t,l.modelId,o),Vt(e,t,l.items,!0,n.ry),a||nvLensTop(e,t,l.modelId,o.base),VtRing(e,t,l.items),i.selection&&l.selectedId)for(let r=0;r<l.items.length;r++)l.items[r].id===l.selectedId&&wl(e,t,l.items[r])
}function dt(e,t){
  if(t.kind==="stroke")return null;
  const l=e.x+t.x*e.w,n=e.y+t.y*e.h;
  if(t.kind==="decal"){
    const o=t.scale*e.w,a=o/(t.aspect||1);
    return{
      cx:l,cy:n,hw:o/2,hh:a/2,rot:t.rotation
    }
  }const i=vn(t,t.fontScale*e.w,0);
  return{
    cx:l,cy:n,hw:i.width/2+8,hh:i.height/2+8,rot:t.rotation
  }
}function Ut(e,t,l,n,i){
  const o=n-e,a=i-t,r=Math.cos(-l),d=Math.sin(-l);
  return{
    x:o*r-a*d,y:o*d+a*r
  }
}function wl(e,t,l){
  if(l.kind==="stroke"){
    e.save(),T(e,t.x,t.y,t.w,t.h,t.r),e.clip(),e.strokeStyle="#E25B45",e.lineWidth=Math.max(2,l.width*t.w+4),e.globalAlpha=.35,e.lineCap="round",e.beginPath();
    const a=l.points;
    if(a.length){
      e.moveTo(t.x+a[0].x*t.w,t.y+a[0].y*t.h);
      for(let r=1;
      r<a.length;
      r++)e.lineTo(t.x+a[r].x*t.w,t.y+a[r].y*t.h);
      e.stroke()
    }e.restore();
    return
  }const n=dt(t,l);
  if(!n)return;
  const i=Math.max(16,t.w*.045);
  e.save(),e.translate(n.cx,n.cy),e.rotate(n.rot),e.strokeStyle="#E25B45",e.lineWidth=Math.max(1.5,t.w*.006),e.setLineDash([6,4]),e.strokeRect(-n.hw,-n.hh,n.hw*2,n.hh*2),e.setLineDash([]);
  const o=(a,r,d)=>{
    e.beginPath(),e.arc(a,r,i*.42,0,Math.PI*2),e.fillStyle=d,e.fill(),e.strokeStyle="#2C241C",e.lineWidth=1.5,e.stroke()
  };
  o(n.hw,n.hh,"#ffffff"),o(0,-n.hh-i*1.35,"#F7F1E6"),o(n.hw,-n.hh,"#E25B45"),e.strokeStyle="#E25B45",e.beginPath(),e.moveTo(0,-n.hh),e.lineTo(0,-n.hh-i*.9),e.stroke(),e.restore()
}function kl(e,t,l,n){
  const i=t.width*e.w*.5+e.w*.03;
  for(let o=0;
  o<t.points.length;
  o++){
    const a=e.x+t.points[o].x*e.w,r=e.y+t.points[o].y*e.h;
    if(Math.hypot(l-a,n-r)<=i)return!0
  }return!1
}function vl(e,t,l,n,i){
  const o=pe(e,t,l.modelId),a=l.selectedId;
  if(a)for(let r=0;
  r<l.items.length;
  r++){
    const d=l.items[r];
    if(d.id!==a||d.kind==="stroke")continue;
    const f=dt(o,d);
    if(!f)continue;
    const p=Math.max(16,o.w*.045),c=Ut(f.cx,f.cy,f.rot,n,i),b=(u,w)=>Math.hypot(c.x-u,c.y-w)<=p*.85;
    if(b(f.hw,-f.hh))return{
      id:d.id,handle:"delete"
    };
    if(b(f.hw,f.hh))return{
      id:d.id,handle:"scale"
    };
    if(b(0,-f.hh-p*1.35))return{
      id:d.id,handle:"rotate"
    }
  }for(let r=l.items.length-1;
  r>=0;
  r--){
    const d=l.items[r];
    if(d.kind==="stroke"){
      if(kl(o,d,n,i))return{
        id:d.id,handle:"move"
      };
      continue
    }const f=dt(o,d);
    if(!f)continue;
    const p=Ut(f.cx,f.cy,f.rot,n,i),c=o.w*.02;
    if(Math.abs(p.x)<=f.hw+c&&Math.abs(p.y)<=f.hh+c)return{
      id:d.id,handle:"move"
    }
  }return null
}function Pl(e,t){
  const l=e.canvas;
  e.setTransform(1,0,0,1,0,0),e.clearRect(0,0,l.width,l.height);
  const n=pe(l.width,l.height,s.modelId);
  Mn(e,n,s,t,{
    selection:!0
  })
}const Zt=1080,$t=1440,le=["本机已开光","Designed by 我妈","今日份新机","贴完舍不得换","拆盒完成","这台有灵气","新机到手","给自己的背卡","请勿戴壳","Pro Max Ultra 至尊版"];
let Qt=null;
function Ml(e,t,l,n,i){
  const o=Pt(n);
  for(let a=0;
  a<1600;
  a++)e.globalAlpha=i*(.25+o()),e.fillStyle="#5a3a28",e.fillRect(o()*t,o()*l,o()>.85?2:1,1);
  e.globalAlpha=1
}function xt(e,t,l,n,i){
  const o=e.createRadialGradient(t,l,n*.1,t,l,n);
  o.addColorStop(0,i),o.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=o,e.beginPath(),e.ellipse(t,l,n,n*.62,0,0,Math.PI*2),e.fill()
}function El(e,t,l,n,i){
  e.save(),e.translate(t,l),e.rotate(n),T(e,-110,-18,220,36,4),e.fillStyle=i?"rgba(226,166,59,0.55)":"rgba(226,91,69,0.82)",e.fill(),e.clip(),e.fillStyle="rgba(255,255,255,0.35)";
  for(let o=-3;
  o<8;
  o++)e.fillRect(-120+o*28,-30,10,70);
  e.restore()
}function Il(e,t){
  const l=Qt||document.createElement("canvas");
  Qt=l,l.width=Zt,l.height=$t;
  const n=l.getContext("2d");
  if(!n)return"";
  const i=Zt,o=$t,a=t.night,r=n.createLinearGradient(0,0,0,o);
  a?(r.addColorStop(0,"#1C1815"),r.addColorStop(.55,"#2A241E"),r.addColorStop(1,"#120F0D")):(r.addColorStop(0,"#FBF4EA"),r.addColorStop(.5,"#F3E4D0"),r.addColorStop(1,"#E6D0B4")),n.fillStyle=r,n.fillRect(0,0,i,o);
  const d=n.createRadialGradient(i*.48,o*.22,30,i*.5,o*.32,i*.72);
  d.addColorStop(0,a?"rgba(255,220,180,0.16)":"rgba(255,255,255,0.8)"),d.addColorStop(1,"rgba(255,255,255,0)"),n.fillStyle=d,n.fillRect(0,0,i,o),xt(n,i*.18,o*.78,280,a?"rgba(226,166,59,0.08)":"rgba(255,255,255,0.45)"),xt(n,i*.82,o*.7,240,a?"rgba(142,183,214,0.06)":"rgba(226,91,69,0.08)"),Ml(n,i,o,a?11:7,a?.05:.035);
  const f=n.createRadialGradient(i/2,o*.46,i*.2,i/2,o*.48,i*.78);
  f.addColorStop(0,"rgba(0,0,0,0)"),f.addColorStop(1,a?"rgba(0,0,0,0.45)":"rgba(90,50,30,0.16)"),n.fillStyle=f,n.fillRect(0,0,i,o),El(n,150,210,-.4,a);
  const p=dl(e.modelId),c=500,b=c*(p.h/p.w),u=520,w=690;
  n.save(),n.translate(u,w),n.rotate(-7*Math.PI/180);
  const P={
    x:-c/2,y:-b/2,w:c,h:b,r:c*.158
  };
  Mn(n,P,e,{
    rx:8,ry:-10
  },{
    selection:!1
  }),n.restore(),T(n,56,78,280,72,14),n.fillStyle=q.coral,n.fill(),n.beginPath(),n.arc(92,114,10,0,Math.PI*2),n.fillStyle=a?"#2A241E":q.paper,n.fill(),n.fillStyle="#fff",n.font='32px "Smiley Sans", sans-serif',n.textAlign="left",n.textBaseline="middle",n.fillText("新机拆盒卡",116,114),n.textAlign="right",n.fillStyle=a?"rgba(247,241,230,0.82)":q.ink,n.font='22px "Smiley Sans", sans-serif',n.fillText(t.serial,i-56,96),n.font='18px "Smiley Sans", sans-serif',n.fillStyle=a?"rgba(247,241,230,0.6)":q.inkSoft,n.fillText(t.date,i-56,128),n.save(),n.translate(760,1188),n.rotate(.09),n.shadowColor="rgba(40,24,16,0.25)",n.shadowBlur=18,n.shadowOffsetY=8,T(n,-200,-78,400,168,18),n.fillStyle="#FFFDF9",n.fill(),n.shadowColor="transparent",n.fillStyle=q.coral,n.textAlign="center",n.textBaseline="middle",n.font='18px "Smiley Sans", sans-serif',n.fillText("开盒铺",0,-46);
  const C=/^[A-Za-z]/.test(t.caption)?"hand":"smiley";
  let k=34;
  const E=340;
  for(let L=0;
  L<8&&(n.font=k+'px "Smiley Sans", sans-serif',!(n.measureText(t.caption).width<=E));
  L++)k-=2;
  return il(n,t.caption,C,k,q.ink,0,-4),n.fillStyle=q.inkSoft,n.font='16px "Smiley Sans", sans-serif',n.fillText(rl(e),0,48),n.restore(),n.globalAlpha=a?.72:.55,n.fillStyle=a?"#F7F1E6":q.ink,n.textAlign="left",n.font='22px "Smiley Sans", sans-serif',n.fillText("开盒铺 · 手机背面",56,o-64),n.globalAlpha=1,l.toDataURL("image/png")
}const S={
  rx:0,ry:0,pen:!1,tab:"sticker",tileMode:!1,penColor:"#2C241C",penWidth:.012,textDraft:{
    font:"smiley",effect:"solid",color:"#E25B45",curve:0,fontScale:.078
  }
},X={
  
};
let A="none",G="",xe=0,et=0,de=1,We=0,se=1,Ne=0,En=0,In=0,Fn=0,An=0,en=0,ae=0,De="";
function Fl(e){
  return e.kind==="decal"||e.kind==="text"
}function tn(e,t,l){
  const n=e.parentElement||e,i=n.getBoundingClientRect(),o=i.left+i.width/2,a=i.top+i.height/2;
  let r=t-o,d=l-a;
  const f=getComputedStyle(n).transform;
  if(f&&f!=="none")try{
    const P=new DOMMatrix(f).inverse().transformPoint(new DOMPoint(r,d,0));
    r=P.x,d=P.y
  }catch(w){
    
  }const p=r+n.clientWidth/2,c=d+n.clientHeight/2,b=e.clientWidth?e.width/e.clientWidth:1,u=e.clientHeight?e.height/e.clientHeight:1;
  return{
    x:p*b,y:c*u
  }
}function Al(e){
  const t=s.items.findIndex(n=>n.id===e);
  if(t<0||t===s.items.length-1)return;
  const l=s.items[t];
  s.items.splice(t,1),s.items.push(l)
}function te(e,t){
  const l=pe(t.width,t.height,s.modelId);
  return{
    x:l.x+e.x*l.w,y:l.y+e.y*l.h
  }
}function nn(e,t,l,n){
  const i=pe(t.width,t.height,s.modelId);
  e.x=z((l-i.x)/i.w,-.08,1.08),e.y=z((n-i.y)/i.h,-.04,1.04),nvSyncCam(e,s.modelId)
}function ye(){
  const e=[],t=Object.keys(X);
  for(let l=0;
  l<t.length;
  l++)e.push(X[Number(t[l])]);
  return e
}function Tl(e){
  const t=ye();
  if(t.length<2)return;
  const l=Ee();
  if(!l||l.kind==="stroke")return;
  const n=t[0],i=t[1],o=i.x-n.x,a=i.y-n.y;
  de=Math.max(8,Math.hypot(o,a)),We=Math.atan2(a,o),se=l.kind==="text"?l.fontScale:l.scale,Ne=l.rotation;
  const r=te(l,e);
  En=r.x,In=r.y,Fn=(n.x+i.x)/2,An=(n.y+i.y)/2,A="pinch",G=l.id
}function Bl(e){
  const t=i=>{
    e.setPointerCapture(i.pointerId);
    const o=tn(e,i.clientX,i.clientY);
    if(X[i.pointerId]={
      x:o.x,y:o.y,cx:i.clientX,cy:i.clientY
    },i.preventDefault(),S.pen&&S.tab==="draw"){
      U(),A="draw",ae=0;
      const r=pe(e.width,e.height,s.modelId);
      De=Z(),s.items.push({
        id:De,kind:"stroke",color:S.penColor,width:S.penWidth,points:[{
          x:(o.x-r.x)/r.w,y:(o.y-r.y)/r.h
        }]
      }),s.selectedId=null,I();
      return
    }if(ye().length>=2){
      U(),Tl(e);
      return
    }const a=vl(e.width,e.height,s,o.x,o.y);
    if(a&&a.handle==="delete"){
      A="delete",G=a.id,ae=0;
      return
    }if(a&&(a.handle==="scale"||a.handle==="rotate"||a.handle==="move")){
      U();
      const r=s.items.filter(d=>d.id===a.id)[0];
      if(!r||r.kind==="stroke"){
        A="move",G=a.id,s.selectedId=a.id,I();
        return
      }if(Al(a.id),s.selectedId=a.id,G=a.id,a.handle==="scale"){
        A="scale";
        const d=te(r,e);
        de=Math.max(12,Math.hypot(o.x-d.x,o.y-d.y)),se=r.kind==="text"?r.fontScale:r.scale
      }else if(a.handle==="rotate"){
        A="rotate";
        const d=te(r,e);
        We=Math.atan2(o.y-d.y,o.x-d.x),Ne=r.rotation
      }else{
        A="move";
        const d=te(r,e);
        xe=d.x-o.x,et=d.y-o.y
      }I();
      return
    }A="tilt",ae=0,s.selectedId=null,I()
  },l=i=>{
    if(!X[i.pointerId])return;
    const o=tn(e,i.clientX,i.clientY),a=X[i.pointerId];
    if(ae+=Math.hypot(i.clientX-a.cx,i.clientY-a.cy),X[i.pointerId]={
      x:o.x,y:o.y,cx:i.clientX,cy:i.clientY
    },i.preventDefault(),A==="draw"){
      const d=pe(e.width,e.height,s.modelId),f=s.items.filter(p=>p.id===De)[0];
      if(f&&f.kind==="stroke"){
        const p=(o.x-d.x)/d.w,c=(o.y-d.y)/d.h,b=f.points[f.points.length-1];
        (!b||Math.hypot(p-b.x,c-b.y)>.004)&&f.points.push({
          x:p,y:c
        })
      }I();
      return
    }if(A==="tilt"){
      const d=i.clientX-a.cx,f=i.clientY-a.cy;
      S.ry=z(S.ry+d*.09,-10,10),S.rx=z(S.rx+f*.09,-9,9),I();
      return
    }if(A==="pinch"){
      const d=ye();
      if(d.length<2)return;
      const f=d[0],p=d[1],c=s.items.filter(C=>C.id===G)[0];
      if(!c||c.kind==="stroke")return;
      const b=Math.max(8,Math.hypot(p.x-f.x,p.y-f.y)),u=Math.atan2(p.y-f.y,p.x-f.x),w=(f.x+p.x)/2,P=(f.y+p.y)/2;
      c.kind==="text"?c.fontScale=z(se*(b/de),.04,.2):c.scale=z(se*(b/de),.08,.98),c.rotation=Ne+(u-We),nn(c,e,En+(w-Fn),In+(P-An)),I();
      return
    }const r=s.items.filter(d=>d.id===G)[0];
    if(!(!r||r.kind==="stroke")){
      if(A==="move")nn(r,e,o.x+xe,o.y+et),I();
      else if(A==="scale"){
        const d=te(r,e),f=Math.max(8,Math.hypot(o.x-d.x,o.y-d.y));
        r.kind==="text"?r.fontScale=z(se*(f/de),.04,.2):r.scale=z(se*(f/de),.08,.98),nvSyncCam(r,s.modelId),I()
      }else if(A==="rotate"){
        const d=te(r,e),f=Math.atan2(o.y-d.y,o.x-d.x);
        r.rotation=Ne+(f-We),I()
      }
    }
  },n=i=>{
    const o=A;
    if(delete X[i.pointerId],o==="pinch"&&ye().length===1){
      const a=Ee(),r=ye()[0];
      if(a&&a.kind!=="stroke"&&Fl(a)){
        const d=te(a,e);
        xe=d.x-r.x,et=d.y-r.y,A="move",G=a.id
      }return
    }if(!(Object.keys(X).length>0)){
      if(o==="delete"&&ae<8)M(()=>{
        s.items=s.items.filter(a=>a.id!==G),s.selectedId===G&&(s.selectedId=null)
      });
      else if(o==="tilt"){
        if(ae<6){
          const a=Date.now();
          a-en<320&&(S.rx=0,S.ry=0,I()),en=a
        }
      }else o!=="none"&&N();
      A="none",G="",De=""
    }
  };
  e.addEventListener("pointerdown",t,{
    passive:!1
  }),e.addEventListener("pointermove",l,{
    passive:!1
  }),e.addEventListener("pointerup",n),e.addEventListener("pointercancel",n)
}const Dl=[[{
  id:"ai-bunny",x:.2,y:.48,scale:.2,rot:-6
},{
  id:"ai-bow",x:.8,y:.5,scale:.16,rot:12
},{
  id:"ai-heart",x:.26,y:.7,scale:.18,rot:-10
},{
  id:"ai-daisy",x:.76,y:.72,scale:.18,rot:8
},{
  id:"ai-boba",x:.5,y:.56,scale:.17,rot:4
},{
  id:"ai-star",x:.48,y:.86,scale:.12,rot:0
},{
  id:"ai-sparkle",x:.34,y:.44,scale:.11,rot:0
},{
  id:"ai-berry",x:.14,y:.64,scale:.15,rot:-8
}],[{
  id:"ai-cat",x:.22,y:.5,scale:.19,rot:-4
},{
  id:"ai-peach",x:.78,y:.52,scale:.18,rot:6
},{
  id:"ai-donut",x:.28,y:.74,scale:.18,rot:-6
},{
  id:"ai-cloud",x:.72,y:.7,scale:.16,rot:4
},{
  id:"ai-moon",x:.5,y:.46,scale:.16,rot:0
},{
  id:"ai-cherry",x:.84,y:.64,scale:.14,rot:8
},{
  id:"ai-bear",x:.16,y:.68,scale:.16,rot:-6
}],[{
  id:"ai-rose",x:.24,y:.52,scale:.18,rot:-8
},{
  id:"ai-icecream",x:.76,y:.5,scale:.18,rot:6
},{
  id:"ai-sheep",x:.3,y:.74,scale:.18,rot:-4
},{
  id:"ai-cam",x:.72,y:.74,scale:.16,rot:8
},{
  id:"ai-heart",x:.5,y:.58,scale:.16,rot:0
},{
  id:"ai-sparkle",x:.18,y:.46,scale:.12,rot:0
},{
  id:"ai-bow",x:.84,y:.62,scale:.14,rot:10
}],[{
  id:"ai-bunny",x:.18,y:.7,scale:.17,rot:-12
},{
  id:"ai-cat",x:.82,y:.7,scale:.17,rot:10
},{
  id:"ai-daisy",x:.35,y:.5,scale:.15,rot:0
},{
  id:"ai-peach",x:.65,y:.5,scale:.15,rot:0
},{
  id:"ai-star",x:.5,y:.82,scale:.13,rot:0
},{
  id:"ai-cloud",x:.5,y:.42,scale:.14,rot:0
},{
  id:"ai-kiss",x:.22,y:.48,scale:.12,rot:-20
},{
  id:"ai-gem",x:.78,y:.48,scale:.12,rot:15
}]],Ll=[[{
  id:"ai-cd",x:.22,y:.5,scale:.2,rot:10
},{
  id:"ai-star",x:.78,y:.5,scale:.18,rot:-8
},{
  id:"ai-lipstick",x:.7,y:.74,scale:.18,rot:6
},{
  id:"ai-butterfly",x:.26,y:.74,scale:.18,rot:-6
},{
  id:"ai-sparkle",x:.5,y:.86,scale:.13,rot:0
},{
  id:"ai-rainbow",x:.5,y:.56,scale:.16,rot:0
}],[{
  id:"ai-gem",x:.24,y:.5,scale:.18,rot:-6
},{
  id:"ai-kiss",x:.78,y:.52,scale:.16,rot:8
},{
  id:"ai-cd",x:.3,y:.74,scale:.18,rot:-10
},{
  id:"ai-butterfly",x:.74,y:.74,scale:.16,rot:10
},{
  id:"ai-star",x:.5,y:.44,scale:.14,rot:0
},{
  id:"ai-lipstick",x:.84,y:.64,scale:.15,rot:4
}],[{
  id:"ai-rainbow",x:.22,y:.48,scale:.18,rot:-8
},{
  id:"ai-cd",x:.78,y:.5,scale:.18,rot:12
},{
  id:"ai-gem",x:.28,y:.72,scale:.17,rot:-6
},{
  id:"ai-sparkle",x:.72,y:.72,scale:.14,rot:0
},{
  id:"ai-kiss",x:.5,y:.58,scale:.15,rot:0
},{
  id:"ai-star",x:.5,y:.86,scale:.12,rot:0
}],[{
  id:"ai-butterfly",x:.2,y:.52,scale:.17,rot:-14
},{
  id:"ai-rainbow",x:.8,y:.52,scale:.17,rot:10
},{
  id:"ai-cd",x:.5,y:.72,scale:.2,rot:0
},{
  id:"ai-gem",x:.35,y:.44,scale:.13,rot:0
},{
  id:"ai-lipstick",x:.68,y:.44,scale:.13,rot:8
},{
  id:"ai-sparkle",x:.5,y:.88,scale:.12,rot:0
}]],Rl={
  cream:{
    m17pro:"silver",m17:"white",m15:"pink"
  },y2k:{
    m17pro:"deepblue",m17:"black",m15:"blue"
  }
},ln=["m17pro","m17","m15"];
function Ge(e,t,l,n,i,o,a){
  if(!qe(t))return;
  const onCam=!!a||nvHitsCam(e.modelId,l,n,i);
  e.items.push({
    id:Z(),kind:"decal",source:{
      type:"builtin",id:t
    },x:l,y:n,scale:i,rotation:o*Math.PI/180,aboveCamera:onCam,aspect:1
  })
}const NV_ANCHOR={wreath:"badge",petals:"badge","petals-pink":"badge","ring-platinum":"lens","ring-star":"lens","ring-gold":"lens","ears-bunny":"above","ears-cat":"above","ears-bear":"above",horns:"above",halo:"above",crown:"above","bow-top":"above",eyes:"below",cheeks:"below"};
function Tn(e,t){
  const a=NV_ANCHOR[t]||zn(t);
  if(!a)return;
  const n=nvCam(e.modelId).lens,u=nvZone(e.modelId),c=(u.x0+u.x1)/2,m=(u.y0+u.y1)/2;
  if(a==="lens"){
    for(let f=0;f<n.length;f++)Ge(e,t,n[f].x,n[f].y,2.08*n[f].r,0,!0);
    return
  }
  if(a==="badge"){
    const f=.36,y=Math.min(u.y1+f*.56+.03,1-f*.56-.02);
    Ge(e,t,Math.min(Math.max(c,.06),.94),y,f,0,!0);
    return
  }
  if(a==="below"){
    const f=Math.min(.34,Math.max(.26,(u.x1-u.x0)*.62)),y=Math.min(u.y1+.1,.86);
    Ge(e,t,Math.min(Math.max(c,.16),.84),y,f,0,!0);
    return
  }
  if(a==="above"){
    const ax=Math.min(.9,Math.max(.1,c)),ay=Math.max(.055,u.y0*.45);
    Ge(e,t,ax,ay,.2,0,!0);
    return
  }
  let p=0;
  for(let f=0;f<n.length;f++)p=Math.max(p,Math.hypot(n[f].x-c,n[f].y-m)+n[f].r);
  const k=Math.min(2.06*p,2*Math.min(c,1-c,.24));
  Ge(e,t,c,Math.max(m,k/2+.01),k,0,!0)
}function on(e,t,l,n,i,o,a,r){
  const it={
    id:Z(),kind:"text",text:t,font:l,effect:n,color:i,color2:"#ffffff",fontScale:o,curve:a,x:.5,y:r,rotation:(Math.random()-.5)*.08,aboveCamera:!1
  };
  nvSyncCam(it,e.modelId),e.items.push(it)
}const THEME_PACKS=[
  {id:"ocean",bg:"ai-wp-ocean",color:{m17pro:"deepblue",m17:"mist",m15:"blue"},glitter:"frost",border:"pearl",pool:["ai-jellyfish","ai-shell","ai-starfish","ai-coral","ai-seaweed","ai-bubbles","ai-seahorse","ai-fishschool","ai-fish","ai-chest"],line:["海底捞不到我","我是条咸鱼","今天也想躺平","海底小纵队报到"],fs:"#8EB7D6"},
  {id:"midsummer",bg:"ai-wp-night",color:{m17pro:"deepblue",m17:"lavender",m15:"black"},glitter:"star",border:"sparkle",pool:["ai-fireflies","ai-mushroom","ai-moon","ai-crescent","ai-sparkle","ai-butterfly","ai-star"],line:["萤火虫正在打工","梦里什么都有","夏夜不要睡觉","有事梦里说"],fs:"#CDB6E8"},
  {id:"sakura",bg:"ai-wp-sakura",color:{m17pro:"silver",m17:"white",m15:"pink"},glitter:"rose",border:"hearts",pool:["ai-petals","ai-bunny","ai-daisy","ai-heart","ai-bow","ai-cherry","ai-cloud"],line:["樱花限定可爱","春天欠我一个抱抱","粉色使人快乐"],fs:"#E25B45"},
  {id:"cafe",bg:"ai-wp-cafe",color:{m17pro:"cosmic",m17:"white",m15:"yellow"},glitter:"gold",border:"flower",pool:["ai-macaron","ai-latte","ai-cookie","ai-croissant","ai-cupcake","ai-donut"],line:["咖啡续命中","不上班只上糖","今天也要快乐","拿铁比爱情靠谱"],fs:"#E2A63B"},
  {id:"galaxy",bg:"ai-wp-galaxy",color:{m17pro:"deepblue",m17:"black",m15:"blue"},glitter:"holo",border:"stars",pool:["ai-planet","ai-star","ai-crescent","ai-sparkle","ai-bolt"],line:["宇宙第一可爱","在银河系发呆","星星替我加班","美到外太空"],fs:"#C9B6FF"},
  {id:"autumn",bg:"ai-wp-autumn",color:{m17pro:"cosmic",m17:"white",m15:"yellow"},glitter:"gold",border:"dash",pool:["ai-leaf","ai-bouquet","ai-cookie","ai-latte","ai-bear"],line:["秋天适合想念","捡到一片小秋天","天凉记得想我"],fs:"#F08A3E"},
  {id:"cloud",bg:"ai-wp-cloudy",color:{m17pro:"silver",m17:"mist",m15:"blue"},glitter:"frost",border:"pearl",pool:["ai-cloud","ai-sheep","ai-moon","ai-star","ai-bunny"],line:["云朵替我上班","软倒起不来","轻轻飘走","做一朵正经的云"],fs:"#8EB7D6"},
  {id:"coquette",bg:"ai-wp-coquette",color:{m17pro:"silver",m17:"lavender",m15:"pink"},glitter:"rose",border:"ribbon",pool:["ai-minibow","ai-ribbon2","ai-pearls","ai-heart","ai-kiss","ai-lipstick","ai-envelope"],line:["禁止心动，违者亲我","本人很贵，请勿赊账","可爱到犯规","甜心营业中"],fs:"#E23B8A"},
  {id:"winter",bg:"ai-wp-winter",color:{m17pro:"silver",m17:"mist",m15:"blue"},glitter:"frost",border:"pearl",pool:["ai-snow","ai-bear","ai-latte","ai-cloud","ai-cookie"],line:["冷到不想说话","冬日限定的我","暖宝宝分你一半"],fs:"#8EB7D6"},
  {id:"beach",bg:"ai-wp-beach",color:{m17pro:"cosmic",m17:"mist",m15:"yellow"},glitter:"gold",border:"dash",pool:["ai-fish","ai-sunglasses","ai-icecream","ai-star","ai-cam"],line:["海风帮我请假","晒黑也是一种努力","假期模式已开"],fs:"#F08A3E"},
  {id:"garden",bg:"ai-wp-garden",color:{m17pro:"silver",m17:"sage",m15:"green"},glitter:"rose",border:"flower",pool:["ai-butterfly","ai-tulip","ai-daisy","ai-clover2","ai-leaf","ai-frog","ai-mushroom","ai-petals"],line:["花园里长了个我","蚂蚁都比我勤奋","蝴蝶请假了"],fs:"#6FAE98"},
  {id:"music",bg:"ai-wp-galaxy",color:{m17pro:"deepblue",m17:"lavender",m15:"black"},glitter:"candy",border:"sparkle",pool:["ai-cd","ai-notes","ai-headphone","ai-star","ai-bolt","ai-gamepad"],line:["耳机一戴，谁都不爱","循环单曲中","音乐比人靠谱"],fs:"#C45B8A"},
  {id:"milk",bg:"ai-wp-milk",color:{m17pro:"silver",m17:"white",m15:"yellow"},glitter:"gold",border:"pearl",pool:["ai-bunny","ai-sheep","ai-cloud","ai-moon","ai-latte","ai-cookie","ai-boba","ai-bow"],line:["奶油味的我","软软的好欺负","请投喂，谢谢","甜得不讲道理"],fs:"#C79B6A"},
  {id:"strawberry",bg:"ai-wp-strawberry",color:{m17pro:"silver",m17:"pink",m15:"pink"},glitter:"rose",border:"hearts",pool:["ai-berry","ai-cherry","ai-heart","ai-bow","ai-macaron","ai-lollipop","ai-bunny","ai-kiss"],line:["草莓味的可爱","今天也要甜一点","心动草莓季"],fs:"#E2557E"},
  {id:"matcha",bg:"ai-wp-matcha",color:{m17pro:"silver",m17:"sage",m15:"green"},glitter:"frost",border:"flower",pool:["ai-frog","ai-clover2","ai-tulip","ai-daisy","ai-leaf","ai-latte","ai-mushroom"],line:["抹茶味的躺平","慢慢来也是本事","不着急，会甜的"],fs:"#7CA46A"},
  {id:"lemonade",bg:"ai-wp-lemon",color:{m17pro:"cosmic",m17:"mist",m15:"yellow"},glitter:"gold",border:"dash",pool:["ai-sparkle","ai-icecream","ai-duck","ai-chick","ai-sunglasses","ai-donut"],line:["柠檬精本人","我酸了但很甜","冒泡的快乐","开心就摇一摇"],fs:"#D9A21B"},
  {id:"butterheart",bg:"ai-wp-butterheart",color:{m17pro:"silver",m17:"white",m15:"yellow"},glitter:"gold",border:"hearts",pool:["ai-heart","ai-bear","ai-chick","ai-cookie","ai-bouquet","ai-minibow"],line:["心软，请手下留情","心动不如动手","一点点心动"],fs:"#D89A4E"},
  {id:"lilac",bg:"ai-wp-lilac",color:{m17pro:"deepblue",m17:"lavender",m15:"pink"},glitter:"holo",border:"sparkle",pool:["ai-star","ai-crescent","ai-sparkle","ai-butterfly","ai-pearls","ai-moon"],line:["做甜甜的梦","紫色心情","安静地发光"],fs:"#9C7BD6"},
  {id:"mintwave",bg:"ai-wp-mint",color:{m17pro:"silver",m17:"sage",m15:"blue"},glitter:"frost",border:"pearl",pool:["ai-seahorse","ai-shell","ai-bubbles","ai-fish","ai-duck","ai-starfish"],line:["薄荷味的清醒","海浪替我上班","清凉一下也很好"],fs:"#4FA894"},
  {id:"peach",bg:"ai-wp-peach",color:{m17pro:"silver",m17:"pink",m15:"pink"},glitter:"rose",border:"flower",pool:["ai-peach","ai-petals","ai-heart","ai-rose","ai-icecream","ai-bow"],line:["蜜桃味的我","温柔是种超能力","今天很桃气"],fs:"#E27D62"},
  {id:"caramel",bg:"ai-wp-caramel",color:{m17pro:"cosmic",m17:"white",m15:"yellow"},glitter:"gold",border:"dash",pool:["ai-cupcake","ai-waffle","ai-donut","ai-latte","ai-cookie","ai-croissant"],line:["焦糖布丁营业中","甜品治愈一切","慢慢吃比较甜"],fs:"#B8814C"},
  {id:"aurora",bg:"ai-wp-aurora",color:{m17pro:"deepblue",m17:"lavender",m15:"black"},glitter:"holo",border:"sparkle",pool:["ai-star","ai-sparkle","ai-crescent","ai-moon","ai-pearls","ai-snow"],line:["极光替我发光","今晚的天空在营业","许个愿吧"],fs:"#8FE3C8"},
  {id:"daisy",bg:"ai-wp-daisy",color:{m17pro:"silver",m17:"sage",m15:"yellow"},glitter:"gold",border:"flower",pool:["ai-daisy","ai-tulip","ai-butterfly","ai-clover2","ai-leaf","ai-heart","ai-chick"],line:["花田里的小可爱","今天也努力开花","晒太阳是正经事"],fs:"#5E9A57"},
  {id:"cow",bg:"ai-wp-cow",color:{m17pro:"silver",m17:"white",m15:"yellow"},glitter:"frost",border:"dash",pool:["ai-sheep","ai-bunny","ai-cloud","ai-cookie","ai-latte","ai-heart"],line:["哞哞营业中","今天也很牛","牛奶味的一天"],fs:"#6A5343"},
  {id:"snow",bg:"ai-wp-snow",color:{m17pro:"silver",m17:"mist",m15:"blue"},glitter:"frost",border:"pearl",pool:["ai-snow","ai-bear","ai-latte","ai-cloud","ai-cookie","ai-crescent"],line:["雪夜小屋已开灯","冷到只想抱抱","把冬天装进口袋"],fs:"#8FB3CC"},
  {id:"starfield",bg:"ai-wp-starfield",color:{m17pro:"deepblue",m17:"black",m15:"blue"},glitter:"star",border:"stars",pool:["ai-planet","ai-star","ai-crescent","ai-sparkle","ai-gem","ai-moon"],line:["星星排队下班","今晚的星座是我","宇宙级可爱"],fs:"#C9B6FF"},
  {id:"rainbow",bg:"ai-wp-rainbow",color:{m17pro:"silver",m17:"lavender",m15:"pink"},glitter:"candy",border:"dash",pool:["ai-rainbow","ai-cloud","ai-star","ai-sparkle","ai-icecream","ai-heart"],line:["吃掉这道彩虹","今天有亿点点甜","云上小卖部"],fs:"#E58BB4"},
  {id:"cherry",bg:"ai-wp-cherry",color:{m17pro:"deepblue",m17:"lavender",m15:"pink"},glitter:"rose",border:"hearts",pool:["ai-petals","ai-heart","ai-star","ai-bow","ai-crescent","ai-cherry"],line:["夜樱限定浪漫","月亮也来赏花","悄悄开在夜里"],fs:"#F3C3D3"}
];

function nvSendBack(e){
  if(!e.items.length)return;
  const it=e.items.pop();
  it.aboveCamera=!1,e.items.unshift(it)
}
const NV_YW=2.1;
function nvBox(x,y,hx,hy,rot){
  return{x:x,y:y*NV_YW,hx:hx,hy:hy,rot:rot||0}
}
function nvHalfProj(o,ax){
  const c=Math.cos(o.rot),s=Math.sin(o.rot);
  return o.hx*Math.abs(c*ax[0]+s*ax[1])+o.hy*Math.abs(-s*ax[0]+c*ax[1])
}
function nvOverlap(a,b,pad){
  const dx=b.x-a.x,dy=b.y-a.y,ac=Math.cos(a.rot),as=Math.sin(a.rot),bc=Math.cos(b.rot),bs=Math.sin(b.rot);
  const axes=[[ac,as],[-as,ac],[bc,bs],[-bs,bc]];
  for(let i=0;i<4;i++){
    const ax=axes[i],d=Math.abs(dx*ax[0]+dy*ax[1]);
    if(d>nvHalfProj(a,ax)+nvHalfProj(b,ax)+pad)return!1
  }
  return!0
}
function nvBusy(placed,box,pad){
  for(let i=0;i<placed.length;i++)if(nvOverlap(box,placed[i],pad))return!0;
  return!1
}
function nvPickSpot(placed,z,sc,textBox,rot){
  const yMin=Math.max(z.y1+.06,.4),yMax=.95;
  for(let t=0;t<90;t++){
    const y=yMin+Math.random()*(yMax-yMin),x=.1+Math.random()*.8;
    const box=nvBox(x,y,sc*.5,sc*.5,rot);
    if(box.y-box.hy<z.y1*NV_YW+.01)continue;
    if(box.y+box.hy>NV_YW*.955)continue;
    if(textBox&&nvOverlap(box,textBox,.02))continue;
    if(nvBusy(placed,box,.02))continue;
    return{x:x,y:y,box:box}
  }
  return null
}
function st(e,t,l){
  const theme=l&&Math.random()<.75?THEME_PACKS[Math.floor(Math.random()*THEME_PACKS.length)]:null;
  l&&Math.random()<.85&&(e.modelId=ln[Math.floor(Math.random()*ln.length)]);
  e.items=[],e.tile=null,e.backdrop=null,e.selectedId=null;
  if(theme){
    e.glitter=theme.glitter,e.glitterAmount=.26+.2*Math.random(),e.borderStyle=theme.border,e.glitterBorder=theme.border==="sparkle"||theme.border==="pearl"||theme.border==="hearts"||theme.border==="stars"||theme.border==="flower";
    const want=theme.color[e.modelId]||theme.color.m17pro||theme.color.m17,avail=Ie(e.modelId);
    e.colorId=avail.some(c=>c.id===want)?want:(avail[0]?avail[0].id:e.colorId)
  }else{
    e.colorId=Rl[t][e.modelId],e.glitter=t==="cream"?(Math.random()<.55?"rose":Math.random()<.5?"frost":"gold"):(Math.random()<.4?"silver":Math.random()<.5?"holo":"candy"),e.glitterAmount=.28+.22*Math.random(),e.borderStyle=["off","off","pearl","hearts","flower","dash","sparkle"][Math.floor(Math.random()*7)],e.glitterBorder=e.borderStyle==="sparkle"||e.borderStyle==="pearl"
  }
  const z=nvZone(e.modelId),textY=Math.min(.86,Math.max(z.y1+.34,.72));
  const rings=["ai-ring-hollow","ai-ring-star2","ai-ring-bead","ai-pearlring"],tops=["ai-ears","ai-catears","ai-halo","ai-wreath"];
  Tn(e,rings[Math.floor(Math.random()*rings.length)]);
  Tn(e,tops[Math.floor(Math.random()*tops.length)]);
  const withText=Math.random()<.55;
  const lineSet=theme?theme.line:t==="cream"?["有事请烧纸，没事勿扰","本人已下班，别找","请投喂，谢谢","可爱到犯规","今天也要好好的","不回就是在吃鸡"]:["Y2K女孩上线","闪闪发光不解释","别问我，我也不知道","手机比我先睡","无语但很可爱","美颜开着，勿扰"];
  const line=lineSet[Math.floor(Math.random()*lineSet.length)];
  const fScale=.05+.02*Math.random();
  const textBox=withText?nvBox(.5,textY,Math.min(.46,line.length*fScale*.5+.05),fScale*.75,0):null;
  const placed=[];
  for(let i=0;i<e.items.length;i++){
    const it=e.items[i];
    if(it.kind!=="decal")continue;
    placed.push(nvBox(it.x,it.y,it.scale*.52,it.scale*.52,it.rotation))
  }
  e.backdrop=null;
  if(theme&&qe(theme.bg)){
    e.backdrop={type:"builtin",id:theme.bg}
  }else if(l&&Math.random()<.55){
    const envs=["ai-wp-ocean","ai-wp-night","ai-wp-sakura","ai-wp-garden","ai-wp-coquette","ai-wp-cafe","ai-wp-galaxy","ai-wp-winter","ai-wp-beach","ai-wp-autumn","ai-wp-milk","ai-wp-strawberry","ai-wp-cloudy","ai-wp-peach","ai-wp-matcha","ai-wp-lemon","ai-wp-lilac","ai-wp-butterheart","ai-wp-mint","ai-wp-caramel","ai-wp-aurora","ai-wp-daisy","ai-wp-cow","ai-wp-snow","ai-wp-starfield","ai-wp-rainbow","ai-wp-cherry"].filter(id=>qe(id));
    envs.length&&(e.backdrop={type:"builtin",id:envs[Math.floor(Math.random()*envs.length)]})
  }
  const basePool=t==="cream"?["ai-bunny","ai-cat","ai-bear","ai-sheep","ai-heart","ai-bow","ai-cherry","ai-peach","ai-berry","ai-daisy","ai-rose","ai-cloud","ai-moon","ai-donut","ai-boba","ai-icecream","ai-cupcake","ai-chick","ai-tulip","ai-macaron","ai-lollipop","ai-cookie","ai-latte","ai-envelope","ai-minibow","ai-ribbon2","ai-paw","ai-bouquet","ai-frog","ai-duck","ai-clover2","ai-washi","ai-washi2","ai-candy","ai-polaroid"]:["ai-star","ai-sparkle","ai-butterfly","ai-cd","ai-lipstick","ai-kiss","ai-rainbow","ai-gem","ai-badge","ai-crown","ai-gamepad","ai-sunglasses","ai-bolt","ai-planet","ai-crescent","ai-dice","ai-film","ai-cam2","ai-lock","ai-key","ai-notes","ai-glitters","ai-wing","ai-stamp","ai-ghost","ai-fish","ai-snow"];
  const pool=(theme?theme.pool:basePool).filter(id=>qe(id));
  const used={},count=theme?2+Math.floor(Math.random()*2):l?3+Math.floor(Math.random()*3):5;
  for(let i=0;i<count&&pool.length;i++){
    let id=pool[Math.floor(Math.random()*pool.length)],guard=0;
    while(used[id]&&guard++<14)id=pool[Math.floor(Math.random()*pool.length)];
    used[id]=1;
    let sc=.13+Math.random()*.15+(Math.random()<.18?0.1:0);
    const rot=(Math.random()-.5)*(l?26:12)*Math.PI/180;
    let spot=nvPickSpot(placed,z,sc,textBox,rot);
    for(let r=0;r<3&&!spot;r++){
      sc*=.82,spot=nvPickSpot(placed,z,sc,textBox,rot)
    }
    if(!spot)continue;
    Ge(e,id,spot.x,spot.y,sc,rot*180/Math.PI,!1),placed.push(spot.box)
  }
  if(withText){
    const col=theme?theme.fs:t==="cream"?"#E25B45":"#F2D48A";
    on(e,line,"hand","solid",col,fScale,.22,textY)
  }
}
function an(e){
  st(e,Math.random()<.5?"cream":"y2k",!0)
}function Wl(e,t){
  const l=qe(t);
  if(!l)return;
  if(l.anchor||l.group==="lens"){
    Tn(e,t);
    const n=e.items[e.items.length-1];
    n&&(e.selectedId=n.id);
    return
  }
  if(l.group==="bg"){
    e.backdrop=e.backdrop&&e.backdrop.type==="builtin"&&e.backdrop.id===t?null:{type:"builtin",id:t},e.selectedId=null;
    return
  }

  Ge(e,t,.5+(Math.random()-.5)*.12,.62+(Math.random()-.5)*.08,.28,(Math.random()-.5)*16,!1);
  const n=e.items[e.items.length-1];
  n&&(e.selectedId=n.id)
}function Nl(e,t){
  const it={
    id:Z(),kind:"decal",source:{
      type:"emoji",char:t
    },x:.5+(Math.random()-.5)*.2,y:.68+(Math.random()-.5)*.1,scale:.24,rotation:(Math.random()-.5)*.3,aboveCamera:!1,aspect:1
  };
  nvSyncCam(it,e.modelId),e.items.push(it),e.selectedId=it.id
}function Ol(e,t,l){
  const asp=l||1,box=nvImgSafeBox(e.modelId);
  const fitW=Math.min(box.w,box.h*asp);
  const it={
    id:Z(),kind:"decal",source:{
      type:"image",imageId:t
    },x:.5,y:(box.top+box.bot)/2,scale:Math.max(.16,fitW*.92),rotation:0,aboveCamera:!1,aspect:asp
  };
  nvFitImg(it,e.modelId),e.items.push(it),e.selectedId=it.id
}const Le=[{
  id:"bg",name:"背景"
},{
  id:"cute",name:"角色"
},{
  id:"deco",name:"装饰"
},{
  id:"y2k",name:"闪亮"
},{
  id:"lens",name:"镜头"
}],rn=[{
  text:"Designed by 我妈",font:"hand",effect:"solid",color:"#E25B45",curve:.15,rot:-6
},{
  text:"Pro Max Ultra 至尊版",font:"display",effect:"metal",color:"#E2A63B",curve:0,rot:0
},{
  text:"本机已开光",font:"smiley",effect:"neon",color:"#F0C14A",curve:0,rot:-4
},{
  text:"仅支持 5G 冲浪",font:"system",effect:"stroke",color:"#2F6FED",curve:0,rot:3
},{
  text:"这台有灵气",font:"hand",effect:"gradient",color:"#6FAE98",curve:.2,rot:-3
},{
  text:"福利机",font:"display",effect:"solid",color:"#E25B45",curve:0,rot:-8
},{
  text:"非官方联名",font:"smiley",effect:"stroke",color:"#2C241C",curve:0,rot:2
},{
  text:"请勿戴壳",font:"system",effect:"stroke",color:"#C44532",curve:0,rot:0
},{
  text:"我妈不让我换壳",font:"hand",effect:"solid",color:"#2C241C",curve:.1,rot:-2
},{
  text:"今天也要好好的",font:"hand",effect:"glitter",color:"#E25B45",curve:.25,rot:0
},{
  text:"拆完盒再贴",font:"smiley",effect:"gradient",color:"#C45B8A",curve:0,rot:4
}],zl=["#E25B45","#2C241C","#FFFFFF","#E2A63B","#6FAE98","#CDB6E8","#8EB7D6","#E23B8A","#F08A3E"],jl=["#2C241C","#E25B45","#FFFFFF","#E2A63B","#6FAE98","#CDB6E8","#8EB7D6","#E23B8A","#F08A3E","#111111"],dn=[{
  id:"system",name:"系统"
},{
  id:"smiley",name:"得意黑"
},{
  id:"display",name:"粗标题"
},{
  id:"hand",name:"手写"
}],sn=[{
  id:"solid",name:"实色"
},{
  id:"stroke",name:"描边"
},{
  id:"gradient",name:"渐变"
},{
  id:"neon",name:"霓虹"
},{
  id:"metal",name:"金属"
},{
  id:"glitter",name:"闪粉"
}],ke=[];
let Ye="cute",K=!1,fn=0,_e=!1,ue=!1,ve=le[0],Mt="NO. 001",Bn="",he="",ne=0;
function h(e){
  const t=document.getElementById(e);
  if(!t)throw new Error("missing "+e);
  return t
}function re(e){
  const t=h("toast");
  t.textContent=e,t.hidden=!1,window.clearTimeout(fn),fn=window.setTimeout(()=>{
    t.hidden=!0
  },2200)
}function Gl(e){
  let t=e*180/Math.PI;
  for(;
  t>180;
  )t-=360;
  for(;
  t<-180;
  )t+=360;
  return Math.round(t)
}function fe(){
  const e=Ee();
  return e&&e.kind==="text"?e:null
}function Dn(e,t){
  const l=qe(t);
  if(!l)return;
  const n=Math.min(2,window.devicePixelRatio||1),i=96;
  e.width=Math.round(i*n),e.height=Math.round(i*n);
  const o=e.getContext("2d");
  if(!o)return;
  o.clearRect(0,0,e.width,e.height);
  const sz=e.width*.72;
  o.save(),o.translate(e.width/2,e.height/2),o.shadowColor="rgba(90,40,70,.2)",o.shadowBlur=sz*.05,o.shadowOffsetY=sz*.02,l.draw(o,sz),o.restore()
}function Yl(){
  for(let e=0;
  e<ke.length;
  e++)Dn(ke[e].canvas,ke[e].id)
}function Et(){
  if(!h("result").hidden)return;
  const t=h("stage"),l=h("cv"),n=h("tilt");
  const cw=t.clientWidth||0,ch=t.clientHeight||0;
  if(cw<20||ch<20)return;
  const o=Math.min(2,window.devicePixelRatio||1),a=Math.max(2,Math.round(cw*o)),r=Math.max(2,Math.round(ch*o));
  (l.width!==a||l.height!==r)&&(l.width=a,l.height=r);
  const d=l.getContext("2d");
  d&&(Pl(d,{
    rx:S.rx,ry:S.ry
  }),n.style.transform="rotateX("+(-S.rx).toFixed(2)+"deg) rotateY("+S.ry.toFixed(2)+"deg)")
}function Oe(){
  const e=window.visualViewport,t=e?e.height:window.innerHeight;
  document.documentElement.style.height=t+"px",document.body.style.height=t+"px",Et()
}function Re(e,t,l){
  const n=e.querySelectorAll("button");
  for(let i=0;
  i<n.length;
  i++){
    const o=n[i];
    o.classList.toggle("on",o.getAttribute(t)===l)
  }
}function O(){
  K=!0;
  const e=h("undo"),t=h("redo");
  e.disabled=!Vn(),t.disabled=!Un(),(()=>{const _m=Se.find(x=>x.id===s.modelId);const _b=h("modelBtn");_b&&(_b.textContent=(_m?_m.name:"机型")+" ▾");const _menu=h("modelMenu");if(_menu){const _items=_menu.querySelectorAll(".mpick-item");for(let _i=0;_i<_items.length;_i++)_items[_i].classList.toggle("on",_items[_i].dataset.id===s.modelId)}})();
  Ln();
  const i=Ee(),o=h("selbar");
  o.hidden=!i;
  if(i&&i.kind!=="stroke"){
    const sh=h("sheet");
    sh.classList.contains("is-open")||sh.classList.contains("is-closing")||Ws(!0)
  }
  const a=h("scaleWrap"),r=h("rotWrap"),d=h("selScale"),f=h("selRot");
  i&&i.kind!=="stroke"?(a.hidden=!1,r.hidden=!1,document.activeElement!==d&&(i.kind==="text"?(d.min="0.04",d.max="0.2",d.step="0.002",d.value=String(i.fontScale),h("scaleLabel").textContent="字号"):(d.min="0.08",d.max="0.85",d.step="0.01",d.value=String(i.scale),h("scaleLabel").textContent="大小")),document.activeElement!==f&&(f.value=String(Gl(i.rotation)))):(a.hidden=!0,r.hidden=!0);
  const p=h("penPill");
  p.hidden=S.tab!=="draw",p.textContent=S.pen?"画笔开着 · 点此挪贴纸":"画笔关着 · 点此继续画",h("tileControls").hidden=!s.tile,h("tileHint").hidden=!(S.tileMode&&!s.tile);
  const c=h("tileDensity"),b=h("tileSize");
  s.tile&&document.activeElement!==c&&(c.value=String(s.tile.density)),s.tile&&document.activeElement!==b&&(b.value=String(s.tile.size)),h("modeSingle").classList.toggle("on",!S.tileMode),h("modeTile").classList.toggle("on",S.tileMode);
  const u=fe(),w=h("textInput");
  u&&document.activeElement!==w&&(w.value=u.text),h("textBind").hidden=!u;
  const P=u?u.font:S.textDraft.font,C=u?u.effect:S.textDraft.effect,k=u?u.color:S.textDraft.color;
  Re(h("fonts"),"data-font",P),Re(h("effects"),"data-effect",C);
  const E=h("textColors").querySelectorAll("button");
  for(let y=0;
  y<E.length;
  y++)E[y].classList.toggle("on",E[y].getAttribute("data-color")===k);
  const L=h("textSize"),Q=h("textCurve");
  document.activeElement!==L&&(L.value=String(u?u.fontScale:S.textDraft.fontScale)),document.activeElement!==Q&&(Q.value=String(u?u.curve:S.textDraft.curve)),Re(h("glitterModes"),"data-g",s.glitter);
  const x=h("glitterAmt");
  document.activeElement!==x&&(x.value=String(s.glitterAmount));
  Re(h("borderModes"),"data-b",s.borderStyle||(s.glitterBorder?"sparkle":"off"));
  const g=h("penColors").querySelectorAll("button");
  for(let y=0;
  y<g.length;
  y++)g[y].classList.toggle("on",g[y].getAttribute("data-color")===S.penColor);
  K=!1
}function Ln(){
  const e=h("colorBtn"),t=h("colorMenu"),l=h("colorSwatch"),n=h("colorName"),i=Ie(s.modelId),o=Xe(s);
  t.innerHTML="";
  for(let a=0;a<i.length;a++){
    const r=i[a],d=document.createElement("button");
    d.type="button",d.className="cpick-item"+(r.id===s.colorId?" on":""),d.setAttribute("role","option");
    const f=document.createElement("span");
    f.className="cpick-dot",f.style.background=_l(r),d.appendChild(f);
    const p=document.createElement("span");
    p.textContent=r.name,d.appendChild(p),d.addEventListener("click",c=>{
      c.stopPropagation(),M(()=>{s.colorId=r.id}),t.hidden=!0,e.setAttribute("aria-expanded","false")
    }),t.appendChild(d)
  }
  l.style.background=_l(o),n.textContent=o.name,e.setAttribute("aria-expanded","false"),e.onclick=a=>{
    a.stopPropagation();
    const r=t.hidden;t.hidden=!r,e.setAttribute("aria-expanded",r?"true":"false");
    const d=h("modelMenu");d&&!d.hidden&&(d.hidden=!0)
  }
}function _l(e){
  return e.kind==="glass"?"linear-gradient(135deg, #ffffff, #c5dcea 42%, #ffffff 58%, #d5e4ee)":e.base
}function Hl(){
  const e=h("modelBtn"),t=h("modelMenu");
  t.innerHTML="";
  for(let l=0;l<Se.length;l++){
    const n=Se[l],i=document.createElement("button");
    i.type="button",i.className="mpick-item"+(n.id===s.modelId?" on":""),i.setAttribute("role","option"),i.textContent=n.name,i.dataset.id=n.id,i.addEventListener("click",a=>{
      a.stopPropagation(),M(()=>{
        s.modelId=n.id;
        const r=Ie(n.id);
        let d=!1;
        for(let c=0;c<r.length;c++)r[c].id===s.colorId&&(d=!0);
        d||(s.colorId=r[0].id),s.selectedId=null;
        for(let c=0;c<s.items.length;c++)nvSyncCam(s.items[c],s.modelId)
      }),t.hidden=!0,e.setAttribute("aria-expanded","false")
    }),t.appendChild(i)
  }
  const o=Se.find(l=>l.id===s.modelId);
  e.textContent=(o?o.name:"机型")+" ▾",e.setAttribute("aria-expanded","false"),e.onclick=l=>{
    l.stopPropagation();
    const n=t.hidden;
    t.hidden=!n,e.setAttribute("aria-expanded",n?"true":"false");
    const cm=h("colorMenu"),cb=h("colorBtn");
    cm&&!cm.hidden&&(cm.hidden=!0,cb.setAttribute("aria-expanded","false"))
  }
}function hn(){
  const e=h("grid");
  e.innerHTML="",ke.length=0;
  const t=document.createElement("button");
  if(t.type="button",t.className="cell upload",t.innerHTML='<span class="box"><span class="upload-label">上传<br>图片</span></span>',t.addEventListener("click",()=>h("file").click()),e.appendChild(t),Ye==="emoji"){
    for(let n=0;
    n<It.length;
    n++){
      const i=It[n],o=document.createElement("button");
      o.type="button",o.className="cell",o.setAttribute("aria-label",i);
      const a=document.createElement("span");
      a.className="box";
      const r=document.createElement("span");
      r.className="emoji",r.textContent=i,a.appendChild(r),o.appendChild(a),o.addEventListener("click",()=>Jl(i)),e.appendChild(o)
    }return
  }const l=On(Ye);
  for(let n=0;
  n<l.length;
  n++){
    const i=l[n],o=document.createElement("button");
    o.type="button",o.className="cell",o.setAttribute("aria-label",i.name);
    const a=document.createElement("span");
    a.className="box";
    const r=document.createElement("canvas");
    a.appendChild(r),o.appendChild(a),Dn(r,i.id),ke.push({
      canvas:r,id:i.id
    }),o.addEventListener("click",()=>ql(i.id)),e.appendChild(o)
  }
}function ql(e){
  if(S.tileMode){
    M(()=>{
      s.tile={
        source:{
          type:"builtin",id:e
        },density:s.tile?s.tile.density:.62,size:s.tile?s.tile.size:.5
      },s.selectedId=null
    });
    return
  }M(()=>Wl(s,e))
}function Jl(e){
  if(S.tileMode){
    M(()=>{
      s.tile={
        source:{
          type:"emoji",char:e
        },density:s.tile?s.tile.density:.62,size:s.tile?s.tile.size:.5
      },s.selectedId=null
    });
    return
  }M(()=>Nl(s,e))
}function Xl(e){
  S.tab=e,S.pen=e==="draw";
  const t=h("tabs").querySelectorAll("button");
  for(let n=0;n<t.length;n++){
    const i=t[n];
    i.classList.toggle("on",i.getAttribute("data-tab")===e)
  }
  const l=["sticker","text","draw","fx"];
  for(let n=0;n<l.length;n++)h("pane-"+l[n]).hidden=l[n]!==e;
  const o=h("dock").querySelectorAll("[data-tab]");
  for(let n=0;n<o.length;n++)o[n].classList.toggle("on",o[n].getAttribute("data-tab")===e);
  Ws(!0),O()
}
function Ws(e){
  const t=h("sheet"),p=h("panel"),ed=h("editor");
  if(e){
    t.classList.remove("is-closing"),t.classList.add("is-open"),ed.classList.add("is-sheet-open"),ed.classList.remove("is-sheet-closing")
  }else{
    if(!t.classList.contains("is-open")&&!t.classList.contains("is-closing"))return;
    t.classList.remove("is-open"),t.classList.add("is-closing"),ed.classList.remove("is-sheet-open"),ed.classList.add("is-sheet-closing");
    const done=()=>{t.classList.remove("is-closing"),ed.classList.remove("is-sheet-closing")};
    const onEnd=n=>{n.propertyName==="transform"&&(p.removeEventListener("transitionend",onEnd),done())};
    p.addEventListener("transitionend",onEnd),setTimeout(done,420)
  }
  const n=()=>Et();
  requestAnimationFrame(()=>{n(),requestAnimationFrame(n)}),setTimeout(n,50),setTimeout(n,140),setTimeout(n,240),setTimeout(n,360)
}function Rn(){
  const e=1+Math.floor(Math.random()*999);
  return"NO. "+(e<10?"00"+e:e<100?"0"+e:String(e))
}function Kl(e){
  const t=String(e.getMonth()+1),l=String(e.getDate()),n=t.length<2?"0"+t:t,i=l.length<2?"0"+l:l;
  return e.getFullYear()+"."+n+"."+i
}function V(){
  he=Il(s,{
    night:ue,caption:ve,serial:Mt,date:Bn
  });
  const e=h("cardImg");
  e.src=he,h("bgCream").classList.toggle("on",!ue),h("bgNight").classList.toggle("on",ue)
}function tt(){
  const e=!_e;
  _e=!0,h("editor").hidden=!0,h("result").hidden=!1,e&&(Mt=Rn(),ne=Math.floor(Math.random()*le.length),ve=le[ne],Bn=Kl(new Date),ue=!1),V()
}function nt(){
  _e=!1,h("result").hidden=!0,h("editor").hidden=!1,Oe()
}function Vl(e){
  const l=Math.min(1,800/Math.max(e.width,e.height)),n=Math.max(1,Math.round(e.width*l)),i=Math.max(1,Math.round(e.height*l)),o=document.createElement("canvas");
  o.width=n,o.height=i;
  const a=o.getContext("2d");
  return a?(a.drawImage(e,0,0,n,i),{
    canvas:o,aspect:n/i
  }):{
    canvas:o,aspect:n/i
  }
}function Ul(){
  _e?V():Et(),O()
}function Zl(e,t){
  e.innerHTML=['<div class="font-preload" aria-hidden="true">','<span style="font-family: Smiley Sans, sans-serif">开盒铺 Aa</span>','<span style="font-family: &quot;Lilita One&quot;, sans-serif">Aa</span>','<span style="font-family: Pangolin, sans-serif">Aa</span>',"</div>",'<div class="app" id="editor">','<header class="top"><div class="toolbar"><div class="mpick"><button type="button" class="mpick-btn" id="modelBtn" aria-haspopup="listbox" aria-expanded="false">机型</button><div class="mpick-menu" id="modelMenu" hidden role="listbox"></div></div><div class="cpick"><button type="button" class="cpick-btn" id="colorBtn" aria-haspopup="listbox" aria-expanded="false"><span class="cpick-swatch" id="colorSwatch"></span><span id="colorName">颜色</span><span class="cpick-caret">▾</span></button><div class="cpick-menu" id="colorMenu" hidden role="listbox"></div></div><button type="button" class="mini ghost" id="random">随机</button></div><div class="top-actions"><button type="button" id="undo">撤销</button><button type="button" id="redo">重做</button><button type="button" id="clear">清空</button></div></header>','<div class="stage" id="stage"><div class="tilt" id="tilt"><canvas id="cv"></canvas></div><button type="button" class="pen-pill" id="penPill" hidden>画笔开着 · 点此挪贴纸</button></div>','<div class="sheet" id="sheet"><button type="button" class="sheet-scrim" id="sheetScrim" aria-label="收起" tabindex="-1"></button><section class="panel" id="panel"><div class="sheet-head"><div class="sheet-handle" id="sheetHandle" aria-hidden="true"></div><button type="button" class="sheet-close" id="sheetClose" aria-label="关闭">✕</button></div><div class="tabs" id="tabs"><button type="button" data-tab="sticker" class="on">贴纸</button><button type="button" data-tab="text">文字</button><button type="button" data-tab="draw">手绘</button><button type="button" data-tab="fx">特效</button></div><div class="selbar" id="selbar" hidden><button type="button" class="danger" id="del">删除</button><label class="slider" id="scaleWrap"><span id="scaleLabel">大小</span><input id="selScale" type="range" min="0.08" max="0.98" step="0.01" /></label><label class="slider" id="rotWrap"><span>角度</span><input id="selRot" type="range" min="-180" max="180" step="1" /></label></div><div class="panel-body">','<div class="pane" id="pane-sticker"><div class="pane-head pane-head-row"><div class="hscroll" id="groups"></div><div class="mode"><button type="button" id="modeSingle" class="on">单贴</button><button type="button" id="modeTile">平铺</button></div></div>','<div id="tileControls" hidden><label class="block">密度<input id="tileDensity" type="range" min="0" max="1" step="0.01" value="0.62" /></label><label class="block">大小<input id="tileSize" type="range" min="0" max="1" step="0.01" value="0.5" /></label><button type="button" class="btn ghost full" id="tileClear">清除平铺</button></div>','<p class="hint" id="tileHint" hidden>点一张贴纸，按这个密度铺满背面。</p><div class="grid" id="grid"></div><p class="hint">上传的图不会抠图。透明 PNG 贴上去更好看。</p><input id="file" type="file" accept="image/*" hidden /></div>','<div class="pane" id="pane-text" hidden><div class="field"><input id="textInput" maxlength="32" placeholder="写一句想贴的话" /><button type="button" id="addText">贴上</button></div><p class="hint" id="textBind" hidden>正在改选中的这句</p><div class="hscroll" id="memes"></div><p class="hint">字体</p><div class="hscroll" id="fonts"></div><p class="hint">效果</p><div class="hscroll" id="effects"></div><p class="hint">颜色</p><div class="swatches" id="textColors"></div><label class="block">字号<input id="textSize" type="range" min="0.045" max="0.2" step="0.002" value="0.078" /></label><label class="block">弧度<input id="textCurve" type="range" min="-1" max="1" step="0.02" value="0" /></label></div>','<div class="pane" id="pane-draw" hidden><p class="hint">笔色</p><div class="swatches" id="penColors"></div><label class="block">粗细<input id="penWidth" type="range" min="0.004" max="0.04" step="0.001" value="0.012" /></label><p class="hint">直接在背面画。画错了点撤销。</p></div>','<div class="pane" id="pane-fx" hidden><div class="fx-sec"><div class="fx-title">闪粉材质</div><div class="fx-grid" id="glitterModes"><button type="button" data-g="off" class="fx-chip on"><i></i><span>无闪</span></button><button type="button" data-g="silver" class="fx-chip"><i class="fx-silver"></i><span>银闪</span></button><button type="button" data-g="gold" class="fx-chip"><i class="fx-gold"></i><span>金粉</span></button><button type="button" data-g="rose" class="fx-chip"><i class="fx-rose"></i><span>玫瑰金</span></button><button type="button" data-g="holo" class="fx-chip"><i class="fx-holo"></i><span>镭射</span></button><button type="button" data-g="candy" class="fx-chip"><i class="fx-candy"></i><span>糖果彩</span></button><button type="button" data-g="star" class="fx-chip"><i class="fx-star"></i><span>星空</span></button><button type="button" data-g="heart" class="fx-chip"><i class="fx-heart"></i><span>爱心雨</span></button><button type="button" data-g="frost" class="fx-chip"><i class="fx-frost"></i><span>霜感</span></button></div><label class="block">浓度<input id="glitterAmt" type="range" min="0.1" max="1" step="0.01" value="0.4" /></label></div><div class="fx-sec"><div class="fx-title">边框图案</div><div class="fx-grid" id="borderModes"><button type="button" data-b="off" class="fx-chip on"><span>无</span></button><button type="button" data-b="sparkle" class="fx-chip"><span>细闪</span></button><button type="button" data-b="pearl" class="fx-chip"><span>珍珠</span></button><button type="button" data-b="hearts" class="fx-chip"><span>爱心</span></button><button type="button" data-b="stars" class="fx-chip"><span>小星</span></button><button type="button" data-b="flower" class="fx-chip"><span>小花</span></button><button type="button" data-b="dash" class="fx-chip"><span>虚线</span></button><button type="button" data-b="stroke" class="fx-chip"><span>描边</span></button><button type="button" data-b="ribbon" class="fx-chip"><span>丝带</span></button></div></div><div class="fx-sec"><div class="fx-title">一键风格</div><div class="theme-row"><button type="button" class="btn ghost" id="themeCream">一键甜美风</button><button type="button" class="btn ghost" id="themeY2k">一键潮酷风</button></div><p class="hint">甜美风偏奶油金粉；潮酷风偏镭射闪片。按住空白处可倾斜，点两下回正。</p></div></div>','</div></section></div>','<nav class="dock" id="dock"><button type="button" class="dock-tab on" data-tab="sticker"><span class="dock-ico" aria-hidden="true">◇</span><span>贴纸</span></button><button type="button" class="dock-tab" data-tab="text"><span class="dock-ico" aria-hidden="true">Aa</span><span>文字</span></button><button type="button" class="dock-tab" data-tab="draw"><span class="dock-ico" aria-hidden="true">✎</span><span>手绘</span></button><button type="button" class="dock-tab" data-tab="fx"><span class="dock-ico" aria-hidden="true">✦</span><span>特效</span></button><button type="button" class="dock-done" id="done">完成</button></nav>',"</div>",'<div class="result" id="result" hidden><header class="top"><button type="button" class="textbtn" id="resultBack">返回</button><div class="title">新机拆盒卡</div><span></span></header>','<div class="preview"><img id="cardImg" alt="新机拆盒卡" /></div>','<div class="result-actions"><div class="seg"><button type="button" id="bgCream" class="on">奶油桌面</button><button type="button" id="bgNight">夜间桌面</button></div>','<button type="button" class="btn ghost full" id="cycleLine">换一句文案</button>','<button type="button" class="btn primary full" id="saveBtn">保存图片</button>','<button type="button" class="btn primary full" id="postBtn" hidden>发布笔记</button>','<div class="row2"><button type="button" class="btn ghost" id="backEdit">再改一版</button><button type="button" class="btn ghost" id="reroll">换一个随机</button></div>','<p class="hint center">长按图片可以保存到相册</p></div></div>','<div class="toast" id="toast" hidden></div>'].join(""),Hl(),Ln();
  const l=h("groups");
  for(let g=0;
  g<Le.length;
  g++){
    const y=document.createElement("button");
    y.type="button",y.className="chip"+(Le[g].id===Ye?" on":""),y.textContent=Le[g].name;
    const v=Le[g].id;
    y.addEventListener("click",()=>{
      Ye=v;
      const R=l.querySelectorAll("button");
      for(let ee=0;
      ee<R.length;
      ee++)R[ee].classList.toggle("on",R[ee].textContent===y.textContent);
      hn()
    }),l.appendChild(y)
  }hn();
  const n=h("memes");
  for(let g=0;
  g<rn.length;
  g++){
    const y=rn[g],v=document.createElement("button");
    v.type="button",v.className="chip",v.textContent=y.text,v.addEventListener("click",()=>{
      M(()=>{
        s.items.push({
          id:Z(),kind:"text",text:y.text,font:y.font,effect:y.effect,color:y.color,color2:"#ffffff",fontScale:.07,curve:y.curve,x:.5,y:.68,rotation:y.rot*Math.PI/180
        }),s.selectedId=s.items[s.items.length-1].id,S.textDraft.font=y.font,S.textDraft.effect=y.effect,S.textDraft.color=y.color,S.textDraft.curve=y.curve
      }),h("textInput").value=y.text
    }),n.appendChild(v)
  }const i=h("fonts");
  for(let g=0;
  g<dn.length;
  g++){
    const y=dn[g],v=document.createElement("button");
    v.type="button",v.className="chip",v.setAttribute("data-font",y.id),v.textContent=y.name,v.addEventListener("click",()=>{
      const R=fe();
      R?M(()=>{
        R.font=y.id
      }):(S.textDraft.font=y.id,O())
    }),i.appendChild(v)
  }const o=h("effects");
  for(let g=0;
  g<sn.length;
  g++){
    const y=sn[g],v=document.createElement("button");
    v.type="button",v.className="chip",v.setAttribute("data-effect",y.id),v.textContent=y.name,v.addEventListener("click",()=>{
      const R=fe();
      R?M(()=>{
        R.effect=y.id
      }):(S.textDraft.effect=y.id,O())
    }),o.appendChild(v)
  }un(h("textColors"),zl,g=>{
    const y=fe();
    y?M(()=>{
      y.color=g
    }):(S.textDraft.color=g,O())
  }),un(h("penColors"),jl,g=>{
    S.penColor=g,O()
  }),h("undo").addEventListener("click",()=>jt()),h("redo").addEventListener("click",()=>Gt()),h("clear").addEventListener("click",()=>{
    M(()=>{
      s.items=[],s.tile=null,s.backdrop=null,s.selectedId=null
    })
  }),h("random").addEventListener("click",()=>M(()=>an(s))),h("done").addEventListener("click",()=>{
    N(),location.hash!=="#card"?location.hash="card":tt()
  }),h("del").addEventListener("click",()=>M(()=>Yt())),h("penPill").addEventListener("click",()=>{
    S.pen=!S.pen,O()
  });
  const a=[...h("tabs").querySelectorAll("button"),...h("dock").querySelectorAll("[data-tab]")];
  for(let g=0;g<a.length;g++)a[g].addEventListener("click",()=>{
    const y=a[g].getAttribute("data-tab");
    (y==="sticker"||y==="text"||y==="draw"||y==="fx")&&Xl(y)
  });
  h("sheetScrim").addEventListener("click",()=>Ws(!1));
  h("sheetHandle").addEventListener("click",()=>Ws(!1));
  h("sheetClose").addEventListener("click",()=>Ws(!1));
  document.addEventListener("click",()=>{
    const m=h("modelMenu"),b=h("modelBtn");
    m.hidden||(m.hidden=!0,b.setAttribute("aria-expanded","false"));
    const cm=h("colorMenu"),cb=h("colorBtn");
    cm&&!cm.hidden&&(cm.hidden=!0,cb.setAttribute("aria-expanded","false"))
  });
  h("modeSingle").addEventListener("click",()=>{
    S.tileMode=!1,O()
  }),h("modeTile").addEventListener("click",()=>{
    S.tileMode=!0,O()
  });
  const r=h("tileDensity"),d=h("tileSize"),f=()=>{
    K||!s.tile||(U(),s.tile.density=Number(r.value),s.tile.size=Number(d.value),I())
  };
  r.addEventListener("input",f),d.addEventListener("input",f),r.addEventListener("change",()=>N()),d.addEventListener("change",()=>N()),h("tileClear").addEventListener("click",()=>M(()=>{
    s.tile=null
  }));
  const p=h("selScale"),c=h("selRot"),b=()=>{
    if(K)return;
    const g=Ee();
    if(!g||g.kind==="stroke")return;
    U(),g.kind==="text"?g.fontScale=Number(p.value):g.scale=Number(p.value),
    g.rotation=Number(c.value)*Math.PI/180,nvSyncCam(g,s.modelId),I()
  };
  p.addEventListener("input",b),c.addEventListener("input",b),p.addEventListener("change",()=>N()),c.addEventListener("change",()=>N());
  const u=h("textInput");
  u.addEventListener("input",()=>{
    if(K)return;
    const g=fe();
    g&&(U(),g.text=u.value.slice(0,32),I())
  }),u.addEventListener("blur",()=>N()),h("addText").addEventListener("click",()=>{
    const g=u.value.trim();
    if(!g){
      re("先写一句");
      return
    }M(()=>{
      const _t={
        id:Z(),kind:"text",text:g,font:S.textDraft.font,effect:S.textDraft.effect,color:S.textDraft.color,color2:"#ffffff",fontScale:S.textDraft.fontScale,curve:S.textDraft.curve,x:.5,y:.66,rotation:-.05,aboveCamera:!1
      };
      nvSyncCam(_t,s.modelId),s.items.push(_t),s.selectedId=_t.id
    })
  });
  const w=h("textSize"),P=h("textCurve"),C=()=>{
    if(K)return;
    const g=fe();
    U(),g?(g.fontScale=Number(w.value),g.curve=Number(P.value)):(S.textDraft.fontScale=Number(w.value),S.textDraft.curve=Number(P.value)),g&&I()
  };
  w.addEventListener("input",C),P.addEventListener("input",C),w.addEventListener("change",()=>N()),P.addEventListener("change",()=>N());
  const k=h("penWidth");
  k.addEventListener("input",()=>{
    S.penWidth=Number(k.value)
  });
  const E=h("glitterModes").querySelectorAll("button");
  for(let g=0;
  g<E.length;
  g++)E[g].addEventListener("click",()=>{
    const y=E[g].getAttribute("data-g");
    (y==="off"||y==="silver"||y==="gold"||y==="rose"||y==="holo"||y==="candy"||y==="star"||y==="heart"||y==="frost")&&M(()=>{
      s.glitter=y
    })
  });
  const L=h("glitterAmt");
  L.addEventListener("input",()=>{
    K||(U(),s.glitterAmount=Number(L.value),I())
  }),L.addEventListener("change",()=>N());
  const Q=h("borderModes").querySelectorAll("button");
  for(let g=0;g<Q.length;g++)Q[g].addEventListener("click",()=>{
    const y=Q[g].getAttribute("data-b");
    (y==="off"||y==="sparkle"||y==="pearl"||y==="hearts"||y==="stars"||y==="flower"||y==="dash"||y==="stroke"||y==="ribbon")&&M(()=>{
      s.borderStyle=y,s.glitterBorder=y==="sparkle"||y==="pearl"||y==="hearts"||y==="stars"||y==="flower"
    })
  });
  h("themeCream").addEventListener("click",()=>M(()=>st(s,"cream",!1))),h("themeY2k").addEventListener("click",()=>M(()=>st(s,"y2k",!1)));
  const x=h("file");
  x.addEventListener("change",()=>{
    const g=x.files&&x.files[0];
    if(x.value="",!g)return;
    if(g.size>8*1024*1024){
      re("图片太大了，换一张 8MB 以内的");
      return
    }const y=new FileReader;
    y.onload=()=>{
      const v=String(y.result||""),R=new Image;
      R.onload=()=>{
        const ee=Vl(R),Ue=Z();
        ce[Ue]=ee.canvas,S.tileMode?M(()=>{
          s.tile={
            source:{
              type:"image",imageId:Ue
            },density:s.tile?s.tile.density:.62,size:s.tile?s.tile.size:.5
          }
        }):M(()=>Ol(s,Ue,ee.aspect))
      },R.onerror=()=>re("这张图打不开"),R.src=v
    },y.readAsDataURL(g)
  }),h("resultBack").addEventListener("click",()=>{
    location.hash==="#card"?history.back():nt()
  }),h("backEdit").addEventListener("click",()=>{
    location.hash==="#card"?history.back():nt()
  }),h("bgCream").addEventListener("click",()=>{
    ue=!1,V()
  }),h("bgNight").addEventListener("click",()=>{
    ue=!0,V()
  }),h("cycleLine").addEventListener("click",()=>{
    ne=(ne+1)%le.length,ve=le[ne],V()
  }),h("reroll").addEventListener("click",()=>{
    M(()=>an(s)),Mt=Rn(),ne=Math.floor(Math.random()*le.length),ve=le[ne],V()
  }),h("saveBtn").addEventListener("click",()=>{
    he||V(),Yn(he,re)
  }),h("postBtn").addEventListener("click",()=>{
    he||V(),_n(he,ve,re)
  }),me()&&(h("postBtn").hidden=!1),window.addEventListener("hashchange",()=>{
    location.hash==="#card"?tt():nt()
  }),window.addEventListener("keydown",g=>{
    const y=g.target;
    y&&(y.tagName==="INPUT"||y.tagName==="TEXTAREA")||((g.key==="Delete"||g.key==="Backspace")&&s.selectedId&&(g.preventDefault(),M(()=>Yt())),(g.metaKey||g.ctrlKey)&&(g.key==="z"||g.key==="Z")&&(g.preventDefault(),g.shiftKey?Gt():jt()))
  }),window.addEventListener("resize",Oe),window.visualViewport&&window.visualViewport.addEventListener("resize",Oe),
  typeof ResizeObserver=="function"&&new ResizeObserver(()=>Et()).observe(h("stage")),
  h("editor").addEventListener("transitionend",e=>{e.propertyName==="padding-bottom"&&Et()}),Hn(()=>{
    O(),Et()
  }),Bl(h("cv")),h("cv").getContext("2d")||(h("stage").textContent="这个浏览器不支持画布，换一个打开试试。"),Oe(),O(),Zn(g=>{
    Xe(s),I(),g&&re("已恢复上次的背面"),location.hash==="#card"&&tt(),t(g)
  })
}function un(e,t,l){
  for(let n=0;
  n<t.length;
  n++){
    const i=document.createElement("button");
    i.type="button",i.className="swatch",i.style.background=t[n],i.setAttribute("data-color",t[n]),i.setAttribute("aria-label",t[n]),i.addEventListener("click",()=>l(t[n])),e.appendChild(i)
  }
}function cn(){
  const e=document.fonts;
  return!e||!e.load?Promise.resolve():e.load('64px "Smiley Sans"').then(()=>e.load('64px "Lilita One"')).then(()=>e.load("64px Pangolin")).then(()=>{
    
  }).catch(()=>{
    
  })
}function $l(){
  const e=Wn(),t=6,l=150,n=Math.ceil(e.length/t),i=document.createElement("canvas");
  i.width=t*l,i.height=n*l+48,document.documentElement.style.height="auto",document.body.style.height="auto",document.body.style.overflow="auto";
  const o=document.getElementById("app");
  o&&(o.style.height="auto",o.appendChild(i));
  const a=i.getContext("2d");
  if(a){
    a.fillStyle="#F3E6D4",a.fillRect(0,0,i.width,i.height),a.fillStyle="#2C241C",a.font="16px sans-serif",a.fillText("stickers "+e.length,12,24);
    for(let r=0;
    r<e.length;
    r++){
      const d=r%t*l,f=36+Math.floor(r/t)*l;
      a.save(),a.translate(d+l/2,f+l/2-10),e[r].draw(a,l*.72),a.restore(),a.fillStyle="#2C241C",a.font="11px sans-serif",a.textAlign="center",a.fillText(e[r].id,d+l/2,f+l-12),a.textAlign="left"
    }
  }
}if(location.search.indexOf("sheet=1")>=0)Promise.all([cn(),loadAiStickers()]).then(()=>{
  installAiStickers(),$l();
  const e=window;
  e.__ready=!0
});
else{
  const e=document.getElementById("app");
  if(e){
    let t=!1,l=!1;
    const n=()=>{
      if(!t||!l)return;
      kn(),Yl(),Ul();
      const i=window;
      i.__ready=!0,location.search.indexOf("debug")>=0&&(i.__dbg={
        state:s,view:S,stickerCount:Nn,emoji:It.length
      })
    };
    Zl(e,()=>{
      t=!0,n()
    }),Promise.all([cn(),loadAiStickers()]).then(()=>{
      installAiStickers(),hn(),l=!0,n()
    })
  }
}
