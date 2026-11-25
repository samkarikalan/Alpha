/* ============================================================
   snapshot.js — Full session state save & restore
   
   SAVE: saveSnapshot() called after every meaningful action
   RESTORE: checkAndResume() called on initAppFlow()
   
   Maps/Sets serialized as [[k,v]] arrays for JSON compat.
   sessionDbId moved from sessionStorage → localStorage.
============================================================ */

const SNAPSHOT_KEY = 'kbrr_snapshot';
const SESSION_ID_KEY = 'kbrr_session_id_persist';

/* ── Serialization helpers for Map / Set ── */
function _serializeMap(m) {
  if (!m || !(m instanceof Map)) return [];
  return Array.from(m.entries());
}
function _serializeSet(s) {
  if (!s || !(s instanceof Set)) return [];
  return Array.from(s.values());
}
function _deserializeMap(arr) {
  return new Map(Array.isArray(arr) ? arr : []);
}
function _deserializeSet(arr) {
  return new Set(Array.isArray(arr) ? arr : []);
}
// Nested Map: Map<string, Map<string, number>>
function _serializeNestedMap(m) {
  if (!m || !(m instanceof Map)) return [];
  return Array.from(m.entries()).map(([k, v]) => [k, v instanceof Map ? Array.from(v.entries()) : []]);
}
function _deserializeNestedMap(arr) {
  if (!Array.isArray(arr)) return new Map();
  return new Map(arr.map(([k, v]) => [k, new Map(Array.isArray(v) ? v : [])]));
}

/* ── Build serialized schedulerState blob (shared by save + DB sync) ── */
function buildSchedulerBlob() {
  if (typeof schedulerState === 'undefined' || typeof allRounds === 'undefined') return null;
  if (!Array.isArray(allRounds) || allRounds.length === 0) return null;
  const ss = schedulerState;
  return {
    version:           3,
    roundStorage: window.SCSRoundStorage?.isLocal()?'local':'normal',
    userId: typeof authGetUser==='function' ? String((authGetUser()||{}).id||(authGetUser()||{}).email||'') : '',
    clubId: typeof getMyClub==='function' ? String((getMyClub()||{}).id||'') : '',
    clubName: typeof getMyClub==='function' ? String((getMyClub()||{}).name||'') : '',
    lastRound: typeof lastRound!=='undefined'&&Array.isArray(lastRound)?lastRound.slice():[],
    resetRest:typeof resetRest!=='undefined'?!!resetRest:false,
    proposalOpen:typeof roundOneProposalOpen!=='undefined'?!!roundOneProposalOpen:false,
    roleWorkspace: document.body.dataset.scsRoleWorkspace || localStorage.getItem('scs_active_role_workspace') || 'member',
    playMode: typeof getPlayMode==='function'?getPlayMode():'random',
    temporaryPlayers: !!window.SCSRoundAssistantTemporary,
    offlineContext: {inProgress:localStorage.getItem('scsOfflineRoundSessionInProgress')==='1',dataset:localStorage.getItem('scsOfflineSessionDataset'),live:localStorage.getItem('scsIModeLiveSessionContext')},
    scoreEntryDrafts: typeof _roundScoreDrafts!=='undefined' ? allRounds.flatMap((r,ri)=>(r.games||[]).flatMap((g,gi)=>_roundScoreDrafts.has(g)?[{round:ri,game:gi,values:_roundScoreDrafts.get(g)}]:[])) : [],
    timestamp:         Date.now(),
    page:              'roundsPage',
    appMode:           typeof appMode !== 'undefined' ? appMode : 'organiser',
    currentLang:       typeof currentLang !== 'undefined' ? currentLang : 'en',
    currentRoundIndex: typeof currentRoundIndex !== 'undefined' ? currentRoundIndex : 0,
    currentState:      typeof currentState !== 'undefined' ? currentState : 'idle',
    interactionLocked: typeof interactionLocked !== 'undefined' ? interactionLocked : false,
    roundActive:       typeof roundActive !== 'undefined' ? roundActive : false,
    sessionDbId:       window.SCSRoundStorage?.isLocal()?null:(localStorage.getItem(SESSION_ID_KEY) || null),
    gameGenerationMode: typeof getGameGenerationMode === 'function' ? getGameGenerationMode() : 'standard',
    allRounds: JSON.parse(JSON.stringify(allRounds)),
    schedulerState: {
      courtTypes: (ss.courtTypes||[]).slice(),
      courtFormats: (ss.courtFormats||[]).slice(),
      typePlayCount: Object.fromEntries(Object.entries(ss.typePlayCount||{}).map(([k,v])=>[k,_serializeMap(v)])),
      balancedRandomRestOrderLocked: !!ss.balancedRandomRestOrderLocked,resetRest:!!ss.resetRest,
      standardGamesMode:ss.standardGamesMode,uniqueGamesMode:ss.uniqueGamesMode,balancedGamesMode:ss.balancedGamesMode,
      numCourts:      ss.numCourts,
      courts:         ss.courts,
      roundIndex:     ss.roundIndex,
      gameGenerationMode: typeof getGameGenerationMode === 'function' ? getGameGenerationMode() : (ss.gameGenerationMode || 'standard'),
      markingWinnerMode: ss.markingWinnerMode,
      allPlayers:     JSON.parse(JSON.stringify(ss.allPlayers || [])),
      activeplayers:  JSON.parse(JSON.stringify(
        Array.isArray(ss.activeplayers) ? ss.activeplayers : Array.from(ss.activeplayers || [])
      )),
      fixedPairs:     JSON.parse(JSON.stringify(ss.fixedPairs || [])),
      fixedPairsEnabled: ss.fixedPairsEnabled !== false,
      registeredFixedPairs: JSON.parse(JSON.stringify(ss.fixedPairsEnabled === false ? (ss.registeredFixedPairs || []) : (ss.fixedPairs || []))),
      PlayedCount:    _serializeMap(ss.PlayedCount),
      restCount:      _serializeMap(ss.restCount),
      restQueue:      Array.isArray(ss.restQueue) ? ss.restQueue.slice() : [],
      PlayerScoreMap: _serializeMap(ss.PlayerScoreMap),
      playedTogether: _serializeMap(ss.playedTogether),
      fixedMap:       _serializeMap(ss.fixedMap),
      gamesMap:       _serializeSet(ss.gamesMap),
      winCount:       _serializeMap(ss.winCount),
      pairCooldownMap:_serializeMap(ss.pairCooldownMap),
      rankPoints:     _serializeMap(ss.rankPoints),
      streakMap:      _serializeMap(ss.streakMap),
      pairPlayedSet:  _serializeSet(ss.pairPlayedSet),
      opponentMap:    _serializeNestedMap(ss.opponentMap),
      pairHistory:    _serializeMap(ss.pairHistory),
      reachablePairs: _serializeSet(ss.reachablePairs),
      fixedPairGameQueue:     Array.isArray(ss.fixedPairGameQueue) ? ss.fixedPairGameQueue.slice() : [],
      fixedPairGameQueueHash: ss.fixedPairGameQueueHash || null,
      iModeSyncTotals: JSON.parse(JSON.stringify(ss.iModeSyncTotals || {})),
      iModeRecordedRounds: Array.isArray(ss.iModeRecordedRounds) ? ss.iModeRecordedRounds.slice() : [],
    }
  };
}

/* ── Save full snapshot ── */
function saveSnapshot() {
  try {
    const blob = buildSchedulerBlob();
    if (!blob || window.__scsRestoringSnapshot || window.__scsRecoveryEnded) return;
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(blob));
    // Mirror the same working snapshot into IndexedDB. This is deliberately
    // non-blocking so an IndexedDB failure can never interrupt the live round.
    if (window.SCSOfflineDB && typeof window.SCSOfflineDB.saveSnapshot === 'function') {
      window.SCSOfflineDB.saveSnapshot(blob).catch(function(error) {
        console.warn('Offline snapshot mirror failed:', error && error.message ? error.message : error);
      });
    }
  } catch(e) {
    console.warn('saveSnapshot failed:', e.message);
  }
}

/* ── Clear snapshot (called on normal end session) ── */
function clearSnapshot() {
  window.__scsRecoveryEnded=true;
  localStorage.removeItem(SNAPSHOT_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  if (window.SCSOfflineDB && typeof window.SCSOfflineDB.clearSnapshot === 'function') {
    window.SCSOfflineDB.clearSnapshot().catch(function() {});
  }
}

/* ── Persist sessionDbId to localStorage (survives page reload) ── */
function persistSessionId(id) {
  if (id) localStorage.setItem(SESSION_ID_KEY, id);
  else localStorage.removeItem(SESSION_ID_KEY);
}

/* ── Restore full snapshot into live app state ── */
async function restoreSnapshot(blob) {
  if(!scsValidRoundSnapshot(blob))return false;
  window.__scsRestoringSnapshot=true;
  try {
    _showResumeToast('Resuming session…');

    window.SCSRoundStorage?.restore(blob);

    // Restore settings before rendering, without generating or advancing rounds.
    if(blob.playMode){localStorage.setItem('playMode',blob.playMode);const winner=document.getElementById('modeToggle');if(winner)winner.checked=blob.playMode==='competitive';}
    window.SCSRoundAssistantTemporary=!!blob.temporaryPlayers;
    if(blob.offlineContext?.inProgress){
      localStorage.setItem('scsOfflineRoundSessionInProgress','1');
      if(blob.offlineContext.dataset)localStorage.setItem('scsOfflineSessionDataset',blob.offlineContext.dataset);else localStorage.removeItem('scsOfflineSessionDataset');
      if(blob.offlineContext.live)localStorage.setItem('scsIModeLiveSessionContext',blob.offlineContext.live);
      window.SCSOfflineRounds?.activate?.();
    }
    if(blob.clubId&&typeof setMyClub==='function')setMyClub(blob.clubId,blob.clubName||'');
    if(typeof lastRound!=='undefined'&&Array.isArray(lastRound)){lastRound.length=0;lastRound.push(...(blob.lastRound||[]));}
    if(typeof resetRest!=='undefined')resetRest=!!blob.resetRest;
    if(typeof roundOneProposalOpen!=='undefined')roundOneProposalOpen=blob.currentState!=='active'&&!!blob.proposalOpen;
    // Restore simple globals
    if (typeof appMode        !== 'undefined') appMode        = blob.appMode || 'organiser';
    if (typeof currentLang    !== 'undefined') currentLang    = blob.currentLang || 'en';
    if (typeof currentRoundIndex !== 'undefined') currentRoundIndex = blob.currentRoundIndex || 0;
    if (typeof currentState   !== 'undefined') currentState   = blob.currentState || 'idle';
    if (typeof interactionLocked !== 'undefined') interactionLocked = blob.interactionLocked || false;
    if (typeof roundActive    !== 'undefined') roundActive    = blob.roundActive || false;

    // Restore sessionDbId
    if (blob.sessionDbId) {
      persistSessionId(blob.sessionDbId);
      // Also restore to sessionStorage so existing functions find it
      sessionStorage.setItem('kbrr_session_db_id', blob.sessionDbId);
    }

    // Restore allRounds
    if (typeof allRounds !== 'undefined') {
      allRounds.length = 0;
      (blob.allRounds || []).forEach(r => allRounds.push(r));
    }

    if(typeof _roundScoreDrafts!=='undefined'){
      _roundScoreDrafts=new WeakMap();(blob.scoreEntryDrafts||[]).forEach(d=>{const game=allRounds[d.round]?.games?.[d.game];if(game&&Array.isArray(d.values))_roundScoreDrafts.set(game,d.values);});
    }
    // Restore schedulerState
    const s = blob.schedulerState;
    if (typeof schedulerState !== 'undefined' && s) {
      schedulerState.courtTypes=(s.courtTypes||[]).slice();schedulerState.courtFormats=(s.courtFormats||[]).slice();
      schedulerState.typePlayCount=Object.fromEntries(Object.entries(s.typePlayCount||{}).map(([k,v])=>[k,_deserializeMap(v)]));
      ['MD','LD','XD'].forEach(k=>{if(!schedulerState.typePlayCount[k])schedulerState.typePlayCount[k]=new Map();});
      schedulerState.balancedRandomRestOrderLocked=!!s.balancedRandomRestOrderLocked;schedulerState.resetRest=!!s.resetRest;
      schedulerState.standardGamesMode=s.standardGamesMode!==false;schedulerState.uniqueGamesMode=s.uniqueGamesMode!==false;schedulerState.balancedGamesMode=!!s.balancedGamesMode;
      schedulerState.numCourts       = s.numCourts || 1;
      schedulerState.courts          = s.courts || s.numCourts || 1;
      if(typeof courts!=='undefined')courts=s.numCourts||1;
      schedulerState.roundIndex      = s.roundIndex || 0;
      schedulerState.gameGenerationMode = s.gameGenerationMode || blob.gameGenerationMode || 'standard';
      schedulerState.markingWinnerMode = s.markingWinnerMode || false;
      schedulerState.allPlayers      = s.allPlayers || [];
      schedulerState.fixedPairs      = s.fixedPairs || [];
      schedulerState.fixedPairsEnabled = s.fixedPairsEnabled !== false;
      schedulerState.registeredFixedPairs = s.registeredFixedPairs || s.fixedPairs || [];
      if (!schedulerState.fixedPairsEnabled) schedulerState.fixedPairs = [];
      schedulerState.PlayedCount     = _deserializeMap(s.PlayedCount);
      schedulerState.restCount       = _deserializeMap(s.restCount);
      schedulerState.restQueue       = Array.isArray(s.restQueue) ? s.restQueue.slice() : [];
      schedulerState.PlayerScoreMap  = _deserializeMap(s.PlayerScoreMap);
      schedulerState.playedTogether  = _deserializeMap(s.playedTogether);
      schedulerState.fixedMap        = _deserializeMap(s.fixedMap);
      schedulerState.gamesMap        = _deserializeSet(s.gamesMap);
      schedulerState.winCount        = _deserializeMap(s.winCount);
      schedulerState.pairCooldownMap = _deserializeMap(s.pairCooldownMap);
      schedulerState.rankPoints      = _deserializeMap(s.rankPoints);
      schedulerState.streakMap       = _deserializeMap(s.streakMap);
      schedulerState.pairPlayedSet   = _deserializeSet(s.pairPlayedSet);
      schedulerState.opponentMap     = _deserializeNestedMap(s.opponentMap);
      schedulerState.pairHistory     = _deserializeMap(s.pairHistory);
      schedulerState.reachablePairs  = _deserializeSet(s.reachablePairs);
      schedulerState.fixedPairGameQueue = Array.isArray(s.fixedPairGameQueue) ? s.fixedPairGameQueue.slice() : [];
      schedulerState.fixedPairGameQueueHash = s.fixedPairGameQueueHash || null;
      schedulerState.iModeSyncTotals = JSON.parse(JSON.stringify(s.iModeSyncTotals || {}));
      schedulerState.iModeRecordedRounds = Array.isArray(s.iModeRecordedRounds) ? s.iModeRecordedRounds.slice() : [];

      // Restore activeplayers (plain array, not proxy for restore)
      if(!Array.isArray(schedulerState.activeplayers))schedulerState.activeplayers=[];
      schedulerState.activeplayers.splice(0, schedulerState.activeplayers.length,
        ...(s.activeplayers || []));

      if (typeof setGameGenerationMode === 'function') {
        setGameGenerationMode(schedulerState.gameGenerationMode, true);
      }
    }

    // Apply mode and language
    if (typeof applyMode    === 'function') applyMode(blob.appMode || 'organiser');
    if (typeof setLanguage  === 'function') setLanguage(blob.currentLang || 'en');
    if (typeof updateModePill === 'function') updateModePill(blob.appMode || 'organiser');
    if (typeof loadHomeStyle === 'function') loadHomeStyle();

    ['scsRoleWorkspaceChooser','modeSelectOverlay','scsStartupSplash'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
    ['scsActivityHome','scsTournamentManager'].forEach(id=>{const e=document.getElementById(id);if(e)e.hidden=true;});
    if(typeof sessionFinished!=='undefined')sessionFinished=false;
    if(typeof _lastRenderedRoundIndex!=='undefined')_lastRenderedRoundIndex=-1;
    if(typeof closeRoundOneProposal==='function'&&blob.currentState==='active')closeRoundOneProposal();
    // Navigate to roundsPage and render
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const rp = document.getElementById('roundsPage');
    if (rp) rp.style.display = 'block';

    // Hide home overlay
    const homeEl = document.getElementById('homePageOverlay');
    if (homeEl) homeEl.style.display = 'none';

    // Render the round
    if (typeof showRound === 'function') {
      showRound(blob.currentRoundIndex || 0);
    }

    // Restore active state UI
    if (blob.currentState === 'active') {
      // Re-apply active mode visuals
      document.getElementById('roundsPage')?.classList.add('active-mode');
      document.querySelectorAll('.win-cup').forEach(cup => {
        const enabled=typeof getPlayMode==='function'&&getPlayMode()==='competitive';const selected=cup.classList.contains('active');
        cup.style.display=enabled?'':'none';if(!selected&&cup.style.visibility==='hidden')return;cup.style.pointerEvents=enabled&&!selected?'auto':'none';
      });
      // Disable buttons except nextBtn/endBtn
      document.querySelectorAll('button, .player-btn, .mode-card, .lock-icon').forEach(el => {
        const keep = el.id === 'nextBtn' || el.id === 'endBtn' || el.id==='stopRoundBtn' || el.id==='roundWinnerCup' || el.classList.contains('win-cup') || !!el.closest('.round-score-dashboard') || el.classList.contains('bottom-sheet-x');
        if (!keep) { el.style.pointerEvents = 'none'; el.classList.add('disabled'); }
      });
      // Update Next button label
      const nextBtn = document.getElementById('nextBtn');
      const btnText = document.getElementById('btnText');
      if(nextBtn){nextBtn.classList.remove('start-state','end');nextBtn.classList.add('round-active');const icon=nextBtn.querySelector('.icon');if(icon)icon.textContent=' ✓';}
      if (btnText) { btnText.removeAttribute('data-i18n'); btnText.textContent = 'Mark Completed'; }
    }

    // Restore lock state
    if (blob.interactionLocked) {
      const lockBtn = document.getElementById('lockToggleBtn');
      if (lockBtn) lockBtn.src = 'lock.png';
      document.getElementById('roundsPage')?.querySelector('.round-wrapper')?.classList.add('locked');
    }

    // Update live bar
    if (typeof updateSessionLiveBar === 'function') updateSessionLiveBar();
    if (typeof resumeRoundTimer === 'function') resumeRoundTimer();

    // Recovery never creates a replacement server session or changes ownership.
    if(blob.sessionDbId&&typeof startSessionHeartbeat==='function')startSessionHeartbeat();

    // Sync shuffle button
    if (typeof _syncShuffleBtn === 'function') _syncShuffleBtn();

    setTimeout(() => _hideResumeToast(), 1500);
    if(typeof _syncModeBanner==='function')_syncModeBanner();
    if(typeof syncLiveWinnerCup==='function')syncLiveWinnerCup();
    if(typeof scsRefreshPracticeHeader==='function')scsRefreshPracticeHeader();
    console.log('✅ Session restored from snapshot');
    return true;

  } catch(e) {
    console.error('restoreSnapshot failed:', e);
    // Retain the last working recovery copy so a transient render failure is retryable.
    _hideResumeToast();
    // Fallback to normal start
    if (typeof showHomeScreen === 'function') showHomeScreen();
    return false;
  } finally {window.__scsRestoringSnapshot=false;}
}

/* ── Check on startup: DB-first restore or local fallback ── */
async function checkAndResume() {
  return scsResumeSavedRounds();
}
async function scsLegacyHandoverRecovery() {
  const club = (typeof getMyClub === 'function') ? getMyClub() : null;

  // ── Step 1: Check DB for a live session for this club ──
  if (club && club.id) {
    try {
      _showResumeToast('Checking session…');
      const rows = await sbGet('sessions',
        `club_id=eq.${club.id}&status=eq.live&order=updated_at.desc&limit=1` +
        `&select=id,started_by,updated_at,scheduler_state,rounds_data`
      );
      _hideResumeToast();

      if (rows && rows.length) {
        const dbSession = rows[0];
        const dbBlob    = dbSession.scheduler_state; // full blob stored by dbSyncRoundsData

        // ── Check if session is actively controlled (heartbeat within 90s) ──
        const mySessionId = localStorage.getItem(SESSION_ID_KEY);
        const isMySession = mySessionId === dbSession.id;
        const lastBeat    = new Date(dbSession.updated_at || 0).getTime();
        const isActive    = (Date.now() - lastBeat) < 90 * 1000;

        if (!isMySession) {
          // Another organiser is live — show locked message with PIN takeover option
          var lockResult = await _showSessionLockedPrompt(dbSession);
          if (lockResult === 'pin') {
            var pinResult = await _showHandoverPinEntry(dbSession);
            if (pinResult && pinResult.action === 'takeover') {
              // PIN validated — restore full session
              var sess = pinResult.session;
              if (sess.scheduler_state && sess.scheduler_state.schedulerState) {
                var blob = sess.scheduler_state;
                blob.sessionDbId = sess.id;
                persistSessionId(sess.id);
                sessionStorage.setItem('kbrr_session_db_id', sess.id);
                localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(blob));
                await restoreSnapshot(blob);
                if (typeof startSessionHeartbeat === 'function') startSessionHeartbeat();
                return true;
              }
            }
          }
          return false;
        }

        // ── My own session, heartbeat fresh — restore silently on app open ──
        if (isMySession) {
          if (dbBlob && dbBlob.schedulerState) {
            dbBlob.sessionDbId = dbSession.id;
            persistSessionId(dbSession.id);
            sessionStorage.setItem('kbrr_session_db_id', dbSession.id);
            localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(dbBlob));
            await restoreSnapshot(dbBlob);
          } else {
            persistSessionId(dbSession.id);
            sessionStorage.setItem('kbrr_session_db_id', dbSession.id);
            if (typeof startSessionHeartbeat === 'function') startSessionHeartbeat();
          }
          return true;
        }

        // Session is stale or belongs to someone else who left — ask user what to do
        const resume = await _showContinuePrompt(dbSession);

        if (resume === 'continue') {
          if (dbBlob && dbBlob.schedulerState) {
            // DB has full state — restore from it (freshest source)
            dbBlob.sessionDbId = dbSession.id;
            persistSessionId(dbSession.id);
            sessionStorage.setItem('kbrr_session_db_id', dbSession.id);
            localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(dbBlob));
            await restoreSnapshot(dbBlob);
            return true;
          } else {
            // DB session exists but no scheduler_state yet — try localStorage
            const raw = localStorage.getItem(SNAPSHOT_KEY);
            if (raw) {
              let blob;
              try { blob = JSON.parse(raw); } catch(e) { blob = null; }
              if (blob && blob.sessionDbId === dbSession.id) {
                await restoreSnapshot(blob);
                return true;
              }
            }
            // No usable state — just restore session ID and let user continue normally
            persistSessionId(dbSession.id);
            sessionStorage.setItem('kbrr_session_db_id', dbSession.id);
            return false;
          }
        } else {
          // User chose Start Fresh — complete old session
          _showResumeToast('Starting fresh…');
          try {
            if (typeof dbForceCompleteSession === 'function') await dbForceCompleteSession(dbSession.id);
          } catch(e) {}
          clearSnapshot();
          setTimeout(() => _hideResumeToast(), 1000);
          return false;
        }
      }
    } catch(e) {
      _hideResumeToast();
      console.warn('DB session check failed (offline?) — trying localStorage');
    }
  }

  // ── Step 2: No DB session — fall back to local device snapshot ──
  // Keep the existing localStorage path first. IndexedDB is only a secondary
  // recovery copy and never replaces the proven restore flow.
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  let localBlob = null;

  if (raw) {
    try { localBlob = JSON.parse(raw); } catch(e) { localBlob = null; }
  }

  if (!localBlob && window.SCSOfflineDB && typeof window.SCSOfflineDB.getSnapshot === 'function') {
    try {
      localBlob = await window.SCSOfflineDB.getSnapshot();
      if (localBlob) localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(localBlob));
    } catch(e) {
      console.warn('IndexedDB snapshot recovery failed:', e && e.message ? e.message : e);
    }
  }

  if (!localBlob) return false;

  // Snapshot too old? (24 hours)
  if (Date.now() - (localBlob.timestamp || 0) > 24 * 60 * 60 * 1000) {
    clearSnapshot();
    return false;
  }

  await restoreSnapshot(localBlob);
  return true;
}

/* ── Continue Session prompt ── */
function _showContinuePrompt(dbSession) {
  return new Promise(function(resolve) {
    var existing = document.getElementById('scs-continue-modal');
    if (existing) existing.remove();

    // Format time — new Date() correctly converts UTC+00:00 from Postgres to local time
    var timeStr = '';
    if (dbSession.updated_at) {
      var d = new Date(dbSession.updated_at);
      if (!isNaN(d)) {
        timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
                  ' · ' + d.toLocaleDateString([], { day: 'numeric', month: 'short' });
      }
    }

    var startedBy = dbSession.started_by ? 'Started by ' + dbSession.started_by : 'Session in progress';
    var rounds    = (dbSession.rounds_data && dbSession.rounds_data.length)
                  ? dbSession.rounds_data.length + ' round' + (dbSession.rounds_data.length !== 1 ? 's' : '') + ' played'
                  : '';

    var modal = document.createElement('div');
    modal.id = 'scs-continue-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;box-sizing:border-box;';

    modal.innerHTML =
      '<div style="background:var(--card-bg,#1e1e2e);border-radius:20px;padding:28px 22px;max-width:320px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,0.6);text-align:center;">' +
        '<div style="font-size:2.4rem;margin-bottom:10px;">🏸</div>' +
        '<div style="font-size:1rem;font-weight:800;color:var(--text,#fff);margin-bottom:6px;">Session in Progress</div>' +
        '<div style="font-size:0.82rem;color:var(--text-dim,#aaa);margin-bottom:4px;">' + startedBy + '</div>' +
        (rounds ? '<div style="font-size:0.78rem;color:var(--accent,#6c63ff);font-weight:600;margin-bottom:4px;">' + rounds + '</div>' : '') +
        (timeStr ? '<div style="font-size:0.75rem;color:var(--text-dim,#aaa);margin-bottom:20px;">Last updated ' + timeStr + '</div>' : '<div style="margin-bottom:20px;"></div>') +
        '<button id="scsContBtn" style="width:100%;padding:14px;background:linear-gradient(135deg,#2dce89,#26b575);color:#fff;border:none;border-radius:13px;font-size:0.92rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;">▶ Continue Session</button>' +
        '<button id="scsFreshBtn" style="width:100%;padding:12px;background:none;border:1px solid var(--border,#333);color:var(--text-dim,#aaa);border-radius:13px;font-size:0.88rem;cursor:pointer;font-family:inherit;">Start Fresh</button>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('scsContBtn').onclick = function() {
      modal.remove();
      resolve('continue');
    };
    document.getElementById('scsFreshBtn').onclick = function() {
      modal.remove();
      resolve('fresh');
    };
  });
}

/* ── Session locked prompt — another organiser is active ── */
function _showSessionLockedPrompt(dbSession) {
  return new Promise(function(resolve) {
    var existing = document.getElementById('scs-locked-modal');
    if (existing) existing.remove();

    var startedBy = dbSession.started_by || 'Another organiser';
    var timeStr = '';
    if (dbSession.updated_at) {
      var d = new Date(dbSession.updated_at);
      if (!isNaN(d)) {
        timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
    var rounds = (dbSession.rounds_data && dbSession.rounds_data.length)
      ? dbSession.rounds_data.length + ' round' + (dbSession.rounds_data.length !== 1 ? 's' : '') + ' in progress'
      : 'Session in progress';

    var modal = document.createElement('div');
    modal.id = 'scs-locked-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;box-sizing:border-box;';

    modal.innerHTML =
      '<div style="background:var(--card-bg,#1e1e2e);border-radius:20px;padding:28px 22px;max-width:320px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,0.6);text-align:center;">' +
        '<div style="font-size:2.4rem;margin-bottom:10px;">🔴</div>' +
        '<div style="font-size:1rem;font-weight:800;color:var(--text,#fff);margin-bottom:8px;">Session Live</div>' +
        '<div style="font-size:0.85rem;color:var(--text-dim,#aaa);margin-bottom:4px;"><strong style="color:var(--text,#fff);">' + startedBy + '</strong> is running this session</div>' +
        '<div style="font-size:0.78rem;color:var(--accent,#6c63ff);font-weight:600;margin-bottom:4px;">' + rounds + '</div>' +
        (timeStr ? '<div style="font-size:0.75rem;color:var(--text-dim,#aaa);margin-bottom:22px;">Active since ' + timeStr + '</div>' : '<div style="margin-bottom:22px;"></div>') +
        '<div style="font-size:0.78rem;color:var(--text-dim,#888);margin-bottom:20px;line-height:1.5;">You can take over once they close the app, or use a handover PIN if they gave you one.</div>' +
        '<button id="scsLockedPin" style="width:100%;padding:13px;background:linear-gradient(135deg,#6c63ff,#574fd6);color:#fff;border:none;border-radius:13px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;">🔐 Enter Handover PIN</button>' +
        '<button id="scsLockedOk" style="width:100%;padding:11px;background:none;border:1px solid var(--border,#333);color:var(--text-dim,#aaa);border-radius:13px;font-size:0.88rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
      '</div>';

    document.body.appendChild(modal);
    document.getElementById('scsLockedPin').onclick = function() {
      modal.remove();
      resolve('pin');
    };
    document.getElementById('scsLockedOk').onclick = function() {
      modal.remove();
      resolve('cancel');
    };
  });
}

/* ── Handover: generate PIN and show to current organiser ── */
async function showHandoverPin() {
  // Try sessionStorage first, fall back to localStorage
  var sessionId = (typeof getMySessionId === 'function') ? getMySessionId() : null;
  if (!sessionId) sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) { alert('No active session to hand over.'); return; }

  // Generate 4-digit PIN
  var pin = String(Math.floor(1000 + Math.random() * 9000));

  try {
    await sbPatch('sessions', 'id=eq.' + sessionId, { handover_pin: pin });
  } catch(e) {
    alert('Could not generate handover PIN. Please try again.');
    return;
  }

  // Show PIN to current organiser
  var existing = document.getElementById('scs-handover-show-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'scs-handover-show-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;box-sizing:border-box;';
  modal.innerHTML =
    '<div style="background:var(--card-bg,#1e1e2e);border-radius:20px;padding:30px 24px;max-width:300px;width:100%;text-align:center;">' +
      '<div style="font-size:2.2rem;margin-bottom:10px;">🤝</div>' +
      '<div style="font-size:1rem;font-weight:800;color:var(--text,#fff);margin-bottom:8px;">Hand Over Session</div>' +
      '<div style="font-size:0.82rem;color:var(--text-dim,#aaa);margin-bottom:20px;line-height:1.5;">Give this PIN to the new organiser.<br>It expires when they take over.</div>' +
      '<div style="font-size:3rem;font-weight:900;letter-spacing:12px;color:var(--accent,#6c8cff);margin-bottom:24px;">' + pin + '</div>' +
      '<button id="scsHandoverClose" style="width:100%;padding:13px;background:var(--surface,#2a2a3e);border:1px solid var(--border,#333);color:var(--text,#fff);border-radius:13px;font-size:0.9rem;cursor:pointer;font-family:inherit;">Close</button>' +
    '</div>';

  document.body.appendChild(modal);
  document.getElementById('scsHandoverClose').onclick = function() { modal.remove(); };
}

/* ── Handover: Organiser B enters PIN to take over ── */
function _showHandoverPinEntry(dbSession) {
  return new Promise(function(resolve) {
    var existing = document.getElementById('scs-handover-entry-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'scs-handover-entry-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;box-sizing:border-box;';
    modal.innerHTML =
      '<div style="background:var(--card-bg,#1e1e2e);border-radius:20px;padding:28px 22px;max-width:310px;width:100%;text-align:center;">' +
        '<div style="font-size:2.2rem;margin-bottom:10px;">🔐</div>' +
        '<div style="font-size:1rem;font-weight:800;color:var(--text,#fff);margin-bottom:6px;">Enter Handover PIN</div>' +
        '<div style="font-size:0.82rem;color:var(--text-dim,#aaa);margin-bottom:18px;line-height:1.5;">Ask the current organiser for their 4-digit handover PIN.</div>' +
        '<input id="scsHandoverPinInput" type="number" inputmode="numeric" maxlength="4" placeholder="4-digit PIN"' +
          ' style="width:100%;padding:14px;font-size:1.4rem;font-weight:700;letter-spacing:8px;text-align:center;background:var(--surface,#2a2a3e);border:1.5px solid var(--border,#333);border-radius:12px;color:var(--text,#fff);font-family:inherit;box-sizing:border-box;margin-bottom:10px;">' +
        '<div id="scsHandoverErr" style="font-size:0.78rem;color:#e63757;min-height:18px;margin-bottom:10px;"></div>' +
        '<button id="scsHandoverSubmit" style="width:100%;padding:13px;background:linear-gradient(135deg,#6c63ff,#574fd6);color:#fff;border:none;border-radius:13px;font-size:0.92rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;">Take Over Session</button>' +
        '<button id="scsHandoverCancel" style="width:100%;padding:11px;background:none;border:1px solid var(--border,#333);color:var(--text-dim,#aaa);border-radius:13px;font-size:0.88rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
      '</div>';

    document.body.appendChild(modal);

    var errEl = document.getElementById('scsHandoverErr');

    document.getElementById('scsHandoverSubmit').onclick = async function() {
      var entered = (document.getElementById('scsHandoverPinInput').value || '').trim();
      if (entered.length !== 4) { errEl.textContent = 'Please enter a 4-digit PIN.'; return; }

      // Fetch fresh session to validate PIN
      try {
        var rows = await sbGet('sessions', 'id=eq.' + dbSession.id + '&select=id,handover_pin,scheduler_state,rounds_data,started_by');
        if (!rows || !rows.length) { errEl.textContent = 'Session not found.'; return; }
        var sess = rows[0];

        if (!sess.handover_pin) { errEl.textContent = 'No handover PIN set. Ask organiser to generate one.'; return; }
        if (String(sess.handover_pin).trim() !== entered) { errEl.textContent = '❌ Wrong PIN. Try again.'; return; }

        // PIN correct — transfer session to this user
        var myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
        var myName   = (myPlayer && myPlayer.name) ? myPlayer.name : 'New Organiser';
        await sbPatch('sessions', 'id=eq.' + dbSession.id, {
          handover_pin: null,
          started_by:   myName,
          updated_at:   new Date().toISOString()
        });

        modal.remove();
        resolve({ action: 'takeover', session: sess });
      } catch(e) {
        errEl.textContent = 'Error: ' + e.message;
      }
    };

    document.getElementById('scsHandoverCancel').onclick = function() {
      modal.remove();
      resolve({ action: 'cancel' });
    };
  });
}

/* ── Resume toast UI ── */
function _showResumeToast(msg) {
  let t = document.getElementById('resumeToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'resumeToast';
    t.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;color:#fff;padding:16px 28px;border-radius:16px;font-size:0.9rem;font-weight:700;z-index:99999;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4);';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
}
function _hideResumeToast() {
  const t = document.getElementById('resumeToast');
  if (t) t.style.display = 'none';
}

/* V873: recover only this device/account's unfinished session, never another organiser's. */
function scsValidRoundSnapshot(blob){
 if(!blob||!blob.schedulerState||!Array.isArray(blob.allRounds)||!blob.allRounds.length)return false;
 const index=Number(blob.currentRoundIndex||0),round=blob.allRounds[index];
 return Number.isInteger(index)&&index>=0&&!!round&&Array.isArray(round.games)&&round.games.length>0&&round.games.every(g=>Array.isArray(g.pair1)&&g.pair1.length>0&&Array.isArray(g.pair2)&&g.pair2.length>0)&&Array.isArray(blob.schedulerState.activeplayers)&&blob.schedulerState.activeplayers.length>0;
}
async function scsFindSavedRoundSnapshot(){
 if(window.__scsRecoveryEnded)return null;
  const user=typeof authGetUser==='function'?authGetUser():null;
  if(!user)return null;
  const userId=String(user.id||user.email||'');
  let sessionId=localStorage.getItem(SESSION_ID_KEY)||sessionStorage.getItem('kbrr_session_db_id');
  const club=typeof getMyClub==='function'?(getMyClub()||{}):{};
  let local=null;try{local=JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'null');}catch(_){}
  let mirror=null;
  if(window.SCSOfflineDB?.getSnapshot){try{mirror=await scsRecoveryTimeout(window.SCSOfflineDB.getSnapshot(),2000,null);}catch(_){}}
  const owned=blob=>scsValidRoundSnapshot(blob)&&(!blob.clubId||!club.id||String(blob.clubId)===String(club.id))&&(blob.userId?blob.userId===userId:!!(sessionId&&String(blob.sessionDbId)===String(sessionId)));
  if(!owned(local))local=null;
  if(owned(mirror)&&(!local||Number(mirror.timestamp)>Number(local.timestamp)))local=mirror;
  // Local Only is restored exclusively from this account/club's device backup.
  if(window.SCSRoundStorage?.isLocal())return local?.roundStorage==='local'?local:null;
  if(local?.roundStorage==='local')return local;
  let candidate=local,serverSession=null;
  if(!sessionId&&candidate?.sessionDbId)sessionId=String(candidate.sessionDbId);
  // Older saves may contain complete ready-to-play rounds without a server ID.
  // If the marker was lost, recover only a server snapshot explicitly owned by this account.
  if(!sessionId&&typeof sbGet==='function'&&navigator.onLine!==false){
   try{
    const filter='status=eq.live&scheduler_state->>userId=eq.'+encodeURIComponent(userId)+(club.id?'&club_id=eq.'+encodeURIComponent(club.id):'')+'&select=id,club_id,status,scheduler_state&order=updated_at.desc&limit=5';
    const rows=await scsRecoveryTimeout(sbGet('sessions',filter),4000,null);
    const own=(rows||[]).find(row=>row.status==='live'&&row.scheduler_state?.userId===userId&&scsValidRoundSnapshot(row.scheduler_state)&&(!club.id||String(row.club_id)===String(club.id)));
    if(own){sessionId=own.id;serverSession=own;const remote=Object.assign({},own.scheduler_state,{sessionDbId:own.id});if(!candidate||Number(remote.timestamp)>Number(candidate.timestamp))candidate=remote;}
   }catch(error){console.warn('Owned live-session lookup unavailable',error.message);}
  }
  if(sessionId&&!serverSession&&typeof sbGet==='function'&&navigator.onLine!==false){
   try{
    const rows=await scsRecoveryTimeout(sbGet('sessions','id=eq.'+encodeURIComponent(sessionId)+'&select=id,club_id,status,scheduler_state,rounds_data'),4000,null);
    if(rows&&rows.length){
     serverSession=rows[0];
     if(serverSession.status!=='live'||(club.id&&serverSession.club_id&&String(club.id)!==String(serverSession.club_id))){return null;}
     const remote=serverSession.scheduler_state;
     if(scsValidRoundSnapshot(remote)&&(remote.userId===userId||(!remote.userId&&candidate&&String(candidate.sessionDbId)===String(sessionId)))){
      if(!candidate||Number(remote.timestamp)>Number(candidate.timestamp))candidate=Object.assign({},remote,{sessionDbId:serverSession.id});
     }
    }
   }catch(error){console.warn('Live-session verification unavailable; using local recovery.',error.message);}
  }
  if(!candidate)return null;
  if(!serverSession&&Date.now()-Number(candidate.timestamp||0)>24*60*60*1000)return null;
  if(candidate.currentState==='done'&&!candidate.sessionDbId&&!candidate.offlineContext?.inProgress)return null;
  return candidate;
}
var _scsResumePromise=null;
async function scsResumeSavedRounds(options){
 if(!options?.reopen&&!window.__scsRecoveryEnded&&typeof allRounds!=='undefined'&&allRounds.length&&typeof currentState!=='undefined'&&currentState==='active'){
  const user=typeof authGetUser==='function'?authGetUser():null;let saved=null;try{saved=JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'null');}catch(_){}
  if(user&&saved?.userId===String(user.id||user.email||''))return true;
 }
 if(_scsResumePromise)return _scsResumePromise;
 _scsResumePromise=(async function(){
  const candidate=await scsFindSavedRoundSnapshot();
  if(!candidate)return false;
  const role=candidate.roleWorkspace==='manager'?'manager':'member';
  localStorage.setItem('scs_active_role_workspace',role);
  window.SCSRoleWorkspaces?.syncMenu?.(role);
  const restored=await restoreSnapshot(candidate);
  if(restored){localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(candidate));window.__scsRecoveryEnded=false;}
  return restored;
 })();
 try{return await _scsResumePromise;}finally{_scsResumePromise=null;}
}
function scsRecoveryTimeout(promise,ms,fallback){let timer;return Promise.race([Promise.resolve(promise),new Promise(resolve=>timer=setTimeout(()=>resolve(fallback),ms))]).finally(()=>clearTimeout(timer));}
function scsSaveBeforeBackground(){
 if(window.__scsRecoveryEnded||window.__scsRestoringSnapshot)return;
 if(typeof sessionFinished!=='undefined'&&sessionFinished)return;
 if(window.SCSOfflineRounds?.isTemplateEditorActive?.())return;
 if(typeof allRounds!=='undefined'&&allRounds.length)saveSnapshot();
}
window.addEventListener('pagehide',scsSaveBeforeBackground);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')scsSaveBeforeBackground();});
