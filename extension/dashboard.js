'use strict';

/* ----------------------------------------------------------------
   IN-MEMORY STORE FOR OPEN-TAB GROUPS
   ---------------------------------------------------------------- */
let domainGroups = [];
let openTabsPrefs = { pinned: [], collapsed: [] };
let openTabsLandingSortCtx = null;

const PINNED_DOMAINS_KEY = 'openTabsPinnedDomains';
const COLLAPSED_DOMAINS_KEY = 'openTabsCollapsedDomains';

async function getOpenTabsPrefs() {
  const result = await chrome.storage.local.get([PINNED_DOMAINS_KEY, COLLAPSED_DOMAINS_KEY]);
  return {
    pinned: Array.isArray(result[PINNED_DOMAINS_KEY]) ? result[PINNED_DOMAINS_KEY] : [],
    collapsed: Array.isArray(result[COLLAPSED_DOMAINS_KEY]) ? result[COLLAPSED_DOMAINS_KEY] : [],
  };
}

async function saveOpenTabsPrefs(prefs) {
  await chrome.storage.local.set({
    [PINNED_DOMAINS_KEY]: prefs.pinned,
    [COLLAPSED_DOMAINS_KEY]: prefs.collapsed,
  });
  openTabsPrefs = prefs;
}

async function togglePinnedDomain(domainKey) {
  const prefs = await getOpenTabsPrefs();
  const idx = prefs.pinned.indexOf(domainKey);
  if (idx === -1) prefs.pinned.push(domainKey);
  else prefs.pinned.splice(idx, 1);
  await saveOpenTabsPrefs(prefs);
}

async function toggleCollapsedDomain(domainKey) {
  const prefs = await getOpenTabsPrefs();
  const idx = prefs.collapsed.indexOf(domainKey);
  if (idx === -1) prefs.collapsed.push(domainKey);
  else prefs.collapsed.splice(idx, 1);
  await saveOpenTabsPrefs(prefs);
}

async function collapseAllDomains() {
  const prefs = await getOpenTabsPrefs();
  prefs.collapsed = domainGroups.map(g => g.domain);
  await saveOpenTabsPrefs(prefs);
}

async function expandAllDomains() {
  const prefs = await getOpenTabsPrefs();
  prefs.collapsed = [];
  await saveOpenTabsPrefs(prefs);
}

function updateOpenTabsToolbar(hasGroups) {
  const toolbar = document.getElementById('openTabsToolbar');
  if (!toolbar) return;
  toolbar.style.display = hasGroups ? 'flex' : 'none';
}

function applyFoldStateToAllCards(isFolded) {
  document.querySelectorAll('#openTabsMissions .domain-card').forEach(card => {
    updateDomainCardFoldState(card, isFolded);
  });
  const searchEl = document.getElementById('openTabsSearch');
  applyOpenTabsSearchFilter(searchEl ? searchEl.value : '');
}

async function pruneOpenTabsPrefs(activeDomainKeys) {
  const activeSet = new Set(activeDomainKeys);
  const prefs = await getOpenTabsPrefs();
  const pinned = prefs.pinned.filter(k => activeSet.has(k));
  const collapsed = prefs.collapsed.filter(k => activeSet.has(k));
  if (pinned.length !== prefs.pinned.length || collapsed.length !== prefs.collapsed.length) {
    await saveOpenTabsPrefs({ pinned, collapsed });
  } else {
    openTabsPrefs = prefs;
  }
}

function buildLandingSortContext(landingPagePatterns) {
  const landingHostnames = new Set(landingPagePatterns.map(p => p.hostname).filter(Boolean));
  const landingSuffixes = landingPagePatterns.map(p => p.hostnameEndsWith).filter(Boolean);
  return {
    isLandingDomain(domain) {
      if (landingHostnames.has(domain)) return true;
      return landingSuffixes.some(s => domain.endsWith(s));
    },
  };
}

function sortDomainGroupsInPlace(groups, pinnedDomains, isLandingDomain) {
  groups.sort((a, b) => {
    const aIsLanding = a.domain === '__landing-pages__';
    const bIsLanding = b.domain === '__landing-pages__';
    if (aIsLanding !== bIsLanding) return aIsLanding ? -1 : 1;

    const aPinIdx = pinnedDomains.indexOf(a.domain);
    const bPinIdx = pinnedDomains.indexOf(b.domain);
    const aPinned = aPinIdx !== -1;
    const bPinned = bPinIdx !== -1;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) return aPinIdx - bPinIdx;

    const aIsPriority = isLandingDomain(a.domain);
    const bIsPriority = isLandingDomain(b.domain);
    if (aIsPriority !== bIsPriority) return aIsPriority ? -1 : 1;

    return b.tabs.length - a.tabs.length;
  });
}

function applyOpenTabsSearchFilter(query) {
  const q = (query ?? '').trim().toLowerCase();
  const emptyEl = document.getElementById('openTabsSearchEmpty');
  const cards = document.querySelectorAll('#openTabsMissions .domain-card');

  if (q.length < 2) {
    cards.forEach(card => {
      card.classList.remove('domain-card-search-hidden', 'search-force-open');
      card.querySelectorAll('.page-chip').forEach(chip => chip.classList.remove('search-hidden'));
    });
    if (emptyEl) emptyEl.style.display = 'none';
    return;
  }

  let visibleCount = 0;
  cards.forEach(card => {
    card.classList.remove('domain-card-search-hidden', 'search-force-open');
    const domainKey = (card.dataset.domainKey || '').toLowerCase();
    const groupName = (card.querySelector('.mission-name')?.textContent || '').toLowerCase();
    const groupMatch = domainKey.includes(q) || groupName.includes(q);
    const chips = card.querySelectorAll('.page-chip[data-action="focus-tab"]');

    if (groupMatch) {
      chips.forEach(chip => chip.classList.remove('search-hidden'));
      visibleCount++;
      if (card.classList.contains('domain-card-folded')) card.classList.add('search-force-open');
      return;
    }

    let anyChipMatch = false;
    chips.forEach(chip => {
      const title = (chip.getAttribute('title') || '').toLowerCase();
      const url = (chip.dataset.tabUrl || '').toLowerCase();
      const match = title.includes(q) || url.includes(q);
      chip.classList.toggle('search-hidden', !match);
      if (match) anyChipMatch = true;
    });

    if (anyChipMatch) {
      visibleCount++;
      if (card.classList.contains('domain-card-folded')) card.classList.add('search-force-open');
    } else {
      card.classList.add('domain-card-search-hidden');
    }
  });

  if (emptyEl) emptyEl.style.display = visibleCount === 0 ? 'block' : 'none';
}

let openTabsMissionsInitialized = false;

function updateDomainCardFoldState(card, isFolded) {
  if (!card) return;
  card.classList.toggle('domain-card-folded', isFolded);
  const header = card.querySelector('.domain-card-header');
  if (header) {
    header.setAttribute('aria-expanded', !isFolded);
    header.title = isFolded ? t('openTabs.expand') : t('openTabs.fold');
  }
}

function rerenderOpenTabsMissions() {
  const openTabsMissionsEl = document.getElementById('openTabsMissions');
  const openTabsSectionCount = document.getElementById('openTabsSectionCount');
  const openTabsSection = document.getElementById('openTabsSection');
  if (!openTabsMissionsEl || !openTabsSection) return;

  const realTabs = getRealTabs();
  if (domainGroups.length === 0) {
    openTabsSection.style.display = 'block';
    updateOpenTabsToolbar(false);
    renderOpenTabsEmptyState();
    const emptyEl = document.getElementById('openTabsSearchEmpty');
    if (emptyEl) emptyEl.style.display = 'none';
    return;
  }

  if (openTabsSectionCount) {
    openTabsSectionCount.innerHTML = `
      <span class="open-tabs-meta-count">${tp('openTabs.domainCount', domainGroups.length)}</span>
      <span class="open-tabs-meta-sep" aria-hidden="true">&middot;</span>
      <button type="button" class="action-btn close-tabs open-tabs-close-all" data-action="close-all-open-tabs" data-tab-count="${realTabs.length}">
        <span class="close-tabs-label">${t('openTabs.closeAllShort', { count: realTabs.length })}</span>
      </button>`;
  }
  if (openTabsMissionsInitialized) {
    openTabsMissionsEl.classList.add('missions-static');
  }
  openTabsMissionsEl.innerHTML = domainGroups.map(g => renderDomainCard(g, openTabsPrefs)).join('');
  openTabsSection.style.display = 'block';
  openTabsMissionsInitialized = true;
  updateOpenTabsToolbar(true);

  const searchEl = document.getElementById('openTabsSearch');
  applyOpenTabsSearchFilter(searchEl ? searchEl.value : '');
}


/* ----------------------------------------------------------------
   OVERFLOW CHIPS ("+N more" expand button in domain cards)
   ---------------------------------------------------------------- */

function buildOverflowChips(hiddenTabs, urlCounts = {}) {
  const hiddenChips = hiddenTabs.map(tab => {
    const label    = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), '');
    const count    = urlCounts[tab.url] || 1;
    const dupeTag  = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : '';
    const chipClass = count > 1 ? ' chip-has-dupes' : '';
    const safeUrl   = (tab.url || '').replace(/"/g, '&quot;');
    const safeTitle = label.replace(/"/g, '&quot;');
    let domain = '';
    try { domain = new URL(tab.url).hostname; } catch {}
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : '';
    return `<div class="page-chip clickable${chipClass}" data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}">
      ${faviconUrl ? `<img class="chip-favicon" src="${faviconUrl}" alt="">` : ''}
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="${t('chip.saveForLater')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="${t('chip.closeTab')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="page-chips-overflow" style="display:none">${hiddenChips}</div>
    <div class="page-chip page-chip-overflow clickable" data-action="expand-chips">
      <span class="chip-text">${t('openTabs.more', { count: hiddenTabs.length })}</span>
    </div>`;
}


/* ----------------------------------------------------------------
   DOMAIN CARD RENDERER
   ---------------------------------------------------------------- */

/**
 * renderDomainCard(group, groupIndex)
 *
 * Builds the HTML for one domain group card.
 * group = { domain: string, tabs: [{ url, title, id, windowId, active }] }
 */
function renderDomainCard(group, prefs = openTabsPrefs) {
  const tabs      = group.tabs || [];
  const tabCount  = tabs.length;
  const isLanding = group.domain === '__landing-pages__';
  const stableId  = 'domain-' + group.domain.replace(/[^a-z0-9]/g, '-');
  const isPinned  = prefs.pinned.includes(group.domain);
  const isFolded  = prefs.collapsed.includes(group.domain);
  const safeDomainKey = (group.domain || '').replace(/"/g, '&quot;');

  // Count duplicates (exact URL match)
  const urlCounts = {};
  for (const tab of tabs) urlCounts[tab.url] = (urlCounts[tab.url] || 0) + 1;
  const dupeUrls   = Object.entries(urlCounts).filter(([, c]) => c > 1);
  const hasDupes   = dupeUrls.length > 0;
  const totalExtras = dupeUrls.reduce((s, [, c]) => s + c - 1, 0);

  const tabBadge = `<span class="open-tabs-badge">
    ${ICONS.tabs}
    ${tp('openTabs.tabsOpen', tabCount)}
  </span>`;

  const dupeBadge = hasDupes
    ? `<span class="open-tabs-badge dupe-count-badge" style="color:var(--accent-amber);background:rgba(200,113,58,0.08);">
        ${tp('openTabs.duplicates', totalExtras)}
      </span>`
    : '';

  // Deduplicate for display: show each URL once, with (Nx) badge if duped
  const seen = new Set();
  const uniqueTabs = [];
  for (const tab of tabs) {
    if (!seen.has(tab.url)) { seen.add(tab.url); uniqueTabs.push(tab); }
  }

  const visibleTabs = uniqueTabs.slice(0, 8);
  const extraCount  = uniqueTabs.length - visibleTabs.length;

  const pageChips = visibleTabs.map(tab => {
    let label = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), group.domain);
    // For localhost tabs, prepend port number so you can tell projects apart
    try {
      const parsed = new URL(tab.url);
      if (parsed.hostname === 'localhost' && parsed.port) label = `${parsed.port} ${label}`;
    } catch {}
    const count    = urlCounts[tab.url];
    const dupeTag  = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : '';
    const chipClass = count > 1 ? ' chip-has-dupes' : '';
    const safeUrl   = (tab.url || '').replace(/"/g, '&quot;');
    const safeTitle = label.replace(/"/g, '&quot;');
    let domain = '';
    try { domain = new URL(tab.url).hostname; } catch {}
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : '';
    return `<div class="page-chip clickable${chipClass}" data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}">
      ${faviconUrl ? `<img class="chip-favicon" src="${faviconUrl}" alt="">` : ''}
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="${t('chip.saveForLater')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="${t('chip.closeTab')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('') + (extraCount > 0 ? buildOverflowChips(uniqueTabs.slice(8), urlCounts) : '');

  let actionsHtml = `
    <button type="button" class="action-btn close-tabs" data-action="close-domain-tabs" data-domain-id="${stableId}" data-tab-count="${tabCount}">
      <span class="close-tabs-label">${t('openTabs.closeDomainShort', { count: tabCount })}</span>
    </button>`;

  if (hasDupes) {
    const dupeUrlsEncoded = dupeUrls.map(([url]) => encodeURIComponent(url)).join(',');
    actionsHtml += `
      <button class="action-btn" data-action="dedup-keep-one" data-dupe-urls="${dupeUrlsEncoded}">
        ${tp('openTabs.closeDupes', totalExtras)}
      </button>`;
  }

  const pinTitle = isPinned ? t('openTabs.unpin') : t('openTabs.pin');
  const foldTitle = isFolded ? t('openTabs.expand') : t('openTabs.fold');
  const controlsHtml = `
    <div class="domain-card-controls">
      <button type="button" class="domain-card-btn domain-card-pin${isPinned ? ' is-active' : ''}"
              data-action="toggle-pin-domain" data-domain-key="${safeDomainKey}"
              aria-pressed="${isPinned}" title="${pinTitle}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
      </button>
    </div>`;

  const cardClasses = [
    'mission-card',
    'domain-card',
    hasDupes ? 'has-amber-bar' : 'has-neutral-bar',
    isPinned ? 'domain-card-pinned' : '',
    isFolded ? 'domain-card-folded' : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="${cardClasses}" data-domain-id="${stableId}" data-domain-key="${safeDomainKey}">
      <div class="status-bar"></div>
      <div class="mission-content">
        <div class="mission-top domain-card-header" data-action="toggle-fold-domain" data-domain-key="${safeDomainKey}"
             aria-expanded="${!isFolded}" title="${foldTitle}">
          <div class="domain-card-header-main">
            <span class="domain-card-chevron" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </span>
            <span class="mission-name">${isLanding ? t('openTabs.homepages') : (group.label || friendlyDomain(group.domain))}</span>
            ${tabBadge}
            ${dupeBadge}
          </div>
          ${controlsHtml}
        </div>
        <div class="mission-pages">${pageChips}</div>
        <div class="actions">${actionsHtml}</div>
      </div>
      <div class="mission-meta">
        <div class="mission-page-count">${tabCount}</div>
        <div class="mission-page-label">${t('openTabs.tabsLabel')}</div>
      </div>
    </div>`;
}


/* ----------------------------------------------------------------
   SAVED FOR LATER — Render Checklist Column
   ---------------------------------------------------------------- */

/**
 * renderDeferredColumn()
 *
 * Reads saved tabs from chrome.storage.local and renders the right-side
 * "Saved for Later" checklist column. Shows active items as a checklist
 * and completed items in a collapsible archive.
 */
async function renderDeferredColumn() {
  const column         = document.getElementById('deferredColumn');
  const list           = document.getElementById('deferredList');
  const empty          = document.getElementById('deferredEmpty');
  const countEl        = document.getElementById('deferredCount');
  const archiveEl      = document.getElementById('deferredArchive');
  const archiveCountEl = document.getElementById('archiveCount');
  const archiveList    = document.getElementById('archiveList');
  const archiveEmpty   = document.getElementById('archiveEmpty');
  const archiveClearAll = document.getElementById('archiveClearAll');
  const expireInput    = document.getElementById('archiveExpireDays');

  if (!column) return;

  try {
    const { active, archived } = await getSavedTabs();
    const expireDays = await getArchiveExpireDays();

    // Hide the entire column if there's nothing to show
    if (active.length === 0 && archived.length === 0) {
      column.style.display = 'none';
      return;
    }

    column.style.display = 'block';

    // Render active checklist items
    if (active.length > 0) {
      countEl.textContent = tp('deferred.itemCount', active.length);
      list.innerHTML = active.map(item => renderDeferredItem(item)).join('');
      list.style.display = 'block';
      empty.style.display = 'none';
    } else {
      list.style.display = 'none';
      countEl.textContent = '';
      empty.style.display = 'block';
    }

    // Archive section — always visible when the column is shown
    archiveEl.style.display = 'block';
    archiveCountEl.textContent = `(${archived.length})`;

    if (expireInput && document.activeElement !== expireInput) {
      expireInput.value = expireDays;
    }

    if (archiveClearAll) {
      archiveClearAll.style.display = archived.length > 0 ? 'inline-flex' : 'none';
    }

    if (archived.length > 0) {
      archiveList.innerHTML = archived.map(item => renderArchiveItem(item)).join('');
      archiveList.style.display = 'block';
      if (archiveEmpty) archiveEmpty.style.display = 'none';
    } else {
      archiveList.innerHTML = '';
      archiveList.style.display = 'none';
      if (archiveEmpty) archiveEmpty.style.display = 'block';
    }

  } catch (err) {
    console.warn('[tab-out] Could not load saved tabs:', err);
    column.style.display = 'none';
  }
}

/**
 * renderDeferredItem(item)
 *
 * Builds HTML for one active checklist item: checkbox, title link,
 * domain, time ago, dismiss button.
 */
function renderDeferredItem(item) {
  let domain = '';
  try { domain = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  const ago = timeAgo(item.savedAt);

  return `
    <div class="deferred-item" data-deferred-id="${item.id}">
      <input type="checkbox" class="deferred-checkbox" data-action="check-deferred" data-deferred-id="${item.id}">
      <div class="deferred-info">
        <a href="${item.url}" target="_blank" rel="noopener" class="deferred-title" title="${(item.title || '').replace(/"/g, '&quot;')}">
          <img src="${faviconUrl}" alt="" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px">${item.title || item.url}
        </a>
        <div class="deferred-meta">
          <span>${domain}</span>
          <span>${ago}</span>
        </div>
      </div>
      <button class="deferred-dismiss" data-action="dismiss-deferred" data-deferred-id="${item.id}" title="${t('deferred.dismiss')}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>`;
}

/**
 * renderArchiveItem(item)
 *
 * Builds HTML for one completed/archived item (simpler: just title + date).
 */
function renderArchiveItem(item) {
  const ago = item.completedAt ? timeAgo(item.completedAt) : timeAgo(item.savedAt);
  return `
    <div class="archive-item" data-deferred-id="${item.id}">
      <a href="${item.url}" target="_blank" rel="noopener" class="archive-item-title" title="${(item.title || '').replace(/"/g, '&quot;')}">
        ${item.title || item.url}
      </a>
      <span class="archive-item-date">${ago}</span>
      <div class="archive-item-actions">
        <button type="button" class="archive-item-action" data-action="unarchive-deferred" data-deferred-id="${item.id}" title="${t('archive.return')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
        </button>
        <button type="button" class="archive-item-action delete" data-action="delete-archived" data-deferred-id="${item.id}" title="${t('archive.delete')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
}


/* ----------------------------------------------------------------
   MAIN DASHBOARD RENDERER
   ---------------------------------------------------------------- */

/**
 * renderStaticDashboard()
 *
 * The main render function:
 * 1. Paints greeting + date
 * 2. Fetches open tabs via chrome.tabs.query()
 * 3. Groups tabs by domain (with landing pages pulled out to their own group)
 * 4. Renders domain cards
 * 5. Updates footer stats
 * 6. Renders the "Saved for Later" checklist
 */
async function renderStaticDashboard(options = {}) {
  const tabsOnly = options.tabsOnly === true;

  if (!tabsOnly) {
    // --- Header ---
    const greetingEl = document.getElementById('greeting');
    const dateEl     = document.getElementById('dateDisplay');
    if (greetingEl) greetingEl.textContent = getGreeting();
    if (dateEl && !dateEl._clockStarted) {
      startClock(dateEl);
      dateEl._clockStarted = true;
    }
  }

  // --- Fetch tabs ---
  if (!options.skipFetch) {
    await fetchOpenTabs();
  }
  const realTabs = getRealTabs();

  // --- Group tabs by domain ---
  // Landing pages (Gmail inbox, Twitter home, etc.) get their own special group
  // so they can be closed together without affecting content tabs on the same domain.
  const LANDING_PAGE_PATTERNS = [
    { hostname: 'mail.google.com', test: (p, h) =>
        !h.includes('#inbox/') && !h.includes('#sent/') && !h.includes('#search/') },
    { hostname: 'x.com',               pathExact: ['/home'] },
    { hostname: 'www.linkedin.com',    pathExact: ['/'] },
    { hostname: 'github.com',          pathExact: ['/'] },
    { hostname: 'www.youtube.com',     pathExact: ['/'] },
    // Merge personal patterns from config.local.js (if it exists)
    ...(typeof LOCAL_LANDING_PAGE_PATTERNS !== 'undefined' ? LOCAL_LANDING_PAGE_PATTERNS : []),
  ];

  function isLandingPage(url) {
    try {
      const parsed = new URL(url);
      return LANDING_PAGE_PATTERNS.some(p => {
        // Support both exact hostname and suffix matching (for wildcard subdomains)
        const hostnameMatch = p.hostname
          ? parsed.hostname === p.hostname
          : p.hostnameEndsWith
            ? parsed.hostname.endsWith(p.hostnameEndsWith)
            : false;
        if (!hostnameMatch) return false;
        if (p.test)       return p.test(parsed.pathname, url);
        if (p.pathPrefix) return parsed.pathname.startsWith(p.pathPrefix);
        if (p.pathExact)  return p.pathExact.includes(parsed.pathname);
        return parsed.pathname === '/';
      });
    } catch { return false; }
  }

  domainGroups = [];
  const groupMap    = {};
  const landingTabs = [];

  // Custom group rules from config.local.js (if any)
  const customGroups = typeof LOCAL_CUSTOM_GROUPS !== 'undefined' ? LOCAL_CUSTOM_GROUPS : [];

  // Check if a URL matches a custom group rule; returns the rule or null
  function matchCustomGroup(url) {
    try {
      const parsed = new URL(url);
      return customGroups.find(r => {
        const hostMatch = r.hostname
          ? parsed.hostname === r.hostname
          : r.hostnameEndsWith
            ? parsed.hostname.endsWith(r.hostnameEndsWith)
            : false;
        if (!hostMatch) return false;
        if (r.pathPrefix) return parsed.pathname.startsWith(r.pathPrefix);
        return true; // hostname matched, no path filter
      }) || null;
    } catch { return null; }
  }

  for (const tab of realTabs) {
    try {
      if (isLandingPage(tab.url)) {
        landingTabs.push(tab);
        continue;
      }

      // Check custom group rules first (e.g. merge subdomains, split by path)
      const customRule = matchCustomGroup(tab.url);
      if (customRule) {
        const key = customRule.groupKey;
        if (!groupMap[key]) groupMap[key] = { domain: key, label: customRule.groupLabel, tabs: [] };
        groupMap[key].tabs.push(tab);
        continue;
      }

      let hostname;
      if (tab.url && tab.url.startsWith('file://')) {
        hostname = 'local-files';
      } else {
        hostname = new URL(tab.url).hostname;
      }
      if (!hostname) continue;

      if (!groupMap[hostname]) groupMap[hostname] = { domain: hostname, tabs: [] };
      groupMap[hostname].tabs.push(tab);
    } catch {
      // Skip malformed URLs
    }
  }

  if (landingTabs.length > 0) {
    groupMap['__landing-pages__'] = { domain: '__landing-pages__', tabs: landingTabs };
  }

  // Sort: landing pages first, then pinned, then priority domains, then by tab count
  openTabsLandingSortCtx = buildLandingSortContext(LANDING_PAGE_PATTERNS);
  const isLandingDomain = openTabsLandingSortCtx.isLandingDomain;

  domainGroups = Object.values(groupMap);
  await pruneOpenTabsPrefs(domainGroups.map(g => g.domain));
  sortDomainGroupsInPlace(domainGroups, openTabsPrefs.pinned, isLandingDomain);

  // --- Render domain cards ---
  const openTabsSection      = document.getElementById('openTabsSection');
  const openTabsSectionTitle = document.getElementById('openTabsSectionTitle');

  if (openTabsSection) {
    if (openTabsSectionTitle) openTabsSectionTitle.textContent = t('openTabs.title');
    rerenderOpenTabsMissions();
  }

  // --- Footer stats ---
  updateFooterTabCount();

  // --- Check for duplicate Tab Out tabs ---
  checkTabOutDupes();

  if (tabsOnly) {
    if (typeof renderTabStats === 'function') renderTabStats();
    syncRealTabsSnapshot();
    return;
  }

  // --- Render "Saved for Later" column ---
  await renderDeferredColumn();

  // --- Render utility panels (right sidebar) ---
  if (typeof renderPanels === 'function') await renderPanels();

  syncRealTabsSnapshot();
}

async function renderDashboard() {
  await renderStaticDashboard();
}

/**
 * refreshTabViews()
 *
 * Lightweight refresh when tabs change elsewhere — skips header, deferred
 * column, and panels that would interrupt user input.
 */
async function refreshTabViews(options = {}) {
  await renderStaticDashboard({ tabsOnly: true, skipFetch: options.skipFetch === true });
}


/* ----------------------------------------------------------------
   CLOSE-ALL CONFIRM — two-step confirm on domain card buttons
   ---------------------------------------------------------------- */

let closeConfirmTimer = null;

function getCloseButtonDefaultLabel(btn) {
  const count = btn.dataset.tabCount || '0';
  if (btn.dataset.action === 'close-all-open-tabs') {
    return t('openTabs.closeAllShort', { count });
  }
  return t('openTabs.closeDomainShort', { count });
}

function resetCloseConfirmButtons() {
  clearTimeout(closeConfirmTimer);
  document.querySelectorAll('[data-action="close-domain-tabs"][data-confirm-pending], [data-action="close-all-open-tabs"][data-confirm-pending]').forEach(btn => {
    delete btn.dataset.confirmPending;
    btn.classList.remove('close-tabs-confirm');
    const label = btn.querySelector('.close-tabs-label');
    if (label) label.textContent = getCloseButtonDefaultLabel(btn);
  });
}

function armCloseConfirmButton(btn) {
  resetCloseConfirmButtons();
  btn.dataset.confirmPending = 'true';
  btn.classList.add('close-tabs-confirm');
  const label = btn.querySelector('.close-tabs-label');
  const count = btn.dataset.tabCount || '0';
  if (label) label.textContent = t('openTabs.confirmClose', { count });
  clearTimeout(closeConfirmTimer);
  closeConfirmTimer = setTimeout(resetCloseConfirmButtons, 4000);
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-action="close-domain-tabs"]') &&
      !e.target.closest('[data-action="close-all-open-tabs"]')) {
    resetCloseConfirmButtons();
  }
}, true);


/* ----------------------------------------------------------------
   EVENT HANDLERS — using event delegation

   One listener on document handles ALL button clicks.
   Think of it as one security guard watching the whole building
   instead of one per door.
   ---------------------------------------------------------------- */

document.addEventListener('click', async (e) => {
  // Walk up the DOM to find the nearest element with data-action
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  // ---- Close duplicate Tab Out tabs ----
  if (action === 'close-tabout-dupes') {
    await closeTabOutDupes();
    playCloseSound();
    const banner = document.getElementById('tabOutDupeBanner');
    if (banner) {
      banner.style.transition = 'opacity 0.4s';
      banner.style.opacity = '0';
      setTimeout(() => { banner.style.display = 'none'; banner.style.opacity = '1'; }, 400);
    }
    showToast(t('toast.closedDupes'));
    return;
  }

  const card = actionEl.closest('.mission-card');

  // ---- Expand overflow chips ("+N more") ----
  if (action === 'expand-chips') {
    const overflowContainer = actionEl.parentElement.querySelector('.page-chips-overflow');
    if (overflowContainer) {
      overflowContainer.style.display = 'contents';
      actionEl.remove();
    }
    return;
  }

  // ---- Pin / unpin a domain group ----
  if (action === 'toggle-pin-domain') {
    e.stopPropagation();
    const domainKey = actionEl.dataset.domainKey;
    if (!domainKey) return;
    await togglePinnedDomain(domainKey);
    const isLandingDomain = openTabsLandingSortCtx?.isLandingDomain || (() => false);
    sortDomainGroupsInPlace(domainGroups, openTabsPrefs.pinned, isLandingDomain);
    rerenderOpenTabsMissions();
    return;
  }

  // ---- Fold / expand a domain group (click header row) ----
  if (action === 'toggle-fold-domain') {
    const domainKey = actionEl.dataset.domainKey;
    if (!domainKey) return;
    await toggleCollapsedDomain(domainKey);
    const isFolded = openTabsPrefs.collapsed.includes(domainKey);
    updateDomainCardFoldState(actionEl.closest('.domain-card'), isFolded);
    const searchEl = document.getElementById('openTabsSearch');
    applyOpenTabsSearchFilter(searchEl ? searchEl.value : '');
    return;
  }

  // ---- Collapse / expand all domain groups ----
  if (action === 'collapse-all-domains') {
    await collapseAllDomains();
    applyFoldStateToAllCards(true);
    return;
  }

  if (action === 'expand-all-domains') {
    await expandAllDomains();
    applyFoldStateToAllCards(false);
    return;
  }

  // ---- Focus a specific tab ----
  if (action === 'focus-tab') {
    const tabUrl = actionEl.dataset.tabUrl;
    if (tabUrl) await focusTab(tabUrl);
    return;
  }

  // ---- Close a single tab ----
  if (action === 'close-single-tab') {
    e.stopPropagation(); // don't trigger parent chip's focus-tab
    const tabUrl = actionEl.dataset.tabUrl;
    if (!tabUrl) return;

    // Close the tab in Chrome directly
    const allTabs = await chrome.tabs.query({});
    const match   = allTabs.find(t => t.url === tabUrl);
    if (match) await chrome.tabs.remove(match.id);
    await fetchOpenTabs();

    playCloseSound();

    // Animate the chip row out
    const chip = actionEl.closest('.page-chip');
    if (chip) {
      const rect = chip.getBoundingClientRect();
      shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      chip.style.transition = 'opacity 0.2s, transform 0.2s';
      chip.style.opacity    = '0';
      chip.style.transform  = 'scale(0.8)';
      setTimeout(() => {
        chip.remove();
        // If the card now has no tabs, remove it too
        const parentCard = document.querySelector('.mission-card:has(.mission-pages:empty)');
        if (parentCard) animateCardOut(parentCard);
        document.querySelectorAll('.mission-card').forEach(c => {
          if (c.querySelectorAll('.page-chip[data-action="focus-tab"]').length === 0) {
            animateCardOut(c);
          }
        });
      }, 200);
    }

    // Update footer
    updateFooterTabCount();

    showToast(t('toast.tabClosed'));
    return;
  }

  // ---- Save a single tab for later (then close it) ----
  if (action === 'defer-single-tab') {
    e.stopPropagation();
    const tabUrl   = actionEl.dataset.tabUrl;
    const tabTitle = actionEl.dataset.tabTitle || tabUrl;
    if (!tabUrl) return;

    // Save to chrome.storage.local
    try {
      await saveTabForLater({ url: tabUrl, title: tabTitle });
    } catch (err) {
      console.error('[tab-out] Failed to save tab:', err);
      showToast(t('toast.saveFailed'));
      return;
    }

    // Close the tab in Chrome
    const allTabs = await chrome.tabs.query({});
    const match   = allTabs.find(t => t.url === tabUrl);
    if (match) await chrome.tabs.remove(match.id);
    await fetchOpenTabs();

    // Animate chip out
    const chip = actionEl.closest('.page-chip');
    if (chip) {
      chip.style.transition = 'opacity 0.2s, transform 0.2s';
      chip.style.opacity    = '0';
      chip.style.transform  = 'scale(0.8)';
      setTimeout(() => chip.remove(), 200);
    }

    showToast(t('toast.savedForLater'));
    await renderDeferredColumn();
    return;
  }

  // ---- Check off a saved tab (moves it to archive) ----
  if (action === 'check-deferred') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await checkOffSavedTab(id);

    // Animate: strikethrough first, then slide out
    const item = actionEl.closest('.deferred-item');
    if (item) {
      item.classList.add('checked');
      setTimeout(() => {
        item.classList.add('removing');
        setTimeout(() => {
          item.remove();
          renderDeferredColumn(); // refresh counts and archive
        }, 300);
      }, 800);
    }
    return;
  }

  // ---- Dismiss a saved tab (removes it entirely) ----
  if (action === 'dismiss-deferred') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await dismissSavedTab(id);

    const item = actionEl.closest('.deferred-item');
    if (item) {
      item.classList.add('removing');
      setTimeout(() => {
        item.remove();
        renderDeferredColumn();
      }, 300);
    }
    return;
  }

  // ---- Unarchive: move back to the active saved list ----
  if (action === 'unarchive-deferred') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await unarchiveSavedTab(id);

    const item = actionEl.closest('.archive-item');
    if (item) {
      item.classList.add('removing');
      setTimeout(async () => {
        item.remove();
        await renderDeferredColumn();
        showToast(t('toast.returnedToList'));
      }, 300);
    } else {
      await renderDeferredColumn();
      showToast(t('toast.returnedToList'));
    }
    return;
  }

  // ---- Delete a single archived item ----
  if (action === 'delete-archived') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await dismissSavedTab(id);

    const item = actionEl.closest('.archive-item');
    if (item) {
      item.classList.add('removing');
      setTimeout(() => {
        item.remove();
        renderDeferredColumn();
      }, 300);
    } else {
      await renderDeferredColumn();
    }
    return;
  }

  // ---- Clear all archived items ----
  if (action === 'clear-all-archive') {
    const cleared = await clearAllArchived();
    if (cleared > 0) {
      showToast(tp('toast.clearedArchive', cleared));
    }
    await renderDeferredColumn();
    return;
  }

  // ---- Close all tabs in a domain group ----
  if (action === 'close-domain-tabs') {
    if (actionEl.dataset.confirmPending !== 'true') {
      armCloseConfirmButton(actionEl);
      return;
    }

    resetCloseConfirmButtons();

    const domainId = actionEl.dataset.domainId;
    const group    = domainGroups.find(g => {
      return 'domain-' + g.domain.replace(/[^a-z0-9]/g, '-') === domainId;
    });
    if (!group) return;

    const urls      = group.tabs.map(t => t.url);
    // Landing pages and custom groups (whose domain key isn't a real hostname)
    // must use exact URL matching to avoid closing unrelated tabs
    const useExact  = group.domain === '__landing-pages__' || !!group.label;

    if (useExact) {
      await closeTabsExact(urls);
    } else {
      await closeTabsByIds(group.tabs);
    }

    if (card) {
      playCloseSound();
      animateCardOut(card);
    }

    // Remove from in-memory groups
    const idx = domainGroups.indexOf(group);
    if (idx !== -1) domainGroups.splice(idx, 1);

    const groupLabel = group.domain === '__landing-pages__' ? t('openTabs.homepages') : (group.label || friendlyDomain(group.domain));
    showToast(tp('toast.closedFromGroup', urls.length, { label: groupLabel }));

    updateFooterTabCount();
    return;
  }

  // ---- Close duplicates, keep one copy ----
  if (action === 'dedup-keep-one') {
    const urlsEncoded = actionEl.dataset.dupeUrls || '';
    const urls = urlsEncoded.split(',').map(u => decodeURIComponent(u)).filter(Boolean);
    if (urls.length === 0) return;

    await closeDuplicateTabs(urls, true);
    playCloseSound();

    // Hide the dedup button
    actionEl.style.transition = 'opacity 0.2s';
    actionEl.style.opacity    = '0';
    setTimeout(() => actionEl.remove(), 200);

    // Remove dupe badges from the card
    if (card) {
      card.querySelectorAll('.chip-dupe-badge').forEach(b => {
        b.style.transition = 'opacity 0.2s';
        b.style.opacity    = '0';
        setTimeout(() => b.remove(), 200);
      });
      card.querySelectorAll('.open-tabs-badge.dupe-count-badge').forEach(badge => {
        badge.style.transition = 'opacity 0.2s';
        badge.style.opacity    = '0';
        setTimeout(() => badge.remove(), 200);
      });
      card.classList.remove('has-amber-bar');
      card.classList.add('has-neutral-bar');
    }

    showToast(t('toast.closedDupesKept'));
    return;
  }

  // ---- Close ALL open tabs ----
  if (action === 'close-all-open-tabs') {
    if (actionEl.dataset.confirmPending !== 'true') {
      armCloseConfirmButton(actionEl);
      return;
    }

    resetCloseConfirmButtons();

    await closeAllRealTabs();
    playCloseSound();

    document.querySelectorAll('#openTabsMissions .mission-card').forEach(c => {
      shootConfetti(
        c.getBoundingClientRect().left + c.offsetWidth / 2,
        c.getBoundingClientRect().top  + c.offsetHeight / 2
      );
      animateCardOut(c);
    });

    showToast(t('toast.allClosed'));
    return;
  }
});

// ---- Archive toggle — expand/collapse the archive section ----
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('#archiveToggle');
  if (!toggle) return;

  toggle.classList.toggle('open');
  const body = document.getElementById('archiveBody');
  if (body) {
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
  }
});

// ---- Open tabs search — filter domain cards and chips as user types ----
document.addEventListener('input', (e) => {
  if (e.target.id !== 'openTabsSearch') return;
  applyOpenTabsSearchFilter(e.target.value);
});

// ---- Archive search — filter archived items as user types ----
document.addEventListener('input', async (e) => {
  if (e.target.id !== 'archiveSearch') return;

  const q = e.target.value.trim().toLowerCase();
  const archiveList = document.getElementById('archiveList');
  const archiveEmpty = document.getElementById('archiveEmpty');
  if (!archiveList) return;

  try {
    const { archived } = await getSavedTabs();

    if (archived.length === 0) {
      archiveList.innerHTML = '';
      archiveList.style.display = 'none';
      if (archiveEmpty) archiveEmpty.style.display = 'block';
      return;
    }

    const renderResults = (items) => {
      if (items.length === 0) {
        archiveList.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:8px 0">${t('archive.noResults')}</div>`;
      } else {
        archiveList.innerHTML = items.map(item => renderArchiveItem(item)).join('');
      }
      archiveList.style.display = 'block';
      if (archiveEmpty) archiveEmpty.style.display = 'none';
    };

    if (q.length < 2) {
      renderResults(archived);
      return;
    }

    const results = archived.filter(item =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.url  || '').toLowerCase().includes(q)
    );

    renderResults(results);
  } catch (err) {
    console.warn('[tab-out] Archive search failed:', err);
  }
});

// ---- Archive auto-clear setting ----
document.addEventListener('change', async (e) => {
  if (e.target.id !== 'archiveExpireDays') return;

  const days = await setArchiveExpireDays(e.target.value);
  e.target.value = days;

  const purged = await purgeExpiredArchived();
  await renderDeferredColumn();

  if (purged > 0) {
    showToast(tp('toast.clearedExpired', purged));
  }
});
