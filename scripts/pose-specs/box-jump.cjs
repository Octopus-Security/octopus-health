// Supported by the box for half the rep, so not floor-grounded throughout.
module.exports={key:'box-jump',title:'Box Jump',grounded:false,props:[{type:'box',x:52,y:72,w:26,h:20}],highlight:['hipL','kneeL'],frames:[
 {label:'Stand facing the box',duration:500,anchor:{joint:'ankleL',x:24,y:90},rel:{torso:180,neck:0,shL:0,elL:5,shR:0,elR:5,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
 {label:'Load: hips back, arms swing back',duration:350,anchor:{joint:'ankleL',x:24,y:90},rel:{torso:140,neck:15,shL:-55,elL:10,shR:-55,elR:10,hipL:95,knL:95,anL:120,hipR:95,knR:95,anR:120}},
 {label:'Take off: arms swing through',duration:180,hold:0,anchor:{joint:'ankleL',x:24,y:90},rel:{torso:160,neck:10,shL:40,elL:10,shR:40,elR:10,hipL:40,knL:40,anL:110,hipR:40,knR:40,anR:110}},
 {label:'Jump: arms drive up',duration:350,air:true,root:{x:42,y:34},rel:{torso:170,neck:5,shL:120,elL:10,shR:120,elR:10,hipL:70,knL:90,anL:110,hipR:70,knR:90,anR:110}},
 {label:'Land soft on the box',duration:400,anchor:{joint:'ankleL',x:62,y:70},rel:{torso:145,neck:15,shL:70,elL:20,shR:70,elR:20,hipL:90,knL:95,anL:120,hipR:90,knR:95,anR:120}},
 {label:'Stand tall on top',duration:500,anchor:{joint:'ankleL',x:62,y:70},rel:{torso:180,neck:0,shL:0,elL:5,shR:0,elR:5,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
 {label:'Step back down',duration:700,anchor:{joint:'ankleL',x:24,y:90},rel:{}},
]};
