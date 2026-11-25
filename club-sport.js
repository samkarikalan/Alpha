/* V922 stage 1: sport labels and one-time owner assignment. */
(function(){
 'use strict';
 const valid=sport=>sport==='badminton'||sport==='pickleball';
 function current(){return (window.SCSSportContext?.sport||document.documentElement.dataset.scsSport)==='pickleball'?'pickleball':'badminton';}
 function label(sport){return sport==='pickleball'?'Pickleball':sport==='badminton'?'Badminton':'Sport not assigned';}
 async function assign(id,sport){
  if(!valid(sport))throw Error('Choose Badminton or Pickleball.');
  const u=typeof authGetUser==='function'?authGetUser():null,token=typeof _getLocalToken==='function'?_getLocalToken():null;
  if(!u?.id||!token)throw Error('Please sign in again to assign the club sport.');
  const res=await fetch(WORKER_URL+'/club/sport',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clubId:id,sport,userAccountId:u.id,sessionToken:token})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Could not assign the club sport.');
  return data;
 }
 function decorate(container,clubs,ownedIds){
  if(!container)return;
  const byId=new Map(clubs.map(c=>[String(c.id),c]));
  container.querySelectorAll('.jc-club-item[data-cid]').forEach(card=>{
   card.querySelectorAll('.scs-club-sport').forEach(el=>el.remove());
   const club=byId.get(String(card.dataset.cid));if(!club)return;
   const host=card.querySelector('.jc-club-info');if(!host)return;
   const group=document.createElement('div');group.className='scs-club-sport';
   const tag=document.createElement('span');tag.className='scs-club-sport-tag';tag.dataset.sport=club.sport||'';tag.textContent=label(club.sport);group.append(tag);
   if(!valid(club.sport)&&ownedIds.has(String(club.id))&&!club.parent_club_id){
    const help=document.createElement('small');help.textContent='Choose once for this club and its sub-clubs.';group.append(help);
    const choices=document.createElement('div');choices.className='scs-club-sport-choices';
    for(const sport of ['badminton','pickleball']){
     const button=document.createElement('button');button.type='button';button.textContent=label(sport);button.dataset.sport=sport;button.setAttribute('aria-label','Assign '+label(sport)+' to '+club.name);
     button.onclick=async event=>{
      event.stopPropagation();choices.querySelectorAll('button').forEach(b=>b.disabled=true);help.textContent='Saving sport…';
      try{
       const result=await assign(club.id,sport);club.sport=result.sport;tag.textContent=label(result.sport);tag.dataset.sport=result.sport;
       choices.remove();help.remove();localStorage.removeItem('kbrr_cache_timestamp');
       if(typeof _renderMyClubsList==='function')await _renderMyClubsList();
      }catch(e){help.textContent=e.message;choices.querySelectorAll('button').forEach(b=>b.disabled=false);}
     };choices.append(button);
    }group.append(choices);
   }else if(!valid(club.sport)&&club.parent_club_id){const help=document.createElement('small');help.textContent='Assign the sport on the main club.';group.append(help);}
   group.addEventListener('click',event=>event.stopPropagation());host.append(group);
  });
 }
 function remember(clubs){
  let saved={};try{saved=JSON.parse(localStorage.getItem('scsClubSportTags')||'{}');}catch(_){}
  for(const club of clubs||[])if(club?.id&&valid(club.sport))saved[String(club.id)]=club.sport;
  localStorage.setItem('scsClubSportTags',JSON.stringify(saved));
 }
 function cached(id){try{return JSON.parse(localStorage.getItem('scsClubSportTags')||'{}')[String(id)];}catch(_){return null;}}
 function assertKnown(id){const sport=cached(id);if(window.SCSSportContext?.appModule==='tournaments'){if(valid(sport))window.SCSSportTheme?.setSport(sport);return;}if(sport&&sport!==current())throw Error('This club is '+label(sport)+'. Open the '+label(sport)+' app to use it.');}
 async function ensure(id){
  if(!id)return;
  let sport=cached(id);
  if(!sport){
   if(navigator.onLine===false)throw Error('Connect once to verify this club’s sport before using it for rounds.');
   const clubs=await sbGet('clubs','id=eq.'+encodeURIComponent(id)+'&select=id,name,sport');
   sport=clubs?.[0]?.sport;if(valid(sport))remember(clubs);
  }
  if(!valid(sport)||(window.SCSSportContext?.appModule!=='tournaments'&&sport!==current()))throw Error('Choose a '+label(current())+' club in My Clubs before starting rounds.');
 }
 async function ensureRound(){
  const quick=window.scsRoundPlayerSource?.getMode?.()==='guest'||window.SCSRoundStorage?.isQuick?.();
  const demo=typeof isDemoMode==='function'&&isDemoMode();
  if(quick||demo)return;
  const club=typeof getMyClub==='function'?getMyClub():null;
  if(club?.id)await ensure(club.id);
  let active;try{active=JSON.parse(localStorage.getItem('scsRoundStorageSession')||'null');}catch(_){}
  if(active?.clubId&&active.clubId!==club?.id)await ensure(active.clubId);
 }
 window.SCSClubSport=Object.freeze({current,label,assign,decorate,remember,cached,assertKnown,ensure,ensureRound});
})();
