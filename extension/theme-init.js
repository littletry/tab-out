/* Anti-flash: resolve theme before first paint so dark-mode users
   never see a white flash. Runs synchronously in <head> before body renders. */
(function() {
  var STORAGE_KEY = 'themePref';
  var darkMq = window.matchMedia('(prefers-color-scheme: dark)');
  function resolve(pref) {
    if (pref === 'dark') return 'dark';
    if (pref === 'light') return 'light';
    return darkMq.matches ? 'dark' : 'light';
  }
  try {
    chrome.storage.local.get(STORAGE_KEY, function(result) {
      var pref = result[STORAGE_KEY] || 'system';
      document.documentElement.setAttribute('data-theme', resolve(pref));
      if (document.body) {
        document.body.classList.remove('theme-loading');
        document.body.classList.add('theme-ready');
      }
    });
  } catch(e) {
    document.documentElement.setAttribute('data-theme', resolve('system'));
    if (document.body) {
      document.body.classList.remove('theme-loading');
      document.body.classList.add('theme-ready');
    }
  }
})();
