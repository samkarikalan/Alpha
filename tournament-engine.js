/* Authenticated client for authoritative Tournament Manager computations. */
(function () {
  'use strict';

  const memory=new Map(),pending=new Map(),failed=new Map();
  const key=(action,payload)=>JSON.stringify([action,payload]);
  function cached(action,payload){const k=key(action,payload);if(memory.has(k))return memory.get(k);try{const v=JSON.parse(localStorage.getItem('scs_official_'+action)||'null');if(v&&v.key===k){memory.set(k,v.data);return v.data;}}catch(_){}return null;}
  function ensure(action,payload,onReady){const old=cached(action,payload);if(old)return old;const k=key(action,payload);if(!pending.has(k)&&Date.now()-(failed.get(k)||0)>15000){pending.set(k,run(action,payload).then(()=>{if(onReady)onReady();}).catch(error=>{failed.set(k,Date.now());console.warn('Official tournament results:',error.message);}).finally(()=>pending.delete(k)));}return null;}
  async function run(action, payload) {
    const responseKey=key(action,payload||{});
    if (navigator.onLine === false) throw new Error('Tournament engine requires a connection.');
    var user = typeof authGetUser === 'function' ? authGetUser() : null;
    var token = typeof _getLocalToken === 'function' ? _getLocalToken() : null;
    if (!user || !user.id || !token) throw new Error('Sign in again to use the tournament engine.');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
    var response = await fetch(WORKER_URL + '/tournament/engine', {
      method: 'POST',signal:controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action,
        payload: payload || {},
        userAccountId: user.id,
        sessionToken: token
      })
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(data.error || ('Tournament engine failed (' + response.status + ')'));
      error.status = response.status;
      throw error;
    }
    const k=responseKey;memory.set(k,data);
    if(['group-standings','team-standings','group-qualifiers'].includes(action)){try{localStorage.setItem('scs_official_'+action,JSON.stringify({key:k,data}));}catch(_){}}
    return data;
    }catch(error){if(error.name==='AbortError')throw Error('Tournament service timed out. Your saved setup is retained. Please retry.');throw error;}finally{clearTimeout(timeout);}
  }

  window.SCSTournamentEngine = Object.freeze({ run: run, cached:cached, ensure:ensure });
})();
