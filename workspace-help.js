/* V862: workspace-specific Help, using the existing screens and Round guide. */
(function(){
'use strict';
const guides={
 scoreboardHome:{title:'Scoreboard Help',steps:['Choose Badminton or Pickleball.','Select your club to score its live round or tournament matches, or leave Club empty for a match with manually entered names.','Tap Open Scoreboard, then choose a live match or Standalone Match. Use Refresh to load newly started matches.','Review the scoring rules, start scoring, and tap the team that wins the rally. Use Undo to correct the last rally.','Finish and send tournament results to the server. Completed tournament and standalone scores are also saved in History on the scoring device.','Open a saved score from History and tap Done to return.'],action:'Open Scoreboard',run:()=>window.SCSScoreboardApp.open()},

 slotPayment:{title:'Slot to Payment Guide',flow:[
 {title:'Post Slot',who:'Club manager',text:'Open Slot Manager and add a slot. Set the date, time, courts and available places, then save or publish it for club players.'},
 {title:'Players Book',who:'Club players',text:'Open My Slots or New Posted Slots, choose the club session and book a place. Club players book directly; booking approval is not required.'},
 {title:'Run Session & Rounds',who:'Session organiser',text:'Open the booked slot session in Round Manager, check the attending players and courts, then start rounds. Complete rounds as games finish.'},
 {title:'End Session & Calculate Costs',who:'Session organiser',text:'End the session using the existing End action. Review the session and cost details, enter the applicable costs and save them so players can check the amount due.'},
 {title:'Players Pay',who:'Club players',text:'Check the session amount and pay using the method agreed with your club. The guide does not collect or transfer money. Use the existing Mark Paid action to record payment when appropriate.'},
 {title:'Confirm Payment',who:'Club manager',text:'Open the completed slot and review its players and Paid / Not Paid indicators. After checking receipt, update the player payment status using the existing payment control. The app records Paid status; there is no separate bank verification step.'}
 ],action:'Open Slots',run:()=>window.scsRoleMenuNavigate('slots')},

 scoreboard:{title:'Scoreboard Guide',steps:['Follow the highlighted controls to open Score a Match and choose Standalone Match.','Review the scoring format, then start a practice scoreboard.','Add one practice point and undo it. The guide does not finish or save a match.','The guide waits for your clicks. Press Escape to stop.'],action:'Start Guide',run:()=>window.SCSScoreboardGuide?.startFromWorkspace()},
 join:{title:'Join a Club',steps:['Open My Club and search for your club.','Select the club and send a join request.','Your club manager approves the request before member access becomes available.'],action:'Open My Club',run:()=>window.scsRoleMenuNavigate('clubs')},
 round:{title:'Round Manager',steps:['Follow the highlighted controls in Round Manager.','Choose Normal Mode to select registered players, or Quick Mode to enter player counts.','Choose the format and courts, generate if using Quick Mode, then start rounds.','The guide waits for your clicks. Press Escape to stop.'],action:'Start Guide',run:()=>{if(!(frontPage?window.SCSRoundGuide.replay():window.SCSRoundGuide.startFromWorkspace()))window.alert('Finish the current round session before starting the guide.');}},
 register:{title:'Register Players',steps:['Open Players Manager and choose Register / Add Player.','Enter the player details and choose the correct gender.','Save the player, or use the existing import option to register several players.'],action:'Open Players Manager',run:()=>role()==='tournament'?window.scsTournamentManagerPlayers():window.scsRoleMenuNavigate('players')},
 slot:{title:'Slot Manager',steps:['Open Slot Manager and choose Add Slot.','Choose the date, time and courts, then review the player and booking settings.','Save or publish the slot when ready.'],action:'Open Slot Manager',run:()=>window.scsRoleMenuNavigate('slots')},
 knockout:{title:'Knockout Event',steps:['Follow the highlighted controls to choose a tournament and add a Knockout event.','Select players, form teams, confirm the pattern and generate fixtures.','Review the event settings, then start the event. The guide waits for each action.'],action:'Start Guide',run:()=>window.SCSKnockoutGuide?.start()},
 group:{title:'Group Stage + Knockout Event',steps:['Open My Tournaments and create or open a tournament.','Add an event and choose Group Stage + Knockout.','Select players and teams, set the number of groups, then review the calculated teams per group.','Assign teams to groups and confirm the setup.','Review sets, points and courts under Event, then start. Use Group and Knockout under Draw & Results to follow progress.'],action:'Open My Tournaments',run:()=>window.scsTournamentManagerMyTournaments()}
};
const catalog={member:['join','round','scoreboard','slotPayment'],manager:['register','round','slot','slotPayment'],tournament:['register','knockout','group']};
let dialog,content,back,launcher,frontPage=false;
function role(){return window.SCSRoleWorkspaces?.current?.()||document.body.dataset.scsRoleWorkspace||'member';}
function close(){dialog?.close();if(launcher?.isConnected)launcher.focus();}
function el(tag,text){const node=document.createElement(tag);if(text)node.textContent=text;return node;}
function list(){back.hidden=true;content.replaceChildren();for(const id of (frontPage?['round']:(catalog[role()]||catalog.member))){const button=el('button',guides[id].title+'  ›');button.type='button';button.className='scs-help-row';button.onclick=()=>detail(id);content.append(button);}content.querySelector('button')?.focus();}
function detail(id){const guide=guides[id];back.hidden=false;content.replaceChildren();content.append(el('h3',guide.title));const steps=el('ol');
if(guide.flow){steps.className='scs-help-flow';steps.setAttribute('aria-label','Slot posting to payment confirmation');guide.flow.forEach((step,index)=>{const item=el('li');const expand=el('details');const summary=el('summary');summary.append(el('span',String(index+1)),el('strong',step.title));expand.append(summary,el('small',step.who),el('p',step.text));item.append(expand);steps.append(item);});}
else guide.steps.forEach(text=>steps.append(el('li',text)));
content.append(steps);const action=el('button',guide.action);action.type='button';action.className='scs-help-action';action.onclick=()=>{close();document.querySelectorAll('#scsPracticeSharedHeader details[open]').forEach(e=>e.open=false);guide.run();};content.append(action);action.focus();}
function init(){
 const style=el('style');style.textContent=`
 .scs-workspace-help{flex:0 0 44px!important;width:44px!important;min-width:44px!important;min-height:44px;border:0!important;background:transparent!important;color:#86e2e7!important;font:700 22px/1 system-ui!important;border-radius:50%!important;padding:0!important;cursor:pointer}
 .scs-workspace-help[hidden]{display:none!important}
 .scs-workspace-help:focus-visible{outline:2px solid #66e2e7;outline-offset:2px}
 #scsWorkspaceHelp{box-sizing:border-box;width:calc(100% - 40px);max-width:440px;max-height:80dvh;padding:22px;color:#edf3ff;background:#101e30;border:1px solid #415775;border-radius:18px;font:16px/1.5 system-ui;overflow:auto}
 #scsWorkspaceHelp::backdrop{background:#0009}
 #scsWorkspaceHelp header{display:flex;align-items:center;gap:12px;margin-bottom:16px}
 #scsWorkspaceHelp h2{margin:0;flex:1;font-size:22px}#scsWorkspaceHelp h3{margin:0 0 16px;font-size:19px}
 #scsWorkspaceHelp header button{background:transparent;border:0;color:#a8dbe5;min-width:44px;min-height:44px;font-size:24px;cursor:pointer}
 #scsWorkspaceHelp .scs-help-row{display:block;width:100%;text-align:left;background:transparent;color:inherit;border:0;border-bottom:1px solid #34455c;border-radius:0;padding:18px 0;font:600 16px/1.5 system-ui;cursor:pointer}
 #scsWorkspaceHelp ol{padding-left:22px}#scsWorkspaceHelp li{margin-bottom:14px;color:#c5d2e5}
 #scsWorkspaceHelp .scs-help-action{width:100%;padding:14px;border:1px solid #4e9cfa;border-radius:10px;background:#2067c4;color:white;font:600 16px system-ui;cursor:pointer}
 @media(max-width:380px){#scsTournamentPersistentHeader>span{gap:2px!important}#scsTournamentPersistentHeader .scs-workspace-help{flex-basis:36px!important;width:36px!important;min-width:36px!important}}
 `;document.head.append(style);
 dialog=el('dialog');dialog.id='scsWorkspaceHelp';dialog.setAttribute('aria-labelledby','scsWorkspaceHelpTitle');const head=el('header');back=el('button','‹');back.type='button';back.setAttribute('aria-label','Back to guides');back.onclick=list;const title=el('h2','Help');title.id='scsWorkspaceHelpTitle';const done=el('button','×');done.type='button';done.setAttribute('aria-label','Close Help');done.onclick=close;head.append(back,title,done);content=el('div');dialog.append(head,content);document.body.append(dialog);dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
}
window.SCSWorkspaceHelp=Object.freeze({openGuide(id,button){if(!guides[id])return;if(!dialog)init();launcher=button;frontPage=false;window.SCSRoundGuide?.stop();window.SCSScoreboardGuide?.stop();window.SCSKnockoutGuide?.stop();if(!dialog.open)dialog.showModal();detail(id);},open(button){if(!dialog)init();launcher=button;frontPage=button?.id==='scsRoundGuideInfo';window.SCSRoundGuide?.stop();window.SCSScoreboardGuide?.stop();window.SCSKnockoutGuide?.stop();if(!dialog.open)dialog.showModal();list();},close});
})();
