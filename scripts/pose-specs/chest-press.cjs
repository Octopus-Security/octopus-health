// Seated machine press: back against the pad, handles pressed straight forward.
module.exports={key:'chest-press',title:'Chest Press Machine',props:[{type:'box',x:30,y:74,w:22,h:18},{type:'bar',x1:30,y1:42,x2:33,y2:74}],highlight:['shoulderL','elbowL'],frames:[
 {label:'Handles at the chest',duration:900,anchor:{joint:'ankleL',x:62,y:90},abs:{torso:186,head:182,upperArmL:-60,forearmL:90,upperArmR:-60,forearmR:90,thighL:90,shinL:0,footL:90,thighR:90,shinR:0,footR:90}},
 {label:'Press forward',duration:1000,anchor:{joint:'ankleL',x:62,y:90},abs:{upperArmL:85,forearmL:90,upperArmR:85,forearmR:90}},
]};
