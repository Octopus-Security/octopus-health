// The bell arm (near, L) stays locked vertical the whole way: absolute 180 in every frame.
const BELL={upperArmL:180,forearmL:180};
const LIE={torso:270,neck:0,shR:90,elR:0,hipL:50,knL:100,anL:50,hipR:0,knR:0,anR:90};
const ELBOW={torso:228,neck:-10,hipL:75,knL:100,anL:70,hipR:-5,knR:0,anR:90};
const HAND={torso:205,neck:-5,hipL:85,knL:95,anL:80,hipR:-5,knR:0,anR:90};
const HIGH={torso:250,neck:-15,hipL:10,knL:85,anL:80,hipR:-30,knR:0,anR:60};
const KNEEL={torso:192,neck:0,hipL:95,knL:95,anL:90,hipR:-10,knR:100,anR:40};
const TALL={torso:180,neck:0,hipL:90,knL:90,anL:90,hipR:0,knR:90,anR:20};
const STAND={torso:180,neck:0,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90};
module.exports={key:'turkish-get-up',title:'Turkish Get-Up',hold:'kettlebellL',highlight:['shoulderL','spine'],frames:[
 {label:'Lie down, bell pressed up, same-side knee bent',duration:700,ground:{joint:'hip',x:58},rel:LIE,abs:BELL},
 {label:'Roll up onto the elbow',duration:700,ground:{joint:'hip',x:58},rel:ELBOW,abs:{...BELL,upperArmR:10,forearmR:100}},
 {label:'Up onto the hand',duration:600,ground:{joint:'hip',x:58},rel:HAND,abs:{...BELL,upperArmR:-25,forearmR:-22}},
 {label:'High hip bridge',duration:600,ground:{joint:'handR',x:30},rel:HIGH,abs:{...BELL,upperArmR:-10,forearmR:-8}},
 {label:'Sweep the leg back under to a kneel',duration:700,ground:{joint:'kneeR',x:46},rel:KNEEL,abs:{...BELL,upperArmR:-30,forearmR:-28}},
 {label:'Windshield-wiper to a tall half-kneel',duration:700,ground:{joint:'kneeR',x:46},rel:TALL,abs:{...BELL,upperArmR:0,forearmR:5}},
 {label:'Stand up, bell locked overhead',duration:900,hold:500,ground:{joint:'ankleL',x:62},rel:STAND,abs:{...BELL,upperArmR:0,forearmR:5}},
 {label:'Lunge back down to a kneel',duration:700,ground:{joint:'kneeR',x:46},rel:TALL,abs:{...BELL,upperArmR:0,forearmR:5}},
 {label:'Hand down, leg sweeps through',duration:700,ground:{joint:'kneeR',x:46},rel:KNEEL,abs:{...BELL,upperArmR:-30,forearmR:-28}},
 {label:'Sit back to the hand',duration:600,ground:{joint:'hip',x:58},rel:HAND,abs:{...BELL,upperArmR:-25,forearmR:-22}},
 {label:'Down to the elbow',duration:600,ground:{joint:'hip',x:58},rel:ELBOW,abs:{...BELL,upperArmR:10,forearmR:100}},
]};
