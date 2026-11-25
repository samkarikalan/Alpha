/* V672 — Guest preparation gates for shared Round Manager controls. */
(function () {
'use strict';
let savedClubRoster = null;
let selectedMode = window.SCSRoundStorage?.isQuick() ? 'guest' : 'club';
let savedClubGameType = null;
let guestPrepared = selectedMode === 'guest';
let preparingGuest = false;
const manualGenders = new Map();
function controlsReady() { return selectedMode !== 'guest' || guestPrepared; }
function quickConfig() {
  if (selectedMode !== 'guest') return null;
  const type = document.querySelector('input[name="scsGuestType"]:checked')?.value || 'free';
  const men = Number(el('scsGuestMen')?.value || 0), women = Number(el('scsGuestWomen')?.value || 0);
  const total = type === 'xd' ? men + women : Number(el('scsGuestCount')?.value || 0);
  const courts = Math.max(1, Number(localStorage.getItem('scsOfflineCourtCount')) || 2);
  const valid = Number.isInteger(total) && total <= 40 && total >= 4 * courts &&
    (type !== 'xd' || (men >= 2 * courts && women >= 2 * courts));
  return {type, men, women, total, courts, valid};
}
function refreshQuickStart() {
  const btn = el('sampleStartOfflineRound');
  if (!btn || selectedMode !== 'guest' || activeSession()) return;
  const config = quickConfig();
  btn.disabled = preparingGuest || !guestPrepared || !config.valid;
  btn.title = !guestPrepared ? 'Generate Rounds first' : (config.valid ? '' : 'Select enough players for the number of courts');
  const generate = el('scsGuestPrepare');
  if (generate) {
    generate.disabled = preparingGuest || !config.valid || guestPrepared;
    generate.textContent = preparingGuest ? 'Generating…' : (guestPrepared ? 'Rounds Generated' : 'Generate Rounds');
  }
}
async function startQuickOrNormal() {
  if (selectedMode !== 'guest' || activeSession()) return window.SCSOfflineRounds.start();
  const config = quickConfig();
  if (preparingGuest || !config?.valid) return;
  if (!guestPrepared) return;

  // Quick Mode keeps Free/MD/LD/XD in its own radio group, while Round iMode
  // reads scsOfflineGameType when it builds the live court configuration.
  // Re-commit the visible Quick Mode choice immediately before Start so an
  // intervening controls refresh cannot silently turn a prepared XD session
  // back into Doubles/Free.
  const intendedGameType = config.type === 'xd' ? 'mixed' : 'doubles';
  if (window.SCSOfflineRounds && typeof SCSOfflineRounds.setGameType === 'function') {
    SCSOfflineRounds.setGameType(intendedGameType);
  }
  if (localStorage.getItem('scsOfflineGameType') !== intendedGameType) {
    status(config.type === 'xd'
      ? 'XD could not be applied. Confirm at least two men and two women per court, then generate again.'
      : 'The selected game format could not be applied. Generate rounds again.');
    refreshQuickStart();
    return;
  }
  return window.SCSOfflineRounds.start();
}
function updateGuestGates() {
  const ready = controlsReady();
  const players = el('orgIModePlayers');
  const pairs = el('orgIModeFixedPairs');
  if (players) {
    players.disabled = !ready;
    players.setAttribute('aria-disabled', String(!ready));
    players.classList.toggle('scs-guest-locked', !ready);
  }
  if (pairs) {
    // The existing minimum-player gate remains authoritative after preparation.
    const enough = typeof schedulerState !== 'undefined' && schedulerState.activeplayers.length >= 4;
    pairs.disabled = !ready || !enough;
    pairs.setAttribute('aria-disabled', String(pairs.disabled));
    pairs.classList.toggle('scs-guest-locked', !ready);
  }
}
function invalidatePreparation() {
  if (selectedMode !== 'guest') return;
  guestPrepared = false;
  updateGuestGates();
  status('Configuration changed. Generate Rounds again before starting.');
  refreshQuickStart();
}

function el(id) { return document.getElementById(id); }
function status(message) { const target = el('scsGuestStatus'); if (target) target.textContent = message || ''; }
function activeSession() {
  return (typeof allRounds !== 'undefined' && allRounds.length > 0) ||
    !!(window.SCSOfflineRounds && typeof SCSOfflineRounds.hasSessionInProgress === 'function' && SCSOfflineRounds.hasSessionInProgress());
}
function copyRoster() {
  return {players: schedulerState.allPlayers.map(p => ({...p})), active: schedulerState.activeplayers.slice(),
    pairs: (schedulerState.fixedPairs || []).map(p => Array.isArray(p) ? p.slice() : p)};
}
function applyRoster(players) {
  schedulerState.allPlayers.splice(0, schedulerState.allPlayers.length, ...players);
  schedulerState.activeplayers.splice(0, schedulerState.activeplayers.length, ...players.filter(p => p.active).map(p => p.name).reverse());
  schedulerState.fixedPairs = [];
  if (typeof updatePlayerList === 'function') updatePlayerList();
  if (typeof updateFixedPairSelectors === 'function') updateFixedPairSelectors();
  if (window.SCSOfflineRounds && typeof SCSOfflineRounds.refreshStartAvailability === 'function') SCSOfflineRounds.refreshStartAvailability();
}
function switchMode(mode) {
  if (mode === selectedMode) return;
  if (activeSession()) { status('Finish the current round session before switching player source.'); render(); return; }
  if (mode === 'guest') {
    if (typeof schedulerState === 'undefined') { status('Player Manager is unavailable.'); return; }
    savedClubRoster = copyRoster();
    savedClubGameType = localStorage.getItem('scsOfflineGameType') || 'doubles';
    selectedMode = 'guest';
    guestPrepared = false;
    manualGenders.clear();
    // Do not copy the club's unrelated players into the numbered-player selection.
    applyRoster([]);
  } else {
    selectedMode = 'club';
    guestPrepared = false;
    if (savedClubRoster) {
      applyRoster(savedClubRoster.players);
      schedulerState.activeplayers.splice(0, schedulerState.activeplayers.length, ...savedClubRoster.active);
      schedulerState.fixedPairs = savedClubRoster.pairs;
      if (typeof updatePlayerList === 'function') updatePlayerList();
    }
    savedClubRoster = null;
    manualGenders.clear();
    if (savedClubGameType && window.SCSOfflineRounds && typeof SCSOfflineRounds.setGameType === 'function') SCSOfflineRounds.setGameType(savedClubGameType);
    savedClubGameType = null;
  }
  status(''); render();
  window.SCSRoundStorage?.refresh();
}
function render() {
  const club = el('scsModeClub'), guest = el('scsModeGuest'), setup = el('scsGuestSetup');
  if (!club || !guest || !setup) return;
  club.classList.toggle('is-active', selectedMode === 'club');
  guest.classList.toggle('is-active', selectedMode === 'guest');
  club.setAttribute('aria-pressed', String(selectedMode === 'club'));
  guest.setAttribute('aria-pressed', String(selectedMode === 'guest'));
  setup.hidden = selectedMode !== 'guest';
  const generate = el('scsGuestPrepare');
  if (generate) generate.hidden = selectedMode !== 'guest' || activeSession();
  // The original Game Format card belongs to Normal Mode only.
  // Keep the same underlying format state and scheduling implementation.
  const formatCard = document.querySelector('.org-mode-panel-offline .org-color-format-section');
  if (formatCard) {
    formatCard.hidden = selectedMode === 'guest';
    formatCard.style.display = selectedMode === 'guest' ? 'none' : '';
  }
  const type = document.querySelector('input[name="scsGuestType"]:checked')?.value || 'free';
  const mixed = el('scsGuestMixed');
  if (mixed) mixed.hidden = type !== 'xd';
  const count = el('scsGuestCountRow');
  if (count) count.hidden = type === 'xd';
  const total = type === 'xd' ? Number(el('scsGuestMen').value) + Number(el('scsGuestWomen').value) : Number(el('scsGuestCount').value);
  const summary = el('scsGuestSummary');
  if (summary) summary.textContent = `Total: ${total} players`;
  updateGuestGates();
  refreshQuickStart();
}
async function prepare() {
  if (selectedMode !== 'guest' || preparingGuest) return false;
  if (activeSession()) { status('Finish the current round session first.'); return false; }
  const type = document.querySelector('input[name="scsGuestType"]:checked')?.value || 'free';
  const mixed = type === 'xd';
  const men = Number(el('scsGuestMen').value), women = Number(el('scsGuestWomen').value);
  const total = mixed ? men + women : Number(el('scsGuestCount').value);
  const courts = window.SCSOfflineRounds && Math.max(1, Number(localStorage.getItem('scsOfflineCourtCount')) || 2);
  const required = courts * (window.SCSOfflineRounds && localStorage.getItem('scsOfflineGameType') === 'singles' ? 2 : 4);
  if (!Number.isInteger(total) || total < required || total > 40 || (mixed && (!Number.isInteger(men) || !Number.isInteger(women) || men < courts * 2 || women < courts * 2))) {
    status(mixed ? 'Mixed requires at least two men and two women per court (maximum 40 players).' : `Enter ${required}–40 players for ${courts} courts.`); return false;
  }
  guestPrepared = false;
  updateGuestGates();
  preparingGuest = true;
  const button = el('scsGuestPrepare'); button.disabled = true;
  refreshQuickStart();
  status('Preparing numbered players on this device…');
  try {
    const wanted = Array.from({length: total}, (_, i) => ({name: 'P' + (i+1), displayName: 'P' + (i+1), gender: type === 'ld' || (mixed && i >= men) ? 'Female' : type === 'free' ? (manualGenders.get('p' + (i+1)) || 'Male') : 'Male'}));
    // Quick identities are device-only and must never reuse P1–Pn club records.
    const previous = new Map(schedulerState.allPlayers.map(p=>[p.name,p]));
    const roster = wanted.map(p => {
      const old=previous.get(p.name),rating=Number(old?.activeRating ?? old?.rating) || 1;
      return {name:p.name,gender:p.gender,rating,activeRating:rating,active:true,quickPlayer:true};
    });
    applyRoster(roster);
    guestPrepared = true;
    updateGuestGates();
    // Reuse the existing format setter after the numbered roster is ready.
    // Free, MD and LD use Doubles; XD uses Mixed.
    if (window.SCSOfflineRounds && typeof SCSOfflineRounds.setGameType === 'function') {
      SCSOfflineRounds.setGameType(mixed ? 'mixed' : 'doubles');
    }
    status(`${total} numbered players ready · Local only. Use Players to adjust ratings or gender.`);
    if (window.SCSOfflineRounds && typeof SCSOfflineRounds.refreshControls === 'function') SCSOfflineRounds.refreshControls();
    return true;
  } catch (error) { status(error && error.message ? error.message : 'Could not prepare players.'); return false; }
  finally { preparingGuest = false; updateGuestGates(); refreshQuickStart(); }
}
function init() {
  const panel = document.querySelector('.org-mode-panel-offline .org-imode-manager-tiles');
  if (!panel || el('scsPlayerSource')) return;
  const wrap = document.createElement('div');
  wrap.id = 'scsPlayerSource';
  wrap.innerHTML = `<div class="scs-mode-pill" role="group" aria-label="Player source"><button id="scsModeClub" type="button" aria-pressed="true">Normal Mode</button><button id="scsModeGuest" type="button" aria-pressed="false">Quick Mode</button></div><div id="scsGuestSetup" hidden><div class="scs-guest-heading">Quick Players</div><div class="scs-guest-type" role="radiogroup" aria-label="Guest player type"><label><input type="radio" name="scsGuestType" value="free" checked><span>Free</span></label><label><input type="radio" name="scsGuestType" value="md"><span>MD</span></label><label><input type="radio" name="scsGuestType" value="ld"><span>LD</span></label><label><input id="scsGuestTypeXD" type="radio" name="scsGuestType" value="xd"><span>XD</span></label></div><div id="scsGuestCountRow" class="scs-guest-counter-row"><span>Number of Players</span><div class="scs-guest-stepper"><button type="button" data-counter="scsGuestCount" data-delta="-1" aria-label="Decrease players">−</button><strong id="scsGuestCountValue">10</strong><button type="button" data-counter="scsGuestCount" data-delta="1" aria-label="Increase players">+</button></div><input id="scsGuestCount" type="hidden" value="10"></div><div id="scsGuestMixed" hidden><div class="scs-guest-counter-row"><span>Men</span><div class="scs-guest-stepper"><button type="button" data-counter="scsGuestMen" data-delta="-1" aria-label="Decrease men">−</button><strong id="scsGuestMenValue">6</strong><button type="button" data-counter="scsGuestMen" data-delta="1" aria-label="Increase men">+</button></div></div><div class="scs-guest-counter-row"><span>Women</span><div class="scs-guest-stepper"><button type="button" data-counter="scsGuestWomen" data-delta="-1" aria-label="Decrease women">−</button><strong id="scsGuestWomenValue">4</strong><button type="button" data-counter="scsGuestWomen" data-delta="1" aria-label="Increase women">+</button></div></div></div><input id="scsGuestMen" type="hidden" value="6"><input id="scsGuestWomen" type="hidden" value="4"><div id="scsGuestSummary" class="scs-guest-summary">Total: 10 players</div><button id="scsGuestPrepare" type="button" class="org-start-mode-btn scs-quick-generate" hidden>Generate Rounds</button><p id="scsGuestStatus" role="status" aria-live="polite" hidden></p></div>`;
  panel.parentNode.insertBefore(wrap, panel);
  // The existing court stepper stays in its original shared position below
  // Players and Fixed Pairs in both modes. Only preparation is invalidated.
  const sharedCourts = document.querySelector('.org-mode-panel-offline .org-offline-courts-section');
  if (sharedCourts) sharedCourts.addEventListener('click', event => {
    if (selectedMode === 'guest' && event.target.closest('button')) {
      invalidatePreparation();
      setTimeout(render, 0);
    }
  });
  wrap.querySelectorAll('[data-counter]').forEach(button => button.addEventListener('click', () => {
    const input = el(button.dataset.counter);
    const current = Number(input.value);
    const next = Math.max(0, Math.min(40, current + Number(button.dataset.delta)));
    if (current === next) return;
    input.value = String(next);
    el(button.dataset.counter + 'Value').textContent = String(next);
    invalidatePreparation();
    render();
  }));
  el('scsModeClub').addEventListener('click', () => switchMode('club'));
  el('scsModeGuest').addEventListener('click', () => switchMode('guest'));
  el('scsGuestPrepare').addEventListener('click', prepare);
  const start = el('sampleStartOfflineRound');
  if (start) {
    start.removeAttribute('onclick');
    start.addEventListener('click', startQuickOrNormal);
  }
  document.querySelectorAll('input[name="scsGuestType"]').forEach(input => input.addEventListener('change', () => { invalidatePreparation(); render(); }));
  ['scsGuestCount','scsGuestMen','scsGuestWomen'].forEach(id => {
    const input = el(id); if (input) input.addEventListener('input', invalidatePreparation);
  });
  ['sampleOfflineFormatDoubles','sampleOfflineFormatMixed','sampleOfflineFormatSingles'].forEach(id => {
    const button = el(id); if (button) button.addEventListener('click', () => setTimeout(render, 0));
  });
  render();
}
window.scsRoundPlayerSource = {
  restoreQuickSession(){selectedMode='guest';guestPrepared=true;render();},
  onSessionEnded() {
    guestPrepared = false;
    preparingGuest = false;
    status('');
    render();
  },
  onPlayerGenderChanged(player) {
    if (selectedMode !== 'guest' || !player) return;
    manualGenders.set(String(player.name).toLowerCase(), player.gender);
    invalidatePreparation();
    if (document.querySelector('input[name="scsGuestType"]:checked')?.value === 'xd') {
      const men = schedulerState.allPlayers.filter(p => p.gender === 'Male').length;
      const women = schedulerState.allPlayers.filter(p => p.gender === 'Female').length;
      el('scsGuestMen').value = String(men);
      el('scsGuestWomen').value = String(women);
      el('scsGuestMenValue').textContent = String(men);
      el('scsGuestWomenValue').textContent = String(women);
      render();
    }
  },
  render, getMode: () => selectedMode, controlsReady, updateGuestGates, quickConfig, refreshQuickStart};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
