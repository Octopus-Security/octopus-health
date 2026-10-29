// From a seated shin box (front shin across the body, pointing away from the viewer, back thigh out to
// the far side), drive the hips up and forward over the front knee to a tall kneel, then sit back down
// under control. The front knee stays planted. Hip rotation is in depth, so those segments foreshorten.
const K={joint:'kneeL',x:52,y:88.5};
module.exports={key:'shin-box-get-up',title:'Shin Box Get-Up',highlight:['hipL','hipR'],frames:[
 {label:'Seated shin box, chest tall',duration:1300,hold:500,anchor:K,depth:{shinL:0.15,footL:0.5,thighR:0.3,shinR:1},abs:{torso:182,head:182,upperArmL:40,forearmL:100,upperArmR:40,forearmR:100,thighL:88,shinL:-70,footL:-40,thighR:73,shinR:-92,footR:-77}},
 {label:'Drive the hips up and forward',duration:1100,hold:0,anchor:K,depth:{shinL:0.15,footL:0.5,thighR:0.65,shinR:1},abs:{torso:176,head:178,upperArmL:60,forearmL:110,upperArmR:60,forearmR:110,thighL:48,shinL:-70,footL:-40,thighR:40,shinR:-90,footR:-72}},
 {label:'Tall kneel, glutes squeezed',duration:1400,hold:700,anchor:K,depth:{shinL:0.15,footL:0.5,thighR:1,shinR:1},abs:{torso:180,head:180,upperArmL:45,forearmL:95,upperArmR:45,forearmR:95,thighL:0,shinL:-70,footL:-40,thighR:0,shinR:-90,footR:-72}},
]};
