/* V856: opt-in/replayable guidance on real controls; never clicks or fills them. */
(function(){
'use strict';
const KEY='scs-round-guide-v1',q=s=>document.querySelector(s);
const visible=e=>!!(e&&e.isConnected&&!e.closest('[hidden]')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
const find=s=>[...document.querySelectorAll(s)].find(visible)||null;
const type=()=>q('#scsGuestSetup input[name="scsGuestType"]:checked')?.value||q('#scsGuestSetup input:checked')?.value||'free';
const number=id=>Number(q('#'+id)?.value||q('#'+id+'Value')?.textContent||0);
const count=()=>type()==='xd'?number('scsGuestMen')+number('scsGuestWomen'):number('scsGuestCount');
const courts=()=>Number(q('#sampleOfflineCourtsValue')?.textContent);
const validPlayers=()=>Number.isInteger(count())&&count()>=4&&count()<=40&&(type()!=='xd'||(number('scsGuestMen')>=2&&number('scsGuestWomen')>=2));
const validCourts=()=>Number.isInteger(courts())&&courts()>=1&&validPlayers()&&count()>=courts()*4&&(type()!=='xd'||(number('scsGuestMen')>=courts()*2&&number('scsGuestWomen')>=courts()*2));
const playerControl=()=>find(type()==='xd'?'#scsGuestMixed':'#scsGuestCountRow');
const courtControl=()=>find('#sampleOfflineCourtsPlus')?.closest('.org-mode-court-stepper')||find('#sampleOfflineCourtsPlus');
const generated=()=>/Rounds Generated/i.test(q('#scsGuestPrepare')?.textContent||'');
const generateControl=()=>!validPlayers()?playerControl():!validCourts()?courtControl():find('#scsGuestPrepare');
const startControl=()=>!validPlayers()?playerControl():!validCourts()?courtControl():!generated()&&!running()?find('#scsGuestPrepare'):find('#sampleStartOfflineRound');
const menu='#scsPracticeSharedHeader .scs-phase1-ref-drawer';
const running=()=>!!window.SCSOfflineRounds?.hasSessionInProgress?.();
let chosenMode=null,formatChosen=false;
const normalCount=()=>{try{if(typeof schedulerState!=='undefined'&&Array.isArray(schedulerState.activeplayers))return schedulerState.activeplayers.length}catch(_){}return Number(q('#orgIModePlayersCount')?.textContent||0)};
const normalType=()=>{try{return localStorage.getItem('scsOfflineGameType')||'doubles'}catch(_){return 'doubles'}};
const normalMinimum=()=>normalType()==='singles'?2:4;
const normalValid=()=>normalCount()>=normalMinimum();
const normalCourtsValid=()=>normalValid()&&courts()>=1&&normalCount()>=courts()*normalMinimum();
const groupHead=name=>find('#orgSchedulingScreen [data-scs-group="'+name+'"]>.scs-rg-head');
const normalPlayersControl=()=>{
 const needed=steps[index]?.id==='normal-players'?2:normalMinimum();
 if(find('#newImportModal')){
  const selected=Number(q('#newImportSelectedCount')?.textContent||0);
  if(selected>=needed)return find('#newImportAddBtn:not(:disabled),#newImportReplaceBtn:not(:disabled)')||find('#newImportModal .newImport-cancel-btn');
  return find('#addPlayersBrowseList,#newImportBrowseCards,#newImportModal [data-browse-player]')?.closest('.newImport-cards-container')||find('#newImportModal [data-browse-player]')||find('#newImportModal .newImport-container');
 }
 if(find('#playersPage'))return normalCount()>=needed?(find('#scsRoundPlayersDone')||find('#playersBackBtn')):find('#scsPlayersFloatingAdd');
 return find('#orgIModePlayers')||groupHead('Players');
};
const normalFormatControl=()=>find('#orgSchedulingScreen .org-color-format-section .org-round-format')||groupHead('Game Format');
const normalStartControl=()=>!normalValid()?normalPlayersControl():!normalCourtsValid()?courtControl():find('#sampleStartOfflineRound');
const needsLite=()=>!!find('#scsWelcomeSettings')&&!find('#scsRoleWorkspaceChooser [data-role-choice="member"]');
const prefix=[
 {id:'default-settings',target:()=>find('#scsWelcomeSettings'),text:'Open mode settings to choose Lite Mode for this guide.',skip:()=>!needsLite(),done:()=>!!find('#scsWelcomeModeSettings')},
 {id:'default-lite',target:()=>find('#scsWelcomeModeSettings input[value="member"]')?.closest('label'),text:'Select Lite Mode.',skip:()=>!find('#scsWelcomeModeSettings'),done:()=>!!q('#scsWelcomeModeSettings input[value="member"]:checked')},
 {id:'default-save',target:()=>find('#scsWelcomeSaveDefault'),text:'Save your default mode.',skip:()=>!find('#scsWelcomeModeSettings'),done:()=>!find('#scsWelcomeModeSettings')&&!!find('#scsRoleWorkspaceChooser [data-role-choice="member"]')},
 {id:'lite',target:()=>find('#scsRoleWorkspaceChooser [data-role-choice="member"]'),text:'Tap Lite Mode to begin.',done:()=>!visible(q('#scsRoleWorkspaceChooser'))&&visible(q('#scsPracticeSharedHeader'))},
 {id:'menu',target:()=>find(menu+'>summary'),text:'Tap the side menu.',done:()=>!!q(menu)?.open},
 {id:'rounds',target:()=>find(menu+' button[onclick*="rounds"]'),text:'Tap Round Manager.',done:()=>visible(q('#scsRoundManualTab'))&&!q(menu)?.open},
 {id:'manual',target:()=>find('#scsRoundManualTab'),text:'Tap Manual Rounds.',skip:()=>visible(q('#scsModeClub')),done:()=>visible(q('#scsModeClub'))},
 {id:'mode',target:()=>find('#scsPlayerSource .scs-mode-pill')||find('#scsModeClub')?.parentElement,text:'Choose Normal Mode or Quick Mode.',done:()=>chosenMode&&q(chosenMode==='guest'?'#scsModeGuest':'#scsModeClub')?.getAttribute('aria-pressed')==='true'}
];
const quickSteps=[
 {id:'format',target:()=>find('#scsGuestSetup .scs-guest-type')||find('#scsGuestSetup [role="radiogroup"]')||q('#scsGuestSetup input[value="md"]')?.closest('label')?.parentElement,text:'Choose Free, MD, LD, or XD.',done:()=>['free','md','ld','xd'].includes(type())},
 {id:'players',target:playerControl,text:()=>type()==='xd'?'Choose your men and women counts (at least 2 of each).':'Choose any player count from 4 that fits your courts.',done:validPlayers},
 {id:'generate',target:generateControl,text:()=>!validPlayers()?'Choose at least 4 players.':!validCourts()?'Choose courts that fit your players (4 players per court; XD needs 2 men and 2 women per court).':'Tap Generate Rounds.',done:generated},
 {id:'courts',target:courtControl,text:'Choose any valid number of courts, then tap Start Rounds. Keep the current count if it suits you.',done:validCourts},
 {id:'start',target:startControl,text:'Review your choices, then tap Start Rounds. Change players or courts if needed.',done:running}

];
const normalSteps=[
 {id:'normal-players',target:normalPlayersControl,text:'Open Players, select your club players, then tap Done to return.',done:()=>normalCount()>=2&&visible(q('#scsModeClub'))&&!find('#playersPage')&&!find('#newImportModal')},
 {id:'normal-format',target:normalFormatControl,text:'Open Game Format and choose Doubles, Mixed, or Singles.',done:()=>formatChosen&&visible(q('#scsModeClub'))},
 {id:'normal-courts',target:()=>normalValid()?courtControl():normalPlayersControl(),text:'Choose courts that fit your selected players, then tap Start Rounds. You can keep the current court count.',done:normalCourtsValid},
 {id:'normal-start',target:normalStartControl,text:'Review the settings, then tap Start Rounds. Existing settings stay editable.',done:running}
];
let steps=[...prefix];
function chooseBranch(mode){chosenMode=mode;formatChosen=false;steps=[...prefix,...(mode==='guest'?quickSteps:normalSteps)];index=prefix.length;clicked=false;lastScrolled=null;}

let active=false,index=0,clicked=false,target=null,ring=null,info=null,live=null,lastScrolled=null,raf=0;
function remember(value){try{localStorage.setItem(KEY,value)}catch(_){}}
function infoState(text){if(!info)return;info.setAttribute('aria-pressed',String(active));const label=active?'Stop guide. '+(text||'Follow the highlighted control.'):'Start Round Manager guide';info.setAttribute('aria-label',label);info.title=label;if(live&&text&&live.textContent!==text)live.textContent=text;}
function stop(reason){active=false;target=null;ring?.remove();ring=null;if(reason)remember(reason);infoState();if(live)live.textContent='';}
function finish(){stop('completed');if(live)live.textContent='Round guide completed.';window.dispatchEvent(new CustomEvent('scs-round-guide-complete'))}
function mount(){ring=document.createElement('div');ring.className='scs-round-guide-ring';ring.setAttribute('aria-hidden','true');document.body.append(ring);infoState();}
function position(){
 if(!active||!ring)return;
 const step=steps[index];target=step.target();let text=typeof step.text==='function'?step.text():step.text;
 if(!target){infoState(clicked?'Waiting for the next screen. Complete any sign-in or club selection to continue.':'Open the relevant screen to continue this step.');ring.hidden=true;return}
 if(target.disabled)text=step.id==='generate'?'Complete the setup messages. Waiting for Generate Rounds.':step.id==='start'?'Complete generation. Waiting for Start Rounds.':text;
 infoState(text);
 if(lastScrolled!==target){lastScrolled=target;target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'})}
 const r=target.getBoundingClientRect();ring.hidden=false;Object.assign(ring.style,{left:Math.max(3,r.left-4)+'px',top:Math.max(3,r.top-4)+'px',width:Math.min(innerWidth-6,r.width+8)+'px',height:r.height+8+'px'});
}
function tick(){
 raf=0;if(active&&!clicked){while(index<steps.length&&steps[index].skip?.())index++;if(index===steps.length){finish();return}}if(info)info.hidden=!visible(q('#scsRoleWorkspaceChooser'));if(!active)return;
 // Player selection may open while an earlier navigation step is still settling.
 if(window.__scsPlayersFromRoundManager&&find('#playersPage')&&(chosenMode!=='club'||steps[index].id!=='normal-players'))chooseBranch('club');
 // Steps only advance after the highlighted control is actually clicked.
 if(clicked&&steps[index].done()){if(steps[index].id==='mode'){chooseBranch(chosenMode);position();return}index++;clicked=false;lastScrolled=null;while(index<steps.length&&steps[index].skip?.())index++;if(index===steps.length){finish();return}}
 position();
}
function schedule(){if(!raf)raf=requestAnimationFrame(tick)}
function start(){stop();if(running())return false;active=true;steps=[...prefix];chosenMode=null;formatChosen=false;index=0;clicked=false;lastScrolled=null;mount();schedule();return true}
function startFromWorkspace(){if(!start())return false;index=prefix.findIndex(step=>step.id==='menu');schedule();return true}
function replay(){if(!start()){if(live)live.textContent='Finish the current round session before starting the guide.';return false;}if(!find('#scsRoleWorkspaceChooser [data-role-choice="member"]')&&typeof window.scsSwitchRoleWorkspace==='function')window.scsSwitchRoleWorkspace();return true;}
function onAction(event){
 if(!active)return;
 const modeButton=event.target.closest('#scsModeClub,#scsModeGuest');
 if(modeButton&&index>=prefix.length-1){
  const mode=modeButton.id==='scsModeGuest'?'guest':'club';
  if(steps[index].id==='mode'){chosenMode=mode;clicked=true}else chooseBranch(mode);
  setTimeout(schedule,0);return;
 }
 if(chosenMode==='club'){
  if(steps[index].id==='normal-format'&&event.target.closest('#sampleOfflineFormatDoubles,#sampleOfflineFormatMixed,#sampleOfflineFormatSingles'))formatChosen=true;
  if(steps[index].id==='normal-players'&&normalValid()&&event.target.closest('#orgSchedulingScreen .org-round-format')){index=steps.findIndex(step=>step.id==='normal-format');formatChosen=true;lastScrolled=null;}
  if(steps[index].id==='normal-courts'&&event.target.closest('#sampleStartOfflineRound')&&normalCourtsValid()){index=steps.findIndex(step=>step.id==='normal-start');lastScrolled=null;}
 }
 // Users can keep existing valid counts and go directly to the next real action.
 if(steps[index].id==='players'&&event.target.closest('#scsGuestPrepare')&&validPlayers()){index=steps.findIndex(step=>step.id==='generate');lastScrolled=null;}
 if(steps[index].id==='courts'&&event.target.closest('#sampleStartOfflineRound')&&validCourts()){index=steps.findIndex(step=>step.id==='start');lastScrolled=null;}
 const current=steps[index].target();
 if(!current||current.disabled||!current.contains(event.target))return;
 clicked=true;setTimeout(schedule,0);
}
document.addEventListener('click',onAction,true);document.addEventListener('input',onAction,true);document.addEventListener('change',onAction,true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active)stop('stopped')});
window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);
function requestGuide(run){
 if(window.SCSUnfinishedRounds?.offer){window.SCSUnfinishedRounds.offer(()=>{
  if(typeof currentState!=='undefined'&&currentState==='active'){window.alert('Continue or end the current session before starting the guide.');return false;}
  document.querySelectorAll('#homePageOverlay .disabled, #scsActivityHome .disabled, #scsPracticeSharedHeader .disabled').forEach(el=>{el.classList.remove('disabled');el.style.pointerEvents='';});
  const started=run();if(!started)window.alert('Finish the current session before starting the guide.');return started;
 });return true;}
 return run();
}
window.SCSRoundGuide=Object.freeze({start:()=>requestGuide(start),replay:()=>requestGuide(replay),startFromWorkspace:()=>requestGuide(startFromWorkspace),stop:()=>stop('skipped'),state:()=>({active,mode:chosenMode,step:active?steps[index].id:null})});
function init(){
 info=document.createElement('button');info.type='button';info.id='scsRoundGuideInfo';info.className='scs-round-guide-info';info.hidden=!visible(q('#scsRoleWorkspaceChooser'));info.innerHTML='<span aria-hidden="true">?</span>';info.onclick=()=>window.SCSWorkspaceHelp.open(info);
 live=document.createElement('span');live.className='scs-round-guide-live';live.setAttribute('role','status');live.setAttribute('aria-live','polite');document.body.append(info,live);infoState();
 new MutationObserver(records=>{if(records.every(r=>r.target===ring||info?.contains(r.target)||r.target===live))return;schedule()}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style','class','aria-pressed','open','disabled'],characterData:true});setInterval(schedule,600);schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
