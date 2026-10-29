// Rear uppercut to the body. Drawn from the other side (near limbs = rear hand and rear leg) so the rear fist is not
// hidden behind the body. Sit down on the rear leg, then drive up through the rear hip and dig the fist up into the
// solar plexus with the elbow tucked.
const G={torso:172,head:172,upperArmR:30,forearmR:160,upperArmL:20,forearmL:165,thighR:12,shinR:-4,footR:90,thighL:-22,shinL:-20,footL:70};
const A={joint:'ankleR',x:54,y:90};
const RF={ankleL:{x:54-17.1,y:87.8}};  // the rear foot stays where the stance put it
module.exports={key:'body-uppercut',title:'Rear Uppercut to the Body',highlight:['shoulderL','hipL'],frames:[
 {label:'Guard',duration:420,anchor:A,abs:G},
 {label:'Sit down on the rear leg, fist drops to the hip',duration:220,anchor:A,ik:RF,ikFoot:62,abs:{torso:158,head:164,thighR:34,shinR:-18,upperArmL:-8,forearmL:112}},
 {label:'Drive the hip through: fist up into the solar plexus',duration:200,hold:250,anchor:A,highlight:['shoulderL','elbowL','hipL'],ik:RF,ikFoot:50,abs:{torso:166,head:168,thighR:26,shinR:-12,upperArmL:16,forearmL:146}},
 {label:'Back to guard',duration:420,anchor:A,highlight:[],abs:G},
]};
