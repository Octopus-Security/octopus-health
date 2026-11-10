// Bar racked on the front of the shoulders, elbows high.
const arms={shL:95,elL:85,shR:95,elR:85};
module.exports={key:'front-squat',title:'Barbell Front Squat',hold:'barbell',highlight:['kneeL','hipL'],frames:[
 {label:'Stand, bar racked on the shoulders',duration:1100,anchor:{joint:'ankleL',x:50,y:90},rel:{torso:180,neck:0,...arms,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
 {label:'Sit down, torso stays tall',duration:900,hold:350,anchor:{joint:'ankleL',x:50,y:90},rel:{torso:152,neck:8,...arms,hipL:113,knL:115,anL:120,hipR:113,knR:115,anR:120}},
]};
