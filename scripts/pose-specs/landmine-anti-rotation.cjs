// Hands together on the end of a landmine bar: press it out in front of the chest and hold the torso square; no turning.
module.exports={key:'landmine-anti-rotation',title:'Landmine Anti-Rotation',highlight:['spine','shoulderL'],frames:[
 {label:'Bar at the chest, feet planted',duration:1000,hold:300,anchor:{joint:'ankleL',x:50,y:90},rel:{torso:180,neck:0,shL:35,elL:105,shR:35,elR:105,hipL:5,knL:10,anL:90,hipR:5,knR:10,anR:90}},
 {label:'Press out, brace, do not twist',duration:1000,hold:600,anchor:{joint:'ankleL',x:50,y:90},rel:{shL:80,elL:5,shR:80,elR:5}},
]};
