/* V931: one permission-aware options menu for slot cards in every workspace. */
(function(){
 'use strict';
 const selector='.mc-slot-card[data-slot-id],.scs-simple-slot-row[data-slot-id]';
 const checks=new Map(),pending=new WeakSet();
 let activeMenu=null,trigger=null,timer;
 function user(){return typeof authGetUser==='function'?authGetUser():null;}
 async function allowed(clubId,fresh=false){
  const account=user();if(!account?.id||!clubId)return false;
  const key=account.id+':'+clubId,old=checks.get(key);
  if(!fresh&&old&&Date.now()-old.time<30000)return old.promise;
  const promise=(async()=>{
   try{
    await window.SCSClubSport?.ensure(clubId);
    const [owned,grants]=await Promise.all([
     sbGet('clubs','id=eq.'+encodeURIComponent(clubId)+'&created_by=eq.'+encodeURIComponent(account.id)+'&select=id'),
     sbGet('user_club_roles','club_id=eq.'+encodeURIComponent(clubId)+'&user_account_id=eq.'+encodeURIComponent(account.id)+'&select=organiser_verified,vault_verified')
    ]);
    return !!owned?.length||!!grants?.some(g=>g.vault_verified===true||g.organiser_verified===true);
   }catch(_){return false;}
  })();checks.set(key,{time:Date.now(),promise});return promise;
 }
 function close(restoreFocus=false){
  activeMenu?.remove();activeMenu=null;
  if(trigger){trigger.setAttribute('aria-expanded','false');if(restoreFocus&&trigger.isConnected)trigger.focus();}trigger=null;
 }
 async function edit(slotId,clubId,button){
  button.disabled=true;
  try{
   if(!await allowed(clubId,true))throw Error('Log in to manage this club before editing its slots.');
   // Re-read the slot: card metadata never grants access to a different club.
   const rows=await sbGet('slots','id=eq.'+encodeURIComponent(slotId)+'&select=id,club_id');
   if(!rows?.[0]||String(rows[0].club_id)!==String(clubId))throw Error('This slot is unavailable. Refresh the page and try again.');
   const current=typeof getMyClub==='function'?getMyClub():null;
   if(String(current?.id||'')!==String(clubId)){
    const live=typeof getMySessionId==='function'&&getMySessionId();
    const unfinished=typeof allRounds!=='undefined'&&allRounds.length&&(typeof sessionFinished==='undefined'||!sessionFinished);
    if(live||unfinished)throw Error('End the current round session before switching clubs to edit this slot.');
    const clubs=await sbGet('clubs','id=eq.'+encodeURIComponent(clubId)+'&select=id,name,sport');
    if(!clubs?.[0])throw Error('Club unavailable in this sport app.');
    setMyClub(clubId,clubs[0].name);
    if(typeof syncRoundAndSlotManagerClub==='function')syncRoundAndSlotManagerClub(clubId,clubs[0].name);
   }
   close();
   await vaultSlotsViewSlot(slotId);
  }catch(error){alert(error.message||'Could not open the slot editor.');}
  finally{button.disabled=false;}
 }
 function open(button,slotId,clubId){
  if(trigger===button&&activeMenu){close();return;}
  close();trigger=button;button.setAttribute('aria-expanded','true');
  const menu=document.createElement('div');menu.className='scs-slot-options-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Slot options');
  const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitem');item.textContent='Edit';item.onclick=e=>{e.stopPropagation();edit(slotId,clubId,item);};menu.append(item);
  document.body.append(menu);activeMenu=menu;
  const rect=button.getBoundingClientRect(),width=menu.offsetWidth;
  menu.style.left=Math.max(8,Math.min(innerWidth-width-8,rect.right-width))+'px';
  menu.style.top=Math.max(8,Math.min(innerHeight-menu.offsetHeight-8,rect.bottom+6))+'px';item.focus();
 }
 async function attach(card){
  if(pending.has(card))return;
  const existing=card.querySelector(':scope > .scs-slot-options-pill, :scope > .mc-slot-card-head > .mc-slot-time-row > .scs-slot-options-pill');
  // An expanded simple row already contains a complete slot card/menu.
  if(card.matches('.scs-simple-slot-row')&&card.querySelector('.mc-slot-card')){existing?.remove();return;}
  const slotId=card.dataset.slotId,clubId=card.dataset.clubId,accountId=user()?.id;
  if(!slotId||!clubId||!accountId){existing?.remove();return;}
  pending.add(card);
  try{
   const canEdit=await allowed(clubId);
   if(!card.isConnected||user()?.id!==accountId)return;
   if(!canEdit){existing?.remove();return;}
   if(existing)return;
   const button=document.createElement('button');button.type='button';button.className='scs-slot-options-pill';button.textContent='⋯';button.setAttribute('aria-label','Slot options');button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
   button.onclick=event=>{event.preventDefault();event.stopPropagation();open(button,slotId,clubId);};
   const row=card.querySelector(':scope > .mc-slot-card-head > .mc-slot-time-row');
   if(row)row.insertBefore(button,row.querySelector('.mc-slot-chevron'));else card.append(button);
  }finally{pending.delete(card);}
 }
 function refresh(){document.querySelectorAll(selector).forEach(attach);if(trigger&&!trigger.isConnected)close();}
 function schedule(){clearTimeout(timer);timer=setTimeout(refresh,30);}
 function init(){refresh();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',event=>{if(activeMenu&&!activeMenu.contains(event.target)&&!trigger?.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(!activeMenu)return;if(event.key==='Escape'){event.preventDefault();close(true);}else if(event.key==='Tab')close();});
  window.addEventListener('resize',()=>close());window.addEventListener('storage',()=>{checks.clear();close();schedule();});
 }
 window.SCSSlotOptions=Object.freeze({refresh,allowed,close});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
