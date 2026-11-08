// Bear crawl, drawn in place like the run: on hands and the balls of the feet, knees hovering a hand's width off the
// floor, back flat, opposite hand and foot stepping together. One continuous movement (pass-through keys).
const R={x:40,y:66};
const base={torso:100,neck:30,shL:80,elL:0,shR:80,elR:0,hipL:80,knL:100,anL:100,hipR:80,knR:100,anR:100};
const k=(handL,handR,ankleL,ankleR)=>({ankleL,ankleR,handL,handR});
const HF={x:76,y:90.3},HB={x:64,y:90.3},HU={x:71,y:85},FF={x:31,y:84.5},FB={x:22,y:84.5},FU={x:27,y:80};
module.exports={key:'bear-crawl',title:'Bear Crawl',highlight:['shoulderL','hipL','kneeL'],frames:[
 {label:'Near hand and far foot step',duration:260,hold:0,root:R,rel:base,ik:k(HU,HB,FB,FU),ikFoot:30},
 {label:'Plant them',duration:260,hold:0,root:R,ik:k(HF,HB,FB,FF),ikFoot:30},
 {label:'Far hand and near foot step',duration:260,hold:0,root:R,ik:k(HB,HU,FU,FB),ikFoot:30},
 {label:'Plant them',duration:260,hold:0,root:R,ik:k(HB,HF,FF,FB),ikFoot:30},
]};
