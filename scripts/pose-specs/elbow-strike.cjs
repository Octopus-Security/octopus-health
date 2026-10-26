// Near (lead) elbow, so it is not hidden behind the body; the drill is thrown with both: drawn back, then swung through at head height with the forearm folded tight.
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
const A={joint:'ankleL',x:50,y:90};
module.exports={key:'elbow-strike',title:'Elbow Strike',highlight:['shoulderL','elbowL'],frames:[
 {label:'Guard',duration:450,anchor:A,abs:G},
 {label:'Load: elbow drawn back, hips turned',duration:260,anchor:A,abs:{torso:178,head:176,upperArmL:-40,forearmL:110}},
 {label:'Swing the elbow through at head height',duration:240,hold:250,anchor:A,abs:{torso:166,head:170,upperArmL:96,forearmL:250,thighR:-28,shinR:-36,footR:50}},
 {label:'Back to guard',duration:450,anchor:A,abs:G},
]};
