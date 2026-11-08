// On the back, a yoga block under the sacrum, knees bent and feet flat. The pelvis rests on the block,
// shoulders and head on the floor: a passive hip-flexor and low-back release, no glute effort.
const ank={ankleL:{x:80,y:90},ankleR:{x:80,y:90}};
module.exports={key:'supported-bridge',title:'Supported Bridge',static:true,highlight:['hipL','spine'],
 props:[{type:'box',x:45,y:84,w:15,h:8}],
 frames:[
 {label:'Sacrum on the block, let the hips go heavy',anchor:{joint:'neck',x:24,y:87.5},ik:ank,arch:-6,abs:{torso:-74,head:-88,upperArmL:93,forearmL:93,upperArmR:95,forearmR:95,thighL:120,shinL:30,footL:90,thighR:120,shinR:30,footR:90}},
]};
