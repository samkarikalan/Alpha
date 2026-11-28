/* One compact, cursor-based match feed per signed-in account/club. */
(function(){'use strict';
const scopes=new Map();let capability=null,checking=null;
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
function context(){const user=typeof authGetUser==='function'?authGetUser():null,club=getMyClub();if(!user?.id||!club?.id)throw Error('Sign in and select a club before syncing matches.');const key=user.id+'|'+club.id;let cache=scopes.get(key);if(!cache){cache={key,user:user.id,club:club.id,rows:new Map(),cursor:'0',flight:null,time:0};scopes.set(key,cache);}return cache;}
async function request(body){const c=context(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(WORKER_URL+'/tournament/live',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({...body,clubId:c.club,userAccountId:c.user,sessionToken:_getLocalToken()})});const result=await response.json().catch(()=>({}));if(context().key!==c.key)throw Error('The account or club changed.');if(!response.ok){const error=Error(result.error||'Could not sync match ('+response.status+').');error.code=result.code;error.status=response.status;throw error;}return result;}finally{clearTimeout(timer);}}
async function enabled(){if(capability!==null)return capability;if(checking)return checking;checking=request({action:'capabilities'}).then(r=>capability=r.protocol===1&&r.matchSync===true).catch(e=>{if(e.status===404||e.status===501){capability=false;return false;}throw e;}).finally(()=>checking=null);return checking;}
async function refresh(force=false){if(!await enabled())return null;const c=context();if(c.flight)return c.flight;if(!force&&Date.now()-c.time<1200)return [...c.rows.values()];c.flight=(async()=>{let more=true;while(more){const result=await request({action:'list',since:c.cursor});for(const row of result.matches||[])c.rows.set(row.id,row);c.cursor=result.cursor||c.cursor;more=!!result.more;}c.time=Date.now();return [...c.rows.values()];})().finally(()=>c.flight=null);const rows=await c.flight;await window.SCSTournamentLocal?.ingestLiveMatches?.(rows);return rows;}
async function find(event,key){const rows=await refresh();return rows?.find(r=>r.tournament_id===event&&String(r.match_key)===String(key));}
function data(row){return {...copy(row.data),tournament_match:row.match_key,court:row.court,court_center_status:row.status==='approved'?'approved':row.status==='playing'?'playing':row.status==='submitted'?'playing':row.status==='assigned'?'assigned':'waiting',score_status:row.status==='submitted'||row.status==='approved'?'scored':row.status==='playing'?'scoring':null};}
function overlay(table,snapshot,rows){const row=copy(snapshot);if(!row)return row;
 if(table==='sessions')for(const round of row.rounds_data||[]){const event=round.tournament?._scsCloudTournamentId;if(!event)continue;const relevant=rows.filter(m=>m.tournament_id===event&&m.status!=='removed');const current=new Map((round.games||[]).map(g=>[String(g.tournament_match),g]));for(const m of relevant){if(m.status==='pending'){current.delete(m.match_key);continue;}current.set(m.match_key,{...(current.get(m.match_key)||{}),...data(m)});}round.games=[...current.values()].filter(g=>!rows.some(m=>m.tournament_id===event&&m.match_key===String(g.tournament_match)&&m.status==='removed'));}
 if(table==='tournaments'&&row.state&&!row.state._scsMainTournament){const state=row.state,matches=row.format==='team'?(state.encounters||[]).flatMap(e=>e.matches||[]):state.matches||[];for(const m of rows.filter(m=>m.tournament_id===row.id)){const target=matches.find(g=>String(g.id)===m.match_key);if(!target)continue;const g=data(m);if(row.format==='knockout'){if(m.status==='approved'&&g.winner){const left=(g.pair1||[]).join(' / '),right=(g.pair2||[]).join(' / ');state.results=state.results||{};state.results[m.match_key]={winner:g.winner==='L'?left:right,loser:g.winner==='L'?right:left,score:g.score};}state.matchScores=state.matchScores||{};if(g.score)state.matchScores[m.match_key]=g.score;}else Object.assign(target,{court:m.court,score:g.score,winner:g.winner,status:m.status==='submitted'?'score_ready':m.status==='approved'?'approved':m.status==='playing'?'playing':m.status==='assigned'?'assigned':'pending',remoteScoreRevision:Date.parse(m.updated_at),conduct_finished:g.conduct_finished});}}
 return row;}
async function apply(row,action,fields,requestId){let current=row;for(let n=0;n<2;n++){try{const result=await request({action,id:current.id,revision:current.revision,requestId,...fields,scoringPassword:window.SCSMatchPasswords?.get(current.tournament_id,current.match_key)});context().rows.set(result.match.id,result.match);return result.match;}catch(error){if(error.code==='SCORING_PASSWORD_REQUIRED'&&n===0&&window.SCSMatchPasswords&&await SCSMatchPasswords.authorize(current.tournament_id,current.match_key))continue;if(error.code==='MATCH_CHANGED'&&n===0){const rows=await refresh(true);current=rows.find(r=>r.id===row.id);if(!current)throw Error('Match is no longer available.');continue;}throw error;}}throw Error('Match changed while sending. Refresh and retry.');}
function scorePayload(score){const result=copy(score);delete result.history;return result;}
async function list(){const rows=await refresh(true);return rows?.filter(r=>['assigned','playing','submitted'].includes(r.status)&&r.court&&!r.data.conduct_finished).map(row=>({sessionId:'live-match-'+row.id,remoteMatch:{id:row.id,tournamentId:row.tournament_id,matchKey:row.match_key},round:row.source_round,court:row.court,pair1:row.data.pair1,pair2:row.data.pair2,game:data(row),sport:row.event.sport,scoringRules:row.event.scoringRules,tournament:true,courtCenter:true,matchNo:row.event.title+' · Match '+row.match_key,scoreReady:row.status==='submitted'}));}
async function score(match,payload,winner,finish){const rows=await refresh();const row=rows?.find(r=>r.id===match.remoteMatch.id);if(!row)throw Error('Assigned match not found. Refresh the scoreboard.');const result=await apply(row,'score',{score:scorePayload(payload),winner:winner||null,finish:!!finish},crypto.randomUUID());await window.SCSTournamentLocal?.ingestLiveMatches?.([...context().rows.values()]);return result;}
function values(){try{return [...context().rows.values()];}catch(_){return [];}}
window.SCSLiveMatches={enabled,refresh,find,apply,overlay,data,list,score,values,scorePayload};
})();

/* V950: discover and score club tournament events without device-local state. */
(function(){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
function entries(format,state){return format==='group'?(state.matches||[]):format==='team'?(state.encounters||[]).flatMap(e=>e.matches||[]):[];}
function identity(m){return JSON.stringify(m.pairs||[m.a,m.b]);}
function merge(format,target,source){let changed=false;const incoming=new Map(entries(format,source).map(m=>[String(m.id),m]));for(const m of entries(format,target)){const r=incoming.get(String(m.id));if(!r||identity(m)!==identity(r)||m.status==='approved'||Number(r.remoteScoreRevision||0)<=Number(m.remoteScoreRevision||0))continue;if(window.SCSLiveMatches?.values().some(x=>x.tournament_id===source._scsCloudTournamentId&&String(x.match_key)===String(r.id))){m.score=r.score==null?null:clone(r.score);m.winner=r.winner||null;m.status=r.status;m.court=r.court;m.conduct_finished=!!r.conduct_finished;}else{m.score=r.score==null?null:clone(r.score);if(r.conduct_finished)m.conduct_finished=true;if(r.winner){m.winner=r.winner;m.status='score_ready';}}m.remoteScoreRevision=r.remoteScoreRevision;changed=true;}return changed;}
async function list(){if(window.SCSLiveMatches&&await SCSLiveMatches.enabled())return SCSLiveMatches.list();const club=typeof getMyClub==='function'?getMyClub():null;if(!club?.id)return [];const rows=await sbGet('tournaments','club_id=eq.'+encodeURIComponent(club.id)+'&status=eq.live&select=id,club_id,format,title,state,state_version,updated_at');const result=[];for(const row of rows||[]){if(row.club_id!==club.id||!row.state||!['group','team'].includes(row.format))continue;for(const m of entries(row.format,row.state)){if(!m.court||m.conduct_finished||!['playing','score_ready'].includes(m.status))continue;const pairs=row.format==='group'?[row.state.assignments?.[m.a],row.state.assignments?.[m.b]]:m.pairs;if(!pairs||pairs.length!==2||pairs.some(p=>!Array.isArray(p)||p.length!==2))continue;result.push({sessionId:'cloud-tournament-'+row.id,remoteTournament:{id:row.id,clubId:club.id,format:row.format,matchId:m.id,identity:identity(m)},round:1,court:m.court,pair1:pairs[0],pair2:pairs[1],game:{score:m.score||null,winner:m.winner||null},sport:row.state.sport||row.state.scoringRules?.sport,scoringRules:m.scoringRules||row.state.scoringRules,courtCenter:true,tournament:true,matchNo:row.title+' · '+m.id,scoreReady:m.status==='score_ready'});}}
return result;}
async function historyApprovals(scores){
 if(window.SCSLiveMatches&&await SCSLiveMatches.enabled()){
  const rows=await SCSLiveMatches.refresh(true),result=new Map();for(const score of scores){const source=score.tournamentSource;if(!Array.isArray(source))continue;const match=rows.find(m=>source[0]==='live-match'?m.id===source[1]:source[0]==='cloud-tournament'?m.tournament_id===source[1]&&m.match_key===String(source[2]):m.source_session_id===source[0]&&String(m.data.ccid||m.match_key)===String(source[1]));result.set(JSON.stringify(source),match?.status==='approved');}return result;
 }
 const club=getMyClub();if(!club?.id)return new Map();
 const read=(table,query)=>window.SCSTournamentLocal?.readServerRows?SCSTournamentLocal.readServerRows(table,query):sbGet(table,query);
 const sources=scores.map(s=>s.tournamentSource).filter(Array.isArray),sessionIds=[...new Set(sources.filter(s=>s[0]!=='cloud-tournament'&&!String(s[0]).startsWith('local-')).map(s=>s[0]))];
 const sessions=sessionIds.length?await read('sessions','club_id=eq.'+encodeURIComponent(club.id)+'&id=in.('+sessionIds.map(encodeURIComponent).join(',')+')&select=id,rounds_data'):[];
 const eventIds=[...new Set(sources.filter(s=>s[0]==='cloud-tournament').map(s=>s[1]).concat((sessions||[]).flatMap(r=>(r.rounds_data||[]).map(x=>x.tournament?._scsCloudTournamentId))).filter(Boolean))];
 const events=eventIds.length?await read('tournaments','club_id=eq.'+encodeURIComponent(club.id)+'&id=in.('+eventIds.map(encodeURIComponent).join(',')+')&select=id,format,state'):[];
 if(getMyClub()?.id!==club.id)throw Error('The selected club changed.');
 const results=new Map();for(const source of sources){let approved=false;
  if(source[0]==='cloud-tournament'){const event=events.find(e=>String(e.id)===String(source[1])),m=event&&entries(event.format,event.state).find(m=>String(m.id)===String(source[2]));approved=m?.status==='approved';}
  else {const row=sessions.find(r=>String(r.id)===String(source[0]));for(const round of row?.rounds_data||[]){const game=(round.games||[]).find(g=>String(g.ccid||g.tournament_match)===String(source[1]));if(!game)continue;const event=events.find(e=>e.id===round.tournament?._scsCloudTournamentId);approved=game.court_center_status==='approved'||!!event?.state?.results?.[game.tournament_match];}}
  results.set(JSON.stringify(source),approved);
 }return results;
}
// A historical session is scoreable only while its event and exact fixture still exist.
async function filterCurrentSessions(sessions){
 const club=typeof getMyClub==='function'?getMyClub():null;if(!club?.id)return [];
 const rows=await sbGet('tournaments','club_id=eq.'+encodeURIComponent(club.id)+'&status=in.(draft,live)&select=id,club_id,format,state');
 if(getMyClub()?.id!==club.id)throw Error('The selected club changed. Refresh matches.');
 const current=(rows||[]).filter(r=>r.club_id===club.id&&r.state&&r.status!=='completed');
 const ids=r=>[r.id,r.state._scsClientTournamentId,r.state.id].filter(Boolean).map(String);
 const pair=p=>(p||[]).map(n=>String(n).trim().toLowerCase()).sort().join('|');
 return (sessions||[]).map(session=>{const copy=clone(session);copy.rounds_data=(copy.rounds_data||[]).map(round=>{
  const t=round.tournament;if(!t)return round;
  const event=current.find(r=>!r.state._scsMainTournament&&String(r.state._scsGroupKnockoutStage??'')===String(t._scsGroupKnockoutStage??'')&&(String(r.id)===String(t._scsCloudTournamentId||'')||t._scsClientTournamentId&&String(r.state._scsClientTournamentId)===String(t._scsClientTournamentId)));
  if(!event){round.games=[];return round;}
  const state=event.state,parentId=state._scsParentTournamentId||state._scsKoMainId,parent=parentId?current.find(r=>r.state._scsMainTournament&&ids(r).includes(String(parentId))):null;
  const eventId=state._scsGroupEventId||state._scsKoEventId||state._scsClientTournamentId;
  if((parentId&&!parent)||(parent&&Array.isArray(parent.state.events)&&!parent.state.events.some(e=>String(e.id)===String(eventId)))){round.games=[];return round;}
  const allocated=parent?.state.courtAllocations?.[eventId]||state.courtNumbers;
  const resolve=src=>{if(typeof src==='number'||/^\d+$/.test(String(src)))return (state.entries||[]).find(e=>String(e.id)===String(src))?.name;const result=state.results?.[String(src).slice(1)];return result&&(String(src)[0]==='L'?result.loser:result.winner);};
  round.games=(round.games||[]).filter(g=>{
   if(!g.court||(!['assigned','playing'].includes(g.court_center_status)&&g.score_status!=='scoring')||(Array.isArray(allocated)&&!allocated.some(n=>Number(n)===Number(g.court))))return false;
   const m=(state.matches||[]).find(m=>String(m.id)===String(g.tournament_match));if(!m||state.results?.[m.id]||m.status==='approved')return false;
   const a=resolve(m.a),b=resolve(m.b);return !!a&&!!b&&pair(g.pair1)===pair(a.split(' / '))&&pair(g.pair2)===pair(b.split(' / '));
  });return round;
 });return copy;});
}
async function update(match,score,winner,finish=false){const ref=match.remoteTournament,club=getMyClub();if(!ref||club?.id!==ref.clubId)throw Error('Select the tournament club before saving.');for(let attempt=0;attempt<3;attempt++){const query='id=eq.'+encodeURIComponent(ref.id)+'&club_id=eq.'+encodeURIComponent(ref.clubId);const rows=await sbGet('tournaments',query+'&select=id,format,state,updated_at&limit=1'),row=rows?.[0];if(!row||row.format!==ref.format)throw Error('Tournament is no longer available.');const m=entries(row.format,row.state).find(m=>String(m.id)===String(ref.matchId));if(!m||identity(m)!==ref.identity||!['playing','score_ready'].includes(m.status)||Number(m.court)!==Number(match.court))throw Error('Match assignment changed. Refresh the scoreboard.');if(finish&&m.status!=='score_ready')throw Error('Score the match before finishing.');m.score=clone(score);if(finish)m.conduct_finished=true;m.remoteScoreRevision=Math.max(Date.now(),Number(m.remoteScoreRevision||0)+1);if(winner){m.winner=winner;m.status='score_ready';}const updated=await sbPatch('tournaments',query+'&updated_at=eq.'+encodeURIComponent(row.updated_at),{state:row.state,updated_at:new Date().toISOString()},'return=representation',{tournamentId:ref.id,matchKey:ref.matchId});if(Array.isArray(updated)&&updated.length)return true;}throw Error('Tournament changed while saving. Refresh and retry.');}
let flight=null;
function visibleEvent(){return document.querySelector('#scsGroupTournament:not([hidden]),#scsTeamTournament:not([hidden])');}
async function refresh(){
 if(flight)return flight;
 const club=typeof getMyClub==='function'?getMyClub():null;if(!club?.id)throw Error('Select the tournament club before refreshing scores.');
 const user=typeof authGetUser==='function'?authGetUser()?.id:null;
 flight=(async()=>{
  const rows=window.SCSTournamentLocal?.readRemoteScores?await SCSTournamentLocal.readRemoteScores():await sbGet('tournaments','club_id=eq.'+encodeURIComponent(club.id)+'&status=eq.live&select=id,club_id,format,state');
  if(getMyClub()?.id!==club.id||(typeof authGetUser==='function'&&authGetUser()?.id!==user))return false;
  for(const row of rows||[]){if(row.club_id&&row.club_id!==club.id)continue;if(row.format==='group')window.SCSGroupTournament?.receiveRemoteScores?.(row);if(row.format==='team')window.SCSTeamTournament?.receiveRemoteScores?.(row);}
  return true;
 })().finally(()=>{flight=null;});return flight;
}
async function publishAssignment(){
 if(!window.SCSTournamentLocal)return {synced:false};
 await SCSTournamentLocal.settled();
 if(navigator.onLine===false)return {synced:false};
 const delivery=Promise.resolve().then(()=>SCSTournamentLocal.sync()).catch(error=>{console.warn('Assignment saved locally; scoreboard sync pending:',error.message);return false;});
 return {synced:false,delivery};
}
window.SCSTournamentScores={list,historyApprovals,filterCurrentSessions,update,merge,refresh,publishAssignment};
function automatic(){if(!document.hidden&&visibleEvent())refresh().catch(error=>console.warn('Tournament score refresh:',error.message));}
function buttons(){for(const root of document.querySelectorAll('#scsGroupTournament,#scsTeamTournament')){const header=root.querySelector('.scs-tm-live-center-head');if(!header||header.parentElement.querySelector('[data-tournament-score-refresh]'))continue;const holder=document.createElement('div');holder.style.cssText='display:flex;align-items:center;gap:10px;margin:8px 0 14px';const button=document.createElement('button');button.type='button';button.dataset.tournamentScoreRefresh='';button.textContent='↻ Refresh';button.style.cssText='padding:10px 14px;border:1px solid #6382b1;border-radius:9px;background:#23486e;color:white;font:inherit';const status=document.createElement('span');status.setAttribute('role','status');status.style.fontSize='14px';button.onclick=async()=>{button.disabled=true;status.textContent='Refreshing…';try{const results=await Promise.allSettled([refresh(),root.id==='scsGroupTournament'?window.SCSGroupTournament?.refreshAssignments?.():window.SCSCourtCenter?.refreshTournamentState?.(),window.SCSEventCourtPool?.refresh?.(root)]);const ok=results.every(r=>r.status==='fulfilled'&&r.value!==false);if(holder.isConnected)status.textContent=ok?'Updated':'Club or account changed. Refresh again.';}catch(error){if(holder.isConnected)status.textContent=error.message||'Could not refresh scores.';}finally{button.disabled=false;}};holder.className='scs-assignment-refresh';holder.append(button,status);(header.closest('.scs-assignment-control-card')||header.parentElement).append(holder);}}
function init(){buttons();new MutationObserver(buttons).observe(document.body,{childList:true,subtree:true});setInterval(automatic,5000);window.addEventListener('focus',automatic);window.addEventListener('online',automatic);document.addEventListener('visibilitychange',automatic);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
