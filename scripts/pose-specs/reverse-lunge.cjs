// Planted front foot; step the other leg back and lower until both knees are about 90 degrees, then step it back in.
const A={joint:'ankleL',x:66,y:90};
module.exports={key:'reverse-lunge',title:'Reverse Lunge',highlight:['kneeL','hipL'],frames:[
 {label:'Stand tall on the front foot',duration:700,hold:300,anchor:A,rel:{torso:180,neck:0,shL:0,elL:0,shR:0,elR:0,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
 {label:'Step back',duration:500,hold:0,anchor:A,abs:{thighR:-30,shinR:-45,footR:30}},
 {label:'Lower: front shin vertical, back knee near the floor',duration:700,hold:500,anchor:A,abs:{thighL:90,shinL:0,footL:90,thighR:-5,shinR:-105,footR:33}},
]};
