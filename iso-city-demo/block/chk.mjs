const noop=()=>{};const gradient={addColorStop:noop}
const ctx2d=new Proxy({measureText:t=>({width:String(t).length*20}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:noop},{get:(t,k)=>(k in t?t[k]:noop),set:()=>true})
const canvas={width:0,height:0,style:{},getContext:()=>ctx2d,addEventListener:noop,removeEventListener:noop,requestPointerLock:noop}
const el=()=>({classList:{toggle:noop,add:noop,remove:noop},textContent:'',addEventListener:noop,style:{}})
globalThis.document={createElement:()=>canvas,querySelector:()=>el(),getElementById:()=>el(),addEventListener:noop,exitPointerLock:noop,pointerLockElement:null,body:el()}
globalThis.window={devicePixelRatio:2,innerWidth:1280,innerHeight:720,addEventListener:noop}
globalThis.performance={now:()=>0};globalThis.requestAnimationFrame=noop;globalThis.innerWidth=1280;globalThis.innerHeight=720;globalThis.addEventListener=noop
const THREE=await import('three')
const K=await import('./kit.js')
const {buildSite,flushPools}=await import('./site.js')
const {buildBuildings}=await import('./buildings.js')
const {createPlayer}=await import('./player.js')
const {tickKonbini}=await import('./store.js')
const scene=new THREE.Scene();buildSite(scene);buildBuildings(scene);K.harmonizePalette(scene);flushPools(scene);K.clipDecals(scene)
const n=K.fixZfight(scene)
const camera=new THREE.PerspectiveCamera(48,1.7,0.15,900)
const player=createPlayer(scene,camera,canvas)
for(let i=0;i<60;i++){player.update(0.016);K.applyNight(i/30);tickKonbini(0.016)}
K.applyNight(1)
let meshes=0,insts=0
scene.traverse(o=>{if(o.isMesh)meshes++;if(o.isInstancedMesh)insts+=o.count})
console.log('fixed',n,'meshes',meshes,'inst',insts)
// 新楼亮窗埋没检查
const boxes=[]
scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)boxes.push(new THREE.Box3().setFromObject(o))})
for(const s of K.solids){
  if(s.x>-55&&s.x<-30&&s.z<-35&&s.z>-60) console.log('courtyard solid',s.x,s.z,s.w,s.d,s.y.toFixed(0))
}
let buried=0,total=0
scene.traverse(o=>{
  if(!o.isInstancedMesh||o.material!==K.WIN.warm) return
  const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3()
  for(let i=0;i<o.count;i++){
    o.getMatrixAt(i,m);m.decompose(p,q,sc)
    const wp=p.clone().applyMatrix4(o.matrixWorld)
    if(wp.x<-70||wp.x>40) continue
    total++
    for(const b of boxes){ if(b.containsPoint(wp)){buried++; if(buried<8) console.log('buried at',wp.x.toFixed(1),wp.y.toFixed(1),wp.z.toFixed(1)); break} }
  }
})
console.log('lit windows',total,'buried',buried)
