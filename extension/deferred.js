'use strict';

/* ----------------------------------------------------------------
   SAVED FOR LATER — chrome.storage.local

   Replaces the old server-side SQLite + REST API with Chrome's
   built-in key-value storage. Data persists across browser sessions
   and doesn't require a running server.

   Data shape stored under the "deferred" key:
   [
     {
       id: "1712345678901",          // timestamp-based unique ID
       url: "https://example.com",
       title: "Example Page",
       savedAt: "2026-04-04T10:00:00.000Z",  // ISO date string
       completed: false,             // true = checked off (archived)
       completedAt: "...",           // set when checked off
       dismissed: false              // true = dismissed without reading
     },
     ...
   ]

   Settings:
     archiveExpireDays — auto-remove archived items after N days (0 = never)
   ---------------------------------------------------------------- */

const ARCHIVE_EXPIRE_DAYS_KEY = 'archiveExpireDays';
const DEFAULT_ARCHIVE_EXPIRE_DAYS = 30;

/**
 * getArchiveExpireDays()
 *
 * Returns how many days archived items are kept before auto-removal.
 * 0 means never expire.
 */
async function getArchiveExpireDays() {
  const result = await chrome.storage.local.get(ARCHIVE_EXPIRE_DAYS_KEY);
  const days = result[ARCHIVE_EXPIRE_DAYS_KEY];
  if (days === undefined || days === null) return DEFAULT_ARCHIVE_EXPIRE_DAYS;
  const n = Number(days);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_ARCHIVE_EXPIRE_DAYS;
}

/**
 * setArchiveExpireDays(days)
 *
 * Persists the archive auto-clear window. Returns the sanitized value.
 */
async function setArchiveExpireDays(days) {
  const n = Math.max(0, Math.floor(Number(days) || 0));
  await chrome.storage.local.set({ [ARCHIVE_EXPIRE_DAYS_KEY]: n });
  return n;
}

/**
 * purgeExpiredArchived()
 *
 * Dismisses archived items older than the configured expire window.
 * Returns the number of items removed.
 */
async function purgeExpiredArchived() {
  const expireDays = await getArchiveExpireDays();
  if (expireDays === 0) return 0;

  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const cutoff = Date.now() - expireDays * 24 * 60 * 60 * 1000;
  let purged = 0;

  for (const tab of deferred) {
    if (tab.dismissed || !tab.completed) continue;
    const refDate = tab.completedAt || tab.savedAt;
    if (!refDate) continue;
    if (new Date(refDate).getTime() < cutoff) {
      tab.dismissed = true;
      purged++;
    }
  }

  if (purged > 0) await chrome.storage.local.set({ deferred });
  return purged;
}

/**
 * saveTabForLater(tab)
 *
 * Saves a single tab to the "Saved for Later" list in chrome.storage.local.
 * @param {{ url: string, title: string }} tab
 */
async function saveTabForLater(tab) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  deferred.push({
    id:        Date.now().toString(),
    url:       tab.url,
    title:     tab.title,
    savedAt:   new Date().toISOString(),
    completed: false,
    dismissed: false,
  });
  await chrome.storage.local.set({ deferred });
}

/**
 * getSavedTabs()
 *
 * Returns all saved tabs from chrome.storage.local.
 * Filters out dismissed items (those are gone for good).
 * Splits into active (not completed) and archived (completed).
 */
async function getSavedTabs() {
  await purgeExpiredArchived();

  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const visible = deferred.filter(t => !t.dismissed);
  return {
    active:   visible.filter(t => !t.completed),
    archived: visible.filter(t => t.completed),
  };
}

/**
 * checkOffSavedTab(id)
 *
 * Marks a saved tab as completed (checked off). It moves to the archive.
 */
async function checkOffSavedTab(id) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const tab = deferred.find(t => t.id === id);
  if (tab) {
    tab.completed = true;
    tab.completedAt = new Date().toISOString();
    await chrome.storage.local.set({ deferred });
  }
}

/**
 * unarchiveSavedTab(id)
 *
 * Moves a completed tab back to the active "Saved for later" list.
 */
async function unarchiveSavedTab(id) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const tab = deferred.find(t => t.id === id);
  if (tab) {
    tab.completed = false;
    delete tab.completedAt;
    await chrome.storage.local.set({ deferred });
  }
}

/**
 * dismissSavedTab(id)
 *
 * Marks a saved tab as dismissed (removed from all lists).
 */
async function dismissSavedTab(id) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const tab = deferred.find(t => t.id === id);
  if (tab) {
    tab.dismissed = true;
    await chrome.storage.local.set({ deferred });
  }
}

/**
 * clearAllArchived()
 *
 * Permanently removes every archived item. Returns count cleared.
 */
async function clearAllArchived() {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  let cleared = 0;

  for (const tab of deferred) {
    if (!tab.dismissed && tab.completed) {
      tab.dismissed = true;
      cleared++;
    }
  }

  if (cleared > 0) await chrome.storage.local.set({ deferred });
  return cleared;
}
