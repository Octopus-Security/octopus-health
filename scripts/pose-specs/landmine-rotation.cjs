// Seen from the front: arms straight, hands together on the end of the landmine bar at chest height; swing it hip to hip, turning the whole body with it.
const arms=(a)=>({upperArmL:a,forearmL:a,upperArmR:a,forearmR:a});
module.exports={key:'landmine-rotation',title:'Landmine Rotation',view:'front',highlight:['spine','shoulderL','shoulderR'],frames:[
 {label:'Bar out to one side, feet planted',duration:900,hold:300,root:{x:50,y:53},abs:{torso:180,head:180,...arms(70),thighL:20,shinL:10,footL:90,thighR:-20,shinR:-10,footR:-90}},
 {label:'Swing across, hips and shoulders turn together',duration:900,hold:300,abs:{...arms(-70)}},
]};
