// Hamstring floss: front heel stays put, hips rock back over the rear knee, front knee straightens, toes up.
const front={ankleL:{x:60,y:90}};
module.exports={key:'half-kneel-hamstring',title:'Hamstring Floss',highlight:['kneeL','hipL'],frames:[
 {label:'Half-kneel, front foot flat',duration:900,anchor:{joint:'kneeR',x:38,y:88.5},pins:['ankleL'],ik:front,abs:{torso:178,head:178,upperArmL:15,forearmL:60,upperArmR:-10,forearmR:20,thighL:90,shinL:0,footL:90,thighR:0,shinR:-90,footR:-70}},
 {label:'Hips back, front knee straight, toes up',duration:1000,hold:500,ikFoot:160,anchor:{joint:'kneeR',x:38,y:88.5},pins:['ankleL'],ik:front,abs:{torso:132,head:135,upperArmL:-10,forearmL:5,upperArmR:-10,forearmR:5,thighR:30}},
]};
