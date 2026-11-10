// One hand on the end of a landmine bar at the shoulder: press it up and forward along the bar's arc, with a little leg drive.
const A={joint:'ankleL',x:50,y:90};
module.exports={key:'landmine-press',title:'Landmine Press',highlight:['shoulderL','elbowL'],frames:[
 {label:'Bar end at the shoulder, knees soft',duration:900,hold:300,anchor:A,rel:{torso:180,neck:0,shL:30,elL:130,shR:0,elR:0,hipL:10,knL:20,anL:90,hipR:10,knR:20,anR:90}},
 {label:'Press up and forward, legs straighten',duration:900,hold:450,anchor:A,rel:{shL:150,elL:5,hipL:0,knL:0,hipR:0,knR:0}},
]};
