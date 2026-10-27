// Side-lying, seen from in front of the chest. The knees are bent toward the viewer (foreshortened).
// The top arm starts reaching toward the viewer (short), rises to the ceiling (full length) and
// falls away behind (short again); the head turns to follow the hand. Knees stay stacked.
const knees={thighL:0.45,thighR:0.45,shinL:0.6,shinR:0.6};
module.exports={key:'open-book',title:'Thoracic Open Book',highlight:['spine','shoulderL'],frames:[
 {label:'On your side, knees bent and stacked, arms reaching forward',duration:1300,root:{x:56,y:85},depth:{...knees,upperArmL:0.3,forearmL:0.3,upperArmR:0.3,forearmR:0.3},abs:{torso:-90,head:-80,upperArmL:150,forearmL:150,upperArmR:150,forearmR:150,thighL:120,shinL:30,footL:110,thighR:120,shinR:30,footR:110}},
 {label:'Top arm rises to the ceiling, eyes follow',duration:1000,hold:0,root:{x:56,y:85},depth:{upperArmL:1,forearmL:1},abs:{upperArmL:180,forearmL:180,head:-110}},
 {label:'Open: arm falls behind, chest to the ceiling',duration:1400,hold:1200,root:{x:56,y:85},depth:{upperArmL:0.35,forearmL:0.35},abs:{upperArmL:210,forearmL:210,head:-140}},
 {label:'Bring it back up and over',duration:1000,hold:0,root:{x:56,y:85},depth:{upperArmL:1,forearmL:1},abs:{upperArmL:180,forearmL:180,head:-110}},
]};
