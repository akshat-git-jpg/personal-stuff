// Remembers view

import { api, toast, makeSortable } from '../app.js';

const DRAG_HANDLE = `<span class="drag-handle" aria-label="Drag to reorder"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg></span>`;

let activeTags = new Set();

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  let remembers;
  try {
    remembers = await api('/api/remembers');
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>Failed to load: ${e.message}</p></div>`;
    return;
  }

  // Build tag list from items.
  const tagSet = new Set();
  for (const r of remembers) {
    if (r.tags) r.tags.split(',').forEach((tag) => { if (tag) tagSet.add(tag); });
  }
  const pageTags = [...tagSet].sort();

  for (const t of activeTags) {
    if (!tagSet.has(t)) activeTags.delete(t);
  }

  const visible = activeTags.size === 0 ? remembers : remembers.filter((r) => {
    if (!r.tags) return false;
    return r.tags.split(',').some((tag) => activeTags.has(tag));
  });

  let html = `
    <div class="page-header">
      <h2>Mindset</h2>
    </div>
    <div style="padding:0 12px 8px">
      <button class="btn btn-primary btn-sm" id="btn-add-remember">+ Add</button>
    </div>
  `;

  if (pageTags.length > 0) {
    html += `<div class="tag-filter-bar">`;
    for (const tag of pageTags) {
      html += `<button class="tag-chip ${activeTags.has(tag) ? 'active' : ''}" data-tag="${escHtml(tag)}">${escHtml(tag)}</button>`;
    }
    html += `</div>`;
  }

  if (remembers.length === 0) {
    html += `<div class="empty-state"><div class="emoji">💭</div><p>Add mindset lines — reminders that surface on Today each time you open the app.</p></div>`;
  } else {
    html += `<div id="remember-sort">`;
    for (const r of visible) {
      html += renderRemember(r);
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  // Tag filter chips
  container.querySelectorAll('.tag-chip[data-tag]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      if (activeTags.has(tag)) activeTags.delete(tag);
      else activeTags.add(tag);
      render(container);
    });
  });

  container.querySelector('#btn-add-remember')?.addEventListener('click', () => {
    openRememberModal(null, container);
  });

  const openEdit = (id) => {
    const r = remembers.find((x) => x.id === Number(id));
    if (r) openRememberModal(r, container);
  };
  container.querySelectorAll('.btn-edit-remember').forEach((btn) => {
    btn.addEventListener('click', () => openEdit(btn.dataset.id));
  });
  container.querySelectorAll('.remember-edit-trigger.row-edit').forEach((el) => {
    el.addEventListener('click', () => openEdit(el.dataset.id));
  });

  makeSortable(container.querySelector('#remember-sort'), '/api/remembers/reorder');

  container.querySelectorAll('.btn-delete-remember').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this remember?')) return;
      try {
        await api(`/api/remembers/${btn.dataset.id}`, 'DELETE');
        render(container);
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  });

  container.querySelectorAll('.btn-toggle-active').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const r = remembers.find((x) => x.id === Number(id));
      if (!r) return;
      try {
        await api(`/api/remembers/${id}`, 'PATCH', { active: !r.active });
        render(container);
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  });
}

function renderTagChips(tagsStr) {
  if (!tagsStr) return '';
  const chips = tagsStr.split(',').filter(Boolean).map((t) => `<span class="tag">${escHtml(t)}</span>`).join('');
  if (!chips) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${chips}</div>`;
}

function renderRemember(r) {
  return `<div class="card" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:6px;${!r.active ? 'opacity:.5' : ''}" data-id="${r.id}">
    ${DRAG_HANDLE}
    <div style="flex:1;font-size:.95rem" class="remember-edit-trigger row-edit" data-id="${r.id}">
      ${escHtml(r.text)}
      ${renderTagChips(r.tags)}
    </div>
    <div style="display:flex;gap:4px;flex-shrink:0">
      <button class="icon-btn btn-toggle-active" data-id="${r.id}" title="${r.active ? 'Deactivate' : 'Activate'}">
        ${r.active
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        }
      </button>
      <button class="icon-btn btn-edit-remember" data-id="${r.id}" title="Edit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="icon-btn btn-delete-remember" data-id="${r.id}" title="Delete">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        </svg>
      </button>
    </div>
  </div>`;
}

export function openRememberModal(remember, container, refresh) {
  const isNew = !remember;
  const r = remember || {};
  const reload = () => (refresh || render)(container);

  const modalHtml = `
    <div class="modal-backdrop" id="remember-modal">
      <div class="modal-sheet">
        <div class="modal-header">
          <span class="modal-title">${isNew ? 'New Remember' : 'Edit Remember'}</span>
          <button class="modal-close" id="remember-modal-close">✕</button>
        </div>
        <form id="remember-form">
          <div class="form-group">
            <label>Text *</label>
            <textarea name="text" rows="3" required>${escHtml(r.text || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Tags</label>
            <input type="text" name="tags" value="${escHtml(r.tags || '')}" placeholder="e.g. mindset,gf" />
          </div>
          <button type="submit" class="btn btn-primary btn-full">${isNew ? 'Create' : 'Save'}</button>
        </form>
      </div>
    </div>
  `;

  const wrap = document.getElementById('modal-container');
  wrap.innerHTML = modalHtml;

  wrap.querySelector('#remember-modal-close').addEventListener('click', () => { wrap.innerHTML = ''; });
  wrap.querySelector('#remember-modal').addEventListener('click', (e) => {
    if (e.target.id === 'remember-modal') wrap.innerHTML = '';
  });

  wrap.querySelector('#remember-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { text: fd.get('text'), tags: fd.get('tags') || '' };
    try {
      if (isNew) {
        await api('/api/remembers', 'POST', body);
      } else {
        await api(`/api/remembers/${r.id}`, 'PATCH', body);
      }
      wrap.innerHTML = '';
      toast(isNew ? 'Remember added!' : 'Saved!');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
