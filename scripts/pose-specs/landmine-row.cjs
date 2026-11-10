// One arm: staggered stance, hinged forward with the free hand on the thigh; the working hand pulls the end of the landmine bar to the ribs.
const A={joint:'ankleL',x:55,y:90};
module.exports={key:'landmine-row',title:'Landmine Meadows Row',highlight:['shoulderL','elbowL','spine'],frames:[
 {label:'Staggered stance, hinged, arm long toward the bar end',duration:1000,hold:300,anchor:A,abs:{torso:115,head:125,upperArmL:25,forearmL:25,upperArmR:30,forearmR:35,thighL:20,shinL:5,footL:90,thighR:-12,shinR:-14,footR:76}},
 {label:'Row the bar end to the ribs, elbow close',duration:900,hold:350,anchor:A,abs:{upperArmL:-65,forearmL:-5}},
]};
