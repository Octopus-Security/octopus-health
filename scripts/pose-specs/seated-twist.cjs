// Seen from the side, a seated rotation shows as one elbow coming forward while the other goes back.
module.exports={key:'seated-twist',title:'Seated Spine Rotation',highlight:['spine'],frames:[
 {label:'Seated tall, hands behind the head',duration:900,ground:{joint:'hip',x:46},abs:{torso:180,head:180,upperArmL:180,forearmL:335,upperArmR:180,forearmR:335,thighL:78,shinL:-82,footL:-10,thighR:78,shinR:-82,footR:-10}},
 {label:'Rotate one way',duration:1000,hold:500,ground:{joint:'hip',x:46},abs:{upperArmL:135,forearmL:285,upperArmR:225,forearmR:345}},
 {label:'Back to centre',duration:900,ground:{joint:'hip',x:46},abs:{upperArmL:180,forearmL:335,upperArmR:180,forearmR:335}},
 {label:'Rotate the other way',duration:1000,hold:500,ground:{joint:'hip',x:46},abs:{upperArmL:225,forearmL:345,upperArmR:135,forearmR:285}},
]};
