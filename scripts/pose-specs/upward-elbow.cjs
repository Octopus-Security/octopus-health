// Sok Ngad (near arm, so it is not hidden behind the head): the elbow drives straight up under the chin, pushing off the rear foot.
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
const A={joint:'ankleL',x:50,y:90};
module.exports={key:'upward-elbow',title:'Upward Elbow',highlight:['shoulderL','elbowL'],frames:[
 {label:'Guard',duration:450,anchor:A,abs:G},
 {label:'Dip',duration:220,anchor:A,abs:{torso:165,head:168,thighL:25,shinL:-15,thighR:-15,shinR:-35,footR:55}},
 {label:'Drive the elbow up under the chin, rear heel lifts',duration:240,hold:250,anchor:A,abs:{torso:186,head:180,upperArmL:150,forearmL:305,thighL:5,shinL:0,thighR:-25,shinR:-28,footR:40}},
 {label:'Back to guard',duration:450,anchor:A,abs:G},
]};
