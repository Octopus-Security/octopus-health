// Takedown shot: level change, penetration step onto the lead knee, drive through.
module.exports={key:'double-leg',title:'Double-Leg Shot',highlight:['hipL','kneeL','shoulderL'],frames:[
 {label:'Stance',duration:600,ground:{joint:'ankleL',x:43},rel:{torso:168,neck:5,shL:40,elL:120,shR:30,elR:135,hipL:25,knL:20,anL:100,hipR:-10,knR:10,anR:90}},
 {label:'Level change: hips drop, head up',duration:400,ground:{joint:'ankleL',x:45},rel:{torso:150,neck:20,shL:60,elL:70,shR:55,elR:80,hipL:80,knL:85,anL:115,hipR:40,knR:70,anR:110}},
 {label:'Penetration step: lead knee to the mat',duration:400,ground:{joint:'kneeL',x:60},rel:{torso:128,neck:35,shL:85,elL:30,shR:85,elR:30,hipL:95,knL:135,anL:25,hipR:-25,knR:20,anR:50}},
 {label:'Drive through, hands lock behind the legs',duration:700,ground:{joint:'ankleL',x:61},rel:{torso:150,neck:15,shL:70,elL:100,shR:70,elR:100,hipL:70,knL:75,anL:110,hipR:-5,knR:30,anR:70}},
 {label:'Reset to stance',duration:700,ground:{joint:'ankleL',x:43},rel:{torso:168,neck:5,shL:40,elL:120,shR:30,elR:135,hipL:25,knL:20,anL:100,hipR:-10,knR:10,anR:90}},
]};
