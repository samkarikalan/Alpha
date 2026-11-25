/* V874: one saved sport preference drives the app shell in both themes. */
(function(){
'use strict';
const key='scsPreferredSport',root=document.documentElement;
function selected(){try{return localStorage.getItem(key)==='pickleball'?'pickleball':'badminton';}catch(_){return 'badminton';}}
function refreshChrome(){
 const pickle=root.dataset.scsSport==='pickleball';
 let meta=document.querySelector('meta[name="theme-color"]');if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta);}
 meta.content=pickle?'#0B4033':'#0D2D59';
}
function refreshBrand(){
 const pickle=root.dataset.scsSport==='pickleball';
 const name=window.SCSSportContext?.appModule==='tournaments'?'SCS Tournaments':window.SCSSportContext?.appModule==='scoreboard'?'SCS Scoreboard':window.SCSSportContext?.locked?(pickle?'SCS Pickleball':'SCS Badminton'):(pickle?'SCS-Pickleball Club':'SCS-Badminton');
 document.querySelectorAll('[data-scs-sport-brand]').forEach(element=>{element.textContent=name;});
 document.title=name;
}
function refreshDefaultClub(){
 if(['scoreboard','tournaments'].includes(window.SCSSportContext?.appModule))return;
 const pickle=root.dataset.scsSport==='pickleball';
 const target=pickle
  ?{id:'fa58d533-aa61-4747-9968-0321ef1fee19',name:'SCS-Pickleball'}
  :{id:'8415987c-6aee-4938-a5e3-a7c8cdeba534',name:'SCS-Badminton'};
 const defaults=new Set(['','3cd43bd7-089f-4893-9f7a-8c2ce6fa408d','8415987c-6aee-4938-a5e3-a7c8cdeba534','fa58d533-aa61-4747-9968-0321ef1fee19']);
 try{
  const current=localStorage.getItem('kbrr_my_club_id')||'';
  if(!defaults.has(current))return;
  localStorage.setItem('kbrr_my_club_id',target.id);
  localStorage.setItem('kbrr_my_club_name',target.name);
  const central=document.getElementById('scsCentralClubName');if(central)central.textContent=target.name;
  const name=document.getElementById('scsSharedClubName');if(name)name.textContent=target.name;
  const activity=document.getElementById('scsClubActivityClubName');if(activity)activity.textContent=target.name;
 }catch(_){}
}
function apply(sport){
 const value=window.SCSSportContext?.sport||(sport==='pickleball'?'pickleball':'badminton');root.dataset.scsSport=value;
 document.querySelectorAll('button[data-scs-sport]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scsSport===value)));
 refreshChrome();refreshBrand();refreshDefaultClub();return value;
}
window.SCSSportTheme=Object.freeze({setSport(sport){const value=apply(sport);try{localStorage.setItem(key,value);}catch(_){}window.dispatchEvent(new CustomEvent('scs-sport-theme-change',{detail:{sport:value}}));},refresh(){apply(selected());}});
apply(selected());
new MutationObserver(refreshChrome).observe(root,{attributes:true,attributeFilter:['class']});
window.addEventListener('storage',event=>{if(!event.key||event.key===key)apply(selected());});
window.addEventListener('pageshow',()=>apply(selected()));
})();
