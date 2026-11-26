/* V934: standalone installable entry; reuse the existing scoring module unchanged. */
(function(){
 'use strict';
 if(window.SCSSportContext?.appModule!=='scoreboard')return;
 let loadId=0;
 function account(){return typeof authGetUser==='function'?authGetUser():null;}
 function selected(){return localStorage.getItem('scsPreferredSport')==='pickleball'?'pickleball':'badminton';}
 function hide(){const home=document.getElementById('scsScoreboardAppHome');if(home)home.hidden=true;if(window.scsRefreshPracticeHeader)window.scsRefreshPracticeHeader();}
 async function clubs(select,status){
  const serial=++loadId,user=account();select.replaceChildren(new Option('No club — enter player names',''));status.textContent='';
  if(!user?.id)return;
  try{
   const [members,grants,owned]=await Promise.all([
    sbGet('memberships','user_account_id=eq.'+encodeURIComponent(user.id)+'&select=club_id'),
    sbGet('user_club_roles','user_account_id=eq.'+encodeURIComponent(user.id)+'&select=club_id,organiser_verified,vault_verified').catch(()=>[]),
    sbGet('clubs','created_by=eq.'+encodeURIComponent(user.id)+'&select=id,name,sport')
   ]);
   const ids=[...new Set([...members.map(r=>r.club_id),...grants.filter(r=>r.organiser_verified||r.vault_verified).map(r=>r.club_id),...owned.map(r=>r.id)].filter(Boolean))];
   const rows=ids.length?await sbGet('clubs','id=in.('+ids.map(encodeURIComponent).join(',')+')&select=id,name,sport&order=name.asc'):[];
   if(serial!==loadId||account()?.id!==user.id)return;
   for(const club of rows)select.append(new Option(club.name,club.id));
   const current=typeof getMyClub==='function'?getMyClub():null;
   if(current?.id&&rows.some(c=>String(c.id)===String(current.id)))select.value=current.id;
   else if(current?.id&&typeof clearMyClub==='function')clearMyClub();
  }catch(error){if(serial===loadId)status.textContent='Could not load clubs. You can still enter player names.';}
 }
 async function openScores(){
  if(!account()){hide();authShowScreen('login');return;}
  if(typeof canAccessMode==='function'&&!canAccessMode('viewer')){if(typeof showUpgradeScreen==='function')showUpgradeScreen();return;}
  const select=document.getElementById('scsScoreboardClub');
  if(select?.value)setMyClub(select.value,select.selectedOptions[0].textContent);else clearMyClub();
  hide();await SCSScoring.open({workspace:'member',onClose:showHome});
 }
 async function showHome(){
  if(!account()){hide();if(typeof authShowScreen==='function')authShowScreen('welcome');return;}
  ['scsRoleWorkspaceChooser','modeSelectOverlay','homePageOverlay'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  let home=document.getElementById('scsScoreboardAppHome');
  if(!home){
   home=document.createElement('section');home.id='scsScoreboardAppHome';home.setAttribute('aria-label','SCS Scoreboard');
   home.innerHTML='<header><h1>SCS Scoreboard</h1><button type="button" data-score-logout>Logout</button></header><img class="scs-scoreboard-app-icon" src="scoreboard/icon-192.png?v=V940" alt=""><h2>Score a Match</h2><p>Choose your sport and use the existing scoreboard.</p><div class="scs-scoreboard-sports" role="group" aria-label="Sport"><button type="button" data-score-sport="badminton">Badminton</button><button type="button" data-score-sport="pickleball">Pickleball</button></div><label for="scsScoreboardClub">Club <span>(optional)</span></label><select id="scsScoreboardClub"></select><p class="scs-scoreboard-app-status" role="status"></p><button type="button" class="scs-scoreboard-open">Open Scoreboard</button>';
   document.body.append(home);
   home.querySelector('[data-score-logout]').onclick=()=>{hide();authLogout();authShowScreen('welcome');};
   home.querySelector('.scs-scoreboard-open').onclick=()=>openScores().catch(error=>alert(error.message));
   home.querySelector('select').onchange=event=>{const select=event.target;if(select.value)setMyClub(select.value,select.selectedOptions[0].textContent);else clearMyClub();};
   home.querySelectorAll('[data-score-sport]').forEach(button=>button.onclick=()=>{
    if(selected()===button.dataset.scoreSport)return;
    clearMyClub();SCSSportTheme.setSport(button.dataset.scoreSport);showHome();
   });
  }
  home.hidden=false;
  if(window.scsRefreshPracticeHeader)window.scsRefreshPracticeHeader();
  updateHomeTop();
  home.querySelectorAll('[data-score-sport]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scoreSport===selected())));
  await clubs(home.querySelector('select'),home.querySelector('[role="status"]'));
 }
 function updateHomeTop(){const home=document.getElementById('scsScoreboardAppHome'),header=document.getElementById('scsPracticeSharedHeader');if(home&&!home.hidden&&header&&!header.hidden)home.style.top=Math.ceil(header.getBoundingClientRect().bottom)+'px';}
 window.addEventListener('resize',updateHomeTop);
 const sharedHeader=document.getElementById('scsPracticeSharedHeader');if(sharedHeader&&typeof ResizeObserver==='function')new ResizeObserver(updateHomeTop).observe(sharedHeader);
 window.SCSScoreboardApp=Object.freeze({showHome,open:openScores,hide});
})();
