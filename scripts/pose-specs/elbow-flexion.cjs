// No weight: slow full-range elbow bend and straighten, upper arm still.
module.exports={key:'elbow-flexion',title:'Elbow Flexion / Extension',highlight:['elbowL'],frames:[
 {label:'Arm straight, do not lock hard',duration:1500,anchor:{joint:'ankleL',x:50,y:90},abs:{torso:180,head:180,upperArmL:20,forearmL:22,upperArmR:0,forearmR:0,thighL:0,shinL:0,footL:90,thighR:0,shinR:0,footR:90}},
 {label:'Bend fully',duration:1500,hold:400,anchor:{joint:'ankleL',x:50,y:90},abs:{forearmL:178}},
]};
