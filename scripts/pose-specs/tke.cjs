// Terminal knee extension: band behind the knee pulls it forward; squeeze the quad to straighten.
module.exports={key:'tke',title:'Terminal Knee Extension',props:[{type:'bar',x1:52,y1:70,x2:94,y2:70}],highlight:['kneeL'],frames:[
 {label:'Band pulls the knee forward',duration:800,anchor:{joint:'ankleL',x:50,y:90},abs:{torso:176,head:178,upperArmL:10,forearmL:20,upperArmR:-5,forearmR:5,thighL:28,shinL:-6,footL:90,thighR:-12,shinR:-30,footR:70}},
 {label:'Straighten fully, squeeze the quad',duration:900,hold:500,anchor:{joint:'ankleL',x:50,y:90},abs:{torso:180,head:180,thighL:1,shinL:-1}},
]};
