// Question-mark kick (lead leg, near side): it starts like a low or body roundhouse with the knee pointing down,
// then the hip turns over and the shin hooks up and over onto the head. The path traces a question mark.
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
const A={joint:'ankleR',x:34,y:88.5};
module.exports={key:'question-mark-kick',title:'Question-Mark Kick',highlight:['hipL','kneeL'],frames:[
 {label:'Guard',duration:420,anchor:A,abs:G},
 {label:'Chamber low, like a body kick',duration:220,hold:0,anchor:A,abs:{torso:180,head:178,thighL:62,shinL:-30,footL:70,thighR:-12,shinR:-12,footR:78}},
 {label:'Hip turns over, the knee rises',duration:160,hold:0,anchor:A,abs:{torso:200,head:190,thighL:110,shinL:40,footL:120,upperArmR:-10,forearmR:20}},
 {label:'Shin hooks over onto the head',duration:200,hold:250,anchor:A,highlight:['hipL','kneeL'],abs:{torso:222,head:200,thighL:128,shinL:122,footL:200,upperArmR:-25,forearmR:5,thighR:-6,shinR:-6,footR:84}},
 {label:'Fold back',duration:240,hold:0,anchor:A,abs:{torso:182,head:178,thighL:80,shinL:-20,footL:80,upperArmR:-10,forearmR:20}},
 {label:'Back to guard',duration:420,anchor:A,highlight:[],abs:G},
]};
