/* One compact, cursor-based match feed per signed-in account/club. */
(function(){'use strict';
const scopes=new Map();let capability=null,checking=null,directPublication=false;
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
function context(){const user=typeof authGetUser==='function'?authGetUser():null,club=getMyClub();if(!user?.id||!club?.id)throw Error('Sign in and select a club before syncing matches.');const key=user.id+'|'+club.id;let cache=scopes.get(key);if(!cache){cache={key,user:user.id,club:club.id,rows:new Map(),cursor:'0',flight:null,time:0};scopes.set(key,cache);}return cache;}
async function request(body){const c=context(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(WORKER_URL+'/tournament/live',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({...body,clubId:c.club,userAccountId:c.user,sessionToken:_getLocalToken()})});const result=await response.json().catch(()=>({}));if(context().key!==c.key)throw Error('The account or club changed.');if(!response.ok){const error=Error(result.error||'Could not sync match ('+response.status+').');error.code=result.code;error.status=response.status;throw error;}return result;}finally{clearTimeout(timer);}}
async function enabled(){if(capability!==null)return capability;if(checking)return checking;checking=request({action:'capabilities'}).then(r=>{directPublication=r.directPublication===true;return capability=Number(r.protocol)>=1&&r.matchSync===true;}).catch(e=>{if(e.status===404||e.status===501){capability=false;return false;}throw e;}).finally(()=>checking=null);return checking;}
async function refresh(force=false){if(!await enabled())return null;const c=context();if(c.flight)return c.flight;if(!force&&Date.now()-c.time<1200)return [...c.rows.values()];c.flight=(async()=>{let more=true;while(more){const result=await request({action:'list',since:c.cursor});for(const row of result.matches||[]){const previous=c.rows.get(row.id);if(!previous||BigInt(row.revision)>=BigInt(previous.revision))c.rows.set(row.id,row);}c.cursor=result.cursor||c.cursor;more=!!result.more;}c.time=Date.now();return [...c.rows.values()];})().finally(()=>c.flight=null);const rows=await c.flight;await window.SCSTournamentLocal?.ingestLiveMatches?.(rows);window.dispatchEvent(new CustomEvent('scs-live-match-state'));return rows;}
async function find(event,key){const rows=await refresh();return rows?.find(r=>r.tournament_id===event&&String(r.match_key)===String(key));}
function data(row){return {...copy(row.data),tournament_match:row.match_key,court:row.court,court_center_status:row.status==='approved'?'approved':row.status==='playing'?'playing':row.status==='submitted'?'playing':row.status==='assigned'?'assigned':'waiting',score_status:row.status==='submitted'||row.status==='approved'?'scored':row.status==='playing'?'scoring':null};}
function overlay(table,snapshot,rows){const row=copy(snapshot);if(!row)return row;
 if(table==='sessions')for(const round of row.rounds_data||[]){const event=round.tournament?._scsCloudTournamentId;if(!event)continue;const relevant=rows.filter(m=>m.tournament_id===event&&m.status!=='removed');const current=new Map((round.games||[]).map(g=>[String(g.tournament_match),g]));for(const m of relevant){if(m.status==='pending'){current.delete(m.match_key);continue;}current.set(m.match_key,{...(current.get(m.match_key)||{}),...data(m)});}round.games=[...current.values()].filter(g=>!rows.some(m=>m.tournament_id===event&&m.match_key===String(g.tournament_match)&&m.status==='removed'));}
 if(table==='tournaments'&&row.state&&!row.state._scsMainTournament){const state=row.state,matches=row.format==='team'?(state.encounters||[]).flatMap(e=>e.matches||[]):state.matches||[];for(const m of rows.filter(m=>m.tournament_id===row.id)){const target=matches.find(g=>String(g.id)===m.match_key);if(!target)continue;const g=data(m);if(row.format==='knockout'){if(m.status==='approved'&&g.winner){const left=(g.pair1||[]).join(' / '),right=(g.pair2||[]).join(' / ');state.results=state.results||{};state.results[m.match_key]={winner:g.winner==='L'?left:right,loser:g.winner==='L'?right:left,score:g.score};}state.matchScores=state.matchScores||{};if(g.score)state.matchScores[m.match_key]=g.score;}else Object.assign(target,{court:m.court,score:g.score,winner:g.winner,status:m.status==='submitted'?'score_ready':m.status==='approved'?'approved':m.status==='playing'?'playing':m.status==='assigned'?'assigned':'pending',remoteScoreRevision:Date.parse(m.updated_at),conduct_finished:g.conduct_finished});}}
 return row;}
async function apply(row,action,fields,requestId){let current=row;for(let n=0;n<2;n++){try{if(action==='score'&&current.status==='approved'){const error=Error('This match is approved. Scoring is locked.');error.code='MATCH_APPROVED';throw error;}const result=await request({action,id:current.id,revision:current.revision,requestId,...fields,scoringPassword:window.SCSMatchPasswords?.get(current.tournament_id,current.match_key)});context().rows.set(result.match.id,result.match);window.dispatchEvent(new CustomEvent('scs-live-match-state'));return result.match;}catch(error){if(error.code==='SCORING_PASSWORD_REQUIRED'&&n===0&&window.SCSMatchPasswords&&await SCSMatchPasswords.authorize(current.tournament_id,current.match_key))continue;if(error.code==='MATCH_CHANGED'&&n===0){const rows=await refresh(true);current=rows.find(r=>r.id===row.id);if(!current)throw Error('Match is no longer available.');continue;}throw error;}}throw Error('Match changed while sending. Refresh and retry.');}
function scorePayload(score){const result=copy(score);delete result.history;return result;}
function scoringMatch(row){return {sessionId:'live-match-'+row.id,remoteMatch:{id:row.id,tournamentId:row.tournament_id,matchKey:row.match_key},round:row.source_round,court:row.court,pair1:row.data.pair1,pair2:row.data.pair2,game:data(row),sport:row.event.sport,scoringRules:row.event.scoringRules,tournament:true,courtCenter:true,matchNo:row.event.title+' · Match '+row.match_key,scoreReady:row.status==='submitted'};}
async function list(){const rows=await refresh(true);return rows?.filter(r=>['assigned','playing','submitted'].includes(r.status)&&r.court&&!r.data.conduct_finished).map(scoringMatch);}
async function resolveScoreMatch(match){
 if(!await enabled())throw Error('The match-sync service must be available before tournament scoring. Refresh after updating the Worker.');
 const ref=match.remoteMatch||match.serverRef||(match.remoteTournament?{tournamentId:match.remoteTournament.id,matchKey:match.remoteTournament.matchId}:null);
 if(!ref)throw Error('This tournament match is not confirmed on the server yet. Sync its assignment before scoring.');
 const rows=await refresh(true),row=rows.find(r=>ref.id?r.id===ref.id:r.tournament_id===ref.tournamentId&&String(r.match_key)===String(ref.matchKey));
 if(!row||!row.court||!['assigned','playing','submitted'].includes(row.status))throw Error(row?.status==='approved'?'This match is approved. Scoring is locked.':'This match is not assigned on the server. Refresh its assignment.');
 if(JSON.stringify([match.pair1,match.pair2])!==JSON.stringify([row.data.pair1,row.data.pair2]))throw Error('The assigned players changed. Reopen this match from the server.');
 return {...scoringMatch(row),originSessionId:match.originSessionId||match.sessionId};
}
async function submittedMatch(event,key){const rows=await refresh(true),row=rows.find(m=>m.tournament_id===event&&String(m.match_key)===String(key));if(!row||!['submitted','approved'].includes(row.status)||!row.data.score?.finished||!['L','R'].includes(row.data.winner))throw Error('The server has not confirmed a finished result yet. Submit it from Scoreboard before approval.');return row;}

async function score(match,payload,winner,finish){const rows=await refresh();const row=rows?.find(r=>r.id===match.remoteMatch.id);if(!row)throw Error('Assigned match not found. Refresh the scoreboard.');const result=await apply(row,'score',{score:scorePayload(payload),winner:winner||null,finish:!!finish},crypto.randomUUID());await window.SCSTournamentLocal?.ingestLiveMatches?.([...context().rows.values()]);return result;}
async function publish(publication,requestId){if(!await enabled()||!directPublication)throw Error('Deploy the independent-match Worker before publishing matches.');const response=await request({action:'publish',tournamentId:publication.tournamentId,matchKey:publication.matchKey,publication,requestId});const row=response.match;if(!row?.id||row.tournament_id!==publication.tournamentId||String(row.match_key)!==String(publication.matchKey)||!['assigned','playing','submitted','approved'].includes(row.status))throw Error('The server did not confirm match publication.');context().rows.set(row.id,row);await window.SCSTournamentLocal?.ingestLiveMatches?.([...context().rows.values()]);return row;}
async function password(mode,tournamentId,matchKey,password){if(!await enabled()||!directPublication)throw Error('Deploy the independent-match Worker before managing match passwords.');return request({action:'password',mode,tournamentId,matchKey:String(matchKey),password});}
function values(){try{return [...context().rows.values()];}catch(_){return [];}}
window.SCSLiveMatches={enabled,refresh,find,apply,overlay,data,list,score,values,scorePayload,resolveScoreMatch,submittedMatch,publish,password};
})();

/* V950: discover and score club tournament events without device-local state. */
(function(){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
function entries(format,state){return format==='group'?(state.matches||[]):format==='team'?(state.encounters||[]).flatMap(e=>e.matches||[]):[];}
function identity(m){return JSON.stringify(m.pairs||[m.a,m.b]);}
function merge(format,target,source){let changed=false;const incoming=new Map(entries(format,source).map(m=>[String(m.id),m]));for(const m of entries(format,target)){const r=incoming.get(String(m.id));if(!r||identity(m)!==identity(r)||m.status==='approved'||Number(r.remoteScoreRevision||0)<=Number(m.remoteScoreRevision||0))continue;if(window.SCSLiveMatches?.values().some(x=>x.tournament_id===source._scsCloudTournamentId&&String(x.match_key)===String(r.id))){m.score=r.score==null?null:clone(r.score);m.winner=r.winner||null;m.status=r.status;m.court=r.court;m.conduct_finished=!!r.conduct_finished;}else{m.score=r.score==null?null:clone(r.score);if(r.conduct_finished)m.conduct_finished=true;if(r.winner){m.winner=r.winner;m.status='score_ready';}}m.remoteScoreRevision=r.remoteScoreRevision;changed=true;}return changed;}
async function list(){if(!window.SCSLiveMatches||!await SCSLiveMatches.enabled())throw Error('Match service unavailable. Refresh after updating the Worker.');return SCSLiveMatches.list();}
async function historyApprovals(scores){
 if(window.SCSLiveMatches&&await SCSLiveMatches.enabled()){
  const rows=await SCSLiveMatches.refresh(true),result=new Map();for(const score of scores){const source=score.tournamentSource;if(!Array.isArray(source))continue;const match=rows.find(m=>source[0]==='live-match'?m.id===source[1]:source[0]==='cloud-tournament'?m.tournament_id===source[1]&&m.match_key===String(source[2]):m.source_session_id===source[0]&&String(m.data.ccid||m.match_key)===String(source[1]));result.set(JSON.stringify(source),match?.status==='approved');}return result;
 }
 throw Error('Connect to the match service to check approval.');
}

async function filterCurrentSessions(sessions){return (sessions||[]).map(session=>({...session,rounds_data:(session.rounds_data||[]).filter(round=>!round.tournament)}));}

async function update(match,score,winner,finish=false){const remote=await SCSLiveMatches.resolveScoreMatch(match);await SCSTournamentLocal.saveLiveScore(remote,score,winner,finish);return true;}
let flight=null;
function visibleEvent(){return document.querySelector('#scsGroupTournament:not([hidden]),#scsTeamTournament:not([hidden])');}
async function refresh(){
 if(flight)return flight;
 const club=typeof getMyClub==='function'?getMyClub():null;if(!club?.id)throw Error('Select the tournament club before refreshing scores.');
 const user=typeof authGetUser==='function'?authGetUser()?.id:null;
 flight=(async()=>{
  if(!window.SCSTournamentLocal?.readRemoteScores)throw Error('Local tournament view is not loaded.');const rows=await SCSTournamentLocal.readRemoteScores();
  if(getMyClub()?.id!==club.id||(typeof authGetUser==='function'&&authGetUser()?.id!==user))return false;
  for(const row of rows||[]){if(row.club_id&&row.club_id!==club.id)continue;if(row.format==='group')window.SCSGroupTournament?.receiveRemoteScores?.(row);if(row.format==='team')window.SCSTeamTournament?.receiveRemoteScores?.(row);}
  return true;
 })().finally(()=>{flight=null;});return flight;
}
async function publishAssignment(ref){
 if(!window.SCSTournamentLocal)return {synced:false};await SCSTournamentLocal.settled();
 const delivery=(ref?SCSTournamentLocal.confirmRecord('match_publications',ref.tournamentId+'|'+ref.matchKey).then(()=>{const row=SCSLiveMatches.values().find(m=>m.tournament_id===ref.tournamentId&&String(m.match_key)===String(ref.matchKey));return !!row&&['assigned','playing'].includes(row.status);}):SCSTournamentLocal.syncMatches({interactive:true})).catch(error=>{console.warn('Match publication pending:',error.message);return false;});
 return {synced:false,delivery};
}

window.SCSTournamentScores={list,historyApprovals,filterCurrentSessions,update,merge,refresh,publishAssignment};
function automatic(){if(!document.hidden&&visibleEvent())refresh().catch(error=>console.warn('Tournament score refresh:',error.message));}
function buttons(){for(const root of document.querySelectorAll('#scsGroupTournament,#scsTeamTournament')){const header=root.querySelector('.scs-tm-live-center-head');if(!header||header.parentElement.querySelector('[data-tournament-score-refresh]'))continue;const holder=document.createElement('div');holder.style.cssText='display:flex;align-items:center;gap:10px;margin:8px 0 14px';const button=document.createElement('button');button.type='button';button.dataset.tournamentScoreRefresh='';button.textContent='↻ Refresh';button.style.cssText='padding:10px 14px;border:1px solid #6382b1;border-radius:9px;background:#23486e;color:white;font:inherit';const status=document.createElement('span');status.setAttribute('role','status');status.style.fontSize='14px';button.onclick=async()=>{button.disabled=true;status.textContent='Refreshing…';try{const results=await Promise.allSettled([refresh(),root.id==='scsGroupTournament'?window.SCSGroupTournament?.refreshAssignments?.():window.SCSCourtCenter?.refreshTournamentState?.(),window.SCSEventCourtPool?.refresh?.(root)]);const ok=results.every(r=>r.status==='fulfilled'&&r.value!==false);if(holder.isConnected)status.textContent=ok?'Updated':'Club or account changed. Refresh again.';}catch(error){if(holder.isConnected)status.textContent=error.message||'Could not refresh scores.';}finally{button.disabled=false;}};holder.className='scs-assignment-refresh';holder.append(button,status);(header.closest('.scs-assignment-control-card')||header.parentElement).append(holder);}}
function init(){buttons();new MutationObserver(buttons).observe(document.body,{childList:true,subtree:true});setInterval(automatic,5000);window.addEventListener('focus',automatic);window.addEventListener('online',automatic);document.addEventListener('visibilitychange',automatic);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
