'use strict';

/* ----------------------------------------------------------------
   SHORTCUTS — Editable shortcuts grid

   Mirrors Chrome's default new-tab "shortcuts" row. Entirely
   user-driven: stored in chrome.storage.local under "shortcuts".
   Starts empty; user adds sites via the "Add shortcut" button.
   ---------------------------------------------------------------- */

const SHORTCUTS_STORAGE_KEY = 'shortcuts';
const SHORTCUTS_MAX = 10;
let editingShortcutIndex = -1;

async function getShortcuts() {
  try {
    const result = await chrome.storage.local.get(SHORTCUTS_STORAGE_KEY);
    return result[SHORTCUTS_STORAGE_KEY] || [];
  } catch {
    return [];
  }
}

async function saveShortcuts(shortcuts) {
  try {
    await chrome.storage.local.set({ [SHORTCUTS_STORAGE_KEY]: shortcuts });
  } catch { /* storage write failed */ }
}

function renderShortcuts(shortcuts) {
  const grid = document.getElementById('shortcutsGrid');
  if (!grid) return;

  const items = shortcuts.map((s, i) => {
    let domain = '';
    try { domain = new URL(s.url).hostname; } catch {}
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : '';
    const safeUrl = (s.url || '').replace(/"/g, '&quot;');
    const safeTitle = (s.title || domain || '').replace(/"/g, '&quot;');
    const displayTitle = s.title || domain || s.url || '';

    return `<a class="shortcut-item" href="${safeUrl}" title="${safeTitle}" data-shortcut-index="${i}">
      <button class="shortcut-edit-btn" data-action="edit-shortcut" data-shortcut-index="${i}" title="${t('shortcut.editBtn')}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" /></svg>
      </button>
      <div class="shortcut-icon">
        ${faviconUrl ? `<img src="${faviconUrl}" alt="">` : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>`}
      </div>
      <span class="shortcut-label">${displayTitle}</span>
    </a>`;
  }).join('');

  const addBtn = shortcuts.length < SHORTCUTS_MAX
    ? `<div class="shortcut-item shortcut-add" data-action="add-shortcut">
        <div class="shortcut-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        </div>
        <span class="shortcut-label">${t('shortcut.add')}</span>
      </div>`
    : '';

  grid.innerHTML = items + addBtn;
}

function openShortcutModal(index, shortcuts) {
  editingShortcutIndex = index;
  const modal = document.getElementById('shortcutModal');
  const titleEl = document.getElementById('shortcutModalTitle');
  const nameInput = document.getElementById('shortcutNameInput');
  const urlInput = document.getElementById('shortcutUrlInput');
  const deleteBtn = document.getElementById('shortcutDeleteBtn');

  if (index >= 0 && index < shortcuts.length) {
    titleEl.textContent = t('shortcut.editTitle');
    nameInput.value = shortcuts[index].title || '';
    urlInput.value = shortcuts[index].url || '';
    deleteBtn.style.display = 'inline-flex';
  } else {
    titleEl.textContent = t('shortcut.addTitle');
    nameInput.value = '';
    urlInput.value = '';
    deleteBtn.style.display = 'none';
  }

  modal.style.display = 'flex';
  nameInput.focus();
}

function closeShortcutModal() {
  const modal = document.getElementById('shortcutModal');
  modal.style.display = 'none';
  editingShortcutIndex = -1;
}

async function handleSaveShortcut() {
  const nameInput = document.getElementById('shortcutNameInput');
  const urlInput = document.getElementById('shortcutUrlInput');
  let url = urlInput.value.trim();
  const title = nameInput.value.trim();

  if (!url) return;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  const shortcuts = await getShortcuts();

  if (editingShortcutIndex >= 0 && editingShortcutIndex < shortcuts.length) {
    shortcuts[editingShortcutIndex] = { title, url };
  } else {
    shortcuts.push({ title, url });
  }

  await saveShortcuts(shortcuts);
  renderShortcuts(shortcuts);
  closeShortcutModal();
}

async function handleDeleteShortcut() {
  if (editingShortcutIndex < 0) return;
  const shortcuts = await getShortcuts();
  shortcuts.splice(editingShortcutIndex, 1);
  await saveShortcuts(shortcuts);
  renderShortcuts(shortcuts);
  closeShortcutModal();
}

async function initShortcuts() {
  const shortcuts = await getShortcuts();
  renderShortcuts(shortcuts);
}

/* ---- Shortcuts event handlers ---- */

document.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-action="edit-shortcut"]');
  if (editBtn) {
    e.preventDefault();
    e.stopPropagation();
    const idx = parseInt(editBtn.dataset.shortcutIndex, 10);
    const shortcuts = await getShortcuts();
    openShortcutModal(idx, shortcuts);
    return;
  }

  if (e.target.closest('[data-action="add-shortcut"]')) {
    const shortcuts = await getShortcuts();
    openShortcutModal(-1, shortcuts);
    return;
  }

  if (e.target.closest('[data-action="save-shortcut"]')) {
    await handleSaveShortcut();
    return;
  }

  if (e.target.closest('[data-action="delete-shortcut"]')) {
    await handleDeleteShortcut();
    return;
  }

  if (e.target.closest('[data-action="close-shortcut-modal"]')) {
    closeShortcutModal();
    return;
  }

  if (e.target.closest('.shortcut-modal-overlay') && !e.target.closest('.shortcut-modal')) {
    closeShortcutModal();
    return;
  }
});

document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('shortcutModal');
  if (!modal || modal.style.display === 'none') return;
  if (e.key === 'Escape') closeShortcutModal();
  if (e.key === 'Enter') handleSaveShortcut();
});
