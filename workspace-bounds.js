/* V949: tournament workspaces and their dialogs end above fixed navigation. */
(function(){
 'use strict';
 const roots='#scsTournamentOverlay,#scsGroupTournament,#scsTeamTournament,#scsTournamentManager,#scsTournamentContinue,#scsTournamentTypePicker,#scsTournamentLive';
 const bars='.scs-tm-bottom-nav,.scs-tmgr-bottom-nav';
 let frame=0;
 const observed=new WeakSet(),resize=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
 function visible(el){if(!el||el.hidden||!el.getClientRects().length)return false;const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden';}
 function watch(el){if(el&&resize&&!observed.has(el)){observed.add(el);resize.observe(el);}}
 function set(el,key,value){const next=Math.round(value)+'px';if(el.style.getPropertyValue(key)!==next)el.style.setProperty(key,next);}
 function refresh(){
  frame=0;const viewport=window.visualViewport;
  const screenBottom=Math.min(innerHeight,viewport?viewport.offsetTop+viewport.height:innerHeight);
  let top=viewport?.offsetTop||0;
  document.querySelectorAll('#scsTournamentPersistentHeader,#scsPracticeSharedHeader').forEach(header=>{watch(header);if(visible(header))top=Math.max(top,header.getBoundingClientRect().bottom);});
  let globalBottom=innerHeight-screenBottom;
  document.querySelectorAll(roots).forEach(root=>{
   if(!visible(root))return;
   if(root.matches('#scsTournamentOverlay,#scsGroupTournament,#scsTeamTournament')){
    let content=root.querySelector(':scope > [data-scs-workspace-content]');
    if(!content){content=document.createElement('div');content.dataset.scsWorkspaceContent='';root.prepend(content);}
    // Keep the same navigation nodes/handlers outside the clipped scrolling pane.
    for(const child of Array.from(root.children)){
     if(child===content||child.matches(bars)||getComputedStyle(child).position==='fixed')continue;
     content.append(child);
    }
    if(!root.classList.contains('scs-workspace-shell'))root.classList.add('scs-workspace-shell');
   }
   let edge=screenBottom;
   root.querySelectorAll(bars).forEach(bar=>{watch(bar);if(visible(bar)&&getComputedStyle(bar).position==='fixed')edge=Math.min(edge,bar.getBoundingClientRect().top);});
   const bottom=Math.max(0,innerHeight-edge);globalBottom=Math.max(globalBottom,bottom);
   set(root,'--scs-workspace-bottom',bottom);set(root,'--scs-workspace-top',top);
   // Content coordinates are relative to a full-viewport shell, never a legacy header offset.
   if(root.classList.contains('scs-workspace-shell')){for(const [key,value] of [['top','0px'],['left','0px'],['right','0px']])if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value,'important');}
   const content=root.querySelector(':scope > [data-scs-workspace-content]');if(content){watch(content);set(content,'top',top);}
   if(!root.hasAttribute('data-scs-workspace-bounded'))root.setAttribute('data-scs-workspace-bounded','');
  });
  set(document.documentElement,'--scs-workspace-bottom',globalBottom);set(document.documentElement,'--scs-workspace-top',top);
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(refresh);}
 function init(){refresh();new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden']});window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);}
 window.SCSWorkspaceBounds=Object.freeze({refresh:schedule});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
