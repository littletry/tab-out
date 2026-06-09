'use strict';

/* ----------------------------------------------------------------
   CHROME TABS — Direct API Access

   Since this page IS the extension's new tab page, it has full
   access to chrome.tabs and chrome.storage. No middleman needed.
   ---------------------------------------------------------------- */

// All open tabs — populated by fetchOpenTabs()
let openTabs = [];

/**
 * fetchOpenTabs()
 *
 * Reads all currently open browser tabs directly from Chrome.
 * Sets the extensionId flag so we can identify Tab Out's own pages.
 */
async function fetchOpenTabs() {
  try {
    const extensionId = chrome.runtime.id;
    // The new URL for this page is now index.html (not newtab.html)
    const newtabUrl = `chrome-extension://${extensionId}/index.html`;

    const tabs = await chrome.tabs.query({});
    openTabs = tabs.map(t => ({
      id:       t.id,
      url:      t.url,
      title:    t.title,
      windowId: t.windowId,
      active:   t.active,
      // Flag Tab Out's own pages so we can detect duplicate new tabs
      isTabOut: t.url === newtabUrl || t.url === 'chrome://newtab/',
    }));
  } catch {
    // chrome.tabs API unavailable (shouldn't happen in an extension page)
    openTabs = [];
  }
}

/**
 * closeAllRealTabs()
 *
 * Closes every real web tab (exact tab IDs from getRealTabs).
 * Used by the header "close all" action so duplicate URLs / same-host
 * tabs are all closed reliably.
 */
async function closeAllRealTabs() {
  await fetchOpenTabs();
  const ids = getRealTabs().map(t => t.id).filter(id => id != null);
  if (ids.length > 0) await chrome.tabs.remove(ids);
  await fetchOpenTabs();
}

/**
 * closeTabsByIds(tabs)
 *
 * Closes tabs by their Chrome tab IDs. Each item needs an `id` field.
 */
async function closeTabsByIds(tabs) {
  const ids = (tabs || []).map(t => t.id).filter(id => id != null);
  if (ids.length === 0) return;
  await chrome.tabs.remove(ids);
  await fetchOpenTabs();
}

/**
 * closeTabsByUrls(urls)
 *
 * Closes all open tabs whose hostname matches any of the given URLs.
 * After closing, re-fetches the tab list to keep our state accurate.
 *
 * Special case: file:// URLs are matched exactly (they have no hostname).
 */
async function closeTabsByUrls(urls) {
  if (!urls || urls.length === 0) return;

  // Separate file:// URLs (exact match) from regular URLs (hostname match)
  const targetHostnames = [];
  const exactUrls = new Set();

  for (const u of urls) {
    if (u.startsWith('file://')) {
      exactUrls.add(u);
    } else {
      try { targetHostnames.push(new URL(u).hostname); }
      catch { /* skip unparseable */ }
    }
  }

  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs
    .filter(tab => {
      const tabUrl = tab.url || '';
      if (tabUrl.startsWith('file://') && exactUrls.has(tabUrl)) return true;
      try {
        const tabHostname = new URL(tabUrl).hostname;
        return tabHostname && targetHostnames.includes(tabHostname);
      } catch { return false; }
    })
    .map(tab => tab.id);

  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * closeTabsExact(urls)
 *
 * Closes tabs by exact URL match (not hostname). Used for landing pages
 * so closing "Gmail inbox" doesn't also close individual email threads.
 */
async function closeTabsExact(urls) {
  if (!urls || urls.length === 0) return;
  const urlSet = new Set(urls);
  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs.filter(t => urlSet.has(t.url)).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * focusTab(url)
 *
 * Switches Chrome to the tab with the given URL (exact match first,
 * then hostname fallback). Also brings the window to the front.
 */
async function focusTab(url) {
  if (!url) return;
  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();

  // Try exact URL match first
  let matches = allTabs.filter(t => t.url === url);

  // Fall back to hostname match
  if (matches.length === 0) {
    try {
      const targetHost = new URL(url).hostname;
      matches = allTabs.filter(t => {
        try { return new URL(t.url).hostname === targetHost; }
        catch { return false; }
      });
    } catch {}
  }

  if (matches.length === 0) return;

  // Prefer a match in a different window so it actually switches windows
  const match = matches.find(t => t.windowId !== currentWindow.id) || matches[0];
  await chrome.tabs.update(match.id, { active: true });
  await chrome.windows.update(match.windowId, { focused: true });
}

/**
 * closeDuplicateTabs(urls, keepOne)
 *
 * Closes duplicate tabs for the given list of URLs.
 * keepOne=true → keep one copy of each, close the rest.
 * keepOne=false → close all copies.
 */
async function closeDuplicateTabs(urls, keepOne = true) {
  const allTabs = await chrome.tabs.query({});
  const toClose = [];

  for (const url of urls) {
    const matching = allTabs.filter(t => t.url === url);
    if (keepOne) {
      const keep = matching.find(t => t.active) || matching[0];
      for (const tab of matching) {
        if (tab.id !== keep.id) toClose.push(tab.id);
      }
    } else {
      for (const tab of matching) toClose.push(tab.id);
    }
  }

  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * closeTabOutDupes()
 *
 * Closes all duplicate Tab Out new-tab pages except the current one.
 */
async function closeTabOutDupes() {
  const extensionId = chrome.runtime.id;
  const newtabUrl = `chrome-extension://${extensionId}/index.html`;

  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();
  const tabOutTabs = allTabs.filter(t =>
    t.url === newtabUrl || t.url === 'chrome://newtab/'
  );

  if (tabOutTabs.length <= 1) return;

  // Keep the active Tab Out tab in the CURRENT window — that's the one the
  // user is looking at right now. Falls back to any active one, then the first.
  const keep =
    tabOutTabs.find(t => t.active && t.windowId === currentWindow.id) ||
    tabOutTabs.find(t => t.active) ||
    tabOutTabs[0];
  const toClose = tabOutTabs.filter(t => t.id !== keep.id).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}


/* ----------------------------------------------------------------
   HELPER: filter out browser-internal pages
   ---------------------------------------------------------------- */

/**
 * getRealTabs()
 *
 * Returns tabs that are real web pages — no chrome://, extension
 * pages, about:blank, etc.
 */
function getRealTabs() {
  return openTabs.filter(t => {
    const url = t.url || '';
    return (
      !url.startsWith('chrome://') &&
      !url.startsWith('chrome-extension://') &&
      !url.startsWith('about:') &&
      !url.startsWith('edge://') &&
      !url.startsWith('brave://')
    );
  });
}

/**
 * getRealTabCount()
 *
 * Count of real web pages — matches toolbar badge and Tab Stats.
 */
function getRealTabCount() {
  return getRealTabs().length;
}

/**
 * updateFooterTabCount()
 *
 * Syncs the footer stat with getRealTabCount().
 */
function updateFooterTabCount() {
  const statTabs = document.getElementById('statTabs');
  if (statTabs) statTabs.textContent = getRealTabCount();
}

/**
 * checkTabOutDupes()
 *
 * Counts how many Tab Out pages are open. If more than 1,
 * shows a banner offering to close the extras.
 */
function checkTabOutDupes() {
  const tabOutTabs = openTabs.filter(t => t.isTabOut);
  const banner  = document.getElementById('tabOutDupeBanner');
  if (!banner) return;

  if (tabOutTabs.length > 1) {
    const textEl = document.getElementById('tabOutDupeText');
    if (textEl) textEl.textContent = t('dupeBanner.message', { count: tabOutTabs.length });
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}


/* ----------------------------------------------------------------
   LIVE SYNC — refresh tab views when tabs change elsewhere
   ---------------------------------------------------------------- */

let tabSyncTimer = null;
let tabSyncInFlight = false;
let tabSyncPending = false;
let lastRealTabsSnapshot = '';
let tabSyncReadyAt = 0;
const TAB_SYNC_DEBOUNCE_MS = 300;
const TAB_SYNC_WARMUP_MS = 1200;

function buildRealTabsSnapshot() {
  return getRealTabs()
    .map(t => `${t.id}:${t.url}`)
    .sort()
    .join('|');
}

function syncRealTabsSnapshot() {
  lastRealTabsSnapshot = buildRealTabsSnapshot();
}

function scheduleTabSyncRefresh() {
  if (Date.now() - tabSyncReadyAt < TAB_SYNC_WARMUP_MS) return;

  clearTimeout(tabSyncTimer);
  tabSyncTimer = setTimeout(runTabSyncRefresh, TAB_SYNC_DEBOUNCE_MS);
}

async function runTabSyncRefresh() {
  if (tabSyncInFlight) {
    tabSyncPending = true;
    return;
  }
  tabSyncInFlight = true;
  try {
    await fetchOpenTabs();
    const snapshot = buildRealTabsSnapshot();
    if (snapshot === lastRealTabsSnapshot) return;

    lastRealTabsSnapshot = snapshot;
    if (typeof refreshTabViews === 'function') {
      await refreshTabViews({ skipFetch: true });
    }
  } finally {
    tabSyncInFlight = false;
    if (tabSyncPending) {
      tabSyncPending = false;
      scheduleTabSyncRefresh();
    }
  }
}

/**
 * initTabSync()
 *
 * Listens for tab changes in any window and debounces a dashboard refresh.
 * Ignores title/favicon-only updates to avoid refresh storms on page load.
 */
function initTabSync() {
  if (!chrome.tabs?.onCreated) return;

  tabSyncReadyAt = Date.now();
  syncRealTabsSnapshot();

  chrome.tabs.onCreated.addListener(() => scheduleTabSyncRefresh());
  chrome.tabs.onRemoved.addListener(() => scheduleTabSyncRefresh());
  chrome.tabs.onMoved.addListener(() => scheduleTabSyncRefresh());
  if (chrome.tabs.onAttached) chrome.tabs.onAttached.addListener(() => scheduleTabSyncRefresh());
  if (chrome.tabs.onDetached) chrome.tabs.onDetached.addListener(() => scheduleTabSyncRefresh());

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url) scheduleTabSyncRefresh();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleTabSyncRefresh();
  });
}
