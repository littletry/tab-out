'use strict';

/* ----------------------------------------------------------------
   THEME MANAGER — Light / Dark / System

   Stores the user's preference in chrome.storage.local under the
   key "themePref". Valid values: "light", "dark", "system".
   "system" defers to the OS-level prefers-color-scheme media query.

   The <head> inline script handles the initial paint to avoid
   a white flash in dark mode. This module takes over after that
   for live switching and persistence.
   ---------------------------------------------------------------- */

const THEME_STORAGE_KEY = 'themePref';
const DARK_MQ = window.matchMedia('(prefers-color-scheme: dark)');
let currentThemePref = 'system';

function resolveTheme(pref) {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  return DARK_MQ.matches ? 'dark' : 'light';
}

function applyTheme(pref) {
  currentThemePref = pref;
  document.documentElement.setAttribute('data-theme', resolveTheme(pref));
  updateThemeSwitcherUI(pref);
}

function updateThemeSwitcherUI(pref) {
  const btns = document.querySelectorAll('.theme-btn');
  btns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themePref === pref);
  });
}

async function loadTheme() {
  try {
    const result = await chrome.storage.local.get(THEME_STORAGE_KEY);
    const pref = result[THEME_STORAGE_KEY] || 'system';
    applyTheme(pref);
  } catch {
    applyTheme('system');
  }
  document.body.classList.remove('theme-loading');
  document.body.classList.add('theme-ready');
}

async function setTheme(pref) {
  applyTheme(pref);
  try {
    await chrome.storage.local.set({ [THEME_STORAGE_KEY]: pref });
  } catch {
    /* storage write failed — theme is still applied visually */
  }
}

DARK_MQ.addEventListener('change', () => {
  if (currentThemePref === 'system') {
    document.documentElement.setAttribute('data-theme', resolveTheme('system'));
  }
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.theme-btn');
  if (!btn) return;
  const pref = btn.dataset.themePref;
  if (pref) setTheme(pref);
});
