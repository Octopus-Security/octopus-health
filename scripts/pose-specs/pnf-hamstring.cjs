// PNF contract-relax on the back: the straight leg is raised to a first stretch (strap or hands behind
// the thigh), pressed into the strap for ~6 s with the leg barely moving, relaxed, then drawn higher.
const legs=(a)=>({thighL:a,shinL:a,footL:a+80});
module.exports={key:'pnf-hamstring',title:'PNF Hamstring Contract-Relax',highlight:['kneeL','hipL'],frames:[
 {label:'Raise the straight leg to a first stretch',duration:1400,hold:600,root:{x:54,y:87},abs:{torso:-90,head:-88,upperArmL:118,forearmL:122,upperArmR:116,forearmR:120,...legs(158),thighR:90,shinR:90,footR:180}},
 {label:'Contract: press the heel down into the strap, 6 s',duration:500,hold:2000,highlight:['hipL','kneeL','ankleL'],root:{x:54,y:87},abs:{upperArmL:124,forearmL:128,upperArmR:122,forearmR:126,...legs(152)}},
 {label:'Relax, breathe out, draw the leg higher',duration:1600,hold:1800,root:{x:54,y:87},abs:{upperArmL:130,forearmL:134,upperArmR:128,forearmR:132,...legs(180)}},
]};
