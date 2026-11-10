// Step forward, lower until both knees are about 90 degrees, then push back to standing. Rear foot stays planted.
const A={joint:'toeR',x:35,y:91};
module.exports={key:'forward-lunge',title:'Forward Lunge',highlight:['kneeL','hipL'],frames:[
 {label:'Stand, feet together',duration:700,hold:300,anchor:A,rel:{torso:180,neck:0,shL:0,elL:0,shR:0,elR:0,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
 {label:'Step forward',duration:500,hold:0,anchor:A,abs:{thighL:40,shinL:15,footL:90}},
 {label:'Lower: front shin vertical, back knee near the floor',duration:700,hold:500,anchor:A,abs:{thighR:-5,shinR:-97,footR:40},ik:{ankleL:{x:74,y:90}},ikFoot:90},
]};
