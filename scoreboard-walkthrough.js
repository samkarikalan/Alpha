/* Interactive Scoreboard guide on the real controls. It never finishes or saves a match. */
(function(){
'use strict';
const q=s=>document.querySelector(s);
const visible=e=>!!(e&&e.isConnected&&!e.closest('[hidden]')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
const find=s=>[...document.querySelectorAll(s)].find(visible)||null;
const menu='#scsPracticeSharedHeader .scs-phase1-ref-drawer';
const standalone=()=>[...document.querySelectorAll('#scsScoreMatchPicker button')].find(button=>visible(button)&&/standalone match/i.test(button.textContent||''))||null;
const pointControl=()=>find('#scsPickleballCards:not([hidden]) .scs-pb-rally')||find('.scs-score-side-actions #scsScoreAddA');
const steps=[
 {id:'menu',target:()=>find(menu+'>summary'),text:'Tap the side menu.',done:()=>!!q(menu)?.open},
 {id:'scoreboard',target:()=>find(menu+' button[onclick*="standalone-scoring"]'),text:'Tap Score a Match.',done:()=>visible(q('#scsScoreMatchPicker'))&&!q(menu)?.open},
 {id:'standalone',target:standalone,text:'Tap Standalone Match to practise without changing a live match.',done:()=>visible(q('#scsScoreSetup'))},
 {id:'format',target:()=>find('#scsScoreFormatDetails>summary'),text:'Open the scoring format. Review the sets, points and maximum score.',done:()=>!!q('#scsScoreFormatDetails')?.open},
 {id:'start',target:()=>find('#scsScoreSetup .scs-score-start-btn'),text:'Select players if available, then tap Start Scoring. Placeholder players are fine for this practice.',done:()=>visible(q('#scsScoreLive'))},
 {id:'point',target:pointControl,text:'Tap this team once to record a practice point.',done:()=>q('#scsScoreUndo')?.disabled===false},
 {id:'undo',target:()=>find('#scsScoreUndo'),text:'Tap Undo last point. This removes the practice point and completes the guide.',done:()=>q('#scsScoreUndo')?.disabled===true}
];
let active=false,index=0,clicked=false,target=null,ring=null,live=null,lastScrolled=null,raf=0;
function announce(text){if(live&&text&&live.textContent!==text)live.textContent=text;}
function stop(){active=false;target=null;ring?.remove();ring=null;if(live)live.textContent='';}
function finish(){stop();announce('Scoreboard guide completed. No score was saved.');window.dispatchEvent(new CustomEvent('scs-scoreboard-guide-complete'));}
function mount(){
 ring=document.createElement('div');ring.className='scs-round-guide-ring';ring.setAttribute('aria-hidden','true');document.body.append(ring);
 if(!live){live=document.createElement('span');live.className='scs-round-guide-live';live.setAttribute('role','status');live.setAttribute('aria-live','polite');document.body.append(live);}
}
function position(){
 if(!active||!ring)return;
 const step=steps[index];target=step.target();announce(typeof step.text==='function'?step.text():step.text);
 if(!target){ring.hidden=true;announce('Waiting for the next Score a Match screen.');return;}
 if(lastScrolled!==target){lastScrolled=target;target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});}
 const box=target.getBoundingClientRect();ring.hidden=false;Object.assign(ring.style,{left:Math.max(3,box.left-4)+'px',top:Math.max(3,box.top-4)+'px',width:Math.min(innerWidth-6,box.width+8)+'px',height:box.height+8+'px'});
}
function tick(){
 raf=0;if(!active)return;
 if(clicked&&steps[index].done()){index++;clicked=false;lastScrolled=null;if(index===steps.length){finish();return;}}
 position();
}
function schedule(){if(!raf)raf=requestAnimationFrame(tick);}
function startFromWorkspace(){
 stop();
 if(visible(q('#scsScoreLive'))){window.alert('Close the current scoreboard before starting the guide.');return false;}
 active=true;index=0;clicked=false;lastScrolled=null;mount();schedule();return true;
}
function onAction(event){
 if(!active)return;
 const current=steps[index].target();
 if(!current||current.disabled||!(current===event.target||current.contains(event.target)))return;
 clicked=true;setTimeout(schedule,0);
}
document.addEventListener('click',onAction,true);
document.addEventListener('change',onAction,true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active)stop();});
window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);
window.SCSScoreboardGuide=Object.freeze({startFromWorkspace,stop,state:()=>({active,step:active?steps[index].id:null})});
function init(){new MutationObserver(records=>{if(records.every(record=>record.target===ring||record.target===live))return;schedule();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style','class','open','disabled'],characterData:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
