// Jab, cross, rear low kick: the fundamental Muay Thai combination, from the same stance as jab-cross and roundhouse.
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
const A={joint:'ankleL',x:52,y:90};
module.exports={key:'muay-thai-combo',title:'Jab – Cross – Low Kick',highlight:[],frames:[
 {label:'Guard',duration:400,anchor:A,abs:G},
 {label:'Jab',duration:220,anchor:A,highlight:['shoulderL','elbowL'],abs:{upperArmL:90,forearmL:92}},
 {label:'Back to guard',duration:250,hold:0,anchor:A,highlight:[],abs:{upperArmL:30,forearmL:160}},
 {label:'Cross',duration:260,anchor:A,highlight:['shoulderR','elbowR'],abs:{torso:165,head:168,upperArmR:88,forearmR:90}},
 {label:'Rear hand returns, hips load',duration:260,hold:0,anchor:A,highlight:[],abs:{torso:172,head:172,upperArmR:20,forearmR:165}},
 {label:'Pivot and chamber',duration:240,hold:0,anchor:A,highlight:['hipR'],abs:{torso:184,head:178,thighR:55,shinR:-10,footR:110,upperArmR:-10,forearmR:20}},
 {label:'Shin into the thigh (low kick)',duration:260,anchor:A,highlight:['hipR','kneeR'],abs:{torso:198,head:188,thighR:78,shinR:72,footR:150,upperArmR:-25,forearmR:5}},
 {label:'Fold back',duration:300,hold:0,anchor:A,highlight:[],abs:{torso:184,head:178,thighR:40,shinR:-30,footR:90,upperArmR:-10,forearmR:20}},
 {label:'Guard',duration:400,anchor:A,abs:G},
]};
