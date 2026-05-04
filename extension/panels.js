'use strict';

/* ================================================================
   UTILITY PANELS — right sidebar
   Recently Closed, Tab Stats, Focus Timer, Quick Notes
   ================================================================ */


/* ----------------------------------------------------------------
   1. RECENTLY CLOSED
   Uses chrome.sessions API to show tabs you recently closed,
   with a one-click restore button.
   ---------------------------------------------------------------- */

async function renderRecentlyClosed() {
  const list = document.getElementById('recentlyClosedList');
  if (!list) return;

  try {
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 8 });
    const tabs = sessions
      .filter(s => s.tab)
      .map(s => s.tab)
      .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'));

    if (tabs.length === 0) {
      list.innerHTML = '<div class="recently-closed-empty">No recently closed tabs</div>';
      return;
    }

    list.innerHTML = tabs.map(tab => {
      let domain = '';
      try { domain = new URL(tab.url).hostname; } catch {}
      const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : '';
      const safeUrl = (tab.url || '').replace(/"/g, '&quot;');
      const safeTitle = (tab.title || tab.url || '').replace(/"/g, '&quot;');
      const displayTitle = tab.title || tab.url || '';
      const sessionId = tab.sessionId || '';

      return `<div class="recently-closed-item" data-action="restore-tab" data-session-id="${sessionId}" data-tab-url="${safeUrl}" title="${safeTitle}">
        ${faviconUrl ? `<img src="${faviconUrl}" alt="">` : ''}
        <span class="recently-closed-title">${displayTitle}</span>
        <button class="recently-closed-restore" data-action="restore-tab" data-session-id="${sessionId}" title="Restore">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
        </button>
      </div>`;
    }).join('');
  } catch {
    list.innerHTML = '<div class="recently-closed-empty">Unable to load</div>';
  }
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action="restore-tab"]');
  if (!el) return;
  e.stopPropagation();

  const sessionId = el.dataset.sessionId;
  const tabUrl = el.dataset.tabUrl;

  try {
    if (sessionId) {
      await chrome.sessions.restore(sessionId);
    } else if (tabUrl) {
      await chrome.tabs.create({ url: tabUrl });
    }
    await renderRecentlyClosed();
  } catch { /* restore failed */ }
});


/* ----------------------------------------------------------------
   2. TAB STATS
   Shows aggregate stats from the already-fetched openTabs global.
   ---------------------------------------------------------------- */

function renderTabStats() {
  const container = document.getElementById('tabStatsContent');
  if (!container) return;

  const realTabs = getRealTabs();
  const totalTabs = realTabs.length;

  // Count by domain
  const domainCounts = {};
  for (const tab of realTabs) {
    let hostname = '';
    try { hostname = new URL(tab.url).hostname; } catch { continue; }
    domainCounts[hostname] = (domainCounts[hostname] || 0) + 1;
  }
  const totalDomains = Object.keys(domainCounts).length;

  // Count duplicates
  const urlCounts = {};
  for (const tab of realTabs) urlCounts[tab.url] = (urlCounts[tab.url] || 0) + 1;
  const dupeCount = Object.values(urlCounts).filter(c => c > 1).reduce((sum, c) => sum + c - 1, 0);

  // Top domains
  const topDomains = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const maxCount = topDomains.length > 0 ? topDomains[0][1] : 1;

  const topDomainsHtml = topDomains.map(([domain, count]) => {
    const pct = Math.round((count / maxCount) * 100);
    const displayName = typeof friendlyDomain === 'function' ? friendlyDomain(domain) : domain;
    return `<div class="top-domain-row">
      <span class="top-domain-name" title="${domain}">${displayName}</span>
      <div class="top-domain-bar-bg"><div class="top-domain-bar" style="width:${pct}%"></div></div>
      <span class="top-domain-count">${count}</span>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="tab-stats-grid">
      <div class="tab-stat-box">
        <div class="tab-stat-num">${totalTabs}</div>
        <div class="tab-stat-label">Tabs</div>
      </div>
      <div class="tab-stat-box">
        <div class="tab-stat-num">${totalDomains}</div>
        <div class="tab-stat-label">Domains</div>
      </div>
      <div class="tab-stat-box">
        <div class="tab-stat-num">${dupeCount}</div>
        <div class="tab-stat-label">Dupes</div>
      </div>
      <div class="tab-stat-box">
        <div class="tab-stat-num">${openTabs.length}</div>
        <div class="tab-stat-label">Total</div>
      </div>
    </div>
    ${topDomains.length > 0 ? '<div class="tab-stats-top-domains">' + topDomainsHtml + '</div>' : ''}
  `;
}


/* ----------------------------------------------------------------
   3. FOCUS TIMER
   Simple 25-minute Pomodoro timer. State resets when you open
   a new tab (by design — keeps it lightweight).
   ---------------------------------------------------------------- */

const FOCUS_DURATION = 25 * 60;
let focusTimeLeft = FOCUS_DURATION;
let focusRunning = false;
let focusInterval = null;

function renderFocusTimer() {
  const container = document.getElementById('focusTimerContent');
  if (!container) return;

  const mm = String(Math.floor(focusTimeLeft / 60)).padStart(2, '0');
  const ss = String(focusTimeLeft % 60).padStart(2, '0');
  const pct = ((FOCUS_DURATION - focusTimeLeft) / FOCUS_DURATION) * 100;

  container.innerHTML = `
    <div class="focus-timer-progress">
      <div class="focus-timer-progress-bar" style="width:${pct}%"></div>
    </div>
    <div class="focus-timer-display">
      <div class="focus-timer-time">${mm}:${ss}</div>
      <div class="focus-timer-label">${focusRunning ? 'Focusing...' : (focusTimeLeft < FOCUS_DURATION ? 'Paused' : '25 min session')}</div>
    </div>
    <div class="focus-timer-controls">
      <button class="focus-timer-btn primary" data-action="focus-timer-toggle">
        ${focusRunning ? 'Pause' : 'Start'}
      </button>
      <button class="focus-timer-btn" data-action="focus-timer-reset">Reset</button>
    </div>
  `;
}

function focusTick() {
  if (focusTimeLeft <= 0) {
    clearInterval(focusInterval);
    focusInterval = null;
    focusRunning = false;
    focusTimeLeft = 0;
    renderFocusTimer();
    playFocusComplete();
    showToast('Focus session complete!');
    return;
  }
  focusTimeLeft--;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const timeEl = document.querySelector('.focus-timer-time');
  const barEl = document.querySelector('.focus-timer-progress-bar');
  const labelEl = document.querySelector('.focus-timer-label');
  if (!timeEl) return;

  const mm = String(Math.floor(focusTimeLeft / 60)).padStart(2, '0');
  const ss = String(focusTimeLeft % 60).padStart(2, '0');
  timeEl.textContent = `${mm}:${ss}`;

  if (barEl) {
    barEl.style.width = `${((FOCUS_DURATION - focusTimeLeft) / FOCUS_DURATION) * 100}%`;
  }
  if (labelEl) {
    labelEl.textContent = focusRunning ? 'Focusing...' : 'Paused';
  }
}

function playFocusComplete() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    // Two-tone chime
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, t + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.2);
      osc.stop(t + i * 0.2 + 0.6);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch { /* audio unavailable */ }
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="focus-timer-toggle"]')) {
    if (focusRunning) {
      clearInterval(focusInterval);
      focusInterval = null;
      focusRunning = false;
    } else {
      if (focusTimeLeft <= 0) focusTimeLeft = FOCUS_DURATION;
      focusRunning = true;
      focusInterval = setInterval(focusTick, 1000);
    }
    renderFocusTimer();
    return;
  }

  if (e.target.closest('[data-action="focus-timer-reset"]')) {
    clearInterval(focusInterval);
    focusInterval = null;
    focusRunning = false;
    focusTimeLeft = FOCUS_DURATION;
    renderFocusTimer();
    return;
  }
});


/* ----------------------------------------------------------------
   4. QUICK NOTES
   Auto-saving textarea backed by chrome.storage.local.
   ---------------------------------------------------------------- */

const NOTES_STORAGE_KEY = 'quickNotes';
let notesSaveTimer = null;

async function renderQuickNotes() {
  const container = document.getElementById('quickNotesContent');
  if (!container) return;

  let savedText = '';
  try {
    const result = await chrome.storage.local.get(NOTES_STORAGE_KEY);
    savedText = result[NOTES_STORAGE_KEY] || '';
  } catch { /* no saved notes */ }

  container.innerHTML = `
    <textarea class="quick-notes-textarea" id="quickNotesTextarea" placeholder="Jot something down...">${savedText.replace(/</g, '&lt;')}</textarea>
    <div class="quick-notes-status" id="quickNotesStatus"></div>
  `;
}

document.addEventListener('input', (e) => {
  if (e.target.id !== 'quickNotesTextarea') return;
  clearTimeout(notesSaveTimer);
  const status = document.getElementById('quickNotesStatus');
  if (status) status.textContent = '';

  notesSaveTimer = setTimeout(async () => {
    try {
      await chrome.storage.local.set({ [NOTES_STORAGE_KEY]: e.target.value });
      if (status) {
        status.textContent = 'Saved';
        setTimeout(() => { if (status) status.textContent = ''; }, 1500);
      }
    } catch { /* save failed */ }
  }, 500);
});


/* ----------------------------------------------------------------
   MAIN ENTRY: renderPanels()
   Called from dashboard.js after tabs are loaded.
   ---------------------------------------------------------------- */

async function renderPanels() {
  await renderRecentlyClosed();
  renderTabStats();
  renderFocusTimer();
  await renderQuickNotes();
}
