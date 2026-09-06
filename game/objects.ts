import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, ITEMS, type Kind } from './types';
const materials = new Map<string, T.MeshStandardMaterial>();
export function material(color: string) { if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color, roughness: .9, flatShading: true })); return materials.get(color)!; }
export function box(g: T.Object3D, size: number[], pos: number[], color: string, rounded = false) {
  const mesh = new T.Mesh(rounded ? new RoundedBoxGeometry(size[0], size[1], size[2], 2, .075) : new T.BoxGeometry(...size as [number, number, number]), material(color));
  mesh.position.set(...pos as [number, number, number]); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
}
function cylinder(g: T.Object3D, radius: number, h: number, pos: number[], color: string) { const m = new T.Mesh(new T.CylinderGeometry(radius, radius, h, 10), material(color)); m.position.set(...pos as [number, number, number]); m.castShadow = true; g.add(m); return m; }
export function beam(g: T.Object3D, a: number[], b: number[], width: number, color: string) {
  const av = new T.Vector3(...a as [number,number,number]), bv = new T.Vector3(...b as [number,number,number]);
  const m = box(g, [width, av.distanceTo(bv), width], [0,0,0], color); m.position.copy(av).add(bv).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), bv.sub(av).normalize()); return m;
}
export function label(text: string, bg = '#fff4d7', fg = '#294a45', width = 3) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(0,0,512,128,18); ctx.fill();
  ctx.fillStyle = fg; ctx.font = 'bold 52px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text,256,67,475);
  const map = new T.CanvasTexture(canvas); const s = new T.Sprite(new T.SpriteMaterial({ map, depthTest: false })); s.scale.set(width,width/4,1); return s;
}
export function junk(kind: Kind) {
  const g = new T.Group(); const { w,h,d,color } = ITEMS[kind];
  if (kind === 'crate') {
    box(g,[w,h,d],[0,h/2,0],color,true);
    for (const y of [.17,h-.17]) for(const x of [-w/2-.015,w/2+.015]) box(g,[.08,.16,d+.08],[x,y,0],'#86643f');
    for (const x of [-.55,.55]) box(g,[.15,h+.04,d+.05],[x,h/2,0],'#d3b07b');
  } else if (kind === 'pallet' || kind === 'plank') {
    if(kind==='plank') { box(g,[w,h,d],[0,h/2,0],color); box(g,[w-.1,.012,.025],[0,h+.007,.15],'#9a764a'); }
    else { for(let z=-.8;z<=.81;z+=.4) box(g,[w,.13,.28],[0,h-.065,z],color); for(const x of [-.85,0,.85]) box(g,[.25,.32,d],[x,.16,0],'#957445'); }
  } else if (kind === 'sofa') {
    for(const x of [-1.1,1.1]) for(const z of [-.42,.42]) box(g,[.16,.23,.16],[x,.115,z],'#725b43');
    box(g,[w,.4,d],[0,.43,0],color,true); box(g,[w,h-.3,.3],[0,.67,-.5],color,true);
    for(const x of [-1.25,1.25]) box(g,[.32,.65,d],[x,.63,0],color,true);
    for(const x of [-.62,.62]) box(g,[1.08,.19,.86],[x,.7,.12],'#e8b453',true);
  } else if(kind === 'bathtub') {
    box(g,[w,.25,d],[0,.25,0],color,true);
    for(const z of [-.55,.55]) box(g,[w,.5,.2],[0,.59,z],color,true);
    for(const x of [-1.15,1.15]) box(g,[.22,.5,d],[x,.59,0],color,true);
    box(g,[1.9,.04,.86],[0,.39,0],'#75aaa5',true); cylinder(g,.045,.45,[-.9,.85,-.4],'#718c89');
  } else {
    box(g,[w,h,d],[0,h/2,0],color,true); box(g,[w-.12,.57,.04],[0,h-.34,d/2+.01],'#bfcec1',true);
    box(g,[.07,.31,.07],[.46,1.45,.77],'#536f68'); box(g,[.07,.5,.07],[.46,.67,.77],'#536f68'); box(g,[.2,.2,.012],[-.32,1.5,.751],'#e7b959');
  }
  return g;
}
export function worker(color: number) {
  const g = new T.Group(), body = new T.Group(); g.add(body); g.userData.body = body; const c = COLORS[color % 4];
  box(body,[.67,.66,.43],[0,.87,0],c,true); box(body,[.59,.25,.45],[0,.54,0],'#385d63',true); box(body,[.34,.44,.06],[0,.81,.25],'#385d63');
  for(const x of [-.23,.23]) { box(body,[.09,.5,.06],[x,.94,.24],'#385d63'); box(body,[.1,.08,.03],[x,1.07,.285],'#ebc35f'); }
  box(body,[.52,.5,.5],[0,1.43,0],'#e6b58b',true); box(body,[.71,.13,.65],[0,1.68,.03],c,true); box(body,[.57,.22,.53],[0,1.81,0],c,true);
  for(const x of [-.12,.12]) box(body,[.055,.07,.025],[x,1.45,.261],'#283b34'); box(body,[.17,.08,.13],[0,1.35,.29],'#d49670',true);
  for(const side of [-1,1]) {
    const leg = new T.Group(); leg.position.set(side*.19,.5,0); box(leg,[.24,.38,.28],[0,-.18,0],'#385d63',true); box(leg,[.3,.18,.43],[0,-.41,.065],'#4c4840',true); body.add(leg); g.userData[side===1?'legR':'legL'] = leg;
    const arm = new T.Group(); arm.position.set(side*.43,1.08,0); box(arm,[.22,.36,.28],[0,-.12,0],c,true); box(arm,[.22,.21,.25],[0,-.37,0],'#e6b58b',true); body.add(arm); g.userData[side===1?'armR':'armL'] = arm;
  }
  return g;
}
export function island() {
  const g = new T.Group(); box(g,[21,1.1,21],[0,-.55,0],'#a5b396',true); box(g,[20.7,.17,20.7],[0,.025,0],'#c8c3a3',true);
  for(let i=0;i<34;i++) { const x=((i*7.31)%19)-9.5,z=((i*11.71)%19)-9.5; box(g,[.35+(i%3)*.2,.035,.22],[x,.125,z],i%2?'#b4b599':'#d6ccb0'); }
  for(let i=0;i<11;i++) for(const side of [-1,1]) { box(g,[.15,1.2,.15],[-9+i*1.8,.63,side*10],'#8c9a7e'); if(i<10) for(const y of [.45,.95]) box(g,[1.8,.1,.12],[-8.1+i*1.8,y,side*10],'#b0b99b'); }
  box(g,[3.9,2.6,2.8],[-7,1.3,-7],'#7f9b88',true); box(g,[4.4,.22,3.25],[-7,2.72,-7],'#466c60'); box(g,[1,1.9,.08],[-7,.97,-5.56],'#e7ca83'); box(g,[1.1,.8,.07],[-8.25,1.75,-5.55],'#b4d5ce');
  const sign=label('SALVAGE CO.','#f3d783','#395347',3); sign.position.set(-7,3.25,-6); g.add(sign);
  for(const x of [6.9,8.8]) box(g,[.24,16,.24],[x,8,-6.5],'#d5a33c');
  for(let y=0;y<16;y+=1.4) beam(g,[6.9,y,-6.5],[8.8,y+1.4,-6.5],.1,'#d5a33c');
  box(g,[14,.38,.5],[2,16,-6.5],'#e5b343'); beam(g,[-5,16,-6.5],[7.8,18,-6.5],.12,'#c39938'); beam(g,[7.8,18,-6.5],[9,16,-6.5],.12,'#c39938');
  box(g,[1.4,1.2,1.4],[7.8,14.7,-6.1],'#d1a74f',true); box(g,[.85,.6,.1],[7.8,14.9,-5.35],'#527b73');
  for(const x of [-2,2]) for(const z of [-2,2]) cylinder(g,.035,3.8,[x,15.45,z],'#6e8174');
  box(g,[4.7,.28,4.7],[0,13.36,0],'#f0ce75');
  for(const x of [-2.2,2.2]) box(g,[.08,.8,4.5],[x,13.94,0],'#c09236'); box(g,[4.5,.8,.08],[0,13.94,-2.2],'#c09236');
  const rescue=label('RESCUE ↑','#ffe5a0','#426357',3.4); rescue.position.set(0,14.7,0); g.add(rescue);
  for(let i=0;i<10;i++) { const x=Math.cos(i*2.4)*23,z=Math.sin(i*2.4)*23; const land=new T.Mesh(new T.CylinderGeometry(3+i%3,4+i%3,1,7),material('#849f8b')); land.position.set(x,-1,z);g.add(land); for(let j=0;j<2;j++){ cylinder(g,.14,1.4,[x+j,1,z],'#95896a'); const tree=new T.Mesh(new T.IcosahedronGeometry(1.8,0),material(i%2?'#7a9980':'#95ae8c'));tree.position.set(x+j,2.4,z);tree.scale.y=1.25;g.add(tree); } }
  return g;
}
