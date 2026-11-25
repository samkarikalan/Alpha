/* V888: owned unfinished session actions on Lite and Pro homes. */
(function(){
 let generation=0,busy=false,refreshTimer;
 function panels(){
  ['myHubHomeView','scsActivityHome'].forEach(id=>{
   const home=document.getElementById(id);if(!home||home.querySelector('[data-unfinished-rounds]'))return;
   const panel=document.createElement('section');panel.className='scs-unfinished-rounds';panel.dataset.unfinishedRounds='';panel.hidden=true;panel.setAttribute('aria-label','Unfinished round session');
   (home.querySelector('.scs-activity-panel')||home).prepend(panel);
  });
  return Array.from(document.querySelectorAll('[data-unfinished-rounds]'));
 }
 function message(text){if(typeof showToast==='function')showToast(text);else window.alert(text);}
 async function refresh(){
  const request=++generation;
  if(busy||typeof scsFindSavedRoundSnapshot!=='function')return;
  let saved=null;
  try{saved=await scsFindSavedRoundSnapshot();}catch(error){console.warn('Unfinished session check failed',error);}
  if(request!==generation||busy)return;
  panels().forEach(panel=>{
   panel.hidden=!saved;
   if(!saved){panel.replaceChildren();return;}
   panel.innerHTML='<h3>Unfinished Session</h3><p></p><div class="scs-unfinished-actions"><button type="button" data-resume-round>Continue Round</button><button type="button" data-end-round>End Session</button></div>';
   const index=Number(saved.currentRoundIndex||0),round=saved.allRounds[index];
   panel.querySelector('p').textContent='Round '+(round.round||index+1)+' · '+(saved.currentState==='active'?'In progress':'Ready to continue');
   panel.querySelector('[data-resume-round]').onclick=()=>open(false);
   panel.querySelector('[data-end-round]').onclick=()=>open(true);
  });
 }
 async function open(ending){
  if(busy)return;
  busy=true;++generation;
  panels().forEach(panel=>panel.querySelectorAll('button').forEach(button=>button.disabled=true));
  try{
   // Revalidate on click; never resume or end another account/club's session.
   const saved=await scsFindSavedRoundSnapshot();
   if(!saved){message('This session is no longer available to continue.');return;}
   // Always use the established recovery path before opening the existing End flow.
   const restored=await scsResumeSavedRounds({reopen:true});
   if(!restored){message('Could not restore the session. Please try again.');return;}
   if(typeof window.SCSRoleWorkspaces?.closeChooser==='function')window.SCSRoleWorkspaces.closeChooser();
   if(ending){
    if(typeof endSession!=='function')throw new Error('End Session is unavailable.');
    await endSession();
   }
  }catch(error){console.error('Unfinished session action failed',error);message('Could not open the saved session. Your saved rounds have been kept.');}
  finally{busy=false;refresh();}
 }
 let offering=null;
 async function offer(onClear){
  if(offering)return offering;
  offering=(async()=>{
   let saved;
   try{saved=await scsFindSavedRoundSnapshot();}catch(error){message('Could not check your saved session. Please try again.');return false;}
   if(!saved){if(onClear)return onClear();return false;}
   return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.id='scsUnfinishedSessionChoice';
    dialog.setAttribute('aria-labelledby','scsUnfinishedChoiceTitle');
    dialog.innerHTML='<h2 id="scsUnfinishedChoiceTitle">Unfinished Session</h2><p>Your saved rounds are still available. Continue them or end the session before starting a new guide.</p><div class="scs-unfinished-actions"><button type="button" data-continue>Continue Round</button><button type="button" data-end>End Session</button></div><button type="button" class="scs-session-choice-cancel">Cancel</button>';
    document.body.append(dialog);
    let chosen=false;
    async function choose(ending){if(chosen)return;chosen=true;dialog.close();dialog.remove();await open(ending);resolve(false);}
    dialog.querySelector('[data-continue]').onclick=()=>choose(false);
    dialog.querySelector('[data-end]').onclick=()=>choose(true);
    dialog.querySelector('.scs-session-choice-cancel').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{if(!chosen){dialog.remove();resolve(false);}});
    dialog.showModal();
   });
  })();
  try{return await offering;}finally{offering=null;}
 }
 function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,100);}
 function init(){
  refresh();
  const observer=new MutationObserver(schedule);
  ['scsActivityHome','myHubHomeView','homePageOverlay'].forEach(id=>{const el=document.getElementById(id);if(el)observer.observe(el,{attributes:true,attributeFilter:['hidden','style','class']});});
 }
 window.SCSUnfinishedRounds={refresh,offer};
 window.addEventListener('focus',schedule);
 window.addEventListener('pageshow',schedule);
 window.addEventListener('storage',schedule);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
