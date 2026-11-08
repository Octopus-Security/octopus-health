// Fists circle at eye level, the two hands half a turn apart; pass-through keys so the circles never stop.
const k=(l1,l2,f1,f2)=>({upperArmL:l1,forearmL:f1,upperArmR:l2,forearmR:f2});
module.exports={key:'speed-bag',title:'Speed Bag',props:[{type:'ball',x:72,y:-2,r:6}],highlight:['shoulderL','shoulderR'],frames:[
 {label:'Fists up at eye level',duration:160,hold:0,anchor:{joint:'ankleL',x:42,y:90},abs:{torso:176,head:178,...k(95,110,150,250),thighL:8,shinL:-4,footL:90,thighR:-12,shinR:-14,footR:76}},
 {duration:160,hold:0,anchor:{joint:'ankleL',x:42,y:90},abs:k(110,100,200,195)},
 {duration:160,hold:0,anchor:{joint:'ankleL',x:42,y:90},abs:k(100,85,250,150)},
 {duration:160,hold:0,anchor:{joint:'ankleL',x:42,y:90},abs:k(85,95,195,200)},
]};
