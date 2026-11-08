// Spinning back fist. The turn happens out of the picture plane, so it is drawn as the step across with the back
// turned and the rear arm folded across the chest, then the backhand lashing out at head height. Drawn from the other
// side so the striking (rear) arm is the near, bright one.
const G={torso:172,head:172,upperArmR:30,forearmR:160,upperArmL:20,forearmL:165,thighR:12,shinR:-4,footR:90,thighL:-22,shinL:-20,footL:70};
const A={joint:'ankleR',x:48,y:90};
module.exports={key:'spinning-back-fist',title:'Spinning Back Fist',highlight:['shoulderL','spine'],frames:[
 {label:'Guard',duration:420,anchor:A,abs:G},
 {label:'Step across, turn the back, look over the shoulder',duration:240,hold:0,anchor:A,abs:{torso:188,head:200,upperArmL:76,forearmL:222,upperArmR:10,forearmR:150,thighL:4,shinL:-12,footL:80,thighR:6,shinR:-2}},
 {label:'Whip the backhand out at head height',duration:200,hold:250,anchor:A,highlight:['shoulderL','elbowL'],abs:{torso:168,head:170,upperArmL:100,forearmL:98,upperArmR:28,forearmR:165,thighL:-24,shinL:-26,footL:60,thighR:14,shinR:-6}},
 {label:'Back to guard',duration:450,anchor:A,highlight:[],abs:G},
]};
