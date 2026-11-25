/* V936: verified single-login handoff between SCS entries sharing browser storage. */
(function(){
 'use strict';
 const modules=['shared','badminton','pickleball','tournaments','scoreboard'];
 function remember(user){if(!user?.id)return;localStorage.removeItem('scs_sso_signed_out');window.SCSSportContext?.saveLoginHint({accountId:user.id,moduleName:SCSSportContext.appModule||'shared'});}
 async function restore(){
  const context=window.SCSSportContext;if(!context?.readAppLogin||typeof authGetUser!=='function'||authGetUser())return false;
  const url=new URL(location.href),explicit=url.searchParams.get('sso')==='1';
  if(explicit){url.searchParams.delete('sso');history.replaceState(history.state,'',url);}
  if(!explicit&&localStorage.getItem('scs_sso_signed_out')==='1')return false;
  const target=context.appModule||'shared',hint=context.readLoginHint();
  const stored=modules.filter(module=>module!==target).map(module=>context.readAppLogin(module)).filter(Boolean);
  const accounts=[...new Set(stored.map(login=>login.user.id))];
  const accountId=hint?.accountId||(accounts.length===1?accounts[0]:null);if(!accountId)return false;
  const sources=stored.filter(login=>login.user.id===accountId).sort((a,b)=>Number(b.moduleName===hint?.moduleName)-Number(a.moduleName===hint?.moduleName));
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  try{
   for(const login of sources){
    const response=await fetch(WORKER_URL+'/auth/module-session',{
     method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
     body:JSON.stringify({accountId:login.user.id,sourceModule:login.moduleName,sourceSessionToken:login.token,targetModule:target,targetSessionToken:typeof _getLocalToken==='function'?_getLocalToken():null,deviceId:getDeviceId(),deviceInfo:typeof _getDeviceInfo==='function'?_getDeviceInfo():'Browser'})
    });
    const result=await response.json().catch(()=>({}));
    if(response.status===401)continue;
    if(response.status===409&&result.conflict){authShowConflictModal(result.user,result.deviceInfo);return false;}
    if(!response.ok||!result.user?.id||!result.token)return false;
    _setLocalToken(result.token);_authUser=result.user;localStorage.setItem('auth_user',JSON.stringify(result.user));remember(result.user);return true;
   }
  }catch(error){console.warn('SCS sign-in handoff unavailable:',error.message);}
  finally{clearTimeout(timeout);}
  return false;
 }
 window.SCSSingleLogin=Object.freeze({restore,remember});
})();
