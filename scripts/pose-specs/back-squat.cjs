// Bar across the upper back, hands just outside the shoulders.
const arms={shL:-60,elL:150,shR:-60,elR:150};
module.exports={key:'back-squat',title:'Barbell Back Squat',hold:'barbell',highlight:['kneeL','hipL'],frames:[
 {label:'Stand, bar on the upper back',duration:1100,anchor:{joint:'ankleL',x:50,y:90},rel:{torso:180,neck:0,...arms,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
 {label:'Sit back and down, chest up',duration:900,hold:350,anchor:{joint:'ankleL',x:50,y:90},rel:{torso:140,neck:12,...arms,hipL:125,knL:115,anL:120,hipR:125,knR:115,anR:120}},
]};
