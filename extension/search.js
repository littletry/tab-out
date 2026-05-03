'use strict';

/* ----------------------------------------------------------------
   SEARCH BAR — engine switching + autocomplete suggestions
   ---------------------------------------------------------------- */

const SEARCH_ENGINES = {
  google: {
    name: 'Google',
    action: 'https://www.google.com/search',
    param: 'q',
    icon: 'https://www.google.com/favicon.ico',
    placeholder: 'Search Google or type a URL',
    suggestUrl: (q) => `https://www.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}`,
    parseSuggest: (data) => data[1] || [],
  },
  bing: {
    name: 'Bing',
    action: 'https://www.bing.com/search',
    param: 'q',
    icon: 'https://www.bing.com/favicon.ico',
    placeholder: 'Search Bing or type a URL',
    suggestUrl: (q) => `https://www.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`,
    parseSuggest: (data) => data[1] || [],
  },
  baidu: {
    name: 'Baidu',
    action: 'https://www.baidu.com/s',
    param: 'wd',
    icon: 'https://www.baidu.com/favicon.ico',
    placeholder: 'Search Baidu or type a URL',
    suggestUrl: (q) => `https://suggestion.baidu.com/su?wd=${encodeURIComponent(q)}&action=opensearch`,
    parseSuggest: (data) => data[1] || [],
  },
};
const SEARCH_ENGINE_KEY = 'searchEngine';
let currentEngineId = 'google';
let suggestSeq = 0;
let activeSuggestionIndex = -1;

function applySearchEngine(engineId) {
  currentEngineId = engineId;
  const engine = SEARCH_ENGINES[engineId] || SEARCH_ENGINES.google;
  const form = document.getElementById('searchBar');
  const logo = document.getElementById('searchEngineLogo');
  const input = document.getElementById('searchInput');
  if (form) {
    form.action = engine.action;
    input.name = engine.param;
  }
  if (logo) {
    logo.src = engine.icon;
    logo.alt = engine.name;
  }
  if (input) input.placeholder = engine.placeholder;
  hideSuggestions();
}

async function loadSearchEngine() {
  try {
    const result = await chrome.storage.local.get(SEARCH_ENGINE_KEY);
    const engineId = result[SEARCH_ENGINE_KEY] || 'google';
    applySearchEngine(engineId);
    return engineId;
  } catch {
    applySearchEngine('google');
    return 'google';
  }
}

async function setSearchEngine(engineId) {
  applySearchEngine(engineId);
  try {
    await chrome.storage.local.set({ [SEARCH_ENGINE_KEY]: engineId });
  } catch { /* silent */ }
}

function hideSuggestions() {
  const box = document.getElementById('searchSuggestions');
  if (box) box.remove();
  activeSuggestionIndex = -1;
}

function showSuggestions(items) {
  hideSuggestions();
  if (!items || items.length === 0) return;

  const searchIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>`;
  const html = items.slice(0, 8).map((text, i) =>
    `<div class="search-suggestion-item" data-suggestion-index="${i}" data-suggestion-text="${text.replace(/"/g, '&quot;')}">${searchIcon}<span class="search-suggestion-text">${text}</span></div>`
  ).join('');

  const box = document.createElement('div');
  box.className = 'search-suggestions';
  box.id = 'searchSuggestions';
  box.innerHTML = html;

  const form = document.getElementById('searchBar');
  if (form) form.appendChild(box);
}

async function fetchSuggestions(query) {
  const seq = ++suggestSeq;
  if (!query || query.length < 2) { hideSuggestions(); return; }

  const engine = SEARCH_ENGINES[currentEngineId] || SEARCH_ENGINES.google;
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'fetchSuggest',
      url: engine.suggestUrl(query),
    });
    if (seq !== suggestSeq) return;
    if (resp && resp.ok) {
      showSuggestions(engine.parseSuggest(resp.data));
    }
  } catch {
    /* background unavailable */
  }
}

let suggestTimer = null;
document.addEventListener('input', (e) => {
  if (e.target.id !== 'searchInput') return;
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(() => fetchSuggestions(e.target.value.trim()), 200);
});

document.addEventListener('keydown', (e) => {
  const box = document.getElementById('searchSuggestions');
  if (!box || e.target.id !== 'searchInput') return;

  const items = box.querySelectorAll('.search-suggestion-item');
  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === activeSuggestionIndex));
    document.getElementById('searchInput').value = items[activeSuggestionIndex].dataset.suggestionText;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
    items.forEach((el, i) => el.classList.toggle('active', i === activeSuggestionIndex));
    document.getElementById('searchInput').value = items[activeSuggestionIndex].dataset.suggestionText;
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
});

document.addEventListener('click', (e) => {
  const suggestion = e.target.closest('.search-suggestion-item');
  if (suggestion) {
    const text = suggestion.dataset.suggestionText;
    hideSuggestions();
    const engine = SEARCH_ENGINES[currentEngineId] || SEARCH_ENGINES.google;
    const searchUrl = engine.action + '?' + engine.param + '=' + encodeURIComponent(text);
    window.open(searchUrl, '_blank');
    return;
  }

  if (!e.target.closest('.search-bar')) {
    hideSuggestions();
  }
});

document.addEventListener('click', (e) => {
  const menu = document.getElementById('searchEngineMenu');

  if (e.target.closest('#searchEngineBtn')) {
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    return;
  }

  const option = e.target.closest('.search-engine-option');
  if (option) {
    const engineId = option.dataset.engine;
    if (engineId) setSearchEngine(engineId);
    if (menu) menu.style.display = 'none';
    return;
  }

  if (menu && menu.style.display !== 'none' && !e.target.closest('.search-engine-menu')) {
    menu.style.display = 'none';
  }
});
