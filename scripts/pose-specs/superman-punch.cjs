// Superman punch: fake the rear knee forward, kick the same leg back hard and spring off the lead foot,
// throwing the rear hand straight through as you travel. Lands on the lead foot, then steps back to stance.
const G={torso:172,head:172,upperArmL:30,forearmL:160,upperArmR:20,forearmR:165,thighL:12,shinL:-4,footL:90,thighR:-22,shinR:-20,footR:70};
module.exports={key:'superman-punch',title:'Superman Punch',highlight:['shoulderR','hipR'],frames:[
 {label:'Guard',duration:420,anchor:{joint:'ankleL',x:46,y:90},abs:G},
 {label:'Fake the rear knee forward',duration:200,anchor:{joint:'ankleL',x:46,y:90},abs:{torso:176,head:174,thighR:60,shinR:-10,footR:90,thighL:16,shinL:-6}},
 {label:'Kick it back, spring off the lead foot',duration:180,hold:0,air:true,root:{x:44,y:47},abs:{torso:162,head:166,thighR:-40,shinR:-70,footR:30,thighL:20,shinL:-12,footL:70,upperArmR:60,forearmR:120}},
 {label:'Rear hand lands as the lead foot does',duration:200,hold:250,anchor:{joint:'ankleL',x:56,y:90},highlight:['shoulderR','elbowR'],abs:{torso:160,head:164,upperArmR:90,forearmR:92,upperArmL:28,forearmL:170,thighL:22,shinL:-8,footL:90,thighR:-30,shinR:-44,footR:50}},
 {label:'Step back to stance',duration:500,anchor:{joint:'ankleL',x:46,y:90},highlight:[],abs:G},
]};
