// Oblique kick: a short lead-leg stomp at the opponent's lead knee, sole first, travelling down and forward.
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
const A={joint:'ankleR',x:38,y:88.5};
module.exports={key:'oblique-kick',title:'Oblique Kick',highlight:['hipL','kneeL'],frames:[
 {label:'Guard',duration:420,anchor:A,abs:G},
 {label:'Lift the lead knee, foot turned out',duration:200,anchor:A,abs:{torso:178,head:176,thighL:70,shinL:-10,footL:110,thighR:-14,shinR:-14,footR:76}},
 {label:'Stomp down through the knee line',duration:180,hold:250,anchor:A,highlight:['hipL','kneeL'],abs:{torso:190,head:184,thighL:58,shinL:52,footL:150,thighR:-10,shinR:-10,footR:80}},
 {label:'Back to guard',duration:420,anchor:A,highlight:[],abs:G},
]};
