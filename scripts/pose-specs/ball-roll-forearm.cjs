// Standing at a table, one forearm resting on a lacrosse ball: lean the body forward and back so the ball rolls from wrist to elbow.
const A={joint:'ankleL',x:35,y:90};
module.exports={key:'ball-roll-forearm',title:'Forearm Ball Roll',props:[{type:'box',x:38,y:42,w:58,h:50},{type:'ball',x:60,y:38.5,r:3}],highlight:['elbowL','hand'],frames:[
 {label:'Forearm on the ball, hand toward you',duration:1600,hold:300,anchor:A,abs:{torso:150,head:158,upperArmL:0,forearmL:90,upperArmR:0,forearmR:90,thighL:0,shinL:0,footL:90,thighR:0,shinR:0,footR:90}},
 {label:'Lean forward: the ball rolls toward the elbow',duration:1600,hold:300,anchor:A,abs:{torso:128,head:140,upperArmL:60,forearmL:92,upperArmR:60,forearmR:92}},
]};
