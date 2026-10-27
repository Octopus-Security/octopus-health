// Turtle: knees and elbows tight, chin protected; then post a foot to come up, and back.
module.exports={key:'turtle',title:'Turtle Position',highlight:['spine','neck'],frames:[
 {label:'Tight ball: elbows to knees, chin down',duration:900,ground:{joint:'kneeL',x:40},arch:22,rel:{torso:100,neck:-45,shL:80,elL:60,shR:80,elR:60,hipL:120,knL:130,anL:30,hipR:120,knR:130,anR:30}},
 {label:'Post a hand, step a foot up',duration:800,ground:{joint:'kneeL',x:40},arch:12,rel:{torso:125,neck:-20,shL:100,elL:5,shR:60,elR:60,hipL:110,knL:125,anL:30,hipR:90,knR:90,anR:90}},
 {label:'Drive up to base',duration:800,ground:{joint:'ankleR',x:58},arch:0,rel:{torso:150,neck:0,shL:60,elL:60,shR:60,elR:60,hipL:70,knL:110,anL:40,hipR:60,knR:70,anR:110}},
 {label:'Back down to turtle',duration:800,ground:{joint:'kneeL',x:40},arch:22,rel:{torso:100,neck:-45,shL:80,elL:60,shR:80,elR:60,hipL:120,knL:130,anL:30,hipR:120,knR:130,anR:30}},
]};
