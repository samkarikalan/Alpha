/* Shared court assignment and success confirmation for all tournament formats. */
(function(){'use strict';
let active=null,activeOnClose=null,confirmation=null,confirmationTimer=null;
function close(reason){if(active){const callback=activeOnClose;active.remove();active=null;activeOnClose=null;if(callback&&reason!=='replace')callback(reason||'cancel');}}
function clearConfirmation(){if(confirmationTimer){clearTimeout(confirmationTimer);confirmationTimer=null;}if(confirmation){confirmation.remove();confirmation=null;}}
function showConfirmation(title,court){
 clearConfirmation();
 const notice=document.createElement('div');notice.className='scs-court-confirmation';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 const panel=document.createElement('div');panel.className='scs-court-confirmation-panel';
 const mark=document.createElement('span');mark.className='scs-court-confirmation-check';mark.textContent='✓';mark.setAttribute('aria-hidden','true');
 const heading=document.createElement('strong');heading.textContent=(typeof t === 'function' ? t('scsCourtAssigned') : "Court Assigned!");
 const match=document.createElement('div');match.className='scs-court-confirmation-match';match.textContent=String(title||'Match');
 const location=document.createElement('div');location.className='scs-court-confirmation-location';location.textContent='Court '+court+' · Ready to start';
 const hint=document.createElement('div');hint.className='scs-court-confirmation-hint';hint.textContent=(typeof t === 'function' ? t('scsAvailableMatchCenter') : "Available in Match Center");
 panel.append(mark,heading,match,location,hint);notice.appendChild(panel);document.body.appendChild(notice);confirmation=notice;
 confirmationTimer=setTimeout(()=>{if(confirmation===notice)clearConfirmation()},1500);
}
function open(opts){
 close('replace');clearConfirmation();const o=opts||{},overlay=document.createElement('div');active=overlay;activeOnClose=o.onClose||null;
 overlay.className='scs-court-popup-overlay';overlay.setAttribute('role','presentation');
 const modal=document.createElement('section');modal.className='scs-court-popup';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Assign Court');
 const head=document.createElement('div');head.className='scs-court-popup-head';
 const h=document.createElement('h3');h.textContent=(typeof t === 'function' ? t('scsAssignCourt') : "Assign Court");head.appendChild(h);
 const x=document.createElement('button');x.type='button';x.textContent='×';x.setAttribute('aria-label','Close');x.onclick=()=>{if(!pending)close();};head.appendChild(x);modal.appendChild(head);
 const subtitle=document.createElement('p');subtitle.textContent=String(o.title||'');modal.appendChild(subtitle);
 // Optional organizer password controls. The trusted worker will provide the
 // load/save callbacks; never persist credentials in browser storage or match state.
 if(typeof o.loadScoringPassword==='function' && typeof o.saveScoringPassword==='function'){
  const section=document.createElement('div');section.className='scs-scoring-password-controls';
  const label=document.createElement('label');label.textContent='Match scoring password';
  const field=document.createElement('input');field.type='password';field.autocomplete='off';field.placeholder='Set scoring password';field.disabled=true;
  const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Show';toggle.onclick=()=>{field.type=field.type==='password'?'text':'password';toggle.textContent=field.type==='password'?'Show':'Hide'};
  const copy=document.createElement('button');copy.type='button';copy.textContent='Copy';copy.onclick=()=>{if(field.value&&navigator.clipboard?.writeText)navigator.clipboard.writeText(field.value)};
  const save=document.createElement('button');save.type='button';save.textContent='Save password';save.disabled=true;
  const status=document.createElement('small');status.setAttribute('role','status');status.textContent='Loading password…';
  const controls=document.createElement('div');controls.className='scs-scoring-password-buttons';controls.append(toggle,copy,save);
  field.minLength=4;field.maxLength=128;section.append(label,field,controls,status);modal.appendChild(section);
  Promise.resolve().then(()=>o.loadScoringPassword()).then(value=>{if(active!==overlay)return;field.value=String(value||'');field.disabled=false;save.disabled=false;status.textContent='Court assignment access · password can be changed';}).catch(error=>{if(active!==overlay)return;const message=error&&error.message;const hints={'Login required':'Sign in again to manage scoring passwords.','Club organizer access required':'Court assignment access is required to manage scoring passwords.','Invalid match':'Save and sync this tournament before setting a scoring password.','Tournament not found':'Tournament not found. Sync the tournament and try again.'};status.textContent=hints[message]||'Password service unavailable. Close and reopen to retry.';field.disabled=true;});
  save.onclick=async()=>{if(field.value.length<4){status.textContent='Enter a password with at least 4 characters';return;}save.disabled=true;status.textContent='Saving…';try{await o.saveScoringPassword(field.value);status.textContent='Password saved';}catch(e){status.textContent=e?.message||'Could not save password';}finally{save.disabled=false;}};
 }
 const choices=document.createElement('div');choices.className='scs-court-popup-choices';
 const errorStatus=document.createElement('p');errorStatus.setAttribute('role','alert');errorStatus.className='scs-court-assignment-error';modal.appendChild(errorStatus);let pending=false;
 (o.courts||[]).forEach(c=>{const b=document.createElement('button');b.type='button';b.className='scs-court-popup-option';b.disabled=!!c.occupied;b.textContent='Court '+c.number+' · '+(c.occupied?'Occupied':'Free');
 b.onclick=()=>{
  if(b.disabled||pending||active!==overlay)return;
  pending=true;errorStatus.textContent='';modal.setAttribute('aria-busy','true');choices.querySelectorAll('button').forEach(button=>button.disabled=true);
  const finish=ok=>{if(active!==overlay)return;if(ok!==false){close('assigned');showConfirmation(o.title,c.number)}else{pending=false;modal.removeAttribute('aria-busy');choices.querySelectorAll('button').forEach((button,i)=>{button.disabled=!!o.courts[i].occupied})}};
  try{const result=o.onChoose&&o.onChoose(c.number);if(result&&typeof result.then==='function')result.then(finish).catch(error=>{errorStatus.textContent=error?.message||'Could not assign this match. Please retry.';finish(false);});else finish(result)}catch(e){console.error('Court assignment failed:',e);errorStatus.textContent=e.message||'Could not assign this match.';finish(false)}
 };choices.appendChild(b)});
 modal.appendChild(choices);
 const cancel=document.createElement('button');cancel.type='button';cancel.className='scs-court-popup-cancel';cancel.textContent='Cancel';cancel.onclick=()=>{if(!pending)close();};modal.appendChild(cancel);
 overlay.appendChild(modal);overlay.onclick=e=>{if(e.target===overlay&&!pending)close()};
 overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(!pending)close()}});
 document.body.appendChild(overlay);x.focus();return overlay;
}
window.SCSCourtAssignmentPopup={open,close,showConfirmation};
})();
