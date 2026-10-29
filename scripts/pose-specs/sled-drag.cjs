// Backward sled drag, in place: facing the sled, holding the straps at arm's length, leaning back and walking
// backward in short steps, each foot reaching back and pulling through under the hips. Continuous.
const R={x:44,y:52};
const base={torso:198,neck:-14,shL:20,elL:10,shR:20,elR:10,hipL:30,knL:30,anL:90,hipR:30,knR:30,anR:90};
const H={handL:{x:53,y:46},handR:{x:52,y:48}};
const F={x:54,y:88.5},B={x:30,y:88.5},U={x:40,y:82};
module.exports={key:'sled-drag',title:'Backward Sled Drag',highlight:['kneeL','hipL','shoulderL'],
 props:[{type:'box',x:82,y:82,w:16,h:10},{type:'bar',x1:53,y1:47,x2:82,y2:84}],frames:[
 {label:'Near foot reaches back',duration:340,hold:0,root:R,rel:base,ik:{...H,ankleL:U,ankleR:F},ikFoot:90},
 {label:'Plant it, pull through',duration:340,hold:0,root:R,ik:{...H,ankleL:B,ankleR:{x:44,y:88.5}},ikFoot:90},
 {label:'Far foot reaches back',duration:340,hold:0,root:R,ik:{...H,ankleL:F,ankleR:U},ikFoot:90},
 {label:'Plant it, pull through',duration:340,hold:0,root:R,ik:{...H,ankleL:{x:44,y:88.5},ankleR:B},ikFoot:90},
]};
