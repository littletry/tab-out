'use strict';

/* ----------------------------------------------------------------
   TAB SNAPSHOTS — shared storage (background + new tab page)
   Manual: up to 5, FIFO. Auto: single slot, interval configurable (default 5 min).
   ---------------------------------------------------------------- */

const TAB_SNAPSHOTS_LEGACY_KEY = 'tabSnapshots';
const TAB_SNAPSHOTS_MANUAL_KEY = 'tabSnapshotsManual';
const TAB_SNAPSHOTS_AUTO_KEY = 'tabSnapshotsAuto';
const AUTO_SNAPSHOT_INTERVAL_KEY = 'autoSnapshotIntervalMinutes';
const MAX_MANUAL_SNAPSHOTS = 5;
const DEFAULT_AUTO_SNAPSHOT_INTERVAL_MINUTES = 5;
const MAX_AUTO_SNAPSHOT_INTERVAL_MINUTES = 1440;

let snapshotMigrationDone = false;

function isRealWebTab(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    !url.startsWith('chrome://') &&
    !url.startsWith('chrome-extension://') &&
    !url.startsWith('about:') &&
    !url.startsWith('edge://') &&
    !url.startsWith('brave://')
  );
}

function isRestorableSnapshotUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('file://')
  );
}

function filterRealWebTabs(tabs) {
  return (tabs || []).filter(t => isRealWebTab(t.url));
}

function buildSnapshotFromTabs(tabs) {
  const realTabs = filterRealWebTabs(tabs);
  return {
    id: String(Date.now()),
    savedAt: new Date().toISOString(),
    tabCount: realTabs.length,
    tabs: realTabs.map(tab => ({
      url: tab.url || '',
      title: tab.title || tab.url || '',
    })),
  };
}

function snapshotUrlsFingerprint(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.tabs)) return '';
  return snapshot.tabs
    .map(t => t.url || '')
    .filter(Boolean)
    .sort()
    .join('\n');
}

async function ensureSnapshotMigration() {
  if (snapshotMigrationDone) return;
  snapshotMigrationDone = true;

  try {
    const result = await chrome.storage.local.get([
      TAB_SNAPSHOTS_LEGACY_KEY,
      TAB_SNAPSHOTS_MANUAL_KEY,
    ]);
    const legacy = result[TAB_SNAPSHOTS_LEGACY_KEY];
    if (!Array.isArray(legacy) || legacy.length === 0) return;

    const existing = result[TAB_SNAPSHOTS_MANUAL_KEY];
    if (!Array.isArray(existing) || existing.length === 0) {
      await chrome.storage.local.set({
        [TAB_SNAPSHOTS_MANUAL_KEY]: legacy.slice(0, MAX_MANUAL_SNAPSHOTS),
      });
    }
    await chrome.storage.local.remove(TAB_SNAPSHOTS_LEGACY_KEY);
  } catch { /* migration failed */ }
}

async function getManualTabSnapshots() {
  await ensureSnapshotMigration();
  try {
    const result = await chrome.storage.local.get(TAB_SNAPSHOTS_MANUAL_KEY);
    const list = result[TAB_SNAPSHOTS_MANUAL_KEY];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function saveManualTabSnapshots(snapshots) {
  await chrome.storage.local.set({ [TAB_SNAPSHOTS_MANUAL_KEY]: snapshots });
}

async function getAutoTabSnapshot() {
  await ensureSnapshotMigration();
  try {
    const result = await chrome.storage.local.get(TAB_SNAPSHOTS_AUTO_KEY);
    const snapshot = result[TAB_SNAPSHOTS_AUTO_KEY];
    return snapshot && typeof snapshot === 'object' ? snapshot : null;
  } catch {
    return null;
  }
}

async function saveAutoTabSnapshotData(snapshot) {
  await chrome.storage.local.set({ [TAB_SNAPSHOTS_AUTO_KEY]: snapshot });
}

async function getAutoSnapshotIntervalMinutes() {
  try {
    const result = await chrome.storage.local.get(AUTO_SNAPSHOT_INTERVAL_KEY);
    const minutes = result[AUTO_SNAPSHOT_INTERVAL_KEY];
    if (minutes === undefined || minutes === null) return DEFAULT_AUTO_SNAPSHOT_INTERVAL_MINUTES;
    const n = Number(minutes);
    if (!Number.isFinite(n) || n < 0) return DEFAULT_AUTO_SNAPSHOT_INTERVAL_MINUTES;
    return Math.floor(n);
  } catch {
    return DEFAULT_AUTO_SNAPSHOT_INTERVAL_MINUTES;
  }
}

async function setAutoSnapshotIntervalMinutes(minutes) {
  const n = Math.floor(Number(minutes) || 0);
  const sanitized = n === 0
    ? 0
    : Math.min(MAX_AUTO_SNAPSHOT_INTERVAL_MINUTES, Math.max(1, n));
  await chrome.storage.local.set({ [AUTO_SNAPSHOT_INTERVAL_KEY]: sanitized });
  return sanitized;
}

async function saveManualTabSnapshotFromTabs(tabs) {
  const snapshot = buildSnapshotFromTabs(tabs);
  if (snapshot.tabCount === 0) return null;

  const manual = await getManualTabSnapshots();
  manual.unshift(snapshot);
  while (manual.length > MAX_MANUAL_SNAPSHOTS) manual.pop();
  await saveManualTabSnapshots(manual);
  return snapshot;
}

async function saveAutoTabSnapshot() {
  const allTabs = await chrome.tabs.query({});
  const snapshot = buildSnapshotFromTabs(allTabs);
  if (snapshot.tabCount === 0) return null;

  const existing = await getAutoTabSnapshot();
  if (existing && snapshotUrlsFingerprint(existing) === snapshotUrlsFingerprint(snapshot)) {
    return null;
  }

  await saveAutoTabSnapshotData(snapshot);
  return snapshot;
}

async function deleteManualTabSnapshot(id) {
  if (!id) return false;
  const manual = await getManualTabSnapshots();
  const next = manual.filter(s => s.id !== id);
  if (next.length === manual.length) return false;
  await saveManualTabSnapshots(next);
  return true;
}

async function findTabSnapshot(id) {
  if (!id) return null;
  const auto = await getAutoTabSnapshot();
  if (auto && auto.id === id) return auto;
  const manual = await getManualTabSnapshots();
  return manual.find(s => s.id === id) || null;
}

async function restoreTabSnapshotById(id) {
  const snapshot = await findTabSnapshot(id);
  if (!snapshot || !Array.isArray(snapshot.tabs)) return 0;

  let opened = 0;
  for (const tab of snapshot.tabs) {
    if (!isRestorableSnapshotUrl(tab.url)) continue;
    try {
      await chrome.tabs.create({ url: tab.url, active: false });
      opened++;
    } catch { /* skip failed tab */ }
  }
  return opened;
}
