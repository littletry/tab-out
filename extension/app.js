'use strict';

/* ================================================================
   Tab Out — Bootstrap

   This file is the entry point. All feature code lives in dedicated
   modules loaded before this file:
     theme.js     — dark/light/system theme
     i18n.js      — English / Chinese UI strings
     helpers.js   — UI utilities, domain/title cleanup, icons
     tabs.js      — Chrome tabs API wrappers
     deferred.js  — "Saved for later" storage layer
     shortcuts.js — editable shortcuts grid
     dashboard.js — main renderer + event delegation
     snapshots-storage.js — tab snapshot persistence (manual + auto)
     snapshots.js — tab snapshot UI + events
     search.js    — search bar, engine switching, autocomplete
   ================================================================ */


/* ----------------------------------------------------------------
   GLOBAL IMG ERROR HANDLER
   MV3 CSP forbids inline onerror attributes. This single listener
   hides any <img> whose src fails to load (e.g. broken favicons).
   ---------------------------------------------------------------- */
document.addEventListener('error', (e) => {
  if (e.target.tagName === 'IMG') e.target.style.display = 'none';
}, true);


/* ----------------------------------------------------------------
   OPTIONAL CONFIG — config.local.js (gitignored)
   Loaded dynamically so a missing file stays silent.
   ---------------------------------------------------------------- */
try {
  const s = document.createElement('script');
  s.src = 'config.local.js';
  document.head.appendChild(s);
} catch { /* no personal config, that's fine */ }


/* ----------------------------------------------------------------
   INITIALIZE
   ---------------------------------------------------------------- */
loadTheme().then(async () => {
  await initI18n();
  await Promise.all([renderDashboard(), initShortcuts(), loadSearchEngine()]);
  initTabSync();
});
