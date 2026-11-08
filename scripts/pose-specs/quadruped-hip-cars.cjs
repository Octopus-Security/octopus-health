// On all fours, the working knee draws a circle: forward under the body, out to the side (toward the
// viewer, so the thigh foreshortens), back behind, and down. The spine stays still.
const P0={torso:108,head:150,upperArmL:0,forearmL:0,upperArmR:0,forearmR:0,thighL:0,shinL:-90,footL:-72,thighR:0,shinR:-90,footR:-72};
const A={joint:'kneeR',x:42.2,y:88.5};
module.exports={key:'quadruped-hip-cars',title:'Quadruped Hip CARs',highlight:['hipL'],frames:[
 {label:'All fours, spine still',duration:900,anchor:A,pins:['handL','handR'],abs:P0},
 {label:'Knee forward under the chest',duration:900,hold:0,anchor:A,pins:['handL','handR'],abs:{thighL:50,shinL:-108,footL:-85}},
 {label:'Knee out to the side',duration:900,hold:0,anchor:A,pins:['handL','handR'],depth:{thighL:0.45,shinL:1},abs:{thighL:-10,shinL:-95,footL:-60}},
 {label:'Knee back behind, foot to the ceiling',duration:900,hold:0,anchor:A,pins:['handL','handR'],depth:{thighL:1,shinL:1},abs:{thighL:-80,shinL:-170,footL:-100}},
 {label:'Down to the start',duration:900,anchor:A,pins:['handL','handR'],abs:{thighL:0,shinL:-90,footL:-72}},
]};
