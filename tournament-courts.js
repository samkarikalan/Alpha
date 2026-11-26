/* Tournament-wide courts and assignment; native event workflows own mutations. */
(function(){
'use strict';
const assignmentFilters=new Map(),assignmentScroll=new Map(),openTabs=new Map(),mounted=new Set();let serial=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function positive(n){return Number.isInteger(Number(n))&&Number(n)>0?Number(n):0;}
function eventId(s){return s?._scsKoEventId||s?._scsGroupEventId||s?._scsClientTournamentId||s?.id;}
function sameEvent(s,events,aliases){return events.find(e=>String(e.cloudId||'')!==''&&String(e.cloudId)===String(s?._scsCloudTournamentId))||events.find(e=>String(e.id)===String(eventId(s)))||(aliases.some(id=>id&&[s?._scsParentTournamentId,s?._scsKoMainId,s?._scsTeamMainId].includes(id))?events.find(e=>String(e.id)===String(s?._scsEventId)):null);}
function model(options,states,sessions){
 const events=options.events||[],aliases=options.aliases||[],byCourt=new Map();let total=positive(options.courtCount);const configured=total>0;
 const add=(event,s,m,key,pairs,kind)=>{const court=positive(m.court);if(!court||m.status==='approved'||m.court_center_status==='approved')return;total=Math.max(total,court);const list=byCourt.get(court)||[];const tag=String(s._scsCloudTournamentId||event.id)+':'+String(key);const ready=m.status==='score_ready'||m.score_status==='scored',playing=m.status==='playing'||!!m.started_at||m.score_status==='scoring';const item={key:tag,event:event.title||s.title||'Event',match:String(key),status:ready?'Awaiting approval':playing?'In progress':'Assigned · Not started',playing,ready,pairs,score:m.score||null,details:s.selectedPlayerDetails||[],winner:m.winner,kind};const i=list.findIndex(x=>x.key===tag);if(i>=0)list[i]=item;else list.push(item);byCourt.set(court,list);};
 for(const {event,state:s} of states){if(!s||s._scsMainTournament)continue;if(!configured)total=Math.max(total,positive(s.courtCount||s.numCourts));if(s.completed||s.status==='completed')continue;
  if(event.format==='team'||Array.isArray(s.encounters)){for(const e of s.encounters||[])for(const m of e.matches||[])if(['assigned','playing','score_ready'].includes(m.status))add(event,s,m,m.id,m.pairs||[[],[]],'team');}
  else if(s.assignments){for(const m of s.matches||[])if(['assigned','playing','score_ready'].includes(m.status))add(event,s,m,m.id,[s.assignments[m.a]||[],s.assignments[m.b]||[]],'group');}
 }
 for(const session of sessions||[])for(const r of session.rounds_data||[]){const s=r.tournament;if(!s)continue;const event=sameEvent(s,events,aliases)||states.find(x=>s._scsCloudTournamentId&&x.state?._scsCloudTournamentId===s._scsCloudTournamentId)?.event;if(!event)continue;if(!configured)total=Math.max(total,positive(r.numCourts||s.numCourts));for(const m of r.games||[])if(m.tournament_match!=null)add(event,s,m,m.tournament_match,[m.pair1||[],m.pair2||[]],'knockout');}
 const owners=new Map();for(const [id,numbers] of Object.entries(options.courtAllocations||{})){const name=events.find(e=>String(e.id)===id)?.title||'Event';for(const n of numbers)owners.set(n,name);}return {total,byCourt,owners};
}
function scoreText(score){if(typeof score==='string')return score;const sets=score?.completedSets||[];return sets.length?sets.map(s=>(s.score||[]).join('–')).join(' | '):Array.isArray(score?.currentScore)?score.currentScore.join('–'):'';}
function markup(data){const active=[...data.byCourt.values()].flat(),running=active.filter(m=>m.playing&&!m.ready).length,ready=active.filter(m=>m.ready).length;
 let html='<p class="scs-tournament-court-total">'+data.total+' courts · '+running+' in progress · '+ready+' awaiting approval</p>';
 if(!data.total)return html+'<p>No courts configured yet. Set the courts in an event to show them here.</p>';
 for(let n=1;n<=data.total;n++){const matches=data.byCourt.get(n)||[];html+='<section class="scs-tournament-court" data-tournament-court="'+n+'"><h3>Court '+n+'</h3>';
 if(!matches.length)html+='<p class="scs-tournament-court-free">'+(data.owners?.has(n)?'Idle · allocated to '+esc(data.owners.get(n)):'Free · not allocated')+'</p>';
 if(matches.length>1)html+='<p>'+matches.length+' matches assigned to this court</p>';
 for(const m of matches){const pair=m.pairs||[[],[]];html+=SCSSharedMatchCenter.court({number:n,playerRenderer:name=>{const d=m.details.find(p=>String(p.name||p.player||'')===String(name))||{};return SCSSharedMatchCenter.playerIdentity(name,d);},match:{status:m.status,label:m.event+' · '+m.match,left:pair[0],right:pair[1],ready:m.ready,started:m.playing||m.ready,score:scoreText(m.score),winner:m.winner==='L'?'left':m.winner==='R'?'right':null}});}
 html+='</section>';}return html;
}
// Presentation only: fixtures and advancement remain owned by the event engine.
function assignmentModel(options,states,sessions){
 const courts=model(options,states,sessions),items=[],busyNames=new Set();
 const names=pairs=>(pairs||[]).flat().map(n=>String(n).trim().toLowerCase()).filter(Boolean);
 for(const matches of courts.byCourt.values())for(const m of matches)names(m.pairs).forEach(n=>busyNames.add(n));
 const add=(event,state,m,pairs,kind,extra={})=>{
  const stage=state._scsGroupKnockoutStage;
  const numbers=options.courtAllocations?.[event.id]||state.courtNumbers||Array.from({length:Number(state.courtCount||state.numCourts)||0},(_,i)=>i+1);
  const free=numbers.filter(n=>!(courts.byCourt.get(Number(n))||[]).length);
  const players=names(pairs),valid=pairs.length===2&&pairs.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>String(n||'').trim()))&&new Set(players).size===4;
  const started=kind==='knockout'?state.live===true:kind==='group'?state.started===true:true;
  let reason=!started?'Start event first':!valid?'Select players first':players.some(n=>busyNames.has(n))?'Players busy':!numbers.length?'Allocate courts first':!free.length?'No free event courts':'';
  if(extra.unresolved)reason='Waiting for earlier results';
  items.push({key:JSON.stringify([event.id,kind,stage??null,m.id]),event,state,matchId:m.id,kind,pairs,details:state.selectedPlayerDetails||state.clubs?.flatMap(c=>c.selectedPlayerDetails||[])||[],stage,heading:extra.heading||'',reason,freeCourts:free});
 };
 const seen=new Set();
 for(const {event,state:s} of states){
  if(!s||s._scsMainTournament||s.completed||s.status==='completed')continue;
  const kind=Array.isArray(s.encounters)?'team':s.assignments?'group':'knockout',identity=JSON.stringify([event.id,kind,s._scsGroupKnockoutStage??null]);
  if(seen.has(identity))continue;seen.add(identity);
  if(kind==='group'){
   const active=(s.matches||[]).filter(m=>['assigned','playing','score_ready'].includes(m.status));
   for(const m of s.matches||[])if(m.status==='pending'&&!m.court){
    add(event,s,m,[s.assignments[m.a]||[],s.assignments[m.b]||[]],kind,{heading:'Group '+String.fromCharCode(65+(Number(m.group)||0))});
    const item=items[items.length-1];if(!item.reason&&active.some(x=>[m.a,m.b].some(team=>x.a===team||x.b===team)))item.reason='Team busy';
   }
  }else if(kind==='team'){
   for(const e of s.encounters||[])for(const m of e.matches||[])if(m.status==='pending'&&!m.court)add(event,s,m,m.pairs||[[],[]],kind,{heading:(s.clubs?.[e.a]?.name||'Club')+' vs '+(s.clubs?.[e.b]?.name||'Club')});
  }else{
   const rounds=(sessions||[]).flatMap(x=>x.rounds_data||[]).filter(r=>{const t=r.tournament;if(!t)return false;const owner=sameEvent(t,options.events||[],options.aliases||[]);return owner&&String(owner.id)===String(event.id)&&String(t._scsGroupKnockoutStage??'')===String(s._scsGroupKnockoutStage??'');});
   const games=rounds.flatMap(r=>r.games||[]),assigned=new Set(games.filter(g=>g.tournament_match!=null).map(g=>String(g.tournament_match)));
   const resolve=src=>{if(src==null)return null;if(typeof src==='number')return (s.entries||[]).find(e=>e.id===src)?.name||null;const r=s.results?.[String(src).slice(1)];return r?(String(src)[0]==='L'?r.loser:r.winner):null;};
   for(const m of s.matches||[]){if(s.results?.[m.id]||assigned.has(String(m.id)))continue;const a=resolve(m.a),b=resolve(m.b);if(m.a==null||m.b==null)continue;
    add(event,s,m,[a?a.split(' / '):[],b?b.split(' / '):[]],kind,{unresolved:!a||!b,heading:s._scsGroupKnockoutStage!=null?'Knockout '+(Number(s._scsGroupKnockoutStage)+1):'Knockout'});
   }
   const recent=games.filter(g=>g.court_center_status==='approved').sort((a,b)=>(Date.parse(b.approved_at||b.completed_at||0)||0)-(Date.parse(a.approved_at||a.completed_at||0)||0))[0];
   const rested=new Set(names(recent?[recent.pair1||[],recent.pair2||[]]:[])),ready=items.filter(x=>x.state===s&&!x.reason);
   if(ready.some(x=>!names(x.pairs).some(n=>rested.has(n))))for(const item of ready)if(names(item.pairs).some(n=>rested.has(n)))item.reason='Players resting';
  }
 }
 return {items:window.SCSTournamentOrder?SCSTournamentOrder.order({...options,sessions,eventCourtLimits:options.parentState?.()?.eventCourtLimits||options.eventCourtLimits},states,items):items,courts};
}
function assignmentMarkup(data,events,selected,viewOnly){
 const items=data.items.filter(m=>!selected||String(m.event.id)===selected),ready=items.filter(m=>!m.reason).length;
 return '<p class="scs-tournament-assignment-summary">'+ready+' ready to assign · '+(items.length-ready)+' waiting</p>'+items.map(m=>'<article class="scs-rev1-assignment" data-assignment-key="'+esc(m.key)+'"><small>#'+m.order+' · '+esc(m.event.title||'Event')+' · '+esc(m.heading)+'</small>'+SCSSharedMatchCenter.waiting({number:m.matchId,left:(m.pairs[0]||[]).join(' / ')||'To be confirmed',right:(m.pairs[1]||[]).join(' / ')||'To be confirmed',label:m.reason||'Assign Court',action:!viewOnly&&!m.reason?'data-tournament-assign="'+esc(m.key)+'"':''})+'</article>').join('')+(items.length?'':'<p>No upcoming matches.</p>');
}

function mount(root,options){const config=options.courtDashboard;if(!config)return;const home=root.querySelector('.scs-team-event-home');if(!home||home.querySelector('[data-tournament-home-tabs]'))return;
 root._scsCourtDashboard?.dispose();
 home.querySelector(':scope > h1')?.remove();
 const key=root.id+':'+String(config.id||options.title),id='scs-courts-'+(++serial);const events=options.events||[];
 const tabs=document.createElement('div');tabs.dataset.tournamentHomeTabs='';tabs.className='scs-tournament-home-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Tournament dashboard');
 const eventPanel=document.createElement('section'),courtPanel=document.createElement('section'),assignPanel=document.createElement('section');eventPanel.id=id+'-events';courtPanel.id=id+'-courts';assignPanel.id=id+'-assign';for(const panel of [eventPanel,courtPanel,assignPanel])panel.setAttribute('role','tabpanel');
 // Leave the tournament name and summary above the tabs, keeping every existing action node/handler.
 for(const node of Array.from(home.children))if(!node.matches('h1,.scs-team-event-summary'))eventPanel.append(node);
 tabs.innerHTML='<button type="button" role="tab" id="'+id+'-events-tab" aria-controls="'+eventPanel.id+'">Events</button><button type="button" role="tab" id="'+id+'-courts-tab" aria-controls="'+courtPanel.id+'">Courts</button><button type="button" role="tab" id="'+id+'-assign-tab" aria-controls="'+assignPanel.id+'">Assign matches</button>';
 eventPanel.setAttribute('aria-labelledby',id+'-events-tab');courtPanel.setAttribute('aria-labelledby',id+'-courts-tab');assignPanel.setAttribute('aria-labelledby',id+'-assign-tab');
 courtPanel.innerHTML='<div class="scs-tournament-courts-heading"><h2>Courts</h2><button type="button" data-courts-refresh aria-label="Refresh tournament courts">↻ Refresh</button></div>'+(!options.viewOnly&&config.storeCourtCount?'<div class="scs-tournament-court-settings"><label>Total courts<input type="number" min="1" max="64" step="1" inputmode="numeric" data-tournament-court-count></label><button type="button" data-save-tournament-courts>Save courts</button></div>':'')+'<p role="status" data-courts-status></p><div data-courts-body></div>';
 assignPanel.innerHTML='<div class="scs-tournament-courts-heading"><h2>Assign matches</h2><button type="button" data-assign-refresh aria-label="Refresh tournament matches">↻ Refresh</button></div><p>Choose a match from any event. Only courts allocated to that event can be used.</p><label class="scs-tournament-assignment-filter">Event<select data-assignment-event><option value="">All events</option>'+events.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.title||'Event')+'</option>').join('')+'</select></label><p role="status" data-assign-status></p><div data-assign-body></div>';
 const landing=document.createElement('div');landing.className='scs-rev1-landing';landing.innerHTML='<button type="button" data-rev1-open="overview"><span aria-hidden="true">🏆</span><strong>Tournament</strong><small>Overview, courts and match assignment</small><b aria-hidden="true">›</b></button><button type="button" data-rev1-open="events"><span aria-hidden="true">▦</span><strong>Events</strong><small>'+events.length+' events · Setup, draws and results</small><b aria-hidden="true">›</b></button>';
 const back=document.createElement('button');back.className='scs-rev1-back';back.type='button';back.textContent='‹ Tournament home';back.onclick=()=>activate('landing');
 const overview=document.createElement('section');overview.className='scs-rev1-overview';overview.innerHTML='<h2>Tournament overview</h2><p>'+esc(config.parentState?.()?.title||options.title||'Tournament')+'</p><div class="scs-rev1-stats"><strong>'+events.length+'<small>Events</small></strong><strong>'+Number(config.courtCount||1)+'<small>Total courts</small></strong><strong>'+events.reduce((n,e)=>n+Number(e.completed||0),0)+' / '+events.reduce((n,e)=>n+Number(e.matches||0),0)+'<small>Matches completed</small></strong></div><p>Manage shared courts and assign matches across all events. Open Events to manage players, teams, draws and results.</p>';
 const complete=eventPanel.querySelector('.scs-ko-main-complete');if(complete)overview.append(complete);
 tabs.innerHTML='<button type="button" role="tab">Overview</button><button type="button" role="tab">Courts</button><button type="button" role="tab">Assign matches</button>';
 home.append(landing,back,tabs,overview,eventPanel,courtPanel,assignPanel);const body=courtPanel.querySelector('[data-courts-body]'),status=courtPanel.querySelector('[data-courts-status]'),refreshButton=courtPanel.querySelector('[data-courts-refresh]');let alive=true,busy=false,saving=false,pendingCount=false,serverStates=[],sessions=[];const countInput=courtPanel.querySelector('[data-tournament-court-count]'),saveCountButton=courtPanel.querySelector('[data-save-tournament-courts]');
 const assignBody=assignPanel.querySelector('[data-assign-body]'),assignStatus=assignPanel.querySelector('[data-assign-status]'),filter=assignPanel.querySelector('[data-assignment-event]'),assignRefresh=assignPanel.querySelector('[data-assign-refresh]');let opening=false;filter.value=assignmentFilters.get(key)||'';filter.onchange=()=>{assignmentFilters.set(key,filter.value);draw();};
 const local=()=>{const rows=events.map(event=>{try{return {event,state:config.loadEventState(event)}}catch(_){return {event,state:null}}});for(const event of events)for(const stage of [0,1]){try{const state=JSON.parse(localStorage.getItem('scs_group_knockout_'+event.id+'_'+stage)||'null');if(state)rows.push({event,state});}catch(_){}}return rows;};
 function combined(){
  const rows=local(),stage=s=>s?._scsGroupKnockoutStage!=null?'knockout-'+s._scsGroupKnockoutStage:s?.assignments?'group':Array.isArray(s?.encounters)?'team':'knockout';
  const merge=remote=>{const index=rows.findIndex(x=>String(x.event.id)===String(remote.event.id)&&(!x.state||stage(x.state)===stage(remote.state)));if(index>=0)rows[index]=remote;else rows.push(remote);};
  for(const remote of serverStates)merge(remote);
  for(const session of sessions)for(const round of session.rounds_data||[]){const s=round.tournament,event=sameEvent(s,events,config.aliases||[]);if(s&&event&&!s.assignments&&!s.encounters&&!rows.some(x=>x.event.id===event.id&&stage(x.state)===stage(s)))merge({event,state:s});}
  try{const club=typeof getMyClub==='function'?getMyClub():null,box=JSON.parse(localStorage.getItem('scs_tournament_sync_outbox_v406')||'{}');for(const [id,item] of Object.entries(box)){if(!club?.id||!id.startsWith(club.id+':'))continue;const event=sameEvent(item.state,events,config.aliases||[]);if(event&&!item.state?._scsMainTournament)merge({event,state:item.state});}}catch(_){}
  return rows;
 }

 function draw(){const opts={...config,courtAllocations:config.parentState?.()?.courtAllocations,events},rows=combined(),current=model(opts,rows,sessions);body.innerHTML=markup(current);const assignments=assignmentModel(opts,rows,sessions);assignBody.innerHTML=assignmentMarkup(assignments,events,filter.value,options.viewOnly);
 if(window.SCSTournamentPlayerLevel){
  assignBody.querySelectorAll('[data-assignment-key]').forEach(article=>{const item=assignments.items.find(m=>m.key===article.dataset.assignmentKey);SCSTournamentPlayerLevel.setRoster(article,(item?.details||[]).map(d=>({...d,player:d.player||d.name})));SCSTournamentPlayerLevel.hydrate(article);});
  body.querySelectorAll('[data-tournament-court]').forEach(section=>{const matches=current.byCourt.get(Number(section.dataset.tournamentCourt))||[];section.querySelectorAll('.scs-tm-court-card').forEach((card,i)=>{SCSTournamentPlayerLevel.setRoster(card,(matches[i]?.details||[]).map(d=>({...d,player:d.player||d.name})));SCSTournamentPlayerLevel.hydrate(card);});});
 }
 if(countInput&&!countInput.dataset.dirty)countInput.value=current.total||1;}
 async function refresh(){if(!alive||busy||(courtPanel.hidden&&assignPanel.hidden))return;const club=typeof getMyClub==='function'?getMyClub():null;draw();if(!club?.id||typeof sbGet!=='function'){status.textContent='Showing saved data on this device.';assignStatus.textContent=status.textContent;return;}busy=true;refreshButton.disabled=true;assignRefresh.disabled=true;status.textContent='Refreshing courts…';assignStatus.textContent='Refreshing matches…';const scope=club.id;try{const results=await Promise.allSettled([sbGet('tournaments','club_id=eq.'+encodeURIComponent(scope)+'&status=in.(draft,live,completed)&select=id,format,state,updated_at'),sbGet('sessions','club_id=eq.'+encodeURIComponent(scope)+'&status=eq.live&select=id,rounds_data')]);if(!alive||getMyClub()?.id!==scope)return;
 const snapshots=local();if(results[0].status==='fulfilled'){const next=[];for(const row of results[0].value||[]){const s=row.state;if(!s)continue;if(s._scsMainTournament){const ours=[config.id,...(config.aliases||[])].filter(Boolean).some(id=>[row.id,s.id,s._scsClientTournamentId].includes(id));const n=positive(s.courtCount||s.numCourts);if(ours&&n&&!saving&&(!pendingCount||n===config.courtCount)){pendingCount=false;config.courtCount=n;const parent=config.parentState?.();if(parent&&s.courtAllocations)parent.courtAllocations=s.courtAllocations;config.storeCourtCount?.(n,true);}continue;}s._scsCloudTournamentId=row.id;const event=events.find(e=>snapshots.some(x=>x.event.id===e.id&&x.state?._scsCloudTournamentId===row.id))||sameEvent(s,events,config.aliases||[]);if(event)next.push({event,state:s});}serverStates=next;}
 if(results[1].status==='fulfilled')sessions=results[1].value||[];
 status.textContent=results.some(r=>r.status==='rejected')?'Some court data could not be refreshed. Showing available saved data.':'Updated '+new Date().toLocaleTimeString();draw();
 }catch(error){status.textContent='Could not refresh courts. Showing saved data.';}finally{busy=false;if(alive){refreshButton.disabled=false;assignRefresh.disabled=false;assignStatus.textContent=status.textContent;}}}
 function activate(which){if(!['landing','events','overview','courts','assign'].includes(which))which='landing';openTabs.set(key,which);landing.hidden=which!=='landing';back.hidden=which==='landing';tabs.hidden=!['overview','courts','assign'].includes(which);overview.hidden=which!=='overview';eventPanel.hidden=which!=='events';courtPanel.hidden=which!=='courts';assignPanel.hidden=which!=='assign';root.dataset.rev1HomeView=which;
  root.querySelectorAll('nav.scs-tm-bottom-nav,nav.scs-tmgr-bottom-nav').forEach(nav=>{if(which==='events')nav.style.removeProperty('display');else nav.style.setProperty('display','none','important');});
  Array.from(tabs.children).forEach((button,i)=>{const active=which===['overview','courts','assign'][i];button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.setAttribute('aria-controls',[id+'-overview',courtPanel.id,assignPanel.id][i]);});overview.id=id+'-overview';eventPanel.removeAttribute('role');eventPanel.removeAttribute('aria-labelledby');Array.from(tabs.children).forEach((button,i)=>button.id=id+'-'+['overview','courts','assign'][i]+'-tab');overview.setAttribute('role','tabpanel');overview.setAttribute('aria-labelledby',id+'-overview-tab');if(which==='courts'||which==='assign'){draw();refresh();}window.SCSWorkspaceBounds?.refresh();}
 landing.querySelectorAll('[data-rev1-open]').forEach(button=>button.onclick=()=>activate(button.dataset.rev1Open));
 Array.from(tabs.children).forEach((button,i)=>{button.onclick=()=>activate(['overview','courts','assign'][i]);button.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowLeft'?2:1))%3;activate(['overview','courts','assign'][next]);tabs.children[next].focus();}}});refreshButton.onclick=refresh;assignRefresh.onclick=refresh;
 assignBody.onclick=async e=>{
  const button=e.target.closest('[data-tournament-assign]');if(!button||button.disabled||opening||options.viewOnly||!config.returnHome)return;
  opening=true;button.disabled=true;assignStatus.textContent='Checking match availability…';
  const selectedKey=button.dataset.tournamentAssign;
  try{
   if(busy){assignStatus.textContent='Refresh is in progress. Please try again when it finishes.';return;}
   await refresh();if(!alive||!assignPanel.isConnected)return;
   const item=assignmentModel({...config,courtAllocations:config.parentState?.()?.courtAllocations,events},combined(),sessions).items.find(m=>m.key===selectedKey);
   if(!item||item.reason){assignStatus.textContent=item?.reason||'This match has already been assigned or completed.';return;}
   const pane=root.querySelector('[data-scs-workspace-content]');assignmentScroll.set(key,pane?.scrollTop||0);
   const parent=config.parentState(),clubId=typeof getMyClub==='function'?getMyClub()?.id:null;
   const back=()=>{if(typeof getMyClub==='function'&&getMyClub()?.id!==clubId)return;root.hidden=false;config.returnHome();};
   const persist=state=>{if(item.stage!=null)localStorage.setItem('scs_group_knockout_'+item.event.id+'_'+item.stage,JSON.stringify(state));else config.storeEventState?.(item.event,state);};
   root._scsCourtDashboard?.dispose();
   if(root._scsEventCourtPool)root._scsEventCourtPool.active=false;
   if(item.kind==='group'){
    if(root.id!=='scsGroupTournament')root.hidden=true;
    await SCSGroupTournament.assignFromDashboard(parent,item,persist,back);
   }else if(item.kind==='team')await SCSTeamTournament.assignFromDashboard(item,back);
   else{
    if(root.id!=='scsTournamentOverlay')root.hidden=true;
    await SCSTournament.assignFromDashboard(parent,item,persist,back);
   }
  }catch(error){const message=error.message||'Could not open match assignment.';assignStatus.textContent=message;alert(message);root.hidden=false;config.returnHome?.();}
  finally{opening=false;if(button.isConnected)button.disabled=false;}
 };

 if(countInput){countInput.oninput=()=>{countInput.dataset.dirty='1';};saveCountButton.onclick=async()=>{
 const n=Number(countInput.value);if(!Number.isInteger(n)||n<1||n>64){status.textContent='Enter a whole number of courts from 1 to 64.';return;}
 const current=model({...config,courtAllocations:config.parentState?.()?.courtAllocations,events},combined(),sessions),occupied=Math.max(0,...current.byCourt.keys());if(n<occupied){status.textContent='Court '+occupied+' has an active match. Finish or move it before reducing the court count.';return;}
 saving=true;pendingCount=true;saveCountButton.disabled=true;
 try{status.textContent='Saving courts…';const parent=config.parentState?.();let result;try{result=await SCSEventCourtPool.setTotal(parent,n);}catch(error){if(error.status!==404)throw error;parent.courtCount=n;await SCSTournamentStore.save(config.format,parent);result=await SCSEventCourtPool.setTotal(parent,n);}parent.courtAllocations=result.allocations;parent.courtPoolVersion=1;config.courtCount=n;config.storeCourtCount(n,true);delete countInput.dataset.dirty;draw();pendingCount=false;status.textContent='Courts saved to tournament.';}catch(error){pendingCount=false;status.textContent=error.message||'Could not update tournament courts. Please retry.';}finally{saving=false;if(alive)saveCountButton.disabled=false;}
 };}
 const limits=document.createElement('section');limits.className='scs-rev1-limits';limits.innerHTML='<h3>Maximum concurrent courts per event</h3><p>Each event uses its allocated courts, up to this limit.</p>'+events.map(e=>'<label>'+esc(e.title||'Event')+'<input type="number" min="1" max="'+Math.max(1,Number(config.courtCount)||1)+'" step="1" data-event-limit="'+esc(e.id)+'" value="'+Number(config.parentState?.()?.eventCourtLimits?.[e.id]||config.parentState?.()?.courtAllocations?.[e.id]?.length||1)+'"></label>').join('')+'<button type="button" data-save-event-limits>Save event limits</button><p role="status"></p>';courtPanel.insertBefore(limits,body);
 limits.querySelector('button').disabled=!!options.viewOnly;limits.querySelectorAll('input').forEach(input=>input.disabled=!!options.viewOnly);limits.querySelector('button').onclick=async()=>{const message=limits.querySelector('[role="status"]'),values={};const parent=config.parentState?.();try{for(const input of limits.querySelectorAll('input')){const n=Number(input.value);if(!Number.isInteger(n)||n<1||n>Math.max(1,Number(config.courtCount)||1))throw Error('Enter a whole number from 1 to the tournament court total.');values[input.dataset.eventLimit]=n;}const next={...parent,eventCourtLimits:values};await SCSTournamentStore.save(config.format,next);parent.eventCourtLimits=values;message.textContent=window.SCSTournamentLocal?SCSTournamentLocal.describe():'Limits saved';draw();}catch(error){message.textContent=error.message;}};
 const instance={root,visible:()=>alive&&root.isConnected&&!root.hidden&&(!courtPanel.hidden&&courtPanel.isConnected||!assignPanel.hidden&&assignPanel.isConnected),refresh,dispose(){alive=false;mounted.delete(instance);}};root._scsCourtDashboard=instance;mounted.add(instance);activate(openTabs.get(key)||'landing');if(openTabs.get(key)==='assign')requestAnimationFrame(()=>{const pane=root.querySelector('[data-scs-workspace-content]');if(pane)pane.scrollTop=assignmentScroll.get(key)||0;});
}
setInterval(()=>{for(const item of mounted){if(!item.root.isConnected){item.dispose();continue;}if(!document.hidden&&item.visible())item.refresh();}},8000);
window.SCSTournamentCourts={mount,model,assignmentModel};
})();
