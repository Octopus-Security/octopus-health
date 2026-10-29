// Lead hook to the body, thrown with the near (lead) arm so it is not hidden: bend the knees to drop the level,
// lean onto the lead side, and dig the fist in under the ribs with the elbow tight. Snaps: hold on guard and on contact.
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
const A={joint:'ankleL',x:52,y:90};
module.exports={key:'body-hook',title:'Lead Hook to the Body',highlight:['shoulderL','spine'],frames:[
 {label:'Guard',duration:420,anchor:A,abs:G},
 {label:'Drop the level, lean onto the lead side',duration:200,anchor:A,abs:{torso:160,head:164,thighL:34,shinL:-16,thighR:-8,shinR:-44,footR:52,upperArmL:22,forearmL:150}},
 {label:'Dig the hook in under the ribs',duration:200,hold:250,anchor:A,highlight:['shoulderL','elbowL','spine'],abs:{torso:150,head:160,upperArmL:22,forearmL:104,upperArmR:24,forearmR:170}},
 {label:'Back to guard',duration:420,anchor:A,highlight:[],abs:G},
]};
