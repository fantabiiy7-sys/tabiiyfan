(function(){
var L=(new URLSearchParams(location.search).get('lang')||'uz');if(['uz','ru','en'].indexOf(L)<0)L='uz';
var UI={uz:{title:"Quyosh tizimi — sayyoralar orbitasi",speed:"Tezlik",alt:"Quyosh va sakkizta sayyora orbitalari",au:"Quyoshdan o‘rtacha masofa",unit:"astronomik birlik (Yer–Quyosh = 1)",order:"-sayyora",sun:"Quyosh",sunInfo:"Quyosh — yulduz. Quyosh tizimidagi barcha sayyoralar uning atrofida aylanadi.",pick:"Sayyorani tanlang",note:"Diqqat: orbitalar masofasi va o‘lchamlar masshtabga mos EMAS — faqat tartibni ko‘rsatadi. Namuna (demo) material."},
ru:{title:"Солнечная система — орбиты планет",speed:"Скорость",alt:"Солнце и орбиты восьми планет",au:"Среднее расстояние до Солнца",unit:"астрономических единиц (Земля–Солнце = 1)",order:"-я планета",sun:"Солнце",sunInfo:"Солнце — звезда. Все планеты Солнечной системы обращаются вокруг него.",pick:"Выберите планету",note:"Внимание: расстояния и размеры НЕ в масштабе — показан только порядок. Демонстрационный материал."},
en:{title:"The Solar System — planetary orbits",speed:"Speed",alt:"The Sun and the orbits of eight planets",au:"Average distance from the Sun",unit:"astronomical units (Earth–Sun = 1)",order:" planet from the Sun",sun:"The Sun",sunInfo:"The Sun is a star. All planets of the Solar System orbit around it.",pick:"Pick a planet",note:"Note: distances and sizes are NOT to scale — only the order is shown. Demo material."}}[L];
var P=[
 {id:'mercury',c:'#b5b5b5',r:4,au:0.4,per:88,n:{uz:'Merkuriy',ru:'Меркурий',en:'Mercury'},f:{uz:"Quyoshga eng yaqin sayyora va eng kichigi.",ru:"Ближайшая к Солнцу и самая маленькая планета.",en:"The closest planet to the Sun and the smallest."}},
 {id:'venus',c:'#e8c37a',r:7,au:0.7,per:225,n:{uz:'Venera',ru:'Венера',en:'Venus'},f:{uz:"Zich atmosferasi tufayli eng issiq sayyora.",ru:"Самая горячая планета из-за плотной атмосферы.",en:"The hottest planet because of its thick atmosphere."}},
 {id:'earth',c:'#3b82f6',r:7,au:1.0,per:365,n:{uz:'Yer',ru:'Земля',en:'Earth'},f:{uz:"Hozircha hayot ma’lum bo‘lgan yagona sayyora.",ru:"Единственная известная планета, где есть жизнь.",en:"The only planet currently known to have life."}},
 {id:'mars',c:'#d9633b',r:5,au:1.5,per:687,n:{uz:'Mars',ru:'Марс',en:'Mars'},f:{uz:"Sirtidagi temir oksidi tufayli qizg‘ish ko‘rinadi.",ru:"Выглядит красноватой из-за оксидов железа на поверхности.",en:"Looks reddish because of iron oxide on its surface."}},
 {id:'jupiter',c:'#d8a574',r:13,au:5.2,per:4333,n:{uz:'Yupiter',ru:'Юпитер',en:'Jupiter'},f:{uz:"Quyosh tizimidagi eng katta sayyora.",ru:"Самая большая планета Солнечной системы.",en:"The largest planet in the Solar System."}},
 {id:'saturn',c:'#e3cf94',r:11,au:9.6,per:10759,n:{uz:'Saturn',ru:'Сатурн',en:'Saturn'},f:{uz:"Atrofida ko‘zga yaqqol tashlanadigan halqalari bor.",ru:"Имеет хорошо заметные кольца.",en:"Has prominent rings around it."}},
 {id:'uranus',c:'#8fd3d9',r:9,au:19.2,per:30687,n:{uz:'Uran',ru:'Уран',en:'Uranus'},f:{uz:"O‘z o‘qi atrofida deyarli ‘yonboshlab’ aylanadi.",ru:"Вращается почти «лёжа на боку».",en:"Rotates almost ‘on its side’."}},
 {id:'neptune',c:'#4a63d6',r:9,au:30.1,per:60190,n:{uz:'Neptun',ru:'Нептун',en:'Neptune'},f:{uz:"Quyoshdan eng uzoq joylashgan sayyora.",ru:"Самая удалённая от Солнца планета.",en:"The planet farthest from the Sun."}}];
var $=function(i){return document.getElementById(i)};
$('title').textContent=UI.title;$('speedLabel').textContent=UI.speed;$('note').textContent=UI.note;$('sky').setAttribute('aria-label',UI.alt);
var cv=$('sky'),cx=cv.getContext('2d'),W=cv.width,H=cv.height,CX=W/2,CY=H/2,sel=-1,speed=1,t=0;
$('speed').addEventListener('input',function(){speed=+this.value});
var stars=[];for(var i=0;i<90;i++)stars.push([Math.random()*W,Math.random()*H,Math.random()*1.3+.3]);
// ko‘rsatish radiuslari (masshtab EMAS)
P.forEach(function(p,i){p.R=38+i*26;p.a=i*0.9});
function show(i){sel=i;[].forEach.call($('list').children,function(b,j){b.setAttribute('aria-pressed',String(j===i))});
 if(i<0){$('pname').textContent=UI.sun;$('pinfo').textContent=UI.sunInfo;return}
 var p=P[i];$('pname').textContent=(i+1)+UI.order+': '+p.n[L];$('pinfo').textContent=p.f[L]+' '+UI.au+': '+p.au+' '+UI.unit+'.'}
P.forEach(function(p,i){var b=document.createElement('button');b.type='button';b.textContent=p.n[L];b.setAttribute('aria-pressed','false');b.addEventListener('click',function(){show(sel===i?-1:i)});$('list').appendChild(b)});
$('pname').textContent=UI.pick;$('pinfo').textContent='';
cv.addEventListener('click',function(e){var r=cv.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height,best=-1,bd=18;
 P.forEach(function(p,i){var px=CX+Math.cos(p.a)*p.R*1.45,py=CY+Math.sin(p.a)*p.R*0.8,d=Math.hypot(px-x,py-y);if(d<bd+p.r){bd=d;best=i}});if(best>=0)show(best)});
function frame(){
 t++;cx.fillStyle='#0b1230';cx.fillRect(0,0,W,H);cx.fillStyle='#fff';stars.forEach(function(s){cx.globalAlpha=.5+.5*Math.sin(t/40+s[0]);cx.fillRect(s[0],s[1],s[2],s[2])});cx.globalAlpha=1;
 var g=cx.createRadialGradient(CX,CY,2,CX,CY,34);g.addColorStop(0,'#fff6b0');g.addColorStop(1,'#ffb300');cx.fillStyle=g;cx.beginPath();cx.arc(CX,CY,22,0,7);cx.fill();
 P.forEach(function(p,i){
  cx.strokeStyle=i===sel?'rgba(255,255,255,.7)':'rgba(255,255,255,.18)';cx.lineWidth=i===sel?2:1;cx.beginPath();cx.ellipse(CX,CY,p.R*1.45,p.R*0.8,0,0,7);cx.stroke();
  p.a+=speed*0.012*Math.pow(0.78,i);   // ichki sayyoralar tezroq (sifat jihatdan to‘g‘ri)
  var x=CX+Math.cos(p.a)*p.R*1.45,y=CY+Math.sin(p.a)*p.R*0.8;
  cx.fillStyle=p.c;cx.beginPath();cx.arc(x,y,p.r,0,7);cx.fill();
  if(p.id==='saturn'){cx.strokeStyle='#cdb97a';cx.lineWidth=2;cx.beginPath();cx.ellipse(x,y,p.r+7,3.5,-.3,0,7);cx.stroke()}
  if(i===sel){cx.strokeStyle='#ffd43b';cx.lineWidth=2;cx.beginPath();cx.arc(x,y,p.r+5,0,7);cx.stroke()}
  cx.fillStyle='rgba(255,255,255,.85)';cx.font='11px system-ui';cx.fillText(p.n[L],x+p.r+4,y-p.r)});
 requestAnimationFrame(frame)}
frame();
})();
