// Sit-out from a front headlock: snapped down on the knees with the head trapped, post on the far hand, step up
// on the near foot, then kick the near leg straight through under the body and sit on that hip, turning away.
module.exports={key:'sit-out',title:'Sit-Out',highlight:['hipL','kneeL','spine'],frames:[
 {label:'Snapped down: on the knees, head low',duration:500,ground:{joint:'kneeL',x:40},rel:{torso:112,neck:-30,shL:70,elL:10,shR:70,elR:10,hipL:80,knL:100,anL:20,hipR:80,knR:100,anR:20}},
 {label:'Hips up onto the toes, hands posted',duration:300,hold:0,ground:{joint:'handR',x:66},rel:{torso:118,neck:-20,shL:66,elL:6,shR:66,elR:6,hipL:70,knL:70,anL:60,hipR:70,knR:70,anR:60}},
 {label:'Near knee swings under the body',duration:220,hold:0,ground:{joint:'handR',x:66},rel:{torso:128,neck:-10,shL:60,elL:6,shR:60,elR:6,hipL:100,knL:60,anL:90,hipR:70,knR:70,anR:60}},
 {label:'Kick the near leg through, sit on the hip',duration:420,ground:{joint:'hip',x:46},rel:{torso:160,neck:5,shL:80,elL:90,shR:-30,elR:5,hipL:110,knL:0,anL:30,hipR:150,knR:140,anR:90}},
 {label:'Turn back to base',duration:600,hold:0,ground:{joint:'kneeR',x:44},rel:{torso:130,neck:-10,shL:50,elL:10,shR:60,elR:10,hipL:100,knL:120,anL:40,hipR:80,knR:100,anR:30}},
]};
