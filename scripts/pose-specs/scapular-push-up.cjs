// Plank with the elbows LOCKED the whole time: only the shoulder blades move. Let the chest sink between them, then push the floor away and round the upper back.
const A={joint:'toeL',x:10,y:91.5};
const base={torso:108,head:112,upperArmL:0,forearmL:0,upperArmR:0,forearmR:0,thighL:-72,shinL:-72,footL:-10,thighR:-72,shinR:-72,footR:-10};
module.exports={key:'scapular-push-up',title:'Scapular Push-up',highlight:['shoulderL','spine'],frames:[
 {label:'Arms locked, chest sinks between the shoulder blades',duration:1100,hold:400,anchor:A,shrug:0,arch:-8,abs:{...base,head:122}},
 {label:'Push the floor away, upper back rounds, arms still locked',duration:1100,hold:400,anchor:A,shrug:2,arch:12,abs:{head:108}},
]};
