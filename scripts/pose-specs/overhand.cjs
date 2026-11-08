// Overhand right: the rear hand loops up and over the top of the jab while the head drops off the centre line,
// landing on the target travelling downward. Drawn from the other side so the rear arm is the near (bright) one.
const G={torso:172,head:172,upperArmR:30,forearmR:160,upperArmL:20,forearmL:165,thighR:12,shinR:-4,footR:90,thighL:-22,shinL:-20,footL:70};
const A={joint:'ankleR',x:50,y:90};
const RF={ankleL:{x:50-17.1,y:87.8}};
module.exports={key:'overhand',title:'Overhand Right',highlight:['shoulderL','spine'],frames:[
 {label:'Guard',duration:420,anchor:A,abs:G},
 {label:'Elbow lifts, rear hand loops up',duration:200,hold:0,anchor:A,ik:RF,ikFoot:66,abs:{torso:166,head:168,upperArmL:120,forearmL:200,thighR:20,shinR:-8}},
 {label:'Over the top and down: head drops off the line',duration:220,hold:250,anchor:A,highlight:['shoulderL','elbowL','spine'],ik:RF,ikFoot:50,abs:{torso:146,head:152,upperArmL:104,forearmL:106,upperArmR:20,forearmR:170,thighR:34,shinR:-14}},
 {label:'Back to guard',duration:450,anchor:A,highlight:[],abs:G},
]};
