// The body stays one straight line from the feet on the wall to the hands; the hands walk in as the feet climb.
const line=(fx,fy,nx)=>{const dx=nx-fx,dy=61-fy;const a=Math.atan2(dx,dy)*180/Math.PI;return a;};
const fr=(label,fx,fy,dur,foot)=>{const L=Math.sqrt(70*70-(61-fy)**2);const nx=fx+L;const a=line(fx,fy,nx);
 return {label,duration:dur,anchor:{joint:'handL',x:Math.round(nx*10)/10,y:90},abs:{torso:a,head:a+8,upperArmL:0,forearmL:0,upperArmR:0,forearmR:0,thighL:a-180,shinL:a-180,footL:foot,thighR:a-180,shinR:a-180,footR:foot}};};
module.exports={key:'wall-walk',title:'Wall Walk',props:[{type:'wall',x:7}],highlight:['shoulderL','spine'],frames:[
 fr('Plank, feet at the wall',16,84,900,-12),
 fr('Feet step up the wall',16,30,900,-90),
 fr('Hands walk in',16,4,900,-90),
 fr('Chest to the wall, nearly vertical',16,-8,1100,-82),
 fr('Walk back down',16,30,900,-90),
]};
