/**
 * background.js — Service Worker for Badge Updates
 *
 * Keeps the toolbar badge in sync and purges expired archived tabs on startup.
 */

importScripts('deferred.js', 'snapshots-storage.js');

const AUTO_SNAPSHOT_ALARM = 'autoTabSnapshot';

async function ensureAutoSnapshotAlarm() {
  const minutes = await getAutoSnapshotIntervalMinutes();
  if (minutes <= 0) {
    await chrome.alarms.clear(AUTO_SNAPSHOT_ALARM);
    return;
  }
  await chrome.alarms.create(AUTO_SNAPSHOT_ALARM, {
    delayInMinutes: minutes,
    periodInMinutes: minutes,
  });
}

async function bootstrapAutoSnapshotIfNeeded() {
  const minutes = await getAutoSnapshotIntervalMinutes();
  if (minutes <= 0) return;
  const existing = await getAutoTabSnapshot();
  if (!existing) {
    await saveAutoTabSnapshot();
  }
}

async function handleAutoSnapshotIntervalChange() {
  await ensureAutoSnapshotAlarm();
  const minutes = await getAutoSnapshotIntervalMinutes();
  if (minutes > 0) {
    await saveAutoTabSnapshot();
  }
}

// ─── Badge updater ────────────────────────────────────────────────────────────

/**
 * updateBadge()
 *
 * Counts open real-web tabs and updates the extension's toolbar badge.
 * "Real" tabs = not chrome://, not extension pages, not about:blank.
 */
async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});

    // Only count actual web pages — skip browser internals and extension pages
    const count = tabs.filter(t => {
      const url = t.url || '';
      return (
        !url.startsWith('chrome://') &&
        !url.startsWith('chrome-extension://') &&
        !url.startsWith('about:') &&
        !url.startsWith('edge://') &&
        !url.startsWith('brave://')
      );
    }).length;

    // Don't show "0" — an empty badge is cleaner
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });

    if (count === 0) return;

    // Pick badge color based on workload level
    let color;
    if (count <= 10) {
      color = '#3d7a4a'; // Green — you're in control
    } else if (count <= 20) {
      color = '#b8892e'; // Amber — things are piling up
    } else {
      color = '#b35a5a'; // Red — time to focus and close some tabs
    }

    await chrome.action.setBadgeBackgroundColor({ color });

  } catch {
    // If something goes wrong, clear the badge rather than show stale data
    chrome.action.setBadgeText({ text: '' });
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

// Update badge when the extension is first installed
chrome.runtime.onInstalled.addListener(() => {
  ensureAutoSnapshotAlarm()
    .then(() => bootstrapAutoSnapshotIfNeeded())
    .catch(() => {});
  updateBadge();
  purgeExpiredArchived();
});

// Update badge when Chrome starts up
chrome.runtime.onStartup.addListener(() => {
  ensureAutoSnapshotAlarm()
    .then(() => bootstrapAutoSnapshotIfNeeded())
    .catch(() => {});
  updateBadge();
  purgeExpiredArchived();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[AUTO_SNAPSHOT_INTERVAL_KEY]) return;
  handleAutoSnapshotIntervalChange().catch(() => {});
});

// Update badge whenever a tab is opened
chrome.tabs.onCreated.addListener(() => {
  updateBadge();
});

// Update badge whenever a tab is closed
chrome.tabs.onRemoved.addListener(() => {
  updateBadge();
});

// Update badge when a tab's URL changes (e.g. navigating to/from chrome://)
chrome.tabs.onUpdated.addListener(() => {
  updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== AUTO_SNAPSHOT_ALARM) return;
  getAutoSnapshotIntervalMinutes()
    .then((minutes) => {
      if (minutes <= 0) return;
      return saveAutoTabSnapshot();
    })
    .catch(() => {});
});

// ─── Message handler for search suggestions ──────────────────────────────────
// The new-tab page can't fetch cross-origin suggest APIs directly (CORS).
// It sends { type: 'fetchSuggest', url } here; the service worker fetches
// on its behalf (host_permissions bypass CORS) and returns the JSON result.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'fetchSuggest') return false;

  const isBaidu = msg.url.includes('suggestion.baidu.com');

  fetch(msg.url)
    .then(r => {
      if (isBaidu) {
        // Baidu returns GBK-encoded text; decoding as UTF-8 produces garbled Chinese
        return r.arrayBuffer().then(buf => new TextDecoder('gbk').decode(buf));
      }
      return r.text();
    })
    .then(text => {
      try { sendResponse({ ok: true, data: JSON.parse(text) }); }
      catch { sendResponse({ ok: false }); }
    })
    .catch(() => sendResponse({ ok: false }));
  return true;
});

// ─── Initial run ─────────────────────────────────────────────────────────────

// Run once immediately when the service worker first loads
ensureAutoSnapshotAlarm()
  .then(() => bootstrapAutoSnapshotIfNeeded())
  .catch(() => {});
updateBadge();
purgeExpiredArchived();
