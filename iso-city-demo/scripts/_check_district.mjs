import * as THREE from 'three'
import { makeDistrict } from '../googie/district.js'

const names = ['glBlue','glIce','glNavy','glGreen','glMint','glAmber','glBronze','glRose','glSmoke','glSilver','glWhite','glBlack','glFrit','glTeal','glViolet','glOlive','glDeepBlue','glChampagne','glBlueGreen','gold','copper','copperAged','titan','darkTi','brightSilver','irid','rust','brushed','beige','limestone','brick','brickDark','concrete','concreteDark','aluPanel','aluWarm','aluDark','enamelRed','enamelYellow','enamelBlue','terra','terraPale','whiteStone','blackStone','perf','screen','wood','woodDark','green','greenSoft','glaze','glazeWhite','glazeRed','breeze','slate','marble','anod','mesh','charcoal','bronze','glDark','wine','ochre','sandstone','plaster','plasterWarm','plasterGrey','earth','tuff','mosaic','azulejo','tileRed','thatch','glassBlock','charred','siding','corr','corrRust','corrRed','corrBlue','corrGreen','paintRed','paintGreen','paintBlue','paintYell','teak','darkTile','sheet','membrane','band','bandLight','mullion','darkFrame','paving','pad','curb','leaf','bark','roof']
const M = {}
for (const n of names) M[n] = new THREE.MeshStandardMaterial()

const scene = new THREE.Group()
const box = (w,h,d)=>new THREE.Mesh(new THREE.BoxGeometry(w||1,h||1,d||1))
function addMesh(m,x,y,z,parent=scene){ m.position.set(x||0,y||0,z||0); (parent||scene).add(m); return m }
const cyl = (rT,rB,h)=>new THREE.Mesh(new THREE.CylinderGeometry(rT||1,rB||1,h||1))
const cone = (r,h)=>new THREE.Mesh(new THREE.ConeGeometry(r||1,h||1))
const noop = ()=>{}
const group = ()=>{ const g=new THREE.Group(); scene.add(g); return g }

const kit = {
  scene, M,
  box: (w,h,d,m,x,y,z,p)=>addMesh(box(w,h,d),x,y,z,p),
  cyl: (rT,rB,h,m,x,y,z,s,p)=>addMesh(cyl(rT,rB,h),x,y,z,p),
  cone: (r,h,m,x,y,z,s,p)=>addMesh(cone(r,h),x,y,z,p),
  add: addMesh, group, win: ()=>new THREE.Group(), gridGlass: ()=>new THREE.Group(),
  paved: noop, treeAt: noop, bushAt: noop, hedge: noop, planter: noop,
  lampPost: noop, benchAt: noop, carAt: noop, steps: noop, railing: noop, parapet: noop,
}
const D = makeDistrict(kit)
for (const k of ['t137','t138','t139','t140','t141','t142','t143','t144','t145','t146','t147']) {
  try {
    const r = D[k](0,0)
    console.log(k, 'ok', r.top)
  } catch (e) {
    console.log(k, 'FAIL', e.message)
  }
}
try {
  D.addStreets([], { COLS: 8, ROW_UNITS: 20, SP_X: 62, SP_Z: 66 })
  console.log('addStreets ok')
} catch (e) {
  console.log('addStreets FAIL', e.message)
}
try {
  D.addRiver({ cx: 0, cz: 836, len: 2900, width: 210 })
  console.log('addRiver ok')
} catch (e) {
  console.log('addRiver FAIL', e.message)
}
