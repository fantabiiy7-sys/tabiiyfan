(function(){
var L=(new URLSearchParams(location.search).get('lang')||'uz'); if(['uz','ru','en'].indexOf(L)<0)L='uz';
var T={
 uz:{title:"Suv aylanishi — interaktiv model",heat:"Quyosh issiqligi",pause:"To‘xtatish",play:"Davom ettirish",alt:"Suv aylanishi animatsiyasi: dengiz, tog‘, bulut va yomg‘ir",
  stages:["Bug‘lanish","Kondensatsiya","Yog‘in","Oqim"],
  info:["Quyosh issiqligi dengiz va ko‘llardagi suvni suv bug‘iga aylantiradi. Issiqlik qancha ko‘p bo‘lsa, bug‘lanish shuncha tez.","Yuqorida havo sovuydi: suv bug‘i mayda suv tomchilariga aylanib, bulut hosil qiladi.","Bulutdagi tomchilar yiriklashib, yomg‘ir yoki qor ko‘rinishida yerga tushadi.","Yog‘in suvi daryo va soylar bo‘ylab oqib, yana dengizga qaytadi — aylanish davom etadi."],
  hint:"Bosqichni tanlang yoki animatsiyani kuzating.",note:"Soddalashtirilgan model: haqiqiy jarayon ancha murakkab. Namuna (demo) material."},
 ru:{title:"Круговорот воды — интерактивная модель",heat:"Тепло Солнца",pause:"Пауза",play:"Продолжить",alt:"Анимация круговорота воды: море, гора, облако и дождь",
  stages:["Испарение","Конденсация","Осадки","Сток"],
  info:["Тепло Солнца превращает воду морей и озёр в водяной пар. Чем больше тепла, тем быстрее испарение.","Наверху воздух остывает: водяной пар превращается в мельчайшие капли и образует облака.","Капли в облаке укрупняются и падают на землю дождём или снегом.","Вода стекает по рекам и ручьям обратно в море — круговорот продолжается."],
  hint:"Выберите этап или понаблюдайте за анимацией.",note:"Упрощённая модель: реальный процесс сложнее. Демонстрационный материал."},
 en:{title:"The water cycle — interactive model",heat:"Sun's heat",pause:"Pause",play:"Resume",alt:"Water cycle animation: sea, mountain, cloud and rain",
  stages:["Evaporation","Condensation","Precipitation","Runoff"],
  info:["The Sun's heat turns water from seas and lakes into water vapour. More heat means faster evaporation.","Higher up the air cools: water vapour turns into tiny droplets and forms clouds.","Droplets in the cloud grow and fall to the ground as rain or snow.","Water flows along rivers and streams back to the sea — the cycle continues."],
  hint:"Pick a stage or just watch the animation.",note:"A simplified model: the real process is more complex. Demo material."}
}[L];
var $=function(id){return document.getElementById(id)};
$('title').textContent=T.title;$('heatLabel').textContent=T.heat;$('note').textContent=T.note;$('info').textContent=T.hint;
$('scene').setAttribute('aria-label',T.alt);
var cv=$('scene'),cx=cv.getContext('2d'),W=cv.width,H=cv.height;
var heat=2,paused=false,sel=-1,rain=0,cloud=0;
var vapor=[],drops=[],flow=[];
var seaY=250,mtnX=470;
$('pause').textContent=T.pause;
$('pause').addEventListener('click',function(){paused=!paused;this.textContent=paused?T.play:T.pause});
$('heat').addEventListener('input',function(){heat=+this.value;$('heatOut').textContent=heat});
var box=$('stages');
T.stages.forEach(function(n,i){var b=document.createElement('button');b.type='button';b.textContent=(i+1)+'. '+n;b.setAttribute('aria-pressed','false');
 b.addEventListener('click',function(){sel=(sel===i)?-1:i;[].forEach.call(box.children,function(c,j){c.setAttribute('aria-pressed',String(j===sel))});$('info').textContent=sel<0?T.hint:T.info[sel]});box.appendChild(b)});
function mtnY(x){if(x<mtnX-190)return seaY-5;if(x<mtnX)return seaY-5-(x-(mtnX-190))*0.55;return 0}
function frame(){
 if(!paused){
  if(Math.random()<0.12*heat)vapor.push({x:30+Math.random()*300,y:seaY,s:0.4+Math.random()*0.5*heat});
  vapor.forEach(function(v){v.y-=v.s;v.x+=0.25+Math.sin(v.y/20)*0.15});
  vapor=vapor.filter(function(v){if(v.y<95){cloud=Math.min(1,cloud+0.0035);return false}return true});
  if(cloud>0.7){rain=1;if(Math.random()<0.5)drops.push({x:330+Math.random()*190,y:105,v:2+Math.random()*1.5});cloud-=0.0042}else if(cloud<0.2)rain=0;
  drops.forEach(function(d){d.y+=d.v});
  drops=drops.filter(function(d){if(d.y>=((d.x>mtnX-190&&d.x<mtnX)?mtnY(d.x):seaY)){if(d.x>mtnX-190&&d.x<mtnX)flow.push({x:d.x,y:mtnY(d.x)});return false}return true});
  flow.forEach(function(f){f.x-=1.1;f.y=f.x>mtnX-190?mtnY(f.x):seaY-4});
  flow=flow.filter(function(f){return f.x>200});
 }
 draw();requestAnimationFrame(frame)}
function draw(){
 var g=cx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#bfe3ff');g.addColorStop(1,'#eaf6ff');cx.fillStyle=g;cx.fillRect(0,0,W,H);
 cx.fillStyle='#ffc933';cx.beginPath();cx.arc(80,60,22+heat*3,0,7);cx.fill();
 cx.strokeStyle='#ffc933';cx.lineWidth=2;for(var i=0;i<10;i++){var a=i*Math.PI/5;cx.beginPath();cx.moveTo(80+Math.cos(a)*(30+heat*3),60+Math.sin(a)*(30+heat*3));cx.lineTo(80+Math.cos(a)*(40+heat*5),60+Math.sin(a)*(40+heat*5));cx.stroke()}
 cx.fillStyle='#7c8f6b';cx.beginPath();cx.moveTo(mtnX-190,seaY-5);cx.lineTo(mtnX,mtnY(mtnX-1)||seaY-5-190*0.55);cx.lineTo(mtnX+170,seaY-5);cx.lineTo(W,seaY-5);cx.lineTo(W,H);cx.lineTo(0,H);cx.fill();
 cx.fillStyle='#eef3f8';cx.beginPath();cx.moveTo(mtnX-30,seaY-5-160*0.55-14);cx.lineTo(mtnX,seaY-5-190*0.55);cx.lineTo(mtnX+25,seaY-5-190*0.55+22);cx.fill();
 cx.fillStyle='#2f86d6';cx.fillRect(0,seaY,mtnX-190+10,H-seaY);
 cx.fillStyle='rgba(255,255,255,.35)';for(var w=0;w<8;w++){cx.fillRect((w*43+(Date.now()/60)%43)%(mtnX-190),seaY+12+(w%3)*18,22,2)}
 var cs=0.55+cloud*0.6;cx.fillStyle='rgba('+(255-Math.round(cloud*90))+','+(255-Math.round(cloud*90))+','+(255-Math.round(cloud*70))+',.96)';
 [[400,82,38],[440,70,46],[485,84,36],[435,92,40]].forEach(function(c){cx.beginPath();cx.arc(c[0],c[1],c[2]*cs,0,7);cx.fill()});
 cx.fillStyle='rgba(255,255,255,.85)';vapor.forEach(function(v){cx.beginPath();cx.arc(v.x,v.y,2.2,0,7);cx.fill()});
 cx.fillStyle='#1f6fd0';drops.forEach(function(d){cx.fillRect(d.x,d.y,2,8)});
 cx.fillStyle='#2f86d6';flow.forEach(function(f){cx.beginPath();cx.arc(f.x,f.y,2.4,0,7);cx.fill()});
 if(sel>=0){cx.strokeStyle='#d6336c';cx.lineWidth=3;cx.setLineDash([8,5]);
  var r=[[20,120,330,130],[340,25,190,110],[340,100,190,150],[mtnX-190,seaY-135,200,140]][sel];cx.strokeRect(r[0],r[1],r[2],r[3]);cx.setLineDash([])}
}
frame();
})();
