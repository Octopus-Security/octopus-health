// Crab walk, in place: face up, hands behind the shoulders, feet flat in front, hips lifted level with the knees,
// walking on opposite hand and foot. Continuous: pass-through keys.
const R={x:46,y:70};
const base={torso:257,neck:-57,shL:-77,elL:0,shR:-77,elR:0,hipL:40,knL:110,anL:90,hipR:40,knR:110,anR:90};
const k=(handL,handR,ankleL,ankleR)=>({ankleL,ankleR,handL,handR});
const HF={x:20,y:90.3},HB={x:12,y:90.3},HU={x:16,y:85},FF={x:70,y:88},FB={x:62,y:88},FU={x:66,y:83};
module.exports={key:'crab-walk',title:'Crab Walk',highlight:['shoulderL','hipL','elbowL'],frames:[
 {label:'Near hand and far foot step',duration:300,hold:0,root:R,rel:base,ik:k(HU,HB,FB,FU),ikFoot:90},
 {label:'Plant them',duration:300,hold:0,root:R,ik:k(HF,HB,FB,FF),ikFoot:90},
 {label:'Far hand and near foot step',duration:300,hold:0,root:R,ik:k(HB,HU,FU,FB),ikFoot:90},
 {label:'Plant them',duration:300,hold:0,root:R,ik:k(HB,HF,FF,FB),ikFoot:90},
]};
