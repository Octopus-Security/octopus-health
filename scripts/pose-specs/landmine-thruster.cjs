// Squat with the bar end held at the chest, then stand and press it up and forward in one drive.
const A={joint:'ankleL',x:50,y:90};
module.exports={key:'landmine-thruster',title:'Landmine Thruster',highlight:['kneeL','shoulderL'],frames:[
 {label:'Squat, bar end at the chest',duration:900,hold:300,anchor:A,rel:{torso:140,neck:12,shL:30,elL:125,shR:30,elR:125,hipL:125,knL:115,anL:120,hipR:125,knR:115,anR:120}},
 {label:'Drive up and press the bar out and up',duration:900,hold:450,anchor:A,rel:{torso:180,neck:0,shL:150,elL:8,shR:150,elR:8,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
]};
