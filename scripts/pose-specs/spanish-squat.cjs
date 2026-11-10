// A band behind the knees, anchored in front: sit back with the shins vertical and the torso leaning back.
module.exports={key:'spanish-squat',title:'Spanish Squat',props:[{type:'bar',x1:48,y1:70,x2:98,y2:70}],highlight:['kneeL','hipL'],frames:[
 {label:'Stand tall, band behind the knees',duration:1100,anchor:{joint:'ankleL',x:50,y:90},rel:{torso:180,neck:0,shL:50,elL:0,shR:50,elR:0,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
 {label:'Sit back, shins stay vertical',duration:1100,hold:400,anchor:{joint:'ankleL',x:50,y:90},rel:{torso:162,neck:10,shL:55,elL:0,shR:55,elR:0,hipL:103,knL:85,anL:90,hipR:103,knR:85,anR:90}},
]};
