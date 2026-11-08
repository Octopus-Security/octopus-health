// Lead-leg switch knee: a quick hop swaps the feet so the lead (near) leg goes back, then it drives the knee up
// through the target with the hips forward and the hands pulling down. Steps back through to stance.
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
module.exports={key:'switch-knee',title:'Switch Knee',highlight:['hipL','kneeL'],frames:[
 {label:'Guard',duration:380,anchor:{joint:'ankleL',x:56,y:90},abs:G},
 {label:'Switch: lead foot back, rear foot forward',duration:180,hold:0,air:true,root:{x:47,y:48},abs:{thighL:-6,shinL:-14,footL:78,thighR:2,shinR:-10,footR:88}},
 {label:'Land in the switched stance',duration:160,hold:0,anchor:{joint:'ankleR',x:54,y:89.5},abs:{thighL:-22,shinL:-20,footL:70,thighR:12,shinR:-4,footR:90}},
 {label:'Drive the knee: hips forward, hands pull down',duration:200,hold:250,anchor:{joint:'ankleR',x:54,y:89.5},highlight:['hipL','kneeL'],abs:{torso:182,head:172,thighL:130,shinL:24,footL:110,thighR:-6,shinR:-6,footR:84,upperArmL:50,forearmL:120,upperArmR:46,forearmR:116}},
 {label:'Lower the leg behind',duration:260,hold:0,anchor:{joint:'ankleR',x:54,y:89.5},highlight:[],abs:{torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:-22,shinL:-20,footL:70,thighR:12,shinR:-4,footR:90}},
 {label:'Switch back',duration:180,hold:0,air:true,root:{x:47,y:48},abs:{thighL:-6,shinL:-14,footL:78,thighR:2,shinR:-10,footR:88}},
 {label:'Guard',duration:300,anchor:{joint:'ankleL',x:56,y:90},abs:G},
]};
