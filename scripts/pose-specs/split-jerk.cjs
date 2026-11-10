// Dip, drive, and split the feet: front knee soft, back leg long, arms locked overhead.
const A={joint:'toeR',x:35,y:91};
module.exports={key:'split-jerk',title:'Split Jerk',highlight:['shoulderL','kneeL'],frames:[
 {label:'Stand, bar at the shoulders',duration:800,hold:300,anchor:A,rel:{torso:180,neck:0,shL:30,elL:130,shR:30,elR:130,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
 {label:'Dip: knees bend, torso stays upright',duration:400,hold:0,anchor:A,rel:{hipL:30,knL:50,anL:105,hipR:30,knR:50,anR:105}},
 {label:'Split under the bar, arms locked overhead',duration:600,hold:600,anchor:A,rel:{shL:172,elL:3,shR:172,elR:3},abs:{thighR:-18,shinR:-36,footR:40},ik:{ankleL:{x:70,y:90}},ikFoot:90},
]};
