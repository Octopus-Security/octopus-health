// node scripts/pose-gen.cjs scripts/pose-specs/<key>.cjs [...] — writes public/poses/<key>.json from a
// relative-angle spec. Run from the repo root, then `node scripts/poses.mjs <key>` and LOOK at the sheet.
// rel keys (side view, degrees): torso (absolute), neck (head - torso; - = chin tucked),
//   shL/shR shoulder flexion (0 arms down, 90 forward, 180 overhead, -40 behind),
//   elL/elR elbow flexion, hipL/hipR hip flexion (0 standing, 90 sitting, - = extended behind),
//   knL/knR knee flexion, anL/anR ankle (90 neutral, foot - shin).
// abs: absolute angle overrides (front view uses abs only).
// placement per frame: anchor {joint,x,y} | root {x,y} | ground {joint, x}  (ground: lowest drawn edge on the floor)
const fs=require('fs'),path=require('path');
const SF=require(path.join(process.cwd(),'public/stick-figure.js'));
const RADIUS={hip:5,neck:5,head:7,shoulderL:3,shoulderR:3,elbowL:3,elbowR:3,handL:2.7,handR:2.7,hipL:4,hipR:4,kneeL:4,kneeR:4,ankleL:3.2,ankleR:3.2,toeL:2.3,toeR:2.3};
const SURF=93.5;
const r1=v=>Math.round(v*10)/10;
function absFrom(rel){
  const o={};const t=rel.torso;o.torso=t;o.head=t+(rel.neck??0);
  for(const s of['L','R']){
    const ua=t-180+(rel['sh'+s]??0);o['upperArm'+s]=ua;o['forearm'+s]=ua+(rel['el'+s]??0);
    const th=t-180+(rel['hip'+s]??0);o['thigh'+s]=th;const sh=th-(rel['kn'+s]??0);o['shin'+s]=sh;o['foot'+s]=sh+(rel['an'+s]??90);
  }
  return o;
}
for(const file of process.argv.slice(2)){
  const spec=require(path.resolve(file));
  let rel={},abs={};const frames=[];
  for(const f of spec.frames){
    rel={...rel,...(f.rel||{})};
    abs=f.absReset?{...(f.abs||{})}:{...abs,...(f.abs||{})};
    const p=spec.view==='front'?{...abs}:{...absFrom(rel),...abs};
    for(const k in p)p[k]=r1(p[k]);
    if(f.depth)p.depth=f.depth; if(f.arch!=null)p.arch=f.arch; if(f.shrug!=null)p.shrug=f.shrug;
    const out={duration:f.duration??900,label:f.label};
    if(f.hold!=null)out.hold=f.hold; if(f.ease)out.ease=f.ease; if(f.air)out.air=true;
    if(f.pins)out.pins=f.pins; if(f.highlight)out.highlight=f.highlight;
    if(f.anchor)out.anchor=f.anchor;
    else{
      let root=f.root;
      if(f.ground){const probe={...p,arch:p.arch||0,shrug:p.shrug||0,root:{x:0,y:0}};const j=SF.solve(probe,spec.view||'side');
        let low=-1e9;for(const k in j)low=Math.max(low,j[k].y+RADIUS[k]);
        root={x:r1(f.ground.x-j[f.ground.joint].x),y:r1(SURF-0.3-low)};
        if(!f.useRoot){out.anchor={joint:f.ground.joint,x:r1(f.ground.x),y:r1(root.y+j[f.ground.joint].y)};root=null;}}
      if(root)p.root=root;
    }
    if(f.ik){ // two-bone IK after placement: {ankleL:{x,y},...} -> thigh/shin or upperArm/forearm
      const LIM={handL:['shoulderL','upperArmL','forearmL',15,14,1],handR:['shoulderR','upperArmR','forearmR',15,14,1],ankleL:['hipL','thighL','shinL',20,20,-1],ankleR:['hipR','thighR','shinR',20,20,-1]};
      const view=spec.view||'side';
      const solveAt=()=>{const q={...p,arch:p.arch||0,shrug:p.shrug||0};if(!q.root){q.root={x:0,y:0};const j=SF.solve(q,view);const a=out.anchor;q.root={x:a.x-j[a.joint].x,y:a.y-j[a.joint].y};}return SF.solve(q,view);};
      for(const end in f.ik){const L=LIM[end],tg=f.ik[end],base=solveAt()[L[0]];
        const dx=tg.x-base.x,dy=tg.y-base.y,la=L[3],lb=L[4];const dd=Math.min(Math.max(Math.hypot(dx,dy),Math.abs(la-lb)+0.01),la+lb-0.01);
        const al=Math.acos((la*la+dd*dd-lb*lb)/(2*la*dd))*180/Math.PI,dir=Math.atan2(dx,dy)*180/Math.PI;
        let par=dir-L[5]*al;const el={x:base.x+Math.sin(par*Math.PI/180)*la,y:base.y+Math.cos(par*Math.PI/180)*la};
        let ch=Math.atan2(tg.x-el.x,tg.y-el.y)*180/Math.PI;
        const near=(v,ref)=>v+Math.round((ref-v)/360)*360; const prev=frames.length?frames[frames.length-1].pose:p; par=near(par,prev[L[1]]);ch=near(ch,par+(L[5]>0?60:-60));
        const footKey=end==='ankleL'?'footL':end==='ankleR'?'footR':null; if(footKey){p[footKey]=r1(near(f.ikFoot??90,ch+90));}
        p[L[1]]=r1(par);p[L[2]]=r1(ch);}
    }
    out.pose=p;frames.push(out);
  }
  const o={version:2,title:spec.title,view:spec.view||'side'};
  for(const k of['static','grounded','hold','props','highlight'])if(spec[k]!==undefined)o[k]=spec[k];
  o.frames=spec.static?frames.map(({duration,...r})=>r):frames;
  const body='{\n'+Object.entries(o).map(([k,v])=>k==='frames'?' "frames": [\n'+v.map(x=>'  '+JSON.stringify(x)).join(',\n')+'\n ]':' '+JSON.stringify(k)+': '+JSON.stringify(v)).join(',\n')+'\n}\n';
  fs.writeFileSync(path.join(process.cwd(),'public/poses',spec.key+'.json'),body);
  console.log('wrote',spec.key);
}
