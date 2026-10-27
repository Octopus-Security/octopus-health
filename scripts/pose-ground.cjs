// node scripts/pose-ground.cjs <key> [--float] — inserts pass-through keys wherever a move sinks into
// (or with --float, lifts off) the floor, each anchored on whatever touches the floor at that moment.
// For rolls: run it after pose-gen, and re-run pose-gen + this together (it edits the JSON in place).
const fs=require('fs'),path=require('path');
const SF=require(path.join(process.cwd(),'public/stick-figure.js'));
const RADIUS={hip:5,neck:5,head:7,shoulderL:3,shoulderR:3,elbowL:3,elbowR:3,handL:2.7,handR:2.7,hipL:4,hipR:4,kneeL:4,kneeR:4,ankleL:3.2,ankleR:3.2,toeL:2.3,toeR:2.3};
const SURF=93.5,r1=v=>Math.round(v*10)/10;
const key=process.argv[2],float=process.argv.includes('--float');
const file=path.join(process.cwd(),'public/poses',key+'.json');
const d=JSON.parse(fs.readFileSync(file,'utf8'));const view=d.view||'side';
function low(p){const j=SF.solve(p,view);let lo=-1e9,lj=null;for(const k in j){const e=j[k].y+RADIUS[k];if(e>lo){lo=e;lj=k;}}return{lo,lj,j};}
let changed=0;
for(let pass=0;pass<4;pass++){
  const fr=SF.resolveFrames(d);let inserted=false;
  for(let i=fr.length-1;i>=0;i--){
    const nx=SF.nextOf(fr,i);if(d.frames[i].air||(d.frames[(i+1)%fr.length]||{}).air)continue;
    let worst=0,wt=0;
    for(let s=1;s<12;s++){const t=s/12,q=SF.between(fr[i],nx,t,view),{lo}=low(q);
      const dev=lo>SURF+1?lo-SURF:(float&&lo<SURF-1.5?SURF-lo:0);if(dev>worst){worst=dev;wt=t;}}
    if(worst<=0)continue;
    const q=SF.between(fr[i],nx,wt,view),{lo,lj,j}=low(q);
    const pose={};for(const k of SF.ANGLES)pose[k]=r1(q[k]);if(q.arch)pose.arch=r1(q.arch);if(q.shrug)pose.shrug=r1(q.shrug);if(q.depth){pose.depth={};for(const k in q.depth)pose.depth[k]=Math.round(q.depth[k]*100)/100;}
    const anchor={joint:lj,x:r1(j[lj].x),y:r1(j[lj].y-(lo-(SURF-0.3)))};
    const dur=d.frames[i].duration||1000;
    d.frames[i].duration=Math.max(150,Math.round(dur*wt));
    const nf={duration:Math.max(150,Math.round(dur*(1-wt))),hold:0,anchor,pose};
    if(fr[i].pins.length)nf.pins=fr[i].pins.filter(p=>{const L=j[p];return L&&L.y>SURF-6;});
    d.frames.splice(i+1,0,nf);inserted=true;changed++;
  }
  if(!inserted)break;
}
// pass-through keys inserted mid-move keep the move continuous; the frame before keeps its own hold
fs.writeFileSync(file,'{\n'+Object.entries(d).map(([k,v])=>k==='frames'?' "frames": [\n'+v.map(x=>'  '+JSON.stringify(x)).join(',\n')+'\n ]':' '+JSON.stringify(k)+': '+JSON.stringify(v)).join(',\n')+'\n}\n');
console.log(key,'inserted',changed);
