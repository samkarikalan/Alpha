/* V904: Member Home Help replaces the welcome block, with activity below. */
(function(){
 let timer;
 function render(){
  const home=document.getElementById('myHubHomeView');if(!home)return;
  let hints=document.getElementById('scsMemberEmptyGuides');
  if(!hints){
   hints=document.createElement('section');hints.id='scsMemberEmptyGuides';hints.hidden=true;hints.setAttribute('aria-label','Help');
   hints.innerHTML='<h2>Help</h2><button type="button" data-home-guide="round"><span aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="7" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m1-8a5 5 0 0 1 7 5v3"/></svg></span><span><strong>Round Manager Guide</strong><small>Learn to organise rounds</small></span><span aria-hidden="true">›</span></button>';
   hints.querySelectorAll('button').forEach(button=>button.onclick=()=>window.SCSWorkspaceHelp?.openGuide?.(button.dataset.homeGuide,button));
   const intro=home.querySelector('.scs-tmgr-simple-intro');
   if(intro)intro.replaceWith(hints);else home.insertBefore(hints,home.querySelector('.myhub-home-sections'));
   const saved=home.querySelector('[data-unfinished-rounds]');if(saved)hints.before(saved);
  }
  const countIds=['myHubNewSlotsCount','myHubTodaySlotsCount','myHubLiveCount','myHubApprovePlayersCount'];
  const activity=countIds.some(id=>{const node=document.getElementById(id),group=node?.closest('.myhub-home-group');return Number(node?.textContent)>0&&(!group?.hidden||id!=='myHubApprovePlayersCount');});
  const loading=Array.from(home.querySelectorAll('.myhub-home-list')).some(node=>/loading|checking|unable to load|failed to load/i.test(node.textContent));
  const empty=!activity&&!loading;
  hints.hidden=false;
  home.classList.toggle('scs-member-empty',empty);
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(render,30);}
 function init(){
  render();
  const home=document.getElementById('myHubHomeView');if(!home)return;
  const observer=new MutationObserver(schedule);
  home.querySelectorAll('.myhub-home-count,.myhub-home-list,[data-unfinished-rounds]').forEach(el=>observer.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']}));
  home.querySelectorAll('.myhub-home-group').forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['hidden']}));
  window.addEventListener('focus',schedule);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
