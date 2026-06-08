// Personal Dashboard — Frontend controller
// ESM; imported by index.html

import { render as renderToday } from './views/today.js';
import { render as renderTodos, openNewTodoModal } from './views/todos.js';
import { render as renderHabits } from './views/habits.js';
import { render as renderRemembers } from './views/remembers.js';
import { render as renderNotes } from './views/notes.js';
import { render as renderSettings } from './views/settings.js';

// ============================================================
// Shared utilities (exported so views can import them)
// ============================================================

export async function api(path, method = 'GET', body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function toast(msg, type = 'info') {
  const tc = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = 'toast';
  div.style.background = type === 'error' ? 'var(--danger)' : 'var(--text)';
  div.textContent = msg;
  tc.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

export function formatDate(ymd) {
  if (!ymd) return '';
  const s = String(ymd).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const today = new Date().toISOString().slice(0, 10);
  if (s === today) return 'Today';
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (s === tomorrow) return 'Tomorrow';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function formatTime(isoOrTime) {
  if (!isoOrTime) return '';
  try {
    const d = new Date(isoOrTime);
    if (isNaN(d.getTime())) return String(isoOrTime);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return String(isoOrTime);
  }
}

// Initialise drag-to-reorder on a list container. Each direct child must carry
// a data-id; reordering posts the new id order to `endpoint`. Uses a .drag-handle
// so dragging never conflicts with tap-to-edit or checkboxes.
export function makeSortable(listEl, endpoint) {
  if (!listEl || typeof Sortable === 'undefined') return;
  Sortable.create(listEl, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: async () => {
      const ids = Array.from(listEl.children)
        .map((el) => Number(el.dataset.id))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (ids.length === 0) return;
      try {
        await api(endpoint, 'POST', { ids });
      } catch (e) {
        toast(e.message, 'error');
      }
    },
  });
}

export function showModal(html) {
  document.getElementById('modal-container').innerHTML = html;
}

export function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

// Optimistic checkbox toggle: flips UI immediately, calls API in background,
// reverts on failure. Avoids a full re-render on every check.
export function wireCheckbox(btn, { rowEl = null, request, onChange } = {}) {
  btn.addEventListener('click', async () => {
    const next = !btn.classList.contains('checked');
    btn.classList.toggle('checked', next);
    if (rowEl) rowEl.classList.toggle('done', next);
    onChange?.(next);
    try {
      await request(next ? 1 : 0);
    } catch (e) {
      btn.classList.toggle('checked', !next);
      if (rowEl) rowEl.classList.toggle('done', !next);
      onChange?.(!next);
      toast(e.message, 'error');
    }
  });
}

// ============================================================
// App state
// ============================================================

let currentTab = 'today';
const content = document.getElementById('content-area');

const TABS = {
  today: renderToday,
  todos: renderTodos,
  habits: renderHabits,
  remembers: renderRemembers,
  notes: renderNotes,
  settings: renderSettings,
};

// ============================================================
// Routing / tab switching
// ============================================================

function switchTab(name) {
  currentTab = name;
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  TABS[name](content);
}

// ============================================================
// Dark mode
// ============================================================

function applyDarkMode(enabled) {
  document.documentElement.classList.toggle('dark', enabled);
  document.documentElement.classList.toggle('light', !enabled);
}

// ============================================================
// Boot
// ============================================================

async function boot() {
  const loginScreen = document.getElementById('login-screen');
  const appEl = document.getElementById('app');

  // Check auth
  let authed = false;
  try {
    const me = await api('/api/auth/me');
    authed = me.authed;
  } catch {
    authed = false;
  }

  if (!authed) {
    loginScreen.style.display = '';
    appEl.style.display = 'none';
    setupLogin(loginScreen, appEl);
    return;
  }

  await startApp(appEl, loginScreen);
}

async function startApp(appEl, loginScreen) {
  loginScreen.style.display = 'none';
  appEl.style.display = '';

  // Theme: localStorage is the source of truth (default dark). The inline head
  // script already applied it pre-paint; re-assert here for SPA navigations.
  const storedTheme = localStorage.getItem('pd-theme');
  applyDarkMode(storedTheme ? storedTheme === 'dark' : true);

  // Tab bar
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Quick-add
  const quickInput = document.getElementById('quick-add-input');
  const quickBtn = document.getElementById('quick-add-btn');
  const quickWrap = quickInput.closest('.quick-add-wrap');

  // Collapsible category selector: expand on focus, collapse on blur if empty
  quickInput.addEventListener('focus', () => {
    quickWrap.classList.add('expanded');
  });
  quickInput.addEventListener('blur', () => {
    if (!quickInput.value.trim()) {
      quickWrap.classList.remove('expanded');
    }
  });

  // Category selector — explicit type for every capture.
  let captureCat = 'todo';
  const placeholders = { todo: 'Add a to-do…', habit: 'Add a habit…', remember: 'Add to mindset…', note: 'Add a note…' };
  document.querySelectorAll('#cat-selector .cat-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      captureCat = chip.dataset.cat;
      document.querySelectorAll('#cat-selector .cat-chip').forEach((c) => c.classList.toggle('active', c === chip));
      quickInput.placeholder = placeholders[captureCat];
      quickInput.focus();
    });
  });

  async function doQuickAdd() {
    const text = quickInput.value.trim();
    if (!text) return;
    quickBtn.textContent = '…';
    quickBtn.disabled = true;
    try {
      const res = await api('/api/capture', 'POST', { text, type: captureCat });
      quickInput.value = '';
      const labels = { todo: 'to-do', habit: 'habit', remember: 'mindset note', note: 'note' };
      const what = labels[res?.type] || 'item';
      const name = res?.item?.title || res?.item?.name || res?.item?.text || '';
      toast(`Added ${what}${name ? `: ${name}` : ''}`);
      // Refresh current view
      if (TABS[currentTab]) TABS[currentTab](content);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      quickBtn.textContent = '+';
      quickBtn.disabled = false;
    }
  }

  quickBtn.addEventListener('click', doQuickAdd);
  quickInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doQuickAdd();
  });

  // Hash-based routing
  function routeFromHash() {
    const hash = location.hash.slice(1).split('?')[0];
    if (hash && TABS[hash]) {
      switchTab(hash);
    } else {
      switchTab('today');
    }
  }

  window.addEventListener('hashchange', routeFromHash);
  routeFromHash();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

function setupLogin(loginScreen, appEl) {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    const pw = document.getElementById('login-pw').value;
    try {
      await api('/api/auth/login', 'POST', { password: pw });
      await startApp(appEl, loginScreen);
    } catch (err) {
      errorEl.textContent = err.message || 'Invalid password';
      errorEl.style.display = '';
    }
  });
}

boot();
