// Head and feet both stay on the floor: anchored at the head, ankles solved onto fixed floor points and pinned.
const ank={ankleL:{x:70,y:90},ankleR:{x:70,y:90}};const head={joint:'head',x:24,y:86.2};const pins=['ankleL','ankleR'];
module.exports={key:'neck-bridge',title:'Neck Bridge',highlight:['neck','spine'],frames:[
 {label:'On the back, feet planted',duration:900,anchor:head,pins,ik:ank,arch:0,rel:{torso:-82,neck:8,shL:10,elL:135,shR:10,elR:135,hipL:60,anL:70,hipR:60,anR:70}},
 {label:'Push up onto the head',duration:900,anchor:head,pins,ik:ank,arch:-14,rel:{torso:-68,neck:52}},
 {label:'Rock toward the forehead',duration:800,anchor:head,pins,ik:ank,arch:-18,rel:{torso:-62,neck:60}},
 {label:'Rock back toward the crown',duration:800,anchor:head,pins,ik:ank,arch:-10,rel:{torso:-74,neck:40}},
]};
