/* V962: event court counts refer to exclusive physical courts in the parent pool. */
(function(){'use strict';
const contexts=new Set();
function current(c){return c.active&&c.root.isConnected&&c.root._scsEventCourtPool===c;}
function dispose(root){const c=root?._scsEventCourtPool;if(c){c.active=false;contexts.delete(c);}}

function ids(s){if(Array.isArray(s?.courtNumbers))return s.courtNumbers.slice();return Array.from({length:Math.max(0,Number(s?.courtCount??s?.numCourts)||0)},(_,i)=>i+1);}
async function call(body){const action=body.action==='get'||!window.SCSTournamentLocal?null:await SCSTournamentLocal.recordCourtAction(body);try{if(action)await SCSTournamentLocal.sync({parentsOnly:true});const user=typeof authGetUser==='function'?authGetUser():null;const res=await fetch(WORKER_URL+'/tournament/courts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,userAccountId:user?.id,sessionToken:typeof _getLocalToken==='function'?_getLocalToken():null})});const data=await res.json().catch(()=>({}));if(!res.ok){const error=Error(data.error||'Could not allocate courts');error.status=res.status;throw error;}if(action)await SCSTournamentLocal.finishCourtAction(action,data);return data;}catch(error){if(action)await SCSTournamentLocal.failCourtAction(action,error);throw error;}}

function connect(root,options){const parent=options.parent?.(),event=String(options.eventId||'');if(!root||!parent||!event||options.viewOnly)return;const ref=parent._scsCloudTournamentId||parent._scsClientTournamentId||parent.id;if(!ref)return;const key=String(ref)+':'+event;let c=root._scsEventCourtPool;
 if(c?.key===key&&c.active){c.options=options;if(!c.busy&&Array.isArray(options.state()?.courtNumbers))c.numbers=options.state().courtNumbers.slice();else if(c.ready&&!c.busy)queueMicrotask(()=>{if(current(c))c.options.onChange(c.numbers,{}).catch(error=>{c.error=error.message;notice(c);});});notice(c);return;}
 if(c){c.active=false;contexts.delete(c);}
 c={root,key,parentRef:ref,event,options,active:true,ready:false,busy:false,numbers:ids(options.state()),error:''};root._scsEventCourtPool=c;contexts.add(c);
 c.resize=async delta=>{if(c.busy)return;if(!c.ready){await ensure(c);if(!c.ready)return;}await update(c,'resize',Math.max(0,c.numbers.length+Number(delta)));};
 if(!root._scsEventCourtCapture){root._scsEventCourtCapture=true;root.addEventListener('click',e=>{const current=root._scsEventCourtPool;if(!current?.active)return;const b=e.target.closest('button');if(!b)return;let delta;
  if(b.hasAttribute('data-courts'))delta=b.dataset.courts;
  else if(b.hasAttribute('data-event-courts'))delta=b.dataset.eventCourts;
  else {const text=b.getAttribute('onclick')||'',m=text.match(/(?:setTournamentCourts|changeLiveCourts)\(\s*(-?\d+)/);if(m)delta=m[1];}
  if(delta!=null){e.preventDefault();e.stopImmediatePropagation();current.resize(delta);}
 },true);}
 c.loading=ensure(c);
}
function notice(c){if(!c.active||!c.root.isConnected)return;let n=c.root.querySelector('[data-event-court-pool-status]');if(!n){n=document.createElement('p');n.dataset.eventCourtPoolStatus='';n.setAttribute('role','status');n.className='scs-event-court-pool-status';const host=c.root.querySelector('[data-scs-workspace-content]')||c.root.querySelector('.scs-gt-sheet')||c.root;host.prepend(n);}
 n.hidden=!!(c.ready&&!c.error&&c.numbers.length);
 n.textContent=c.error||(!c.ready?'Loading tournament court allocation…':c.numbers.length?c.numbers.length+' courts available to this event':'No courts allocated. Use + to add a free tournament court.');
}
async function update(c,action,count){if(!current(c))return;c.busy=true;c.action=action;c.error='';notice(c);try{let data;try{data=await call({parentId:c.parentRef,eventId:c.event,action,count});}catch(error){if(error.status!==404)throw error;if(!current(c))return;const parent=c.options.parent();await SCSTournamentStore.save(c.options.format||'group',parent);c.parentRef=parent._scsCloudTournamentId||c.parentRef;data=await call({parentId:c.parentRef,eventId:c.event,action,count});}if(!current(c))return;if(!Array.isArray(data.courtNumbers)||!Number.isInteger(data.total)||data.courtNumbers.some(n=>!Number.isInteger(n)||n<1||n>data.total))throw Error('Court service returned an invalid allocation. Update the Worker and retry.');const changed=!c.ready||JSON.stringify(c.numbers)!==JSON.stringify(data.courtNumbers);c.numbers=data.courtNumbers;c.ready=true;const parent=c.options.parent();parent.courtCount=data.total;parent.courtAllocations=data.allocations;parent.courtPoolVersion=1;if(changed||action!=='get')await c.options.onChange(c.numbers,data);notice(c);}catch(error){if(c.active){c.error=error.message;notice(c);}}finally{c.busy=false;}}
async function ensure(c){const parent=c.options.parent?.(),known=Object.prototype.hasOwnProperty.call(parent?.courtAllocations||{},c.event);await update(c,known?'get':'ensure',Math.max(0,Number(c.options.state()?.courtCount??c.options.state()?.numCourts)||0));}
function ready(root){const c=root?._scsEventCourtPool;if(!c)return true;if(!c.ready||c.busy&&c.action!=='get'||!c.numbers.length){alert(c.error||'Allocate a free tournament court using + first.');return false;}return true;}
async function setTotal(parent,count){const ref=parent._scsCloudTournamentId||parent._scsClientTournamentId||parent.id;return call({parentId:ref,action:'set-total',count});}
setInterval(()=>{for(const c of contexts){if(!c.active||!c.root.isConnected){contexts.delete(c);continue;}if(c.ready&&!c.busy&&!c.root.hidden&&!document.hidden)update(c,'get',c.numbers.length);}},8000);
async function whenReady(root){
 // Knockout builds its navigation/court controller on the next animation frame.
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const c=root?._scsEventCourtPool;
 if(!c?.active)throw Error('Open the event and load its court allocation first.');
 await c.loading;
 if(!c.active||!c.ready||!c.numbers.length)throw Error(c.error||'Allocate a free tournament court to this event first.');
 return c.numbers.slice();
}
window.SCSEventCourtPool={connect,dispose,ids,ready,setTotal,whenReady};
})();
