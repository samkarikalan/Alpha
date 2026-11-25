/* V907: round storage and temporary network pause during active Local rounds. */
(function(){
 'use strict';
 const ACTIVE='scsRoundStorageSession';
 let timer;
 function read(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}}
 function owner(){
  const user=typeof authGetUser==='function'?authGetUser():read('auth_user');
  const club=typeof getMyClub==='function'?getMyClub():null;
  return {userId:String(user?.id||user?.email||''),clubId:String(club?.id||localStorage.getItem('kbrr_my_club_id')||'')};
 }
 function prefKey(){const scope=owner();return 'scsRoundStoragePreference:'+scope.userId+':'+scope.clubId;}
 function preference(){return localStorage.getItem(prefKey())==='local'?'local':'normal';}
 function session(){return read(ACTIVE);}
 function isQuick(){return !!session()?.quick||window.scsRoundPlayerSource?.getMode?.()==='guest'||!!window.SCSRoundAssistantTemporary;}
 function isLocal(){return isQuick()||session()?.mode==='local';}
 function networkPaused(){return isLocal()&&typeof currentState!=='undefined'&&currentState==='active';}
 // Hold requests rather than returning empty data or creating offline upload jobs.
 // A shared waiter prevents background pollers from adding separate polling timers.
 let networkWaiter=null;
 function waitForNetwork(){
  if(!networkPaused())return Promise.resolve();
  if(!networkWaiter)networkWaiter=new Promise(resolve=>{
   const poll=setInterval(()=>{
    if(networkPaused())return;
    clearInterval(poll);networkWaiter=null;resolve();
   },250);
  });
  return networkWaiter;
 }
 function locked(){
  const saved=read('kbrr_snapshot'),scope=owner();
  const savedHere=!window.__scsRecoveryEnded&&saved?.userId===scope.userId&&(!saved.clubId||!scope.clubId||String(saved.clubId)===scope.clubId)&&Array.isArray(saved.allRounds)&&saved.allRounds.length>0;
  return savedHere|| (typeof currentState!=='undefined'&&currentState==='active')||
   (typeof allRounds!=='undefined'&&allRounds.length>0&&!(typeof sessionFinished!=='undefined'&&sessionFinished))||
   localStorage.getItem('scsOfflineRoundSessionInProgress')==='1'||
   !!(sessionStorage.getItem('kbrr_session_db_id')||localStorage.getItem('kbrr_session_id_persist'));
 }
 function notice(text){if(typeof showToast==='function')showToast(text);else window.alert(text);}
 function setMode(mode){
  mode=mode==='local'?'local':'normal';
  if(isQuick()&&mode!=='local'){notice('Quick Mode saves on this device only.');sync();return false;}
  if(locked()){notice('End the current round session before changing round storage.');sync();return false;}
  try{localStorage.setItem(prefKey(),mode);localStorage.removeItem(ACTIVE);}catch(error){notice('Device storage is unavailable. Round storage was not changed.');sync();return false;}
  sync();return true;
 }
 function begin(force){
  const quick=force!=='normal'&&isQuick();
  if(quick)force='local';
  const existing=session();
  if(existing&&locked()){
   if(force&&force!==existing.mode){notice('End the current round session before starting another storage mode.');return false;}
   return true;
  }
  const mode=force||preference();
  if(mode==='local'&&(sessionStorage.getItem('kbrr_session_db_id')||localStorage.getItem('kbrr_session_id_persist'))){notice('End the current Server round session before using Local.');return false;}
  try{localStorage.setItem(ACTIVE,JSON.stringify({...owner(),mode,quick}));}catch(error){notice('Device storage is unavailable. The round was not started.');return false;}
  window.__scsRecoveryEnded=false;
  if(mode==='local'&&typeof stopSessionHeartbeat==='function')stopSessionHeartbeat();
  sync();return true;
 }
 function restore(blob){
  const quick=!!blob.temporaryPlayers||!!blob.schedulerState?.allPlayers?.some(p=>p.quickPlayer);
  localStorage.setItem(ACTIVE,JSON.stringify({userId:blob.userId||owner().userId,clubId:blob.clubId||owner().clubId,mode:quick||blob.roundStorage==='local'?'local':'normal',quick}));
  if(quick)window.scsRoundPlayerSource?.restoreQuickSession?.();
 }
 function finish(){localStorage.removeItem(ACTIVE);sync();}
 function sync(){
  const mode=session()?.mode||preference(),slotView=document.getElementById('scsRoundSlotTab')?.getAttribute('aria-selected')==='true';
  const quick=isQuick(),disabled=locked()||slotView||quick,shownMode=slotView?'normal':quick?'local':mode;
  const button=document.getElementById('scsRoundStorageToggle');
  if(!button)return;
  const local=shownMode==='local',label=local?'Local':'Server';
  if(button.textContent!==label)button.textContent=label;
  button.setAttribute('aria-checked',String(local));button.disabled=disabled;
  button.setAttribute('aria-label','Round storage: '+label+'. Switch to '+(local?'Server':'Local'));
  button.title=quick&&!slotView?'Quick Mode saves on this device only.':slotView?'Slot sessions use Server. Choose Manual Rounds to use Local.':disabled?'End the current round session before changing storage.':'Tap to save rounds on '+(local?'Server':'Local');
  const home=document.getElementById('homeOrgGrid');
  const visible=document.getElementById('scsPracticeSharedHeader')?.dataset.scsActivePage==='homePageOverlay'&&!!home&&home.getClientRects().length>0&&getComputedStyle(home).visibility!=='hidden';
  if(button.hidden===visible)button.hidden=!visible;
 }
 function mount(){
  document.querySelectorAll('.scs-round-storage-row,#scsRoundStoragePills').forEach(row=>row.remove());
  const header=document.querySelector('#scsPracticeSharedHeader .scs-phase1-ref-titlebar');
  if(!header)return;
  if(!document.getElementById('scsRoundStorageToggle')){
   const button=document.createElement('button');button.id='scsRoundStorageToggle';button.type='button';button.className='scs-round-storage-toggle';button.hidden=true;button.setAttribute('role','switch');
   button.onclick=()=>{const mode=session()?.mode||preference();setMode(mode==='local'?'normal':'local');};
   header.insertBefore(button,header.querySelector('.scs-workspace-help'));
  }
  sync();
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(mount,80);}
 window.SCSRoundStorage=Object.freeze({isLocal,isQuick,networkPaused,waitForNetwork,begin,restore,finish,setMode,refresh:mount,mode:()=>session()?.mode||preference()});
 function init(){mount();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-selected','style','class','hidden','data-scs-active-page']});window.addEventListener('storage',schedule);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
