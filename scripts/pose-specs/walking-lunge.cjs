// Alternating lunges, one step forward each time (drawn in place, as the walk and run figures are): left leg forward, pass through, right leg forward, pass through.
const G={joint:'hip',x:48};
const arms={shL:0,elL:0,shR:0,elR:0};
const side=(f,b)=>{const o={};o['thigh'+f]=90;o['shin'+f]=0;o['foot'+f]=90;o['thigh'+b]=-5;o['shin'+b]=-105;o['foot'+b]=33;return o;};
const push=(f,b)=>{const o={};o['thigh'+f]=40;o['shin'+f]=8;o['foot'+f]=90;o['thigh'+b]=-12;o['shin'+b]=-62;o['foot'+b]=40;return o;};
const thru=(s,sw)=>{const o={};o['thigh'+s]=5;o['shin'+s]=0;o['foot'+s]=90;o['thigh'+sw]=55;o['shin'+sw]=-15;o['foot'+sw]=70;return o;};
const land=(f,b)=>{const o={};o['thigh'+f]=45;o['shin'+f]=5;o['foot'+f]=90;o['thigh'+b]=-14;o['shin'+b]=-52;o['foot'+b]=58;return o;};
const F=(label,abs,hold,dur)=>({label,duration:dur||350,hold:hold||0,ground:G,useRoot:true,abs});
module.exports={key:'walking-lunge',title:'Walking Lunge',highlight:['kneeL','kneeR','hipL'],frames:[
 {...F('Left leg forward, back knee near the floor',side('L','R'),300,600),rel:{torso:180,neck:0,...arms}},
 F('Push up, back foot leaves the floor',push('L','R')),
 F('Bring the back leg through',thru('L','R')),
 F('Step into the right leg',land('R','L')),
 F('Right leg forward',side('R','L'),300,600),
 F('Push up, back foot leaves the floor',push('R','L')),
 F('Bring the back leg through',thru('R','L')),
 F('Step into the left leg',land('L','R')),
]};
