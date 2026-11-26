(function(){
'use strict';
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
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
 if(!o.match)return '<div class="scs-tm-court-card is-free"><div class="scs-tm-court-head"><strong>COURT '+o.number+'</strong><span>FREE</span></div><p>— Empty Court —</p></div>';
 let m=o.match;
 // Once scoring starts, keep each team's score beside that team. This is easier
 // to scan courtside than a combined "5 - 3" strip below both teams.
 if(m.score){return '<div class="scs-tm-court-card '+(m.ready?'is-ready ':'')+'scs-tm-court-result"'+(m.cardAction?' role="button" tabindex="0" '+m.cardAction:'')+'><div class="scs-tm-court-head"><strong>COURT '+o.number+'</strong><span>'+esc(m.status)+'</span></div><small>'+esc(m.label)+'</small>'+scoredBody({left:m.leftText||((m.left||[]).join(' / ')),right:m.rightText||((m.right||[]).join(' / ')),leftPlayers:m.left||[],rightPlayers:m.right||[],score:m.score,winner:m.winner,server:m.server,playerRenderer:o.playerRenderer})+(m.action?'<button type="button" class="'+(m.ready?'scs-tm-approve':'scs-tm-score-open')+'" '+m.action+'>'+esc(m.actionLabel)+'</button>':'')+'</div>';}
 return '<div class="scs-tm-court-card '+(m.ready?'is-ready':'')+'"'+(m.cardAction?' role="button" tabindex="0" '+m.cardAction:'')+'><div class="scs-tm-court-head"><strong>COURT '+o.number+'</strong><span>'+esc(m.status)+'</span></div><small>'+esc(m.label)+'</small><div class="scs-tm-court-teams"><b>'+playerRows(m.left,o.playerRenderer,m.server)+'</b><b>'+playerRows(m.right,o.playerRenderer,m.server)+'</b></div>'+(m.score?'<div class="scs-tm-court-score">'+esc(m.score)+'</div>':'')+(m.action?'<button type="button" class="'+(m.ready?'scs-tm-approve':'scs-tm-score-open')+'" '+m.action+'>'+esc(m.actionLabel)+'</button>':'')+(m.secondaryAction?'<button type="button" class="scs-tm-score-open" '+m.secondaryAction+'>'+esc(m.secondaryLabel)+'</button>':'')+'</div>';
}
function waiting(o){
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
 const items=o.courts||[],numbers=Array.isArray(o.courtNumbers)?o.courtNumbers:items.length?items.map(c=>c.number):Array.from({length:Math.max(0,Number(o.courtCount)||0)},(_,i)=>i+1),count=numbers.length,wait=o.waiting||[],review=o.underApproval||[],done=o.completed||[];
 const attrs=o.attrs||{};
 const btn=(label,attr,cls)=>'<button type="button" '+attr+(cls?' class="'+cls+'"':'')+'>'+label+'</button>';
 const chooser=o.assigning?'<div class="scs-tm-court-select"><strong>Assign Match '+esc(o.assigning)+' — Choose court</strong><div class="scs-tm-court-options">'+numbers.map(n=>{const g=items.find(x=>x.number===n),m=g&&g.match,locked=m&&(m.started||m.ready);return btn('Court '+n+' · '+(locked?'In Progress':m?'Replace '+esc(m.label):'Free'),(locked?'disabled ':'')+attrs.choose(n))}).join('')+'</div>'+btn('Cancel',attrs.cancel)+'</div>':'';
 const tabs=[['waiting','Waiting',wait.length],['approval','Under Approval',review.length],['completed','Completed',done.length]];if(!o.hideRanking)tabs.push(['ranking','Ranking',null]);
 const requested=['waiting','approval','completed','ranking'].includes(o.tab)?o.tab:'waiting';
 const current=tabs.some(([id,,n])=>id===requested&&(n===null||n>0))?requested:(tabs.find(([,,n])=>n===null||n>0)||tabs[0])[0];
 const shell='<section class="scs-tm-live-center"><div class="scs-tm-live-center-head"><div><small>LIVE TOURNAMENT</small><h3>Courts &amp; Match Assignment</h3></div><div class="scs-tm-court-picker scs-tm-live-count">'+btn('−',attrs.change(-1))+'<b>'+count+'</b>'+btn('+',attrs.change(1))+'</div></div><div class="scs-tm-live-courts">'+numbers.map(n=>{const c=items.find(x=>x.number===n);return court(c||{number:n})}).join('')+'</div>'+chooser;
 if(o.upcomingOnly)return shell+'<details class="scs-tm-upcoming" open><summary><span>Upcoming</span><b>'+wait.length+'</b></summary><div class="scs-tm-upcoming-content">'+(waitingContent(wait,o.orderedWaiting)||'<div class="scs-tm-live-empty">No upcoming matches.</div>')+'</div></details></section>';
 return shell+'<div class="scs-tm-live-tabs">'+tabs.map(([id,label,n])=>btn(label+(n===null?'':' <b>'+n+'</b>'),n===0?'disabled aria-disabled="true" style="opacity:.38;cursor:not-allowed;pointer-events:none"':attrs.tab(id),(current===id?'active ':'')+(n===0?'scs-tm-tab-disabled':''))).join('')+'</div>'+(current==='ranking'?(o.ranking||'<div class="scs-tm-live-empty">Ranking updates from approved results.</div>'):current==='approval'?(review.map(completed).join('')||'<div class="scs-tm-live-empty">No matches awaiting approval.</div>'):current==='completed'?(done.map(completed).join('')||'<div class="scs-tm-live-empty">No approved matches yet.</div>'):(waitingContent(wait,o.orderedWaiting)||'<div class="scs-tm-live-empty">No matches awaiting play.</div>'))+'</section>';
}
window.SCSSharedMatchCenter={court,waiting,completed,panel,playerIdentity};
})();
