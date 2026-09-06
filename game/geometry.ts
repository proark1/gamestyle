import { GOAL, ITEMS, type Kind } from './types';

export const FLOOR=.13, PLAYER_RADIUS=.34, PLAYER_HEIGHT=1.94;
export type ShapeBox={size:[number,number,number];pos:[number,number,number];color:string;rounded?:boolean;id?:string};
const shape=(size:ShapeBox['size'],pos:ShapeBox['pos'],color:string,rounded=false):ShapeBox=>({size,pos,color,rounded});
/** These boxes are both the visible mesh and the collision shape. */
export function salvageShapes(kind:Kind):ShapeBox[]{
  const {w,h,d,color}=ITEMS[kind];
  if(kind==='crate'||kind==='fridge')return [shape([w,h,d],[0,h/2,0],color,true)];
  if(kind==='plank')return [shape([w,h,d],[0,h/2,0],color)];
  if(kind==='pallet')return [
    ...[-.8,-.4,0,.4,.8].map(z=>shape([w,.13,.4],[0,h-.065,z],color)),
    ...[-.85,0,.85].map(x=>shape([.25,.32,d],[x,.16,0],'#957445')),
  ];
  if(kind==='sofa')return [
    ...[-1.1,1.1].flatMap(x=>[-.42,.42].map(z=>shape([.16,.23,.16],[x,.115,z],'#725b43'))),
    shape([w,.4,d],[0,.43,0],color,true),
    shape([w,h-.3,.3],[0,(h+.3)/2,-(d-.3)/2],color,true),
    ...[-1.24,1.24].map(x=>shape([.32,.65,d],[x,.63,0],color,true)),
    ...[-.62,.62].map(x=>shape([1.08,.19,.86],[x,.7,.12],'#e8b453',true)),
  ];
  return [
    shape([w,.38,d],[0,.19,0],color,true),
    ...[-.55,.55].map(z=>shape([w,.47,.2],[0,.615,z],color,true)),
    ...[-1.14,1.14].map(x=>shape([.22,.47,d],[x,.615,0],color,true)),
    shape([1.9,.04,.86],[0,.4,0],'#75aaa5'),
  ];
}

export const SCENERY:ShapeBox[]=[
  {...shape([21,1.1,21],[0,FLOOR-.55,0],'#a5b396'),id:'ground'},
  {...shape([3.9,2.6,2.8],[-7,1.3,-7],'#7f9b88',true),id:'shed'},
  {...shape([4.4,.22,3.25],[-7,2.72,-7],'#466c60'),id:'shed-roof'},
  ...[6.9,8.8].map(x=>({...shape([.24,16,.24],[x,8,-6.5],'#d5a33c'),id:'crane-post'})),
  {...shape([14,.38,.5],[2,16,-6.5],'#e5b343'),id:'crane-beam'},
  {...shape([1.4,1.2,1.4],[7.8,14.7,-6.1],'#d1a74f',true),id:'crane-cabin'},
  {...shape([4.7,.28,4.7],[0,GOAL-.14,0],'#f0ce75'),id:'rescue-platform'},
  ...[-2.2,2.2].map(x=>({...shape([.08,.8,4.5],[x,13.94,0],'#c09236'),id:'rescue-rail'})),
  {...shape([4.5,.8,.08],[0,13.94,-2.2],'#c09236'),id:'rescue-rail'},
];

export const PIECE_MASS:Record<Kind,number>={crate:30,pallet:18,plank:12,sofa:42,bathtub:55,fridge:65};
