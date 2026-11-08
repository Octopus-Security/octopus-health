// Continuous roll: the keys in the middle are pass-through (hold 0) so it never stops mid-roll.
module.exports={key:'back-roll',title:'Back Roll',highlight:['spine','neck'],frames:[
 {label:'Seated, knees up',duration:550,ground:{joint:'hip',x:50},rel:{torso:180,neck:-10,shL:60,elL:90,shR:60,elR:90,hipL:115,knL:70,anL:40,hipR:115,knR:70,anR:40}},
 {label:'Chin tucked, rock back',duration:380,hold:0,ground:{joint:'hip',x:52},rel:{torso:250,neck:-45,shL:130,elL:120,shR:130,elR:120,hipL:140,knL:130,anL:60,hipR:140,knR:130,anR:60}},
 {label:'Over one shoulder, hands by the ears',duration:380,hold:0,ground:{joint:'neck',x:46},rel:{torso:330,neck:-55,hipL:150,knL:125,hipR:150,knR:125},abs:{upperArmL:200,forearmL:340,upperArmR:200,forearmR:340}},
 {label:'Feet reach the floor behind',duration:450,hold:0,ground:{joint:'neck',x:50},rel:{torso:385,neck:-50,hipL:150,knL:110,anL:70,hipR:150,knR:110,anR:70},abs:{upperArmL:195,forearmL:325,upperArmR:195,forearmR:325}},
 {label:'Push through to the knees',duration:600,hold:0,absReset:true,ground:{joint:'kneeL',x:34},rel:{torso:455,neck:-15,shL:80,elL:0,shR:80,elR:0,hipL:95,knL:105,anL:30,hipR:95,knR:105,anR:30}},
 {label:'Come up to base',duration:600,ground:{joint:'ankleL',x:30},rel:{torso:510,neck:0,shL:50,elL:60,shR:50,elR:60,hipL:120,knL:125,anL:70,hipR:120,knR:125,anR:70}},
 {label:'Reset',duration:550,ground:{joint:'ankleL',x:56},rel:{torso:520}},
]};
