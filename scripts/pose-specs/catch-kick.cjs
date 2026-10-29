// Catch and return a body kick: turn with the kick, scoop it with the lead arm and clamp it with the rear hand,
// then return fire with a rear low kick to the standing leg before letting go.
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
const A={joint:'ankleL',x:56,y:90};
module.exports={key:'catch-kick',title:'Catch and Return',highlight:['shoulderL','elbowL'],frames:[
 {label:'Guard',duration:380,anchor:A,abs:G},
 {label:'Absorb: lead arm scoops under the kick',duration:220,anchor:A,highlight:['shoulderL','elbowL'],abs:{torso:178,head:174,upperArmL:16,forearmL:96,upperArmR:44,forearmR:118,thighL:16,shinL:-8}},
 {label:'Clamp it to the ribs, load the rear hip',duration:220,hold:0,anchor:A,abs:{torso:184,head:178,thighR:40,shinR:-30,footR:90}},
 {label:'Return the rear low kick to the standing leg',duration:240,hold:250,anchor:A,highlight:['hipR','kneeR'],abs:{torso:198,head:188,thighR:78,shinR:72,footR:150,upperArmR:-20,forearmR:10}},
 {label:'Release, back to guard',duration:420,anchor:A,highlight:[],abs:G},
]};
