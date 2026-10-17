(function(){
var L=(new URLSearchParams(location.search).get('lang')||'uz');if(['uz','ru','en'].indexOf(L)<0)L='uz';
var T={uz:{title:"Moddaning agregat holatlari (suv)",temp:"Harorat",alt:"Idish ichidagi zarralar: harorat o‘zgarganda holat o‘zgaradi",s:["Qattiq (muz)","Suyuq (suv)","Gaz (suv bug‘i)"],
 d:["Zarralar tartib bilan joylashgan va faqat o‘z joyida tebranadi.","Zarralar bir-biriga yaqin, lekin erkin siljiydi — modda idish shaklini oladi.","Zarralar bir-biridan uzoq va tez harakatlanadi — gaz butun idishni egallaydi."],
 lg:["0 °C — muz erishi/suv muzlashi (normal atmosfera bosimida)","100 °C — suvning qaynashi (normal atmosfera bosimida)","Harorat oshsa, zarralar tezroq harakatlanadi"],
 note:"Soddalashtirilgan model: zarralar soni kam, o‘tishlar bosqichma-bosqich emas. Namuna (demo) material."},
ru:{title:"Агрегатные состояния вещества (вода)",temp:"Температура",alt:"Частицы в сосуде: при изменении температуры меняется состояние",s:["Твёрдое (лёд)","Жидкое (вода)","Газ (водяной пар)"],
 d:["Частицы расположены упорядоченно и лишь колеблются на месте.","Частицы близко друг к другу, но свободно перемещаются — вещество принимает форму сосуда.","Частицы далеко друг от друга и движутся быстро — газ занимает весь сосуд."],
 lg:["0 °C — плавление льда / замерзание воды (при нормальном атмосферном давлении)","100 °C — кипение воды (при нормальном атмосферном давлении)","С ростом температуры частицы движутся быстрее"],
 note:"Упрощённая модель: частиц мало, переходы не постепенные. Демонстрационный материал."},
en:{title:"States of matter (water)",temp:"Temperature",alt:"Particles in a container: the state changes as temperature changes",s:["Solid (ice)","Liquid (water)","Gas (water vapour)"],
 d:["Particles are arranged in order and only vibrate in place.","Particles are close together but slide past each other — the substance takes the shape of its container.","Particles are far apart and move fast — gas fills the whole container."],
 lg:["0 °C — ice melts / water freezes (at normal atmospheric pressure)","100 °C — water boils (at normal atmospheric pressure)","Higher temperature means faster particles"],
 note:"A simplified model: few particles, transitions are not gradual. Demo material."}}[L];
var $=function(i){return document.getElementById(i)};
$('title').textContent=T.title;$('tl').textContent=T.temp;$('note').textContent=T.note;$('box').setAttribute('aria-label',T.alt);
T.lg.forEach(function(x){var li=document.createElement('li');li.textContent=x;$('legend').appendChild(li)});
var cv=$('box'),cx=cv.getContext('2d'),W=cv.width,H=cv.height,temp=20,N=36,ps=[];
var colors=['#2f7fd1','#1d5fbf','#c2410c'],bg=['#e8f3ff','#dbeafe','#fff4e6'];
for(var i=0;i<N;i++){var c=i%6,r=(i/6)|0;ps.push({hx:70+c*44,hy:H-40-r*38,x:70+c*44,y:H-40-r*38,vx:0,vy:0})}
function state(){return temp<=0?0:(temp<100?1:2)}
$('temp').addEventListener('input',function(){temp=+this.value;$('tOut').textContent=temp});
function frame(){
 var s=state(),sp=0.4+Math.max(0,temp+20)/140*3.2,floor=H-14;
 cx.fillStyle=bg[s];cx.fillRect(0,0,W,H);
 ps.forEach(function(p,i){
  if(s===0){p.x+=(p.hx-p.x)*0.15+(Math.random()-.5)*0.6;p.y+=(p.hy-p.y)*0.15+(Math.random()-.5)*0.6;p.vx=(Math.random()-.5)*2;p.vy=(Math.random()-.5)*2}
  else if(s===1){p.vx+=(Math.random()-.5)*0.6;p.vy+=(Math.random()-.5)*0.6+0.09;var m=Math.hypot(p.vx,p.vy)||1,lim=sp*1.1;if(m>lim){p.vx*=lim/m;p.vy*=lim/m}
   p.x+=p.vx;p.y+=p.vy;if(p.y<H*0.45){p.vy+=0.25}}
  else{var m2=Math.hypot(p.vx,p.vy);if(m2<sp){p.vx+=(Math.random()-.5)*2;p.vy+=(Math.random()-.5)*2}var mm=Math.hypot(p.vx,p.vy)||1;p.vx*=Math.min(1,sp*1.6/mm)*1.0;p.vy*=Math.min(1,sp*1.6/mm)*1.0;p.x+=p.vx;p.y+=p.vy}
  if(p.x<10){p.x=10;p.vx=Math.abs(p.vx)}if(p.x>W-10){p.x=W-10;p.vx=-Math.abs(p.vx)}
  if(p.y<10){p.y=10;p.vy=Math.abs(p.vy)}if(p.y>floor){p.y=floor;p.vy=-Math.abs(p.vy)*0.6}
  cx.fillStyle=colors[s];cx.beginPath();cx.arc(p.x,p.y,8,0,7);cx.fill();cx.fillStyle='rgba(255,255,255,.55)';cx.beginPath();cx.arc(p.x-2.5,p.y-2.5,2.4,0,7);cx.fill()});
 $('state').textContent=T.s[s];$('state').style.background=colors[s];$('desc').textContent=T.d[s];
 requestAnimationFrame(frame)}
frame();
})();
