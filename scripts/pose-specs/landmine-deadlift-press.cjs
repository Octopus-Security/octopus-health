// Hinge to pick the bar end up off the floor, stand, and press it overhead on the way up.
const A={joint:'ankleL',x:38,y:90};
module.exports={key:'landmine-deadlift-press',title:'Landmine Deadlift to Rotational Press',highlight:['hipL','shoulderL'],frames:[
 {label:'Hinge, flat back, hands on the bar end',duration:1000,hold:300,anchor:A,rel:{torso:112,neck:15,shL:0,elL:0,shR:0,elR:0,hipL:70,knL:30,anL:118,hipR:70,knR:30,anR:118},abs:{upperArmL:0,forearmL:0,upperArmR:0,forearmR:0}},
 {label:'Stand tall, bar at the shoulder',duration:800,hold:100,absReset:true,anchor:A,rel:{torso:180,neck:0,shL:30,elL:130,shR:30,elR:130,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
 {label:'Turn and press up and forward',duration:800,hold:450,anchor:A,rel:{shL:150,elL:5,shR:150,elR:5}},
]};
