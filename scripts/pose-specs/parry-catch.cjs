// Long guard, parry and catch: the lead hand reaches out to frame the distance, the rear hand parries the jab down
// and across, the lead glove catches the follow-up in front of the face, and the jab comes straight back.
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
const A={joint:'ankleL',x:50,y:90};
module.exports={key:'parry-catch',title:'Parry and Catch',highlight:['shoulderL','shoulderR'],frames:[
 {label:'Guard',duration:380,anchor:A,abs:G},
 {label:'Long guard: lead hand out, open',duration:240,anchor:A,highlight:['shoulderL'],abs:{upperArmL:78,forearmL:96}},
 {label:'Rear hand parries the jab down and across',duration:180,anchor:A,highlight:['shoulderR','elbowR'],abs:{upperArmL:40,forearmL:170,upperArmR:56,forearmR:76,torso:170}},
 {label:'Lead glove catches in front of the face',duration:200,anchor:A,highlight:['shoulderL','elbowL'],abs:{upperArmR:20,forearmR:165,upperArmL:48,forearmL:184,torso:174,head:174}},
 {label:'Jab straight back',duration:200,anchor:A,highlight:['shoulderL','elbowL'],abs:{upperArmL:90,forearmL:92,torso:170,head:172}},
 {label:'Back to guard',duration:380,anchor:A,highlight:[],abs:G},
]};
