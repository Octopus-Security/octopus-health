const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
module.exports={key:'back-kick',title:'Spinning Back Kick',highlight:['hipR','kneeR'],frames:[
 {label:'Guard',duration:450,anchor:{joint:'ankleL',x:60,y:90},abs:G},
 {label:'Spin, look over the shoulder, chamber',duration:350,anchor:{joint:'ankleL',x:60,y:90},abs:{torso:150,head:160,thighR:50,shinR:-80,footR:0}},
 {label:'Thrust the heel straight back',duration:300,hold:250,anchor:{joint:'ankleL',x:60,y:90},abs:{torso:118,head:130,thighR:-98,shinR:-100,footR:-10}},
 {label:'Retract',duration:350,anchor:{joint:'ankleL',x:60,y:90},abs:{torso:150,head:160,thighR:50,shinR:-80,footR:0}},
 {label:'Back to guard',duration:450,anchor:{joint:'ankleL',x:60,y:90},abs:G},
]};
