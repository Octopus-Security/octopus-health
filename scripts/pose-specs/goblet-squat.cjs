// One weight held against the chest with both hands, elbows pointing down.
const arms={shL:35,elL:125,shR:35,elR:125};
module.exports={key:'goblet-squat',title:'Goblet Squat',hold:'dumbbell',highlight:['kneeL','hipL'],frames:[
 {label:'Stand, weight at the chest',duration:1100,anchor:{joint:'ankleL',x:50,y:90},rel:{torso:180,neck:0,...arms,hipL:0,knL:0,anL:90,hipR:0,knR:0,anR:90}},
 {label:'Sit down between the knees, elbows inside them',duration:900,hold:350,anchor:{joint:'ankleL',x:50,y:90},rel:{torso:152,neck:8,...arms,hipL:113,knL:115,anL:120,hipR:113,knR:115,anR:120}},
]};
