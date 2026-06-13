// Todos view

import { api, toast, formatDate, showModal, closeModal, makeSortable, wireCheckbox } from '../app.js';

const DRAG_HANDLE = `<span class="drag-handle" aria-label="Drag to reorder"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg></span>`;

let currentFilter = { status: 'open', area: '', q: '' };
let activeTags = new Set(); // selected tag-filter chips

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  let todos;
  try {
    const params = new URLSearchParams({ status: currentFilter.status });
    if (currentFilter.area) params.set('area', currentFilter.area);
    if (currentFilter.q) params.set('q', currentFilter.q);
    todos = await api(`/api/todos?${params}`);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>Failed to load: ${e.message}</p></div>`;
    return;
  }

  // Build distinct tag list from this page's items.
  const tagSet = new Set();
  for (const t of todos) {
    if (t.tags) t.tags.split(',').forEach((tag) => { if (tag) tagSet.add(tag); });
  }
  const pageTags = [...tagSet].sort();

  // Prune activeTags to only those present in the current data set.
  for (const t of activeTags) {
    if (!tagSet.has(t)) activeTags.delete(t);
  }

  // Filter items client-side when tags are selected (OR logic).
  const visible = activeTags.size === 0 ? todos : todos.filter((t) => {
    if (!t.tags) return false;
    return t.tags.split(',').some((tag) => activeTags.has(tag));
  });

  let html = `
    <div class="page-header">
      <h2>To-dos</h2>
    </div>
    <div class="filter-bar">
      <button class="filter-chip ${currentFilter.status === 'open' ? 'active' : ''}" data-status="open">Open</button>
      <button class="filter-chip ${currentFilter.status === 'done' ? 'active' : ''}" data-status="done">Done</button>
      <button class="filter-chip ${currentFilter.status === 'all' ? 'active' : ''}" data-status="all">All</button>
    </div>
    <div style="padding:0 12px 8px">
      <input type="text" id="todo-search" placeholder="Search…" value="${escHtml(currentFilter.q)}" style="width:100%"/>
    </div>
  `;

  if (pageTags.length > 0) {
    html += `<div class="tag-filter-bar">`;
    for (const tag of pageTags) {
      html += `<button class="tag-chip ${activeTags.has(tag) ? 'active' : ''}" data-tag="${escHtml(tag)}">${escHtml(tag)}</button>`;
    }
    html += `</div>`;
  }

  if (visible.length === 0) {
    html += `<div class="empty-state"><div class="emoji">✅</div><p>Nothing here.</p></div>`;
  } else {
    html += `<ul class="todo-list">`;
    for (const t of visible) {
      html += renderTodo(t);
    }
    html += `</ul>`;
  }

  container.innerHTML = html;

  // Status filter chips
  container.querySelectorAll('.filter-chip[data-status]').forEach((chip) => {
    chip.addEventListener('click', () => {
      currentFilter.status = chip.dataset.status;
      render(container);
    });
  });

  // Tag filter chips
  container.querySelectorAll('.tag-chip[data-tag]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      if (activeTags.has(tag)) activeTags.delete(tag);
      else activeTags.add(tag);
      render(container);
    });
  });

  // Search
  let searchTimeout;
  container.querySelector('#todo-search')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentFilter.q = e.target.value;
      render(container);
    }, 300);
  });

  // Wire checkboxes — optimistic (no full re-render on toggle)
  container.querySelectorAll('.todo-check').forEach((btn) => {
    const li = btn.closest('.todo-item');
    wireCheckbox(btn, {
      rowEl: li,
      request: (done) => api(`/api/todos/${btn.dataset.id}`, 'PATCH', { done }),
    });
  });

  // Wire star buttons
  container.querySelectorAll('.btn-star').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        await api(`/api/todos/${id}/top3`, 'POST');
        render(container);
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  });

  // Wire edit buttons + row-body click to edit
  const openEdit = (id) => {
    const todo = todos.find((t) => t.id === Number(id));
    if (todo) openTodoModal(todo, container);
  };
  container.querySelectorAll('.btn-edit-todo').forEach((btn) => {
    btn.addEventListener('click', () => openEdit(btn.dataset.id));
  });
  container.querySelectorAll('.todo-body.row-edit').forEach((el) => {
    el.addEventListener('click', () => openEdit(el.dataset.id));
  });

  // Drag-to-reorder (manual order wins).
  makeSortable(container.querySelector('.todo-list'), '/api/todos/reorder');

  // Wire delete buttons
  container.querySelectorAll('.btn-delete-todo').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!confirm('Delete this to-do?')) return;
      try {
        await api(`/api/todos/${id}`, 'DELETE');
        render(container);
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  });
}

function renderTags(tagsStr) {
  if (!tagsStr) return '';
  return tagsStr
    .split(',')
    .filter(Boolean)
    .map((t) => `<span class="tag">${escHtml(t)}</span>`)
    .join('');
}

function renderTodo(t) {
  const overdueClass = isOverdue(t.deadline) && !t.done ? 'slipping' : '';
  const doneClass = t.done ? 'done' : '';
  const checkedClass = t.done ? 'checked' : '';
  const starredClass = t.is_top3 ? 'starred' : '';

  return `<li class="todo-item ${doneClass} ${overdueClass}" data-id="${t.id}">
    ${DRAG_HANDLE}
    <button class="todo-check ${checkedClass}" data-id="${t.id}" aria-label="Toggle"></button>
    <div class="todo-body row-edit" data-id="${t.id}">
      <div class="todo-title">${escHtml(t.title)}</div>
      <div class="todo-meta">
        ${t.deadline ? `<span class="tag ${isOverdue(t.deadline) && !t.done ? 'overdue' : 'deadline'}">${formatDate(t.deadline)}</span>` : ''}
        ${!t.done && isOverdue(t.deadline) ? `<span class="tag warn">⚠ slipping</span>` : ''}
        ${!t.done && isStale(t) ? `<span class="tag warn">⚠ pending ${ageDays(t.created_at)}d</span>` : ''}
        ${t.area ? `<span class="tag">${escHtml(t.area)}</span>` : ''}
        ${t.priority && t.priority !== 'normal' ? `<span class="tag priority-${t.priority}">${t.priority}</span>` : ''}
        ${t.recur_rule ? `<span class="tag">↻ ${t.recur_rule}</span>` : ''}
        ${renderTags(t.tags)}
      </div>
    </div>
    <div class="todo-actions">
      <button class="icon-btn star btn-star ${starredClass}" data-id="${t.id}" title="Top 3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${t.is_top3 ? 'var(--warning)' : 'none'}" stroke="var(--warning)" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>
      <button class="icon-btn btn-edit-todo" data-id="${t.id}" title="Edit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="icon-btn btn-delete-todo" data-id="${t.id}" title="Delete">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
        </svg>
      </button>
    </div>
  </li>`;
}

export function openTodoModal(todo, container, refresh) {
  const isNew = !todo;
  const t = todo || {};
  const reload = () => (refresh || render)(container);

  const modalHtml = `
    <div class="modal-backdrop" id="todo-modal">
      <div class="modal-sheet">
        <div class="modal-header">
          <span class="modal-title">${isNew ? 'New To-do' : 'Edit To-do'}</span>
          <button class="modal-close" id="todo-modal-close">✕</button>
        </div>
        <form id="todo-form">
          <div class="form-group">
            <label>Title *</label>
            <input type="text" name="title" value="${escHtml(t.title || '')}" required />
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea name="notes">${escHtml(t.notes || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Deadline</label>
            <input type="date" name="deadline" value="${t.deadline ? String(t.deadline).slice(0,10) : ''}" />
          </div>
          <div style="display:flex;gap:10px">
            <div class="form-group" style="flex:1">
              <label>Time start</label>
              <input type="time" name="time_start" value="${t.time_start || ''}" />
            </div>
            <div class="form-group" style="flex:1">
              <label>Time end</label>
              <input type="time" name="time_end" value="${t.time_end || ''}" />
            </div>
          </div>
          <div style="display:flex;gap:10px">
            <div class="form-group" style="flex:1">
              <label>Tags</label>
              <input type="text" name="tags" value="${escHtml(t.tags || '')}" placeholder="e.g. work,bank" />
            </div>
            <div class="form-group" style="flex:1">
              <label>Priority</label>
              <select name="priority">
                <option value="">—</option>
                <option value="low" ${t.priority === 'low' ? 'selected' : ''}>Low</option>
                <option value="normal" ${t.priority === 'normal' ? 'selected' : ''}>Normal</option>
                <option value="high" ${t.priority === 'high' ? 'selected' : ''}>High</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Repeat</label>
            <select name="recur_rule">
              <option value="">None</option>
              <option value="daily" ${t.recur_rule === 'daily' ? 'selected' : ''}>Daily</option>
              <option value="weekly" ${t.recur_rule === 'weekly' ? 'selected' : ''}>Weekly</option>
              <option value="monthly" ${t.recur_rule === 'monthly' ? 'selected' : ''}>Monthly</option>
              <option value="every:3" ${t.recur_rule === 'every:3' ? 'selected' : ''}>Every 3 days</option>
              <option value="every:7" ${t.recur_rule === 'every:7' ? 'selected' : ''}>Every 7 days</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-full">${isNew ? 'Create' : 'Save'}</button>
        </form>
      </div>
    </div>
  `;

  const wrap = document.getElementById('modal-container');
  wrap.innerHTML = modalHtml;

  wrap.querySelector('#todo-modal-close').addEventListener('click', () => {
    wrap.innerHTML = '';
  });

  wrap.querySelector('#todo-modal').addEventListener('click', (e) => {
    if (e.target.id === 'todo-modal') wrap.innerHTML = '';
  });

  wrap.querySelector('#todo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      title: fd.get('title'),
      notes: fd.get('notes') || null,
      deadline: fd.get('deadline') || null,
      time_start: fd.get('time_start') || null,
      time_end: fd.get('time_end') || null,
      tags: fd.get('tags') || '',
      priority: fd.get('priority') || null,
      recur_rule: fd.get('recur_rule') || null,
    };
    try {
      if (isNew) {
        await api('/api/todos', 'POST', body);
      } else {
        await api(`/api/todos/${t.id}`, 'PATCH', body);
      }
      wrap.innerHTML = '';
      toast(isNew ? 'To-do created!' : 'Saved!');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

export function openNewTodoModal(container) {
  openTodoModal(null, container);
}

function isOverdue(deadline) {
  if (!deadline) return false;
  const today = new Date().toISOString().slice(0, 10);
  return String(deadline).slice(0, 10) < today;
}

function ageDays(createdAt) {
  if (!createdAt) return 0;
  const a = Date.parse(String(createdAt).slice(0, 10));
  const b = Date.parse(new Date().toISOString().slice(0, 10));
  return Math.max(0, Math.round((b - a) / 86400000));
}

// Pending a long while: actionable now (no deadline, or due today — not a future
// item), not overdue (overdue has its own tag), and 4+ days old.
function isStale(t) {
  if (isOverdue(t.deadline)) return false;
  const today = new Date().toISOString().slice(0, 10);
  const actionableNow = !t.deadline || String(t.deadline).slice(0, 10) <= today;
  return actionableNow && ageDays(t.created_at) >= 4;
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
