'use strict';

/* ----------------------------------------------------------------
   INTERNATIONALIZATION — English & Chinese
   ---------------------------------------------------------------- */

const LANG_STORAGE_KEY = 'uiLanguage';
const SUPPORTED_LANGS = ['en', 'zh'];
let currentLang = 'en';

const MESSAGES = {
  en: {
    'theme.light':           'Light mode',
    'theme.system':          'Follow system',
    'theme.dark':            'Dark mode',
    'search.switchEngine':   'Switch search engine',
    'search.submit':         'Search',
    'search.placeholder.google': 'Search Google or type a URL',
    'search.placeholder.bing':   'Search Bing or type a URL',
    'search.placeholder.baidu':  'Search Baidu or type a URL',
    'shortcut.add':          'Add shortcut',
    'shortcut.edit':         'Edit shortcut',
    'shortcut.editTitle':    'Edit shortcut',
    'shortcut.addTitle':     'Add shortcut',
    'shortcut.editBtn':      'Edit shortcut',
    'shortcut.name':         'Name',
    'shortcut.url':          'URL',
    'shortcut.namePlaceholder':  'e.g. Google',
    'shortcut.urlPlaceholder':   'e.g. https://google.com',
    'shortcut.remove':       'Remove',
    'shortcut.cancel':       'Cancel',
    'shortcut.done':         'Done',
    'dupeBanner.message':    'You have {count} Tab Out tabs open. Keep just this one?',
    'dupeBanner.close':      'Close extras',
    'deferred.title':        'Saved for later',
    'deferred.empty':        'Nothing saved. Living in the moment.',
    'deferred.dismiss':      'Dismiss',
    'deferred.itemCount.one':  '{count} item',
    'deferred.itemCount.other': '{count} items',
    'archive.title':         'Archive',
    'archive.autoClear':     'Auto-clear after',
    'archive.days':          'days',
    'archive.neverExpire':   '0 = never auto-clear',
    'archive.clearAll':      'Clear all',
    'archive.search':        'Search archived tabs...',
    'archive.empty':         'No archived items.',
    'archive.return':        'Return to saved list',
    'archive.delete':        'Delete',
    'archive.noResults':     'No results',
    'openTabs.title':        'Open tabs',
    'openTabs.homepages':    'Homepages',
    'openTabs.tabsLabel':    'tabs',
    'openTabs.domainCount.one':  '{count} domain',
    'openTabs.domainCount.other': '{count} domains',
    'openTabs.closeAll':     'Close all {count} tabs',
    'openTabs.closeAllShort': 'Close all ({count})',
    'openTabs.tabsOpen.one':   '{count} tab',
    'openTabs.tabsOpen.other': '{count} tabs',
    'openTabs.duplicates.one': '{count} duplicate',
    'openTabs.duplicates.other': '{count} duplicates',
    'openTabs.closeDomain.one':  'Close all {count} tab',
    'openTabs.closeDomain.other': 'Close all {count} tabs',
    'openTabs.closeDomainShort': 'Close all ({count})',
    'openTabs.confirmClose': 'Confirm close ({count})',
    'openTabs.closeDupes.one':   'Close {count} duplicate',
    'openTabs.closeDupes.other': 'Close {count} duplicates',
    'openTabs.more':         '+{count} more',
    'openTabs.search':       'Search open tabs...',
    'openTabs.noResults':    'No matching tabs',
    'openTabs.pin':          'Pin group',
    'openTabs.unpin':        'Unpin group',
    'openTabs.fold':         'Collapse group',
    'openTabs.expand':       'Expand group',
    'openTabs.collapseAll':  'Collapse all',
    'openTabs.expandAll':    'Expand all',
    'chip.saveForLater':     'Save for later',
    'chip.closeTab':         'Close this tab',
    'empty.title':           'Inbox zero, but for tabs.',
    'empty.subtitle':        "You're free.",
    'empty.domainCount':     '0 domains',
    'recent.title':          'Recently Closed',
    'recent.empty':          'No recently closed tabs',
    'recent.unable':         'Unable to load',
    'recent.restore':        'Restore',
    'recent.clearAll':       'Clear recently closed',
    'recent.clearLabel':     'Clear',
    'recent.confirmClear':   'Confirm',
    'snapshots.title':       'Tab snapshots',
    'snapshots.save':        'Save snapshot',
    'snapshots.empty':       'No snapshots saved',
    'snapshots.restore':     'Restore',
    'snapshots.delete':      'Delete',
    'snapshots.meta':        '{date} · {count} tabs',
    'snapshots.autoTitle':   'Auto snapshot',
    'snapshots.manualTitle': 'Saved snapshots',
    'snapshots.autoBadge':   'Auto',
    'snapshots.autoEmpty':   'No auto snapshot yet',
    'snapshots.manualEmpty': 'No saved snapshots',
    'snapshots.autoInterval':'Save every',
    'snapshots.minutes':     'min',
    'snapshots.autoDisabled':'0 = off',
    'stats.title':           'Tab Stats',
    'stats.tabs':            'Tabs',
    'stats.domains':         'Domains',
    'stats.dupes':           'Dupes',
    'stats.total':           'Total',
    'focus.title':           'Focus Timer',
    'focus.focusing':        'Focusing...',
    'focus.paused':          'Paused',
    'focus.session':         '25 min session',
    'focus.start':           'Start',
    'focus.pause':           'Pause',
    'focus.reset':           'Reset',
    'notes.title':           'Quick Notes',
    'notes.placeholder':     'Jot something down...',
    'notes.saved':           'Saved',
    'footer.openTabs':       'Open tabs',
    'greeting.morning':      'Good morning',
    'greeting.afternoon':    'Good afternoon',
    'greeting.evening':      'Good evening',
    'time.justNow':          'just now',
    'time.minAgo':           '{count} min ago',
    'time.hrsAgo.one':       '{count} hr ago',
    'time.hrsAgo.other':     '{count} hrs ago',
    'time.yesterday':        'yesterday',
    'time.daysAgo':          '{count} days ago',
    'toast.closedDupes':     'Closed extra Tab Out tabs',
    'toast.tabClosed':       'Tab closed',
    'toast.saveFailed':      'Failed to save tab',
    'toast.savedForLater':   'Saved for later',
    'toast.returnedToList':  'Returned to saved list',
    'toast.clearedArchive.one':  'Cleared {count} archived item',
    'toast.clearedArchive.other': 'Cleared {count} archived items',
    'toast.closedFromGroup.one':  'Closed {count} tab from {label}',
    'toast.closedFromGroup.other': 'Closed {count} tabs from {label}',
    'toast.closedDupesKept': 'Closed duplicates, kept one copy each',
    'toast.allClosed':       'All tabs closed. Fresh start.',
    'toast.clearedExpired.one':  'Cleared {count} expired item',
    'toast.clearedExpired.other': 'Cleared {count} expired items',
    'toast.focusComplete':   'Focus session complete!',
    'toast.recentCleared':   'Recently closed list cleared',
    'toast.snapshotSaved':   'Snapshot saved ({count} tabs)',
    'toast.snapshotRestored': 'Restored {count} tabs',
    'toast.snapshotDeleted': 'Snapshot deleted',
    'toast.snapshotEmpty':   'No tabs to save',
    'lang.en':               'English',
    'lang.zh':               '中文',
  },
  zh: {
    'theme.light':           '浅色模式',
    'theme.system':          '跟随系统',
    'theme.dark':            '深色模式',
    'search.switchEngine':   '切换搜索引擎',
    'search.submit':         '搜索',
    'search.placeholder.google': '搜索 Google 或输入网址',
    'search.placeholder.bing':   '搜索 Bing 或输入网址',
    'search.placeholder.baidu':  '搜索百度或输入网址',
    'shortcut.add':          '添加快捷方式',
    'shortcut.edit':         '编辑快捷方式',
    'shortcut.editTitle':    '编辑快捷方式',
    'shortcut.addTitle':     '添加快捷方式',
    'shortcut.editBtn':      '编辑快捷方式',
    'shortcut.name':         '名称',
    'shortcut.url':          '网址',
    'shortcut.namePlaceholder':  '例如 Google',
    'shortcut.urlPlaceholder':   '例如 https://google.com',
    'shortcut.remove':       '删除',
    'shortcut.cancel':       '取消',
    'shortcut.done':         '完成',
    'dupeBanner.message':    '您打开了 {count} 个 Tab Out 标签页，只保留当前这个？',
    'dupeBanner.close':      '关闭多余的',
    'deferred.title':        '稍后阅读',
    'deferred.empty':        '暂无保存。享受当下。',
    'deferred.dismiss':      '移除',
    'deferred.itemCount.one':  '{count} 项',
    'deferred.itemCount.other': '{count} 项',
    'archive.title':         '归档',
    'archive.autoClear':     '自动清除于',
    'archive.days':          '天',
    'archive.neverExpire':   '0 = 永不自动清除',
    'archive.clearAll':      '全部清除',
    'archive.search':        '搜索归档标签...',
    'archive.empty':         '暂无归档项。',
    'archive.return':        '恢复到待办',
    'archive.delete':        '删除',
    'archive.noResults':     '无结果',
    'openTabs.title':        '打开的标签页',
    'openTabs.homepages':    '主页',
    'openTabs.tabsLabel':    '标签',
    'openTabs.domainCount.one':  '{count} 个域名',
    'openTabs.domainCount.other': '{count} 个域名',
    'openTabs.closeAll':     '关闭全部 {count} 个标签',
    'openTabs.closeAllShort': '全部关闭({count})',
    'openTabs.tabsOpen.one':   '{count} 个标签页',
    'openTabs.tabsOpen.other': '{count} 个标签页',
    'openTabs.duplicates.one': '{count} 个重复',
    'openTabs.duplicates.other': '{count} 个重复',
    'openTabs.closeDomain.one':  '关闭全部 {count} 个标签',
    'openTabs.closeDomain.other': '关闭全部 {count} 个标签',
    'openTabs.closeDomainShort': '关闭全部({count})',
    'openTabs.confirmClose': '确认关闭({count})',
    'openTabs.closeDupes.one':   '关闭 {count} 个重复项',
    'openTabs.closeDupes.other': '关闭 {count} 个重复项',
    'openTabs.more':         '还有 {count} 个',
    'openTabs.search':       '搜索打开的标签...',
    'openTabs.noResults':    '没有匹配的标签',
    'openTabs.pin':          '置顶',
    'openTabs.unpin':        '取消置顶',
    'openTabs.fold':         '折叠',
    'openTabs.expand':       '展开',
    'openTabs.collapseAll':  '全部折叠',
    'openTabs.expandAll':    '全部展开',
    'chip.saveForLater':     '稍后阅读',
    'chip.closeTab':         '关闭此标签',
    'empty.title':           '标签页也「清零」了。',
    'empty.subtitle':        '一身轻松。',
    'empty.domainCount':     '0 个域名',
    'recent.title':          '最近关闭',
    'recent.empty':          '暂无最近关闭的标签',
    'recent.unable':         '无法加载',
    'recent.restore':        '恢复',
    'recent.clearAll':       '清空最近关闭',
    'recent.clearLabel':     '清空',
    'recent.confirmClear':   '确认',
    'snapshots.title':       '标签快照',
    'snapshots.save':        '保存快照',
    'snapshots.empty':       '暂无快照',
    'snapshots.restore':     '恢复',
    'snapshots.delete':      '删除',
    'snapshots.meta':        '{date} · {count} 个标签',
    'snapshots.autoTitle':   '自动快照',
    'snapshots.manualTitle': '手动快照',
    'snapshots.autoBadge':   '自动',
    'snapshots.autoEmpty':   '暂无自动快照',
    'snapshots.manualEmpty': '暂无手动快照',
    'snapshots.autoInterval':'每',
    'snapshots.minutes':     '分钟保存',
    'snapshots.autoDisabled':'0 = 关闭',
    'stats.title':           '标签统计',
    'stats.tabs':            '标签',
    'stats.domains':         '域名',
    'stats.dupes':           '重复',
    'stats.total':           '总计',
    'focus.title':           '专注计时',
    'focus.focusing':        '专注中...',
    'focus.paused':          '已暂停',
    'focus.session':         '25 分钟专注',
    'focus.start':           '开始',
    'focus.pause':           '暂停',
    'focus.reset':           '重置',
    'notes.title':           '快速笔记',
    'notes.placeholder':     '随手记点什么...',
    'notes.saved':           '已保存',
    'footer.openTabs':       '打开的标签页',
    'greeting.morning':      '早上好',
    'greeting.afternoon':    '下午好',
    'greeting.evening':      '晚上好',
    'time.justNow':          '刚刚',
    'time.minAgo':           '{count} 分钟前',
    'time.hrsAgo.one':       '{count} 小时前',
    'time.hrsAgo.other':     '{count} 小时前',
    'time.yesterday':        '昨天',
    'time.daysAgo':          '{count} 天前',
    'toast.closedDupes':     '已关闭多余的 Tab Out 标签',
    'toast.tabClosed':       '标签已关闭',
    'toast.saveFailed':      '保存失败',
    'toast.savedForLater':   '已保存到稍后阅读',
    'toast.returnedToList':  '已恢复到待办列表',
    'toast.clearedArchive.one':  '已清除 {count} 条归档',
    'toast.clearedArchive.other': '已清除 {count} 条归档',
    'toast.closedFromGroup.one':  '已关闭 {label} 的 {count} 个标签',
    'toast.closedFromGroup.other': '已关闭 {label} 的 {count} 个标签',
    'toast.closedDupesKept': '已关闭重复项，各保留一个',
    'toast.allClosed':       '已全部关闭，重新开始',
    'toast.clearedExpired.one':  '已清除 {count} 条过期归档',
    'toast.clearedExpired.other': '已清除 {count} 条过期归档',
    'toast.focusComplete':   '专注时间到！',
    'toast.recentCleared':   '已清空最近关闭',
    'toast.snapshotSaved':   '已保存快照（{count} 个标签）',
    'toast.snapshotRestored': '已恢复 {count} 个标签',
    'toast.snapshotDeleted': '已删除快照',
    'toast.snapshotEmpty':   '没有可保存的标签',
    'lang.en':               'English',
    'lang.zh':               '中文',
  },
};

function interpolate(str, params = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? params[key] : `{${key}}`
  );
}

/**
 * t(key, params)
 * Look up a translation string and interpolate placeholders.
 */
function t(key, params = {}) {
  const msg = MESSAGES[currentLang]?.[key] ?? MESSAGES.en[key];
  if (msg === undefined) return key;
  return interpolate(msg, params);
}

/**
 * tp(key, count, params)
 * Pick singular/plural form (.one / .other) then interpolate.
 */
function tp(key, count, params = {}) {
  const merged = { count, n: count, ...params };
  const one   = MESSAGES[currentLang]?.[`${key}.one`]   ?? MESSAGES.en[`${key}.one`];
  const other = MESSAGES[currentLang]?.[`${key}.other`] ?? MESSAGES.en[`${key}.other`];
  const form  = count === 1 ? one : other;
  if (!form) return t(key, merged);
  return interpolate(form, merged);
}

function getDefaultLanguage() {
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

function getCurrentLang() {
  return currentLang;
}

async function loadLanguage() {
  try {
    const result = await chrome.storage.local.get(LANG_STORAGE_KEY);
    const stored = result[LANG_STORAGE_KEY];
    currentLang = stored && SUPPORTED_LANGS.includes(stored) ? stored : getDefaultLanguage();
  } catch {
    currentLang = getDefaultLanguage();
  }
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
}

function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  updateLangSwitcher();
}

function updateLangSwitcher() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
    const label = btn.dataset.lang === 'zh' ? 'lang.zh' : 'lang.en';
    btn.title = t(label);
  });
}

async function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  try {
    await chrome.storage.local.set({ [LANG_STORAGE_KEY]: lang });
  } catch { /* storage write failed */ }
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  applyStaticI18n();
  await refreshUiForLanguage();
}

async function refreshUiForLanguage() {
  if (typeof applySearchEngine === 'function' && typeof currentEngineId !== 'undefined') {
    applySearchEngine(currentEngineId);
  }
  if (typeof renderDashboard === 'function') await renderDashboard();
  if (typeof getShortcuts === 'function' && typeof renderShortcuts === 'function') {
    renderShortcuts(await getShortcuts());
  }
  const modal = document.getElementById('shortcutModal');
  if (modal && modal.style.display !== 'none' && typeof openShortcutModal === 'function') {
    const shortcuts = await getShortcuts();
    openShortcutModal(editingShortcutIndex, shortcuts);
  }
}

async function initI18n() {
  await loadLanguage();
  applyStaticI18n();

  const switcher = document.getElementById('langSwitcher');
  if (switcher && !switcher._bound) {
    switcher._bound = true;
    switcher.addEventListener('click', async (e) => {
      const btn = e.target.closest('.lang-btn');
      if (!btn?.dataset.lang) return;
      await setLanguage(btn.dataset.lang);
    });
  }
}
