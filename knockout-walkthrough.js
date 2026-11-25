/* V898: Knockout help follows actual controls and confirmed state.
   Never clicks, fills, saves or starts an event on behalf of the user. */
(function(){
 'use strict';
 let active=false,ring,bar,text,timer,observer,target,lastScroll,step='';
 const visible=el=>!!(el&&el.isConnected&&!el.closest('[hidden],[aria-hidden="true"]')&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
 const find=selector=>Array.from(document.querySelectorAll(selector)).filter(visible).at(-1)||null;
 const ko=selector=>find('#scsTournamentOverlay '+selector);
 const action=name=>ko('[onclick*="SCSTournament.'+name+'("]');
 const result=(id,el,message)=>({id,el,message});
 function form(name,create,id,label){
  const input=find(name);
  if(!input)return null;
  return !input.value.trim()||document.activeElement===input
    ?result(id,input,'Enter '+label+', then finish editing the field.')
    :result(id+'-save',find(create),'Tap Create to save '+label+'.');
 }
 function next(){
  let state={};try{state=window.SCSTournament?.guideState?.()||{};}catch(_){}
  const parent=form('[data-main-name]','[data-main-create]','tournament-name','a tournament name');if(parent)return parent;
  const eventName=find('[data-event-name]');
  if(eventName){
   if(!eventName.value.trim()||document.activeElement===eventName)return result('event-name',eventName,'Enter the Knockout event name.');
   const format=find('[data-event-format]');
   if(format&&format.value!=='knockout')return result('event-format',format,'Select Knockout as the event format.');
   return result('event-create',find('[data-event-create]'),'Keep Knockout selected, then tap Create Event.');
  }
  const selector=find('.scs-api-player-selector');
  if(selector){
   const selected=Number(selector.querySelector('[data-count]')?.textContent.match(/\d+/)?.[0]||0);
   return result('select-players',selected>=8?find('.scs-api-player-selector [data-done]'):find('.scs-api-player-selector [data-players]')||selector,selected>=8?'Tap Done to keep the selected players.':'Select at least 8 players for 4 doubles teams. Use the club filter if needed.');
  }
  if(state.visible){
   if(state.readOnly)return result('read-only',ko('[data-close],button[onclick*="SCSTournament.close("]'),'This tournament is view-only. Close it and choose an editable tournament for the guide.');
   if(state.home)return result('add-event',ko('[data-add-event]')||ko('[data-open-event]'),'Tap Add Event and choose Knockout, or open an existing Knockout event.');
   if(state.live)return result('complete',null,'Knockout event started. The guide is complete.');
   const entry=ko('.scs-tm-entry-modal:not(.scs-api-player-selector)');
   if(entry){
    const first=entry.querySelector('#scsTmP1'),second=entry.querySelector('#scsTmP2');
    if(first&&!first.value)return result('team-player-1',visible(first)?first:entry.querySelector('[data-shared-picker]')||entry,'Choose the first player for this team.');
    if(second&&!second.value)return result('team-player-2',visible(second)?second:entry.querySelector('[data-shared-picker]')||entry,'Choose a different second player for this team.');
    return result('save-team',action('doneEntry')||action('addNextTeam')||entry,'Save this team. Add more teams until at least four have two players each.');
   }
   const editor=ko('.scs-tm-editor');
   if(editor){const build=ko('#tmNextByes');return result('build-bracket',build?.disabled?editor:build,'Review the title and side counts. Left + Right must equal the team total. Tap Build Bracket when ready.');}
   if(state.byeSelection)return result('pattern',state.byesReady?(action('confirmByeSelection')||action('assistCloseStep')):ko('#scsTmChart')||ko('.scs-tm-pattern-dashboard'),state.byesReady?'Review both sides, then approve the selected pattern.':'Select the required BYE positions on both sides. Review Left and Right patterns.');
   if(state.step===1){
    if(state.playersReady)return result('players-done',action('assistFinishPlayers'),'All teams are ready. Tap Done to return to Assist.');
    if(state.poolCount<8)return result('players-manager',action('openPlayersManager')||ko('.scs-tm-player-pool summary'),'Open Players Manager and select the tournament players.');
    return result('add-team',action('assistAddTeam')||ko('.scs-tm-teams-flat summary'),'Tap + to create a team and select two players. Repeat for at least four teams.');
   }
   if(state.step===2){
    const confirm=action('assistConfirmAssignments');
    if(confirm)return result('assignments',confirm,'Review team positions and confirm the assignments.');
    return result('pattern-done',action('assistCloseStep')||ko('.scs-tm-workspace'),'Review the bracket and team positions, then tap Done.');
   }
   const generate=action('generateKnockoutFixtures');if(generate)return result('generate',generate,'Tap Generate Fixtures. The guide waits until the fixtures are generated successfully.');
   const start=ko('[data-event-start]');
   if(start)return result('start-event',start,'Review courts and scoring settings. Tap Start Event when ready.');
   if(action('openEventSetup'))return result('event-setup',action('openEventSetup'),'Open Event setup to review the courts and scoring rules.');
   if(ko('.scs-shared-assist')){
    const n=!state.playersReady?0:!state.assigned?1:!state.fixturesReady?2:3;
    return result('assist-'+n,action('assistOpen')&&ko('[onclick="SCSTournament.assistOpen('+n+')"]'),['Open Players and Teams.','Open Pattern & Team Assignment.','Open Generate Fixtures.','Open Start to review and start the event.'][n]);
   }
   return result('event-tab',ko('[data-tm-nav="event"], [data-ko-nav="event"]')||ko('.scs-tm-assist'),'Open the Event tab to review settings and start, or return to Assist.');
  }
  if(find('#scsTournamentContinue'))return result('choose-tournament',find('#scsTournamentContinue .scs-tmgr-tournament-open')||find('#scsTournamentContinue .scs-tmgr-new-tournament'),'Open an editable tournament, or tap New Tournament.');
  if(find('#scsTournamentTypePicker'))return result('tournament-type',find('[onclick="scsStartKnockoutTournament()"]'),'Tap Tournament to create a tournament with Knockout events.');
  const menu=find('#scsTournamentSideMenu [onclick*="scsTournamentManagerMyTournaments"]');
  return result('my-tournaments',menu||find('[aria-controls="scsTournamentSideMenu"]'),'Open the tournament menu, then tap My Tournaments.');
 }
 function stop(message){
  active=false;clearInterval(timer);observer?.disconnect();observer=null;ring?.remove();bar?.remove();ring=bar=text=target=lastScroll=null;step='';
  if(message&&typeof showToast==='function')showToast(message);
 }
 function update(){
  if(!active)return;
  const nextStep=next();step=nextStep.id;target=nextStep.el;
  if(step==='complete'){stop(nextStep.message);window.dispatchEvent(new CustomEvent('scs-knockout-guide-complete'));return;}
  if(text.textContent!==nextStep.message)text.textContent=nextStep.message;
  if(!target||!visible(target)){ring.hidden=true;return;}
  const focus=document.activeElement;
  if(lastScroll!==target){lastScroll=target;if(!focus?.matches('input,textarea,select'))target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});}
  const r=target.getBoundingClientRect();ring.hidden=false;
  Object.assign(ring.style,{left:Math.max(3,r.left-3)+'px',top:Math.max(3,r.top-3)+'px',width:Math.min(innerWidth-6,r.width+6)+'px',height:r.height+6+'px'});
  bar.classList.toggle('scs-ko-guide-at-top',r.bottom>innerHeight*.62);
 }
 function begin(){
  stop();window.SCSRoundGuide?.stop();active=true;
  ring=document.createElement('div');ring.className='scs-round-guide-ring scs-ko-guide-ring';ring.setAttribute('aria-hidden','true');
  bar=document.createElement('aside');bar.className='scs-ko-guide-bar';bar.setAttribute('aria-label','Knockout guide');
  const heading=document.createElement('strong');heading.textContent='Knockout Guide';
  text=document.createElement('p');text.setAttribute('role','status');text.setAttribute('aria-live','polite');
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Stop Knockout guide');close.onclick=()=>stop();
  bar.append(heading,text,close);document.body.append(ring,bar);
  timer=setInterval(update,250);
  observer=new MutationObserver(records=>{if(records.some(r=>!bar?.contains(r.target)&&r.target!==ring))queueMicrotask(()=>{if(active)update();});});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled','aria-expanded']});
  update();return true;
 }
 document.addEventListener('keydown',e=>{if(active&&e.key==='Escape')stop();});
 window.SCSKnockoutGuide=Object.freeze({start(){if(window.SCSUnfinishedRounds?.offer){window.SCSUnfinishedRounds.offer(begin);return true;}return begin();},stop:()=>stop(),state:()=>({active,step})});
})();
