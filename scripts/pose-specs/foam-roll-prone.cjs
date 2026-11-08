// Face down on the forearms, roller under the front of the hip; the body slides so it rolls toward the knee.
const P={torso:94,head:96,upperArmL:0,forearmL:90,upperArmR:0,forearmR:90,thighL:-94,shinL:-150,footL:-120,thighR:-94,shinR:-150,footR:-120};
module.exports={key:'foam-roll-prone',title:'Foam Roll (face down)',props:[{type:'roller',x:38,y:87.5,r:5.5}],highlight:['hipL','kneeL'],frames:[
 {label:'Roller just below the hip',duration:1400,anchor:{joint:'elbowL',x:68,y:89.6},abs:P},
 {label:'Slide forward: roll toward the knee',duration:1400,anchor:{joint:'elbowL',x:80,y:89.6},abs:P},
]};
