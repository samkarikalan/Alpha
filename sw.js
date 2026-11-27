// SCS_BUILD_50_MYHUB_EMBEDDED_CLUBS_REPORT
/* Sports Club Scheduler service worker — complete installed-app updates. */
const APP_BASE = new URL('./', self.location.href);
const CACHE_PREFIX = 'scs-repo-cache-' + encodeURIComponent(APP_BASE.pathname) + '-';
const CACHE_NAME = CACHE_PREFIX + 'Rev1-clear-stage-entry-feedback';
const APP_SHELL = './index.html?v=Rev1';

const ASSETS = [
  './tournament-assignment-order.js?v=Rev1', './tournament-rev1.css?v=Rev1',
  './tournament-local.js?v=V965-R3',
  './workspace-bounds.js?v=V965-R3', './tournament-score-sync.js?v=V965-R3', './tournament-courts.js?v=V965-R3', './event-court-pool.js?v=V965-R3',
  './sport-context.js?v=V939', './single-login.js?v=V939', './scoreboard-app.js?v=V965-R3', './sport-pwa.js?v=V939', './slot-options.js?v=V939',
  './badminton/index.html?v=Rev1', './pickleball/index.html?v=Rev1', './scoreboard/index.html?v=Rev1', './tournaments/index.html?v=Rev1',
  './badminton/manifest.json?v=V939', './pickleball/manifest.json?v=V939', './scoreboard/manifest.json?v=V965-R3', './tournaments/manifest.json?v=V965-R3',
  ...['badminton','pickleball','scoreboard','tournaments'].flatMap(sport=>['180','192','512','maskable-512'].map(size=>'./'+sport+'/icon-'+size+'.png?v='+(sport==='scoreboard'||sport==='tournaments'?'V965-R3':'V939'))),
  './club-sport.js?v=V939',
  './app.css?v=V965-R3', './round-storage.js?v=V919',
  './scs-icon-180.png?v=V921', './scs-icon-192.png?v=V921', './scs-icon-512.png?v=V921', './scs-icon-maskable-512.png?v=V921',
  './sport-theme.js?v=V939',
  APP_SHELL,
  './scs-practice-card-pro.png', './scs-tournament-card-pro.png', './scs-practice-card-textfree.png', './scs-tournament-card-textfree.png',
  './shared-court-popup.js?v=V965-R3', './scs-api.js?v=V965-R3', './tournament-engine.js?v=V965-R3', './team-tournament.js?v=V965-R3', './shared-match-center.js?v=V965-R3', './group-tournament.js?v=V965-R3', './tournament-team-picker.js?v=V911', './tournament-players-page.js?v=V403', './tournament-bracket.js?v=V965-R3', './pickleball-scoring.js?v=V965-R3', './scoring.js?v=V965-R3', './standalone-scoring.js?v=V965-R3', './court-center.js?v=V965-R3', './offline-db.js?v=V149', './full-schedule.js?v=V626', './snapshot.js?v=V911', './unfinished-rounds.js?v=V939', './supabase.js?v=V965-R3', './auth.js?v=V939',
  './authUI.js?v=V939', './subscription.js?v=V911', './HomeScreen.js?v=V939', './role-workspaces.js?v=V939', './round-walkthrough.js?v=V911', './scoreboard-walkthrough.js?v=V911', './knockout-walkthrough.js?v=V911', './workspace-help.js?v=V965-R3', './member-home-empty.js?v=V911',
  './engjap.js?v=V939', './main.js?v=V919', './games.js?v=V939',
  './round-assistant.js?v=V919', './offline-rounds.js?v=V939', './rounds.js?v=V939', './mbm.js?v=V626', './players.js?v=V919',
  './importPlayers.js?v=V918', './settings.js?v=V911', './summary.js?v=V149',
  './help.js?v=V149', './profile.js?v=V149', './account-status.js?v=V911', './dashboard.js?v=V939',
  './slots.js?v=V939', './notifications.js?v=V911', './viewer.js?v=V807',
  './report.js?v=V149', './manifest.json?v=V921',
  './male.png?v=V149', './female.png?v=V149', './win-cup.png?v=V149',
  './welcome-default-myhub.png?v=V149', './welcome-default-round-manager.png?v=V149', './welcome-default-slot-manager.png?v=V149',
  './lock.png?v=V149', './unlock.png?v=V149', './icon-192.png?v=V921',
  './icon-512.png?v=V921', './clubs-brand.png?v=V149', './google-g.svg?v=V149', './help_en.json?v=V149', './help_jp.json?v=V149',
  './help_kr.json?v=V149', './help_zh.json?v=V149', './help_vi.json?v=V149'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Keep the app shell required; a transient failure for one optional asset
      // must not prevent a first-time Android service worker from installing.
      return fetch(new Request(APP_SHELL, { cache: 'reload' })).then(function(response) {
        if (!response || !response.ok) throw new Error('App shell HTTP ' + (response && response.status));
        return cache.put(APP_SHELL, response);
      }).then(function() { return Promise.all(ASSETS.filter(function(url) { return url !== APP_SHELL; }).map(function(url) {
        return fetch(new Request(url, { cache: 'reload' })).then(function(response) {
          if (!response || !response.ok) return;
          return cache.put(url, response);
        }).catch(function() {});
      })); });
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(key) { return (key.startsWith(CACHE_PREFIX) || (APP_BASE.pathname==='/' && /^scs-cache-/.test(key))) && key !== CACHE_NAME; })
        .map(function(key) { return caches.delete(key); }));
    }).then(function() { return self.clients.claim(); })
  );
});

function sportShell(address){const path=new URL(address).pathname;if(!path.startsWith(APP_BASE.pathname))return APP_SHELL;const match=path.slice(APP_BASE.pathname.length).match(/^(badminton|pickleball|scoreboard|tournaments)(?:\/|$)/);return match?'./'+match[1]+'/index.html?v=Rev1':APP_SHELL;}

function isApiRequest(url) {
  return url.includes('supabase.co') || url.includes('workers.dev') ||
    url.includes('/db/') || url.includes('/auth/') || url.includes('/sub/') ||
    url.includes('/generate-round') || url.includes('/tournament/');
}

self.addEventListener('fetch', function(event) {
  const address=new URL(event.request.url);
  if (event.request.method !== 'GET' || address.origin!==APP_BASE.origin || !address.pathname.startsWith(APP_BASE.pathname) || isApiRequest(event.request.url)) return;
  const isNavigation = event.request.mode === 'navigate';

  event.respondWith((async function() {
    try {
      const response = await fetch(event.request, { cache: 'no-store' });
      if (response && response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(isNavigation ? sportShell(event.request.url) : event.request, response.clone());
      }
      return response;
    } catch (error) {
      if (isNavigation) return (await (await caches.open(CACHE_NAME)).match(sportShell(event.request.url))) || Response.error();
      return (await (await caches.open(CACHE_NAME)).match(event.request)) ||
        (await (await caches.open(CACHE_NAME)).match(event.request, { ignoreSearch: true })) ||
        Response.error();
    }
  })());
});
