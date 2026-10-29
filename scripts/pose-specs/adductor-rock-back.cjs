// Quadruped with the near leg straight out to the side, foot flat (toward the viewer, so the leg is
// foreshortened). Rock the hips back toward the far heel with a flat back, then forward again.
const K={joint:'kneeR',x:44,y:88.5};const H={handL:{x:71,y:89.3},handR:{x:71,y:89.3}};const P=['handL','handR'];
module.exports={key:'adductor-rock-back',title:'Adductor Rock-Back',highlight:['hipL'],frames:[
 {label:'All fours, one leg straight out to the side',duration:1300,hold:400,anchor:K,pins:P,ik:H,depth:{thighL:0.534,shinL:0.534},abs:{torso:100,head:140,upperArmL:0,forearmL:0,upperArmR:0,forearmR:0,thighL:4,shinL:4,footL:90,thighR:0,shinR:-90,footR:-72}},
 {label:'Rock the hips back, back flat',duration:1500,hold:900,anchor:K,pins:P,ik:H,depth:{thighL:0.55,shinL:0.55},abs:{torso:110,head:145,thighL:57,shinL:57,footL:90,thighR:58,shinR:-90,footR:-72}},
]};
