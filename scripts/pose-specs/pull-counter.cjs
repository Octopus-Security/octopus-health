// Pull counter: shift the weight onto the rear leg so the jab falls short with the head still on line, catch it
// with the rear hand, then come straight back with the cross as the weight returns forward.
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
const A={joint:'ankleR',x:38,y:88.5};
module.exports={key:'pull-counter',title:'Pull Counter',highlight:['spine','kneeR'],frames:[
 {label:'Guard',duration:380,anchor:A,abs:G},
 {label:'Pull back onto the rear leg, lead leg light',duration:220,anchor:A,highlight:['spine','kneeR'],abs:{torso:198,head:190,thighR:-2,shinR:-34,footR:58,thighL:22,shinL:16,footL:100,upperArmR:30,forearmR:180}},
 {label:'Fire the cross as the weight comes forward',duration:200,hold:250,anchor:A,highlight:['shoulderR','elbowR'],abs:{torso:162,head:166,thighR:-24,shinR:-24,footR:66,thighL:18,shinL:-6,footL:90,upperArmR:88,forearmR:90}},
 {label:'Back to guard',duration:420,anchor:A,highlight:[],abs:G},
]};
