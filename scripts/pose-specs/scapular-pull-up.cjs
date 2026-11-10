// Arms stay straight; the shoulders sink away from the ears and the body rises a few centimetres.
module.exports={key:'scapular-pull-up',title:'Scapular Pull-up',grounded:false,props:[{type:'bar',x1:36,y1:-3,x2:84,y2:-3}],highlight:['shoulderL','spine'],frames:[
 {label:'Passive hang, shoulders up by the ears',duration:1400,shrug:4,anchor:{joint:'handL',x:60,y:-3},pins:['handR'],abs:{torso:180,head:180,upperArmL:180,forearmL:180,upperArmR:180,forearmR:180,thighL:5,shinL:-85,footL:0,thighR:5,shinR:-85,footR:0}},
 {label:'Pull the shoulders down, arms still straight',duration:1100,hold:400,shrug:0,anchor:{joint:'handL',x:60,y:-3},pins:['handR'],abs:{thighL:22,shinL:-70,thighR:22,shinR:-70}},
]};
