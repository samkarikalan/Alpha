/* V962: event court counts refer to exclusive physical courts in the parent pool. */
(function(){'use strict';
const contexts=new Set();
function current(c){return c.active&&c.root.isConnected&&c.root._scsEventCourtPool===c;}
function dispose(root){const c=root?._scsEventCourtPool;if(c){c.active=false;contexts.delete(c);}}

function ids(s){if(Array.isArray(s?.courtNumbers))return s.courtNumbers.slice();return Array.from({length:Math.max(0,Number(s?.courtCount??s?.numCourts)||0)},(_,i)=>i+1);}
function localAllocation(body){
 let parent;for(const context of contexts){const value=context.options.parent?.();if(value&&[value.id,value._scsClientTournamentId,value._scsCloudTournamentId].includes(body.parentId)){parent=value;break;}}
 if(!parent)return null;
 let total=Math.max(1,Number(parent.courtCount)||1),allocations=JSON.parse(JSON.stringify(parent.courtAllocations||{})),event=String(body.eventId||'');
 if(body.action==='set-total'){const count=Number(body.count);if(!Number.isInteger(count)||count<1||count>64)throw Error('Choose 1–64 courts.');if(Object.values(allocations).some(numbers=>numbers.some(n=>n>count)))throw Error('Release event courts before reducing the tournament court count.');total=count;}
 else if(body.action!=='get'){
  const count=Number(body.count);if(!Number.isInteger(count)||count<0||count>64)throw Error('Choose 0–64 event courts.');
  let numbers=(allocations[event]||[]).slice();if(body.action!=='ensure'||!Object.hasOwn(allocations,event)){
   const others=new Set(Object.entries(allocations).filter(([key])=>key!==event).flatMap(([,values])=>values));
   const active=(window.SCSLiveMatches?.values?.()||[]).filter(m=>['assigned','playing','submitted'].includes(m.status)&&[parent.id,parent._scsClientTournamentId,parent._scsCloudTournamentId].includes(m.parent_key));
   const occupied=new Set(active.map(m=>Number(m.court)));for(const context of contexts){const st=context.options.state?.();if(context.options.parent?.()!==parent)continue;const games=st?.encounters?st.encounters.flatMap(e=>e.matches||[]):st?.matches||[];for(const g of games)if(g.court&&g.status!=='approved')occupied.add(Number(g.court));}
   while(numbers.length>count){const index=numbers.findLastIndex(n=>!occupied.has(n));if(index<0)throw Error('An occupied court cannot be released before approval.');numbers.splice(index,1);}
   for(let n=1;n<=total&&numbers.length<count;n++)if(!others.has(n)&&!numbers.includes(n)&&!active.some(m=>Number(m.court)===n&&m.event?._scsGroupEventId!==event&&m.event?._scsClientTournamentId!==event&&m.event?._scsKoEventId!==event))numbers.push(n);
   if(numbers.length<count)throw Error('No free tournament courts are available. Increase tournament courts or release another event’s courts.');
  }allocations[event]=numbers;
 }
 parent.courtCount=total;parent.courtAllocations=allocations;parent.courtPoolVersion=1;return {total,allocations,courtNumbers:allocations[event]||[]};
}
async function call(body){const local=localAllocation(body);if(local)return local;const action=body.action==='get'||!window.SCSTournamentLocal?null:await SCSTournamentLocal.recordCourtAction(body);const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{if(action&&!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(body.parentId)))await SCSTournamentLocal.sync({parentsOnly:true});const user=typeof authGetUser==='function'?authGetUser():null;const res=await fetch(WORKER_URL+'/tournament/courts',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,userAccountId:user?.id,sessionToken:typeof _getLocalToken==='function'?_getLocalToken():null})});const data=await res.json().catch(()=>({}));if(!res.ok){const error=Error(data.error||'Could not allocate courts');error.status=res.status;throw error;}if(action)await SCSTournamentLocal.finishCourtAction(action,data);return data;}catch(error){if(error.name==='AbortError')error=Error('Court allocation timed out. Saved setup is retained. Refresh courts and retry.');if(action)await SCSTournamentLocal.failCourtAction(action,error);throw error;}finally{clearTimeout(timeout);}}

function reconcile(state,parent,event){if(!state)return state;event=String(event||state._scsCourtPoolEventId||state._scsGroupEventId||state._scsKoEventId||state._scsClientTournamentId||'');const ref=state._scsParentTournamentId||state._scsKoMainId||state._scsTeamMainId||parent?._scsClientTournamentId||parent?.id;let owner;for(const key of ['scs_group_multi_event_v1','scs_knockout_multi_event_v1','scs_team_main_tournament_v1']){try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&ref&&[saved.id,saved._scsClientTournamentId,saved._scsCloudTournamentId].includes(ref)&&Array.isArray(saved.courtAllocations?.[event])){owner=saved;break;}}catch(_){}}owner=owner||parent;const numbers=owner?.courtAllocations?.[event];if(!Array.isArray(numbers))return state;if(parent&&owner!==parent){parent.courtAllocations=owner.courtAllocations;parent.eventCourtLimits=owner.eventCourtLimits;parent.courtCount=owner.courtCount;}state.courtNumbers=numbers.slice();if(state.assignments||state.encounters)state.courtCount=numbers.length;else state.numCourts=numbers.length;return state;}
function applyAllocation(parent,event,data){
 parent.courtCount=data.total;parent.courtAllocations=data.allocations;parent.courtPoolVersion=1;parent.eventCourtLimits={...parent.eventCourtLimits,[event]:data.courtNumbers.length};
 const aliases=[parent.id,parent._scsClientTournamentId,parent._scsCloudTournamentId].filter(Boolean);
 for(const key of ['scs_group_multi_event_v1','scs_knockout_multi_event_v1','scs_team_main_tournament_v1']){let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null')}catch(_){}if(saved&&aliases.some(id=>[saved.id,saved._scsClientTournamentId,saved._scsCloudTournamentId].includes(id))){saved.courtCount=data.total;saved.courtAllocations=data.allocations;saved.courtPoolVersion=1;saved.eventCourtLimits={...saved.eventCourtLimits,[event]:data.courtNumbers.length};localStorage.setItem(key,JSON.stringify(saved));}}
 for(const key of ['scs_group_event_'+event,'scs_knockout_event_'+event,'scs_team_event_'+event,'scs_group_knockout_'+event+'_0','scs_group_knockout_'+event+'_1']){let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null')}catch(_){}if(!saved)continue;const owner=saved._scsParentTournamentId||saved._scsKoMainId||saved._scsTeamMainId;if(owner&&!aliases.includes(owner))continue;saved.courtNumbers=data.courtNumbers.slice();if(saved.assignments||saved.encounters)saved.courtCount=data.courtNumbers.length;else saved.numCourts=data.courtNumbers.length;localStorage.setItem(key,JSON.stringify(saved));}
}
async function resizeEvent(parent,event,count,format){const ref=parent._scsCloudTournamentId||parent._scsClientTournamentId||parent.id;const data=await call({parentId:ref,eventId:String(event),action:'resize',count});applyAllocation(parent,String(event),data);if(Array.isArray(parent.events))await SCSTournamentStore.save(format||parent._scsTournamentFormat||'group',parent);return data;}
const sessionReads=new Map();
function readCourtSessions(c,force){const club=typeof getMyClub==='function'?getMyClub()?.id:null;if(!club||typeof sbGet!=='function')return;const account=typeof authGetUser==='function'?authGetUser()?.id:'',scope=account+':'+club;let cache=sessionReads.get(scope);if(cache?.flight||!force&&cache&&Date.now()-cache.time<7000){if(cache?.rows)c.sessions=cache.rows;return cache?.flight;}cache=cache||{rows:[],time:0};sessionReads.set(scope,cache);cache.flight=sbGet('sessions','club_id=eq.'+club+'&status=in.(live,completed)&started_by=eq.__SCS_TOURNAMENT_COURT_CENTER__&select=id,status,club_id,rounds_data,updated_at').then(rows=>{if(getMyClub()?.id!==club||(typeof authGetUser==='function'?authGetUser()?.id:'')!==account)return;cache.rows=rows||[];cache.time=Date.now();for(const context of contexts)if(current(context)){context.sessions=cache.rows;renderCourtOverview(context);}}).catch(()=>{}).finally(()=>cache.flight=null);return cache.flight;}
function renderCourtOverview(c){
 const heading=c.root.querySelector('.scs-tm-live-center-head');if(!heading||!window.SCSTournamentCourts)return;
 let box=c.root.querySelector('[data-event-court-overview]');if(!box){box=document.createElement('section');box.dataset.eventCourtOverview='';box.className='scs-event-court-overview';}if(box.previousElementSibling!==heading)heading.after(box);
 const parent=c.options.parent(),state=c.options.state(),event={id:c.event,title:parent.events?.find(e=>String(e.id)===c.event)?.title||state?.title||'Event'},snapshots=[];
 for(const key of ['scs_group_event_'+c.event,'scs_knockout_event_'+c.event,'scs_team_event_'+c.event,'scs_group_knockout_'+c.event+'_0','scs_group_knockout_'+c.event+'_1']){try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value)snapshots.push({event,state:value});}catch(_){}}
 if(state?.matches||state?.encounters)snapshots.push({event,state});
 const live=window.SCSCourtCenter?.liveState?.(),local=window.SCSCourtCenter?.localSession?.(),rows=[...(c.sessions||[]),...(local?[local]:[])];if(live?.tournament)rows.push({id:'current-live-courts',updated_at:new Date().toISOString(),rounds_data:[{tournament:live.tournament,games:live.games||[]}]});
 const model=SCSTournamentCourts.model({events:[event],aliases:[parent.id,parent._scsClientTournamentId,parent._scsCloudTournamentId].filter(Boolean),courtCount:parent.courtCount,courtAllocations:parent.courtAllocations},snapshots,rows),escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const unified=c.root.querySelector('[data-unified-event-courts]');
 if(unified){box.remove();for(const slot of unified.querySelectorAll('[data-unified-court]')){
  if(slot.dataset.currentMatch==='true')continue;
  const n=Number(slot.dataset.unifiedCourt),match=(model.byCourt.get(n)||[])[0];
  if(match){const html='<h4>Court '+n+'</h4><div class="scs-event-court-row"><strong>'+escape(match.status)+'</strong><small>'+escape(match.event+' · Match '+match.match)+'<br>'+escape(match.pairs.map(p=>p.join(' / ')).join(' vs '))+'</small></div>';if(slot._scsOtherHtml!==html){slot._scsOtherHtml=html;slot.innerHTML=html;}}
  else if(slot._scsOtherHtml){slot._scsOtherHtml='';slot.innerHTML=SCSSharedMatchCenter.court({number:n});}
 }return;}
 const html='<h3>Live court status</h3>'+c.numbers.map(n=>{const matches=model.byCourt.get(n)||[],match=matches[0];return '<div class="scs-event-court-row" data-court-number="'+n+'" data-court-state="'+(!match?'free':match.ready?'approval':match.playing?'playing':'assigned')+'"><strong>Court '+n+'</strong><span>'+escape(match?match.status:'Free')+'</span>'+(match?'<small>'+escape(match.event+' · Match '+match.match)+'<br>'+escape(match.pairs.map(p=>p.join(' / ')).join(' vs '))+'</small>':'')+'</div>';}).join('');if(box._scsHtml!==html){box._scsHtml=html;box.innerHTML=html;}
}
function connect(root,options){const parent=options.parent?.(),event=String(options.eventId||'');if(!root||!parent||!event||options.viewOnly)return;const ref=parent._scsCloudTournamentId||parent._scsClientTournamentId||parent.id;if(!ref)return;const key=String(ref)+':'+event;let c=root._scsEventCourtPool;
 if(c?.key===key&&c.active){c.options=options;if(!c.busy&&Array.isArray(options.state()?.courtNumbers))c.numbers=options.state().courtNumbers.slice();else if(c.ready&&!c.busy)queueMicrotask(()=>{if(current(c))c.options.onChange(c.numbers,{}).catch(error=>{c.error=error.message;notice(c);});});notice(c);return;}
 if(c){c.active=false;contexts.delete(c);}
 c={root,key,parentRef:ref,event,options,active:true,ready:false,busy:false,numbers:ids(options.state()),error:''};root._scsEventCourtPool=c;contexts.add(c);
 c.requestedCount=null;c.resizeFlight=false;c.resizeTimer=null;
 c.flushResize=async()=>{if(!current(c)||c.busy||c.resizeFlight||c.requestedCount===null)return;if(!c.ready){c.resizeFlight=true;try{await ensure(c);}finally{c.resizeFlight=false;}if(!c.ready){c.requestedCount=null;notice(c);return;}return c.flushResize();}const target=c.requestedCount;if(target===c.numbers.length){c.requestedCount=null;notice(c);return;}c.resizeFlight=true;try{await update(c,'resize',target);}finally{c.resizeFlight=false;if(c.requestedCount===target)c.requestedCount=null;notice(c);if(c.requestedCount!==null)c.flushResize();}};
 c.resize=delta=>{const parent=c.options.parent(),other=new Set(Object.entries(parent.courtAllocations||{}).filter(([id])=>id!==c.event).flatMap(([,numbers])=>numbers)),maximum=Number(parent.courtCount)>0?Number(parent.courtCount)-other.size:64,currentTarget=c.requestedCount??c.numbers.length;c.requestedCount=Math.max(0,Math.min(Math.max(c.numbers.length,maximum),currentTarget+Number(delta)));c.error='';notice(c);clearTimeout(c.resizeTimer);c.resizeTimer=setTimeout(c.flushResize,120);};
 if(!root._scsEventCourtCapture){root._scsEventCourtCapture=true;root.addEventListener('click',e=>{const current=root._scsEventCourtPool;if(!current?.active)return;const b=e.target.closest('button');if(!b)return;let delta;
  if(b.hasAttribute('data-courts'))delta=b.dataset.courts;
  else if(b.hasAttribute('data-event-courts'))delta=b.dataset.eventCourts;
  else {const text=b.getAttribute('onclick')||'',m=text.match(/(?:setTournamentCourts|changeLiveCourts)\(\s*(-?\d+)/);if(m)delta=m[1];}
  if(delta!=null){e.preventDefault();e.stopImmediatePropagation();current.resize(delta);}
 },true);}
 c.loading=ensure(c);
}
function notice(c){if(!c.active||!c.root.isConnected)return;let n=c.root.querySelector('[data-event-court-pool-status]');if(!n){n=document.createElement('p');n.dataset.eventCourtPoolStatus='';n.setAttribute('role','status');n.className='scs-event-court-pool-status';const host=c.root.querySelector('[data-scs-workspace-content]')||c.root.querySelector('.scs-gt-sheet')||c.root;host.prepend(n);}
 n.hidden=!!(c.ready&&!c.error&&c.numbers.length);
 const requested=c.requestedCount,displayCount=requested??c.numbers.length;
 c.root.querySelectorAll('.scs-tm-court-picker b,[data-event-court-count]').forEach(counter=>{if(counter.textContent!==String(displayCount))counter.textContent=displayCount;counter.classList.toggle('scs-court-count-pending',requested!==null);counter.setAttribute('aria-label',displayCount+' courts'+(requested!==null?', awaiting confirmation':''));});
 renderCourtOverview(c);readCourtSessions(c);
 n.textContent=c.error||(!c.ready?'Loading tournament court allocation…':c.numbers.length?c.numbers.length+' courts available to this event':'No courts allocated. Use + to add a free tournament court.');
}
async function update(c,action,count){if(!current(c))return;c.busy=true;c.action=action;c.error='';notice(c);try{let data;try{data=await call({parentId:c.parentRef,eventId:c.event,action,count});}catch(error){if(error.status!==404)throw error;if(!current(c))return;const parent=c.options.parent();await SCSTournamentStore.save(c.options.format||'group',parent);c.parentRef=parent._scsCloudTournamentId||c.parentRef;data=await call({parentId:c.parentRef,eventId:c.event,action,count});}if(!current(c))return;if(!Array.isArray(data.courtNumbers)||!Number.isInteger(data.total)||data.courtNumbers.some(n=>!Number.isInteger(n)||n<1||n>data.total))throw Error('Court service returned an invalid allocation. Update the Worker and retry.');const changed=!c.ready||JSON.stringify(c.numbers)!==JSON.stringify(data.courtNumbers);c.numbers=data.courtNumbers;c.ready=true;const parent=c.options.parent();applyAllocation(parent,c.event,data);if(action!=='get'&&Array.isArray(parent.events))SCSTournamentStore.queue(c.options.format||'group',parent);if(changed||action!=='get')await c.options.onChange(c.numbers,data);notice(c);}catch(error){if(c.active){c.error=error.message;notice(c);}}finally{c.busy=false;if(c.requestedCount!==null&&!c.resizeFlight)c.flushResize();}}
async function ensure(c){const parent=c.options.parent?.(),known=Object.prototype.hasOwnProperty.call(parent?.courtAllocations||{},c.event);await update(c,known?'get':'ensure',Math.max(0,Number(c.options.state()?.courtCount??c.options.state()?.numCourts)||0));}
function ready(root){const c=root?._scsEventCourtPool;if(!c)return true;if(!c.ready||c.requestedCount!==null||c.busy&&c.action!=='get'||!c.numbers.length){alert(c.error||'Allocate a free tournament court using + first.');return false;}return true;}
async function setTotal(parent,count){const ref=parent._scsCloudTournamentId||parent._scsClientTournamentId||parent.id;const data=await call({parentId:ref,action:'set-total',count});for(const [event,numbers] of Object.entries(data.allocations||{}))applyAllocation(parent,event,{...data,courtNumbers:numbers});return data;}
setInterval(()=>{for(const c of contexts){if(!c.active||!c.root.isConnected){contexts.delete(c);continue;}if(c.ready&&!c.busy&&!c.root.hidden&&!document.hidden)update(c,'get',c.numbers.length);}},8000);
async function whenReady(root){
 // Knockout builds its navigation/court controller on the next animation frame.
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const c=root?._scsEventCourtPool;
 if(!c?.active)throw Error('Open the event and load its court allocation first.');
 await c.loading;
 if(!c.active||!c.ready||!c.numbers.length)throw Error(c.error||'Allocate a free tournament court to this event first.');
 return c.numbers.slice();
}
window.SCSEventCourtPool={connect,dispose,ids,ready,setTotal,whenReady,resizeEvent,reconcile,async refresh(root){const c=root?._scsEventCourtPool;if(c&&current(c)){if(!c.busy)await update(c,'get',c.numbers.length);await readCourtSessions(c,true);}},refreshView(root){const c=root?._scsEventCourtPool;if(c&&current(c))renderCourtOverview(c);}};
})();
