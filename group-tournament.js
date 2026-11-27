(function(){
'use strict';
const KEY='scs_group_tournament_ui_v1';
let mixedContext=null,scoringRules=null,eventCourtNumbers=null;
const GROUP_MAIN_KEY='scs_group_multi_event_v1';let groupMain=null,groupEventId=null,groupHome=false;let groupSwapSelection=null,lastGroupSwap=null,groupExpanded={},assistFromEvent=false;
const groupEventKey=id=>'scs_group_event_'+id;
function groupPageTitle(label){
 const root=el();if(!root)return;root.dataset.pageTitle=label;if(label==='Tournament'&&root._scsEventCourtPool)root._scsEventCourtPool.active=false;root.dataset.groupHome=String(groupHome);root.dataset.readOnly=String(viewOnly);
 const old=root.querySelector('.scs-group-fallback-header');if(old)old.remove();
 if(!document.getElementById('scsTournamentPersistentHeader'))root.insertAdjacentHTML('afterbegin','<header class="scs-group-fallback-header"><button type="button" aria-label="Open tournament menu" onclick="if(window.scsTournamentMenuToggle)scsTournamentMenuToggle(true)">☰</button><h2>'+escapeHTML(label)+'</h2></header>');
 if(!groupHome&&groupEventId)window.ScsApi?.eventIdentity?.apply(root,groupMain,groupEventId,title);else window.ScsApi?.eventIdentity?.clear(root);
 if(typeof window.scsRefreshTournamentHeader==='function')window.scsRefreshTournamentHeader();window.ScsApi?.eventIdentity?.refreshHeader();
}
function groupId(){return 'gr-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function groupMainSave(){
 if(!groupMain||viewOnly||mixedContext)return;groupMain._scsTournamentFormat='group';
 groupMain._scsMainTournament=true;
 groupMain._scsClientTournamentId=groupMain._scsClientTournamentId||groupMain.id||(groupMain.id=groupId());
 localStorage.setItem(GROUP_MAIN_KEY,JSON.stringify(groupMain));
 if(typeof window.scsQueueTournamentCloudSave==='function')window.SCSTournamentStore.queue('group',groupMain);
}
function groupEnsureMain(){try{groupMain=JSON.parse(localStorage.getItem(GROUP_MAIN_KEY)||'null')}catch(_){groupMain=null}
 if(!groupMain){groupMain={title:'Group Stage + Knockout',events:[],activeEventId:null};try{const legacy=JSON.parse(localStorage.getItem(KEY)||'null');if(legacy&&(legacy.created||legacy.started||legacy.title)){const id=groupId();groupMain.events.push({id,title:legacy.title||'Group Event'});groupMain.activeEventId=id;localStorage.setItem(groupEventKey(id),JSON.stringify(legacy))}}catch(_){}}
 if(!Array.isArray(groupMain.events))groupMain.events=[];groupEventId=groupMain.events.some(e=>e.id===groupMain.activeEventId)?groupMain.activeEventId:(groupMain.events[0]?.id||null);groupMain.activeEventId=groupEventId;groupMainSave()}
function groupHomeRender(){if(mixedContext){save();const home=mixedContext.onHome;window.SCSEventCourtPool?.dispose(el());el()?.remove();mixedContext=null;home();return}if(viewOnly)return false;groupHome=true;if(!groupMain.events.some(e=>e.id===groupEventId)){groupEventId=groupMain.events.some(e=>e.id===groupMain.activeEventId)?groupMain.activeEventId:groupMain.events[0]?.id;groupMain.activeEventId=groupEventId;}const root=el();if(!root)return;window.ScsApi?.tournamentAccess?.attach(root,viewOnly);const events=groupMain.events.map(e=>{let v={};try{v=JSON.parse(localStorage.getItem(e.format==='knockout'?'scs_knockout_event_'+e.id:groupEventKey(e.id))||'{}')}catch(_){}return {...e,teams:e.format==='knockout'?(v.entries||[]).length:Object.keys(v.assignments||{}).length,clubs:Object.values(v.assignments||{}).filter(a=>Array.isArray(a)&&a.some(Boolean)).map((_,i)=>'Team '+(i+1)),matches:(v.matches||[]).length,completed:e.format==='knockout'?Object.keys(v.results||{}).length:(v.matches||[]).filter(m=>m.status==='approved').length}});
 window.ScsApi.events.mountHome(root,{title:groupMain.title||'Group Stage + Knockout',courtDashboard:{id:groupMain._scsClientTournamentId||groupMain.id,aliases:[groupMain.id,groupMain._scsClientTournamentId],courtCount:groupMain.courtCount||groupMain.numCourts,format:'group',parentState:()=>groupMain,storeCourtCount:(n,remote)=>{groupMain.courtCount=n;if(remote)localStorage.setItem(GROUP_MAIN_KEY,JSON.stringify(groupMain));else groupMainSave();},returnHome:()=>open('edit'),openMatchCenter:async(id,stage)=>{const knockout=groupMain?.events.find(e=>e.id===id)?.format==='knockout';groupOpenEvent(id,'match');if(stage!=null){await groupKnockoutOpen(stage);SCSTournament.switchTournamentTab('match');}else if(knockout)SCSTournament.switchTournamentTab('match');},storeEventState:(e,s)=>localStorage.setItem(e.format==='knockout'?'scs_knockout_event_'+e.id:groupEventKey(e.id),JSON.stringify(s)),loadEventState:e=>JSON.parse(localStorage.getItem(e.format==='knockout'?'scs_knockout_event_'+e.id:groupEventKey(e.id))||'null')},events,activeEventId:groupEventId,viewOnly,navAttribute:'data-group-nav',ariaLabel:'Group Stage + Knockout sections'});
 const home=root.querySelector('.scs-team-event-home');if(home){const name=document.createElement('h1');name.className='scs-group-main-title';name.textContent=groupMain.title||'Group Stage + Knockout';home.prepend(name);home.insertAdjacentHTML('beforeend','<button type="button" class="scs-gt-primary" data-group-home-done>Done</button>');home.querySelector('[data-group-home-done]').onclick=close}
 groupPageTitle('Tournament');
 root.querySelector('[data-close]').onclick=close;root.querySelectorAll('[data-open-event]').forEach(b=>b.onclick=()=>groupEventStageHome(b.dataset.openEvent));const add=root.querySelector('[data-add-event]');if(add)add.onclick=groupAddEvent;root.querySelectorAll('[data-group-nav]').forEach(b=>b.onclick=()=>{const target=b.dataset.groupNav;if(target==='home')groupHomeRender();else if(groupEventId){groupEventStageHome(groupEventId,target);}else alert('Add an event first.')})}
function groupKnockoutReady(data){const ms=Array.isArray(data.matches)?data.matches:[];return !!data.started&&ms.length>0&&ms.every(m=>m.status==='approved')}
function qualifierPayload(data,stage){return {config:data.config,matches:data.matches,assignments:data.assignments,selectedPlayerDetails:data.selectedPlayerDetails,stage};}
function groupKnockoutCandidates(data,stage){return SCSTournamentEngine.ensure('group-qualifiers',qualifierPayload(data,stage),refreshGroupComputedView)?.teams||[];}
async function groupKnockoutOpen(stage,section){const load=()=>groupKnockoutOpenData(stage,section);return !localStorage.getItem('scs_group_knockout_'+groupEventId+'_'+stage)&&window.ScsApi?.loading?ScsApi.loading.run(el(),load):load();}
async function groupKnockoutOpenData(stage,section){if(viewOnly){const saved=JSON.parse(localStorage.getItem('scs_group_knockout_'+groupEventId+'_'+stage)||'null');if(saved&&window.SCSTournament)SCSTournament.open(saved,true);else alert('No published knockout bracket is available.');return}
 const id=groupEventId,data=JSON.parse(localStorage.getItem(groupEventKey(id))||'{}');
 if(!groupKnockoutReady(data)){alert('Complete and approve every group match first.');return}
 const key='scs_group_knockout_'+id+'_'+stage;
 let saved=JSON.parse(localStorage.getItem(key)||'null');
 if(!saved){
  if(!await refreshWorkerGroupStandings(false)){alert('Connect to load official standings before qualifying teams.');return}
  let teams;try{teams=(await SCSTournamentEngine.run('group-qualifiers',qualifierPayload(data,stage))).teams;}catch(error){alert(error.message);return}
  if(teams.length<4||teams.length>64){alert('Knockout bracket requires 4 to 64 qualified teams.');return}
  if(!window.SCSTournament||typeof SCSTournament.generateCustomTwoSidedFromWorker!=='function'){alert('Knockout module is unavailable.');return}
  const left=Math.ceil(teams.length/2),names=teams.map(t=>t.players.join(' / '));
  try{saved=await SCSTournament.generateCustomTwoSidedFromWorker(teams.length,left,null,null,(data.title||'Event')+(Number(data.config?.knockouts)===2?(stage===0?' — Top Knockout':' — Bottom Knockout'):' — Knockout'),names)}catch(error){alert(error.message||'Could not generate the knockout bracket.');return}
  saved.entries.forEach((e,i)=>{e.playerDetails=teams[i].details;e.groupSource=teams[i].id;e.groupRank=teams[i].rank});
  saved.selectedPlayerDetails=teams.flatMap(t=>t.details);saved.scoringRules=JSON.parse(JSON.stringify(data.scoringRules||groupEventRules()));
  saved._scsGroupEventId=id;saved._scsGroupKnockoutStage=stage;saved._scsParentTournamentId=groupMain?._scsClientTournamentId||groupMain?.id;saved._scsParentCourtCount=groupMain?.courtCount;saved._scsCourtPoolEventId=id;
  saved.assistAssignmentsConfirmed=true;saved.knockoutFixturesGenerated=true;saved.assistFinalized=true;
  // Group qualifiers have already completed team assignment and bracket creation.
  // Enter the proven Knockout pre-start assistant, not the unstarted court cards.
  saved.livePage=true;saved.live=false;saved.numCourts=Math.max(1,Number(saved.numCourts)||2);
  localStorage.setItem(key,JSON.stringify(saved));
 }
 saved=window.SCSEventCourtPool?.reconcile(saved,groupMain,id)||saved;
 // Upgrade V413/V414 saved group brackets without overwriting match progress.
 if(saved&&!saved.live&&!saved.livePage){saved.livePage=true;saved.assistFinalized=true;saved.assistAssignmentsConfirmed=true;saved.knockoutFixturesGenerated=true;localStorage.setItem(key,JSON.stringify(saved));}
 if(!window.SCSTournament||typeof window.SCSTournament.open!=='function'){alert('Knockout module is unavailable.');return}
 try{window.SCSTournament.open(saved,false,function(updated){localStorage.setItem(key,JSON.stringify(updated));return Promise.resolve(updated)});if(section)window.SCSTournament.switchTournamentTab(section);if(saved.live&&typeof window.SCSTournament.resumeGroupCourtSession==='function')await window.SCSTournament.resumeGroupCourtSession();return true;}
 catch(error){console.error('Group knockout launch failed',error);alert('Could not open Knockout. '+(error&&error.message||'Please retry.'));}
}
function groupKnockoutPreview(stage){
 const data={config,assignments,selectedPlayerDetails:groupSelectedPlayerDetails,matches,started};
 const complete=groupKnockoutReady(data),candidates=complete?groupKnockoutCandidates(data,stage):[];
 const label=Number(config.knockouts)===2?(stage===0?'KO 1':'KO 2'):'Knockout';
 return '<div class="scs-gt-matrix-knockout-empty"><h4>'+label+'</h4><p>'+(stage===0?config.top:config.bottom)+' qualifying teams per group</p>'+
 (complete?'<p>Qualified teams from approved group rankings:</p>'+Array.from({length:config.groups},(_,g)=>'<div class="scs-gt-qualified-group"><strong>Group '+groupLabel(g)+'</strong>'+candidates.filter(t=>t.group===g).map(t=>'<p>'+t.rank+'. '+escapeHTML(t.players.join(' / '))+'</p>').join('')+'</div>').join('')+'<button type="button" class="scs-gt-primary scs-gt-knockout-launch" data-group-knockout-continue="'+stage+'">'+(localStorage.getItem('scs_group_knockout_'+groupEventId+'_'+stage)?'Continue Knockout':'Generate Knockout')+'</button>':'<p>Knockout becomes available after all group matches are completed and approved.</p>')+'</div>';
}
async function groupEventStageHome(id,section){const event=groupMain?.events.find(e=>e.id===id),state=JSON.parse(localStorage.getItem(groupEventKey(id))||'null');if(event?.format==='knockout')return groupOpenEvent(id,'event');const choice=await ScsApi.events.chooseEventStage(event||{title},state);if(choice===null)return;setStageScope(choice,id);groupOpenEvent(id,choice==='group'?(section||'event'):'event');if(choice!=='group'){await openEventStage(choice,section==='match'?'match':'draw');if(section==='event')SCSTournament.switchTournamentTab('main');}}
function groupOpenEvent(id,section){if(groupEventId!==id){eventAssignmentStage='group';eventAssignmentSessions=[];}if(viewOnly)return false;if(groupMain?.events.find(e=>e.id===id)?.format==='knockout'){groupOpenKnockoutEvent(id);return}if(!groupMain.events.some(e=>e.id===id))return;groupEventId=id;groupMain.activeEventId=id;groupMainSave();groupHome=false;window.ScsApi.events.leaveHome(el());applyState(JSON.parse(localStorage.getItem(groupEventKey(id))||'null')||{title:groupMain.events.find(e=>e.id===id).title});assistStep=0;resultsPage='group';resultsGroup=0;resultsExpanded={};tab=section==='event'?'event':section==='clubs'?'players':section==='match'?'match':'main';render()}
function groupOpenKnockoutEvent(id){
 const event=groupMain.events.find(e=>e.id===id);if(!event||viewOnly)return;groupEventId=id;groupMain.activeEventId=id;groupMainSave();
 let state=null;try{state=JSON.parse(localStorage.getItem('scs_knockout_event_'+id)||'null')}catch(_){}
 el()?.remove();SCSTournament.openParentEvent(groupMain,event,state,parent=>{groupMain=parent;groupMainSave()},()=>{groupEnsureMain();if(!el()){const root=document.createElement('div');root.id='scsGroupTournament';root.className='scs-gt-overlay';document.body.appendChild(root)}groupHomeRender()});
}
function groupAddEvent(){if(viewOnly)return false;window.ScsApi.events.requestEvent({parentTitle:groupMain.title,chooseFormat:true,onCreate:(title,format)=>{if(groupMain.events.some(e=>e.title.toLowerCase()===title.toLowerCase())){alert('Event already exists.');return}const id=groupId();groupMain.events.push({id,title,format:format||'group'});groupMain.activeEventId=id;groupMainSave();if(format==='knockout'){groupOpenKnockoutEvent(id);return}localStorage.setItem(groupEventKey(id),JSON.stringify({title,created:false,assistMode:true,config:{groups:0,per:0,knockouts:1,top:2,bottom:1},pool:[],teamDrafts:[],assignments:{},matches:[],started:false}));groupEventStageHome(id)}})}

 let groupSelectedPlayerDetails=[];
 let cloudTournamentId='',clientTournamentId='',title='',config={groups:4,per:4,knockouts:1,top:2,bottom:1},created=false,assistStep=0,assistPatternReady=false,assistMode=true,tab='main',tournamentView='all',matrixSection='group-0',resultsPage='group',resultsGroup=0,resultsExpanded={},matchesSection='group-0',matchesStatus='all',pool=[],teamDrafts=[],assignments={},started=false,matches=[],courtCount=2,assignmentSerial=0,matchTab='waiting',assigningMatch=null,viewOnly=false;
function refreshGroupComputedView(){
 if(!el()||el().hidden)return;
 const form=el().querySelector('[data-group-rules]');
 if(tab==='event'&&form){if(form.contains(document.activeElement)||ScsApi.events.ruleFormIssues(el(),groupEventRules(),'[data-group-rule-count]',i=>'[data-group-rule-win="'+i+'"]',i=>'[data-group-rule-max="'+i+'"]').length)return;return ScsApi.events.keepEditorPosition(el(),'[data-group-rule-count]',render);}
 render();
}
 let workerGroupStandings=Object.create(null);
 async function refreshWorkerGroupStandings(renderAfter){
  if(!started||!window.SCSTournamentEngine)return false;
  try{
   const next=Object.create(null);
   for(let g=0;g<Number(config.groups||0);g++)next[g]=(await SCSTournamentEngine.run('group-standings',{config,matches,group:g})).standings;
   workerGroupStandings=next;if(renderAfter)render();return true;
  }catch(error){console.warn('Worker group standings unavailable:',error&&error.message||error);return false}
 }
const el=()=>document.getElementById('scsGroupTournament');
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function cleanTeamDrafts(teams){return (Array.isArray(teams)?teams:[]).filter(team=>Array.isArray(team)&&team.some(name=>String(name||'').trim())).map(team=>team.map(name=>String(name||'').trim()))}
 function load(){try{let v=JSON.parse(localStorage.getItem(groupEventId?groupEventKey(groupEventId):KEY));if(v){eventCourtNumbers=Array.isArray(v.courtNumbers)?v.courtNumbers:null;cloudTournamentId=v._scsCloudTournamentId||'';clientTournamentId=v._scsClientTournamentId||'';title=String(v.title||'Group Stage + Knockout');scoringRules=v.scoringRules||null;config=v.config||config;created=!!v.created;assistMode=typeof v.assistMode==='boolean'?v.assistMode:!created;assistPatternReady=!!v.assistPatternReady;pool=Array.isArray(v.pool)?v.pool:[];groupSelectedPlayerDetails=Array.isArray(v.selectedPlayerDetails)?v.selectedPlayerDetails:[];assignments=v.assignments||{};teamDrafts=Array.isArray(v.teamDrafts)?cleanTeamDrafts(v.teamDrafts):Object.keys(assignments).sort().map(k=>assignments[k]).filter(x=>Array.isArray(x)&&x.length===2);started=!!v.started;matches=Array.isArray(v.matches)?v.matches:[];courtCount=Number.isInteger(Number(v.courtCount))?Number(v.courtCount):2;assignmentSerial=Number(v.assignmentSerial)||0}}catch(e){}}
 function save(){try{if(viewOnly)return;const state={_scsCloudTournamentId:cloudTournamentId,_scsClientTournamentId:clientTournamentId,_scsParentTournamentId:groupMain?groupMain._scsClientTournamentId||groupMain.id:null,_scsParentTournamentTitle:groupMain?groupMain.title:null,_scsGroupEventId:groupEventId,_scsMainTournament:false,title,courtNumbers:eventCourtNumbers,scoringRules,config,created,assistMode,assistPatternReady,pool,selectedPlayerDetails:groupSelectedPlayerDetails,teamDrafts,assignments,started,matches,courtCount,assignmentSerial};if(typeof window.scsEnsureTournamentClientId==='function')clientTournamentId=state._scsClientTournamentId=window.scsEnsureTournamentClientId(state);localStorage.setItem(groupEventId?groupEventKey(groupEventId):KEY,JSON.stringify(state));if(mixedContext){state._scsEventFormat='group';mixedContext.onSave(state);}if(typeof window.scsQueueTournamentCloudSave==='function')window.SCSTournamentStore.queue('group',state)}catch(e){}}
let groupSaveBusy=false;
async function saveGroupTournamentNow(){
 if(viewOnly||groupSaveBusy||groupHome)return false;
 const indicator=el()?.querySelector('[data-group-save-status]');
 const button=el()?.querySelector('[data-group-save-now]');
 const eventId=groupEventId,clientId=clientTournamentId,localKey=eventId?groupEventKey(eventId):KEY,context=mixedContext;
 groupSaveBusy=true;if(button)button.disabled=true;
 if(indicator)indicator.textContent=(typeof t === 'function' ? t('scsSaving') : "Saving…");
 try{
  save();
  const snapshot=JSON.parse(localStorage.getItem(localKey)||'null');
  if(!snapshot||typeof window.dbSaveTournamentState!=='function')throw Error('Server save unavailable; local copy retained.');
  const id=await window.SCSTournamentStore.save('group',snapshot);
  if(!id)throw Error('Server did not confirm save; local copy retained.');
  if(groupEventId===eventId&&clientTournamentId===snapshot._scsClientTournamentId)cloudTournamentId=id;
  const current=JSON.parse(localStorage.getItem(localKey)||'null');
  if(current&&current._scsClientTournamentId===snapshot._scsClientTournamentId){current._scsCloudTournamentId=id;localStorage.setItem(localKey,JSON.stringify(current));if(context&&mixedContext===context&&groupEventId===eventId)context.onSave(current);}
  if(indicator)indicator.textContent=window.SCSTournamentLocal?SCSTournamentLocal.describe():'✓ Saved to server';return true;
 }catch(e){if(indicator)indicator.textContent='⚠ '+(e.message||'Server save failed; local copy retained.');return false;}
 finally{groupSaveBusy=false;if(button)button.disabled=false;}
}
async function syncGroupTournamentNow(){
 if(groupHome)throw Error('Open an event first.');
 if(!cloudTournamentId||typeof window.dbLoadTournamentById!=='function')throw Error('Save this event to the server before syncing.');
 const eventId=groupEventId,ref=cloudTournamentId;
 const row=await window.dbLoadTournamentById(ref);if(groupEventId!==eventId||cloudTournamentId!==ref)throw Error('The event changed while syncing. Open the intended event and retry Sync.');if(!row||!row.state)throw Error('Event was not found on the server.');
 const step=assistStep;applyState(JSON.parse(JSON.stringify(Object.assign({},row.state,{_scsCloudTournamentId:row.id||cloudTournamentId}))));assistStep=step;
 if(!viewOnly)localStorage.setItem(groupEventId?groupEventKey(groupEventId):KEY,JSON.stringify(Object.assign({},row.state,{_scsCloudTournamentId:row.id||cloudTournamentId})));
 render();return true;
}
function applyState(v){if(!v)return;v=window.SCSEventCourtPool?.reconcile(v,groupMain,groupEventId)||v;eventCourtNumbers=Array.isArray(v.courtNumbers)?v.courtNumbers:null;groupSwapSelection=null;lastGroupSwap=null;groupExpanded={};cloudTournamentId=v._scsCloudTournamentId||'';clientTournamentId=v._scsClientTournamentId||'';title=String(v.title||'Group Stage + Knockout');scoringRules=v.scoringRules||null;config=v.config||config;created=!!v.created;assistMode=typeof v.assistMode==='boolean'?v.assistMode:!created;assistPatternReady=!!v.assistPatternReady;pool=Array.isArray(v.pool)?v.pool:[];groupSelectedPlayerDetails=Array.isArray(v.selectedPlayerDetails)?v.selectedPlayerDetails:[];assignments=v.assignments||{};teamDrafts=Array.isArray(v.teamDrafts)?cleanTeamDrafts(v.teamDrafts):Object.keys(assignments).sort().map(k=>assignments[k]).filter(x=>Array.isArray(x)&&x.length===2);started=!!v.started;matches=Array.isArray(v.matches)?v.matches:[];courtCount=Number.isInteger(Number(v.courtCount))?Number(v.courtCount):2;assignmentSerial=Number(v.assignmentSerial)||0}
function open(mode,viewState){
 const existing=el();if(existing)existing.hidden=false;
 mixedContext=null;
 resultsPage='group';resultsGroup=0;resultsExpanded={};
 viewOnly=mode==='view';if(viewOnly){groupMain=null;groupEventId=null;groupHome=false;assistMode=false}if(!viewOnly){if(mode==='new'){window.ScsApi.events.requestCreate({onCreate:name=>{groupMain={title:name,events:[],activeEventId:null,id:groupId()};groupMainSave();if(!el()){let d=document.createElement('div');d.id='scsGroupTournament';d.className='scs-gt-overlay';document.body.appendChild(d)}groupHomeRender()},onCancel:()=>{if(typeof window.scsReturnToTournamentParent==='function')window.scsReturnToTournamentParent()}});return}groupEnsureMain();if(mode!=='new'){if(!el()){let d=document.createElement('div');d.id='scsGroupTournament';d.className='scs-gt-overlay';document.body.appendChild(d)}groupHomeRender();return;}if(!el()){let d=document.createElement('div');d.id='scsGroupTournament';d.className='scs-gt-overlay';document.body.appendChild(d)}groupAddEvent();return;}if(viewOnly)applyState(JSON.parse(JSON.stringify(viewState||{})));else load();assistStep=0;
 // Creation must enter Assist, never the legacy organizer page.
 // Continue retains an existing started tournament's organizer interface.
 if(mode==='new'){
  if(started||created){
   if(!confirm('Start a new Group Stage + Knockout? Your existing saved tournament will be replaced.'))return;
    title='';config={groups:4,per:4,knockouts:1,top:2,bottom:1};pool=[];teamDrafts=[];assignments={};matches=[];
   started=false;created=false;assistPatternReady=false;assignmentSerial=0;
  }
  cloudTournamentId='';clientTournamentId='';
  if(typeof window.scsResetTournamentCloudIdentity==='function')window.scsResetTournamentCloudIdentity('group');
  assistMode=true;save();
 }else if(!started){
  // Saved-but-unstarted tournaments return to the Assist index.
  assistMode=true;save();
 }
 if(!el()){let d=document.createElement('div');d.id='scsGroupTournament';d.className='scs-gt-overlay';document.body.appendChild(d)}
 render();
}
function close(){if(mixedContext){groupHomeRender();return}el()?.remove();if(typeof window.scsRefreshTournamentHeader==='function')window.scsRefreshTournamentHeader();if(window.scsTournamentReturnPage&&typeof window.scsReturnToTournamentParent==='function')window.scsReturnToTournamentParent()}
function updateCompletedScore(id,score,winner){
 const m=matches.find(v=>String(v.id)===String(id));
 if(!m||viewOnly||!m.score||!score?.finished)return false;
 m.score=score;m.winner=winner;save();render();return true;
}
function card(title,body){return '<section class="scs-gt-card"><h3>'+title+'</h3>'+body+'</section>'}
function groupSetupStatus(){
 const count=teamDrafts.filter(team=>Array.isArray(team)&&team.length===2&&team.every(name=>String(name||'').trim())).length;
 const groups=Number(config.groups),per=count/groups;
 const sizes=Array.from({length:Math.min(64,Math.floor(count/2))},(_,i)=>i+1).filter(n=>count%n===0);
 let message='';
 if(count<2)message='Form at least 2 complete teams before setting up groups.';
 else if(!Number.isInteger(groups)||groups<1)message='Enter the number of groups to calculate teams per group.';
 else if(groups>64||!Number.isInteger(per)||per<2)message=count+' teams cannot be split equally into '+groups+' groups with at least 2 teams each. Choose '+sizes.join(', ')+' groups.';
 const distributionValid=!message;
 if(distributionValid)message=count+' teams ÷ '+groups+' groups = '+per+' teams per group.';
 const qualifiersValid=Number.isInteger(config.knockouts)&&config.knockouts>=1&&config.knockouts<=2&&Number.isInteger(config.top)&&config.top>=1&&(config.knockouts!==2||(Number.isInteger(config.bottom)&&config.bottom>=1))&&config.top+(config.knockouts===2?config.bottom:0)<=per;
 if(distributionValid&&!qualifiersValid)message+=' Qualifiers must be positive whole numbers and cannot exceed '+per+' teams per group in total.';
 return {count,per:distributionValid?per:0,distributionValid,valid:distributionValid&&qualifiersValid,message};
}
function refreshGroupSetup(){
 const status=groupSetupStatus();config.per=status.per;
 const root=el();if(!root)return;
 root.querySelectorAll('[data-config]').forEach(input=>{const key=input.dataset.config;if(key==='groups')return;input.disabled=!status.distributionValid;if(key==='per')input.value=status.per||''});
 const note=root.querySelector('[data-group-setup-status]');if(note){note.textContent=status.message;note.classList.toggle('is-invalid',!status.valid)}
 const done=root.querySelector('[data-assist-done="2"],[data-action="create"]');if(done)done.disabled=!status.valid;
}
function setup(standalone=false){
 const status=groupSetupStatus();config.per=status.per;
 let fields=[['groups','Number of groups',config.groups||''],['per','Teams per group (automatic)',config.per||''],['knockouts','Number of knockouts (1 or 2)',config.knockouts],['top',config.knockouts===1?'Qualifiers per group':'Top knockout qualifiers per group',config.top]];
 if(config.knockouts===2)fields.push(['bottom','Bottom knockout qualifiers per group',config.bottom]);
 return card(standalone?'Setup Groups':'Create Group Stage + Knockout',(standalone?'':'<label class="scs-gt-title-field">Tournament name<input type="text" maxlength="120" data-title required value="'+escapeHTML(title)+'" placeholder="e.g. Autumn Club Championship"></label>')+'<p><strong>'+status.count+' formed teams available</strong></p><div class="scs-gt-fields">'+fields.map(([key,label,val])=>'<label>'+label+'<input type="number" min="1" '+(key==='knockouts'?'max="2"':'max="64"')+' '+(key==='per'?'readonly aria-readonly="true" ':'')+(key!=='groups'&&!status.distributionValid?'disabled ':'')+' data-config="'+key+'" value="'+val+'"></label>').join('')+'</div><p data-group-setup-status role="status" aria-live="polite" class="'+(status.valid?'':'is-invalid')+'">'+escapeHTML(status.message)+'</p><p>Top knockout selects the highest-ranked teams in each group. Bottom knockout selects the next positions, without duplicates.</p><button class="scs-gt-primary" data-action="create" '+(status.valid?'':'disabled')+'>Create Groups</button>');
}
function registry(){
 const names=[];function add(items){(Array.isArray(items)?items:[]).forEach(p=>{let n=typeof p==='string'?p:p&&p.name;if(n&&String(n).trim())names.push(String(n).trim())})}
 try{if(typeof schedulerState!=='undefined'&&schedulerState)add(schedulerState.allPlayers)}catch(e){}
 try{add(JSON.parse(localStorage.getItem('schedulerPlayers')||'[]'))}catch(e){}
 try{if(window.SCSCourtCenter&&typeof window.SCSCourtCenter.playerNames==='function')add(window.SCSCourtCenter.playerNames())}catch(e){}
 return [...new Map(names.map(n=>[n.toLocaleLowerCase(),n])).values()].sort((a,b)=>a.localeCompare(b));
}
function assignedNames(){return Object.values(assignments).flat().filter(Boolean)}
function groupLabel(i){let out='';do{out=String.fromCharCode(65+i%26)+out;i=Math.floor(i/26)-1}while(i>=0);return out}
// Approved scoreboard results are the single source for both group standings
// and Match Center Completed. Never use initial slot positions as rankings.
function groupResults(g){
 if(started){const official=SCSTournamentEngine.ensure('group-standings',{config,matches,group:g},refreshGroupComputedView);if(Array.isArray(official?.standings))return official.standings;}
 // Before play this is the entered roster order, not a calculated ranking.
 if(!started)return Array.from({length:config.per},(_,j)=>({id:g+':'+j,w:0,l:0,gw:0,gl:0,pf:0,pa:0,played:0}));
 return [];
}
function groupSwapAllowed(){return !viewOnly&&!startingEvent&&(!started||matches.length>0)}
function canSwapGroupTeam(id){
 if(!groupSwapAllowed())return false;
 const pair=assignments[id];if(!Array.isArray(pair)||pair.length!==2||pair.some(name=>!String(name||'').trim()))return false;
 return !matches.some(m=>(m.a===id||m.b===id)&&(m.court||m.score||m.winner||m.startedAt||m.started_at||m.completedOrder||m.status&&m.status!=='pending'));
}
function groupSwapControls(){
 return '<p class="scs-group-swap-status" role="status">'+(groupSwapSelection?'Selected Group '+groupLabel(Number(groupSwapSelection.split(':')[0]))+' · Team '+(Number(groupSwapSelection.split(':')[1])+1)+'. Choose a team in another group.':'Tap Swap on a team, then choose a team in another group. Players stay together. Assigned or played teams are locked.')+'</p>'+(groupSwapSelection?'<button type="button" data-group-swap-cancel>Cancel selection</button>':'')+(lastGroupSwap&&canSwapGroupTeam(lastGroupSwap.source)&&canSwapGroupTeam(lastGroupSwap.target)?'<button type="button" data-group-swap-undo>Undo swap</button>':'');
}
function selectGroupTeamSwap(id){
 if(!groupSwapAllowed())return false;
 if(!canSwapGroupTeam(id)){alert('This team is assigned or has already played. Choose an unassigned, unplayed team.');return false}
 const pair=assignments[id];if(!Array.isArray(pair)||pair.length!==2||pair.some(n=>!String(n||'').trim())){alert('Form complete teams and confirm group setup first.');return false}
 if(groupSwapSelection===id){groupSwapSelection=null;render();return true}
 if(!groupSwapSelection){groupSwapSelection=id;render();return true}
 const source=groupSwapSelection;
 if(!canSwapGroupTeam(source)){groupSwapSelection=null;render();return false}
 if(source.split(':')[0]===id.split(':')[0]){alert('Choose a team in another group.');return false}
 const original=assignments[source];if(!Array.isArray(original)||original.length!==2){groupSwapSelection=null;render();return false}
 lastGroupSwap={source,target:id,beforeSource:original.slice(),beforeTarget:pair.slice()};
 assignments[source]=pair.slice();assignments[id]=original.slice();groupSwapSelection=null;workerGroupStandings=Object.create(null);save();render();return true;
}
function undoGroupTeamSwap(){
 if(!groupSwapAllowed()||!lastGroupSwap||!canSwapGroupTeam(lastGroupSwap.source)||!canSwapGroupTeam(lastGroupSwap.target))return false;
 const s=lastGroupSwap;if(JSON.stringify(assignments[s.source])!==JSON.stringify(s.beforeTarget)||JSON.stringify(assignments[s.target])!==JSON.stringify(s.beforeSource))return false;
 assignments[s.source]=s.beforeSource.slice();assignments[s.target]=s.beforeTarget.slice();workerGroupStandings=Object.create(null);lastGroupSwap=null;groupSwapSelection=null;save();render();return true;
}
function rememberGroupExpanded(group,expanded){groupExpanded[group]=expanded}
function groupRoster(){
 return Array.from({length:config.groups},(_,g)=>{
  const slots=Array.from({length:config.per},(_,i)=>({id:g+':'+i,index:i,pair:assignments[g+':'+i]||[]})).filter(t=>t.pair.length===2&&t.pair.every(Boolean));
  const expanded=groupExpanded[g]===undefined?assistMode&&assistStep===3:groupExpanded[g];
  return '<details class="scs-tm-pool scs-gt-team-pool scs-tm-teams-flat scs-group-disclosure scs-roster-disclosure" data-group-card="'+g+'" '+(expanded?'open ':'')+'ontoggle="SCSGroupTournament.rememberGroupExpanded('+g+',this.open)"><summary class="scs-tm-pool-heading scs-roster-summary"><div><h3>Group '+groupLabel(g)+'</h3><small>'+slots.length+' teams</small></div><span class="scs-roster-chevron" aria-hidden="true">⌄</span></summary><div class="scs-gt-team-card-list">'+slots.map(t=>{
   const selected=groupSwapSelection===t.id,swappable=canSwapGroupTeam(t.id),marker=!viewOnly?'<span class="scs-group-swap-label" aria-hidden="true">'+(swappable?(selected?'Selected':'↔ Swap'):'Locked')+'</span>':'';
   const markup=window.SCSTeamPicker&&SCSTeamPicker.compactTeamCard?SCSTeamPicker.compactTeamCard(t.index,t.pair,groupSelectedPlayerDetails,marker):'<article class="scs-tm-compact-team"><div class="scs-tm-compact-team-head"><span>Team '+(t.index+1)+'</span>'+marker+'</div><div class="scs-tm-compact-players">'+t.pair.map(playerRow).join('')+'</div></article>';
   return markup.replace('<article class="scs-tm-compact-team">','<article class="scs-tm-compact-team scs-group-assignment-team'+(selected?' is-swap-selected':'')+(!swappable&&!viewOnly?' is-swap-locked':'')+'" data-slot="'+t.id+'"'+(swappable?' role="button" tabindex="0" aria-pressed="'+selected+'" aria-label="Swap Team '+(t.index+1)+' in Group '+groupLabel(g)+'"':'')+'>');
  }).join('')+(slots.length?'':'<p class="scs-gt-empty">No teams assigned yet.</p>')+'</div></details>';
 }).join('');
}
function groups(onlyGroup=null,positions=false){
 if(!started&&!positions)return groupRoster();
 return Array.from({length:config.groups},(_,g)=>g).filter(g=>onlyGroup===null||g===onlyGroup).map(g=>{const ranked=groupResults(g);
   if(started&&!ranked.length)return card('Group '+groupLabel(g),'<p role="status">Connect to load official standings.</p>');
   return card('Group '+groupLabel(g),'<div class="scs-gt-standings"><div class="scs-gt-head"><span>Position</span><span>Team</span><span>W</span><span>GD</span><span>PD</span></div>'+ranked.map((t,i)=>{
   const players=assignments[t.id]||[];
   const row='<span>'+(i+1)+'</span><span>'+(players.length?'<span class="scs-gt-team-players">'+players.map(playerRow).join('')+'</span>':'<span class="scs-gt-unassigned">Assign players</span>')+'</span><span>'+(started?t.w:'—')+'</span><span>'+(started?t.gw-t.gl:'—')+'</span><span>'+(started?t.pf-t.pa:'—')+'</span>';
   return started||positions?'<div class="scs-gt-head scs-gt-team scs-gt-result-row">'+row+'</div>':'<button type="button" class="scs-gt-head scs-gt-team" data-slot="'+t.id+'">'+row+'</button>';
  }).join('')+'</div>');
 }).join('');
}
function playerRow(name){
 if(window.SCSTeamPicker&&SCSTeamPicker.rosterRow)return SCSTeamPicker.rosterRow(name,groupSelectedPlayerDetails);
 return '<span class="scs-tm-shared-player"><span class="scs-tm-ring-slot" data-tm-player="'+escapeHTML(name)+'"></span><span class="scs-tm-shared-name">'+escapeHTML(name)+'</span></span>';
}
// Group Assist reuses the Knockout compact-team layout and shared picker.
// These two views were previously referenced without implementations.
let poolExpanded=false,teamsExpanded=false,rosterDetailsExpanded=false;
function rememberRosterExpanded(kind,expanded){if(kind==='players')poolExpanded=expanded;else if(kind==='teams')teamsExpanded=expanded;else if(kind==='manage')rosterDetailsExpanded=expanded}
function rosterDisclosure(markup,kind){return ScsApi.cards.expandableRoster(markup,kind,kind==='players'?poolExpanded:teamsExpanded,"SCSGroupTournament.rememberRosterExpanded('"+kind+"',this.open)")}

function players(){
 const names=pool.length?pool:groupSelectedPlayerDetails.map(p=>p.player||p.name).filter(Boolean);
 return rosterDisclosure('<section class="scs-tm-pool scs-tm-player-pool"><div class="scs-tm-pool-heading"><div><small>TOURNAMENT PLAYERS</small><h3>Players ('+names.length+')</h3></div><div class="scs-tm-pool-actions">'+(!viewOnly?'<button type="button" data-open-manager>+ Players Manager</button>':'')+'</div></div>'+(names.length?'<div class="scs-tm-pool-chips">'+names.map(playerRow).join('')+'</div>':'<p>Select players using Players Manager.</p>')+'</section>','players');
}
function teamsCard(){
 const entries=started?Object.values(assignments).filter(team=>Array.isArray(team)&&team.length):teamDrafts;
 return rosterDisclosure('<section class="scs-tm-pool scs-tm-teams-flat"><div class="scs-tm-pool-heading"><div><small>TOURNAMENT TEAMS</small><h3>Teams ('+entries.length+')</h3></div><div class="scs-tm-pool-actions">'+(!viewOnly&&!started?'<button type="button" data-add-team aria-label="Add team" title="Add team">+</button>':'')+'</div></div>'+(entries.length?'<div class="scs-gt-assist-team-list">'+entries.map((team,i)=>{
 const actions=viewOnly||started?'':'<details class="scs-tm-compact-actions"><summary aria-label="Team '+(i+1)+' actions" title="Team actions">⋮</summary><div class="scs-tm-compact-action-menu"><button type="button" data-edit-team="'+i+'">✎ Edit team</button><button type="button" data-remove-team="'+i+'">− Remove team</button></div></details>';
 return window.SCSTeamPicker&&SCSTeamPicker.compactTeamCard?SCSTeamPicker.compactTeamCard(i,team,groupSelectedPlayerDetails,actions):'<article class="scs-tm-compact-team"><div class="scs-tm-compact-team-head"><span>Team '+(i+1)+'</span>'+actions+'</div><div class="scs-tm-compact-players">'+team.map(playerRow).join('')+'</div></article>';
 }).join('')+'</div>':'<p class="scs-gt-empty">Add a team and choose two players using the shared team picker.</p>')+'</section>','teams');
}
function groupRosterDetails(){return players()+teamsCard()+(groupSwapAllowed()&&Object.keys(assignments).length?'<div class="scs-group-swap-toolbar">'+groupSwapControls()+'</div>':'')+groupRoster()}
function groupEventSchedule(){
 const info='<h3>Schedule & Courts</h3>';
 if(viewOnly)return info+'<p>'+courtCount+' court'+(courtCount===1?'':'s')+' · '+(started?'Event live':'Event not started')+'</p>';
 if(started)return info+'<p>'+courtCount+' court'+(courtCount===1?'':'s')+' · Event live</p><div class="scs-tm-court-picker"><button type="button" data-event-courts="-1" aria-label="Fewer courts">−</button><b>'+courtCount+'</b><button type="button" data-event-courts="1" aria-label="More courts">+</button></div><button type="button" class="scs-gt-primary" data-open-group-match>Open Assign &amp; Approve →</button>';
 const ready=created&&assistComplete(2)&&assistComplete(3);
 return info+'<p>Review the groups and choose courts before starting.</p><div class="scs-tm-court-picker"><button type="button" data-event-courts="-1" aria-label="Fewer courts">−</button><b data-event-court-count>'+courtCount+'</b><button type="button" data-event-courts="1" aria-label="More courts">+</button></div><button type="button" class="scs-gt-primary" data-start '+(ready?'':'disabled')+'>▶ Start Event</button>'+(!ready?'<p>Complete and confirm event setup to enable Start Event.</p>':'')+'<button type="button" data-open-group-assist>'+(created?'Edit event setup':'Complete event setup')+'</button>';
}
function groupEventRules(){return scoringRules||{matchSets:3,setRules:[{win:15,max:21},{win:15,max:21},{win:11,max:11}]}}
function groupRulesSummary(){const rules=groupEventRules();return (rules.matchSets===1?'1 set':'Best of 3 sets')+' · '+rules.setRules.map((r,i)=>'Set '+(i+1)+': '+r.win+(r.max===r.win?' points':' points, win by 2, max '+r.max)).join(' · ')}
function groupRulesSettings(){
 const rules=groupEventRules(),defaults=[{win:15,max:21},{win:15,max:21},{win:11,max:11}];
 return '<section class="scs-overview-card scs-event-scoring-settings" data-group-rules><h3>Scoring rules</h3><label>Match format<select data-group-rule-count '+(viewOnly?'disabled':'')+'><option value="1" '+(rules.matchSets===1?'selected':'')+'>1 set</option><option value="3" '+(rules.matchSets===3?'selected':'')+'>Best of 3 sets</option></select></label>'+defaults.map((fallback,i)=>{const r=rules.setRules[i]||fallback;return '<div class="scs-event-rule-row" data-group-rule-set="'+(i+1)+'" '+(i>=rules.matchSets?'hidden':'')+'><strong>Set '+(i+1)+'</strong><label>Points to win<input data-group-rule-win="'+i+'" type="number" min="1" inputmode="numeric" value="'+r.win+'" '+(viewOnly?'disabled':'')+'></label><label>Maximum<input data-group-rule-max="'+i+'" type="number" min="1" inputmode="numeric" value="'+r.max+'" '+(viewOnly?'disabled':'')+'></label></div>'}).join('')+'<p>Win by 2 until the maximum. Set both values equal for first-to scoring.</p>'+(!viewOnly?'<button type="button" data-group-rule-apply>Apply scoring rules</button>':'')+'<p data-group-rule-status role="status">Changes apply to matches that have not started. Matches already started or scored keep their rules.</p></section>';
}
function applyGroupRules(){
 if(viewOnly)return false;const root=el(),count=Number(root.querySelector('[data-group-rule-count]')?.value),rules=[];if(![1,3].includes(count))return false;
 for(let i=0;i<count;i++){const win=Number(root.querySelector('[data-group-rule-win="'+i+'"]').value),max=Number(root.querySelector('[data-group-rule-max="'+i+'"]').value);if(!Number.isInteger(win)||!Number.isInteger(max)||win<1||max<win){root.querySelector('[data-group-rule-status]').textContent='Enter positive whole numbers. Maximum must be at least Points to win.';return false}rules.push({win,max})}
 // Snapshot existing live matches before replacing event defaults.
 matches.filter(m=>m.status==='playing'||m.status==='score_ready'||m.status==='approved'||m.startedAt||m.score).forEach(m=>{if(!m.scoringRules)m.scoringRules=JSON.parse(JSON.stringify(m.score?.setRules?{matchSets:m.score.matchSets,setRules:m.score.setRules}:groupEventRules()))});
 return ScsApi.events.keepEditorPosition(root,'[data-group-rule-count]',()=>{
 scoringRules={matchSets:count,setRules:rules};save();
 const summary=root.querySelector('[data-group-scoring-summary]');if(summary)summary.textContent=groupRulesSummary();
 const status=root.querySelector('[data-group-rule-status]');if(status)status.textContent='Scoring rules applied. Matches already started or scored keep their rules.';
 refreshGroupEventGate();return true;
 });
}
function groupEventView(){
 const holder=document.createElement('div');holder.innerHTML=ScsApi.events.overview({name:title,parent:groupMain?.title||'',format:'Group Stage + Knockout',rules:groupRulesSummary(),teams:Object.values(assignments).map(team=>Array.isArray(team)?team.join(' / '):String(team)),matches,courts:courtCount});
 const schedule=holder.querySelector('[data-event-schedule]');if(schedule)schedule.innerHTML=groupEventSchedule();
 const overview=holder.querySelector('.scs-event-overview');
 const summary=overview?.querySelector('.scs-overview-card')?.querySelectorAll('p');if(summary?.length)summary[summary.length-1].setAttribute('data-group-scoring-summary','');
 if(started){const first=overview?.querySelector('.scs-overview-card');if(first){const badge=first.querySelector('.scs-event-card-status');if(badge)badge.textContent=matches.length&&matches.every(m=>m.status==='approved')?'Group stage completed':'Event live';first.insertAdjacentHTML('beforeend','<p data-group-start-status>Group stage started · '+matches.length+' round-robin matches generated.</p>')}}
 const information=document.createElement('section');information.className='scs-overview-card';information.setAttribute('data-group-event-overview','');information.innerHTML='<h3>Tournament Overview</h3><p>'+config.groups+' groups · '+config.per+' teams per group · '+config.knockouts+' knockout tournament'+(config.knockouts===1?'':'s')+'</p><p>Teams assigned: '+Object.values(assignments).filter(team=>Array.isArray(team)&&team.length===2&&team.every(Boolean)).length+' / '+(config.groups*config.per)+'</p>';
 if(overview){if(schedule)overview.insertBefore(information,schedule);else overview.appendChild(information)}
 if(schedule){schedule.insertAdjacentHTML('beforebegin',groupRosterDetails()+groupRulesSettings());}return holder.innerHTML;
}
function groupMatchPlayer(name){
 const d=groupSelectedPlayerDetails.find(p=>String(p.player||p.name||'').trim().toLocaleLowerCase()===String(name||'').trim().toLocaleLowerCase());
 return SCSSharedMatchCenter.playerIdentity(name,d||{});
}
function hydratePlayerCards(){if(window.SCSTournamentPlayerLevel)window.SCSTournamentPlayerLevel.hydrate(el());}
function openPlayersManager(){if(viewOnly)return false;
 if(viewOnly)return;
 if(!window.ScsApi||!ScsApi.players||typeof ScsApi.players.select!=='function')return;
 window.SCSTournamentPlayersPage.open({selected:groupSelectedPlayerDetails,onDone:function(players){
  groupSelectedPlayerDetails=players;pool=[...new Set(players.map(p=>p.player||p.name).filter(Boolean))];save();render();
 }});
}
function playersManagerReturned(){if(viewOnly)return false;
 if(!window.__scsGroupPlayersReturn)return false;
 window.__scsGroupPlayersReturn=false;
 const names=registry();
 pool=names.filter(n=>{let p=null;try{p=(schedulerState.allPlayers||[]).find(x=>x.name===n)}catch(e){}return !p||p.active!==false});
 save();if(el()){el().hidden=false;render()}return true;
}
function editor(id){if(viewOnly)return false;
 const draftMatch=/^draft:(\d+|new)$/.exec(id);
 if(draftMatch){
  const newTeam=draftMatch[1]==='new',draftIndex=newTeam?teamDrafts.length:Number(draftMatch[1]);if(!Number.isInteger(draftIndex)||draftIndex<0||draftIndex>teamDrafts.length||(!newTeam&&draftIndex===teamDrafts.length))return;
  const old=teamDrafts[draftIndex]||[];
  const used=new Set(teamDrafts.filter((_,i)=>i!==draftIndex).flat().map(n=>String(n).toLowerCase()));
  const names=pool.filter(n=>!used.has(n.toLowerCase()));
  const modal=document.createElement('section');modal.className='scs-tm-entry-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
  modal.innerHTML='<div class="scs-tm-entry-editor"><button type="button" class="scs-tm-entry-close" data-cancel aria-label="Close player assignment">×</button><h3>Entry '+(draftIndex+1)+' · Assign Players</h3><p>Select two players using the shared player cards.</p>'+[1,2].map(num=>'<input type="hidden" data-input="'+num+'" value="'+escapeHTML(old[num-1]||'')+'">').join('')+'<div class="scs-tm-entry-player-preview">'+old.map(playerRow).join('')+'</div><div class="scs-tm-import-actions"><button type="button" data-add-next-team>+ Add Team</button><button type="button" class="scs-tm-primary" data-done>Done</button></div><p class="scs-tm-entry-status" role="status"></p></div>';
  if(!window.SCSTeamPicker){console.error('Shared team picker unavailable');return}el().appendChild(modal);if(window.SCSTeamPicker){const picker=document.createElement('div');picker.className='scs-gt-shared-picker';modal.querySelector('.scs-tm-entry-editor p').after(picker);SCSTeamPicker.render(picker,{names,selected:old,max:2,row:playerRow,onChange:a=>{[1,2].forEach((n,i)=>modal.querySelector('[data-input="'+n+'"]').value=a[i]||'')}})}modal.querySelector('[data-cancel]').onclick=()=>modal.remove();
  const saveDraft=()=>{const picked=[1,2].map(n=>modal.querySelector('[data-input="'+n+'"]').value.trim()),error=modal.querySelector('.scs-tm-entry-status');if(picked.some(n=>!n)){error.textContent='Enter both player names to save this team.';return false}if(picked[0].toLowerCase()===picked[1].toLowerCase()){error.textContent='Choose two different players.';return false}if(picked.some(n=>used.has(n.toLowerCase()))){error.textContent='Player already assigned to another tournament team. Choose an available player.';return false}teamDrafts[draftIndex]=picked;save();return true};
  modal.querySelector('[data-add-next-team]').onclick=()=>{if(!saveDraft())return;if(teamDrafts.length>=64){modal.querySelector('.scs-tm-entry-status').textContent='Maximum 64 teams.';return}modal.remove();render();editor('draft:new')};
  modal.querySelector('[data-done]').onclick=()=>{if(!saveDraft())return;modal.remove();render()};
  hydratePlayerCards();modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();modal.remove()}});modal.onclick=e=>{if(e.target===modal)modal.remove()};return;
 }
 const [gi,ti]=id.split(':').map(Number);
 if(!Number.isInteger(gi)||!Number.isInteger(ti)||gi<0||ti<0||gi>=config.groups||ti>=config.per)return;
 const old=assignments[id]||[];
 const used=new Set(Object.entries(assignments).filter(([k])=>k!==id).flatMap(([,v])=>v).map(n=>n.toLowerCase()));
 const names=pool.filter(n=>!used.has(n.toLowerCase()));
 const modal=document.createElement('section');modal.className='scs-tm-entry-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
 const opts=names.map(n=>'<option value="'+escapeHTML(n)+'">'+escapeHTML(n)+'</option>').join('');
 modal.innerHTML='<div class="scs-tm-entry-editor"><button type="button" class="scs-tm-entry-close" data-cancel aria-label="Close player assignment">×</button><h3>Group '+groupLabel(gi)+' · Team '+(ti+1)+' · Assign Players</h3><p>Select two players using the shared player cards.</p>'+[1,2].map(num=>'<input type="hidden" data-input="'+num+'" value="'+escapeHTML(old[num-1]||'')+'">').join('')+'<div class="scs-tm-entry-player-preview">'+old.map(playerRow).join('')+'</div><div class="scs-tm-import-actions"><button type="button" class="scs-tm-primary" data-done>Done</button></div><p class="scs-tm-entry-status" role="status"></p></div>';
 if(!window.SCSTeamPicker){console.error('Shared team picker unavailable');return}el().appendChild(modal);
 if(window.SCSTeamPicker){const picker=document.createElement('div');modal.querySelector('.scs-tm-entry-editor p').after(picker);SCSTeamPicker.render(picker,{names,selected:old,max:2,row:playerRow,onChange:a=>{[1,2].forEach((n,i)=>modal.querySelector('[data-input="'+n+'"]').value=a[i]||'')}})}
 modal.querySelector('[data-cancel]').onclick=()=>modal.remove();
 
 modal.querySelector('[data-done]').onclick=()=>{
  const picked=[1,2].map(n=>modal.querySelector('[data-input="'+n+'"]').value.trim());
  const error=modal.querySelector('.scs-tm-entry-status');
  if(picked.some(n=>!n)||picked[0].toLowerCase()===picked[1].toLowerCase()){error.textContent='Enter two different players.';return}
  if(picked.some(n=>used.has(n.toLowerCase()))){error.textContent='A player is already assigned to another group team.';return}
  if(started){error.textContent='Teams cannot be changed after the tournament starts.';return}assignments[id]=picked;save();modal.remove();render();
 };
 hydratePlayerCards();
 modal.onclick=e=>{if(e.target===modal)modal.remove()};
}
let startingEvent=false;
async function startTournament(){if(viewOnly||started||startingEvent)return false;if(!SCSEventCourtPool.ready(el()))return false;const issues=groupEventSetupIssues();if(issues.length){alert('Complete Event setup: '+issues.join(' '));return false;}startingEvent=true;const button=el()?.querySelector('[data-start]');if(button)button.disabled=true;try{return await startGroupEventRun()}finally{startingEvent=false;if(button?.isConnected)button.disabled=false}}
async function startGroupEventRun(){if(viewOnly)return false;
 if(!created||!assistComplete(2)||!assistComplete(3)){alert('Complete and confirm event setup first.');return false}
 if(started)return;
 for(let g=0;g<config.groups;g++)for(let t=0;t<config.per;t++)if(!Array.isArray(assignments[g+':'+t])||assignments[g+':'+t].length!==2){alert('Assign all teams before starting the tournament.');tab='groups';render();return}
 if(!confirm('Start Group Stage + Knockout and create all round-robin matches?'))return;
 try{
  if(!window.SCSTournamentEngine)throw Error('Tournament engine is unavailable.');
  const generated=await SCSTournamentEngine.run('group-fixtures',{config,assignments});
  if(!Array.isArray(generated.matches)||!generated.matches.length)throw Error('No fixtures were generated.');matches=generated.matches;
 }catch(error){
  {alert(error.message||'Could not generate group fixtures.');return}
 }
 assignmentSerial=0;workerGroupStandings=Object.create(null);await refreshWorkerGroupStandings(false);
 started=true;assistMode=false;assistStep=0;tab='event';save();render();return true;
}
function groupCourtIds(){return SCSEventCourtPool.ids({courtCount,courtNumbers:eventCourtNumbers});}
function teamBusy(team){return matches.some(m=>['assigned','playing','score_ready'].includes(m.status)&&(m.a===team||m.b===team))}
function groupSchedulingState(){return {_scsCloudTournamentId:cloudTournamentId,_scsClientTournamentId:clientTournamentId,_scsGroupEventId:groupEventId,_scsParentTournamentId:groupMain?._scsClientTournamentId||groupMain?.id,title,started,matches,assignments,courtCount,courtNumbers:eventCourtNumbers};}
function rankMatches(){const ordered=SCSTournamentOrder.forEvent(groupSchedulingState());return {available:ordered.filter(x=>!x.reason).map(x=>x.m),ranked:ordered.map(x=>({m:x.m,reason:x.reason,order:x.order}))};}
function groupCompletedScore(m){
 const sc=m.score;
 if(!sc)return '';
 if(typeof sc==='string')return sc;
 const sets=Array.isArray(sc.completedSets)?sc.completedSets:(Array.isArray(sc.sets)?sc.sets:[]);
 if(sets.length)return sets.map(set=>{
  if(Array.isArray(set.score))return set.score.join('–');
  const a=set.a??set.left,b=set.b??set.right;
  return a!=null&&b!=null?a+'–'+b:'';
 }).filter(Boolean).join('  |  ');
 return Array.isArray(sc.currentScore)?sc.currentScore.join('–'):'';
}
let eventAssignmentStage='group',eventAssignmentSessions=[],eventAssignmentCards=[],eventAssignmentRefreshing=false;
const eventStageScopes=new Map();
function setStageScope(stage,id=groupEventId){if(stage===null){eventStageScopes.delete(String(id));return;}eventStageScopes.set(String(id),String(stage));eventAssignmentStage=stage==='group'?'group':String(stage);}
function eventStageTabs(selected,assignment){
 const scope=eventStageScopes.get(String(groupEventId));if(scope!==undefined||Number(config.knockouts)>1)return '';
 const choices=assignment?[['all','All'],['group','Group']]:[['group','Group']];
 for(let i=0;i<Math.max(1,Math.min(2,Number(config.knockouts)||1));i++)choices.push([String(i),Number(config.knockouts)===2?(i===0?'KO 1':'KO 2'):'Knockout']);
 return '<nav class="scs-results-pages scs-event-stage-tabs" style="--stage-count:'+choices.length+'" aria-label="'+(assignment?'Assignment stages':'Draw and results stages')+'">'+choices.map(([key,label])=>'<button type="button" data-event-stage="'+key+'" data-event-stage-mode="'+(assignment?'match':'draw')+'" aria-pressed="'+(String(selected)===key)+'" class="'+(String(selected)===key?'active':'')+'">'+label+'</button>').join('')+'</nav>';
}
async function openEventStage(stage,mode){
 if(stage==='choose'){const next=await ScsApi.events.chooseEventStage({title},{config});if(next===null)return;stage=next;setStageScope(stage);}
 if(eventStageScopes.has(String(groupEventId))&&stage==='all')stage=eventStageScopes.get(String(groupEventId));
 if(eventStageScopes.has(String(groupEventId))&&stage!=='all')setStageScope(stage);
 if(mode==='match'&&(stage==='all'||stage==='group')){eventAssignmentStage=stage;tab='match';groupHome=false;if(el())el().hidden=false;render();if(stage==='all')await refreshEventAssignments();return;}
 if(stage==='group'){resultsPage='group';tab='main';groupHome=false;if(el())el().hidden=false;render();return;}
 matrixSection='knockout-'+Number(stage);resultsPage='knockout';
 if(!groupKnockoutReady({started,matches})){tab='main';render();return;}
 const opened=await groupKnockoutOpen(Number(stage),mode==='match'?'match':'flowchart');
 if(!opened)return false;
 if(mode==='match'){await new Promise(resolve=>requestAnimationFrame(resolve));await window.SCSEventCourtPool?.whenReady(document.getElementById('scsTournamentOverlay'));window.SCSTournament?.switchTournamentTab('match');await new Promise(resolve=>requestAnimationFrame(resolve));}
 return true;
}
async function refreshEventAssignments(){
 if(eventAssignmentRefreshing)return;eventAssignmentRefreshing=true;const before=JSON.stringify(eventAssignmentSessions);
 const event=groupEventId,club=typeof getMyClub==='function'?getMyClub()?.id:null;
 try{if(club&&typeof sbGet==='function'){const rows=await sbGet('sessions','club_id=eq.'+club+'&status=in.(live,completed)&started_by=eq.__SCS_TOURNAMENT_COURT_CENTER__&order=updated_at.desc&select=id,status,club_id,started_by,rounds_data,updated_at');if(groupEventId!==event)return;eventAssignmentSessions=rows||[];}}
 catch(error){console.warn('Event assignment refresh:',error);}
 finally{eventAssignmentRefreshing=false;}
 if(JSON.stringify(eventAssignmentSessions)!==before&&el()&&!groupHome&&tab==='match'&&eventAssignmentStage==='all'){if(window.ScsApi?.loading)ScsApi.loading.preserve(el(),render);else render();}
}
setInterval(()=>{if(!document.hidden&&el()&&!el().hidden&&!groupHome&&tab==='match'&&eventAssignmentStage==='all')refreshEventAssignments();},8000);
function allEventAssignments(){
 const event={id:groupEventId,title,format:'group'},state={...JSON.parse(localStorage.getItem(groupEventKey(groupEventId))||'{}'),matches,assignments,started,courtCount,courtNumbers:groupCourtIds()},states=[{event,state}];
 for(let i=0;i<Math.max(1,Math.min(2,Number(config.knockouts)||1));i++){const saved=JSON.parse(localStorage.getItem('scs_group_knockout_'+groupEventId+'_'+i)||'null');if(saved)states.push({event,state:saved});}
 const options={events:[event],courtCount:groupMain?.courtCount||courtCount,courtAllocations:groupMain?.courtAllocations||{},eventCourtLimits:groupMain?.eventCourtLimits||{},aliases:[groupMain?.id,groupMain?._scsClientTournamentId].filter(Boolean)};
 const local=window.SCSCourtCenter?.localSession?.(),sessions=local?[...eventAssignmentSessions,local]:eventAssignmentSessions;
 const ranked=SCSTournamentCourts.assignmentModel(options,states,sessions);
 eventAssignmentCards=SCSTournamentCourts.matchList(options,states,sessions,ranked.items).filter(m=>m.status==='approval'||!m.assigned&&['ready','waiting'].includes(m.status));
 return '<section class="scs-assignment-control-card"><div class="scs-tm-live-center-head"><div><h3>Event courts</h3><p>Shared across this event’s stages</p></div><div class="scs-tm-court-picker"><button type="button" data-courts="-1" aria-label="Fewer courts">−</button><b>'+courtCount+'</b><button type="button" data-courts="1" aria-label="More courts">+</button></div></div></section>'+['approval','ready','waiting'].map(status=>{const list=eventAssignmentCards.filter(m=>m.status===status);return '<section class="scs-assignment-section"><h3>'+({approval:'Under approval',ready:'To be assigned',waiting:'Not ready'}[status])+' <span>'+list.length+'</span></h3>'+(list.length?list.map(m=>SCSSharedMatchCenter.matchCard({status:m.status,title:[title,m.stage!=null?(Number(config.knockouts)===2?(Number(m.stage)===0?'KO 1':'KO 2'):'Knockout'):'Group Stage',m.heading.replace(/^Knockout\s+\d+\s*·\s*/i,''),'Match '+m.matchId].join(' · '),pairs:m.pairs,leftLabel:m.labels?.[0],rightLabel:m.labels?.[1],score:m.score,winner:m.winner,note:m.reason,action:!viewOnly&&status!=='waiting'?'data-event-match-action="'+escapeHTML(m.key)+'"':'',actionLabel:status==='approval'?'Review result':'Assign + Start'})).join(''):'<p class="scs-assignment-empty">'+({approval:'No results awaiting approval.',ready:'No matches ready to assign.',waiting:'No matches waiting for earlier results.'}[status])+'</p>')+'</section>';}).join('');
}
function matchCenter(){
 if(eventAssignmentStage==='all')return eventStageTabs('all',true)+allEventAssignments();
 if(!started)return card('Event not started','<p>Start the event from Event setup to assign courts.</p><button type="button" data-event-setup>Event setup →</button>');
 const ordered=rankMatches().ranked,priority=new Map(ordered.map((x,i)=>[x.m.id,i])),waitingReasons=new Map(ordered.map(x=>[x.m.id,x.reason]));
 const courts=Array.from({length:courtCount},(_,i)=>{
  const n=groupCourtIds()[i],m=matches.find(x=>x.court===n&&x.status!=='approved');
  if(!m)return {number:n};
  const ready=m.status==='score_ready',playing=m.status==='playing';
  const sets=m.score&&m.score.completedSets;
  const serving=m.score&&m.score.finished!==true&&Array.isArray(m.score.names)&&Number.isInteger(m.score.server)?m.score.names[m.score.server]||'':'';
  return {number:n,playerRenderer:groupMatchPlayer,match:{status:ready?'AWAITING APPROVAL':playing?'IN PROGRESS':'ASSIGNED (Not Started)',label:m.id+' · Group '+groupLabel(m.group),groupIndex:m.group,left:assignments[m.a]||[],right:assignments[m.b]||[],ready,started:playing||ready,scoreData:m.score,score:Array.isArray(sets)?sets.map(set=>(set.score||[]).join('–')).join(' | '):'',server:serving,winner:m.winner==='L'?'left':m.winner==='R'?'right':null,action:ready?'data-approve="'+escapeHTML(m.id)+'"':playing?'data-score="'+escapeHTML(m.id)+'"':'data-start-match="'+escapeHTML(m.id)+'"',actionLabel:ready?'Approve Result':playing?'View Score':'Start Match',cardAction:'data-group-court-card="'+escapeHTML(m.id)+'"'}};
 });
 const pending=matches.filter(m=>m.status==='pending'&&!m.court);
 const done=matches.filter(m=>m.status==='approved');
 const underApproval=matches.filter(m=>m.status==='score_ready');
 const groupScoreCard=m=>({number:m.id,left:(assignments[m.a]||[]).join(' / '),right:(assignments[m.b]||[]).join(' / '),leftPlayers:assignments[m.a]||[],rightPlayers:assignments[m.b]||[],playerRenderer:groupMatchPlayer,scoreData:m.score,score:groupCompletedScore(m),winner:m.winner==='L'?'left':m.winner==='R'?'right':null,action:m.score?'data-group-completed-score="'+escapeHTML(m.id)+'"':'',actionLabel:m.score?'View Scoreboard':'',cardAction:m.score?'data-group-completed-card="'+escapeHTML(m.id)+'"':''});
 return eventStageTabs('group',true)+'<div class="scs-tm-unified-match-center">'+SCSSharedMatchCenter.panel({matchCards:true,eventTitle:title,courtCount,courts,upcomingOnly:true,orderedWaiting:true,tab:matchTab,hideRanking:true,assigning:null,ranking:standings(),
  waiting:pending.sort((a,b)=>(priority.get(a.id)??99999)-(priority.get(b.id)??99999)).map(m=>({matchStatus:waitingReasons.get(m.id)?'waiting':'ready',number:m.id,groupIndex:m.group,heading:'Group '+groupLabel(m.group),left:(assignments[m.a]||[]).join(' / '),right:(assignments[m.b]||[]).join(' / '),label:m.court?'Assigned · Court '+m.court:waitingReasons.get(m.id)||'Assign + Start',assigned:!!m.court,action:!viewOnly&&!m.court&&m.status==='pending'&&!waitingReasons.get(m.id)?'data-assign="'+escapeHTML(m.id)+'"':''})),
  underApproval:underApproval.map(m=>({...groupScoreCard(m),action:viewOnly?'':'data-approve="'+escapeHTML(m.id)+'"',actionLabel:'Approve Result',cardAction:''})),completed:done.map(groupScoreCard),
  attrs:{change:n=>'data-courts="'+n+'"',choose:n=>'data-choose-court="'+n+'"',cancel:'data-cancel-court',tab:id=>'data-match-tab="'+id+'"'}
 })+'</div>';
}
function tournamentMatches(){
 if(!started)return card('Matches','Start the tournament to generate fixtures.');
 const selected=String(matchesSection||'group-0');
 const sections=Array.from({length:config.groups},(_,g)=>'<button type="button" data-group-matches-section="group-'+g+'" class="'+(selected==='group-'+g?'active':'')+'">Group '+groupLabel(g)+'</button>').join('');
 const knockoutTabs=Array.from({length:Math.max(1,Math.min(2,Number(config.knockouts)||1))},(_,i)=>'<button type="button" data-group-matches-section="knockout-'+i+'" class="'+(selected==='knockout-'+i?'active':'')+'">'+(config.knockouts===2?(i===0?'KO 1':'KO 2'):'Knockout')+'</button>').join('');
 const tabs='<nav class="scs-gt-matrix-tabs scs-gt-matches-tabs" aria-label="Match groups">'+sections+knockoutTabs+'</nav>';
 const categories=[['all','All'],['finished','Finished'],['live','Live'],['not-started','Not Started']];
 const filters='<nav class="scs-gt-matrix-tabs scs-gt-match-status-tabs" aria-label="Match status">'+categories.map(([id,label])=>'<button type="button" data-group-matches-status="'+id+'" class="'+(matchesStatus===id?'active':'')+'">'+label+'</button>').join('')+'</nav>';
 if(selected.startsWith('knockout-'))return '<section class="scs-gt-generated-fixtures"><h3>Generated Matches</h3>'+tabs+filters+'<p class="scs-gt-empty">Knockout fixtures are not yet generated. Results will appear when the knockout stage is implemented.</p></section>';
 const g=Math.max(0,Math.min(config.groups-1,Number(selected.slice(6))||0));
 const ordered=rankMatches().ranked,priority=new Map(ordered.map((x,i)=>[x.m.id,i])),waitingReasons=new Map(ordered.map(x=>[x.m.id,x.reason]));
 const groupMatches=matches.filter(m=>Number(m.group)===g).filter(m=>{
  if(matchesStatus==='finished')return m.status==='approved';
  if(matchesStatus==='live')return m.status==='playing'||m.status==='score_ready'||Boolean(m.court&&m.status!=='approved');
  if(matchesStatus==='not-started')return m.status==='pending'&&!m.court;
  return true;
 }).sort((a,b)=>(priority.get(a.id)??99999)-(priority.get(b.id)??99999));
 return '<section class="scs-gt-generated-fixtures"><h3>Generated Matches</h3>'+tabs+filters+'<section class="scs-ko-fixture-round"><h4>Group '+groupLabel(g)+' · '+groupMatches.length+' matches</h4>'+(groupMatches.length?groupMatches.map(m=>{
  const left=assignments[m.a]||[],right=assignments[m.b]||[];
  const match={number:m.id,title:'Match '+m.id,left:left.join(' / '),right:right.join(' / '),leftPlayers:left,rightPlayers:right,playerRenderer:groupMatchPlayer,scoreData:m.score,score:groupCompletedScore(m),winner:m.winner==='L'?'left':m.winner==='R'?'right':null};
  let matchCard=SCSSharedMatchCenter.completed(match);
  if(m.status!=='approved')matchCard=matchCard.replace('<span class="scs-tm-completed-check">✓</span>','<span class="scs-ko-fixture-pending">○</span>');
  let actions=m.status==='approved'&&m.score?'<button type="button" data-group-completed-score="'+escapeHTML(m.id)+'">View Scoreboard</button>':'';
  if(!viewOnly&&m.status==='pending'&&!m.court)actions='<button type="button" data-assign="'+escapeHTML(m.id)+'">Assign Court</button>';
  if(m.court&&m.status!=='approved')actions='<span>Assigned to Court '+escapeHTML(String(m.court))+'</span>';
  const cardAction=m.status==='approved'&&m.score?' role="button" tabindex="0" data-group-completed-card="'+escapeHTML(m.id)+'"':'';
  return '<div class="scs-ko-fixture-card scs-team-match-shell" data-match-id="'+escapeHTML(m.id)+'"'+cardAction+'>'+matchCard+(actions?'<div class="scs-ko-fixture-actions">'+actions+'</div>':'')+'</div>';
 }).join(''):'<p class="scs-gt-empty">No matches in this category.</p>')+'</section></section>';
}
function standings(){
 if(started&&!SCSTournamentEngine.cached('group-standings',{config,matches,group:0}))return '<p role="status">Connect to load official standings.</p>';
 return Array.from({length:config.groups},(_,g)=>'<section class="scs-gt-standings-summary"><h4>Group '+groupLabel(g)+'</h4>'+groupResults(g).map((t,i)=>'<p>'+(i+1)+'. '+(assignments[t.id]||[]).map(escapeHTML).join(' / ')+' · W '+t.w+' · GD '+(t.gw-t.gl)+' · PD '+(t.pf-t.pa)+'</p>').join('')+'</section>').join('');
}

// Same matrix classes and bottom-sheet UI as Team Tournament; per-group fixtures.
function groupMatrix(onlyGroup=null,hideTabs=false){
 const sections=Array.from({length:config.groups},(_,g)=>'<button type="button" data-group-matrix-section="group-'+g+'" class="'+(matrixSection==='group-'+g?'active':'')+'">Group '+groupLabel(g)+'</button>').join('');
 const knockoutTabs=Array.from({length:Math.max(1,Math.min(2,Number(config.knockouts)||1))},(_,i)=>'<button type="button" data-group-matrix-section="knockout-'+i+'" class="'+(matrixSection==='knockout-'+i?'active':'')+'">'+(config.knockouts===2?(i===0?'KO 1':'KO 2'):'Knockout')+'</button>').join('');
 const selected=String(matrixSection||'group-0');
 const tabs=hideTabs?'':'<nav class="scs-gt-matrix-tabs" aria-label="Matrix stages">'+sections+knockoutTabs+'</nav>';
 if(onlyGroup===null&&selected.startsWith('knockout-')){
  const idx=Number(selected.slice(9))||0;
  const qualifiers=idx===0?config.top:config.bottom;
  return '<section class="scs-team-matrix"><h3>Results Matrix</h3>'+tabs+groupKnockoutPreview(idx)+'</section>';
 }
 const g=Math.max(0,Math.min(config.groups-1,onlyGroup===null?(Number(selected.slice(6))||0):onlyGroup));
 return '<section class="scs-team-matrix"><h3>Round-robin results matrix</h3>'+tabs+'<p>Rank: match wins → head-to-head → set difference → rally point difference. Swipe horizontally; tap a match for results.</p>'+[g].map(g=>{
  const ids=Array.from({length:config.per},(_,i)=>g+':'+i).filter(id=>Array.isArray(assignments[id])&&assignments[id].some(Boolean));
  const rows=groupResults(g),rank=new Map(rows.map((r,i)=>[r.id,i+1]));
  const label=id=>(assignments[id]||[]).filter(Boolean).join(' / ')||'Team '+(Number(id.split(':')[1])+1);
  return '<h4>Group '+groupLabel(g)+'</h4><div class="scs-team-matrix-scroll"><table class="scs-team-matrix-table"><thead><tr><th class="scs-team-matrix-sticky">Team</th>'+ids.map(id=>'<th style="--matrix-accent:#395d91">'+escapeHTML(label(id))+'</th>').join('')+'<th>W–L</th><th>Sets W–L</th><th>Rally F–A</th><th>Point diff.</th><th>Rank</th></tr></thead><tbody>'+ids.map(a=>{
   const r=rows.find(x=>x.id===a);
   return '<tr><th class="scs-team-matrix-sticky" style="--matrix-accent:#395d91">'+escapeHTML(label(a))+'</th>'+ids.map(b=>{
    if(a===b)return '<td class="scs-team-matrix-self">╲</td>';
    const m=matches.find(x=>Number(x.group)===g&&((x.a===a&&x.b===b)||(x.a===b&&x.b===a)));
    if(!m)return '<td>—</td>';
    const done=m.status==='approved'&&['L','R'].includes(m.winner),won=done&&(m.winner==='L'?m.a:m.b)===a;
    return '<td><button type="button" class="scs-team-matrix-cell" data-result="'+(done?(won?'won':'lost'):'pending')+'" data-group-matrix-match="'+escapeHTML(m.id)+'"><small>'+escapeHTML(m.id)+'</small><strong>'+(done?(won?'Won':'Lost'):m.status==='pending'?'Pending':'In progress')+'</strong><span>'+(done?(won?'1–0':'0–1'):'0–0')+'</span></button></td>';
   }).join('')+'<td>'+(r?.w||0)+'–'+(r?.l||0)+'</td><td>'+(r?.gw||0)+'–'+(r?.gl||0)+'</td><td>'+(r?.pf||0)+'–'+(r?.pa||0)+'</td><td>'+((r?.pf||0)-(r?.pa||0))+'</td><td>'+(rank.get(a)||'—')+'</td></tr>';
  }).join('')+'</tbody></table></div>';
 }).join('')+'</section>';
}
function rememberResultExpanded(key,expanded){resultsExpanded[key]=expanded}
function resultDisclosure(key,label,content){
 const open=resultsExpanded[key]!==false;
 return '<details class="scs-group-result-card" data-result-card="'+escapeHTML(key)+'" '+(open?'open ':'')+'ontoggle="SCSGroupTournament.rememberResultExpanded(\''+escapeHTML(key)+'\',this.open)"><summary>'+escapeHTML(label)+'<span class="scs-result-chevron" aria-hidden="true">⌄</span></summary><div class="scs-group-result-content">'+content+'</div></details>';
}
function combinedGroupResults(){
 resultsGroup=Math.max(0,Math.min(Number(config.groups)-1,resultsGroup));
 const top=eventStageTabs(resultsPage==='group'?'group':String(Number(matrixSection.split('-')[1])||0),false);
 if(resultsPage==='knockout'){
  const count=Math.max(1,Math.min(2,Number(config.knockouts)||1)),stage=String(matrixSection).startsWith('knockout-')?Math.max(0,Math.min(count-1,Number(String(matrixSection).slice(9))||0)):0;
  const tabs=count===2?'<nav class="scs-gt-matrix-tabs" aria-label="Knockout stages">'+[0,1].map(i=>'<button type="button" data-results-knockout="'+i+'" class="'+(stage===i?'active':'')+'">'+(i===0?'KO 1':'KO 2')+'</button>').join('')+'</nav>':'';
  return top+'<section data-results-knockout-page>'+groupKnockoutPreview(stage)+'</section>';
 }
 const tabs='<label class="scs-results-group-selector"><span class="scs-results-selector-label">Select group</span><select data-results-group-select aria-label="Select group">'+Array.from({length:config.groups},(_,g)=>{const count=Array.from({length:config.per},(_,i)=>assignments[g+':'+i]).filter(pair=>Array.isArray(pair)&&pair.filter(Boolean).length===2).length;return '<option value="'+g+'" '+(g===resultsGroup?'selected':'')+'>Group '+groupLabel(g)+' · '+count+' teams</option>'}).join('')+'</select></label>';
 const holder=document.createElement('div');holder.innerHTML=groups(resultsGroup,true);const position=holder.firstElementChild;position?.querySelector(':scope>h3')?.remove();
 const chart=document.createElement('div');chart.innerHTML=groupMatrix(resultsGroup,true);chart.querySelector(':scope>section>h3')?.remove();
 const finished=matches.filter(m=>m.status==='approved'&&Number(m.group)===resultsGroup);
 const finishedCards=finished.map(m=>SCSSharedMatchCenter.matchCard({status:'finished',eventTitle:title,stage:'Group '+groupLabel(m.group),number:m.id,leftPlayers:assignments[m.a]||[],rightPlayers:assignments[m.b]||[],score:m.score||groupCompletedScore(m),winner:m.winner==='L'?'left':m.winner==='R'?'right':null,action:m.score?'data-group-completed-score="'+escapeHTML(m.id)+'"':'',actionLabel:'View Scoreboard',cardAction:m.score?'data-group-completed-card="'+escapeHTML(m.id)+'"':''})).join('')||'<p>No finished matches in this group yet.</p>';
 return top+'<section data-results-group-page>'+tabs+resultDisclosure('positions-'+resultsGroup,'Teams Position',position?position.innerHTML:'')+resultDisclosure('chart-'+resultsGroup,'Group Chart',chart.innerHTML)+resultDisclosure('finished-'+resultsGroup,'Finished Matches · '+finished.length,finishedCards)+'</section>';
}
function showGroupMatrixMatch(id){
 const m=matches.find(x=>String(x.id)===String(id)),host=el();if(!m||!host)return;
 host.querySelector('.scs-team-matrix-overlay')?.remove();
 const left=(assignments[m.a]||[]).join(' / '),right=(assignments[m.b]||[]).join(' / ');
 const status={pending:'Not started',assigned:'Assigned',playing:'In progress',score_ready:'Awaiting approval',approved:'Completed'}[m.status]||'Match';
 const leftPlayers=assignments[m.a]||[],rightPlayers=assignments[m.b]||[];
 let resultCard=SCSSharedMatchCenter.completed({number:m.id,title:m.id+' · Group '+groupLabel(m.group)+' · '+status,left,right,leftPlayers,rightPlayers,playerRenderer:groupMatchPlayer,scoreData:m.score,score:groupCompletedScore(m),winner:m.winner==='L'?'left':m.winner==='R'?'right':null,action:m.score?'data-matrix-score':'',actionLabel:'View Scoreboard'});
 if(m.status!=='approved')resultCard=resultCard.replace('<span class="scs-tm-completed-check">✓</span>','<span class="scs-ko-fixture-pending">○</span>');
 const overlay=document.createElement('div');overlay.className='scs-team-matrix-overlay';
 overlay.innerHTML='<div class="scs-team-matrix-backdrop" data-group-matrix-dismiss></div><section class="scs-team-matrix-bottom-sheet" role="dialog" aria-modal="true" aria-label="Match details"><div class="scs-team-matrix-sheet-head"><span class="scs-team-matrix-sheet-label">Match result</span><button type="button" data-group-matrix-dismiss aria-label="Close">✕</button></div><div class="scs-team-matrix-sheet-content scs-group-matrix-result">'+resultCard+'</div></section>';
 host.appendChild(overlay);hydratePlayerCards();
 const close=()=>{overlay.remove();document.removeEventListener('keydown',onKey)};
 const onKey=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);
 overlay.querySelectorAll('[data-group-matrix-dismiss]').forEach(x=>x.addEventListener('click',close));
 overlay.querySelector('[data-matrix-score]')?.addEventListener('click',()=>{if(!window.SCSScoring?.openCompleted)return;host.hidden=true;try{SCSScoring.openCompleted(m.score,()=>{host.hidden=false});close()}catch(err){host.hidden=false;console.error(err)}});
 let y=0;const sheet=overlay.querySelector('.scs-team-matrix-bottom-sheet');sheet.addEventListener('touchstart',e=>{y=e.touches[0].clientY},{passive:true});sheet.addEventListener('touchend',e=>{if(e.changedTouches[0].clientY-y>110&&overlay.querySelector('.scs-team-matrix-sheet-content').scrollTop===0)close()},{passive:true});
 overlay.querySelector('[data-group-matrix-dismiss].scs-team-matrix-sheet-head button')?.focus();
}

function startMatch(id){if(!started)return false;if(viewOnly)return false;const m=matches.find(x=>x.id===id);if(!m||m.status!=='assigned')return;m.scoringRules=JSON.parse(JSON.stringify(groupEventRules()));m.status='playing';m.startedAt=Date.now();save();render()}
function scoreMatch(id){if(!started)return false;if(viewOnly)return false;const m=matches.find(x=>x.id===id);if(!m||m.status!=='playing')return;if(!window.SCSScoring||!SCSScoring.openGroupMatch){alert('Scoreboard is unavailable.');return}el().hidden=true;SCSScoring.openGroupMatch({sessionId:'local-group-'+id,round:1,court:m.court,pair1:assignments[m.a],pair2:assignments[m.b],courtCenter:true,groupId:id,scoringRules:m.scoringRules||groupEventRules(),game:{score:m.score||null}})}
function scoreUpdate(id,score,winner){if(viewOnly)return false;const m=matches.find(x=>x.id===id);if(!m||!['playing','score_ready'].includes(m.status))return false;m.score=score;if(winner){m.winner=winner;m.status='score_ready'}save();render();return true}
async function approveMatch(id){if(viewOnly)return false;const m=matches.find(x=>x.id===id);if(!m||m.status!=='score_ready'||!['L','R'].includes(m.winner)||!m.score||!m.score.finished)return;try{if(!window.SCSTournamentEngine)throw Error('Tournament engine is unavailable.');const approved=await SCSTournamentEngine.run('approve-result',{score:m.score,winner:m.winner,left:m.a,right:m.b});m.status=approved.status}catch(error){alert(error.message||'Could not approve this result.');return}m.completedOrder=++assignmentSerial;m.completedCourt=m.court;m.court=null;workerGroupStandings=Object.create(null);await refreshWorkerGroupStandings(false);save();render();if(groupKnockoutReady({started,matches})&&eventStageScopes.get(String(groupEventId))!=='group')await groupKnockoutOpen(0)}
function assignCourt(id,flow){
 if(viewOnly||!started||!window.SCSEventCourtPool?.ready(el()))return false;
 const m=matches.find(x=>x.id===id);
 if(!m||m.court||m.status!=='pending'||viewOnly)return;
 const unavailable=SCSTournamentOrder.check(groupSchedulingState(),id);if(unavailable){alert(unavailable);return false;}
 if(teamBusy(m.a)||teamBusy(m.b)){alert('A team is already assigned to another court.');return}
 if(!window.SCSCourtAssignmentPopup?.open){console.error('Shared court assignment popup unavailable');return}
 return SCSCourtAssignmentPopup.open({startOnAssign:true,title:m.id+' · Group '+groupLabel(m.group),onClose:flow?.onClose,
  loadScoringPassword:()=>window.scsMatchScoringPassword('get',cloudTournamentId,m.id),
  saveScoringPassword:value=>window.scsMatchScoringPassword('set',cloudTournamentId,m.id,value),
  courts:groupCourtIds().map(n=>({number:n,occupied:matches.some(x=>x.court===n&&x.status!=='approved')})),
  onChoose:async n=>{
   if(viewOnly||!started)return false;
   if(SCSTournamentOrder.check(groupSchedulingState(),id)||!groupCourtIds().includes(n)||m.status!=='pending'||m.court||teamBusy(m.a)||teamBusy(m.b)||matches.some(x=>x.court===n&&x.status!=='approved'))return false;
   m.court=n;m.status='playing';m.scoringRules=JSON.parse(JSON.stringify(groupEventRules()));m.startedAt=Date.now();m.assignedOrder=++assignmentSerial;assigningMatch=null;save();render();if(flow?.afterAssign)await flow.afterAssign();return await SCSTournamentScores.publishAssignment();
  }
 });
}
// Group Assist uses existing player, setup, group assignment and match cards.
// The local group record is a draft until Step 4 confirms it.
function assistComplete(step){
 if(step===1)return teamDrafts.length>=2&&teamDrafts.every(team=>Array.isArray(team)&&team.length===2&&team[0]&&team[1]);
 if(step===2)return assistPatternReady&&groupSetupStatus().valid&&config.per===groupSetupStatus().per;
 if(step===3){for(let g=0;g<config.groups;g++)for(let t=0;t<config.per;t++)if(!Array.isArray(assignments[g+':'+t])||assignments[g+':'+t].length!==2)return false;return true}
 if(step===4)return created;
 return false;
}
function assistIndex(){
 const names=['Players and Teams','Setup Groups','Assign Teams to Groups','Confirm and Save'],colors=['#0f766e','#6d28d9','#b45c24','#2563eb'];
 return ScsApi.events.assist({title:'Group Stage + Knockout Assist',closeAction:'data-action="close"',steps:names.map((name,i)=>({name,color:colors[i],available:i===0||assistComplete(i),done:assistComplete(i+1),action:'data-assist-step="'+(i+1)+'"'}))}).replace(/<header>[\s\S]*?<\/header>/,'')+'<button type="button" class="scs-gt-primary" data-action="close">Done</button>';
}
function assistView(){
 if(assistStep===1)return players()+teamsCard()+'<button class="scs-gt-primary" data-assist-done="1">Done</button>';
 if(assistStep===2)return setup(true).replace('data-action="create"','data-assist-done="2"').replace('Create Groups</button>','Done</button>');
 if(assistStep===3)return card('Assign Teams to Groups',groupSwapControls())+groups()+'<button class="scs-gt-primary" data-assist-done="3">Done</button>';
 if(assistStep===4)return card('Confirm and Save','<h3>'+escapeHTML(title)+'</h3><p>'+config.groups+' groups · '+config.per+' teams per group · '+config.knockouts+' knockout tournament'+(config.knockouts===1?'':'s')+'</p><p>'+Object.keys(assignments).length+' / '+(config.groups*config.per)+' teams assigned.</p><button class="scs-gt-primary" data-assist-done="4">Done</button>');
 return assistIndex();
}
function assistDone(step){if(viewOnly)return false;
 if(step===2){const status=groupSetupStatus();if(!status.valid){alert(status.message);refreshGroupSetup();return}config.per=status.per;if(config.per<2||config.groups<1||config.knockouts<1||config.knockouts>2||config.top+(config.knockouts===2?config.bottom:0)>config.per){alert('Check the group and qualifier settings.');return}if(teamDrafts.length!==config.groups*config.per){alert('Team count must equal Groups × Teams per group ('+(config.groups*config.per)+').');return}assistPatternReady=true;groupSwapSelection=null;lastGroupSwap=null;const expected=Array.from({length:config.groups*config.per},(_,i)=>Math.floor(i/config.per)+':'+(i%config.per)),key=team=>JSON.stringify((team||[]).slice().sort());const preserve=Object.keys(assignments).length===expected.length&&expected.every(k=>Array.isArray(assignments[k])&&assignments[k].length===2)&&JSON.stringify(expected.map(k=>key(assignments[k])).sort())===JSON.stringify(teamDrafts.map(key).sort());if(!preserve){assignments={};teamDrafts.forEach((team,index)=>{const g=Math.floor(index/config.per),t=index%config.per;assignments[g+':'+t]=team.slice()})}}
 if(step===3)groupSwapSelection=null;
 if(step===4){if(!assistComplete(3)){alert('Complete team assignments first.');return}created=true;assistMode=false;assistFromEvent=false;tab='event'}
 if(assistFromEvent){assistMode=false;assistFromEvent=false;tab='event'}
 save();assistStep=0;render();
}
function view(){
if(tab==='event')return groupEventView();

if(tab==='main')return combinedGroupResults();
if(tab==='players')return groupRosterDetails();
if(tab==='groups')return groups();
if(tab==='knockouts')return card('Knockout 1 — Top','<p>'+config.top+' qualifying positions per group</p><p class="scs-gt-empty">No qualified teams yet.</p>')+(config.knockouts===2?card('Knockout 2 — Bottom','<p>'+config.bottom+' qualifying positions per group</p><p class="scs-gt-empty">No qualified teams yet.</p>'):'');
return matchCenter();
}
function groupEventSetupIssues(checkForm=true){
 if(viewOnly||started)return [];
 const status=groupSetupStatus(),extra=[];
 if(!status.valid&&status.count>=2)extra.push(status.message);
 const teamKey=team=>JSON.stringify((team||[]).map(String).slice().sort());
 const assigned=status.valid?Array.from({length:status.count},(_,i)=>assignments[Math.floor(i/status.per)+':'+(i%status.per)]):[];
 const assignedValid=status.valid&&Number(config.per)===status.per&&assigned.every(team=>Array.isArray(team)&&team.length===2)&&JSON.stringify(assigned.map(teamKey).sort())===JSON.stringify(teamDrafts.map(teamKey).sort());
 if(status.valid&&!assignedValid)extra.push('Assign all current teams to their group positions and confirm the group setup.');
 if(assignedValid&&!created)extra.push('Confirm and save the event setup.');
 const rules=groupEventRules();if(checkForm)extra.push(...ScsApi.events.ruleFormIssues(el(),rules,'[data-group-rule-count]',i=>'[data-group-rule-win="'+i+'"]',i=>'[data-group-rule-max="'+i+'"]'));
 return ScsApi.events.setupIssues({title,teams:teamDrafts,courts:courtCount,rules,extra});
}
function openGroupEventAssistStep(step){
 if(viewOnly||started)return;
 if(step>1&&!assistComplete(step-1))return;
 assistFromEvent=true;assistMode=true;assistStep=step;save();render();
}
function groupEventAssistSteps(){
 const status=groupSetupStatus(),rules=groupEventRules();
 const teamsReady=ScsApi.events.setupIssues({title:'Event',teams:teamDrafts,courts:1}).length===0;
 const key=t=>JSON.stringify((t||[]).map(String).slice().sort());
 const assigned=status.valid?Array.from({length:status.count},(_,i)=>assignments[Math.floor(i/status.per)+':'+(i%status.per)]):[];
 const assignmentsReady=status.valid&&Number(config.per)===status.per&&assigned.every(t=>Array.isArray(t)&&t.length===2)&&JSON.stringify(assigned.map(key).sort())===JSON.stringify(teamDrafts.map(key).sort());
 const scoringReady=ScsApi.events.validScoringRules(rules)&&ScsApi.events.ruleFormIssues(el(),rules,'[data-group-rule-count]',i=>'[data-group-rule-win="'+i+'"]',i=>'[data-group-rule-max="'+i+'"]').length===0;
 return [
  {label:'Event name',done:!!String(title).trim(),run:()=>{const name=prompt('Event name',title);if(name?.trim()){title=name.trim().slice(0,120);save();render();}}},
  {label:'Players and Teams',done:teamsReady,run:()=>openGroupEventAssistStep(1)},
  {label:'Group settings',done:status.valid,available:teamsReady,run:()=>openGroupEventAssistStep(2)},
  {label:'Assign Teams to Groups',done:assignmentsReady,available:assistComplete(2),run:()=>openGroupEventAssistStep(3)},
  {label:'Scoring rules',done:scoringReady,run:()=>ScsApi.events.revealSetupField(el().querySelector('[data-group-rule-count]'))},
  {label:'Courts',done:Number.isInteger(Number(courtCount))&&courtCount>0,run:()=>ScsApi.events.revealSetupField(el().querySelector('[data-event-courts]'))},
  {label:'Confirm and Save',done:!!created,available:teamsReady&&status.valid&&assignmentsReady,run:()=>openGroupEventAssistStep(4)}
 ];
}
function refreshGroupEventGate(){ScsApi.events.gateNavigation(el(),'data-group-nav',groupEventSetupIssues(),!assistMode&&tab==='event',groupEventAssistSteps());}
function allowGroupEventNavigation(target){if(!['tournament','match'].includes(target))return true;const issues=groupEventSetupIssues();if(!issues.length)return true;alert('Complete Event setup: '+issues.join(' '));return false;}
function tournamentBottomNav(assisting){
 const active=assisting?(assistStep===1?'event':assistStep>=2?'tournament':'event'):tab==='event'||tab==='players'?'event':tab==='match'?'match':'tournament';
 return ScsApi.navigation.bottom({active,attribute:'data-group-nav',ariaLabel:'Group Stage + Knockout sections',tournamentName:groupMain?.title||'',eventName:title});
}
function render(){if(!viewOnly&&!started&&!groupHome&&!assistMode&&['main','match','groups','knockouts'].includes(tab)&&groupEventSetupIssues(false).length)tab='event';if(el()&&window.ScsApi?.tournamentAccess)ScsApi.tournamentAccess.attach(el(),viewOnly);
if(!el())return;
if(groupHome){groupHomeRender();return;}
const assisting=!viewOnly&&assistMode&&!started;
let body;
if(assisting)body=assistStep===0?assistIndex():assistView();
else body='<header><strong>'+escapeHTML(title)+'</strong><div class="scs-team-save-actions"><button type="button" data-group-save-now '+(viewOnly?'disabled':'')+'>Save Tournament</button><button data-action="close" aria-label="Close">✕</button></div></header><div data-group-save-status role="status" aria-live="polite"></div>'+view();
el().innerHTML='<div class="scs-gt-sheet'+(assisting?' scs-gt-standalone-sheet'+(assistStep===0?' scs-gt-assist-index-sheet':' scs-gt-assist-detail-sheet'):'')+(!assisting&&tab==='main'&&tournamentView==='matches'?' scs-ko-generated-fixtures scs-gt-matches-page':'')+'" role="dialog" aria-modal="true">'+body+'</div>'+tournamentBottomNav(assisting);
groupPageTitle(assisting?['Group Assist','Players & Teams','Setup Groups','Assign Teams','Confirm & Save'][assistStep]:({event:'Event',players:'Players & Teams',match:'Assign & Approve',groups:'Groups',knockouts:'Knockout'}[tab]||'Draw & Results'));
el().querySelector('[data-group-save-now]')?.addEventListener('click',saveGroupTournamentNow);
const closeButton=el().querySelector('[data-action="close"]');if(closeButton)closeButton.onclick=()=>{if(assistFromEvent&&assistMode){assistFromEvent=false;assistMode=false;tab='event';save();render()}else close()};
el().querySelectorAll('[data-assist-step]').forEach(x=>x.onclick=()=>{assistStep=Number(x.dataset.assistStep);render()});
const back=el().querySelector('[data-assist-home]');if(back)back.onclick=()=>{assistStep=0;if(assistFromEvent){assistMode=false;assistFromEvent=false;tab='event'}save();render()};
el().querySelectorAll('[data-assist-done]').forEach(x=>x.onclick=()=>assistDone(Number(x.dataset.assistDone)));
el().querySelector('[data-group-rule-count]')?.addEventListener('change',event=>ScsApi.events.keepEditorPosition(el(),'[data-group-rule-count]',()=>{el().querySelectorAll('[data-group-rule-set]').forEach(row=>row.hidden=Number(row.dataset.groupRuleSet)>Number(event.target.value));refreshGroupEventGate();}));
 el().querySelector('[data-group-rule-apply]')?.addEventListener('click',applyGroupRules);
 el().querySelectorAll('[data-config]').forEach(input=>{
 if(input.dataset.config==='per')return;
 const update=()=>{config[input.dataset.config]=input.value===''?0:Number(input.value);assistPatternReady=false;refreshGroupSetup();save()};
 input.oninput=update;input.onchange=()=>{update();if(input.dataset.config==='knockouts')render()};
});
 const titleInput=el().querySelector('[data-title]');if(titleInput)titleInput.onchange=()=>{title=titleInput.value.trim().slice(0,120);save();render()};
 const toggle=el().querySelector('[data-toggle-pool]');if(toggle)toggle.onclick=()=>{poolExpanded=!poolExpanded;render()};const manager=el().querySelector('[data-open-manager]');if(manager)manager.onclick=openPlayersManager;hydratePlayerCards();
 el().querySelectorAll('[data-edit-team]').forEach(x=>x.onclick=()=>editor('draft:'+x.dataset.editTeam));
 const addTeam=el().querySelector('[data-add-team]');if(addTeam)addTeam.onclick=()=>{if(teamDrafts.length>=64){alert('Maximum 64 teams.');return}editor('draft:new')};
 el().querySelectorAll('[data-remove-team]').forEach(x=>x.onclick=e=>{e.stopPropagation();teamDrafts.splice(Number(x.dataset.removeTeam),1);save();render()});
el().querySelectorAll('[data-slot]').forEach(x=>{x.onclick=()=>selectGroupTeamSwap(x.dataset.slot);x.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectGroupTeamSwap(x.dataset.slot)}}});el().querySelector('[data-group-swap-cancel]')?.addEventListener('click',()=>{groupSwapSelection=null;render()});el().querySelector('[data-group-swap-undo]')?.addEventListener('click',undoGroupTeamSwap);
let start=el().querySelector('[data-start]');if(start)start.onclick=startTournament;
 el().querySelector('[data-event-setup]')?.addEventListener('click',()=>{assistMode=false;assistStep=0;tab='event';render()});
 el().querySelector('[data-open-group-match]')?.addEventListener('click',()=>{assistMode=false;tab='match';render()});
 el().querySelector('[data-open-group-assist]')?.addEventListener('click',()=>{if(viewOnly||started||startingEvent)return;assistFromEvent=true;assistMode=true;assistStep=0;save();render()});
 el().querySelectorAll('[data-event-courts]').forEach(button=>button.onclick=()=>{if(viewOnly||started||startingEvent)return;courtCount=Math.max(1,Math.min(32,courtCount+Number(button.dataset.eventCourts)));save();render()});

 el().querySelectorAll('[data-assign]').forEach(x=>x.onclick=()=>assignCourt(x.dataset.assign));
 el().querySelectorAll('[data-start-match]').forEach(x=>x.onclick=()=>startMatch(x.dataset.startMatch));
 el().querySelectorAll('[data-score]').forEach(x=>x.onclick=()=>scoreMatch(x.dataset.score));
 function openGroupSaved(id,editable=false){const m=matches.find(v=>String(v.id)===String(id));if(!m?.score||!window.SCSScoring?.openCompleted)return;const overlay=el();overlay.hidden=true;try{if(editable&&!viewOnly&&SCSScoring.openEditableCompleted)SCSScoring.openEditableCompleted(m.id,m.score,(score,winner)=>updateCompletedScore(m.id,score,winner));else SCSScoring.openCompleted(m.score,()=>{overlay.hidden=false})}catch(err){overlay.hidden=false;console.error('Group saved scoreboard:',err)}}
 el().querySelectorAll('[data-group-completed-score]').forEach(x=>x.onclick=e=>{e.stopPropagation();openGroupSaved(x.dataset.groupCompletedScore,tab!=='match')});
 el().querySelectorAll('[data-group-completed-card]').forEach(x=>{const open=()=>openGroupSaved(x.dataset.groupCompletedCard,tab!=='match');x.addEventListener('click',e=>{if(!e.target.closest('button,a,input,select'))open()});x.addEventListener('keydown',e=>{if(e.target===x&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open()}})});
 el().querySelectorAll('[data-group-court-card]').forEach(x=>{const open=()=>{const m=matches.find(v=>String(v.id)===x.dataset.groupCourtCard);if(!m)return;if(m.status==='playing')scoreMatch(m.id);else if(m.status==='score_ready'&&m.score)openGroupSaved(m.id,true);else if(m.status==='assigned')startMatch(m.id)};x.addEventListener('click',e=>{if(!e.target.closest('button,a,input,select'))open()});x.addEventListener('keydown',e=>{if(e.target===x&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open()}})});
 el().querySelectorAll('[data-approve]').forEach(x=>x.onclick=()=>approveMatch(x.dataset.approve));
 
 el().querySelectorAll('[data-courts]').forEach(x=>x.onclick=()=>{if(viewOnly||!started)return;courtCount=Math.max(1,Math.min(32,courtCount+Number(x.dataset.courts),...matches.filter(m=>m.court).map(m=>m.court)));save();render()});
 el().querySelectorAll('[data-group-matches-section]').forEach(x=>x.addEventListener('click',()=>{matchesSection=x.dataset.groupMatchesSection;matchesStatus='all';render()}));
 el().querySelectorAll('[data-group-matches-status]').forEach(x=>x.addEventListener('click',()=>{matchesStatus=x.dataset.groupMatchesStatus;render()}));
 el().querySelectorAll('[data-event-stage]').forEach(b=>b.onclick=()=>openEventStage(b.dataset.eventStage,b.dataset.eventStageMode));
 el().querySelector('[data-event-assignment-refresh]')?.addEventListener('click',refreshEventAssignments);
 el().querySelectorAll('[data-event-match-action]').forEach(b=>b.onclick=async()=>{const item=eventAssignmentCards.find(m=>m.key===b.dataset.eventMatchAction);if(!item)return;if(item.stage==null){if(item.status==='approval'){eventAssignmentStage='group';render();}else assignCourt(item.matchId);return;}const opened=await openEventStage(String(item.stage),'match');if(opened&&item.status==='ready'&&window.SCSTournament?.assign)SCSTournament.assign(Number(item.matchId));});
 el().querySelectorAll('[data-group-knockout-continue]').forEach(b=>b.onclick=()=>groupKnockoutOpen(Number(b.dataset.groupKnockoutContinue)));
 el().querySelectorAll('[data-results-page]').forEach(button=>button.onclick=()=>{resultsPage=button.dataset.resultsPage;render();if(resultsPage==='knockout'&&groupKnockoutReady({started,matches}))groupKnockoutOpen(Number(matrixSection.split('-')[1])||0)});
 el().querySelectorAll('[data-results-group-select]').forEach(select=>select.onchange=()=>{resultsGroup=Number(select.value);render()});
 el().querySelectorAll('[data-results-knockout]').forEach(button=>button.onclick=()=>{matrixSection='knockout-'+button.dataset.resultsKnockout;render()});
 el().querySelectorAll('[data-group-matrix-section]').forEach(x=>x.addEventListener('click',()=>{matrixSection=x.dataset.groupMatrixSection;render()}));
 el().querySelectorAll('[data-group-matrix-match]').forEach(x=>x.addEventListener('click',()=>showGroupMatrixMatch(x.dataset.groupMatrixMatch)));
 el().querySelectorAll('[data-tournament-view]').forEach(x=>x.onclick=()=>{tournamentView=x.dataset.tournamentView;render()});
el().querySelectorAll('[data-match-tab]').forEach(x=>x.onclick=()=>{matchTab=x.dataset.matchTab;render()});
 el().querySelectorAll('[data-choose-court]').forEach(x=>x.onclick=()=>{const n=Number(x.dataset.chooseCourt),m=matches.find(y=>y.id===assigningMatch);if(viewOnly||!started||!m||m.court||teamBusy(m.a)||teamBusy(m.b))return;const occupant=matches.find(y=>y.court===n);if(occupant){if(occupant.status!=='assigned'){alert('This court has a started match.');return}if(!confirm('Replace '+occupant.id+' on Court '+n+'?'))return;occupant.court=null;occupant.status='pending';occupant.assignedOrder=0;}m.court=n;m.status='assigned';m.assignedOrder=++assignmentSerial;assigningMatch=null;save();render()});
 const cancelCourt=el().querySelector('[data-cancel-court]');if(cancelCourt)cancelCourt.onclick=()=>{assigningMatch=null;render()};
 el().querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>{tab=x.dataset.tab;render()});
 el().querySelectorAll('[data-group-nav]').forEach(x=>x.onclick=()=>{
  const target=x.dataset.groupNav;if(!allowGroupEventNavigation(target))return;if(viewOnly&&target==='home'){close();return}if(target==='home'){if(groupMain){save();groupHomeRender()}else close();return}if(target==='event'){assistMode=false;assistStep=0;tab='event';save();render();return}
  if(assisting){if(target==='teams')assistStep=1;else if(target==='tournament'&&assistComplete(1))assistStep=Math.max(2,Math.min(5,assistStep||2));else return;save();render();return}
  tab=target==='teams'?'players':target==='tournament'?'main':target;save();render();
 });
refreshGroupEventGate();
if(!el()._scsEventGateBound){el()._scsEventGateBound=true;const refresh=event=>{if(event.target.closest?.('[data-group-rules]'))ScsApi.events.keepEditorPosition(el(),'[data-group-rule-count]',refreshGroupEventGate);else queueMicrotask(refreshGroupEventGate);};el().addEventListener('input',refresh);el().addEventListener('change',refresh);}
if(groupMain&&groupEventId&&!viewOnly)SCSEventCourtPool.connect(el(),{parent:()=>groupMain,eventId:groupEventId,format:groupMain._scsTournamentFormat||(mixedContext?'knockout':'group'),state:()=>({courtCount,courtNumbers:eventCourtNumbers}),onChange:async numbers=>{eventCourtNumbers=numbers;courtCount=numbers.length;save();render();}});
window.SCSWorkspaceBounds?.commit();
let create=el().querySelector('[data-action="create"]');if(create)create.onclick=()=>{const input=el().querySelector('[data-title]');title=String(input?input.value:title).trim().slice(0,120);if(!title){alert('Enter a tournament name before creating the groups.');if(input)input.focus();return}if(!groupSetupStatus().valid){alert(groupSetupStatus().message);return}config.per=groupSetupStatus().per;created=true;tab='main';save();render()};
}
function openMixedEvent(parent,event,state,onSave,onHome,section){
 mixedContext={onSave,onHome};viewOnly=false;groupMain=JSON.parse(JSON.stringify(parent));groupEventId=event.id;groupHome=false;
 applyState(state||{title:event.title,config:{groups:0,per:0,knockouts:1,top:2,bottom:1},assistMode:true});
 if(!el()){const root=document.createElement('div');root.id='scsGroupTournament';root.className='scs-gt-overlay';document.body.appendChild(root)}
 el().hidden=false;
 assistStep=0;resultsPage='group';resultsGroup=0;resultsExpanded={};tab=section==='match'?'match':section==='flowchart'?'main':'event';if(!viewOnly&&groupEventSetupIssues(false).length)tab='event';render();
}
function receiveRemoteScores(row){if(groupHome||!started||!row?.state||!(row.id===cloudTournamentId||row.state._scsClientTournamentId&&row.state._scsClientTournamentId===clientTournamentId))return false;const target={matches};if(!window.SCSTournamentScores?.merge('group',target,row.state))return false;try{const key=groupEventId?groupEventKey(groupEventId):KEY;const cached=JSON.parse(localStorage.getItem(key)||'null');if(cached){cached.matches=matches;localStorage.setItem(key,JSON.stringify(cached));}}catch(_){}refreshGroupComputedView();return true;}
async function assignFromDashboard(parent,item,onSave,onHome){
 setStageScope(item.stage??'group',item.event.id);
 try{
  openMixedEvent(parent,item.event,JSON.parse(JSON.stringify(item.state)),onSave,onHome,'match');
  el().hidden=false;await SCSEventCourtPool.whenReady(el());
  const popup=assignCourt(item.matchId,{onClose:()=>groupHomeRender(),afterAssign:async()=>{if(!await saveGroupTournamentNow())throw Error('Assignment saved on this device. Server sync is pending; close this window and retry Sync.');}});
  if(!popup)throw Error('This match is no longer available. Refresh and try another match.');
 }catch(error){el()?.remove();mixedContext=null;onHome();throw error;}
}

window.SCSGroupTournament={setStageScope,stageTabs:eventStageTabs,openEventStage,refreshAssignments:refreshEventAssignments,showTournamentHome:groupHomeRender,openKnockoutStage:groupKnockoutOpen,assignFromDashboard,receiveRemoteScores,applyScoringRules:applyGroupRules,openMixedEvent,rememberResultExpanded,rememberGroupExpanded,startEvent:startTournament,assignCourt,startMatch,saveProgressNow:saveGroupTournamentNow,syncNow:syncGroupTournamentNow,selectGroupTeamSwap,undoGroupTeamSwap,rememberRosterExpanded,open,openLive:function(state){open('view',state)},close,playersManagerReturned,scoreUpdate,updateCompletedScore,openSection:function(section){const target=section==='match'?'match':section==='event'||section==='teams'?'event':'tournament';if(!allowGroupEventNavigation(target))return false;tab=section==='event'?'event':section==='teams'?'players':section==='match'?'match':'main';save();render()},returnFromScore:function(){if(el())el().hidden=false}};
})();
