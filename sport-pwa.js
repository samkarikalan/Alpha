/* V928: root welcome chooses a sport; each sport app owns its workspace. */
(function(){
 'use strict';
 function refresh(){
  const context=window.SCSSportContext,sport=context?.sport,name=sport==='pickleball'?'Pickleball':'Badminton';
  if(sport){
   const heading=document.getElementById('scsRoleChooserTitle');
   if(heading&&heading.textContent!=='Welcome to SCS '+name)heading.textContent='Welcome to SCS '+name;
   const subtitle=document.querySelector('.scs-role-brand>span');
   if(subtitle&&subtitle.textContent!==name+' Club Scheduler')subtitle.textContent=name+' Club Scheduler';
   const panel=document.querySelector('#joinClubPage .clubs-page-tabs');
   if(panel&&!document.getElementById('scsSportClubHelp')){
    const info=document.createElement('p');info.id='scsSportClubHelp';info.className='scs-sport-club-help';
    info.textContent='Showing '+name+' clubs only.';panel.after(info);
   }
  }else if(!context?.appModule||context.appModule==='shared'){
   const auth=document.getElementById('authWelcome');
   if(auth&&!document.getElementById('scsAuthSportAppLinks')){
    const nav=document.createElement('nav');nav.id='scsAuthSportAppLinks';nav.className='scs-sport-app-links';nav.setAttribute('aria-label','Choose an SCS app');
    for(const sport of ['badminton','pickleball','scoreboard','tournaments']){const a=document.createElement('a');a.href=new URL(sport+'/?sso=1',document.baseURI).href;a.dataset.sport=sport;a.textContent=sport==='badminton'?'Open Badminton app':sport==='pickleball'?'Open Pickleball app':sport==='scoreboard'?'Open Scoreboard app':'Open Tournaments app';nav.append(a);}
    const buttons=auth.querySelector('.auth-welcome-btns');if(buttons)buttons.before(nav);else auth.append(nav);
   }
   const host=document.querySelector('.scs-welcome-content');
   if(host&&!document.getElementById('scsSportChooserHelp')){
    const help=document.createElement('p');help.id='scsSportChooserHelp';help.className='scs-sport-chooser-help';help.textContent='Choose an app to get started.';
    host.querySelector('.scs-welcome-tagline')?.after(help);
   }
   if(host&&!document.getElementById('scsSportAppLinks')){
    const nav=document.createElement('nav');nav.id='scsSportAppLinks';nav.className='scs-sport-app-links';nav.setAttribute('aria-label','SCS apps');
    for(const sport of ['badminton','pickleball','scoreboard','tournaments']){const a=document.createElement('a');a.href=new URL(sport+'/?sso=1',document.baseURI).href;a.dataset.sport=sport;a.textContent=sport==='badminton'?'Open Badminton app':sport==='pickleball'?'Open Pickleball app':sport==='scoreboard'?'Open Scoreboard app':'Open Tournaments app';nav.append(a);}
    host.querySelector('.scs-role-sport-picker')?.after(nav);
   }
  }
 }
 function init(){refresh();new MutationObserver(refresh).observe(document.body,{subtree:true,childList:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
