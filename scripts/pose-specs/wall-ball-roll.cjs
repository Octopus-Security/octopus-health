// Ball pinned between the upper back and a wall: bend and straighten the knees to roll it over the shoulder blade and upper trap.
module.exports={key:'wall-ball-roll',title:'Wall Ball Roll',props:[{type:'wall',x:38},{type:'ball',x:43,y:36,r:4}],highlight:['spine','shoulderL'],frames:[
 {label:'Lean back on the ball, knees soft',duration:1200,hold:300,anchor:{joint:'ankleL',x:62,y:90},abs:{torso:190,head:190,upperArmL:0,forearmL:0,upperArmR:0,forearmR:0,thighL:10,shinL:10,footL:100,thighR:10,shinR:10,footR:100}},
 {label:'Bend the knees, the ball rolls up the back',duration:1200,hold:400,anchor:{joint:'ankleL',x:62,y:90},abs:{torso:190,head:190,thighL:40,shinL:12,footL:104,thighR:40,shinR:12,footR:104}},
]};
