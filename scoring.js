(function(){
'use strict';
var state=null,clubPlayers=[],setupServer=0,setupReceiver=2,liveMatch=null,savingFinalScore=false,readOnly=false,readOnlySet=0,conductMode=false,teamEditMatchId=null,savedScoreEditor=null,scoreEditDirty=false,standaloneMode=false,standaloneTitle="",memberPickerEntry=false,standaloneGenders=["","","",""];
var completedReturn=null;
var setupSport='badminton',configuredSport=null;
var scoringWorkspace='member',pickerReturn=null;
var pickerLoadId=0,pickerTab='home',standalonePickerReturn=null;
function el(id){return document.getElementById(id)}
function preferredSport(){try{return localStorage.getItem('scsPreferredSport')==='pickleball'?'pickleball':'badminton';}catch(_){return 'badminton';}}
function pickleball(){return !!state&&state.sport==='pickleball';}
function gameWord(){return pickleball()?'Game':'Set';}
function configureSport(sport,reset){
 setupSport=sport==='pickleball'?'pickleball':'badminton';
 el('scsScoringOverlay').setAttribute('data-scoring-sport',setupSport);
 var pb=setupSport==='pickleball',fmt=el('scsScoreFormatDetails');if(!fmt)return;
 var changed=configuredSport!==setupSport;configuredSport=setupSport;
 var rallyHistory=el('scsScoreRallyHistory');if(rallyHistory)rallyHistory.open=!pb;
 var label=el('scsScoreUnit');if(label)label.textContent=pb?'Games':'Sets';
 var badge=el('scsScoreSport');if(badge)badge.textContent=pb?'Pickleball · Traditional doubles · Only the serving team scores':'Badminton · Rally scoring';
 var shell=document.querySelector('.scs-scoring-shell');if(shell)shell.setAttribute('aria-label',pb?'Pickleball score sheet':'Badminton score sheet');
 var opening=el('scsPickleballOpening');if(opening)opening.hidden=!pb;
 var legend=el('scsScoreRallyLegend');if(legend)legend.hidden=!pb;
 ['scsScoreOneSet','scsScoreThreeSets'].forEach(function(key,i){var span=fmt.querySelector('[data-score-format="'+(i?3:1)+'"]');if(span)span.textContent=pb?(i?'3 Games':'1 Game'):(i?'3 Sets':'1 Set');});
 for(var i=1;i<=3;i++){
  var win=el('scsScoreSet'+i+'Win'),max=el('scsScoreSet'+i+'Max');
  var title=fmt.querySelector('[data-set="'+i+'"] strong');if(title)title.textContent=(pb?'Game ':'Set ')+i;
  if(max)max.parentElement.hidden=pb;
  if(reset||changed){if(win)win.value=pb?11:(i===3?11:15);if(max)max.value=i===3?11:21;}
 }
 if(state){state.setRules.forEach(function(rule,i){var win=el('scsScoreSet'+(i+1)+'Win'),max=el('scsScoreSet'+(i+1)+'Max');if(win)win.value=rule.win;if(max&&rule.max!=null)max.value=rule.max;});}
 matchFormatChanged();
}
function showScoreConfig(show,locked){if(readOnly||state&&state.finished){var editor=el('scsScoreRuleEditor');if(editor)editor.remove()}var host=el('scsScoreConfig'),fmt=el('scsScoreFormatDetails');if(host)host.hidden=!show;if(!fmt)return;configureSport(state?state.sport:setupSport,false);fmt.open=false;fmt.classList.toggle('is-locked',!!locked);fmt.querySelectorAll('input').forEach(function(input){input.disabled=!!locked;});if(state){var selected=document.querySelector('input[name="scsScoreMatchFormat"][value="'+state.matchSets+'"]');if(selected)selected.checked=true;matchFormatChanged();} }
function playerSelects(){return ['scsScoreP1','scsScoreP2','scsScoreP3','scsScoreP4'].map(el)}
function names(){return playerSelects().map(function(x,i){var o=x&&x.options[x.selectedIndex];return o&&o.value?o.textContent.trim():('Player '+(i+1));});}
function teamOf(p){return p<2?0:1}
function partner(p){return p<2?(p===0?1:0):(p===2?3:2)}
function setSetupMsg(msg){var x=el('scsScoreSetupMsg');if(x)x.textContent=msg||'';}
function normalizePlayers(list){var seen={};return (list||[]).map(function(p){var n=String((p&&(p.name||p.displayName||p.nickname))||'').trim();return {id:String((p&&(p.id||p.player_id||p.playerId))||n),name:n,gender:String((p&&p.gender)||'Male')};}).filter(function(p){var k=p.id+'|'+p.name.toLowerCase();if(!p.name||seen[k])return false;seen[k]=1;return true;});}
function currentClubName(){try{if(window.SCSSportContext?.appModule==='scoreboard')return (typeof getMyClub==='function'?getMyClub()?.name:'')||'';return localStorage.getItem('kbrr_org_club_name')||((typeof getMyClub==='function'&&getMyClub().name)||'')||'';}catch(e){return '';}}
function playerGender(name){var key=String(name||'').trim().toLowerCase(),p=clubPlayers.find(function(x){return x.name.toLowerCase()===key;});return p&&p.gender==='Female'?'Female':'Male';}
function playerRow(name){var g=playerGender(name);return '<span class="scs-score-picker-player"><img src="'+(g==='Female'?'female.png':'male.png')+'" alt="'+g+'"><b>'+escapeHtml(name)+'</b></span>';}
async function loadClubPlayers(){var list=[];try{if(typeof dbGetPlayers==='function'&&(window.SCSSportContext?.appModule!=='scoreboard'||getMyClub()?.id))list=await dbGetPlayers(false);}catch(e){}if(!list.length&&window.SCSSportContext?.appModule!=='scoreboard'&&window.schedulerState&&Array.isArray(schedulerState.allPlayers))list=schedulerState.allPlayers;clubPlayers=normalizePlayers(list);populatePlayerSelects();}
function populatePlayerSelects(){var sels=playerSelects(),old=sels.map(function(x){return x.value});sels.forEach(function(sel,i){sel.innerHTML='<option value="">Select player</option>';clubPlayers.forEach(function(p){var o=document.createElement('option');o.value=p.id;o.textContent=p.name;sel.appendChild(o)});if(old[i]&&clubPlayers.some(function(p){return p.id===old[i]}))sel.value=old[i];});updateDuplicateOptions();if(!clubPlayers.length)setSetupMsg('No registered players found for the current club.');}
function updateDuplicateOptions(){var sels=playerSelects(),chosen=sels.map(function(s){return s.value}).filter(Boolean);sels.forEach(function(sel){Array.prototype.forEach.call(sel.options,function(o){o.disabled=!!o.value&&o.value!==sel.value&&chosen.indexOf(o.value)>=0;});});var btn=document.querySelector('.scs-score-start-btn');if(btn){var ids=sels.map(function(s){return s.value});btn.disabled=standaloneMode?false:(ids.some(function(v){return !v;})||new Set(ids).size!==4);}}
function playerChanged(){updateDuplicateOptions();setSetupMsg('');}
function refreshSetupNames(){updateDuplicateOptions();}
async function open(options){
  options=options||{};
  scoringWorkspace=options.workspace||(document.body&&document.body.dataset.scsRoleWorkspace)||'member';
  pickerReturn=typeof options.onClose==='function'?options.onClose:null;
  pickerTab='home';standalonePickerReturn=null;
  memberPickerEntry=true;
  if(window.SCSStandalone)SCSStandalone.resetSetup();
  standaloneMode=false;conductMode=false,teamEditMatchId=null;
  return openPicker();
}
async function openStandalone(){
  if(!el('scsScoringOverlay').hidden&&!el('scsScoreMatchPicker').hidden){
   standalonePickerReturn={tab:pickerTab,conduct:conductMode};
  }
  var setupLoadId=++pickerLoadId;
  memberPickerEntry=false;
  standaloneMode=true;conductMode=false;teamEditMatchId=null;liveMatch=null;readOnly=false;state=null;
  setupServer=0;setupReceiver=2;
  configureSport(preferredSport(),true);
  var openingServer=el('scsPickleballServer'),openingReceiver=el('scsPickleballReceiver');if(openingServer)openingServer.value='0';if(openingReceiver)openingReceiver.value='0';
  var actions=document.querySelector('.scs-score-side-actions'),controls=document.querySelector('.scs-score-controls');
  if(actions)actions.hidden=false;if(controls)controls.hidden=false;
  el('scsScoringOverlay').hidden=false;
  el('scsScoreMatchPicker').hidden=true;el('scsScoreLive').hidden=true;
  el('scsScoreSetup').hidden=false;el('scsScoreSetup').classList.remove('scs-live-match-setup');showScoreConfig(true,false);
  playerSelects().forEach(function(x){x.disabled=false;x.value='';});
  var h=el('scsScoreSetup').querySelector('h2'),p=el('scsScoreSetup').querySelector('p');
  if(h)h.textContent='Players';if(p)p.textContent='Select four players from the current club.';
  setSetupMsg('');await loadClubPlayers();
  if(setupLoadId!==pickerLoadId||el('scsScoringOverlay').hidden)return;
  if(window.SCSStandalone&&SCSStandalone.prepareSetup)SCSStandalone.prepareSetup();
  updateDuplicateOptions();
}
function openStandaloneHistory(score){
  standaloneMode=true;conductMode=false;openCompleted(score);
}
async function openConduct(){
  scoringWorkspace='tournament';pickerReturn=null;
  pickerTab='home';standalonePickerReturn=null;
  memberPickerEntry=true;
  if(window.SCSStandalone)SCSStandalone.resetSetup();
  standaloneMode=false;conductMode=true;
  return openPicker();
}
function newStandalone(){
 standalonePickerReturn={tab:pickerTab,conduct:conductMode};
 return openStandalone();
}
function openHistory(){
 if(el('scsScoringOverlay').hidden){scoringWorkspace=(document.body&&document.body.dataset.scsRoleWorkspace)||'member';pickerReturn=null;}
 memberPickerEntry=true;standaloneMode=false;pickerTab='history';
 if(window.SCSStandalone)SCSStandalone.resetSetup();
 return openPicker();
}
function selectPickerTab(tab){
 if(tab!=='home'&&tab!=='history')return;
 pickerTab=tab;
 return openPicker();
}
async function openPicker(){
  var loadId=++pickerLoadId;
  el('scsScoringOverlay').hidden=false; el('scsScoreSetup').hidden=true; el('scsScoreSetup').classList.remove('scs-live-match-setup');showScoreConfig(false,false); el('scsScoreLive').hidden=true; el('scsScoreMatchPicker').hidden=false;
  state=null; liveMatch=null; setupServer=0; setupReceiver=2;
  // Every entry and return uses the same picker and its hamburger header.
  if(typeof window.scsRefreshTournamentHeader==='function')window.scsRefreshTournamentHeader();
  if(typeof window.scsRefreshPracticeHeader==='function')window.scsRefreshPracticeHeader();
  var box=el('scsScoreMatchPicker'); renderLiveMatches([]);
  if(pickerTab==='history'){
   var list=box.querySelector('.scs-score-picker-empty');list.className='scs-score-history-list';
   if(window.SCSStandalone&&SCSStandalone.renderHistory){
    await SCSStandalone.renderHistory(list,function(score){
     standalonePickerReturn={tab:'history',conduct:conductMode};
     openStandaloneHistory(score);
    },function(){return loadId===pickerLoadId&&!box.hidden&&!el('scsScoringOverlay').hidden;});
   }else list.textContent='Match history is unavailable. Please reload the app.';
   return;
  }
  box.querySelector('.scs-score-picker-empty').textContent='Loading live matches…';
  box.setAttribute('aria-busy','true');
  box.querySelector('[data-score-refresh]').disabled=true;
  try{
    try{clubPlayers=normalizePlayers(typeof dbGetPlayers==='function'&&(window.SCSSportContext?.appModule!=='scoreboard'||getMyClub()?.id)?await dbGetPlayers(false):[]);}catch(_){clubPlayers=[];}
    var sessions=typeof dbGetLiveSessions==='function'?await dbGetLiveSessions({strict:true}):[];
    var currentLocalTournament=window.SCSCourtCenter?.localSession?.();
    if(window.SCSSportContext?.appModule==='scoreboard'){
      if(!window.SCSTournamentScores?.filterCurrentSessions)throw Error('Tournament assignment validation is unavailable. Reload the app.');
      var currentViews=await SCSTournamentScores.filterCurrentSessions(currentLocalTournament?sessions.concat([currentLocalTournament]):sessions);
      var localId=currentLocalTournament?.id;currentLocalTournament=localId?currentViews.find(s=>s.id===localId)||null:null;sessions=localId?currentViews.filter(s=>s.id!==localId):currentViews;
    }
    var pickerLocalTournament=null;if(window.SCSCourtCenter?.tournamentSessionViews){var storedLocal=currentLocalTournament,sourceCount=sessions.length,views=SCSCourtCenter.tournamentSessionViews(storedLocal?sessions.concat([storedLocal]):sessions);sessions=views.slice(0,sourceCount);pickerLocalTournament=storedLocal?views[sourceCount]:null;}
    var matches=[];
    (sessions||[]).forEach(function(sess){var rounds=sess.rounds_data||[];if(!rounds.length)return;var round=rounds[rounds.length-1];(round.games||[]).forEach(function(g,gi){
      var winnerOn = g.winnerEnabled===true || round.winnerEnabled===true;
      var tournament=!!round.tournament,available=winnerOn&&(!tournament||!!g.court&&g.court_center_status!=='approved')&&!g.winner&&!g.conduct_finished&&((conductMode&&g.score_status==='scored')||(g.score_status!=='scored'));
      if(available) matches.push({sessionId:sess.id,round:round.round,court:g.court||gi+1,pair1:g.pair1||[],pair2:g.pair2||[],game:g,sport:g.sport||round.sport||(round.tournament&&round.tournament.sport)||sess.sport,courtCenter:round.courtCenter===true,tournament:tournament,passwordRef:round.tournament?{tournamentId:round.tournament._scsCloudTournamentId,matchKey:String(g.tournament_match)}:null,scoringRules:round.tournament&&round.tournament.scoringRules,matchNo:tournamentMatchLabel(round.tournament,g),scoreReady:g.score_status==='scored'});
    });});
    /* Tournament matches are locally persisted and need no Supabase session. */
    if(window.SCSCourtCenter&&SCSCourtCenter.localSession){var ls=window.SCSCourtCenter?.tournamentSessionViews?pickerLocalTournament:SCSCourtCenter.localSession();if(ls&&ls.rounds_data&&ls.rounds_data[0]){(ls.rounds_data[0].games||[]).forEach(function(g){if(g.court&&g.court_center_status!=='approved'&&!g.conduct_finished&&((conductMode&&g.score_status==='scored')||(g.score_status!=='scored'&&!g.winner))){matches.push({sessionId:ls.id,round:1,court:g.court,pair1:g.pair1||[],pair2:g.pair2||[],game:g,scoringRules:ls.rounds_data[0].tournament&&ls.rounds_data[0].tournament.scoringRules,courtCenter:true,tournament:true,matchNo:tournamentMatchLabel(ls.rounds_data[0].tournament,g),scoreReady:g.score_status==='scored'})}})}}
    /* Team Tournament uses the same scorer and Conduct a Match picker as Group. */
    if(window.SCSTeamTournament&&typeof SCSTeamTournament.conductMatches==='function'){
      SCSTeamTournament.conductMatches().forEach(function(tm){
        if(tm.status!=='playing'&&tm.status!=='score_ready')return;
        if(!tm.court||!tm.pair1||!tm.pair2)return;
        if(matches.some(function(existing){return existing.sessionId==='local-team-'+tm.id}))return;
        matches.push({sessionId:'local-team-'+tm.id,groupId:tm.id,round:1,court:tm.court,pair1:tm.pair1,pair2:tm.pair2,game:{score:tm.score,winner:tm.winner},courtCenter:true,tournament:true,matchNo:tm.label,scoreReady:tm.status==='score_ready'});
      });
    }
    var tournamentLoadError=null;try{if(window.SCSTournamentScores){var remote=await SCSTournamentScores.list();matches=matches.filter(function(x){return String(x.sessionId).indexOf('local-team-')!==0||!remote.some(function(r){return r.remoteTournament.format==='team'&&String(x.groupId)===String(r.remoteTournament.matchId)&&JSON.stringify([x.pair1,x.pair2])===JSON.stringify([r.pair1,r.pair2]);});});remote.forEach(function(m){if((conductMode?m.scoreReady:!m.scoreReady)&&!matches.some(function(x){return x.remoteTournament&&x.remoteTournament.id===m.remoteTournament.id&&x.remoteTournament.matchId===m.remoteTournament.matchId}))matches.push(m);});}}catch(error){tournamentLoadError=error;}
    if(loadId!==pickerLoadId||box.hidden||el('scsScoringOverlay').hidden)return;
    renderLiveMatches(matches);if(tournamentLoadError){var notice=document.createElement('p');notice.setAttribute('role','status');notice.textContent='Could not refresh tournament matches. Please try Refresh.';box.appendChild(notice);}
  }catch(e){if(loadId!==pickerLoadId)return;renderLiveMatches([]);box.querySelector('.scs-score-picker-empty').textContent='Could not refresh matches. Check your connection and try Refresh.';}
  finally{if(loadId===pickerLoadId){box.setAttribute('aria-busy','false');var refresh=box.querySelector('[data-score-refresh]');if(refresh)refresh.disabled=false;}}
}
function openGroupMatch(m){
 memberPickerEntry=false;standaloneMode=false;
 el('scsScoringOverlay').hidden=false;el('scsScoreLive').hidden=true;el('scsScoreMatchPicker').hidden=true;state=null;liveMatch=null;setupServer=0;setupReceiver=2;
 selectLiveMatch(m);
}
function scoreSummaryForPicker(m){var s=m&&m.game&&m.game.score;if(!s)return '';var sets=Array.isArray(s.completedSets)?s.completedSets:[];if(sets.length)return sets.map(function(x){return (x.score||[0,0]).join('–')}).join(' | ');var a=Array.isArray(s.currentScore)?s.currentScore:[0,0];return a[0]+'–'+a[1];}
function tournamentMatchLabel(tournament,game){return tournament&&game.tournament_match!=null&&window.SCSTournament&&SCSTournament.displayMatchNumber?SCSTournament.displayMatchNumber(tournament,game.tournament_match):game.match_no||game.tournament_match||''}
function renderLiveMatches(matches){var box=el('scsScoreMatchPicker'),club=currentClubName();var title='Score a Match',help=conductMode?'Assigned matches ready for scoring.':'Select a court to start scoring.';var head='<button type="button" class="scs-score-cancel" onclick="SCSScoring.close()">‹ Back</button><div class="scs-score-picker-title"><div class="scs-score-picker-heading"><h2>'+title+'</h2><button type="button" class="scs-score-refresh" data-score-refresh onclick="SCSScoring.refresh()" aria-label="Refresh available matches from server">↻ Refresh</button></div><strong>'+escapeHtml(club||'Select a club')+'</strong><nav class="scs-score-tabs" aria-label="Scoring pages"><button type="button" aria-pressed="'+(pickerTab==='home')+'" onclick="SCSScoring.selectTab(\'home\')">Home</button><button type="button" aria-pressed="'+(pickerTab==='history')+'" onclick="SCSScoring.selectTab(\'history\')">History</button></nav><p>'+(pickerTab==='history'?'Saved matches on this device.':help)+'</p>'+(pickerTab==='home'?'<button type="button" class="scs-score-start-btn" onclick="SCSScoring.newStandalone()">+ Standalone Match</button>':'')+'</div>';if(window.SCSSportContext?.appModule==='scoreboard'){
 head='<header class="scs-scoreboard-picker-header"><button type="button" onclick="SCSScoring.close()" aria-label="Back to Scoreboard home">‹</button><strong>Scoreboard</strong><button type="button" data-score-refresh onclick="SCSScoring.refresh()" aria-label="Refresh matches" title="Refresh matches">↻</button></header><div class="scs-score-picker-title"><nav class="scs-score-tabs" aria-label="Scoring pages"><button type="button" aria-pressed="'+(pickerTab==='home')+'" onclick="SCSScoring.selectTab(\'home\')">Home</button><button type="button" aria-pressed="'+(pickerTab==='history')+'" onclick="SCSScoring.selectTab(\'history\')">History</button></nav><p>'+(pickerTab==='history'?'Saved matches on this device.':help)+'</p>'+(pickerTab==='home'?'<button type="button" class="scs-score-start-btn" onclick="SCSScoring.newStandalone()">+ Standalone Match</button>':'')+'</div>';
 }if(!matches.length){box.innerHTML=head+'<div class="scs-score-picker-empty">'+(conductMode?'No assigned matches ready to conduct.':'No available live matches to score.')+'</div>';return;}box.innerHTML=head;matches.forEach(function(m,i){if(m.scoreReady&&conductMode&&window.SCSSharedMatchCenter){var wrap=document.createElement('div');var winner=m.game&&m.game.winner==='L'?'left':m.game&&m.game.winner==='R'?'right':null;wrap.innerHTML=SCSSharedMatchCenter.completed({number:m.matchNo||m.court,title:'Court '+m.court+(m.matchNo?' · Match '+m.matchNo:''),left:(m.pair1||[]).join(' / '),right:(m.pair2||[]).join(' / '),leftPlayers:m.pair1||[],rightPlayers:m.pair2||[],score:scoreSummaryForPicker(m),winner:winner,action:'data-conduct-finish="1"',actionLabel:'Finish Match',actionClass:'scs-conduct-finish'});var card=wrap.firstElementChild;card.querySelector('[data-conduct-finish]').addEventListener('click',function(){finishConductMatch(m);});box.appendChild(card);return;}var card=document.createElement('div');card.className='scs-score-live-match '+(i%2?'court-alt':'');card.innerHTML='<span class="scs-score-picker-court"><strong>COURT '+escapeHtml(m.court)+'</strong><em>'+(m.tournament?('Tournament'+(m.matchNo?' · '+escapeHtml(m.matchNo):'')):(m.courtCenter?'Court Center':'Round '+escapeHtml(m.round)))+'</em><i aria-hidden="true">›</i></span><span class="scs-score-picker-team">'+(m.pair1||[]).map(playerRow).join('')+'</span><span class="scs-score-picker-vs"><span></span><b>VS</b><span></span></span><span class="scs-score-picker-team">'+(m.pair2||[]).map(playerRow).join('')+'</span><button type="button" class="scs-conduct-start">Start Scoring</button>';card.querySelector('button').addEventListener('click',function(){selectLiveMatch(m);});box.appendChild(card);});}

async function finishConductMatch(m){if(!m||!m.tournament)return;var ok=false;if(m.remoteTournament)ok=await SCSTournamentScores.update(m,m.game.score,m.game.winner,true);else if(String(m.sessionId||'').indexOf('local-team-')===0&&window.SCSTeamTournament&&SCSTeamTournament.finishConductMatch)ok=await SCSTeamTournament.finishConductMatch(m.groupId);else if(String(m.sessionId||'').indexOf('local-tournament-')===0&&window.SCSCourtCenter&&SCSCourtCenter.finishConductMatch)ok=await SCSCourtCenter.finishConductMatch(m.game&&m.game.ccid);else if(typeof window.dbFinishTournamentConductMatch==='function')ok=await window.dbFinishTournamentConductMatch(m.sessionId,m.game&&m.game.ccid);if(ok)openConduct();}

function canEditMatchRules(){return !readOnly&&!teamEditMatchId&&(standaloneMode||setupSport==='badminton'&&!!liveMatch&&typeof window.scsTournamentCanManage==='function'&&window.scsTournamentCanManage())}
function renderRuleEditButton(){
 var host=el('scsScoreConfig');if(!host)return;var button=el('scsScoreEditRules');
 if(!button){button=document.createElement('button');button.id='scsScoreEditRules';button.type='button';button.textContent='Edit match rules';button.onclick=openRuleEditor;host.appendChild(button)}
 button.hidden=!state||(state.finished&&!standaloneMode)||!canEditMatchRules();
}
function openRuleEditor(){
 if(!state||(state.finished&&!standaloneMode)||!canEditMatchRules())return false;
 var old=el('scsScoreRuleEditor');if(old)old.remove();var panel=document.createElement('section');panel.id='scsScoreRuleEditor';panel.className='scs-overview-card';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Edit match rules');
 panel.innerHTML='<h3>Edit match rules</h3><label>Match format<select data-rule-count><option value="1">1 set</option><option value="3">Best of 3</option></select></label>'+[0,1,2].map(function(i){var rule=state.setRules[i]||{win:i===2?11:15,max:i===2?11:21},locked=i<state.completedSets.length&&!(standaloneMode&&state.finished&&i===state.completedSets.length-1);return '<div data-rule-set="'+(i+1)+'"><strong>Set '+(i+1)+(locked?' · Completed':'')+'</strong><label>Points to win<input data-rule-win="'+i+'" type="number" min="1" value="'+rule.win+'" '+(locked?'disabled':'')+'></label><label>Maximum<input data-rule-max="'+i+'" type="number" min="1" value="'+rule.max+'" '+(locked?'disabled':'')+'></label></div>'}).join('')+'<p data-rule-error role="status"></p><button type="button" data-rule-apply>Apply to this match</button><button type="button" data-rule-cancel>Cancel</button>';
 el('scsScoreConfig').appendChild(panel);var count=panel.querySelector('[data-rule-count]');count.value=state.matchSets;function update(){panel.querySelectorAll('[data-rule-set]').forEach(function(row){row.hidden=Number(row.dataset.ruleSet)>Number(count.value)})}count.onchange=update;update();panel.querySelector('[data-rule-cancel]').onclick=function(){panel.remove()};panel.querySelector('[data-rule-apply]').onclick=applyRuleOverride;return true;
}
function applyRuleOverride(){
 var panel=el('scsScoreRuleEditor');if(!panel||!state||(state.finished&&!standaloneMode)||!canEditMatchRules())return false;
 var count=Number(panel.querySelector('[data-rule-count]').value),rules=[],error=panel.querySelector('[data-rule-error]');
 if(count!==1&&count!==3)return false;
 if(!standaloneMode&&state.completedSets.length&&count!==state.matchSets){error.textContent='Keep the match format after a set is complete. You can change points for remaining sets.';return false}
 if(standaloneMode&&count===1&&(state.completedSets.length>1||state.currentSet>1&&state.entries.length)){error.textContent='A second set has already been played. Keep Best of 3 to preserve those scores.';return false}
 for(var i=0;i<count;i++){var win=Number(panel.querySelector('[data-rule-win="'+i+'"]').value),max=Number(panel.querySelector('[data-rule-max="'+i+'"]').value);if(!Number.isInteger(win)||!Number.isInteger(max)||win<1||max<win){error.textContent='Use positive whole numbers, with Maximum at least Points to win.';return false}rules.push(i<state.completedSets.length&&!(standaloneMode&&state.finished&&i===state.completedSets.length-1)?Object.assign({},state.setRules[i]):{win:win,max:max})}
 if(!confirm('Apply these rules to this match? The current set may end immediately if its score meets the new rules. Completed sets stay unchanged.'))return false;
 state.history.push(snapshot());state.matchSets=count;state.setRules=rules;
 if(standaloneMode&&state.finished){state.finished=false;const last=state.completedSets.pop();if(last){state.setWins[last.winner]--;state.currentSet=last.set;state.score=last.score.slice();state.server=last.server;state.positions=last.positions.map(p=>p.slice());state.entries=last.entries.map(e=>({...e}));}}
 if(standaloneMode&&count===1&&state.completedSets.length===1){state.finished=true;state.currentSet=1;const last=state.completedSets[0];state.score=last.score.slice();state.entries=last.entries.map(e=>({...e}));}else finishSetIfWon();panel.remove();showScoreConfig(true,true);render(false);syncLiveScore(null);return true;
}
function finishSetIfWon(){
 var a=state.score[0],b=state.score[1];if(a===b||!setIsWon(a,b,state.currentSet))return;
 var winner=a>b?0:1;state.completedSets.push({set:state.currentSet,score:[a,b],winner:winner,server:state.server,positions:state.positions.map(function(p){return p.slice()}),entries:state.entries.map(function(e){return Object.assign({},e)})});state.setWins[winner]++;
 if(state.matchSets===1||state.setWins[winner]>=2)state.finished=true;else beginNextSet();
}
function matchEventRules(){
 var saved=liveMatch&&liveMatch.game&&liveMatch.game.score;var rules=saved&&Array.isArray(saved.setRules)?saved:liveMatch&&liveMatch.scoringRules;
 return setupSport==='badminton'&&rules&&[1,3].indexOf(rules.matchSets)>=0&&Array.isArray(rules.setRules)&&rules.setRules.length===rules.matchSets?rules:null;
}
function applyMatchEventRules(){
 var rules=matchEventRules();if(!rules||state)return;
 var format=document.querySelector('input[name="scsScoreMatchFormat"][value="'+rules.matchSets+'"]');if(format)format.checked=true;
 rules.setRules.forEach(function(rule,i){el('scsScoreSet'+(i+1)+'Win').value=rule.win;el('scsScoreSet'+(i+1)+'Max').value=rule.max});
 matchFormatChanged();var details=el('scsScoreFormatDetails'),setupEditable=canEditMatchRules()&&!(liveMatch&&liveMatch.game&&liveMatch.game.score);details.classList.toggle('is-locked',!setupEditable);details.querySelectorAll('input').forEach(function(input){input.disabled=!setupEditable});
}
async function selectLiveMatch(m){const ref=m.remoteTournament?{tournamentId:m.remoteTournament.id,matchKey:m.remoteTournament.matchId}:m.passwordRef;if(ref?.tournamentId&&window.SCSMatchPasswords){try{if(!await SCSMatchPasswords.authorize(ref.tournamentId,ref.matchKey))return;}catch(error){alert(error.message||'Could not verify match scoring access.');return;}}var oldRuleEditor=el('scsScoreRuleEditor');if(oldRuleEditor)oldRuleEditor.remove();var oldRuleButton=el('scsScoreEditRules');if(oldRuleButton)oldRuleButton.hidden=true;readOnly=false;readOnlySet=0;teamEditMatchId=null;savedScoreEditor=null;var actions=document.querySelector('.scs-score-side-actions'),controls=document.querySelector('.scs-score-controls');if(actions)actions.hidden=false;if(controls)controls.hidden=false;liveMatch=m;setupSport=m.game&&m.game.score?(m.game.score.sport||'badminton'):(m.game&&m.game.sport||m.sport||preferredSport());configureSport(setupSport,true);el('scsScoreMatchPicker').hidden=true;el('scsScoreSetup').hidden=false;el('scsScoreSetup').classList.add('scs-live-match-setup');var all=(m.pair1||[]).concat(m.pair2||[]);clubPlayers=all.map(function(n,i){return{id:'live-'+i,name:n};});populatePlayerSelects();playerSelects().forEach(function(sel,i){sel.value='live-'+i;sel.disabled=true;});updateDuplicateOptions();var h=el('scsScoreSetup').querySelector('h2'),p=el('scsScoreSetup').querySelector('p');if(h)h.textContent=(m.courtCenter?'Court Center':'Round '+m.round)+' · Court '+m.court;if(p)p.textContent=m.pair1.join(' / ')+' vs '+m.pair2.join(' / ');var fmt=el('scsScoreFormatDetails');if(fmt){fmt.open=false;var scored=!!(m.game&&(m.game.score||m.game.scoreboard||m.game.completedSets||m.game.currentScore||m.game.finished||m.game.status==='under_approval'));fmt.classList.toggle('is-locked',scored);fmt.querySelectorAll('input').forEach(function(x){x.disabled=scored;});}showScoreConfig(true,fmt&&fmt.classList.contains('is-locked'));applyMatchEventRules();setSetupMsg('');}

function openCompleted(score,onClose){
 completedReturn=typeof onClose==='function'?onClose:null;
  if(!score||!Array.isArray(score.names)||score.names.length<4)return;
  readOnly=true; liveMatch=null;teamEditMatchId=null;
  state={sport:score.sport==='pickleball'?'pickleball':'badminton',scoringMode:score.scoringMode||'rally',serverNumber:score.serverNumber||2,names:score.names.slice(0,4),score:Array.isArray(score.currentScore)?score.currentScore.slice():[0,0],server:Number.isInteger(score.server)?score.server:0,initialServer:Number.isInteger(score.initialServer)?score.initialServer:0,initialReceiver:Number.isInteger(score.initialReceiver)?score.initialReceiver:2,positions:Array.isArray(score.positions)?score.positions.map(function(x){return x.slice();}):makePositions(0,2),entries:Array.isArray(score.entries)?score.entries.map(function(x){return Object.assign({},x);}):[],history:Array.isArray(score.history)?JSON.parse(JSON.stringify(score.history)):[],finished:true,buttonOrder:'ab',matchSets:score.matchSets===3?3:1,setRules:Array.isArray(score.setRules)?score.setRules.map(function(x){return{win:x.win,max:x.max};}):[{win:15,max:21}],currentSet:Number(score.currentSet)||1,completedSets:Array.isArray(score.completedSets)?score.completedSets.map(function(x){return{serverNumber:x.serverNumber,initialServer:x.initialServer,initialReceiver:x.initialReceiver,set:x.set,score:Array.isArray(x.score)?x.score.slice():[0,0],winner:x.winner,server:x.server,positions:Array.isArray(x.positions)?x.positions.map(function(p){return p.slice();}):null,entries:Array.isArray(x.entries)?x.entries.map(function(e){return Object.assign({},e);}):[],originalEntries:Array.isArray(x.originalEntries)?JSON.parse(JSON.stringify(x.originalEntries)):undefined,corrections:Array.isArray(x.corrections)?JSON.parse(JSON.stringify(x.corrections)):undefined,manuallyCorrected:x.manuallyCorrected===true};}):[],setWins:Array.isArray(score.setWins)?score.setWins.slice():[0,0]};
  el('scsScoringOverlay').hidden=false;el('scsScoreMatchPicker').hidden=true;el('scsScoreSetup').hidden=true;el('scsScoreLive').hidden=false;showScoreConfig(true,true);
  readOnlySet=state.completedSets.length?state.completedSets[state.completedSets.length-1].set:state.currentSet;
  if(readOnlySet)selectCompletedSet(readOnlySet,true);else render(false);
  var actions=document.querySelector('.scs-score-side-actions'),controls=document.querySelector('.scs-score-controls'),send=el('scsScoreSendResult');
  if(actions)actions.hidden=true;if(controls)controls.hidden=true;if(send)send.hidden=true;
  requestAnimationFrame(function(){var w=el('scsScoreTableWrap');if(w)w.scrollLeft=0;});
}

function openEditableCompleted(id,score,onSave){
 standaloneMode=false;
 if(!score||!Array.isArray(score.names)||score.names.length!==4||typeof onSave!=="function")return false;
 openCompleted(score);teamEditMatchId=id;savedScoreEditor=onSave;scoreEditDirty=false;render(false);
 var send=el("scsScoreSendResult");if(send){send.hidden=true;send.disabled=false;send.textContent=(typeof t === 'function' ? t('scsFinishSendResult') : "Finish & Send Result");}return true;
}
function openTeamCompleted(id,score){
 if(!score||!Array.isArray(score.names)||score.names.length!==4)return false;
 return openEditableCompleted(id,score,function(payload,winner){return window.SCSTeamTournament&&SCSTeamTournament.updateCompletedScore(id,payload,winner);});
 /* legacy controls */
 openCompleted(score);teamEditMatchId=id;render(false);
 var send=el('scsScoreSendResult');if(send){send.hidden=false;send.disabled=false;send.textContent=(typeof t === 'function' ? t('scsSaveChanges') : "Save Changes");}
 var controls=document.querySelector('.scs-score-controls');if(controls)controls.hidden=true;
 return true;
}
function editSavedSet(n){
 if(!teamEditMatchId||!state)return;
 var set=state.completedSets.find(function(x){return Number(x.set)===Number(n);});
 if(!set)return;
 var input=prompt(gameWord()+' '+n+' score (Govi/left – Jay/right). Enter two numbers separated by a dash:',set.score.join('-'));
 if(input===null)return;
 var match=input.trim().match(/^(\d+)\s*[-–:,/]\s*(\d+)$/);
 if(!match){alert('Enter scores as 14-15.');return;}
 var a=Number(match[1]),b=Number(match[2]);
 if(a===set.score[0]&&b===set.score[1])return;
 if(a===b||a>99||b>99){alert('Scores must have a winner and be between 0 and 99.');return;}
 if(!Array.isArray(set.originalEntries))set.originalEntries=Array.isArray(set.entries)?JSON.parse(JSON.stringify(set.entries)):[];
 if(!Array.isArray(set.corrections))set.corrections=[];
 set.corrections.push({previousScore:set.score.slice(),newScore:[a,b],at:new Date().toISOString()});
 set.score=[a,b];set.winner=a>b?0:1;set.entries=[];set.manuallyCorrected=true;scoreEditDirty=true;
 state.setWins=[0,0];state.completedSets.forEach(function(x){state.setWins[x.winner]++;});
 selectCompletedSet(n,true);render(false);
 var send=el('scsScoreSendResult');if(send){send.hidden=false;send.textContent=(typeof t === 'function' ? t('scsFinishSendResult') : "Finish & Send Result");}
}
function scorePayload(){if(!state)return null;return{sport:state.sport||'badminton',scoringMode:pickleball()?'side-out':'rally',serverNumber:state.serverNumber||null,names:state.names.slice(),currentSet:state.currentSet,currentScore:state.score.slice(),server:state.server,initialServer:state.initialServer,initialReceiver:state.initialReceiver,positions:state.positions.map(function(x){return x.slice();}),entries:state.entries.map(function(x){return Object.assign({},x);}),completedSets:state.completedSets.map(function(x){return{serverNumber:x.serverNumber,initialServer:x.initialServer,initialReceiver:x.initialReceiver,set:x.set,score:x.score.slice(),winner:x.winner,server:x.server,positions:x.positions?x.positions.map(function(p){return p.slice();}):null,entries:Array.isArray(x.entries)?x.entries.map(function(e){return Object.assign({},e);}):[],originalEntries:Array.isArray(x.originalEntries)?JSON.parse(JSON.stringify(x.originalEntries)):undefined,corrections:Array.isArray(x.corrections)?JSON.parse(JSON.stringify(x.corrections)):undefined,manuallyCorrected:x.manuallyCorrected===true};}),history:Array.isArray(state.history)?JSON.parse(JSON.stringify(state.history)):[],setWins:state.setWins.slice(),matchSets:state.matchSets,setRules:state.setRules.map(function(x){return{win:x.win,max:x.max};}),finished:state.finished===true};}
// Only the latest unsent snapshot of each match is useful. Keep the active
// write ordered before its replacement so an older score cannot overwrite it.
var scoreSyncPending=new Map(),scoreSyncRunning=false;
function scoreSyncKey(m){return JSON.stringify([m.sessionId,m.round,m.court,m.groupId,m.game&&m.game.ccid,m.remoteTournament&&m.remoteTournament.id,m.remoteTournament&&m.remoteTournament.matchId,m.pair1,m.pair2]);}
async function writeLiveScore(m,payload,winner){
 var ccid=m.game&&m.game.ccid;
 if(m.remoteTournament)return SCSTournamentScores.update(m,payload,winner||null);
 if(String(m.sessionId).indexOf('local-team-')===0)return window.SCSTeamTournament&&SCSTeamTournament.scoreUpdate(m.groupId,payload,winner||null);
 if(String(m.sessionId).indexOf('local-group-')===0)return window.SCSGroupTournament&&SCSGroupTournament.scoreUpdate(m.groupId,payload,winner||null);
 if(String(m.sessionId).indexOf('local-tournament-')===0)return window.SCSCourtCenter&&SCSCourtCenter.localScoreUpdate(m.sessionId,m.court,m.pair1,m.pair2,payload,winner||null,ccid);
 if(typeof dbUpdateLiveMatchScore==='function')return dbUpdateLiveMatchScore(m.sessionId,m.round,m.court,m.pair1,m.pair2,payload,winner||null,ccid);
 return false;
}
async function drainScoreSync(){
 if(scoreSyncRunning)return;
 scoreSyncRunning=true;
 try{while(scoreSyncPending.size){
  var entry=scoreSyncPending.entries().next().value,key=entry[0],job=entry[1];
  scoreSyncPending.delete(key);
  var ok=false;try{ok=await writeLiveScore(job.match,job.payload,job.winner);}catch(error){console.error('Score sync failed:',error);}
  job.waiters.forEach(function(resolve){resolve(!!ok);});
 }}finally{scoreSyncRunning=false;}
}
function queueLiveScore(m,payload,winner){
 return new Promise(function(resolve){
  var key=scoreSyncKey(m),previous=scoreSyncPending.get(key);
  scoreSyncPending.set(key,{match:m,payload:payload,winner:winner,waiters:(previous?previous.waiters:[]).concat(resolve)});
  // Batch synchronous rallies and a final save before beginning another write.
  Promise.resolve().then(drainScoreSync);
 });
}
function syncLiveScore(winner){return liveMatch?queueLiveScore(liveMatch,scorePayload(),winner):Promise.resolve(false);}
async function confirmTournamentResult(m,payload,winner){
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const sameScore=v=>JSON.stringify(canonical(v))===JSON.stringify(canonical(payload));
 if(!window.SCSTournamentLocal?.confirmRecord)return;
 if(m.remoteTournament){
  const row=await SCSTournamentLocal.confirmRecord('tournaments',m.remoteTournament.id),matches=row.format==='team'?(row.state.encounters||[]).flatMap(e=>e.matches||[]):row.state.matches||[];
  const game=matches.find(g=>String(g.id)===String(m.remoteTournament.matchId));
  if(!game||game.winner!==winner||!sameScore(game.score))throw Error('The server has not confirmed this result. Retry sending.');
 }else if(m.tournament&&!String(m.sessionId).startsWith('local-')){
  const row=await SCSTournamentLocal.confirmRecord('sessions',m.sessionId),game=(row.rounds_data||[]).flatMap(r=>r.games||[]).find(g=>m.game?.ccid?g.ccid===m.game.ccid:String(g.tournament_match)===String(m.game?.tournament_match));
  if(!game||game.winner!==winner||!sameScore(game.score))throw Error('The server has not confirmed this result. Retry sending.');
 }
}
async function retryTournamentHistory(score){
 const source=score?.tournamentSource,club=getMyClub();if(!score?.finished||!Array.isArray(source)||!club?.id)throw Error('Select the original match club before sending.');
 const approvals=await SCSTournamentScores.historyApprovals([score]);if(approvals.get(JSON.stringify(source)))return {approved:true};
 const names=score.names||[],pairs=[names.slice(0,2),names.slice(2,4)],winner=score.setWins?.[0]>score.setWins?.[1]?'L':'R';let match;
 if(source[0]==='cloud-tournament'){
  const list=await SCSTournamentScores.list();match=list.find(m=>String(m.remoteTournament?.id)===String(source[1])&&String(m.remoteTournament?.matchId)===String(source[2]));
 }else if(!String(source[0]).startsWith('local-')){
  const rows=await sbGet('sessions','id=eq.'+encodeURIComponent(source[0])+'&club_id=eq.'+encodeURIComponent(club.id)+'&select=id,club_id,status,rounds_data,updated_at,started_by');
  const views=await SCSTournamentScores.filterCurrentSessions(rows);
  for(const row of views)for(const round of row.rounds_data||[]){const game=(round.games||[]).find(g=>String(g.ccid||g.tournament_match)===String(source[1]));if(game)match={sessionId:row.id,round:round.round,court:game.court,pair1:game.pair1,pair2:game.pair2,game,tournament:true,matchNo:score.matchTitle};}
 }
 if(getMyClub()?.id!==club.id)throw Error('The selected club changed. Return to the match club and retry.');
 if(!match||JSON.stringify([match.pair1,match.pair2])!==JSON.stringify(pairs))throw Error('This saved result no longer matches a current tournament assignment. No result was changed.');
 const payload={...score};for(const field of ['matchTitle','tournamentMatch','tournamentSource','tournamentDelivery'])delete payload[field];
 if(!await queueLiveScore(match,payload,winner))throw Error('Result remains saved on this device. Could not send it; retry when connected.');
 await confirmTournamentResult(match,payload,winner);
 await SCSStandalone.saveTournament(payload,match,'sent');return true;
}
async function sendResult(){
 if(standaloneMode){
  if(!state||!state.finished||readOnly)return;
  var saveButton=el('scsScoreSendResult');if(saveButton)saveButton.disabled=true;
  try{
   await SCSStandalone.save(Object.assign(scorePayload(),{matchTitle:standaloneTitle,playerGenders:standaloneGenders.slice()}));
   close();
  }catch(error){
   console.error('Standalone local save failed',error);
   alert('Could not save match on this device. Please try again.');
   if(saveButton)saveButton.disabled=false;
  }
  return;
 }
 if(teamEditMatchId){
 var id=teamEditMatchId;
 if(!scoreEditDirty||!state||!state.completedSets.length)return;
 var wins=[0,0];state.completedSets.forEach(function(x){wins[x.score[0]>x.score[1]?0:1]++;});
 if(wins[0]===wins[1]){alert(gameWord()+' wins are tied. Correct the scores before saving.');return;}
 state.setWins=wins;state.finished=true;
 var btn=el('scsScoreSendResult');if(btn){btn.disabled=true;btn.textContent=(typeof t === 'function' ? t('scsSending') : "Sending…");}
 var ok=false;try{ok=await savedScoreEditor(scorePayload(),wins[0]>wins[1]?'L':'R');}catch(error){console.error('Score correction save failed:',error);}
 if(ok){scoreEditDirty=false;close();}else{if(btn){btn.disabled=false;btn.textContent=(typeof t === 'function' ? t('scsFinishSendResult') : "Finish & Send Result");}alert('Could not save the corrected score.');}return;
 }if(!state||!state.finished||!liveMatch||savingFinalScore)return;
 var m=liveMatch,payload=scorePayload(),winner=state.setWins[0]>state.setWins[1]?'L':'R',btn=el('scsScoreSendResult');
 savingFinalScore=true;
 if(btn){btn.disabled=true;btn.textContent=(typeof t==='function'?t('scsSending'):'Sending…');}
 try{
  if(m.tournament||m.remoteTournament||/^local-(group|team|tournament)-/.test(String(m.sessionId))){
   try{if(!window.SCSStandalone?.saveTournament)throw Error('Local history unavailable');await SCSStandalone.saveTournament(payload,m);}
   catch(error){throw Error('Could not save tournament history on this device. Please retry.');}
  }
  var ok=await queueLiveScore(m,payload,winner);
  if(!ok)throw Error('Could not save result to the server. Please try again.');
  await confirmTournamentResult(m,payload,winner);
  if(m.tournament||m.remoteTournament)await SCSStandalone.saveTournament(payload,m,'sent');
  if(liveMatch===m)close();
 }catch(error){
  if(liveMatch===m){if(btn){btn.disabled=false;btn.textContent='Save & Close';}setSetupMsg(error.message);alert(error.message);}
 }finally{savingFinalScore=false;}
}

function close(){
 const done=el('scsScoreViewDone');if(done)done.hidden=true;
 if(completedReturn){const back=completedReturn;completedReturn=null;el('scsScoringOverlay').hidden=true;state=null;liveMatch=null;teamEditMatchId=null;savedScoreEditor=null;readOnly=false;readOnlySet=0;memberPickerEntry=false;standaloneMode=false;document.querySelectorAll('.scs-score-side-actions,.scs-score-controls').forEach(n=>n.hidden=false);back();if(typeof window.scsRefreshTournamentHeader==='function')window.scsRefreshTournamentHeader();return;}
 ++pickerLoadId;
 if(memberPickerEntry&&!standaloneMode){
  if(!el('scsScoreMatchPicker').hidden){
   el('scsScoringOverlay').hidden=true;
   memberPickerEntry=false;
   state=null;liveMatch=null;readOnly=false;readOnlySet=0;
   var returnTo=pickerReturn;pickerReturn=null;
   if(returnTo)return returnTo();
   if(scoringWorkspace==='tournament'&&window.scsTournamentReturnPage&&typeof window.scsReturnToTournamentParent==='function')return window.scsReturnToTournamentParent();
   return;
  }
  state=null;liveMatch=null;teamEditMatchId=null;savedScoreEditor=null;readOnly=false;readOnlySet=0;
  var actions=document.querySelector('.scs-score-side-actions'),controls=document.querySelector('.scs-score-controls');
  if(actions)actions.hidden=false;if(controls)controls.hidden=false;
  return openPicker();
 }
 if(standaloneMode&&standalonePickerReturn){
  var destination=standalonePickerReturn;standalonePickerReturn=null;
  standaloneMode=false;conductMode=destination.conduct;pickerTab=destination.tab;memberPickerEntry=true;
  state=null;liveMatch=null;readOnly=false;readOnlySet=0;
  if(window.SCSStandalone)SCSStandalone.resetSetup();
  var actions=document.querySelector('.scs-score-side-actions'),controls=document.querySelector('.scs-score-controls');
  if(actions)actions.hidden=false;if(controls)controls.hidden=false;
  return openPicker();
 }
 if(standaloneMode){
  var wasHistory=readOnly;
  el('scsScoringOverlay').hidden=true;
  state=null;liveMatch=null;readOnly=false;readOnlySet=0;standaloneMode=false;
  var actions=document.querySelector('.scs-score-side-actions'),controls=document.querySelector('.scs-score-controls');
  if(actions)actions.hidden=false;if(controls)controls.hidden=false;
  if(window.SCSStandalone)SCSStandalone.resetSetup();
  if(wasHistory&&window.SCSStandalone)return SCSStandalone.show();
  return;
 }
 if(window.SCSGroupTournament&&SCSGroupTournament.returnFromScore)SCSGroupTournament.returnFromScore();if(window.SCSTournament&&SCSTournament.returnFromScore)SCSTournament.returnFromScore();var returnToTournament=conductMode||!!window.scsTournamentReturnPage;if(teamEditMatchId&&window.SCSTeamTournament)SCSTeamTournament.returnFromScore();if(liveMatch&&String(liveMatch.sessionId||'').indexOf('local-team-')===0&&window.SCSTeamTournament)SCSTeamTournament.returnFromScore();if(liveMatch&&String(liveMatch.sessionId||'').indexOf('local-group-')===0&&window.SCSGroupTournament)SCSGroupTournament.returnFromScore();el('scsScoringOverlay').hidden=true;state=null;liveMatch=null;teamEditMatchId=null;savedScoreEditor=null;readOnly=false;readOnlySet=0;var actions=document.querySelector('.scs-score-side-actions'),controls=document.querySelector('.scs-score-controls');if(actions)actions.hidden=false;if(controls)controls.hidden=false;if(returnToTournament&&window.scsTournamentReturnPage&&typeof window.scsReturnToTournamentParent==='function')window.scsReturnToTournamentParent();}
function makePositions(server,receiver){var pos=[[null,null],[null,null]],st=teamOf(server),rt=1-st;pos[st][0]=server;pos[st][1]=partner(server);pos[rt][0]=receiver;pos[rt][1]=partner(receiver);return pos;}
function selectedMatchFormat(){var x=document.querySelector('input[name="scsScoreMatchFormat"]:checked');return x&&x.value==='3'?3:1;}
function matchFormatChanged(){var summary=el('scsScoreFormatSummary');if(summary)summary.textContent=selectedMatchFormat()===3?(setupSport==='pickleball'?'3 Games':'3 Sets'):(setupSport==='pickleball'?'1 Game':'1 Set');var three=selectedMatchFormat()===3;document.querySelectorAll('.scs-score-set-rule').forEach(function(r){var n=Number(r.getAttribute('data-set'));r.hidden=!three&&n>1;});}
function readSetRules(count){var rules=[];for(var i=1;i<=count;i++){var w=Math.max(1,parseInt(el('scsScoreSet'+i+'Win').value,10)||1),m=Math.max(w,parseInt(el('scsScoreSet'+i+'Max').value,10)||w);el('scsScoreSet'+i+'Win').value=w;el('scsScoreSet'+i+'Max').value=m;rules.push({win:w,max:setupSport==='pickleball'?null:m});}return rules;}
function start(){if(standaloneMode&&window.SCSStandalone){var prepared=SCSStandalone.collectSetup();if(!prepared){setSetupMsg("Enter four different player names.");return;}standaloneTitle=prepared.title;standaloneGenders=prepared.genders;}var sels=playerSelects(),ids=sels.map(function(s){return s.value});if(ids.some(function(v){return !v;})){setSetupMsg('Select all four players.');return}if(new Set(ids).size!==4){setSetupMsg('Each player can be selected only once.');return}if(setupSport==='pickleball'){setupServer=Number(el('scsPickleballServer').value)||0;setupReceiver=(teamOf(setupServer)===0?2:0)+(Number(el('scsPickleballReceiver').value)||0);}
var ns=names(),saved=liveMatch&&liveMatch.game&&liveMatch.game.score;if(saved&&Array.isArray(saved.currentScore)&&Array.isArray(saved.names)){state=JSON.parse(JSON.stringify(saved));state.sport=saved.sport==='pickleball'?'pickleball':'badminton';state.names=ns;state.score=state.currentScore||[0,0];delete state.currentScore;state.buttonOrder=state.buttonOrder||'ab';state.entries=Array.isArray(state.entries)?state.entries:[];state.history=Array.isArray(state.history)?state.history:[];state.completedSets=Array.isArray(state.completedSets)?state.completedSets:[];state.setWins=Array.isArray(state.setWins)?state.setWins:[0,0];state.matchSets=Number(state.matchSets)||1;state.setRules=Array.isArray(state.setRules)&&state.setRules.length?state.setRules:readSetRules(state.matchSets);state.currentSet=Number(state.currentSet)||1;state.initialServer=Number.isInteger(state.initialServer)?state.initialServer:setupServer;state.initialReceiver=Number.isInteger(state.initialReceiver)?state.initialReceiver:setupReceiver;state.server=Number.isInteger(state.server)?state.server:state.initialServer;state.positions=Array.isArray(state.positions)?state.positions:makePositions(state.initialServer,state.initialReceiver);state.finished=state.finished===true;}else{var matchSets=matchEventRules()&&!canEditMatchRules()?matchEventRules().matchSets:selectedMatchFormat();state={sport:setupSport,scoringMode:setupSport==='pickleball'?'side-out':'rally',names:ns,score:[0,0],server:setupServer,initialServer:setupServer,initialReceiver:setupReceiver,positions:makePositions(setupServer,setupReceiver),entries:[],history:[],finished:false,buttonOrder:'ab',matchSets:matchSets,setRules:matchEventRules()&&!canEditMatchRules()?JSON.parse(JSON.stringify(matchEventRules().setRules)):readSetRules(matchSets),currentSet:1,completedSets:[],setWins:[0,0]};if(pickleball())SCSPickleballScoring.initialise(state);if(liveMatch&&liveMatch.courtCenter)syncLiveScore(null);}el('scsScoreSetup').hidden=true;el('scsScoreLive').hidden=false;showScoreConfig(true,true);render(false);requestAnimationFrame(function(){var w=el('scsScoreTableWrap');if(w)w.scrollLeft=0;});}
function chooseServingTeam(team){if(!state||readOnly||state.entries.length||state.completedSets.length||![0,1].includes(team))return;if(teamOf(state.initialServer)!==team){var previous=state.initialServer;state.initialServer=state.initialReceiver;state.initialReceiver=previous;}state.server=state.initialServer;state.positions=makePositions(state.initialServer,state.initialReceiver);if(pickleball())SCSPickleballScoring.initialise(state);render(false);syncLiveScore(null);}
function renderInitialServiceChoice(){
 var old=el('scsInitialServiceChoice');if(old)old.remove();if(!state||readOnly||state.entries.length||state.completedSets.length)return;
 var host=el('scsScoreServer');if(!host)return;var section=document.createElement('section');section.id='scsInitialServiceChoice';section.className='scs-overview-card';
 const serving=teamOf(state.initialServer);
 section.innerHTML='<h3>Serving team</h3><div class="scs-first-team-options" role="group" aria-label="Choose serving team">'+[0,1].map(team=>'<button type="button" data-first-team="'+team+'" aria-pressed="'+(serving===team)+'"><span class="scs-first-team-state">'+(serving===team?'✓ Serving':'Select team')+'</span><strong>'+escapeHtml(state.names[team*2])+'<br>'+escapeHtml(state.names[team*2+1])+'</strong></button>').join('')+'</div>';
 host.before(section);section.querySelectorAll('[data-first-team]').forEach(button=>button.onclick=()=>chooseServingTeam(Number(button.dataset.firstTeam)));

}
function setInitialRole(i){if(!state||readOnly||state.entries.length||state.completedSets.length)return;var serverTeam=teamOf(state.initialServer);if(teamOf(i)===serverTeam)state.initialServer=i;else state.initialReceiver=i;state.server=state.initialServer;state.positions=makePositions(state.initialServer,state.initialReceiver);render(false);}
function snapshot(){return JSON.stringify({matchSets:state.matchSets,setRules:state.setRules,serverNumber:state.serverNumber,initialServer:state.initialServer,initialReceiver:state.initialReceiver,score:state.score,server:state.server,positions:state.positions,entries:state.entries,finished:state.finished,currentSet:state.currentSet,completedSets:state.completedSets,setWins:state.setWins})}
function restore(s){var x=JSON.parse(s);if(x.matchSets)state.matchSets=x.matchSets;if(x.setRules){state.setRules=x.setRules;showScoreConfig(true,true);}if(x.serverNumber)state.serverNumber=x.serverNumber;if(Number.isInteger(x.initialServer))state.initialServer=x.initialServer;if(Number.isInteger(x.initialReceiver))state.initialReceiver=x.initialReceiver;state.score=x.score;state.server=x.server;state.positions=x.positions;state.entries=x.entries;state.finished=x.finished;state.currentSet=x.currentSet;state.completedSets=x.completedSets;state.setWins=x.setWins;render(false)}
function setIsWon(a,b,setNo){var rule=state.setRules[setNo-1],hi=Math.max(a,b),lo=Math.min(a,b);return (hi>=rule.win&&hi-lo>=2)||hi>=rule.max;}
function beginNextSet(){state.currentSet++;state.score=[0,0];state.entries=[];state.server=state.initialServer;state.positions=makePositions(state.initialServer,state.initialReceiver);}
function addPoint(winnerTeam){if(savingFinalScore||!state||state.finished||!(winnerTeam===0||winnerTeam===1)||readOnly)return;state.history.push(snapshot());if(pickleball()){SCSPickleballScoring.rally(state,winnerTeam);render(true);syncLiveScore(null);return;}var servingTeam=teamOf(state.server);state.score[winnerTeam]++;var scoringPlayer;if(winnerTeam===servingTeam){scoringPlayer=state.server;var p=state.positions[winnerTeam];state.positions[winnerTeam]=[p[1],p[0]];}else{var court=(state.score[winnerTeam]%2===0)?0:1;state.server=state.positions[winnerTeam][court];scoringPlayer=state.server;}state.entries.push({player:scoringPlayer,score:state.score[winnerTeam],team:winnerTeam});finishSetIfWon();render(true);syncLiveScore(null);}
function undo(){
 if(savingFinalScore||!state||!state.history.length||readOnly&&!teamEditMatchId)return;
 var wasSaved=!!teamEditMatchId,priorFinished=state.finished,previous=state.history.pop();
 restore(previous);
 if(wasSaved){
  // A saved result remains a saved result: only correct its score, never approval/status.
  if(priorFinished&&!state.finished){
   var last=state.completedSets[state.completedSets.length-1];
   if(!last||Number(last.set)!==Number(state.currentSet)){
    state.completedSets.push({set:state.currentSet,score:state.score.slice(),winner:state.score[0]>=state.score[1]?0:1,server:state.server,positions:state.positions.map(function(p){return p.slice();}),entries:state.entries.map(function(e){return Object.assign({},e);}),manuallyCorrected:true});
   }
  }
  var current=state.completedSets[state.completedSets.length-1];
  if(current){current.score=state.score.slice();current.entries=state.entries.map(function(e){return Object.assign({},e);});current.manuallyCorrected=true;}
  state.finished=true;scoreEditDirty=true;render(false);
 }else syncLiveScore(null);
}
function swapButtons(){if(!state)return;state.buttonOrder=state.buttonOrder==='ab'?'ba':'ab';render(false);}
function buildTable(){var table=el('scsScoreTable'),cols=Math.max(30,state.entries.length+1),locked=state.entries.length>0||state.completedSets.length>0,h='<thead><tr><th>Player</th><th class="scs-score-role-head">S/R</th>';for(var c=0;c<cols;c++)h+='<th aria-label="Rally '+(c+1)+'"></th>';h+='</tr></thead><tbody>';var roleServer=pickleball()?state.initialServer:state.server,roleCourt=state.positions[teamOf(state.server)].indexOf(state.server),roleReceiver=pickleball()?state.initialReceiver:state.positions[1-teamOf(state.server)][roleCourt];for(var p=0;p<4;p++){var role=p===roleServer?'S':(p===roleReceiver?'R':'');var roleCls=role==='S'?' is-server':(role==='R'?' is-receiver':'');h+='<tr id="scsScoreRow'+p+'" class="'+(p<2?'team-a':'team-b')+'"><th><span>'+escapeHtml(state.names[p])+'</span><i>'+(pickleball()?'🏓':'🏸')+'</i><em></em></th><td class="scs-score-role-cell'+roleCls+(locked?' is-locked':'')+'"'+(locked?'':' onclick="SCSScoring.setInitialRole('+p+')"')+'>'+(role?'<span>'+role+'</span>':'')+'</td>';for(var c=0;c<cols;c++){var e=state.entries[c],v=(e&&e.player===p)?(e.event==='side-out'?'SO':e.event==='second-server'?'S2':String(e.score)):'';h+='<td class="'+(v?'has-score':'')+'">'+v+'</td>';}h+='</tr>';}h+='</tbody>';table.innerHTML=h;}
function escapeHtml(s){return String(s).replace(/[&<>\"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]})}
function completedSetText(){return state.completedSets.map(function(x){return gameWord()+' '+x.set+' '+x.score[0]+'–'+x.score[1];}).join(' · ');}
function selectCompletedSet(n,initial){if(!readOnly||!state)return;var x=state.completedSets.find(function(s){return Number(s.set)===Number(n);});if(!x)return;readOnlySet=Number(n);state.score=Array.isArray(x.score)?x.score.slice():[0,0];state.entries=Array.isArray(x.entries)?x.entries.map(function(e){return Object.assign({},e);}):[];if(Number.isInteger(x.server))state.server=x.server;if(x.serverNumber)state.serverNumber=x.serverNumber;if(Number.isInteger(x.initialServer))state.initialServer=x.initialServer;if(Number.isInteger(x.initialReceiver))state.initialReceiver=x.initialReceiver;if(Array.isArray(x.positions))state.positions=x.positions.map(function(p){return p.slice();});if(initial)render(false);else render(false);}
function renderSetScores(){var box=el('scsScoreSetScores');if(!box)return;if(!state||state.matchSets!==3){if(teamEditMatchId&&state&&state.completedSets.length){var one=state.completedSets[0];box.hidden=false;box.innerHTML='<strong>'+gameWord()+' 1 · Tap to correct</strong><div><button type="button" class="scs-score-set-score" onclick="SCSScoring.editSavedSet(1)">'+one.score.join(' – ')+'</button></div>';}else{box.hidden=true;box.innerHTML='';}return;}var done={};state.completedSets.forEach(function(x){done[x.set]=x.score;});var cards='';for(var i=1;i<=3;i++){var score=done[i]||(i===state.currentSet?state.score:[0,0]);var active=!state.finished&&i===state.currentSet;cards+='<div class="scs-score-set-score'+(active?' is-active':'')+(readOnly&&readOnlySet===i?' is-viewing':'')+'"'+(readOnly&&done[i]?' role="button" tabindex="0" onclick="SCSScoring.'+'selectCompletedSet('+i+')"':'')+'><span>'+gameWord()+' '+i+'</span><strong>'+score[0]+' – '+score[1]+'</strong></div>';}if(teamEditMatchId){cards+='<button type="button" class="scs-score-set-score" onclick="SCSScoring.editSavedSet('+readOnlySet+')" aria-label="Correct selected set score">Correct '+gameWord()+' '+readOnlySet+'</button>';}
box.innerHTML='<strong>'+gameWord()+' Scores <small>(Best of 3)</small></strong><div>'+cards+'</div>';box.hidden=false;}
function renderPickleballCards(){
 var host=el('scsPickleballCards');if(!host)return;
 host.hidden=!pickleball();if(!pickleball())return;
 var serving=teamOf(state.server),court=state.positions[serving][0]===state.server?'Right':'Left';
 el('scsPickleballGame').textContent='PICKLEBALL · GAME '+(readOnly?readOnlySet:state.currentSet)+' OF '+state.matchSets;
 [0,1].forEach(function(team){
  var active=team===serving,card=el(team===0?'scsPickleballCardA':'scsPickleballCardB'),button=el(team===0?'scsPickleballWinA':'scsPickleballWinB');
  card.classList.toggle('is-serving',active);
  card.setAttribute('aria-label','Team '+(team===0?'A':'B')+(active?', serving':', receiving'));
  card.innerHTML='<span class="scs-pb-role">'+(active?'SERVING':'RECEIVING')+'</span><h3>'+escapeHtml(state.names[team*2])+'<br>'+escapeHtml(state.names[team*2+1])+'</h3><strong class="scs-pb-score '+(active?'is-call':'')+'">'+(active?SCSPickleballScoring.call(state):state.score[team])+'</strong><span class="scs-pb-score-caption">'+(active?'Us · Them · Server':'Team points')+'</span><p class="scs-pb-server-name">'+(active?escapeHtml(state.names[state.server])+' · '+court+' court':'')+'</p>';
  button.hidden=readOnly;button.disabled=state.finished;
  button.setAttribute('aria-label','Rally won by '+state.names[team*2]+' and '+state.names[team*2+1]);
 });
 el('scsPickleballCall').textContent=(serving===0?'Team A':'Team B')+' serving. '+state.names[state.server]+', '+court+' court. Score call '+SCSPickleballScoring.call(state);
}
function render(autoScroll){if(!state)return;
 let done=el('scsScoreViewDone');if(!done){done=document.createElement('button');done.id='scsScoreViewDone';done.type='button';done.textContent='✓ Done';done.setAttribute('aria-label','Done viewing score');done.onclick=close;el('scsScoringOverlay').appendChild(done);}done.hidden=!readOnly;
renderRuleEditButton();renderInitialServiceChoice();renderPickleballCards();var actions=document.querySelector('.scs-score-side-actions');if(actions)actions.classList.toggle('portrait-reverse',state.buttonOrder==='ba');var addA=el('scsScoreAddA'),addB=el('scsScoreAddB');if(addA){addA.innerHTML='<span>'+escapeHtml(state.names[0])+'<br>'+escapeHtml(state.names[1])+'</span><strong>'+state.score[0]+'</strong><b>'+(pickleball()?'Won rally':'+')+'</b>';addA.setAttribute('aria-label',(pickleball()?'Rally won by ':'Add point for ')+state.names[0]+' and '+state.names[1]);}if(addB){addB.innerHTML='<span>'+escapeHtml(state.names[2])+'<br>'+escapeHtml(state.names[3])+'</span><strong>'+state.score[1]+'</strong><b>'+(pickleball()?'Won rally':'+')+'</b>';addB.setAttribute('aria-label',(pickleball()?'Rally won by ':'Add point for ')+state.names[2]+' and '+state.names[3]);}buildTable();renderSetScores();var server=state.server,court=state.positions[teamOf(server)][0]===server?'Right':'Left';var serverEl=el('scsScoreServer');if(serverEl)serverEl.textContent=state.names[server]+' · '+court+' court'+(pickleball()?' · Server '+state.serverNumber+' · Score call '+SCSPickleballScoring.call(state):'');for(var i=0;i<4;i++){var row=el('scsScoreRow'+i);row.classList.toggle('is-server',i===server);var em=row.querySelector('em');if(em)em.textContent=i===server?('SERVING · '+court.toUpperCase()+(pickleball()?' · SERVER '+state.serverNumber:'')):'';}var undoButton=el('scsScoreUndo'),undoControls=undoButton&&undoButton.closest('.scs-score-controls');if(undoControls)undoControls.hidden=readOnly;if(undoButton){undoButton.textContent=pickleball()?'↶ Undo last rally':'↶ Undo last point';undoButton.hidden=readOnly;undoButton.disabled=readOnly||!state.history.length;}addA.disabled=state.finished;addB.disabled=state.finished;var status=el('scsScoreStatus'),sets=completedSetText();if(status){if(state.finished){var mw=state.setWins[0]>state.setWins[1]?0:1;status.textContent=(mw===0?state.names[0]+' / '+state.names[1]:state.names[2]+' / '+state.names[3])+' wins'+(sets?' · '+sets:'');status.classList.add('is-finished');}else{var sr=state.setRules[state.currentSet-1];status.textContent=(sets?sets+' · ':'')+(state.matchSets===3?gameWord()+' '+state.currentSet+' · ':'1 '+gameWord()+' · ')+'First to '+sr.win+(sr.max===sr.win?'':(' · Win by 2'+(pickleball()?' · No cap':' · Max '+sr.max)));status.classList.remove('is-finished');}}var send=el('scsScoreSendResult');if(send){var canSave=standaloneMode?(!readOnly&&state.finished):(teamEditMatchId?scoreEditDirty:(state.finished&&!!liveMatch&&!readOnly));
send.hidden=false;
send.disabled=false;
send.onclick=canSave?sendResult:close;
send.textContent=canSave?'Save & Close':'Close';}if(autoScroll&&state.entries.length&&(!pickleball()||el('scsScoreRallyHistory').open)){requestAnimationFrame(function(){var w=el('scsScoreTableWrap'),cells=w.querySelectorAll('thead th'),target=cells[state.entries.length+1];if(target)target.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});});}}
window.SCSScoring={openRuleEditor:openRuleEditor,applyRuleOverride:applyRuleOverride,workspace:function(){return scoringWorkspace;},open:open,openHistory:openHistory,selectTab:selectPickerTab,newStandalone:newStandalone,refresh:function(){if(!el('scsScoreMatchPicker').hidden)return openPicker();},openStandalone:openStandalone,openStandaloneHistory:openStandaloneHistory,openConduct:openConduct,openGroupMatch:openGroupMatch,openCompleted:openCompleted,openTeamCompleted:openTeamCompleted,openEditableCompleted:openEditableCompleted,editSavedSet:editSavedSet,selectCompletedSet:selectCompletedSet,close:close,start:start,refreshSetupNames:refreshSetupNames,playerChanged:playerChanged,setInitialRole:setInitialRole,chooseServingTeam:chooseServingTeam,addPoint:addPoint,undo:undo,swapButtons:swapButtons,matchFormatChanged:matchFormatChanged,sendResult:sendResult,retryTournamentHistory:retryTournamentHistory};
})();
