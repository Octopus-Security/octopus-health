// Balance on one leg; the free foot reaches forward and taps, comes back, then reaches behind and taps. Arms out for balance.
const A={joint:'ankleL',x:50,y:90};
module.exports={key:'single-leg-reach',title:'Single-Leg Reach',highlight:['ankleL','kneeL'],frames:[
 {label:'Stand on one leg, knee soft',duration:900,hold:300,anchor:A,rel:{torso:180,neck:0,shL:35,elL:5,shR:35,elR:5,hipL:0,knL:8,anL:90,hipR:0,knR:8,anR:90}},
 {label:'Reach the free foot forward and tap',duration:1100,hold:400,anchor:A,ik:{ankleR:{x:73,y:89}},ikFoot:90},
 {label:'Back to centre',duration:700,hold:200,anchor:A,rel:{hipR:0,knR:8,anR:90}},
 {label:'Reach the free foot behind and tap',duration:1100,hold:400,anchor:A,ik:{ankleR:{x:27,y:89}},ikFoot:60},
]};
