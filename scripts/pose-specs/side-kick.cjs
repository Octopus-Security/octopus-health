// Side kick with the lead (near) leg: chamber the knee across the body, turn the hip over and drive the heel out
// in a straight line, leaning the torso away. The foot is turned so the heel and blade lead (a teep pushes with the ball).
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
const A={joint:'ankleR',x:36,y:88.5};
module.exports={key:'side-kick',title:'Side Kick',highlight:['hipL','kneeL'],frames:[
 {label:'Guard',duration:420,anchor:A,abs:G},
 {label:'Chamber the lead knee high',duration:240,anchor:A,abs:{torso:186,head:180,thighL:96,shinL:-30,footL:60,thighR:-12,shinR:-12,footR:78}},
 {label:'Turn the hip over, drive the heel out',duration:200,hold:250,anchor:A,highlight:['hipL','kneeL'],abs:{torso:228,head:206,thighL:98,shinL:96,footL:186,upperArmL:60,forearmL:200,thighR:-6,shinR:-6,footR:84}},
 {label:'Re-chamber',duration:220,hold:0,anchor:A,abs:{torso:186,head:180,thighL:96,shinL:-30,footL:60,upperArmL:30,forearmL:160}},
 {label:'Back to guard',duration:420,anchor:A,highlight:[],abs:G},
]};
