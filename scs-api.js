(function(){
'use strict';
const tx=(key,fallback)=>typeof t==='function'?t(key):fallback;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=window.ScsApi=window.ScsApi||{};
api.cards=api.cards||{};
api.buttons=api.buttons||{};
api.navigation=api.navigation||{};
api.events=api.events||{};
// Viewer access survives rerenders; mutation controls never become interactive.
api.tournamentAccess={attach(root,viewer){
 if(!root)return;
 root.dataset.tournamentMode=viewer?'viewer':'organiser';
 if(root._scsViewerObserver){root._scsViewerObserver.disconnect();root._scsViewerObserver=null}
 if(!viewer)return;
 const mutating=el=>{
  const text=(el.textContent||'').trim().replace(/^[^A-Za-z]+/,'');
  return /^(?:save|delete|edit|remove|add|create|generate|start|approve|assign|clear|reset|confirm|finish|complete|mark completed|new tournament|new event|build bracket|update score|auto.assign|shuffle|set password|change password)\b/i.test(text)||el.matches('[data-remove],[data-choose],[data-start],[data-approve],[data-add-event],[data-courts],[data-config],[data-slot],[data-team-remove]');
 };
 const apply=()=>{
  root.querySelectorAll('input,select,textarea').forEach(el=>{if(el.matches('select[data-results-group-select]'))return;el.disabled=true;el.setAttribute('aria-readonly','true')});
  root.querySelectorAll('[contenteditable]').forEach(el=>el.contentEditable='false');
  root.querySelectorAll('button,[role="button"],a[onclick]').forEach(el=>{if(mutating(el)){el.hidden=true;el.style.setProperty('display','none','important');el.setAttribute('aria-disabled','true');if('disabled'in el)el.disabled=true}});
 };
 if(!root._scsViewerCapture){
  root._scsViewerCapture=e=>{if(root.dataset.tournamentMode!=='viewer')return;const el=e.target.closest('button,[role="button"],a,input,select,textarea,[contenteditable]');if(el&&!el.matches('select[data-results-group-select]')&&(mutating(el)||el.matches('input,select,textarea,[contenteditable]'))){e.preventDefault();e.stopImmediatePropagation()}};
  ['click','input','change','submit'].forEach(type=>root.addEventListener(type,root._scsViewerCapture,true));
 }
 apply();root._scsViewerObserver=new MutationObserver(apply);root._scsViewerObserver.observe(root,{childList:true,subtree:true});
}};

api.cards.expandableRoster=function(markup,kind,expanded,onToggle){
 const holder=document.createElement('div');holder.innerHTML=markup;const card=holder.firstElementChild,heading=card.querySelector('.scs-tm-pool-heading');if(!heading)return markup;
 const details=document.createElement('details');details.className=card.className+' scs-roster-disclosure';if(card.hasAttribute('style'))details.setAttribute('style',card.getAttribute('style'));details.dataset.rosterKind=kind;details.open=!!expanded;details.setAttribute('ontoggle',onToggle);
 const summary=document.createElement('summary');summary.className='scs-tm-pool-heading scs-roster-summary';summary.innerHTML=heading.innerHTML;const actions=summary.querySelector('.scs-tm-pool-actions');if(actions)actions.remove();summary.insertAdjacentHTML('beforeend','<span class="scs-roster-chevron" aria-hidden="true">⌄</span>');details.appendChild(summary);
 const body=document.createElement('div');body.className='scs-roster-body';if(actions&&actions.children.length)body.appendChild(actions);Array.from(card.children).forEach(child=>{if(child!==heading)body.appendChild(child)});details.appendChild(body);return details.outerHTML;
};
api.events.assist=function({title,steps,closeAction,statusId='',className=''}){
 return '<section class="scs-shared-assist '+esc(className)+'"><header><h2>'+esc(title)+'</h2><button type="button" '+closeAction+'>Close</button></header><p>Complete each step to unlock the next.</p>'+(statusId?'<span id="'+esc(statusId)+'" role="status"></span>':'')+'<div class="scs-shared-assist-steps">'+steps.map((step,i)=>'<button type="button" class="scs-shared-assist-step" style="--assist-accent:'+step.color+'" '+step.action+' '+(step.available?'':'disabled')+'><strong class="scs-assist-number">'+(i+1)+'</strong><span class="scs-assist-copy"><b>'+esc(step.name)+'</b><small>'+(step.done?'Completed':step.available?'Open step':'Complete the previous step')+'</small></span><span aria-hidden="true">'+(step.available?'›':'🔒')+'</span></button>').join('')+'</div></section>';
};
api.cards.player=function(name,levelMarkup=''){
 return '<span class="scs-tm-shared-player"><span class="scs-tm-ring-slot" data-tm-player="'+esc(name)+'"></span><span class="scs-tm-shared-name">'+esc(name)+'</span>'+levelMarkup+'</span>';
};
// Shared player roster row: used by tournament modules with their own player selection rules.
api.cards.rosterPlayer=function({name='',levelMarkup='',subClub='',accent='#5279aa',level=undefined,gender=null}={}){
 const pill=subClub?'<span class="scs-team-inline-club-pill scs-api-subclub-pill" style="--pill-accent:'+esc(accent)+'">'+esc(subClub)+'</span>':'';
 // Shared tournament level pill, using the same class and level colors as team cards.
 if(level!==undefined&&level!==null&&Number(level)>=1&&Number(level)<=5){
  const prefix=/female|woman|lady|women|f$/i.test(String(gender||''))?'L':'M';
  levelMarkup='<span class="scs-team-level-pill scs-api-level-pill" data-level="'+esc(level)+'">'+prefix+esc(level)+'</span>';
 }
 const player=api.cards.player(name,levelMarkup);
 return '<div class="scs-api-roster-row">'+player+pill+'</div>';
};
api.buttons.render=function({label='',action='',className='',disabled=false}={}){
 return '<button type="button"'+(action?' data-'+esc(action):'')+(className?' class="'+esc(className)+'"':'')+(disabled?' disabled':'')+'>'+esc(label)+'</button>';
};
api.navigation.bottom=function({active='home',attribute='data-team-nav',ariaLabel='Tournament sections',tournamentName='',eventName=''}={}){
 const icons={
 home:'<svg viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v10h-6v-7H9v7H3Z"/></svg>',
 event:'<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="5" rx="1"/><path d="M8 12h8M8 16h6"/></svg>',
 tournament:'<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="5"/><rect x="2" y="17" width="6" height="5"/><rect x="16" y="17" width="6" height="5"/><path d="M12 7v5M5 17v-5h14v5"/></svg>',
 match:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="1"/><rect x="8" y="8" width="8" height="8"/></svg>'
 };
 if(active==='clubs'||active==='teams')active='event';
 const items=[['home','Home',icons.home],['event','Event',icons.event],['tournament','Draw & Results',icons.tournament],['match','Assign & Approve',icons.match]];
 return '<nav class="scs-tm-organized-tabs scs-tm-bottom-nav scs-gt-bottom-nav scs-team-bottom-nav scs-four-tab-nav" aria-label="'+esc(ariaLabel)+'">'+items.map(([key,label,icon])=>'<button type="button" '+esc(attribute)+'="'+key+'" class="'+(active===key?'active':'')+'"'+(active===key?' aria-current="page"':'')+'><span class="scs-tm-nav-icon" aria-hidden="true">'+icon+'</span><span class="scs-tm-nav-label">'+label+'</span></button>').join('')+'</nav>';
};
api.events.overview=function({name='Event',parent='',format='',sport='',rules='',teams=[],matches=[],courts=null,status=''}={}){
 const done=matches.filter(m=>m.status==='approved'||m.status==='completed'||m.winner!=null&&m.approved===true).length,total=matches.length;
 const progress=total?Math.round(done/total*100):0;
 const state=status==='completed'?'Completed':done===total&&total?'Results ready':matches.some(m=>['playing','approved','score_ready','completed'].includes(m.status))?'In progress':'Not started';
 return '<section class="scs-event-overview"><p class="scs-event-breadcrumb">'+esc(parent?parent+' › '+name:name)+'</p><h2>Event overview</h2><section class="scs-overview-card"><div class="scs-overview-heading"><h3>'+esc(name)+'</h3><span class="scs-event-card-status">'+esc(state)+'</span></div><p>'+esc([sport,format].filter(Boolean).join(' · '))+'</p><p>'+esc(rules||'Scoring rules set when scoring starts')+'</p></section><section class="scs-overview-card"><h3>Match progress</h3><strong class="scs-overview-total">'+done+' of '+total+' completed</strong><div class="scs-overview-progress" role="progressbar" aria-label="Completed matches" aria-valuemin="0" aria-valuemax="'+(total||1)+'" aria-valuenow="'+done+'"><span style="width:'+progress+'%"></span></div><div class="scs-overview-metrics"><span>'+teams.length+' Teams</span><span>'+Math.max(0,total-done)+' Remaining</span></div></section><section class="scs-overview-card" data-event-schedule><h3>Schedule & Courts</h3><p>'+esc(courts?courts+' court'+(Number(courts)===1?'':'s'):'Courts not configured')+'</p></section></section>';
};
api.events.createForm=function(){
 return '<section class="scs-gt-card scs-team-main-create"><div class="scs-team-main-icon">🏆</div><h2>'+esc(tx('scsCreateMainHeading','New Tournament'))+'</h2><p>'+esc(tx('scsCreateMainHelp','Enter a tournament name.'))+'</p><label for="scs-main-name">'+esc(tx('scsCreateMainName','Tournament Name'))+'</label><input id="scs-main-name" data-main-name type="text" maxlength="100" autocomplete="off" placeholder="'+esc(tx('scsCreateMainPlaceholder','e.g. Spring Tournament 2027'))+'" /><small data-main-error hidden>'+esc(tx('scsCreateMainError','Please enter a tournament name.'))+'</small><div class="scs-team-main-actions"><button type="button" data-main-cancel>'+esc(tx('scsTournamentCancel','Cancel'))+'</button><button type="button" class="scs-gt-primary" data-main-create>'+esc(tx('scsCreateMainButton','Create Tournament'))+' →</button></div></section>';
};
api.events.requestCreate=function({onCreate,onCancel}={}){
 const backdrop=document.createElement('div');backdrop.className='scs-gt-overlay scs-team-overlay';backdrop.id='scs-api-create-overlay';backdrop.style.zIndex='2147483000';
 backdrop.innerHTML='<div class="scs-gt-sheet scs-team-sheet scs-team-create-sheet" role="dialog" aria-label="'+esc(tx('scsCreateMainButton','Create Tournament'))+'"><header><strong>'+esc(tx('scsNavTournament','Tournament'))+'</strong><button type="button" data-main-cancel aria-label="'+esc(tx('scsTournamentClose','Close'))+'">✕</button></header>'+api.events.createForm()+'</div>';
 document.body.appendChild(backdrop);
 const cancel=()=>{backdrop.remove();if(onCancel)onCancel()};
 backdrop.querySelectorAll('[data-main-cancel]').forEach(b=>b.addEventListener('click',cancel));
 const submit=()=>{const input=backdrop.querySelector('[data-main-name]');const name=input.value.trim();if(!name){backdrop.querySelector('[data-main-error]').hidden=false;input.focus();return}backdrop.remove();if(onCreate)onCreate(name)};
 backdrop.querySelector('[data-main-create]').addEventListener('click',submit);
 backdrop.querySelector('[data-main-name]').addEventListener('keydown',e=>{if(e.key==='Enter')submit()});
 setTimeout(()=>backdrop.querySelector('[data-main-name]')?.focus(),0);
};
api.events.homePage=function({title='',events=[],activeEventId=null,viewOnly=false,navAttribute='data-team-nav',ariaLabel='Tournament sections'}={}){
 return '<div class="scs-gt-sheet scs-team-sheet scs-team-main-sheet"><header><strong>'+esc(title)+'</strong><button type="button" data-close aria-label="'+esc(tx('scsTournamentClose','Close'))+'">✕</button></header>'+api.events.home({events,activeEventId,viewOnly})+'</div>'+api.navigation.bottom({active:'home',attribute:navAttribute,ariaLabel,tournamentName:title,eventName:events.find(e=>e.id===activeEventId)?.title||''});
};
// One Home mounting path for Team, Knockout and Group. Keep the original
// host's tournament-specific logic separate from the shared Home presentation.
api.events.mountHome=function(root,options={}){
 if(!root)throw Error('Tournament Home host is required');
 root.classList.add('scs-api-home-host');
 api.eventIdentity?.clear(root);root.innerHTML=api.events.homePage(options);
 queueMicrotask(()=>{api.events.styleCards(root,options);window.SCSTournamentCourts?.mount(root,options);window.SCSWorkspaceBounds?.commit();});
 return root;
};
// Only a page's own uncached read may show a loader. Cached navigation stays immediate.
(function(){
 const requests=new WeakMap();
 function begin(root){if(!root)return ()=>{};let state=requests.get(root);if(!state){state={count:0,timer:null};requests.set(root,state);}state.count++;
  if(!state.timer)state.timer=setTimeout(()=>{state.timer=null;if(state.count&&root.isConnected&&!root.hidden){root.classList.add('scs-page-loading');root.setAttribute('aria-busy','true');}},120);
  let done=false;return ()=>{if(done)return;done=true;state.count--;if(!state.count){clearTimeout(state.timer);state.timer=null;root.classList.remove('scs-page-loading');root.removeAttribute('aria-busy');}};
 }
 api.loading={begin,async run(root,read){const end=begin(root);try{return await read();}finally{end();}},preserve(root,render){const selectors=['[data-scs-workspace-content]','.scs-gt-sheet','.scs-team-sheet'];const positions=selectors.map(selector=>({selector,top:root?.querySelector(selector)?.scrollTop||0}));const result=render();requestAnimationFrame(()=>{if(!root?.isConnected)return;for(const item of positions){const pane=root.querySelector(item.selector);if(pane)pane.scrollTop=item.top;}});return result;}};
})();
api.eventIdentity=(()=>{
 const colors=new Map(),properties=['--scs-event-bg','--scs-event-accent','--bg','--surface','--surface2','--sport-bg','--sport-surface','--sport-surface2','--sport-accent'];
 function palette(id,parent,stage){const club=typeof getMyClub==='function'?getMyClub()?.id||'':'',key=club+':'+id;let offset=colors.get(key);if(offset===undefined){const index=parent?.events?.findIndex(e=>String(e.id)===String(id))??-1;let hash=0;for(const ch of String(id))hash=(Math.imul(hash,31)+ch.charCodeAt(0))>>>0;offset=(index>=0?index:hash)*137.508;colors.set(key,offset);}const hue=((String(stage)==='0'?246:String(stage)==='1'?184:210)+offset)%360;return {bg:'hsl('+hue.toFixed(2)+' 24% 24%)',accent:'hsl('+hue.toFixed(2)+' 35% 76%)'};}
 function paint(card,event,parent,stage){const color=palette(event.id,parent,stage);card.style.removeProperty('border-color');card.style.setProperty('background','#112e4b','important');card.style.setProperty('--scs-event-bg',color.bg);card.style.setProperty('--scs-event-accent',color.accent);card.dataset.eventColor=String(event.id);const anchor=card.querySelector('.scs-event-card-top>span')||card.querySelector('strong')||card;if(!anchor.querySelector('.scs-event-colour-badge')){const badge=document.createElement('span');badge.className='scs-event-colour-badge';badge.setAttribute('aria-hidden','true');anchor.prepend(badge);}}

 function label(state,parent){const id=state?._scsGroupEventId||state?._scsKoEventId||state?._scsClientTournamentId,base=parent?.events?.find(e=>String(e.id)===String(id))?.title||String(state?.title||'Event').replace(/\s*[—–-]\s*(?:Top|Bottom)\s+Knockout$/i,'');return base+(state?._scsGroupKnockoutStage!=null?' · KO '+(Number(state._scsGroupKnockoutStage)+1):'');}
 function apply(root,parent,id,name,stage){if(!root)return;const color=palette(id,parent,stage);root.dataset.eventIdentity=String(id);root.dataset.eventName=name;for(const property of properties){if(!property.startsWith('--scs-event-')){if(root.style.getPropertyValue(property))root.style.removeProperty(property);continue;}const value=property.includes('accent')?color.accent:color.bg;if(root.style.getPropertyValue(property)!==value)root.style.setProperty(property,value);}refreshHeader();}
 function clear(root){if(!root)return;delete root.dataset.eventIdentity;delete root.dataset.eventName;for(const property of properties)root.style.removeProperty(property);refreshHeader();}
 function refreshHeader(){let active=null;for(const id of ['scsGroupTournament','scsTeamTournament','scsTournamentOverlay']){const root=document.getElementById(id);if(root&&!root.hidden&&getComputedStyle(root).display!=='none')active=root;}const header=document.getElementById('scsTournamentPersistentHeader'),title=document.getElementById('scsTournamentDynamicTitle');if(active?.dataset.eventName){if(title&&title.textContent!==active.dataset.eventName)title.textContent=active.dataset.eventName;if(header){header.dataset.eventIdentity=active.dataset.eventIdentity;const bg=active.style.getPropertyValue('--scs-event-bg');if(header.style.getPropertyValue('--scs-event-bg')!==bg)header.style.setProperty('--scs-event-bg',bg);}}else if(header){delete header.dataset.eventIdentity;header.style.removeProperty('--scs-event-bg');}}
 return {palette,paint,label,apply,clear,refreshHeader};
})();
api.events.groupComplete=function(id,state){
 if(!state?.started||!state.matches?.length||!state.matches.every(m=>m.status==='approved'))return false;
 for(let i=0;i<Math.max(1,Math.min(2,Number(state.config?.knockouts)||1));i++){
  let ko;try{ko=JSON.parse(localStorage.getItem('scs_group_knockout_'+id+'_'+i)||'null')}catch(_){return false}
  const final=ko?.matches?.find(m=>m.final&&!m.third);
  if(!ko||!final||!ko.results?.[final.id]?.winner)return false;
 }
 return true;
};
const directStageRequests=new Map();
api.events.styleCards=function(root,options={}){
 if(!root._scsStageCardClick){root._scsStageCardClick=true;root.addEventListener('click',event=>{const stage=event.target.closest('[data-open-event-stage]');if(!stage)return;event.preventDefault();event.stopImmediatePropagation();const id=stage.dataset.stageEventId;const opener=[...root.querySelectorAll('[data-ko-open-event],[data-open-event]')].find(button=>String(button.dataset.koOpenEvent||button.dataset.openEvent)===id);if(!opener)return;directStageRequests.set(id,stage.dataset.openEventStage);opener.click();},true);}

 const eventState=event=>{try{return options.courtDashboard?.loadEventState?.(event)||JSON.parse(localStorage.getItem('scs_group_event_'+event.id)||'null')}catch(_){return null}};
 const eventStatus=(event,fallback)=>{const state=eventState(event);return event.format==='group'||state?.assignments?(api.events.groupComplete(event.id,state)?'Completed':'In progress'):fallback};
 const stageSummary=(card,event)=>{
  const state=eventState(event);if(!state?.assignments)return;
  card.classList.add('scs-event-flow-card');
  const header=card.querySelector('.scs-event-card-top'),name=card.querySelector('h3'),icon=header?.querySelector('span');
  if(header&&name){header.insertBefore(name,header.querySelector('.scs-event-card-status'));if(icon){icon.className='scs-event-flow-sport';icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16 15 3M8 18 18 5M11 18 21 8M4 14 12 3M13 19 22 12"/><path d="m3 17 4 4 5-4-5-5Z"/></svg>';}}
  const matches=state.matches||[],complete=matches.filter(m=>m.status==='approved').length,groupDone=matches.length>0&&complete===matches.length,count=Math.max(0,Math.min(2,Number(state.config?.knockouts)||0)),teams=Object.values(state.assignments||{}).filter(p=>Array.isArray(p)&&p.length===2&&p.every(Boolean)).length||Number(event.teams)||0;
  const meta=card.querySelector('.scs-event-card-meta');if(meta){meta.className='scs-event-flow-stats';meta.innerHTML='<span><b>'+teams+'</b> Teams</span><span><b>'+complete+' / '+matches.length+'</b> Group matches</span>';}
  const arrow='<span class="scs-event-flow-state-icon" aria-hidden="true">›</span>',node=(stage,label,status,kind)=>'<button type="button" class="scs-event-flow-stage is-'+kind+'" data-open-event-stage="'+esc(stage)+'" data-stage-event-id="'+esc(event.id)+'" aria-label="Open '+esc(event.title||'Event')+' '+esc(label)+'"><span><strong>'+label+'</strong><small>'+status+'</small></span><span class="scs-event-flow-state-icon" aria-hidden="true">'+(kind==='complete'?'✓':kind==='progress'?'▶':'◷')+'</span></button>';
  const branches=Array.from({length:count},(_,i)=>{let saved;try{saved=JSON.parse(localStorage.getItem('scs_group_knockout_'+event.id+'_'+i)||'null')}catch(_){}const final=saved?.matches?.find(m=>m.final&&!m.third),done=!!(final&&saved.results?.[final.id]?.winner),started=!!saved?.live;return node(String(i),'KO '+(i+1),done?'Complete':started?'In progress':groupDone?'Not started':'Awaiting group results',done?'complete':started?'progress':'waiting');}).join('');
  const tree=document.createElement('div');tree.className='scs-event-stage-tree'+(!count?' is-group-only':'');tree.style.setProperty('--branch-count',count||1);tree.innerHTML=node('group','Group',groupDone?'Complete':state.started?'In progress':'Not started',groupDone?'complete':state.started?'progress':'waiting')+(count?'<div class="scs-event-ko-branches">'+branches+'</div>':'');
  (meta||name||header).after(tree);
  tree.querySelectorAll('[data-open-event-stage]').forEach(button=>api.eventIdentity.paint(button,event,options.courtDashboard?.parentState?.()||{events:options.events},button.dataset.openEventStage));
 };
 const markActive=(card,event)=>{if(String(event.id)!==String(options.activeEventId))return;card.classList.add('is-active');card.setAttribute('aria-label','Active event: '+(event.title||'Event'));const marker=document.createElement('span');marker.className='scs-active-event-marker';marker.textContent='✓ Active event';card.querySelector('h3')?.appendChild(marker);};
 const header=(status,format)=>'<div class="scs-event-card-top"><span>▦ '+esc(format==='group'?'Group Stage + Knockout':format==='knockout'?'Knockout':'Event')+'</span><span class="scs-event-card-status '+(status==='Completed'?'is-completed':'')+'">'+esc(status)+'</span></div>';
 root.querySelectorAll('.scs-ko-home-event').forEach(card=>{
  if(card.classList.contains('scs-event-card'))return;
  const summary=card.querySelector('.scs-ko-home-event-summary'),name=summary?.querySelector('strong')?.textContent||'Event',meta=summary?.querySelector('small')?.textContent||'',event=options.events?.find(e=>String(e.id)===String(card.querySelector('[data-ko-open-event]')?.dataset.koOpenEvent))||{},status=eventStatus(event,card.querySelector('.scs-ko-home-status')?.textContent||'Live');
  card.classList.add('scs-event-card');summary?.remove();
  card.insertAdjacentHTML('afterbegin',header(status,card.dataset.cardFormat)+'<h3>'+esc(name)+'</h3><p class="scs-event-card-meta">'+esc(meta)+'</p>');
  api.eventIdentity.paint(card,event,options.courtDashboard?.parentState?.()||{events:options.events});markActive(card,event);stageSummary(card,event);
  const actions=card.querySelector('.scs-ko-home-card-actions'),open=actions?.querySelector('.scs-ko-event-open'),del=actions?.querySelector('.scs-ko-delete-event');
  if(open){if(card.classList.contains('scs-event-flow-card'))open.style.setProperty('display','none','important');open.classList.add('scs-event-card-open');open.innerHTML=(status==='Completed'?'View results':'Open event')+'<span aria-hidden="true">➜</span>'}
  if(del&&!options.viewOnly){const menu=document.createElement('details');menu.className='scs-event-card-menu';menu.innerHTML='<summary aria-label="Actions for '+esc(name)+'">⋯</summary><div class="scs-event-card-menu-panel"></div>';menu.querySelector('div').appendChild(del);card.querySelector('.scs-event-card-top').appendChild(menu);menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.open=false;menu.querySelector('summary').focus()}})}else del?.remove();
 });
 root.querySelectorAll('button[data-open-event]').forEach(button=>{
  if(button.closest('.scs-event-flow-card'))return;
  const event=options.events?.find(e=>String(e.id)===button.dataset.openEvent)||{},state=eventState(event),meta=button.querySelector('small')?.textContent||'',status=eventStatus(event,event.status==='completed'||(Number(event.matches)>0&&Number(event.completed)>=Number(event.matches))?'Completed':'Live');
  if(state?.assignments){const card=document.createElement('article');card.className='scs-event-card';button.before(card);card.innerHTML=header(status,event.format)+'<h3>'+esc(event.title||'Event')+'</h3><p class="scs-event-card-meta">'+esc(meta)+'</p>';card.append(button);button.style.setProperty('display','none','important');api.eventIdentity.paint(card,event,options.courtDashboard?.parentState?.()||{events:options.events});markActive(card,event);stageSummary(card,event);}
  else{button.classList.add('scs-event-card','scs-event-card-button');button.innerHTML=header(status,event.format)+'<h3>'+esc(event.title||'Event')+'</h3><p class="scs-event-card-meta">'+esc(meta)+'</p><span class="scs-event-card-open">'+(status==='Completed'?'View results':'Open event')+'<span aria-hidden="true">➜</span></span>';api.eventIdentity.paint(button,event,options.courtDashboard?.parentState?.()||{events:options.events});markActive(button,event);}
 });
};
api.events.leaveHome=function(root){root?.classList.remove('scs-api-home-host')};
api.events.eventForm=function({parentTitle=''}={}){
 return '<section class="scs-gt-card scs-team-main-create"><div class="scs-team-main-icon">🏸</div><h2>'+esc(tx('scsCreateEventHeading','Add Event'))+'</h2><p>'+esc(tx('scsCreateEventHelpStart','Create an event under'))+' <strong>'+esc(parentTitle)+'</strong>. '+esc(tx('scsCreateEventHelpEnd','Each event has its own matches and results.'))+'</p><label for="scs-event-name">'+esc(tx('scsCreateEventName','Event Name'))+'</label><input id="scs-event-name" data-event-name type="text" maxlength="100" autocomplete="off" placeholder="'+esc(tx('scsCreateEventPlaceholder','e.g. Men’s Doubles'))+'" /><small data-event-error hidden>'+esc(tx('scsCreateEventError','Please enter an event name.'))+'</small><div class="scs-team-main-actions"><button type="button" data-event-cancel>'+esc(tx('scsTournamentCancel','Cancel'))+'</button><button type="button" class="scs-gt-primary" data-event-create>'+esc(tx('scsCreateEventButton','Create Event'))+' →</button></div></section>';
};
api.events.chooseEventStage=function(event,state){
 const request=directStageRequests.get(String(event.id));if(request!==undefined){directStageRequests.delete(String(event.id));return Promise.resolve(request);}
 if(!(Number(state?.config?.knockouts)>1))return Promise.resolve('group');
 return new Promise(resolve=>{const previous=document.activeElement,overlay=document.createElement('div');overlay.className='scs-court-popup-overlay';overlay.dataset.eventStageChooser='';const dialog=document.createElement('section');dialog.className='scs-court-popup scs-stage-choice';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Choose stage for '+(event.title||'Event'));dialog.innerHTML='<div class="scs-court-popup-head"><h3>'+esc(event.title||'Event')+' · Choose stage</h3><button type="button" data-stage-cancel aria-label="Cancel">×</button></div><p>Choose the stage you are organising. Only that stage will open.</p>'+[['group','Group','Group setup, matches and results'],['0','KO 1','Draw, assignment and approval for KO 1'],['1','KO 2','Draw, assignment and approval for KO 2']].map(([id,label,description])=>'<button type="button" class="scs-stage-choice-option" data-stage-choice="'+id+'"><strong>'+label+'</strong><small>'+description+'</small><span aria-hidden="true">›</span></button>').join('');let done=false;const finish=value=>{if(done)return;done=true;overlay.remove();document.removeEventListener('keydown',keyboard);previous?.isConnected&&previous.focus();resolve(value);},keyboard=e=>{if(e.key==='Escape'){e.preventDefault();finish(null);}if(e.key==='Tab'){const buttons=[...dialog.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};dialog.querySelectorAll('[data-stage-choice]').forEach(button=>api.eventIdentity.paint(button,event,undefined,button.dataset.stageChoice));dialog.querySelector('[data-stage-cancel]').onclick=()=>finish(null);dialog.querySelectorAll('[data-stage-choice]').forEach(button=>button.onclick=()=>finish(button.dataset.stageChoice));overlay.append(dialog);overlay.onclick=e=>{if(e.target===overlay)finish(null);};document.addEventListener('keydown',keyboard);document.body.append(overlay);dialog.querySelector('[data-stage-choice]').focus();});
};
api.events.requestEvent=function({parentTitle='',onCreate,onCancel,chooseFormat=false}={}){
 const backdrop=document.createElement('div');backdrop.className='scs-gt-overlay scs-team-overlay';backdrop.style.zIndex='2147483000';
 backdrop.innerHTML='<div class="scs-gt-sheet scs-team-sheet scs-team-create-sheet" role="dialog" aria-label="'+esc(tx('scsCreateEventHeading','Add Event'))+'"><header><strong>'+esc(parentTitle)+'</strong><button type="button" data-event-cancel aria-label="'+esc(tx('scsTournamentClose','Close'))+'">✕</button></header>'+api.events.eventForm({parentTitle})+'</div>';
 if(chooseFormat)backdrop.querySelector('.scs-team-main-actions').insertAdjacentHTML('beforebegin','<label class="scs-event-format-label">Event format<select data-event-format><option value="knockout">Knockout</option><option value="group">Group Stage + Knockout</option></select></label><p>Choose a format for this event. Other events can use a different format.</p>');
 document.body.appendChild(backdrop);const input=backdrop.querySelector('[data-event-name]');
 const cancel=()=>{backdrop.remove();onCancel?.()};backdrop.querySelectorAll('[data-event-cancel]').forEach(b=>b.onclick=cancel);
 const submit=()=>{const name=input.value.trim();if(!name){backdrop.querySelector('[data-event-error]').hidden=false;input.focus();return}const format=backdrop.querySelector('[data-event-format]')?.value||null;backdrop.remove();onCreate?.(name,format)};
 backdrop.querySelector('[data-event-create]').onclick=submit;input.onkeydown=e=>{if(e.key==='Enter')submit()};setTimeout(()=>input.focus(),0);
};
api.events.home=function({events=[],activeEventId=null,viewOnly=false}={}){
 const countClubs=new Set(events.flatMap(e=>Array.isArray(e.clubs)?e.clubs:[]).filter(Boolean)).size;
 const eventGender=e=>/^L(?:-|\d|$)/i.test(String(e.title||'').trim())?'ladies':/^M(?:-|\d|$)/i.test(String(e.title||'').trim())?'men':'other';
 const section=(kind,title)=>{
  const items=events.filter(e=>eventGender(e)===kind);
  if(!items.length)return '';
  return '<section class="scs-team-event-section"><h2>'+esc(title)+' <span>('+items.length+')</span></h2><div class="scs-team-event-list">'+items.map(e=>{
   const clubs=Array.isArray(e.clubs)?e.clubs:[];
   const active=e.id===activeEventId;
   return '<button type="button" class="scs-team-event-row '+kind+(active?' is-active':'')+'" data-open-event="'+esc(e.id)+'"'+(active?' aria-label="Active Event: '+esc(e.title||'Event')+'"':'')+'><span class="scs-team-event-code">'+esc(e.title||'Event')+'</span><span class="scs-team-event-details"><strong>'+esc(clubs.join(', ')||tx('scsEventsNoClubs','Clubs not selected'))+'</strong><small>'+clubs.length+' teams · '+Number(e.completed||0)+' / '+Number(e.matches||0)+' '+esc(tx('scsEventsMatchesDone','matches completed'))+'</small>'+(active?'<span class="scs-team-event-active-label">✓ '+esc(tx('scsEventsActive','Active Event'))+'</span>':'')+'</span><span class="scs-team-event-arrow" aria-hidden="true">›</span></button>';
  }).join('')+'</div></section>';
 };
 return '<div class="scs-team-event-home"><p class="scs-team-event-summary">'+events.length+' '+esc(tx('scsEventsCount','events'))+' · '+countClubs+' '+esc(tx('scsEventsTeams','teams'))+'</p>'+
  (events.length?section('men',tx('scsEventsMen','Men’s Events'))+section('ladies',tx('scsEventsLadies','Ladies’ Events'))+section('other',tx('scsEventsOther','Other Events')):'<p class="scs-team-event-empty">'+esc(tx('scsEventsNone','No events yet. Add an event to get started.'))+'</p>')+
  (viewOnly?'':api.buttons.render({label:'＋ '+tx('scsEventsAdd','Add Event'),action:'add-event',className:'scs-gt-primary scs-team-add-event-bottom'}))+'</div>';
};
api.players=api.players||{};
async function pickRegisteredRoster(onDone, providers={}){
 const {registeredClubChoices,registeredClubPlayers,playerRow,hydratePlayerCards}=providers;
 if([registeredClubChoices,registeredClubPlayers,playerRow,hydratePlayerCards].some(f=>typeof f!=='function'))throw Error('Shared roster picker requires registered-club providers');
 const modal=document.createElement('section');modal.className='scs-tm-entry-modal';
 modal.innerHTML='<div class="scs-tm-entry-editor scs-team-club-editor"><div class="scs-team-club-scroll"><div class="scs-team-editor-head"><h3>Club players</h3><p>Select a registered sub-club and its players</p></div><label>Sub-club<select data-club><option value="">Select a sub-club</option></select></label><p data-status>Loading clubs…</p><div data-roster></div></div><div class="scs-tm-import-actions"><button type="button" data-cancel>'+esc(tx('scsTournamentCancel','Cancel'))+'</button><button type="button" class="scs-tm-primary" data-done>'+esc(tx('scsTournamentDone','Done'))+'</button></div></div>';
 document.body.appendChild(modal);
 const sel=modal.querySelector('[data-club]'),status=modal.querySelector('[data-status]'),list=modal.querySelector('[data-roster]');let clubs=[],names=[];
 const close=()=>modal.remove();modal.querySelector('[data-cancel]').onclick=close;
 try{clubs=await registeredClubChoices();clubs.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;sel.appendChild(o)});status.textContent=clubs.length?'Choose a sub-club.':'No registered sub-clubs available.'}
 catch(e){status.textContent='Unable to load clubs: '+(e.message||e)}
 sel.onchange=async()=>{names=[];list.innerHTML='';if(!sel.value)return;status.textContent=(typeof t === 'function' ? t('scsLoadingPlayers') : "Loading players…");try{const id=sel.value;const loaded=await registeredClubPlayers(id);if(sel.value!==id)return;names=loaded;status.textContent=names.length+' registered players';list.innerHTML=names.map(n=>'<label class="scs-gt-player scs-team-level-row" style="display:flex;align-items:center;gap:10px;padding:8px"><input type="checkbox" data-name="'+esc(n)+'"><span>'+playerRow(n)+'</span></label>').join('');hydratePlayerCards()}catch(e){status.textContent='Unable to load players: '+(e.message||e)}};
 modal.querySelector('[data-done]').onclick=()=>{const club=clubs.find(c=>c.id===sel.value);if(!club){status.textContent=(typeof t === 'function' ? t('scsSelectSubClub') : "Select a sub-club first.");return}const selected=[...list.querySelectorAll('input[data-name]:checked')].map(x=>x.dataset.name);if(!selected.length){status.textContent=(typeof t === 'function' ? t('scsSelectOnePlayer') : "Select at least one player.");return}close();onDone({clubId:club.id,clubName:club.name,players:selected})};
}
api.players.pickRegisteredRoster=pickRegisteredRoster;

// One tournament-wide player selector. Competition modules own pair/group rules.
api.players.select=async function({selected=[],onDone,onCancel}={}){
 const selectedMap=new Map((selected||[]).filter(p=>p&&p.player).map(p=>[String(p.subClubId||p.subClub||'')+'|'+String(p.playerId||p.player).toLowerCase(),p]));
 const modal=document.createElement('section');modal.className='scs-tm-entry-modal scs-api-player-selector';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
 modal.innerHTML='<div class="scs-tm-entry-editor scs-team-club-editor"><div class="scs-team-club-scroll"><div class="scs-team-editor-head"><h3>Tournament Players Manager</h3><p>Select players from the selected main club and its sub-clubs</p></div><label>Club filter<select data-subclub><option value="">All — main club and sub-clubs</option></select></label><p data-status role="status">Loading sub-clubs…</p><div data-players></div><h4 data-count>Selected players ('+selectedMap.size+')</h4></div><div class="scs-tm-import-actions"><button type="button" data-cancel>'+esc(tx('scsTournamentCancel','Cancel'))+'</button><button type="button" class="scs-tm-primary" data-done>'+esc(tx('scsTournamentDone','Done'))+'</button></div></div>';
 // Mount inside the invoking tournament overlay so its existing modal CSS and
 // stacking context apply. In particular, Team Tournament has a high-z-index
 // overlay and a body-mounted selector would be hidden underneath it on iOS.
 // Keep the existing shared selector within the *visible invoking page*.
 // Group -> Knockout has two visible parent overlays; the knockout is the
 // foreground page, regardless of which element retained keyboard focus.
 const visibleKnockout=document.querySelector('#scsTournamentOverlay:not([hidden])');
 const focusedHost=document.activeElement?.closest?.('.scs-team-overlay, .scs-gt-overlay, .scs-tm-overlay');
 const host=visibleKnockout || focusedHost || document.querySelector('#scsGroupTournament:not([hidden])') || document.querySelector('#scsTeamTournament:not([hidden])') || document.body;
 host.appendChild(modal);
 const sel=modal.querySelector('[data-subclub]'),status=modal.querySelector('[data-status]'),list=modal.querySelector('[data-players]'),count=modal.querySelector('[data-count]');
 const finish=(value)=>{modal.remove();if(value===null){if(onCancel)onCancel();return null}if(onDone)onDone(value.map(p=>({playerId:p.playerId||null,player:p.player,subClubId:p.subClubId||null,subClub:p.subClub,gender:p.gender,level:p.level})));return value};
 modal.querySelector('[data-cancel]').onclick=()=>finish(null);
 const redrawCount=()=>count.textContent='Selected players ('+selectedMap.size+')';
 let clubs=[],mainClub=null;
 const timed=(work)=>Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Request timed out. Check connection and try again.')),15000))]);
 try{mainClub=await timed(()=>scsResolveOrganizerClub());clubs=await timed(()=>dbGetSubClubs(mainClub.id));clubs.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;sel.appendChild(o)});status.textContent='Showing players from '+(mainClub.name||'main club')+' and its sub-clubs.';await loadSelection();}
 catch(e){status.textContent='Could not load sub-clubs: '+(e.message||e)}
 async function loadSelection(){
  const chosen=sel.value;
  list.innerHTML='';status.textContent=(typeof t === 'function' ? t('scsLoadingPlayers') : 'Loading players…');
  try{
   if(!mainClub)throw Error('Main club is not available');
   const sources=chosen?[...clubs.filter(c=>String(c.id)===String(chosen))]:[mainClub,...clubs];
   const groups=await Promise.all(sources.map(async c=>({club:c,rows:await timed(()=>sbGet('memberships','club_id=eq.'+encodeURIComponent(c.id)+'&select=nickname,player_id'))})));
   if(sel.value!==chosen)return;
   const ids=[...new Set(groups.flatMap(g=>(g.rows||[]).map(m=>m.player_id).filter(Boolean)))];let info=new Map();
   if(ids.length){const rows=await timed(()=>sbGet('players','id=in.('+ids.map(encodeURIComponent).join(',')+')&select=id,gender,level'));info=new Map((rows||[]).map(p=>[String(p.id),p]))}
   if(sel.value!==chosen)return;
   const seen=new Set();
   const players=groups.flatMap(({club,rows})=>(rows||[]).filter(m=>m.nickname).map(m=>{
    const details=info.get(String(m.player_id))||{};
    const g=String(details.gender||'').toLowerCase();const gender=/^(f|female|woman|women|lady|ladies|l)$/.test(g)?'Female':/^(m|male|man|men)$/.test(g)?'Male':(details.gender||null);
    const n=Number(details.level);return {playerId:m.player_id||null,player:String(m.nickname).trim(),subClubId:club.id,subClub:club.name||'',gender,level:Number.isInteger(n)&&n>=1&&n<=5?n:null};
   })).filter(p=>{const key=p.playerId?'id:'+p.playerId:'club:'+p.subClubId+'|'+p.player.toLowerCase();if(seen.has(key))return false;seen.add(key);return true});
   list.innerHTML='';players.forEach(p=>{
    const key=String(p.subClubId||p.subClub)+'|'+String(p.playerId||p.player).toLowerCase();const row=document.createElement('label');row.className='scs-gt-player scs-team-level-row scs-api-select-row';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selectedMap.has(key)||selectedMap.has(p.subClub+'|'+p.player.toLowerCase());checkbox.onchange=()=>{if(checkbox.checked){selectedMap.delete(p.subClub+'|'+p.player.toLowerCase());selectedMap.set(key,p);}else {selectedMap.delete(key);selectedMap.delete(p.subClub+'|'+p.player.toLowerCase())}redrawCount()};
    const content=document.createElement('span');content.className='scs-api-select-content';
    content.innerHTML=api.cards.rosterPlayer({name:p.player,subClub:p.subClub,level:p.level,gender:p.gender,levelMarkup:'<span class="scs-tournament-gender-level">'+esc((p.gender==='Female'?'L':p.gender==='Male'?'M':'')+(p.level??'—'))+'</span>'});
    const slot=content.querySelector('.scs-tm-ring-slot');if(slot){slot.dataset.tmPlayerId=p.playerId||'';slot.dataset.tmSubclubId=p.subClubId||'';slot.dataset.tmGender=p.gender||'';slot.dataset.tmLevel=p.level??'';}
    row.append(checkbox,content);list.appendChild(row);
   });
   status.textContent=players.length+' registered players';
   if(window.SCSTournamentPlayerLevel)window.SCSTournamentPlayerLevel.hydrate(list);
  }catch(e){status.textContent='Could not load players: '+(e.message||e)}
 }
 sel.onchange=loadSelection;
 modal.querySelector('[data-done]').onclick=()=>finish([...selectedMap.values()]);
 return modal;
};

api.matchCenter=api.matchCenter||{};

/* V941: one visible and programmatic gate for incomplete event setup. */
api.events.validScoringRules=function(rules){return !!rules&&[1,3].includes(Number(rules.matchSets))&&Array.isArray(rules.setRules)&&rules.setRules.length>=rules.matchSets&&rules.setRules.slice(0,rules.matchSets).every(r=>Number.isInteger(Number(r.win))&&Number(r.win)>=1&&Number.isInteger(Number(r.max))&&Number(r.max)>=Number(r.win));};
api.events.setupIssues=function({title='',teams=[],minimum=2,courts=1,rules=null,extra=[]}={}){
 const issues=[];if(!String(title).trim())issues.push('Enter the event name.');
 if(teams.length<minimum||teams.some(t=>!Array.isArray(t)||t.length!==2||t.some(n=>!String(n||'').trim()||/^Entry \d+$/i.test(String(n)))))issues.push('Form at least '+minimum+' complete teams with two players each.');
 const names=teams.flat().map(n=>String(n||'').trim().toLocaleLowerCase()).filter(Boolean);
 if(new Set(names).size!==names.length)issues.push('A player cannot appear in more than one team.');
 if(!Number.isInteger(Number(courts))||Number(courts)<1)issues.push('Set a valid number of courts.');
 if(rules&&!api.events.validScoringRules(rules))issues.push('Complete valid scoring rules.');
 return [...new Set([...issues,...extra.filter(Boolean)])];
};
api.events.ruleFormIssues=function(root,saved,countSelector,winSelector,maxSelector){
 const countInput=root?.querySelector(countSelector);if(!countInput)return [];
 const count=Number(countInput.value),rows=[];if(![1,3].includes(count))return ['Select a valid match format.'];
 for(let i=0;i<count;i++){
  const win=Number(root.querySelector(winSelector(i))?.value),max=Number(root.querySelector(maxSelector(i))?.value);
  if(!Number.isInteger(win)||win<1||!Number.isInteger(max)||max<win)return ['Enter positive scoring points with Maximum at least Points to win.'];rows.push({win,max});
 }
 if(Number(saved.matchSets)!==count||rows.some((r,i)=>Number(saved.setRules[i]?.win)!==r.win||Number(saved.setRules[i]?.max)!==r.max))return ['Apply the edited scoring rules.'];
 return [];
};
// Keep the current editor in place when controls/checklists change height.
api.events.keepEditorPosition=function(root,selector,change){
 const anchor=root?.querySelector(selector);
 const top=anchor?.getBoundingClientRect().top;
 const restore=()=>{const current=root?.querySelector(selector),scroll=root?.querySelector('[data-scs-workspace-content]');if(current?.isConnected&&scroll?.isConnected&&Number.isFinite(top)){scroll.scrollTop+=current.getBoundingClientRect().top-top;}};
 const finish=()=>{restore();requestAnimationFrame(restore);};
 try{const result=change();if(result&&typeof result.then==='function')return result.then(v=>{finish();return v;},error=>{finish();throw error;});finish();return result;}catch(error){finish();throw error;}
};
api.events.revealSetupField=function(target){
 if(!target)return;for(let p=target.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
 target.scrollIntoView({block:'center',behavior:'smooth'});if(typeof target.focus==='function')target.focus({preventScroll:true});
};
api.events.gateNavigation=function(root,attribute,issues,showNote=true,steps=[]){
 if(!root)return;
 const message=issues.length?'Complete Event setup: '+issues.join(' '):'';
 root.querySelectorAll('['+attribute+'="tournament"],['+attribute+'="match"]').forEach(button=>{button.disabled=!!issues.length;button.setAttribute('aria-disabled',String(!!issues.length));button.title=message;});
 let note=root.querySelector('[data-event-readiness]');
 if(!message||!showNote){note?.remove();return;}
 if(!note){note=document.createElement('section');note.dataset.eventReadiness='';note.className='scs-event-readiness scs-event-setup-assist';note.setAttribute('aria-label','Event Assist');const host=root.querySelector('.scs-event-overview,.scs-gt-sheet,.scs-tm-panel')||root;host.prepend(note);}
 const signature=JSON.stringify([message,steps.map(s=>[s.label,!!s.done,s.available!==false])]);if(note.dataset.signature===signature)return;note.dataset.signature=signature;
 note.replaceChildren();const title=document.createElement('h3');title.textContent='Event Assist';note.append(title);
 if(steps.length){
  const progress=document.createElement('p');progress.className='scs-event-assist-progress';progress.textContent=steps.filter(s=>s.done).length+' of '+steps.length+' steps complete';note.append(progress);
  const list=document.createElement('ol');list.className='scs-event-assist-steps';
  steps.forEach(step=>{const row=document.createElement('li');row.className=step.done?'is-complete':'is-missing';row.dataset.eventAssistStep=step.label;
   const control=document.createElement(typeof step.run==='function'?'button':'span');if(control.tagName==='BUTTON'){control.type='button';control.disabled=step.available===false;control.onclick=step.run;}
   const mark=document.createElement('span');mark.className='scs-event-assist-mark';mark.textContent=step.done?'✓':'○';mark.setAttribute('aria-hidden','true');
   const text=document.createElement('span');text.textContent=step.label;const status=document.createElement('small');status.textContent=step.done?'Complete':step.available===false?'Finish earlier steps':'To do';control.append(mark,text,status);row.append(control);list.append(row);
  });note.append(list);
 }
 const help=document.createElement('p');help.className='scs-event-assist-message';help.setAttribute('role','status');help.setAttribute('aria-live','polite');help.textContent=message;note.append(help);
};
})();
