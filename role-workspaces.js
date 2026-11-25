/* V643: three workspaces reusing existing tournament navigation. */
(function () {
  'use strict';

  var ACTIVE_KEY = 'scs_active_role_workspace';
  var SESSION_KEY = 'scs_role_chosen_session';
  // Both workspaces are included in the single SCS license.
  var access = { member:true, manager:true, managerClubIds:[] };

  async function loadAccess() { return access; }

  function currentRole() {
    var selected = localStorage.getItem(ACTIVE_KEY);
    return (selected === 'manager' || selected === 'tournament') && access.manager ? selected : 'member';
  }

  function activeClubName(role) {
    var name = '';
    // Club Manager has its own selected club. Prefer it over the shared
    // member club so the drawer always identifies the workspace in use.
    if (role === 'manager' || role === 'tournament') name = localStorage.getItem('kbrr_vault_club_name') || '';
    if (typeof getMyClub === 'function') {
      try { var club = getMyClub(); if (!name) name = club && club.name || ''; } catch (_) {}
    }
    if (!name) name = localStorage.getItem('kbrr_my_club_name') || '';
    return name || 'No active club';
  }

  function syncMenu(role) {
    role = role || currentRole();
    var activeClub = null;
    try { activeClub = typeof getMyClub === 'function' ? getMyClub() : null; } catch (_) {}
    var hasActiveClub = !!(activeClub && activeClub.id) || !!localStorage.getItem('kbrr_vault_club_id');
    // One rule for the existing menu: a selected club disables Club Login.
    // Use the same selected-club state already displayed in this drawer.
    document.querySelectorAll('[data-scs-club-login]').forEach(function (button) {
      button.hidden = hasActiveClub;
      button.disabled = hasActiveClub;
      button.setAttribute('aria-disabled', String(hasActiveClub));
    });
    // Refresh existing drawer labels from the selected app language.
    var menuLanguage = (typeof currentLang !== 'undefined' && currentLang) || localStorage.getItem('appLanguage') || 'en';
    var menuDictionary = typeof translations !== 'undefined' ? (translations[menuLanguage] || translations.en || {}) : {};
    document.querySelectorAll('#scsPracticeSharedHeader [data-i18n]').forEach(function (element) {
      var value = menuDictionary[element.dataset.i18n];
      if (value) element.textContent = value;
    });
    document.body.dataset.scsRoleWorkspace = role;
    document.querySelectorAll('[data-scs-roles]').forEach(function (element) {
      var roles = String(element.getAttribute('data-scs-roles') || '').split(/\s+/);
      element.hidden = roles.indexOf(role) < 0 || (element.hasAttribute('data-scs-club-logged-in') && !hasActiveClub);
    });
    if (typeof scsUpdateSubscriptionMenuVisibility === 'function') scsUpdateSubscriptionMenuVisibility();
    document.querySelectorAll('[data-scs-manager-only]').forEach(function (element) { element.hidden = !access.manager; });
    var drawerClub = document.querySelector('#scsPracticeSharedHeader .scs-phase1-ref-panel-title strong');
    if (drawerClub) drawerClub.textContent = sharedClubIdentity().name;
    var clubCard = document.getElementById('scsDrawerActiveClubName');
    if (clubCard) clubCard.textContent = sharedClubIdentity().name;
    var title = document.getElementById('scsPracticeSharedTitle');
    var activityHome = document.getElementById('scsActivityHome');
    if (title && role === 'manager' && activityHome && !activityHome.hidden) title.textContent = (typeof translations!=='undefined'&&translations[(typeof currentLang!=='undefined'&&currentLang)||localStorage.getItem('appLanguage')||'en']||{}).scsClubManagerRole || 'Club Manager';
    if (title && document.getElementById('scsPracticeSharedHeader') && !document.getElementById('scsPracticeSharedHeader').hidden) {
      title.dataset.roleWorkspace = role;
    }
  }

  function closeChooser() {
    var overlay = document.getElementById('scsRoleWorkspaceChooser');
    if (overlay) overlay.remove();
  }

  async function selectRole(role) {
    setTimeout(function(){window.SCSUnfinishedRounds?.refresh?.();},0);
    role = role === 'tournament' ? 'tournament' : (role === 'manager' ? 'manager' : 'member');
    localStorage.setItem(ACTIVE_KEY, role);
    sessionStorage.setItem(SESSION_KEY, '1');
    closeChooser();
    if (role !== 'tournament' && window.TournamentNavigation) window.TournamentNavigation.close();
    syncMenu(role);
    if (role === 'tournament') {
      if (typeof saveVisibleWorkspaces === 'function') saveVisibleWorkspaces(['vault']);
      window.scsActivityMode = 'tournament';
      var activityHome = document.getElementById('scsActivityHome');
      if (activityHome) activityHome.hidden = true;
      var previousHome = document.getElementById('homePageOverlay');
      if (previousHome) previousHome.style.display = 'none';
      document.querySelectorAll('.page').forEach(function (page) { page.style.display = 'none'; });
      if (typeof scsOpenTournamentManager === 'function') scsOpenTournamentManager();
    } else if (role === 'manager') {
      if (typeof saveVisibleWorkspaces === 'function') saveVisibleWorkspaces(['vault']);
      // Home is not a Vault login operation. Never invoke requestVaultMode
      // while restoring an already-authorised manager workspace.
      if (typeof scsActivityShowHome === 'function') scsActivityShowHome();
      // Do not schedule a second home opening: it can cover a page selected immediately after login.
    } else {
      if (typeof saveVisibleWorkspaces === 'function') saveVisibleWorkspaces(['viewer']);
      window.scsActivityMode = 'member';
      var activityHome = document.getElementById('scsActivityHome');
      if (activityHome) activityHome.hidden = true;
      if (typeof switchMode === 'function') switchMode('viewer');
      var memberHub = document.getElementById('scsPracticeShowHub');
      if (memberHub) {
        memberHub.checked = true;
        memberHub.dispatchEvent(new Event('change', { bubbles:true }));
      }
      if (typeof showHomeScreen === 'function') showHomeScreen();
    }
  }

  // V651: the existing My Clubs page is the single club selector for all workspaces.
  function sharedClubIdentity() {
    var id = '', name = '';
    try {
      id = localStorage.getItem('kbrr_my_club_id') || '';
      name = id ? (localStorage.getItem('kbrr_my_club_name') || '') : '';
      if (!id && typeof getMyClub === 'function') {
        var club = getMyClub();
        if (club && club.id) { id = String(club.id); name = club.name || name; }
      }
    } catch (_) {}
    return { id:id, name:name || 'SCS' };
  }

  function refreshCentralClubCard() {
    var card = document.getElementById('scsCentralClubCard');
    if (!card) return;
    var club = window.SCSSportContext?.appModule==='tournaments'&&typeof getMyClub==='function'?getMyClub():sharedClubIdentity();
    var name = document.getElementById('scsCentralClubName');
    var hint = document.getElementById('scsCentralClubHint');
    if (name) name.textContent = club.name || (window.SCSSportContext?.appModule==='tournaments'?'Choose / Log in to a club':'SCS');
    if (hint) hint.textContent = '';
  }

  function openCentralMyClubs() {
    window.__scsMyClubsFromWelcome = true;
    closeChooser();
    if (typeof scsOpenStandaloneClubPage === 'function') scsOpenStandaloneClubPage();
    else if (typeof scsRoleMenuNavigate === 'function') scsRoleMenuNavigate('clubs');
    else if (typeof _showClubSetupSheet === 'function') _showClubSetupSheet('vault');
  }

  function showChooser() {
    if(window.SCSSportContext?.appModule==='scoreboard'&&window.SCSScoreboardApp){SCSScoreboardApp.showHome();return;}
    window.__scsMyClubsFromWelcome = false;
    closeChooser();
    var overlay = document.createElement('div');
    overlay.id = 'scsRoleWorkspaceChooser';
    overlay.className = 'scs-role-chooser';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'scsRoleChooserTitle');
    // The existing Settings language selection also applies to this dynamic chooser.
    overlay.innerHTML = `<div class="scs-welcome-hero"><button type="button" id="scsWelcomeSettings" aria-label="Choose default mode"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 3 1-2h4l1 2 2 1 3 0 2 4-2 2v3l2 2-2 4h-3l-2 1-1 2h-4l-1-2-2-1H4l-2-4 2-2v-3L2 8l2-4h3Z"/><circle cx="12" cy="12" r="4"/></svg></button><div class="scs-role-brand"><strong>SCS</strong><span>Sports Club Scheduler</span></div><svg class="scs-welcome-wave" viewBox="0 0 600 80" preserveAspectRatio="none" aria-hidden="true"><path fill="#00d3c3" d="M0 72C220 100 410 18 600 0V80H0Z"/><path class="scs-wave-body" d="M0 76C210 100 420 25 600 16V80H0Z"/></svg></div><div class="scs-welcome-content"><h1 id="scsRoleChooserTitle">Welcome to SCS</h1><p class="scs-welcome-tagline">Play <i>•</i> Organise <i>•</i> Manage</p><div class="scs-role-sport-picker" role="group" aria-label="Preferred sport"><button type="button" data-scs-sport="badminton" aria-pressed="true"><span aria-hidden="true">🏸</span> Badminton</button><button type="button" data-scs-sport="pickleball" aria-pressed="false"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13"/><circle cx="12" cy="9" r="1.5"/><circle cx="22" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="18" cy="21" r="1.5"/><circle cx="16" cy="15" r="1.5"/></svg> Pickleball</button></div><button type="button" id="scsCentralClubCard" class="scs-central-club-card" aria-label="Open My Clubs"><span class="scs-central-club-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="currentColor"><circle cx="16" cy="9" r="5"/><circle cx="5" cy="12" r="3"/><circle cx="27" cy="12" r="3"/><path d="M7 29v-4a9 9 0 0 1 18 0v4ZM0 25v-3a6 6 0 0 1 6-6l3 1a12 12 0 0 0-4 8ZM27 25a12 12 0 0 0-4-8l3-1a6 6 0 0 1 6 6v3Z"/></svg></span><span class="scs-central-club-label">ACTIVE CLUB</span><strong id="scsCentralClubName">SCS</strong><span class="scs-central-club-chevron" aria-hidden="true">›</span></button><button type="button" id="scsWelcomeEnter" data-role-choice="member"><span aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 2v20l17-10Z"/></svg></span><b>Enter Lite Mode</b><span aria-hidden="true">→</span></button><p class="scs-welcome-default">Default mode: <strong id="scsWelcomeDefault">Lite</strong></p></div>`;
    var language = (typeof currentLang !== 'undefined' && currentLang) || localStorage.getItem('appLanguage') || 'en';
    var dictionary = typeof translations !== 'undefined' ? (translations[language] || translations.en || {}) : {};
    overlay.querySelectorAll('[data-i18n]').forEach(function (element) {
      var translated = dictionary[element.dataset.i18n];
      if (translated) element.textContent = translated;
    });
    document.body.appendChild(overlay);
    refreshCentralClubCard();
    // Preference only: do not alter club, player, slot or round filtering.
    var sportKey = 'scsPreferredSport';
    var currentSport = 'badminton';
    try { if (localStorage.getItem(sportKey) === 'pickleball') currentSport = 'pickleball'; } catch (_) {}
    function renderSportSelection() {
      overlay.querySelectorAll('[data-scs-sport]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.getAttribute('data-scs-sport') === currentSport));
      });
    }
    renderSportSelection();
    overlay.querySelectorAll('[data-scs-sport]').forEach(function (button) {
      button.addEventListener('click', function () {
        currentSport = button.getAttribute('data-scs-sport');
        try { localStorage.setItem(sportKey, currentSport); } catch (_) {}
        if(window.SCSSportTheme)SCSSportTheme.setSport(currentSport);
        renderSportSelection();
      });
    });
    overlay.querySelector('#scsCentralClubCard').addEventListener('click', openCentralMyClubs);
    var modeNames={member:'Lite',manager:'Advanced',tournament:'Tournament'};
    var defaultMode='member';
    try{var saved=localStorage.getItem('scs_default_mode');if(modeNames[saved])defaultMode=saved;}catch(_){}
    function renderDefault(){
      var enter=overlay.querySelector('#scsWelcomeEnter');enter.dataset.roleChoice=defaultMode;
      enter.querySelector('b').textContent='Enter '+modeNames[defaultMode]+' Mode';
      overlay.querySelector('#scsWelcomeDefault').textContent=modeNames[defaultMode];
    }
    renderDefault();
    overlay.querySelector('#scsWelcomeEnter').onclick=function(){selectRole(defaultMode).catch(function(error){if(typeof showToast==='function')showToast(error.message);});};
    overlay.querySelector('#scsWelcomeSettings').onclick=function(){
      var sheet=document.createElement('dialog');sheet.id='scsWelcomeModeSettings';sheet.setAttribute('aria-labelledby','scsWelcomeModeTitle');
      sheet.innerHTML='<header><h2 id="scsWelcomeModeTitle">Default mode</h2><button type="button" aria-label="Close mode settings">×</button></header><p>Choose the mode shown on your front page.</p><fieldset><legend class="scs-sr-only">Default mode</legend>'+Object.keys(modeNames).map(function(mode){return '<label><input type="radio" name="scsDefaultMode" value="'+mode+'" '+(mode===defaultMode?'checked':'')+'><span><strong>'+modeNames[mode]+' Mode</strong><small>'+({member:'Play and organise rounds',manager:'Manage your club, players and slots',tournament:'Manage events and matches'}[mode])+'</small></span></label>';}).join('')+'</fieldset><button type="button" id="scsWelcomeSaveDefault">Save default</button>';
      document.body.appendChild(sheet);
      sheet.querySelector('header button').onclick=function(){sheet.close();};
      sheet.addEventListener('close',function(){sheet.remove();overlay.querySelector('#scsWelcomeSettings')?.focus();});
      sheet.querySelector('#scsWelcomeSaveDefault').onclick=function(){defaultMode=sheet.querySelector('input:checked').value;try{localStorage.setItem('scs_default_mode',defaultMode);}catch(_){}renderDefault();sheet.close();};
      sheet.showModal();
    };
    if(window.SCSSportContext?.appModule==='tournaments'){
      if(window.TournamentNavigation)TournamentNavigation.close();
      overlay.classList.add('scs-tournament-app-welcome');
      overlay.querySelector('#scsRoleChooserTitle').textContent='Welcome to SCS Tournaments';
      overlay.querySelector('.scs-role-brand > span').textContent='Tournament Manager';
      overlay.querySelector('.scs-welcome-tagline').textContent='Create · Organise · Manage';
      overlay.querySelector('#scsWelcomeEnter b').textContent='Enter Tournament Manager';
      overlay.querySelector('#scsWelcomeEnter').dataset.roleChoice='tournament';
      overlay.querySelector('#scsWelcomeEnter').onclick=()=>selectRole('tournament').catch(error=>{if(typeof showToast==='function')showToast(error.message);});
      const active=typeof getMyClub==='function'?getMyClub():null;
      overlay.querySelector('.scs-central-club-label').textContent=active?.id?'ACTIVE CLUB':'MY CLUB / LOGIN';
    }

  }

  async function routeAfterLogin() {
    if(window.SCSSportContext?.appModule==='tournaments'){showChooser();return true;}
    if(window.SCSSportContext?.appModule==='scoreboard'&&window.SCSScoreboardApp){await SCSScoreboardApp.showHome();return true;}
    await loadAccess(true);
    // Do not recreate the chooser when another login callback finishes after
    // the user already selected a workspace in this tab.
    // Each app launch starts at SCS Welcome. A remembered workspace must not
    // be opened first and then covered by the chooser.
    sessionStorage.removeItem(SESSION_KEY);
    showChooser();
    await window.SCSUnfinishedRounds?.offer?.();
    return true;
  }

  async function switchWorkspace() {
    // Conduct a Match is a separate full-screen scoring overlay. Retire the
    // tournament view before opening the shared workspace chooser; otherwise
    // its persistent header/menu can remain above the destination workspace.
    if (window.TournamentNavigation && typeof window.TournamentNavigation.close === 'function') {
      window.TournamentNavigation.close();
    }
    await loadAccess(false);
    sessionStorage.removeItem(SESSION_KEY);
    showChooser();
  }

  function menuNavigate(target) {
    // A destination selected from the shared hamburger closes Club Login.
    // Opening/dismissing the hamburger itself never changes the current page.
    if (target !== 'club-access' && target !== 'club-change') {
      var clubSetup = document.getElementById('clubSetupSheetOverlay');
      if (clubSetup && typeof _clubSetupClose === 'function') _clubSetupClose(false);
    }

    var drawer = document.querySelector('#scsPracticeSharedHeader details');
    if (drawer) drawer.open = false;
    if ((target === 'workspace-home' || target === 'member-home') && window.TournamentNavigation && typeof window.TournamentNavigation.close === 'function') {
      window.TournamentNavigation.close();
    }
    var activityHome = document.getElementById('scsActivityHome');
    if (activityHome && target !== 'workspace-home') {
      var closeActivityHome = function () { activityHome.hidden = true; };
      closeActivityHome();
      // Close synchronously. Delayed writes used to race against later navigation.
    }
    // A drawer selection owns the navigation. Retire the previous workspace
    // before calling a destination's loader: otherwise that loader can briefly
    // reveal the previous page (or a stale tournament overlay) underneath it.
    // The destination itself remains responsible for showing its own page.
    if (target !== 'member-home' && target !== 'workspace-home' &&
        target !== 'club-access' && target !== 'club-logout') {
      var oldHome = document.getElementById('homePageOverlay');
      if (oldHome) oldHome.style.display = 'none';
      document.querySelectorAll('.page').forEach(function (page) {
        page.style.display = 'none';
      });
      ['scsTournamentManager', 'scsTournamentContinue', 'scsTournamentLive',
       'scsTournamentTypePicker', 'scsScoringOverlay'].forEach(function (id) {
        var overlay = document.getElementById(id);
        if (overlay) overlay.hidden = true;
      });
    }
    if (target === 'member-home') { selectRole('member'); return; }
    if (target === 'workspace-home') { selectRole(currentRole()); return; }
    if (target === 'club-change') {
      // Reuse the existing club selection / authentication screen; never
      // change the selected club before the existing login succeeds.
      if (typeof _showClubSetupSheet === 'function') _showClubSetupSheet('vault');
      return;
    }
    if (target === 'club-access') {
      // Do not navigate or authenticate when already connected to a club.
      var memberClub = null;
      try { memberClub = typeof getMyClub === 'function' ? getMyClub() : null; } catch (_) {}
      if ((memberClub && memberClub.id) || localStorage.getItem('kbrr_vault_club_id')) {
        syncMenu();
        return;
      }
      // No selected club: open the proven Club Login / Create page directly.
      if (typeof _showClubSetupSheet === 'function') _showClubSetupSheet('vault');
      return;
    }
    if (target === 'club-logout') {
      if (typeof welcomeLogoutWorkspace === 'function') welcomeLogoutWorkspace('vault');
      else if (typeof vaultLogoutClub === 'function') vaultLogoutClub();
      syncMenu('manager');
      if (typeof scsActivityShowHome === 'function') scsActivityShowHome();
      return;
    }
    if (target === 'clubs' || target === 'account') { if (typeof scsOpenStandaloneClubPage === 'function') scsOpenStandaloneClubPage(); return; }
    if (target === 'my-slots') {
      // Round Manager leaves appMode='organiser'. My Slots belongs to the
      // viewer workspace, so restore it before selecting the slots tab.
      // Do not call selectRole('member'): it resets the member home tab.
      if (typeof appMode !== 'undefined' && appMode !== 'viewer' &&
          typeof switchMode === 'function') switchMode('viewer');
      if (typeof homeOpenViewerSlots === 'function') homeOpenViewerSlots();
      return;
    }
    if (target === 'rounds') {
      // Prevent showHomeScreen() from treating this as an unset activity and
      // reopening Club Manager Home over Round Manager.
      window.scsActivityMode = 'practice';
      // The unchecked legacy hub switch displays the full-screen Practice
      // welcome layer. Round Manager shares that overlay, so hide the welcome.
      var practiceHub = document.getElementById('scsPracticeShowHub');
      if (practiceHub) practiceHub.checked = true;
      var id = currentRole() === 'manager'
        ? (localStorage.getItem('kbrr_vault_club_id') || localStorage.getItem('kbrr_org_club_id') || localStorage.getItem('kbrr_my_club_id') || '')
        : (localStorage.getItem('kbrr_org_club_id') || localStorage.getItem('kbrr_my_club_id') || '');
      if (typeof openOrganiserWorkspaceForMember === 'function') openOrganiserWorkspaceForMember(id);
      return;
    }
    if (target === 'standalone-scoring') {
      var scoringRole=currentRole();
      if (window.SCSScoring && typeof SCSScoring.open === 'function') SCSScoring.open({workspace:scoringRole,onClose:function(){menuNavigate(scoringRole==='member'?'member-home':'workspace-home');}});
      return;
    }
    if (target === 'tournaments') { selectRole('tournament'); return; }
    if (target === 'players') {
      // Open the requested page directly. scsPrimaryNavigate('vault') first
      // opens Slot Manager and can asynchronously repaint it over Players.
      if (typeof homeGo === 'function') homeGo('vaultModifyPage',null);
      if (typeof vaultRenderModify === 'function') vaultRenderModify();
      return;
    }
    if (target === 'slots') {
      // The destination is Slot Manager, never Club Manager home.
      window.scsActivityMode = 'practice';
      if (typeof scsPrimaryNavigate === 'function') scsPrimaryNavigate('vault');
      return;
    }
    if (target === 'dashboard') { if (typeof homeGo === 'function') homeGo('dashboardPage','tabBtnDashboard'); return; }
    if (target === 'subscription') {
      if (typeof homeGo === 'function') homeGo('scsSubscriptionPage', null);
      else if (typeof showPage === 'function') showPage('scsSubscriptionPage', null);
      if (typeof subShowTrialBanner === 'function') subShowTrialBanner();
      return;
    }
    if (target === 'settings') {
      if (typeof homeGo === 'function') homeGo('settingsPage', 'tabBtnSettings');
      if (currentRole() === 'manager') window.__scsSettingsReturnState = { activityHome:true };
    }
  }

  function closeVisiblePlayerManager() {
    var modify = document.getElementById('vaultModifyPage');
    if (modify && getComputedStyle(modify).display !== 'none') {
      modify.style.display = 'none';
      menuNavigate('workspace-home');
      return;
    }
    var players = document.getElementById('playersPage');
    if (players && getComputedStyle(players).display !== 'none' && typeof navBack === 'function') {
      navBack();
      return;
    }
    menuNavigate(currentRole() === 'manager' ? 'workspace-home' : 'member-home');
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Show the chooser immediately for an authenticated user, before the
    // member HomeScreen startup handlers can expose the old workspace.
    if (typeof authIsLoggedIn === 'function' && authIsLoggedIn()) {
      sessionStorage.removeItem(SESSION_KEY);
      showChooser();
    }
    loadAccess(false).then(function () { syncMenu(); });
    var drawer = document.querySelector('#scsPracticeSharedHeader details');
    if (drawer) drawer.addEventListener('toggle', function () { if (drawer.open) { syncMenu(); if (typeof scsRefreshAccountPlanPill === 'function') scsRefreshAccountPlanPill(); } });
    var title = document.getElementById('scsPracticeSharedTitle');
    var activityHome = document.getElementById('scsActivityHome');
    if (title && activityHome && typeof MutationObserver === 'function') {
      var enforceTitle = function () {
        if (currentRole() === 'manager' && !activityHome.hidden && title.textContent !== ((typeof translations!=='undefined'&&translations[(typeof currentLang!=='undefined'&&currentLang)||localStorage.getItem('appLanguage')||'en']||{}).scsClubManagerRole || 'Club Manager')) title.textContent = (typeof translations!=='undefined'&&translations[(typeof currentLang!=='undefined'&&currentLang)||localStorage.getItem('appLanguage')||'en']||{}).scsClubManagerRole || 'Club Manager';
      };
      new MutationObserver(enforceTitle).observe(title, { childList:true, characterData:true, subtree:true });
      new MutationObserver(enforceTitle).observe(activityHome, { attributes:true, attributeFilter:['hidden'] });
    }
    var authOverlay = document.getElementById('authOverlay');
    if (authOverlay && activityHome && typeof MutationObserver === 'function') {
      var protectLoggedOutHome = function () {
        if (getComputedStyle(authOverlay).display !== 'none') activityHome.hidden = true;
      };
      new MutationObserver(protectLoggedOutHome).observe(authOverlay, { attributes:true, attributeFilter:['style','class','hidden'] });
      protectLoggedOutHome();
    }
  });
  window.addEventListener('storage', function (event) {
    if (!event.key || event.key === ACTIVE_KEY || /kbrr_(my|org|vault)_club_(id|name)/.test(event.key)) syncMenu();
  });

  window.SCSRoleWorkspaces = Object.freeze({ loadAccess:loadAccess, routeAfterLogin:routeAfterLogin, select:selectRole, switchWorkspace:switchWorkspace, syncMenu:syncMenu, current:currentRole, menuNavigate:menuNavigate });
  window.scsRouteAfterLoginByRole = routeAfterLogin;
  window.scsSwitchRoleWorkspace = switchWorkspace;
  window.scsReturnMyClubsToWelcome = function () {
    if (!window.__scsMyClubsFromWelcome) return false;
    window.__scsMyClubsFromWelcome = false;
    var clubs = document.getElementById('joinClubPage');
    if (clubs) clubs.style.display = 'none';
    var drawer = document.querySelector('#scsPracticeSharedHeader details');
    if (drawer) drawer.open = false;
    showChooser();
    return true;
  };
  // The plan indicator is a shortcut to the existing Settings subscription card.
  // Account's surrounding menu button retains its original navigation.
  window.scsOpenAccountSubscription = function () {
    var drawer = document.querySelector('#scsPracticeSharedHeader details');
    if (drawer) drawer.open = false;
    menuNavigate('settings');
    if (typeof subShowTrialBanner === 'function') subShowTrialBanner();
    requestAnimationFrame(function () {
      var section = document.getElementById('scsSubscriptionPage');
      if (section) section.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  };
  window.scsRoleMenuNavigate = menuNavigate;
  window.scsCloseVisiblePlayerManager = closeVisiblePlayerManager;
  window.scsReturnToRoleHome = function () { menuNavigate(currentRole() === 'member' ? 'member-home' : 'workspace-home'); };
})();
