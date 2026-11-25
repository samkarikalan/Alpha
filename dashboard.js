/* ============================================================
   DASHBOARD -- Live & past sessions for the club
   File: dashboard.js
   ============================================================ */

var _dashboardTimer     = null;
var _dashboardPollTimer = null;
var _dashboardLiveIds   = []; // track live IDs plus update timestamps
// Keep user-controlled slot expansion independent of DOM replacements during sync.
var _dashboardExpandedSlotIds = new Set();
var _dashboardGroupStates = new Map();
// Snapshot UI state before replacing DOM; refresh must not be treated as a tap.
function _dashRememberVisibleState(container) {
  if (!container) return;
  container.querySelectorAll('.mc-slot-card[data-slot-id]').forEach(card => {
    const id = card.dataset.slotId;
    if (!id) return;
    const details = card.querySelector('.dash-slot-details-wrap');
    const open = details ? details.style.display !== 'none' : card.classList.contains('is-expanded');
    if (open) _dashboardExpandedSlotIds.add(id);
    else _dashboardExpandedSlotIds.delete(id);
  });
  container.querySelectorAll('.dash-club-group').forEach(group => {
    const key = group.dataset.groupKey;
    if (key) _dashboardGroupStates.set(key, group.classList.contains('is-open'));
  });
}


function _dashDateStr(year, month, day) {
  const d = new Date(year, month, day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _dashFormatTime(t24) {
  if (typeof _vsFormatTime === 'function') return _vsFormatTime(t24);
  return String(t24 || '').slice(0, 5);
}

function _dashSlotLooksPlayed(slot, sameDateItems) {
  const status = String((slot && slot.status) || '').toLowerCase();
  if (['played', 'completed', 'started'].includes(status)) return true;
  return (sameDateItems || []).some(item => {
    if (!item || item.isSlot || item.isLive) return false;
    return item.source_slot_id && String(item.source_slot_id) === String(slot.id);
  });
}

/* ── Dashboard polling -- detects session status changes ── */
function dashboardStartPoll() {
  dashboardStopPoll();
  _dashboardPollTimer = setInterval(async () => {
    // Only poll if dashboard is visible
    const dashPage = document.getElementById('dashboardPage');
    if (!dashPage || dashPage.style.display === 'none') {
      dashboardStopPoll(); return;
    }
    try {
      const isViewer = (typeof appMode !== 'undefined') && appMode === 'viewer';
      let currentLiveIds = [];

      if (isViewer) {
        const myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
        if (!myPlayer) return;
        const clubIds = await dbGetPlayerClubs(myPlayer.name);
        if (!clubIds.length) return;
        const inList = '(' + clubIds.join(',') + ')';
        const rows = await sbGet('sessions',
          `club_id=in.${inList}&status=eq.live&select=id,updated_at`
        );
        currentLiveIds = (rows || []).map(r => String(r.id) + ':' + String(r.updated_at || ''));
      } else {
        const club = (typeof getMyClub === 'function') ? getMyClub() : null;
        if (!club || !club.id) return;
        const rows = await sbGet('sessions',
          `club_id=eq.${club.id}&status=eq.live&select=id,updated_at`
        );
        currentLiveIds = (rows || []).map(r => String(r.id) + ':' + String(r.updated_at || ''));
      }

      // Re-render if live sessions changed
      const prev = _dashboardLiveIds.slice().sort().join(',');
      const curr = currentLiveIds.slice().sort().join(',');
      if (prev !== curr) {
        _dashboardLiveIds = currentLiveIds;
        if (typeof renderDashboard === 'function') renderDashboard();
      }
    } catch (e) { /* silent */ }
  }, 60000);
}

function dashboardStopPoll() {
  if (_dashboardPollTimer) { clearInterval(_dashboardPollTimer); _dashboardPollTimer = null; }
}

/* ── Called when Dashboard tab opens ── */

// ── Dashboard Calendar ────────────────────────────────────────────────────────
// Builds the calendar grid. `sessionsByDate` is a map of "YYYY-MM-DD" -> array
// of session objects for the CURRENTLY VIEWED month (already fetched by the
// caller for that month — see renderDashboard's loadMonth()).
// `onMonthChange(year, month)` is called when the user navigates months, so
// the caller can fetch that month's sessions and re-render with fresh dots.
// `onDateSelect(dateStr, sessions)` is called when a date cell is tapped.
function _dashAppLocale() {
  const code = (typeof currentLang !== 'undefined' ? currentLang : 'en');
  return ({ en:'en-US', jp:'ja-JP', kr:'ko-KR', vi:'vi-VN', zh:'zh-CN' })[code] || 'en-US';
}
function _dashWeekdayLabels() {
  const code = (typeof currentLang !== 'undefined' ? currentLang : 'en');
  return ({
    en:['Su','Mo','Tu','We','Th','Fr','Sa'],
    jp:['日','月','火','水','木','金','土'],
    kr:['일','월','화','수','목','금','토'],
    vi:['CN','T2','T3','T4','T5','T6','T7'],
    zh:['日','一','二','三','四','五','六']
  })[code] || ['Su','Mo','Tu','We','Th','Fr','Sa'];
}

function _buildDashboardCalendar(viewYear, viewMonth, sessionsByDate, onMonthChange, onDateSelect, selectedDate) {
  const now = new Date();
  const wrapper = document.createElement('div');
  wrapper.className = 'dash-calendar';

  function render() {
    wrapper.innerHTML = '';

    // ── Header ──
    const header = document.createElement('div');
    header.className = 'dash-cal-header';
    const monthName = new Date(viewYear, viewMonth, 1)
      .toLocaleString(_dashAppLocale(), { month: 'long', year: 'numeric' });
    header.innerHTML = `
      <button class="dash-cal-nav" id="dashCalPrev">‹</button>
      <span class="dash-cal-month">${monthName}</span>
      <button class="dash-cal-nav" id="dashCalNext">›</button>`;
    wrapper.appendChild(header);

    // ── Day labels ──
    const dayRow = document.createElement('div');
    dayRow.className = 'dash-cal-days';
    _dashWeekdayLabels().forEach(d => {
      const el = document.createElement('div');
      el.className = 'dash-cal-day-label';
      el.textContent = d;
      dayRow.appendChild(el);
    });
    wrapper.appendChild(dayRow);

    // ── Grid ──
    const grid = document.createElement('div');
    grid.className = 'dash-cal-grid';

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayStr = localDateStr(now);

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      const blank = document.createElement('div');
      blank.className = 'dash-cal-cell empty';
      grid.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const sessions = sessionsByDate[dateStr] || [];
      const isToday    = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      const hasSlot  = sessions.some(s => s.isSlot);
      const hasLive  = sessions.some(s => s.isLive);
      const hasPast  = sessions.some(s => !s.isLive && !s.isSlot);

      const cell = document.createElement('div');
      cell.className = 'dash-cal-cell'
        + (isToday ? ' today' : '')
        + (isSelected ? ' selected' : '')
        + (sessions.length ? ' has-session' : '');
      cell.innerHTML = `<span class="dash-cal-num">${day}</span>`;

      if (hasLive || hasSlot) {
        const dot = document.createElement('span');
        dot.className = 'dash-cal-dot live';
        cell.appendChild(dot);
      } else if (hasPast) {
        const dot = document.createElement('span');
        dot.className = 'dash-cal-dot past';
        cell.appendChild(dot);
      }

      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => {
        if (typeof onDateSelect === 'function') onDateSelect(dateStr, sessions);
      });

      grid.appendChild(cell);
    }

    wrapper.appendChild(grid);

    // Nav handlers
    wrapper.querySelector('#dashCalPrev').addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      if (typeof onMonthChange === 'function') onMonthChange(viewYear, viewMonth);
    });
    wrapper.querySelector('#dashCalNext').addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      if (typeof onMonthChange === 'function') onMonthChange(viewYear, viewMonth);
    });
  }

  render();
  return wrapper;
}

async function renderDashboard() {
  if (typeof viewerStopPoll === 'function') viewerStopPoll(); // stop any active poll
  dashboardStopPoll(); // stop dashboard poll when leaving
  const container = document.getElementById('dashboardContainer');
  if (!container) return;

  const isViewer = (typeof appMode !== 'undefined') && appMode === 'viewer';
  const myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
  const club     = (typeof getMyClub === 'function') ? getMyClub() : null;

  // Viewer needs a profile; organiser needs a club
  if (isViewer && !myPlayer) {
    container.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-icon">👤</div>
        <p>${t("setupProfileFirst")}</p>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">${t("tapProfileIcon")}</p>
      </div>`;
    return;
  }
  if (!isViewer && (!club || !club.id)) {
    container.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-icon">🏟️</div>
        <p>${t("noClubSelectedDash")}</p>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">${t("goToClubTab")}</p>
      </div>`;
    return;
  }

  _dashRememberVisibleState(container);
  container.innerHTML = '<div class="dashboard-loading"><div class="help-spinner"></div></div>';

  const now = new Date();
  let currentYear  = now.getFullYear();
  let currentMonth = now.getMonth(); // 0-indexed
  let selectedDate = localDateStr(now); // auto-select today on first load

  // Enrich a session list with club_name for viewer mode (organiser already knows its own club name)
  async function enrichWithClubNames(sessions) {
    if (!isViewer || !sessions.length) return sessions;
    try {
      const allClubIds = [...new Set(sessions.map(s => s.club_id).filter(Boolean))];
      if (!allClubIds.length) return sessions;
      const clubs = await Promise.all(
        allClubIds.map(id => sbGet('clubs', `id=eq.${id}&select=id,name`).catch(() => []))
      );
      const clubMap = {};
      clubs.flat().forEach(c => { if (c) clubMap[c.id] = c.name; });
      sessions.forEach(s => { s.club_name = clubMap[s.club_id] || s.club_id; });
    } catch (e) { /* silent */ }
    return sessions;
  }

  // Build a date -> sessions[] map for one month, combining live (today only,
  // since live sessions don't have a fixed historical date) + completed sessions
  // fetched via the uncapped month-range query.
  async function fetchMonthData(year, month) {
    const monthSessions = await dbGetSessionsForMonth(year, month).catch(() => []);
    await enrichWithClubNames(monthSessions);

    const map = {};
    const todayStr = localDateStr(now);
    monthSessions.forEach(s => {
      const d = s.date || (s.updated_at || '').split('T')[0];
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push({ ...s, isLive: false });
    });

    // Live sessions belong to "today" — only merge them in if today falls
    // within the currently viewed month.
    if (isViewer && year === now.getFullYear() && month === now.getMonth()) {
      const liveSessions = await dbGetLiveSessions().catch(() => []);
      await enrichWithClubNames(liveSessions);
      if (liveSessions.length) {
        if (!map[todayStr]) map[todayStr] = [];
        map[todayStr] = [...liveSessions.map(s => ({ ...s, isLive: true })), ...map[todayStr]];
      }
    }

    if (!isViewer && club && club.id && typeof dbGetSlotsForRange === 'function') {
      const startStr = _dashDateStr(year, month, 1);
      const endStr = _dashDateStr(year, month + 1, 0);
      const slots = await dbGetSlotsForRange(club.id, startStr, endStr).catch(() => []);
      (slots || []).forEach(slot => {
        const d = slot.slot_date;
        if (!d) return;
        const slotStatus = String(slot.status || '').toLowerCase();
        const isCancelled = slotStatus === 'cancelled';
        // Upcoming active slots remain limited to today/future. Cancelled slots
        // stay visible on their original date so the organiser can verify why
        // a session has no played record.
        if (d < todayStr && !isCancelled) return;
        if (_dashSlotLooksPlayed(slot, map[d] || [])) return;
        if (!map[d]) map[d] = [];
        map[d].push({ ...slot, isSlot: true });
      });
    }

    Object.keys(map).forEach(d => {
      map[d].sort((a, b) => {
        if (!!a.isSlot !== !!b.isSlot) return a.isSlot ? -1 : 1;
        const at = String(a.start_time || a.updated_at || '');
        const bt = String(b.start_time || b.updated_at || '');
        return at.localeCompare(bt);
      });
    });

    return map;
  }

  // Render the list of session cards for whichever date is currently selected
  function renderSelectedDateSessions(listEl, dateStr, sessions) {
    listEl.innerHTML = '';
    const heading = document.createElement('div');
    heading.className = 'dash-section-title';
    const isToday = dateStr === localDateStr(now);
    heading.innerHTML = isToday
      ? `<span class="dash-live-dot"></span> ${t("liveNowTitle") || 'Today'}`
      : `📅 ${_formatDate(dateStr)}`;
    listEl.appendChild(heading);

    if (!sessions.length) {
      const empty = document.createElement('div');
      empty.className = 'dash-empty-inline';
      empty.textContent = (!isViewer && dateStr >= localDateStr(now))
        ? (t('noSlotsOnDate') || 'No slots on this date')
        : (isToday ? (t("noActiveSessions") || 'No sessions today') : (t("noRecentSessions") || 'No sessions on this date'));
      listEl.appendChild(empty);
      return;
    }

    // Build 601: on My Hub, organise today's live sessions by club.
    // The club with the most recently updated live session is first and open;
    // all other club groups start collapsed. Existing session cards/functions stay unchanged.
    if (isViewer && isToday) {
      const liveSessions = sessions.filter(sess => sess && sess.isLive);
      const otherSessions = sessions.filter(sess => !sess || !sess.isLive);

      const recentValue = sess => {
        const raw = sess.updated_at || sess.started_at || sess.created_at || sess.date || '';
        const n = Date.parse(raw);
        return Number.isFinite(n) ? n : 0;
      };

      liveSessions.sort((a, b) => recentValue(b) - recentValue(a));

      const groups = new Map();
      liveSessions.forEach(sess => {
        const clubName = sess.club_name || sess.club_id || (t('unknownClub') || 'Club');
        if (!groups.has(clubName)) groups.set(clubName, []);
        groups.get(clubName).push(sess);
      });

      [...groups.entries()]
        .sort((a, b) => recentValue(b[1][0]) - recentValue(a[1][0]))
        .forEach(([clubName, clubSessions], groupIndex) => {
          const group = document.createElement('section');
          const groupKey = 'live:' + clubName;
          const groupOpen = _dashboardGroupStates.has(groupKey) ? _dashboardGroupStates.get(groupKey) : groupIndex === 0;
          group.dataset.groupKey = groupKey;
          group.className = 'dash-club-group' + (groupOpen ? ' is-open' : '');

          const toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'dash-club-group-toggle';
          toggle.setAttribute('aria-expanded', groupOpen ? 'true' : 'false');
          toggle.innerHTML = `<span class="dash-club-group-name">${_dashEscapeHtml(clubName)}</span><span class="dash-club-group-count">${clubSessions.length} ${clubSessions.length === 1 ? 'live session' : 'live sessions'}</span><span class="dash-club-group-chevron">⌄</span>`;

          const body = document.createElement('div');
          body.className = 'dash-club-group-body';

          clubSessions.forEach(sess => {
            const players = (sess.players && sess.players.length) ? sess.players : _extractPlayersFromRounds(sess.rounds_data || []);
            body.appendChild(_buildSessionCard({
              clubName,
              starter:     sess.started_by,
              players,
              totalRounds: (sess.rounds_data || []).length || null,
              isLive:      true,
              sessionId:   sess.id,
              date:        sess.date,
              updatedAt:   sess.updated_at,
              shuttleData: sess.shuttle_data || null,
              handoverPin: sess.handover_pin || null
            }));
          });

          toggle.addEventListener('click', () => {
            const open = group.classList.toggle('is-open');
            _dashboardGroupStates.set(groupKey, open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
          });
          group.appendChild(toggle);
          group.appendChild(body);
          listEl.appendChild(group);
        });

      // Build 602: finished sessions on My Hub use the same club grouping.
      // Most recent finished club/session is first; remaining clubs stay collapsed.
      const finishedSessions = otherSessions.filter(sess => sess && !sess.isSlot);
      const slotSessions = otherSessions.filter(sess => sess && sess.isSlot);

      finishedSessions.sort((a, b) => recentValue(b) - recentValue(a));
      const finishedGroups = new Map();
      finishedSessions.forEach(sess => {
        const clubName = sess.club_name || sess.club_id || (t('unknownClub') || 'Club');
        if (!finishedGroups.has(clubName)) finishedGroups.set(clubName, []);
        finishedGroups.get(clubName).push(sess);
      });

      [...finishedGroups.entries()]
        .sort((a, b) => recentValue(b[1][0]) - recentValue(a[1][0]))
        .forEach(([clubName, clubSessions], groupIndex) => {
          const group = document.createElement('section');
          const groupKey = 'finished:' + clubName;
          const groupOpen = _dashboardGroupStates.has(groupKey) ? _dashboardGroupStates.get(groupKey) : groupIndex === 0;
          group.dataset.groupKey = groupKey;
          group.className = 'dash-club-group dash-club-group-finished' + (groupOpen ? ' is-open' : '');

          const toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'dash-club-group-toggle';
          toggle.setAttribute('aria-expanded', groupOpen ? 'true' : 'false');
          toggle.innerHTML = `<span class="dash-club-group-name">${_dashEscapeHtml(clubName)}</span><span class="dash-club-group-count">${clubSessions.length} ${clubSessions.length === 1 ? 'finished session' : 'finished sessions'}</span><span class="dash-club-group-chevron">⌄</span>`;

          const body = document.createElement('div');
          body.className = 'dash-club-group-body';

          clubSessions.forEach(sess => {
            body.appendChild(_buildSessionCard({
              clubName,
              starter:     sess.started_by,
              players:     sess.players || [],
              totalRounds: (sess.rounds_data || []).length || null,
              isLive:      false,
              sessionId:   sess.id,
              date:        sess.date,
              updatedAt:   sess.updated_at,
              shuttleData: sess.shuttle_data || null,
              handoverPin: sess.handover_pin || null
            }));
          });

          toggle.addEventListener('click', () => {
            const open = group.classList.toggle('is-open');
            _dashboardGroupStates.set(groupKey, open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
          });
          group.appendChild(toggle);
          group.appendChild(body);
          listEl.appendChild(group);
        });

      // Keep slot cards unchanged after the grouped session cards.
      slotSessions.forEach(sess => listEl.appendChild(_buildDashboardSlotCard(sess)));
      return;
    }

    sessions.slice().sort((a, b) => {
      const av = Date.parse(a.updated_at || a.date || '') || 0;
      const bv = Date.parse(b.updated_at || b.date || '') || 0;
      return bv - av;
    }).forEach(sess => {
      if (sess.isSlot) {
        listEl.appendChild(_buildDashboardSlotCard(sess));
        return;
      }
      const players = sess.isLive
        ? ((sess.players && sess.players.length) ? sess.players : _extractPlayersFromRounds(sess.rounds_data || []))
        : (sess.players || []);
      const cardClubName = isViewer ? (sess.club_name || sess.club_id || '') : (club ? club.name : '');
      const card = _buildSessionCard({
        clubName:    cardClubName,
        starter:     sess.started_by,
        players,
        totalRounds: (sess.rounds_data || []).length || null,
        isLive:      !!sess.isLive,
        sessionId:   sess.id,
        date:        sess.date,
        updatedAt:   sess.updated_at,
        shuttleData: sess.shuttle_data || null,
        handoverPin: sess.handover_pin || null
      });
      listEl.appendChild(card);
    });
  }

  try {
    let monthData = await fetchMonthData(currentYear, currentMonth);

    container.innerHTML = '';

    const calSlot  = document.createElement('div');
    const listSlot = document.createElement('div');
    listSlot.className = 'dash-section';
    container.appendChild(calSlot);
    container.appendChild(listSlot);

    function paintCalendar() {
      calSlot.innerHTML = '';
      calSlot.appendChild(_buildDashboardCalendar(
        currentYear, currentMonth, monthData,
        async (newYear, newMonth) => {
          currentYear = newYear; currentMonth = newMonth;
          calSlot.innerHTML = '<div class="dashboard-loading"><div class="help-spinner"></div></div>';
          monthData = await fetchMonthData(currentYear, currentMonth);
          paintCalendar();
        },
        (dateStr, sessions) => {
          selectedDate = dateStr;
          paintCalendar(); // repaint so the "selected" highlight moves
          renderSelectedDateSessions(listSlot, dateStr, sessions);
        },
        selectedDate
      ));
    }

    paintCalendar();
    renderSelectedDateSessions(listSlot, selectedDate, monthData[selectedDate] || []);

    // Start polling for live session changes
    dashboardStartPoll();

  } catch(e) {
    container.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-icon">📡</div>
        <p>${t("couldNotLoadSessions")}</p>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">${t("checkConnection")}</p>
        <button class="help-retry-btn" onclick="renderDashboard()" style="margin-top:12px">${t("retryBtn")}</button>
      </div>`;
  }
}

function _dashEscapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── Extract unique players from rounds_data ── */
function _extractPlayersFromRounds(roundsData) {
  const seen = new Set();
  const players = [];
  for (const round of (roundsData || [])) {
    for (const game of (round.games || [])) {
      for (const p of [...(game.pair1 || []), ...(game.pair2 || [])]) {
        if (!seen.has(p)) { seen.add(p); players.push({ name: p }); }
      }
    }
  }
  return players;
}

/* Arrival order belongs to the Round Manager slot roster, never to booking status.
   Keep it outside the card DOM so polling and full dashboard renders preserve it. */
const _dashArrivalStorageKey = 'scs-round-slot-arrivals-v1';
function _dashArrivalRead() {
  try { return JSON.parse(localStorage.getItem(_dashArrivalStorageKey) || '{}') || {}; }
  catch (_) { return {}; }
}
function _dashArrivalToggle(slotId, claimId, sourceButton) {
  const key = String(slotId), id = String(claimId);
  const all = _dashArrivalRead();
  const list = sourceButton?.closest('.scs-arrival-players');
  const rows = list ? Array.from(list.querySelectorAll('.scs-arrival-row')) : [];
  const visible = new Set(rows.map(row => row.dataset.claimId));
  // The queue alone determines numbers. Remove stale IDs, duplicates and
  // non-arrivals; never derive arrivals from row positions or prior numbers.
  const seen = new Set();
  const current = (Array.isArray(all[key]) ? all[key] : []).map(String).filter(value => {
    if (seen.has(value) || (rows.length && !visible.has(value))) return false;
    seen.add(value); return true;
  });
  const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
  all[key] = next;
  if (list) {
    const positions = new Map(next.map((value, index) => [value, index + 1]));
    rows.forEach(row => {
      const number = positions.get(row.dataset.claimId);
      const button = row.querySelector('.scs-arrival-number');
      row.classList.toggle('is-arrived', !!number);
      if (!button) return;
      button.textContent = number ? String(number) : '–';
      button.classList.toggle('assigned', !!number);
      button.setAttribute('aria-label', (number ? 'Remove arrival number for ' : 'Assign arrival number to ') + (row.dataset.playerName || 'player'));
    });
    // Finish dispatching this click before changing row positions. On the next
    // animation frame, reorder the existing rows from the same FIFO queue;
    // no polling, second selection handler, or server request is involved.
    requestAnimationFrame(() => {
      if (!list.isConnected) return;
      const positions = new Map(next.map((value, index) => [value, index]));
      const ordered = rows.map((row, index) => ({ row, index })).sort((a, b) => {
        const ai = positions.has(a.row.dataset.claimId) ? positions.get(a.row.dataset.claimId) : Infinity;
        const bi = positions.has(b.row.dataset.claimId) ? positions.get(b.row.dataset.claimId) : Infinity;
        return ai - bi || a.index - b.index;
      });
      // An intervening tap may have changed the queue: do not apply an old order.
      const latest = _dashArrivalRead()[key];
      if (JSON.stringify(latest) !== JSON.stringify(next)) return;
      ordered.forEach(({ row }) => list.appendChild(row));
    });
  }
  try { localStorage.setItem(_dashArrivalStorageKey, JSON.stringify(all)); } catch (_) {}
}
/* Long-press drag is a correction to the SAME arrival queue, not a second
   numbering mechanism. A normal tap remains handled only by the number button. */
let _dashArrivalDrag = null;
let _dashArrivalSuppressClickUntil = 0;
function _dashArrivalDrop(state, clientY) {
  const {list, row, slotId} = state;
  if (!list.isConnected || !row.isConnected) return;
  const rows = Array.from(list.querySelectorAll('.scs-arrival-row'));
  const remaining = rows.filter(item => item !== row);
  const insertAt = remaining.findIndex(item => clientY < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2);
  const index = insertAt < 0 ? remaining.length : insertAt;
  // Inserting in the arrived section marks a previously absent player arrived.
  // Inserting below the arrived section removes arrival status. The boundary is
  // based on the current queue, never on the displayed number or a player name.
  const all = _dashArrivalRead(), key = String(slotId), id = row.dataset.claimId;
  const visible = new Set(rows.map(item => item.dataset.claimId));
  const seen = new Set();
  const current = (Array.isArray(all[key]) ? all[key] : []).map(String).filter(value => {
    if (!visible.has(value) || seen.has(value)) return false;
    seen.add(value); return true;
  });
  const without = current.filter(value => value !== id);
  const before = remaining.slice(0, index);
  const arrivedBefore = before.filter(item => without.includes(item.dataset.claimId)).length;
  const lastArrivedIndex = remaining.reduce((last, item, i) => without.includes(item.dataset.claimId) ? i : last, -1);
  const insideArrivals = index <= lastArrivedIndex || (index === 0 && without.length === 0 && current.includes(id));
  // A non-arrived row dropped at the first unarrived position is treated as
  // unarrived; dropping between numbered rows joins at that exact position.
  const next = insideArrivals ? [...without.slice(0, arrivedBefore), id, ...without.slice(arrivedBefore)] : without;
  all[key] = next;
  try { localStorage.setItem(_dashArrivalStorageKey, JSON.stringify(all)); } catch (_) {}
  const positions = new Map(next.map((value, i) => [value, i + 1]));
  rows.forEach(item => {
    const n = positions.get(item.dataset.claimId);
    item.classList.toggle('is-arrived', !!n);
    const button = item.querySelector('.scs-arrival-number');
    if (button) {
      button.textContent = n ? String(n) : '–';
      button.classList.toggle('assigned', !!n);
      button.setAttribute('aria-label', (n ? 'Remove arrival number for ' : 'Assign arrival number to ') + (item.dataset.playerName || 'player'));
    }
  });
  // Preserve manual ordering of non-arrived players too. The next dashboard
  // refresh can reproduce that order from a separate display-only list.
  const displayKey = key + ':display';
  const display = remaining.slice();
  display.splice(index, 0, row);
  all[displayKey] = display.map(item => item.dataset.claimId);
  try { localStorage.setItem(_dashArrivalStorageKey, JSON.stringify(all)); } catch (_) {}
  const ordered = [...display].sort((a,b) => {
    const ai = positions.get(a.dataset.claimId) ?? Infinity;
    const bi = positions.get(b.dataset.claimId) ?? Infinity;
    return ai - bi;
  });
  ordered.forEach(item => list.appendChild(item));
}
function _dashArrivalStartDrag(row, list, slotId, x, y, pointerType) {
  if (_dashArrivalDrag) return;
  const state = {row, list, slotId, x, y, lastY:y, active:false, pointerType, timer:null};
  state.timer = setTimeout(() => {
    if (_dashArrivalDrag !== state) return;
    state.active = true;
    row.classList.add('scs-arrival-dragging');
    if (navigator.vibrate) try { navigator.vibrate(20); } catch (_) {}
  }, 320);
  _dashArrivalDrag = state;
}
function _dashArrivalMoveDrag(x, y, event) {
  const state = _dashArrivalDrag;
  if (!state) return;
  state.lastY = y;
  if (!state.active && (Math.abs(x-state.x)>12 || Math.abs(y-state.y)>12)) {
    clearTimeout(state.timer);
    _dashArrivalDrag = null;
    return;
  }
  if (state.active) {
    if (event?.cancelable) event.preventDefault();
    state.row.style.transform = `translateY(${y-state.y}px)`;
    state.row.style.zIndex = '5';
  }
}
function _dashArrivalEndDrag(cancelled) {
  const state = _dashArrivalDrag;
  if (!state) return;
  _dashArrivalDrag = null;
  clearTimeout(state.timer);
  state.row.classList.remove('scs-arrival-dragging');
  state.row.style.transform = '';
  state.row.style.zIndex = '';
  if (state.active) {
    _dashArrivalSuppressClickUntil = Date.now() + 650;
    if (!cancelled) _dashArrivalDrop(state, state.lastY);
  }
}
// Delegated listeners survive the normal 15-second dashboard rerender.
document.addEventListener('touchstart', event => {
  if (event.touches.length !== 1) return;
  const row = event.target.closest?.('.scs-arrival-row');
  const list = row?.closest('.scs-arrival-players');
  if (!list) return;
  const t = event.touches[0];
  _dashArrivalStartDrag(row, list, list.dataset.slotId, t.clientX, t.clientY, 'touch');
}, {passive:true});
document.addEventListener('touchmove', event => {
  if (!_dashArrivalDrag || event.touches.length !== 1) return;
  const t = event.touches[0];
  _dashArrivalMoveDrag(t.clientX, t.clientY, event);
}, {passive:false});
document.addEventListener('touchend', event => {
  if (_dashArrivalDrag?.active && event.cancelable) event.preventDefault();
  _dashArrivalEndDrag(false);
}, {passive:false});
document.addEventListener('touchcancel', () => _dashArrivalEndDrag(true));
document.addEventListener('mousedown', event => {
  if (event.button !== 0 || Date.now() < _dashArrivalSuppressClickUntil) return;
  const row = event.target.closest?.('.scs-arrival-row');
  const list = row?.closest('.scs-arrival-players');
  if (list) _dashArrivalStartDrag(row, list, list.dataset.slotId, event.clientX, event.clientY, 'mouse');
});
document.addEventListener('mousemove', event => {
  if (_dashArrivalDrag?.pointerType === 'mouse') _dashArrivalMoveDrag(event.clientX, event.clientY, event);
});
document.addEventListener('mouseup', () => {
  if (_dashArrivalDrag?.pointerType === 'mouse') _dashArrivalEndDrag(false);
});
document.addEventListener('click', event => {
  if (Date.now() < _dashArrivalSuppressClickUntil && event.target.closest?.('.scs-arrival-players')) {
    event.preventDefault(); event.stopImmediatePropagation();
  }
}, true);

// Tapping row content uses the same queue toggle as its number button.
// Interactive controls keep their own handlers; drag clicks are suppressed above.
document.addEventListener('click', event => {
  const row=event.target.closest?.('.scs-arrival-row');
  const list=row?.closest('.scs-arrival-players');
  if(!list||event.target.closest('button,a,input,select,textarea,[role="button"]'))return;
  const button=row.querySelector('.scs-arrival-number');
  if(!button||button.disabled)return;
  event.stopPropagation();
  _dashArrivalToggle(list.dataset.slotId,row.dataset.claimId,button);
});

function _dashArrivalClaimList(slot) {
  const esc = v => typeof _vsEscape === 'function' ? _vsEscape(v) : String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const claims = typeof _vsSortClaimsQueue === 'function' ? _vsSortClaimsQueue(slot.claims || []) : (slot.claims || []);
  const limit = Math.max(0, Number(slot.max_players || 0));
  const queue = claims.filter(c => typeof _vsIsQueuedClaim === 'function' ? _vsIsQueuedClaim(c) : c.status === 'confirmed');
  const selected = queue.slice(0, limit);
  const waiting = queue.slice(limit);
  const stored = _dashArrivalRead()[String(slot.id)] || [];
  const activeIds = new Set(selected.map(c => String(c.id)));
  const seenArrival = new Set();
  const order = (Array.isArray(stored) ? stored : []).map(String).filter(id => {
    if (!activeIds.has(id) || seenArrival.has(id)) return false;
    seenArrival.add(id); return true;
  });
  const display = _dashArrivalRead()[String(slot.id) + ':display'] || [];
  selected.sort((a,b) => {
    const ai = order.indexOf(String(a.id)), bi = order.indexOf(String(b.id));
    const arrivalDiff = (ai < 0 ? 99999 : ai) - (bi < 0 ? 99999 : bi);
    if (arrivalDiff) return arrivalDiff;
    const ad = display.indexOf(String(a.id)), bd = display.indexOf(String(b.id));
    return (ad < 0 ? 99999 : ad) - (bd < 0 ? 99999 : bd);
  });
  const render = (c, i) => {
    const id = String(c.id || '');
    const number = order.indexOf(id) + 1;
    const name = typeof _mcsClaimPlayerName === 'function' ? _mcsClaimPlayerName(c) : (c.player?.nickname || c.nickname || 'Player');
    const rating = typeof _mcsClaimRatingText === 'function' ? _mcsClaimRatingText(c) : '';
    const r = Number(rating);
    const ring = r >= 4.5 ? '#d9a950' : r >= 3.5 ? '#7ba5e8' : r >= 2.5 ? '#42b8b0' : '#9a9bcb';
    const gender = typeof _mcsGenderIcon === 'function' ? _mcsGenderIcon(c) : '';
    const paid = typeof _vsClaimPaid === 'function' && _vsClaimPaid(c);
    return '<div class="mc-slot-player-row scs-arrival-row' + (number ? ' is-arrived' : '') + '" data-claim-id="' + esc(id) + '" data-player-name="' + esc(name) + '">' +
      '<button type="button" class="scs-arrival-number' + (number ? ' assigned' : '') + '" aria-label="' + esc(number ? 'Remove arrival number for ' : 'Assign arrival number to ') + esc(name) + '" onclick="event.stopPropagation();_dashArrivalToggle(\'' + esc(slot.id) + '\',\'' + esc(id) + '\',this)">' + (number || '–') + '</button>' +
      '<span class="mc-slot-avatar mc-slot-gender-avatar scs-arrival-avatar" style="border-color:' + ring + '">' + gender + '</span>' +
      '<span class="mc-slot-player-name scs-arrival-name">' + esc(name) + '</span>' +
      (rating ? '<span class="mc-slot-rating-badge"><span class="mc-slot-rating-star">★</span>' + esc(rating) + '</span>' : '') +
      '<span class="' + (paid ? 'mc-slot-paid-badge' : 'mc-slot-unpaid-badge') + '">' + esc(paid ? (t('paid') || 'Paid') : (t('unpaid') || 'Unpaid')) + '</span></div>';
  };
  const other = waiting.length ? '<div class="mc-slot-list-section"><div class="mc-slot-list-title">⏳ ' + esc(t('waiting') || 'Waiting') + ' (' + waiting.length + ')</div>' + waiting.map((c,i) => _mcsRenderClaimRow(c,i,'waitlist')).join('') + '</div>' : '';
  return '<div class="mc-slot-details scs-arrival-list"><div class="mc-slot-list-section"><div class="mc-slot-list-title">👥 ' + esc(t('players') || 'Players') + ' (' + selected.length + '/' + (limit || '—') + ')</div>' +
    '<div class="scs-arrival-players" data-slot-id="' + esc(slot.id) + '">' + (selected.length ? selected.map(render).join('') : '<div class="mc-slot-list-empty">No confirmed players yet</div>') + '</div>' + '</div>' + other + '</div>';
}

/* ── Build a session card ── */
function _buildDashboardSlotCard(slot) {
  const esc = (v) => (typeof _vsEscape === 'function')
    ? _vsEscape(v)
    : String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const claims = Array.isArray(slot.claims) ? slot.claims : [];
  const confirmed = claims
    .filter(c => c.status === 'confirmed')
    .sort((a, b) => String(a.claimed_at || '').localeCompare(String(b.claimed_at || '')));
  const maxPlayers = Number(slot.max_players || 0);
  const full = maxPlayers && confirmed.length >= maxPlayers;
  const waitCount = Number(slot.waitlistCount || claims.filter(c => c.status === 'waitlist').length || 0);
  const slotStatus = String(slot.status || '').toLowerCase();
  const isCancelled = slotStatus === 'cancelled';
  const statusText = isCancelled ? (t('cancelled') || 'Cancelled') : (t('organiser') || 'Organiser');
  const title = (typeof _mcsSlotTitle === 'function') ? _mcsSlotTitle(slot) : (t('openPlay') || 'Open Play');
  const level = (typeof _mcsSlotLevelText === 'function') ? _mcsSlotLevelText(slot) : 'allLevel';
  const club = (typeof getMyClub === 'function' ? getMyClub() : null) || {};
  const detailsHtml = _dashArrivalClaimList(slot);

  const card = document.createElement('div');
  card._scsSlotData = slot;
  const slotKey = String(slot.id || '');
  const isExpanded = _dashboardExpandedSlotIds.has(slotKey);
  card.className = 'mc-slot-card' + (isExpanded ? ' is-expanded' : '');
  if (slot.slot_date) card.dataset.date = slot.slot_date;
  card.dataset.slotId = slot.id || '';
  card.dataset.clubId = slot.club_id || club.id || '';
  card.style.setProperty('--mc-club-color', '#8b5cf6');
  card.innerHTML =
    '<div class="mc-slot-card-head">' +
      '<div class="mc-slot-time-row">' +
        '<div class="mc-slot-time">' + esc(_dashFormatTime(slot.start_time)) + ' - ' + esc(_dashFormatTime(slot.end_time)) + '</div>' +
        '<div class="mc-slot-chevron">' + (isExpanded ? '▲' : '▼') + '</div>' +
      '</div>' +
      '<div class="mc-slot-main">' +
        '<div>' +
          '<div class="mc-slot-title">' + esc(title) + ' <span class="mc-slot-status-inline' + (isCancelled ? ' is-cancelled' : '') + '">' + esc(statusText) + '</span></div>' +
          '<div class="mc-slot-venue">' + esc(slot.venue || '') + '</div>' +
          '<div class="mc-slot-club-pill">' + esc(club.name || 'Club') + ' · ' + esc(t('slotLabel') || 'Slot') + '</div>' +
        '</div>' +
        '<div class="mc-slot-count-pill' + (full ? ' is-full' : '') + '">' +
          confirmed.length + '/' + (maxPlayers || '-') + (waitCount ? ' · ' + waitCount + 'W' : '') +
        '</div>' +
      '</div>' +
      '<div class="mc-slot-footer"><span>' + esc(level) + '</span><span></span></div>' +
    '</div>' +
    '<div class="dash-slot-details-wrap" style="display:' + (isExpanded ? '' : 'none') + '">' + detailsHtml + '</div>';

  const footerAction = card.querySelector('.mc-slot-footer span:last-child');
  const startBtn = document.createElement('button');
  startBtn.className = 'mc-slot-action-btn';
  startBtn.textContent = isCancelled
    ? (t('cancelled') || 'Cancelled')
    : (confirmed.length >= 4 ? (t('startSession') || 'Start Session') : (t('need4Players') || 'Need 4 players'));
  startBtn.disabled = isCancelled || confirmed.length < 4;
  startBtn.onclick = (e) => {
    e.stopPropagation();
    if (typeof vaultSlotsStartRoundsFromSlot === 'function') vaultSlotsStartRoundsFromSlot(slot.id);
  };
  footerAction.appendChild(startBtn);

  const head = card.querySelector('.mc-slot-card-head');
  const details = card.querySelector('.dash-slot-details-wrap');
  const chevron = card.querySelector('.mc-slot-chevron');
  head.addEventListener('click', () => {
    const open = details.style.display === 'none';
    details.style.display = open ? '' : 'none';
    chevron.textContent = open ? '▲' : '▼';
    card.classList.toggle('is-expanded', open);
    if (open) _dashboardExpandedSlotIds.add(slotKey);
    else _dashboardExpandedSlotIds.delete(slotKey);
  });

  return card;
}

function _buildSessionCard({ clubName, starter, players, totalRounds, isLive, sessionId, date, updatedAt, shuttleData, handoverPin }) {
  const card = document.createElement('div');
  card.className = 'dash-session-card' + (isLive ? ' live' : '');
  if (date) card.dataset.date = date;
  else if (updatedAt) card.dataset.date = (updatedAt || '').split('T')[0];

  const myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
  const myName   = myPlayer ? myPlayer.name.toLowerCase() : '';
  const dateLabel = isLive ? t('today') : _formatDate(date || updatedAt);
  // Show club name on card (useful when viewer sees multiple clubs)
  const displayClub = clubName || '';

  // Top row
  const top = document.createElement('div');
  top.className = 'dash-card-top';
  top.innerHTML = `
    <div class="dash-card-club">${clubName || t('clubLabel')}</div>
    ${isLive
      ? `<div class="dash-live-badge"><div class="dash-live-dot-sm"></div>LIVE</div>`
      : `<div class="dash-past-badge">${dateLabel}</div>`}
  `;
  card.appendChild(top);

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'dash-card-meta';
  meta.innerHTML = `
    <span>👥 ${players.length} ${t("playersCount")}</span>
    ${totalRounds ? `<span>🔄 ${totalRounds} ${t("roundsCount")}</span>` : ''}
    ${starter ? `<span>▶ ${starter}</span>` : ''}
  `;
  card.appendChild(meta);

  // Player chips
  const chips = document.createElement('div');
  chips.className = 'dash-card-chips';
  const show = players.slice(0, 5);
  const rest = players.length - show.length;
  show.forEach(p => {
    const chip = document.createElement('div');
    const name = p.name || p.player_name || '';
    const isMe = name.toLowerCase() === myName;
    chip.className = 'dash-chip' + (isMe ? ' me' : '');
    chip.textContent = name + (isMe ? ' ★' : '');
    chips.appendChild(chip);
  });
  if (rest > 0) {
    const more = document.createElement('div');
    more.className = 'dash-chip';
    more.textContent = `+${rest}`;
    chips.appendChild(more);
  }
  card.appendChild(chips);

  // Tap → open rounds view (both live and past)
  if (sessionId) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => _openSessionRounds(sessionId, clubName, dateLabel));
  }

  // Shuttle cost row -- past sessions only
  if (!isLive && shuttleData) {
    const shuttleRow = document.createElement('div');
    shuttleRow.className = 'dash-shuttle-row';
    let info = '';
    if (shuttleData.mode === 'flat') {
      info = `<span class="dash-shuttle-info">💴 Flat fee</span>`;
    } else {
      const parts = [];
      if (shuttleData.shuttles_used) parts.push(`🪶 ${shuttleData.shuttles_used} shuttles`);
      if (shuttleData.court_fee)     parts.push(`🏟 ¥${shuttleData.court_fee.toLocaleString()}`);
      if (shuttleData.misc_fee)      parts.push(`📦 ¥${shuttleData.misc_fee.toLocaleString()}`);
      info = `<span class="dash-shuttle-info">${parts.join(' · ')}</span>`;
    }
    shuttleRow.innerHTML = `
      ${info}
      <span class="dash-shuttle-cost">¥${(shuttleData.cost_per_player||0).toLocaleString()}/player</span>
    `;
    card.appendChild(shuttleRow);
  }

  // Edit Cost button -- organiser mode only, past sessions only
  const isOrg = typeof appMode !== 'undefined' ? appMode === 'organiser' : localStorage.getItem('kbrr_app_mode') === 'organiser';
  if (!isLive && isOrg && sessionId) {
    const editBtn = document.createElement('button');
    editBtn.className = 'dash-force-end-btn';
    editBtn.style.cssText = 'background:rgba(108,99,255,0.15);color:#6c63ff;border-color:rgba(108,99,255,0.3);margin-top:8px;';
    editBtn.textContent = '✏️ Edit Cost';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      showEditCostSheet(sessionId, shuttleData, players);
    };
    const editFooter = document.createElement('div');
    editFooter.className = 'dash-card-footer';
    editFooter.appendChild(editBtn);
    card.appendChild(editFooter);
  }

  // Force End button -- admin only, live sessions only
  const isAdmin = (typeof isAdminMode === 'function') ? isAdminMode() : localStorage.getItem('kbrr_club_mode') === 'admin';
  if (isLive && isAdmin) {
    const footer = document.createElement('div');
    footer.className = 'dash-card-footer';
    const forceEndBtn = document.createElement('button');
    forceEndBtn.className = 'dash-force-end-btn';
    forceEndBtn.textContent = t('forceEndSession');
    forceEndBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(t('forceEndConfirm'))) return;
      forceEndBtn.textContent = t('ending');
      forceEndBtn.disabled = true;
      try {
        await dbForceCompleteSession(sessionId);
        renderDashboard();
      } catch(err) {
        forceEndBtn.textContent = t('forceEndSession');
        forceEndBtn.disabled = false;
        alert('Failed: ' + err.message);
      }
    };
    footer.appendChild(forceEndBtn);
    card.appendChild(footer);
  }

  // ── Organiser controls — live sessions for their club only ──
  if (isLive && isOrg && sessionId) {
    const _storedIds = new Set([
      sessionStorage.getItem('kbrr_session_db_id'),
      localStorage.getItem('kbrr_session_id_persist'),
      (() => { try { return JSON.parse(localStorage.getItem('kbrr_snapshot') || '{}').sessionDbId; } catch(e) { return null; } })()
    ].filter(Boolean));
    const isMySession = _storedIds.has(sessionId);

    const handoverFooter = document.createElement('div');
    handoverFooter.className = 'dash-card-footer';

    // Hand Over — only if I started this session
    if (isMySession) {
      const handoverBtn = document.createElement('button');
      handoverBtn.className = 'dash-force-end-btn';
      handoverBtn.style.cssText = 'background:rgba(108,99,255,0.15);color:#6c63ff;border-color:rgba(108,99,255,0.3);margin-top:8px;';
      handoverBtn.textContent = '🤝 Hand Over';
      handoverBtn.onclick = (e) => {
        e.stopPropagation();
        _showHandoverSetPassword(sessionId);
      };
      handoverFooter.appendChild(handoverBtn);
    }

    // End Session — always shown for any organiser of this club
    const endBtn = document.createElement('button');
    endBtn.className = 'dash-force-end-btn';
    endBtn.style.cssText = 'background:rgba(230,55,87,0.15);color:#e63757;border-color:rgba(230,55,87,0.3);margin-top:8px;';
    endBtn.textContent = '⏹ End Session';
    endBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('End this session?')) return;
      endBtn.textContent = 'Ending...';
      endBtn.disabled = true;
      try {
        await dbForceCompleteSession(sessionId);
        renderDashboard();
      } catch(err) {
        endBtn.textContent = '⏹ End Session';
        endBtn.disabled = false;
        alert('Failed: ' + err.message);
      }
    };
    handoverFooter.appendChild(endBtn);
    card.appendChild(handoverFooter);
  }

  return card;
}

/* ── Handover: Set a password (Organiser A) ── */
function _showHandoverSetPassword(sessionId) {
  var existing = document.getElementById('scs-handover-set-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'scs-handover-set-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;box-sizing:border-box;';
  modal.innerHTML =
    '<div style="background:var(--card-bg,#1e1e2e);border-radius:20px;padding:28px 22px;max-width:310px;width:100%;text-align:center;">' +
      '<div style="font-size:2.2rem;margin-bottom:10px;">🤝</div>' +
      '<div style="font-size:1rem;font-weight:800;color:var(--text,#fff);margin-bottom:6px;">Hand Over Session</div>' +
      '<div style="font-size:0.82rem;color:var(--text-dim,#aaa);margin-bottom:18px;line-height:1.5;">Set a password. Share it with the new organiser so they can continue this session.</div>' +
      '<input id="scsHoPassword" type="text" placeholder="Set a handover password"' +
        ' style="width:100%;padding:13px;font-size:1rem;text-align:center;background:var(--surface,#2a2a3e);border:1.5px solid var(--border,#333);border-radius:12px;color:var(--text,#fff);font-family:inherit;box-sizing:border-box;margin-bottom:8px;">' +
      '<div id="scsHoSetErr" style="font-size:0.78rem;color:#e63757;min-height:18px;margin-bottom:10px;"></div>' +
      '<button id="scsHoSetBtn" style="width:100%;padding:13px;background:linear-gradient(135deg,#6c63ff,#574fd6);color:#fff;border:none;border-radius:13px;font-size:0.92rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;">Set Password</button>' +
      '<button id="scsHoCancelSet" style="width:100%;padding:11px;background:none;border:1px solid var(--border,#333);color:var(--text-dim,#aaa);border-radius:13px;font-size:0.88rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
    '</div>';

  document.body.appendChild(modal);

  var errEl = document.getElementById('scsHoSetErr');

  document.getElementById('scsHoSetBtn').onclick = async function() {
    var pw = (document.getElementById('scsHoPassword').value || '').trim();
    if (!pw || pw.length < 3) { errEl.textContent = 'Password must be at least 3 characters.'; return; }
    try {
      await sbPatch('sessions', 'id=eq.' + sessionId, { handover_pin: pw });
      modal.remove();
      // Show confirmation with the password
      var conf = document.createElement('div');
      conf.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;box-sizing:border-box;';
      conf.innerHTML =
        '<div style="background:var(--card-bg,#1e1e2e);border-radius:20px;padding:28px 22px;max-width:310px;width:100%;text-align:center;">' +
          '<div style="font-size:2.2rem;margin-bottom:10px;">✅</div>' +
          '<div style="font-size:1rem;font-weight:800;color:var(--text,#fff);margin-bottom:8px;">Password Set</div>' +
          '<div style="font-size:0.82rem;color:var(--text-dim,#aaa);margin-bottom:16px;">Share this password with the new organiser:</div>' +
          '<div style="font-size:1.5rem;font-weight:900;letter-spacing:4px;color:var(--accent,#6c63ff);background:var(--surface,#2a2a3e);padding:14px;border-radius:12px;margin-bottom:20px;">' + pw + '</div>' +
          '<button id="scsHoConfClose" style="width:100%;padding:13px;background:var(--surface,#2a2a3e);border:1px solid var(--border,#333);color:var(--text,#fff);border-radius:13px;font-size:0.9rem;cursor:pointer;font-family:inherit;">Done</button>' +
        '</div>';
      document.body.appendChild(conf);
      document.getElementById('scsHoConfClose').onclick = function() { conf.remove(); };
    } catch(e) {
      errEl.textContent = 'Failed to set password: ' + e.message;
    }
  };
  document.getElementById('scsHoCancelSet').onclick = function() { modal.remove(); };
}

/* ── Continue: Enter password (Organiser B) ── */
function _showContinueWithPassword(sessionId, requirePin) {
  var existing = document.getElementById('scs-continue-pw-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'scs-continue-pw-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;box-sizing:border-box;';
  modal.innerHTML =
    '<div style="background:var(--card-bg,#1e1e2e);border-radius:20px;padding:28px 22px;max-width:310px;width:100%;text-align:center;">' +
      '<div style="font-size:2.2rem;margin-bottom:10px;">▶</div>' +
      '<div style="font-size:1rem;font-weight:800;color:var(--text,#fff);margin-bottom:6px;">Continue Session</div>' +
      '<div style="font-size:0.82rem;color:var(--text-dim,#aaa);margin-bottom:18px;line-height:1.5;">' +
        (requirePin ? 'Enter the handover password set by the current organiser.' : 'Enter the handover password to take over this session.') +
      '</div>' +
      '<input id="scsContPwInput" type="text" placeholder="Handover password"' +
        ' style="width:100%;padding:13px;font-size:1rem;text-align:center;background:var(--surface,#2a2a3e);border:1.5px solid var(--border,#333);border-radius:12px;color:var(--text,#fff);font-family:inherit;box-sizing:border-box;margin-bottom:8px;">' +
      '<div id="scsContPwErr" style="font-size:0.78rem;color:#e63757;min-height:18px;margin-bottom:10px;"></div>' +
      '<button id="scsContPwSubmit" style="width:100%;padding:13px;background:linear-gradient(135deg,#2dce89,#26b575);color:#fff;border:none;border-radius:13px;font-size:0.92rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;">Take Over</button>' +
      '<button id="scsContPwCancel" style="width:100%;padding:11px;background:none;border:1px solid var(--border,#333);color:var(--text-dim,#aaa);border-radius:13px;font-size:0.88rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
    '</div>';

  document.body.appendChild(modal);

  var errEl = document.getElementById('scsContPwErr');

  document.getElementById('scsContPwSubmit').onclick = async function() {
    var entered = (document.getElementById('scsContPwInput').value || '').trim();
    if (!entered) { errEl.textContent = 'Please enter the handover password.'; return; }

    try {
      var rows = await sbGet('sessions', 'id=eq.' + sessionId + '&select=id,handover_pin,scheduler_state,rounds_data,started_by');
      if (!rows || !rows.length) { errEl.textContent = 'Session not found.'; return; }
      var sess = rows[0];

      if (!sess.handover_pin) { errEl.textContent = 'No handover password set. Ask the organiser to set one first.'; return; }
      if (sess.handover_pin.trim() !== entered) { errEl.textContent = '❌ Wrong password. Try again.'; return; }

      // Password correct — transfer session
      var myPlayer = (typeof getMyPlayer === 'function') ? getMyPlayer() : null;
      var myName   = (myPlayer && myPlayer.name) ? myPlayer.name : 'New Organiser';
      var now      = new Date().toISOString();
      await sbPatch('sessions', 'id=eq.' + sessionId, {
        handover_pin: null,
        started_by:   myName,
        updated_at:   now
      });

      modal.remove();

      // Restore full session state
      if (sess.scheduler_state && sess.scheduler_state.schedulerState) {
        var blob = sess.scheduler_state;
        blob.sessionDbId = sess.id;
        if (typeof persistSessionId === 'function') persistSessionId(sess.id);
        sessionStorage.setItem('kbrr_session_db_id', sess.id);
        localStorage.setItem('kbrr_snapshot', JSON.stringify(blob));
        if (typeof restoreSnapshot === 'function') {
          await restoreSnapshot(blob);
          if (typeof startSessionHeartbeat === 'function') startSessionHeartbeat();
        }
      } else {
        // No scheduler state yet — just set session ID and navigate to rounds
        if (typeof persistSessionId === 'function') persistSessionId(sess.id);
        sessionStorage.setItem('kbrr_session_db_id', sess.id);
        alert('Session taken over. Please start a new round to continue.');
      }
    } catch(e) {
      errEl.textContent = 'Error: ' + e.message;
    }
  };
  document.getElementById('scsContPwCancel').onclick = function() { modal.remove(); };
}

/* ── Open rounds view -- navigates to viewerPage ── */
function _openSessionRounds(sessionId, clubName, dateLabel) {
  if (typeof viewerOpen === 'function') {
    window._scsViewerReturnPage = 'dashboardPage';
    viewerOpen(sessionId).then(function() {
      var titleEl = document.getElementById('viewerHeaderTitle');
      var subEl   = document.getElementById('viewerHeaderNickname');
      if (titleEl && clubName) titleEl.textContent = clubName;
      if (subEl   && dateLabel) subEl.textContent  = dateLabel;
    });
  }
}

/* ── Format date ── */
function _formatDate(dateStr) {
  if (!dateStr) return '';
  // Append T00:00:00 for date-only strings so they parse as local midnight, not UTC midnight
  const rawStr = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
  // If no timezone suffix, parse manually as local time to avoid browser ambiguity
  var d;
  if (/[Zz]$/.test(rawStr) || /[+-]\d{2}:\d{2}$/.test(rawStr)) {
    d = new Date(rawStr);
  } else {
    var _pts = rawStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    d = _pts ? new Date(+_pts[1], +_pts[2]-1, +_pts[3], +_pts[4], +_pts[5], +_pts[6]) : new Date(rawStr);
  }
  const now   = new Date();
  // Compare using local date strings to avoid midnight UTC boundary issues
  const _p    = n => String(n).padStart(2,'0');
  const dStr  = `${d.getFullYear()}-${_p(d.getMonth()+1)}-${_p(d.getDate())}`;
  const tStr  = `${now.getFullYear()}-${_p(now.getMonth()+1)}-${_p(now.getDate())}`;
  const diff  = Math.round((new Date(tStr) - new Date(dStr)) / (1000*60*60*24));
  if (diff === 0) return t('today');
  if (diff === 1) return t('yesterday');
  if (diff < 7)  return `${diff} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
