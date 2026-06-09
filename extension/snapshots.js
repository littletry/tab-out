'use strict';

/* ----------------------------------------------------------------
   TAB SNAPSHOTS — UI + events (storage in snapshots-storage.js)
   ---------------------------------------------------------------- */

function formatSnapshotDate(savedAt) {
  const locale = typeof getCurrentLang === 'function' && getCurrentLang() === 'zh' ? 'zh-CN' : 'en-US';
  try {
    return new Date(savedAt).toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return savedAt || '';
  }
}

function formatSnapshotMeta(snapshot) {
  const date = formatSnapshotDate(snapshot.savedAt);
  return t('snapshots.meta', { date, count: snapshot.tabCount || 0 });
}

function renderSnapshotItem(snapshot, options = {}) {
  const safeId = (snapshot.id || '').replace(/"/g, '&quot;');
  const meta = formatSnapshotMeta(snapshot);
  const safeMeta = meta.replace(/"/g, '&quot;');
  const showDelete = options.showDelete === true;
  const showAutoBadge = options.showAutoBadge === true;

  const badgeHtml = showAutoBadge
    ? `<span class="tab-snapshot-badge auto">${t('snapshots.autoBadge')}</span>`
    : '';

  const deleteHtml = showDelete
    ? `<button type="button" class="tab-snapshot-action delete" data-action="delete-tab-snapshot" data-snapshot-id="${safeId}" title="${t('snapshots.delete')}">${t('snapshots.delete')}</button>`
    : '';

  return `<div class="tab-snapshot-item" data-snapshot-id="${safeId}">
    ${badgeHtml}
    <span class="tab-snapshot-meta" title="${safeMeta}">${meta}</span>
    <div class="tab-snapshot-actions">
      <button type="button" class="tab-snapshot-action" data-action="restore-tab-snapshot" data-snapshot-id="${safeId}" title="${t('snapshots.restore')}">${t('snapshots.restore')}</button>
      ${deleteHtml}
    </div>
  </div>`;
}

async function saveTabSnapshot() {
  await fetchOpenTabs();
  const realTabs = getRealTabs();
  return saveManualTabSnapshotFromTabs(realTabs);
}

async function renderTabSnapshots() {
  const autoList = document.getElementById('tabSnapshotsAutoList');
  const manualList = document.getElementById('tabSnapshotsManualList');
  const autoEmpty = document.getElementById('tabSnapshotsAutoEmpty');
  const manualEmpty = document.getElementById('tabSnapshotsManualEmpty');
  const panelEmpty = document.getElementById('tabSnapshotsEmpty');
  const intervalInput = document.getElementById('autoSnapshotIntervalMinutes');
  if (!autoList || !manualList) return;

  try {
    if (intervalInput && document.activeElement !== intervalInput) {
      intervalInput.value = await getAutoSnapshotIntervalMinutes();
    }
    const auto = await getAutoTabSnapshot();
    const manual = await getManualTabSnapshots();

    if (auto) {
      autoList.innerHTML = renderSnapshotItem(auto, { showAutoBadge: true });
      autoList.style.display = 'flex';
      if (autoEmpty) autoEmpty.style.display = 'none';
    } else {
      autoList.innerHTML = '';
      autoList.style.display = 'none';
      if (autoEmpty) autoEmpty.style.display = 'block';
    }

    if (manual.length > 0) {
      manualList.innerHTML = manual.map(s => renderSnapshotItem(s, { showDelete: true })).join('');
      manualList.style.display = 'flex';
      if (manualEmpty) manualEmpty.style.display = 'none';
    } else {
      manualList.innerHTML = '';
      manualList.style.display = 'none';
      if (manualEmpty) manualEmpty.style.display = 'block';
    }

    if (panelEmpty) {
      panelEmpty.style.display = !auto && manual.length === 0 ? 'block' : 'none';
    }
  } catch {
    autoList.innerHTML = '';
    manualList.innerHTML = '';
    autoList.style.display = 'none';
    manualList.style.display = 'none';
    if (autoEmpty) autoEmpty.style.display = 'block';
    if (manualEmpty) manualEmpty.style.display = 'block';
    if (panelEmpty) panelEmpty.style.display = 'block';
  }
}

document.addEventListener('click', async (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  if (action === 'save-tab-snapshot') {
    e.stopPropagation();
    try {
      const snapshot = await saveTabSnapshot();
      if (!snapshot) {
        showToast(t('toast.snapshotEmpty'));
        return;
      }
      await renderTabSnapshots();
      showToast(t('toast.snapshotSaved', { count: snapshot.tabCount }));
    } catch {
      showToast(t('toast.saveFailed'));
    }
    return;
  }

  if (action === 'restore-tab-snapshot') {
    e.stopPropagation();
    const id = actionEl.dataset.snapshotId;
    if (!id) return;
    try {
      const opened = await restoreTabSnapshotById(id);
      if (opened > 0) {
        showToast(t('toast.snapshotRestored', { count: opened }));
      }
    } catch { /* restore failed */ }
    return;
  }

  if (action === 'delete-tab-snapshot') {
    e.stopPropagation();
    const id = actionEl.dataset.snapshotId;
    if (!id) return;
    try {
      const deleted = await deleteManualTabSnapshot(id);
      if (deleted) {
        await renderTabSnapshots();
        showToast(t('toast.snapshotDeleted'));
      }
    } catch { /* delete failed */ }
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.id !== 'autoSnapshotIntervalMinutes') return;

  const minutes = await setAutoSnapshotIntervalMinutes(e.target.value);
  e.target.value = minutes;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[TAB_SNAPSHOTS_AUTO_KEY] || changes[TAB_SNAPSHOTS_MANUAL_KEY]) {
    renderTabSnapshots().catch(() => {});
  }
});
