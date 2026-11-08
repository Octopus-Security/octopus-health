// Sled push, drawn in place: hands on the uprights with the arms bent, body at about 45 degrees, driving one knee
// forward while the other leg pushes back to full extension. Continuous: pass-through keys.
const R={x:40,y:63};
const base={torso:128,neck:20,shL:60,elL:90,shR:60,elR:90,hipL:40,knL:40,anL:110,hipR:40,knR:40,anR:110};
const H={handL:{x:78,y:47},handR:{x:78,y:51}};
const B={x:10,y:84.5},P={x:20,y:76},U={x:48,y:74},D={x:42,y:86.5},M={x:26,y:84.5},S={x:38,y:71};
module.exports={key:'sled-push',title:'Sled Push',highlight:['hipL','kneeL','hipR'],
 props:[{type:'box',x:78,y:80,w:20,h:12},{type:'bar',x1:79,y1:42,x2:79,y2:80}],frames:[
 {label:'Near leg drives back, far knee drives through',duration:200,hold:0,root:R,rel:base,ik:{...H,ankleL:B,ankleR:U},ikFoot:{ankleL:40,ankleR:60}},
 {label:'Far foot strikes under the hip',duration:200,hold:0,root:R,ik:{...H,ankleL:P,ankleR:D},ikFoot:{ankleL:10,ankleR:70}},
 {label:'Far foot pushes the floor back',duration:200,hold:0,root:R,ik:{...H,ankleL:S,ankleR:M},ikFoot:{ankleL:40,ankleR:40}},
 {label:'Far leg drives back, near knee drives through',duration:200,hold:0,root:R,ik:{...H,ankleL:U,ankleR:B},ikFoot:{ankleL:60,ankleR:40}},
 {label:'Near foot strikes under the hip',duration:200,hold:0,root:R,ik:{...H,ankleL:D,ankleR:P},ikFoot:{ankleL:70,ankleR:10}},
 {label:'Near foot pushes the floor back',duration:200,hold:0,root:R,ik:{...H,ankleL:M,ankleR:S},ikFoot:{ankleL:40,ankleR:40}},
]};
