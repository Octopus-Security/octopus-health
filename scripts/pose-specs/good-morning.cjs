// Bar across the upper back: push the hips back, flat back, until the torso is near level, then stand.
const arms={shL:-60,elL:150,shR:-60,elR:150};
module.exports={key:'good-morning',title:'Barbell Good Morning',hold:'barbell',highlight:['hipL','spine'],frames:[
 {label:'Stand tall, bar on the upper back',duration:1100,anchor:{joint:'ankleL',x:50,y:90},rel:{torso:180,neck:0,...arms,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
 {label:'Hips back, back flat, knees soft',duration:1100,hold:350,anchor:{joint:'ankleL',x:50,y:90},rel:{torso:110,neck:20,...arms,hipL:80,knL:22,anL:92,hipR:80,knR:22,anR:92}},
]};
