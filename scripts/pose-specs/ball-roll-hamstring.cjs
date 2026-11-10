// Seated, leaning back on the hands, hips lifted a little; a lacrosse ball under the back of one thigh. Shift the hips to roll along it.
const a={torso:222,head:216,upperArmL:-3,forearmL:-3,upperArmR:-3,forearmR:-3,thighL:82,shinL:82,footL:172,thighR:82,shinR:82,footR:172};
module.exports={key:'ball-roll-hamstring',title:'Hamstring Ball Roll',props:[{type:'ball',x:56,y:88,r:4}],highlight:['hipL','kneeL'],frames:[
 {label:'Ball under the thigh, hips lifted on the hands',duration:1800,hold:300,root:{x:38,y:82},abs:a},
 {label:'Slide the hips toward the ball: it rolls up toward the sit bone',duration:2000,hold:400,root:{x:46,y:82}},
]};
