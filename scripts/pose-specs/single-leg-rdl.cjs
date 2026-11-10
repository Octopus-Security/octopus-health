// Hinge on one leg, the other leg reaching straight back in line with the torso, hands toward the floor.
const A={joint:'ankleL',x:50,y:90};
module.exports={key:'single-leg-rdl',title:'Single-Leg Romanian Deadlift',highlight:['hipL','spine'],frames:[
 {label:'Stand on one leg',duration:1000,hold:300,anchor:A,rel:{torso:180,neck:0,shL:0,elL:0,shR:0,elR:0,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
 {label:'Hinge: back leg and torso make one line',duration:1300,hold:400,anchor:A,abs:{torso:100,head:115,upperArmL:5,forearmL:5,upperArmR:5,forearmR:5,thighL:12,shinL:-3,footL:90,thighR:-80,shinR:-80,footR:10}},
]};
