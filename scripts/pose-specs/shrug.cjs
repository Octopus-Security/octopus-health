// Front view so both shoulders are seen rising; "shrug" lifts them toward the ears (engine option).
const STAND={torso:180,head:180,upperArmL:6,forearmL:4,upperArmR:-6,forearmR:-4,thighL:3,shinL:3,footL:90,thighR:-3,shinR:-3,footR:-90};
module.exports={key:'shrug',title:'Dumbbell Shrug',view:'front',hold:'dumbbell',highlight:['shoulderL','shoulderR'],frames:[
 {label:'Shoulders down, arms long',duration:700,ground:{joint:'hip',x:50},useRoot:true,abs:STAND,shrug:0},
 {label:'Shoulders straight up to the ears',duration:900,hold:900,ground:{joint:'hip',x:50},useRoot:true,abs:STAND,shrug:5},
]};
