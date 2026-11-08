// Front view: a Granby rolls across the upper back from one shoulder to the other, so the body
// turns over in the plane facing the viewer. Every limb is written relative to the torso (rot).
const SEAT={head:180,upperArmL:20,forearmL:160,upperArmR:-20,forearmR:-160,thighL:80,shinL:-85,footL:180,thighR:-80,shinR:85,footR:180};
const TUCK={head:180,upperArmL:20,forearmL:160,upperArmR:-20,forearmR:-160,thighL:150,shinL:-20,footL:120,thighR:-150,shinR:20,footR:240};
const rot=(b,T)=>{const o={torso:T};for(const k in b)o[k]=b[k]+(T-180);return o;};
module.exports={key:'granby-roll',title:'Granby Roll',view:'front',highlight:["spine","neck"],frames:[
 {label:'Seated base',duration:600,ground:{joint:'hip',x:50},useRoot:true,abs:rot(SEAT,180)},
 {label:'Drop onto one shoulder',duration:420,hold:0,ground:{joint:'neck',x:42},useRoot:true,abs:rot(TUCK,255)},
 {label:'Roll across the upper back, hips over',duration:420,hold:0,ground:{joint:'neck',x:50},useRoot:true,abs:rot(TUCK,360)},
 {label:'Onto the other shoulder',duration:420,hold:0,ground:{joint:'neck',x:58},useRoot:true,abs:rot(TUCK,465)},
 {label:'Back to base, facing the same way',duration:700,ground:{joint:'hip',x:50},useRoot:true,abs:rot(SEAT,540)},
]};
