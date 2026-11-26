(function(){
'use strict';
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const cardStatuses={ready:'Ready',waiting:'Not ready',playing:'In progress',approval:'Under approval',finished:'Finished'};
function knockoutStage(matches,match){if(!match)return 'Knockout';if(match.third)return 'Third place';if(match.final)return 'Final';const list=(matches||[]).filter(m=>!m.third),final=list.find(m=>m.final)||list.slice().sort((a,b)=>Number(b.round||0)-Number(a.round||0))[0];let current=match,distance=0;const seen=new Set();while(current&&final&&String(current.id)!==String(final.id)&&!seen.has(String(current.id))){seen.add(String(current.id));const source='W'+current.id;current=list.find(m=>String(m.a)===source||String(m.b)===source);distance++;}if(!current||!final||String(current.id)!==String(final.id))distance=Math.max(0,Number(final?.round||1)-Number(match.round||1));return distance===0?'Final':distance===1?'Semi-final':distance===2?'Quarter-final':'Round of '+Math.pow(2,distance+1);}
function cardScore(score){let sets=[];if(typeof score==='string')sets=[...score.matchAll(/(\d+)\s*[-–—:]\s*(\d+)/g)].map(m=>[m[1],m[2]]);else if(score){sets=(score.completedSets||score.sets||[]).map(s=>Array.isArray(s.score)?s.score:[s.a??s.left,s.b??s.right]).filter(s=>s.length===2&&s.every(n=>Number.isFinite(Number(n))));if(!score.finished&&Array.isArray(score.currentScore))sets.push(score.currentScore);if(!sets.length&&Array.isArray(score.currentScore))sets.push(score.currentScore);}return sets.map(s=>s.map(String));}
function matchCard(o){const status=Object.hasOwn(cardStatuses,o.status)?o.status:'waiting',label=cardStatuses[status],pairs=o.pairs||[o.leftPlayers||[],o.rightPlayers||[]],names=[o.leftLabel||pairs[0]?.join(' / ')||o.left||'To be confirmed',o.rightLabel||pairs[1]?.join(' / ')||o.right||'To be confirmed'],sets=cardScore(o.score),scored=['playing','approval','finished'].includes(status),approved=status==='finished',winner=approved&&(o.winner==='left'||o.winner==='L')?0:approved&&(o.winner==='right'||o.winner==='R')?1:-1;
 const avatar='<span class="scs-status-player-avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M5 21v-4a7 7 0 0 1 14 0v4Z"/></svg></span>';
 const players=i=>{const list=pairs[i]?.length?pairs[i]:String(names[i]).split(' / ');return list.map(name=>'<span class="scs-status-player">'+(o.playerRenderer?o.playerRenderer(name):avatar+'<span class="scs-status-player-name">'+esc(name)+'</span>')+'</span>').join('');};
 const title=o.title||[o.eventTitle,o.stage,'Match '+o.number].filter(Boolean).join(' · '),team=i=>'<div class="scs-status-team scs-status-team-'+i+(winner===i?' is-winner':'')+'"><div class="scs-status-player-list">'+players(i)+(winner===i?' <span class="scs-status-trophy" role="img" aria-label="Approved winner">🏆</span>':'')+'</div><span class="scs-status-score" aria-label="'+(sets.length?'Score':'No score yet')+'">'+(scored?(sets.length?sets.map(s=>'<b>'+esc(s[i]??'–')+'</b>').join(''):status==='playing'?'<b>0</b>':'<b>–</b>'):'<b>–</b>')+'</span></div>';
 let note=o.note||'';if(!note)note=status==='ready'?'Court available':status==='waiting'?'Waiting for players or earlier results':status==='playing'?(o.court?'Court '+o.court:'Match in progress'):status==='approval'?'Submitted result':winner>=0?'Winner: '+names[winner]:'Approved result';
 return '<article class="scs-status-match-card'+(o.className?' '+esc(o.className):'')+'" data-match-status="'+status+'"'+(o.attributes?' '+o.attributes:'')+(o.cardAction?' role="button" tabindex="0" '+o.cardAction:'')+'><header class="scs-status-match-head"><h3>'+esc(title)+'</h3><span class="scs-status-badge">'+label+'</span></header><div class="scs-status-match-teams">'+team(0)+'<div class="scs-status-versus"><span>vs</span></div>'+team(1)+'</div><footer class="scs-status-match-foot"><span>'+esc(note)+'</span>'+(o.action?'<button type="button" '+o.action+'>'+esc(o.actionLabel||'View result')+'</button>':'')+'</footer></article>';
}

function samePlayer(a,b){return String(a||'').trim().toLocaleLowerCase()===String(b||'').trim().toLocaleLowerCase()}
function serverMark(name,server){return server&&samePlayer(name,server)?'<span class="scs-tm-server-shuttle" title="Serving" aria-label="Serving">🏸</span>':''}
function playerRows(names,playerRenderer,server){return (names||[]).map(n=>'<span class="scs-tm-serving-player">'+(playerRenderer?playerRenderer(n):esc(n))+serverMark(n,server)+'</span>').join('')}
function playerIdentity(name,detail){
 const d=detail||{},v=Number(d.level),valid=Number.isInteger(v)&&v>=1&&v<=5;
 const gender=String(d.gender||'');
 const prefix=/female|woman|lady|women|^f$/i.test(gender)?'L':'M';
 const label=valid?'<span class="scs-team-level-pill scs-api-level-pill" data-level="'+v+'">'+prefix+v+'</span>':'';
 const club=String(d.subClub||d.club||'').trim();
 const color=String(d.accent||'#5279aa');
 const safeColor=/^#[0-9a-fA-F]{3,8}$/.test(color)?color:'#5279aa';
 const clubPill=club?'<span class="scs-team-inline-club-pill scs-api-subclub-pill" style="--pill-accent:'+safeColor+'">'+esc(club)+'</span>':'';
 return '<span class="scs-match-player-identity"><span class="scs-match-player-name">'+(window.ScsApi&&ScsApi.cards?ScsApi.cards.player(name,''):'<span class="scs-tm-shared-name">'+esc(name)+'</span>')+'</span>'+(label||clubPill?'<span class="scs-match-player-meta">'+label+clubPill+'</span>':'')+'</span>';
}
function court(o){
 if(o.match&&o.matchCards){const m=o.match;return matchCard({status:m.ready?'approval':m.started?'playing':'ready',title:[o.eventTitle,m.label||('Match '+o.number)].filter(Boolean).join(' · '),pairs:[m.left||[],m.right||[]],playerRenderer:o.playerRenderer,score:m.scoreData||m.score,winner:m.winner,court:o.number,note:'Court '+o.number+(m.ready?' · Submitted result':''),action:m.action,actionLabel:m.actionLabel,cardAction:m.cardAction});}

 if(!o.match)return '<div class="scs-tm-court-card is-free"><div class="scs-tm-court-head"><strong>COURT '+o.number+'</strong><span>FREE</span></div><p>— Empty Court —</p></div>';
 let m=o.match;
 // Once scoring starts, keep each team's score beside that team. This is easier
 // to scan courtside than a combined "5 - 3" strip below both teams.
 if(m.score){return '<div class="scs-tm-court-card '+(m.ready?'is-ready ':'')+'scs-tm-court-result"'+(m.cardAction?' role="button" tabindex="0" '+m.cardAction:'')+'><div class="scs-tm-court-head"><strong>COURT '+o.number+'</strong><span>'+esc(m.status)+'</span></div><small>'+esc(m.label)+'</small>'+scoredBody({left:m.leftText||((m.left||[]).join(' / ')),right:m.rightText||((m.right||[]).join(' / ')),leftPlayers:m.left||[],rightPlayers:m.right||[],score:m.score,winner:m.winner,server:m.server,playerRenderer:o.playerRenderer})+(m.action?'<button type="button" class="'+(m.ready?'scs-tm-approve':'scs-tm-score-open')+'" '+m.action+'>'+esc(m.actionLabel)+'</button>':'')+'</div>';}
 return '<div class="scs-tm-court-card '+(m.ready?'is-ready':'')+'"'+(m.cardAction?' role="button" tabindex="0" '+m.cardAction:'')+'><div class="scs-tm-court-head"><strong>COURT '+o.number+'</strong><span>'+esc(m.status)+'</span></div><small>'+esc(m.label)+'</small><div class="scs-tm-court-teams"><b>'+playerRows(m.left,o.playerRenderer,m.server)+'</b><b>'+playerRows(m.right,o.playerRenderer,m.server)+'</b></div>'+(m.score?'<div class="scs-tm-court-score">'+esc(m.score)+'</div>':'')+(m.action?'<button type="button" class="'+(m.ready?'scs-tm-approve':'scs-tm-score-open')+'" '+m.action+'>'+esc(m.actionLabel)+'</button>':'')+(m.secondaryAction?'<button type="button" class="scs-tm-score-open" '+m.secondaryAction+'>'+esc(m.secondaryLabel)+'</button>':'')+'</div>';
}
function waiting(o){
 if(o.matchCards){const enabled=o.action&&!/^disabled/.test(o.action),status=o.matchStatus||(o.assigned||enabled?'ready':'waiting');return matchCard({status,eventTitle:o.eventTitle,stage:o.heading,number:o.number,left:o.left,right:o.right,playerRenderer:o.playerRenderer,note:o.assigned?o.label:status==='ready'?'Court available':/^disabled/.test(o.action||'')?'Start event first':o.label||'Waiting for earlier results',action:enabled?o.action:'',actionLabel:o.label||'Assign + Start'});}

 return '<div class="scs-tm-waiting-match"><b>'+esc(o.number)+'</b><span>'+(o.heading?'<small>'+esc(o.heading)+'</small><br>':'')+esc(o.left)+' <em>vs</em> '+esc(o.right)+'</span>'+(o.action?'<button type="button" class="scs-tm-match-assign '+(o.assigned?'is-assigned':'')+'" '+o.action+'>'+esc(o.label)+'</button>':'<strong class="is-progress">'+esc(o.label)+'</strong>')+'</div>';
}
// One shared scored-match renderer. Completed, awaiting approval and Conduct Match reuse this exact body.
function scoredBody(o){
 const names=(v,fallback)=>Array.isArray(v)&&v.length?v:[fallback];
 const sets=String(o.score||'').split(/\s*\|\s*/).map(x=>x.match(/^\s*(\d+)\s*[-–—:]\s*(\d+)\s*$/)).filter(Boolean);
 const teamScore=i=>sets.length?sets.map(x=>x[i+1]).join(' | '):'';
 const current=sets.length?sets[sets.length-1]:null,leftLeading=!o.winner&&current&&Number(current[1])>Number(current[2]),rightLeading=!o.winner&&current&&Number(current[2])>Number(current[1]);
 const line=(team,raw,score,win,leading)=>'<div class="scs-tm-completed-team '+(o.winner==='left'||o.winner==='right'?(win?'is-winner ':'is-loser '):'is-pending ')+(leading?'is-leading':'')+'"><div class="scs-tm-completed-players">'+names(team,raw).map(n=>'<span class="scs-tm-serving-player">'+(o.playerRenderer?o.playerRenderer(n):'<span class="scs-tm-shared-player"><span class="scs-tm-ring-slot" data-tm-player="'+esc(n)+'"></span><span class="scs-tm-shared-name">'+esc(n)+'</span></span>')+serverMark(n,o.server)+'</span>').join('')+'</div>'+(score?'<strong class="scs-tm-completed-team-score">'+esc(score)+'</strong>':'')+'</div>';
 const winner=o.winner==='left'?o.left:o.winner==='right'?o.right:'';
 return '<div class="scs-tm-completed-content"><div class="scs-tm-completed-teams">'+line(o.leftPlayers,o.left,teamScore(0),o.winner==='left',leftLeading)+line(o.rightPlayers,o.right,teamScore(1),o.winner==='right',rightLeading)+'</div>'+(winner?'<div class="scs-tm-completed-winner"><span aria-hidden="true">🏆</span><span><small>Winner</small><b>'+esc(winner)+'</b></span></div>':'')+'</div>';
}
function completed(o){
 if(o.matchCards)return matchCard({status:o.matchStatus||'finished',eventTitle:o.eventTitle,stage:o.title,number:o.number,left:o.left,right:o.right,pairs:[o.leftPlayers||[],o.rightPlayers||[]],playerRenderer:o.playerRenderer,score:o.scoreData||o.score,winner:o.winner,action:o.action,actionLabel:o.actionLabel,cardAction:o.cardAction});

 const title=o.title||('Match '+esc(o.number));
 const action=o.action?'<button type="button" class="'+esc(o.actionClass||'scs-tm-score-open')+'" '+o.action+'>'+esc(o.actionLabel||'Continue')+'</button>':'';
 return '<article class="scs-tm-completed-row"'+(o.cardAction?' role="button" tabindex="0" '+o.cardAction:'')+'><div class="scs-tm-completed-title"><span class="scs-tm-completed-check">✓</span><b>'+esc(title)+'</b></div>'+scoredBody(o)+action+'</article>';
}

// Grouping belongs to the shared Match Center, not a second Group renderer.
// A groupIndex is supplied only by round-robin fixtures; knockout stays unchanged.
function waitingContent(items,ordered){
 if(ordered)return items.map(x=>typeof x==='string'?x:waiting(x)).join('');
 const groups=new Map(),parts=[];
 for(const item of items){
  if(typeof item==='string'||item.groupIndex==null){parts.push({plain:item});continue}
  const key=String(item.groupIndex);
  if(!groups.has(key)){const block={key,title:item.heading||('Group '+key),items:[]};groups.set(key,block);parts.push({group:block})}
  groups.get(key).items.push(item);
 }
 return parts.map(part=>{
  if(Object.prototype.hasOwnProperty.call(part,'plain'))return typeof part.plain==='string'?part.plain:waiting(part.plain);
  const g=part.group;
  return '<section class="scs-tm-group-fixtures scs-tm-group-tone-'+(Number(g.key)%8)+'"><h4>'+esc(g.title)+' <span>'+g.items.length+' matches</span></h4><div class="scs-tm-group-fixtures-list">'+g.items.map(x=>waiting({...x,heading:''})).join('')+'</div></section>';
 }).join('');
}
function panel(o){
 if(o.matchCards){o={...o,courts:(o.courts||[]).map(x=>({...x,matchCards:true,eventTitle:o.eventTitle})),waiting:(o.waiting||[]).map(x=>typeof x==='string'?x:{...x,matchCards:true,eventTitle:o.eventTitle}),underApproval:(o.underApproval||[]).map(x=>({...x,matchCards:true,matchStatus:'approval',eventTitle:o.eventTitle})),completed:(o.completed||[]).map(x=>({...x,matchCards:true,matchStatus:'finished',eventTitle:o.eventTitle}))};}
 const items=o.courts||[],numbers=Array.isArray(o.courtNumbers)?o.courtNumbers:items.length?items.map(c=>c.number):Array.from({length:Math.max(0,Number(o.courtCount)||0)},(_,i)=>i+1),count=numbers.length,wait=o.waiting||[],review=o.underApproval||[],done=o.completed||[];
 const attrs=o.attrs||{};
 const btn=(label,attr,cls)=>'<button type="button" '+attr+(cls?' class="'+cls+'"':'')+'>'+label+'</button>';
 const chooser=o.assigning?'<div class="scs-tm-court-select"><strong>Assign Match '+esc(o.assigning)+' — Choose court</strong><div class="scs-tm-court-options">'+numbers.map(n=>{const g=items.find(x=>x.number===n),m=g&&g.match,locked=m&&(m.started||m.ready);return btn('Court '+n+' · '+(locked?'In Progress':m?'Replace '+esc(m.label):'Free'),(locked?'disabled ':'')+attrs.choose(n))}).join('')+'</div>'+btn('Cancel',attrs.cancel)+'</div>':'';
 const tabs=[['waiting','Waiting',wait.length],['approval','Under Approval',review.length],['completed','Completed',done.length]];if(!o.hideRanking)tabs.push(['ranking','Ranking',null]);
 const requested=['waiting','approval','completed','ranking'].includes(o.tab)?o.tab:'waiting';
 const current=tabs.some(([id,,n])=>id===requested&&(n===null||n>0))?requested:(tabs.find(([,,n])=>n===null||n>0)||tabs[0])[0];
 if(o.matchCards){
  const active=items.filter(c=>c.match&&!c.match.ready),approval=items.filter(c=>c.match&&c.match.ready),visibleWait=wait.filter(m=>!m.assigned);
  const identity=(a,b)=>JSON.stringify([a||[],b||[]]);
  const represented=new Set(approval.map(c=>identity(c.match.left,c.match.right)));
  const remainingReview=review.filter(m=>!represented.has(identity(m.leftPlayers,m.rightPlayers)));
  const section=(title,body,n)=>'<section class="scs-event-match-section"><h3>'+title+' · '+n+'</h3>'+(body||'<p class="scs-tm-live-empty">No matches in this category.</p>')+'</section>';
  return '<section class="scs-tm-live-center"><div class="scs-tm-live-center-head"><h3>Assign &amp; Approve</h3><div class="scs-tm-court-picker scs-tm-live-count">'+btn('−',attrs.change(-1))+'<b>'+count+'</b>'+btn('+',attrs.change(1))+'</div></div>'+chooser+
   section('Under approval',approval.map(court).join('')+remainingReview.map(completed).join(''),approval.length+remainingReview.length)+
   section('To be assigned',waitingContent(visibleWait,o.orderedWaiting),visibleWait.length)+'</section>';
 }
 const shell='<section class="scs-tm-live-center"><div class="scs-tm-live-center-head"><div><small>LIVE TOURNAMENT</small><h3>Courts &amp; Match Assignment</h3></div><div class="scs-tm-court-picker scs-tm-live-count">'+btn('−',attrs.change(-1))+'<b>'+count+'</b>'+btn('+',attrs.change(1))+'</div></div><div class="scs-tm-live-courts">'+numbers.map(n=>{const c=items.find(x=>x.number===n);return court(c||{number:n})}).join('')+'</div>'+chooser;
 if(o.upcomingOnly)return shell+'<details class="scs-tm-upcoming" open><summary><span>Upcoming</span><b>'+wait.length+'</b></summary><div class="scs-tm-upcoming-content">'+(waitingContent(wait,o.orderedWaiting)||'<div class="scs-tm-live-empty">No upcoming matches.</div>')+'</div></details></section>';
 return shell+'<div class="scs-tm-live-tabs">'+tabs.map(([id,label,n])=>btn(label+(n===null?'':' <b>'+n+'</b>'),n===0?'disabled aria-disabled="true" style="opacity:.38;cursor:not-allowed;pointer-events:none"':attrs.tab(id),(current===id?'active ':'')+(n===0?'scs-tm-tab-disabled':''))).join('')+'</div>'+(current==='ranking'?(o.ranking||'<div class="scs-tm-live-empty">Ranking updates from approved results.</div>'):current==='approval'?(review.map(completed).join('')||'<div class="scs-tm-live-empty">No matches awaiting approval.</div>'):current==='completed'?(done.map(completed).join('')||'<div class="scs-tm-live-empty">No approved matches yet.</div>'):(waitingContent(wait,o.orderedWaiting)||'<div class="scs-tm-live-empty">No matches awaiting play.</div>'))+'</section>';
}
window.SCSSharedMatchCenter={matchCard,knockoutStage,cardScore,court,waiting,completed,panel,playerIdentity};
})();
