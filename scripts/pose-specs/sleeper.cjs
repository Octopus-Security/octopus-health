// Lying on the stretched side, seen from in front: the upper arm points at the viewer (foreshortened),
// so the forearm's rotation toward the bed (internal rotation) happens in the picture plane.
const knees={thighL:0.45,thighR:0.45,shinL:0.6,shinR:0.6};
module.exports={key:'sleeper',title:'Sleeper Stretch',highlight:['shoulderL'],frames:[
 {label:'On the stretched side, elbow bent, forearm up',duration:1200,root:{x:56,y:85},depth:{...knees,upperArmL:0.3,upperArmR:0.7},abs:{torso:-90,head:-80,upperArmL:60,forearmL:180,upperArmR:150,forearmR:200,thighL:120,shinL:30,footL:110,thighR:120,shinR:30,footR:110}},
 {label:'Other hand eases the wrist toward the bed',duration:1400,hold:1500,root:{x:56,y:85},abs:{forearmL:118,upperArmR:120,forearmR:150}},
]};
