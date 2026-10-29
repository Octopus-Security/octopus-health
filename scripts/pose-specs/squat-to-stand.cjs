// Fold and hold the toes, drop the hips into a deep squat with the chest up and the elbows pushing the
// knees out, straighten the legs again without letting go, then roll up to standing and reach overhead.
const A={joint:'ankleL',x:46,y:90};const toes={handL:{x:53,y:88.5},handR:{x:53,y:88.5}};const P=['handL','handR'];
module.exports={key:'squat-to-stand',title:'Squat to Stand',highlight:['hipL','kneeL'],frames:[
 {label:'Stand tall',duration:1200,anchor:A,abs:{torso:180,head:180,upperArmL:0,forearmL:5,upperArmR:0,forearmR:5,thighL:0,shinL:0,footL:90,thighR:0,shinR:0,footR:90}},
 {label:'Fold, knees soft, hold the toes',duration:1300,anchor:A,pins:P,ik:toes,arch:16,abs:{torso:58,head:35,thighL:18,shinL:4,thighR:18,shinR:4}},
 {label:'Drop the hips, chest up, elbows push the knees out',duration:1400,hold:900,anchor:A,pins:P,ik:toes,arch:0,abs:{torso:125,head:150,thighL:102,shinL:-34,thighR:102,shinR:-34}},
 {label:'Straighten the legs, still holding the toes',duration:1200,hold:700,anchor:A,pins:P,ik:toes,arch:16,abs:{torso:58,head:35,thighL:18,shinL:4,thighR:18,shinR:4}},
 {label:'Roll up',duration:900,hold:0,anchor:A,arch:8,abs:{torso:130,head:130,upperArmL:60,forearmL:70,upperArmR:60,forearmR:70,thighL:6,shinL:0,thighR:6,shinR:0}},
 {label:'Stand and reach overhead',duration:1300,hold:500,anchor:A,arch:-4,abs:{torso:182,head:184,upperArmL:176,forearmL:178,upperArmR:176,forearmR:178,thighL:0,shinL:0,thighR:0,shinR:0}},
 {label:'Lower the arms in front',duration:900,hold:0,anchor:A,arch:0,abs:{torso:180,head:180,upperArmL:90,forearmL:95,upperArmR:90,forearmR:95}},
]};
