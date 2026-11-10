// Narrow steps in a straight line: each heel is placed directly in front of the other foot's toes. Arms a little out for balance.
const G={joint:'hip',x:50};
const arms={torso:180,head:180,upperArmL:20,forearmL:25,upperArmR:20,forearmR:25};
const F=(label,abs,dur,hold)=>({label,duration:dur,hold:hold||0,ground:G,useRoot:true,abs});
module.exports={key:'tandem-walk',title:'Heel-to-Toe Walk',highlight:['ankleL','ankleR'],frames:[
 {...F('Left heel placed in front of the right toes',{thighL:8,shinL:8,footL:100,thighR:-8,shinR:-8,footR:85},600,250),rel:{torso:180,neck:0,shL:20,elL:5,shR:20,elR:5}},
 F('Right foot swings through, close to the line',{thighL:0,shinL:0,footL:90,thighR:12,shinR:-12,footR:80},450),
 F('Right heel placed in front of the left toes',{thighR:8,shinR:8,footR:100,thighL:-8,shinL:-8,footL:85},600,250),
 F('Left foot swings through, close to the line',{thighR:0,shinR:0,footR:90,thighL:12,shinL:-12,footL:80},450),
]};
