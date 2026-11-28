(function(){
'use strict';
var DB='scs-standalone-score-v1',STORE='matches';
function database(){return new Promise(function(resolve,reject){
 var request=indexedDB.open(DB,1);
 request.onupgradeneeded=function(){var db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};
 request.onsuccess=function(){resolve(request.result);};request.onerror=function(){reject(request.error);};
});}
async function transact(mode,action){var db=await database();return new Promise(function(resolve,reject){
 var tx=db.transaction(STORE,mode),store=tx.objectStore(STORE),request=action(store);
 request.onerror=function(){reject(request.error);};
 tx.oncomplete=function(){resolve(request.result);db.close();};tx.onabort=function(){reject(tx.error||new Error('Local history save was interrupted'));db.close();};
});}
function clubId(){if(window.SCSSportContext?.appModule==='scoreboard')return (typeof getMyClub==='function'?getMyClub()?.id:'')||'';return localStorage.getItem('kbrr_org_club_id')||localStorage.getItem('kbrr_my_club_id')||'';}
async function save(score){if(!score||!score.finished)throw Error('Match not completed');
 var record={id:crypto.randomUUID(),clubId:clubId(),createdAt:new Date().toISOString(),score:score};
 await transact('readwrite',function(s){return s.put(record);});return record;
}
async function saveTournament(score,match,delivery){
 if(!score?.finished||!match)throw Error('Match not completed');
 const ref=match.remoteTournament;
 const source=match.remoteMatch?['live-match',match.remoteMatch.id]:ref?['cloud-tournament',ref.id,ref.matchId]:[match.sessionId,match.groupId||match.game?.ccid||match.game?.tournament_match||match.matchNo||'',match.round||1];
 const club=ref?.clubId||clubId();
 const id='tournament:'+JSON.stringify([club,source,match.pair1||[],match.pair2||[]]);
 const previous=await transact('readonly',s=>s.get(id));
 const record={id,clubId:club,createdAt:previous?.createdAt||new Date().toISOString(),score:Object.assign({},score,{matchTitle:match.matchNo||'Tournament match',tournamentMatch:true,tournamentSource:source,tournamentDelivery:delivery||'pending'})};
 await transact('readwrite',s=>s.put(record));return record;
}
function escape(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

// The existing scoreboard still reads its original four selects. These lightweight
// standalone-only name fields feed those selects without changing tournament setup.
function setGenderButton(btn,g){
 btn.dataset.gender=g;
 btn.innerHTML=g==='Male'?'<img src="male.png" alt="Male">':g==='Female'?'<img src="female.png" alt="Female">':'<span aria-hidden="true">◯</span>';
 btn.className='scs-standalone-gender'+(g==='Male'?' is-male':g==='Female'?' is-female':'');
 btn.title='Gender: '+(g||'unspecified');
 btn.setAttribute('aria-label','Gender: '+(g||'unspecified')+'. Tap to change');
}
function prepareSetup(){
 var setup=document.getElementById('scsScoreSetup');if(!setup)return;
 var heading=setup.querySelector('h2');if(heading)heading.textContent='New Match';
 var desc=setup.querySelector('p');if(desc)desc.textContent='Enter a name or select a club player.';
 var title=document.getElementById('scsStandaloneMatchTitle');
 if(!title){
  var label=document.createElement('label');label.className='scs-standalone-title-input';
  label.innerHTML='<span>Match Title</span><input id="scsStandaloneMatchTitle" type="text" maxlength="100" placeholder="Friendly Match">';
  setup.insertBefore(label,setup.querySelector('.scs-score-team-card'));
  title=label.querySelector('input');
 }
 title.parentElement.hidden=false;title.value='';
 var data=document.getElementById('scsStandalonePlayerOptions');
 if(!data){data=document.createElement('datalist');data.id='scsStandalonePlayerOptions';setup.appendChild(data);}
 data.replaceChildren();
 var first=document.getElementById('scsScoreP1');
 Array.from(first.options).filter(function(o){return o.value;}).forEach(function(o){var option=document.createElement('option');option.value=o.textContent.trim();data.appendChild(option);});
 for(var i=0;i<4;i++){
  var select=document.getElementById('scsScoreP'+(i+1));
  var row=document.getElementById('scsStandalonePlayerRow'+i);
  if(!row){row=document.createElement('div');row.className='scs-standalone-player-row';row.id='scsStandalonePlayerRow'+i;
   row.innerHTML='<input type="text" maxlength="80" list="scsStandalonePlayerOptions" placeholder="Enter or select player" aria-label="Player '+(i+1)+'"><button type="button" class="scs-standalone-gender" aria-label="Toggle gender" title="Gender: unspecified">◯</button>';
   select.insertAdjacentElement('afterend',row);
   row.querySelector('button').addEventListener('click',function(){var btn=this,g=btn.dataset.gender||'';g=g===''?'Male':g==='Male'?'Female':'';setGenderButton(btn,g);});
  }
  select.hidden=true;row.hidden=false;
  row.querySelector('input').value='';var btn=row.querySelector('button');setGenderButton(btn,'');
  row.querySelector('input').onchange=function(){var val=this.value.trim(),select=this.parentElement.previousElementSibling;var match=Array.from(select.options).find(function(o){return o.value&&o.textContent.trim().toLowerCase()===val.toLowerCase();});var button=this.parentElement.querySelector('button');if(match){var players=window.SCSStandaloneClubPlayers||[];var p=players.find(function(x){return String(x.name||'').toLowerCase()===val.toLowerCase();});if(p){var gender=String(p.gender||'');setGenderButton(button,gender==='Male'||gender==='Female'?gender:'');}}};
 }
 var start=setup.querySelector('.scs-score-start-btn');if(start)start.disabled=false;
}
function collectSetup(){
 var title=document.getElementById('scsStandaloneMatchTitle');var names=[],genders=[];
 for(var i=0;i<4;i++){
  var row=document.getElementById('scsStandalonePlayerRow'+i),name=row&&row.querySelector('input').value.trim();
  if(!name)return null;names.push(name);genders.push(row.querySelector('button').dataset.gender||'');
 }
 if(new Set(names.map(function(n){return n.toLocaleLowerCase();})).size!==4)return null;
 for(var j=0;j<4;j++){
  var select=document.getElementById('scsScoreP'+(j+1));var existing=Array.from(select.options).find(function(o){return o.value&&o.textContent.trim().toLocaleLowerCase()===names[j].toLocaleLowerCase();});
  if(existing){select.value=existing.value;}else{var option=document.createElement('option');option.value='standalone-guest-'+j;option.textContent=names[j];select.appendChild(option);select.value=option.value;}
 }
 return {title:(title&&title.value.trim())||'Friendly Match',genders:genders};
}
function resetSetup(){for(var i=0;i<4;i++){var sel=document.getElementById('scsScoreP'+(i+1));if(sel)sel.hidden=false;var row=document.getElementById('scsStandalonePlayerRow'+i);if(row)row.hidden=true;}var title=document.getElementById('scsStandaloneMatchTitle');if(title)title.parentElement.hidden=true;}

var previousTitle=null;
function show(){return SCSScoring.openHistory();}
async function renderHistory(list,onView,isCurrent){
 var selectedClub=clubId();
 function view(score){if(!isCurrent||isCurrent())onView(score);}
 list.textContent='Loading saved matches…';
 try{
 var rows=await transact('readonly',function(s){return s.getAll();});
 if(isCurrent&&!isCurrent())return;
 rows=rows.filter(function(r){return r.clubId===selectedClub;}).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);});
 if(!rows.length){list.innerHTML='<p class="scs-score-picker-empty">No saved matches on this device.</p>';return;}
 list.innerHTML='';
 let approvals=new Map();try{approvals=await Promise.race([window.SCSTournamentScores?.historyApprovals(rows.map(r=>r.score)),new Promise(resolve=>setTimeout(()=>resolve(new Map()),1200))])||approvals;}catch(_){}
 if(isCurrent&&!isCurrent())return;
 rows.forEach(function(r){
  var score=r.score,n=score.names||[],sets=score.completedSets||[],wins=score.setWins||[0,0],winner=wins[0]>wins[1]?'left':'right';
  var summary=sets.map(function(x){return (x.score||[]).join('–');}).join(' | ');
  var card=document.createElement('div');
  if(window.SCSSharedMatchCenter&&SCSSharedMatchCenter.completed){
   card.innerHTML=SCSSharedMatchCenter.completed({number:'',title:(score.sport==='pickleball'?'Pickleball':'Badminton')+' · '+(score.matchTitle||'Friendly Match')+' · '+new Date(r.createdAt).toLocaleString(),left:n.slice(0,2).join(' / '),right:n.slice(2,4).join(' / '),leftPlayers:n.slice(0,2),rightPlayers:n.slice(2,4),score:summary,winner:winner,playerRenderer:function(name){var i=n.indexOf(name),gender=(score.playerGenders||[])[i]||'',icon=gender==='Male'?'male.png':gender==='Female'?'female.png':'';return '<span class="scs-tm-shared-player">'+(icon?'<img class="scs-standalone-gender-icon" src="'+icon+'" alt="'+gender+'">':'<span class="scs-standalone-neutral-icon">◯</span>')+'<span class="scs-tm-shared-name">'+escape(name)+'</span></span>';},action:'data-scs-standalone-view="1"',actionLabel:'View Score',actionClass:'scs-standalone-view'});
   var b=card.querySelector('[data-scs-standalone-view]');
   if(b)b.addEventListener('click',function(){view(score);});
   else card.addEventListener('click',function(){view(score);});
  }else{
   card.className='scs-score-live-match';
   card.innerHTML='<small>'+(score.sport==='pickleball'?'Pickleball':'Badminton')+'</small><strong>'+escape(n.slice(0,2).join(' / '))+' vs '+escape(n.slice(2,4).join(' / '))+'</strong><p>'+escape(summary)+'</p><button type="button">View Score</button>';
   card.querySelector('button').addEventListener('click',function(){view(score);});
  }
  if(score.tournamentMatch&&score.tournamentSource){
   const retry=document.createElement('button');retry.type='button';retry.className='scs-score-start-btn';retry.textContent='Submit again';
   const message=document.createElement('p');message.setAttribute('role','status');const approved=approvals.get(JSON.stringify(score.tournamentSource));message.textContent=approved?'Approved by tournament':score.tournamentDelivery==='sent'?'Sent to tournament · Awaiting approval':'Saved on this device · Submit to tournament';
   retry.onclick=async()=>{retry.disabled=true;message.textContent='Sending saved result…';try{const result=await SCSScoring.retryTournamentHistory(score);message.textContent=result?.approved?'Approved by tournament · Result unchanged':'Sent to tournament · Awaiting approval';if(result?.approved)retry.remove();else retry.disabled=false;}catch(error){message.textContent=error.message;retry.disabled=false;}};
   card.append(message);if(!approved)card.append(retry);
  }
  list.appendChild(card);
 });
 }catch(e){console.error(e);if(!isCurrent||isCurrent())list.textContent='Could not read local match history. Tap Refresh to retry.';}
}
function newMatch(){document.getElementById('scsStandalonePage').hidden=true;SCSScoring.openStandalone();}
function close(){
 var page=document.getElementById('scsStandalonePage');if(page)page.hidden=true;
 var title=document.getElementById('scsPracticeSharedTitle');
 if(title&&previousTitle!==null&&title.textContent==='Score a Match')title.textContent=previousTitle;
 previousTitle=null;
}
window.SCSStandalone={show:show,renderHistory:renderHistory,save:save,saveTournament:saveTournament,newMatch:newMatch,close:close,prepareSetup:prepareSetup,collectSetup:collectSetup,resetSetup:resetSetup};
})();