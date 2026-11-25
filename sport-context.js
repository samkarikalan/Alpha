/* V924: one codebase, separate sport PWA identities and device workspaces. Load first. */
(function(){
 'use strict';
 const match=location.pathname.match(/^\/(badminton|pickleball|tournaments|scoreboard)(?:\/|$)/);
 const appModule=match?match[1]:'shared';
 const sport=appModule==='badminton'||appModule==='pickleball'?appModule:null;
 document.documentElement.dataset.scsApp=appModule;
 const prefix=match?'scs:'+appModule+':':'';
 const shared=/^(appLanguage|currentLang|theme|scsTheme|scsPwaCacheRecoveryBuild)$/;
 const native={get:Storage.prototype.getItem,set:Storage.prototype.setItem,remove:Storage.prototype.removeItem,key:Storage.prototype.key,clear:Storage.prototype.clear,length:Object.getOwnPropertyDescriptor(Storage.prototype,'length').get};
 function mapped(key){key=String(key);return prefix&&!shared.test(key)?prefix+key:key;}
 function visibleKeys(storage){const result=[];for(let i=0;i<native.length.call(storage);i++){const key=native.key.call(storage,i);if(!prefix||shared.test(key))result.push(key);else if(key.startsWith(prefix))result.push(key.slice(prefix.length));}return result;}
 if(prefix){
  Storage.prototype.getItem=function(key){if(sport&&String(key)==='scsPreferredSport')return sport;return native.get.call(this,mapped(key));};
  Storage.prototype.setItem=function(key,value){native.set.call(this,mapped(key),sport&&String(key)==='scsPreferredSport'?sport:String(value));};
  Storage.prototype.removeItem=function(key){native.remove.call(this,mapped(key));};
  Storage.prototype.key=function(index){return visibleKeys(this)[Number(index)]??null;};
  Object.defineProperty(Storage.prototype,'length',{configurable:true,get(){return visibleKeys(this).length;}});
  Storage.prototype.clear=function(){for(const key of visibleKeys(this))if(!shared.test(key))native.remove.call(this,mapped(key));};
  const open=indexedDB.open.bind(indexedDB),removeDB=indexedDB.deleteDatabase.bind(indexedDB);
  indexedDB.open=function(name,...args){return open(prefix+name,...args);};
  indexedDB.deleteDatabase=function(name){return removeDB(prefix+name);};
  const databases=indexedDB.databases?.bind(indexedDB);
  if(databases)indexedDB.databases=async()=> (await databases()).filter(db=>db.name.startsWith(prefix)).map(db=>({...db,name:db.name.slice(prefix.length)}));
  if(sport){document.documentElement.dataset.scsSport=sport;document.documentElement.dataset.scsSportApp=sport;}
  const fetchOriginal=window.fetch.bind(window);
  // Context is attached to existing Worker requests; account identity stays shared.
  window.fetch=function(input,options){
   const address=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   if(typeof WORKER_URL!=='undefined'&&new URL(address,location.href).origin===new URL(WORKER_URL).origin){
    const headers=new Headers(options?.headers||(input instanceof Request?input.headers:undefined));headers.set('X-SCS-App',appModule);if(sport)headers.set('X-SCS-Sport',sport);
    return fetchOriginal(input,{...options,headers});
   }
   return fetchOriginal(input,options);
  };
  let authReload;
  window.addEventListener('storage',event=>{
   if(event.key!==mapped('auth_user'))return;
   let before,after;try{before=event.oldValue?JSON.parse(event.oldValue):null;after=event.newValue?JSON.parse(event.newValue):null;}catch(_){return;}
   if(before?.id!==after?.id){clearTimeout(authReload);authReload=setTimeout(()=>location.reload(),100);}
  });
 }
 function readAppLogin(moduleName){
  if(!['shared','badminton','pickleball','tournaments','scoreboard'].includes(moduleName))return null;
  const base=moduleName==='shared'?'':'scs:'+moduleName+':';
  try{const user=JSON.parse(native.get.call(localStorage,base+'auth_user')||'null'),token=native.get.call(localStorage,base+'scs_session_token');return user?.id&&token?{user,token,moduleName}:null;}catch(_){return null;}
 }
 function readLoginHint(){try{return JSON.parse(native.get.call(localStorage,'scs_sso_hint')||'null');}catch(_){return null;}}
 function saveLoginHint(value){native.set.call(localStorage,'scs_sso_hint',JSON.stringify(value));}
 window.SCSSportContext=Object.freeze({sport,appModule,locked:!!sport,storagePrefix:prefix,readAppLogin,readLoginHint,saveLoginHint});
})();
