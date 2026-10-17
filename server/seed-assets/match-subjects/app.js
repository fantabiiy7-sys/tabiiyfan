(function(){
var L=(new URLSearchParams(location.search).get('lang')||'uz');if(['uz','ru','en'].indexOf(L)<0)L='uz';
var UI={uz:{title:"“Suv aylanishi” mavzusida fanlararo bog‘lanish",help:"Har bir faoliyatni tegishli fan maydoniga sudrab olib boring. Sichqoncha bo‘lmasa: faoliyatni tanlang, so‘ng “Shu yerga qo‘yish” tugmasini bosing.",check:"Tekshirish",reset:"Qayta boshlash",place:"Shu yerga qo‘yish",cards:"Faoliyatlar",res:function(a,b){return a+" / "+b+" to‘g‘ri"},all:"Barakalla! Hammasi to‘g‘ri.",note:"Munozara uchun namuna (demo) topshiriq: bir faoliyat bir nechta fanga bog‘liq bo‘lishi mumkin — sinfda muhokama qiling."},
ru:{title:"Межпредметные связи по теме «Круговорот воды»",help:"Перетащите каждое действие в нужную область предмета. Без мыши: выберите действие и нажмите «Поместить сюда».",check:"Проверить",reset:"Начать заново",place:"Поместить сюда",cards:"Действия",res:function(a,b){return a+" / "+b+" верно"},all:"Отлично! Всё верно.",note:"Демонстрационное задание для обсуждения: одно действие может относиться к нескольким предметам — обсудите в классе."},
en:{title:"Cross-subject links for “The water cycle”",help:"Drag each activity to the matching subject area. Without a mouse: select an activity, then press “Place here”.",check:"Check",reset:"Start over",place:"Place here",cards:"Activities",res:function(a,b){return a+" / "+b+" correct"},all:"Well done! All correct.",note:"A demo task for discussion: one activity can relate to several subjects — discuss in class."}}[L];
var SUBJ=[{id:'math',n:{uz:'Matematika',ru:'Математика',en:'Mathematics'}},{id:'geo',n:{uz:'Geografiya',ru:'География',en:'Geography'}},{id:'bio',n:{uz:'Biologiya',ru:'Биология',en:'Biology'}},{id:'it',n:{uz:'Informatika',ru:'Информатика',en:'Computer science'}}];
var ITEMS=[{id:1,s:'math',t:{uz:"Yer yuzasida suv egallagan ulushni foizda hisoblash",ru:"Вычислить долю поверхности Земли, занятую водой, в процентах",en:"Calculate the share of Earth's surface covered by water in percent"}},
{id:2,s:'geo',t:{uz:"Okean, dengiz va daryolarni xaritadan topish",ru:"Найти океаны, моря и реки на карте",en:"Find oceans, seas and rivers on a map"}},
{id:3,s:'bio',t:{uz:"O‘simliklar barglaridan suv bug‘lanishini kuzatish",ru:"Наблюдать испарение воды с листьев растений",en:"Observe water evaporating from plant leaves"}},
{id:4,s:'it',t:{uz:"Suv aylanishi sxemasini kompyuterda chizish",ru:"Нарисовать схему круговорота воды на компьютере",en:"Draw a water cycle diagram on a computer"}}];
var $=function(i){return document.getElementById(i)};
$('title').textContent=UI.title;$('help').textContent=UI.help;$('check').textContent=UI.check;$('reset').textContent=UI.reset;$('note').textContent=UI.note;
$('check').className='act';$('reset').className='act ghost';$('cards').setAttribute('aria-label',UI.cards);
var place={},selId=null,dragId=null;
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=(Math.random()*(i+1))|0,t=a[i];a[i]=a[j];a[j]=t}return a}
function card(it,checked){var b=document.createElement('button');b.type='button';b.className='card';b.draggable=true;b.textContent=it.t[L];b.setAttribute('aria-pressed',String(selId===it.id));
 if(checked&&place[it.id]){b.className+=place[it.id]===it.s?' ok':' bad'}
 b.addEventListener('click',function(){selId=selId===it.id?null:it.id;render()});
 b.addEventListener('dragstart',function(e){dragId=it.id;b.classList.add('dragging');try{e.dataTransfer.setData('text/plain',String(it.id))}catch(_){}});
 b.addEventListener('dragend',function(){b.classList.remove('dragging')});return b}
var order=shuffle(ITEMS);
function render(checked){
 var ul=$('cards');ul.innerHTML='';order.forEach(function(it){if(!place[it.id]){var li=document.createElement('li');li.appendChild(card(it,checked));ul.appendChild(li)}});
 var z=$('zones');z.innerHTML='';
 SUBJ.forEach(function(s){var d=document.createElement('div');d.className='zone';d.setAttribute('role','group');d.setAttribute('aria-label',s.n[L]);var h=document.createElement('h2');h.textContent=s.n[L];d.appendChild(h);
  ITEMS.forEach(function(it){if(place[it.id]===s.id)d.appendChild(card(it,checked))});
  var pb=document.createElement('button');pb.type='button';pb.className='zonebtn';pb.textContent=UI.place;pb.addEventListener('click',function(){if(selId){place[selId]=s.id;selId=null;$('result').textContent='';render()}});d.appendChild(pb);
  d.addEventListener('dragover',function(e){e.preventDefault();d.classList.add('over')});d.addEventListener('dragleave',function(){d.classList.remove('over')});
  d.addEventListener('drop',function(e){e.preventDefault();d.classList.remove('over');if(dragId){place[dragId]=s.id;dragId=null;selId=null;$('result').textContent='';render()}});
  z.appendChild(d)})}
$('check').addEventListener('click',function(){var ok=0;ITEMS.forEach(function(it){if(place[it.id]===it.s)ok++});render(true);$('result').textContent=ok===ITEMS.length?UI.all:UI.res(ok,ITEMS.length);$('result').style.color=ok===ITEMS.length?'#1c7c4a':'#b45309'});
$('reset').addEventListener('click',function(){place={};selId=null;order=shuffle(ITEMS);$('result').textContent='';render()});
render();
})();
