// Bob and weave (roll under a hook): bend the knees to drop the head under the punch, travel in a U, and come up on
// the other side still in guard. One continuous movement: the middle keys are pass-through.
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
const A={joint:'ankleL',x:52,y:90};
const RF={ankleR:{x:52-17.1,y:87.8}};
module.exports={key:'bob-weave',title:'Bob and Weave',highlight:['kneeL','kneeR'],frames:[
 {label:'Guard',duration:340,anchor:A,abs:G},
 {label:'Bend the knees, head drops',duration:260,hold:0,anchor:A,ik:RF,ikFoot:60,abs:{torso:160,head:164,thighL:40,shinL:-28,thighR:2,shinR:-60,footR:44,upperArmL:24,forearmL:166}},
 {label:'Under the punch',duration:260,hold:0,anchor:A,ik:RF,ikFoot:60,abs:{torso:150,head:156,thighL:56,shinL:-36,}},
 {label:'Come up on the other side',duration:300,hold:0,anchor:A,ik:RF,ikFoot:60,abs:{torso:166,head:170,thighL:30,shinL:-20,}},
]};
