// Notes view — a static list of facts / jottings. Not shown on the dashboard.

import { api, toast, formatDate, makeSortable } from '../app.js';

const DRAG_HANDLE = `<span class="drag-handle" aria-label="Drag to reorder" style="margin-top:2px"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg></span>`;

let searchQ = '';
let activeTags = new Set();

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  let notes;
  try {
    const params = new URLSearchParams();
    if (searchQ) params.set('q', searchQ);
    notes = await api(`/api/notes?${params}`);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>Failed to load: ${e.message}</p></div>`;
    return;
  }

  // Build tag list from items.
  const tagSet = new Set();
  for (const n of notes) {
    if (n.tags) n.tags.split(',').forEach((tag) => { if (tag) tagSet.add(tag); });
  }
  const pageTags = [...tagSet].sort();

  for (const t of activeTags) {
    if (!tagSet.has(t)) activeTags.delete(t);
  }

  const visible = activeTags.size === 0 ? notes : notes.filter((n) => {
    if (!n.tags) return false;
    return n.tags.split(',').some((tag) => activeTags.has(tag));
  });

  let html = `
    <div class="page-header">
      <h2>Notes</h2>
    </div>
    <div style="padding:0 12px 8px;display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" id="btn-add-note">+ Add</button>
    </div>
    <div style="padding:0 12px 8px">
      <input type="text" id="note-search" placeholder="Search notes…" value="${escHtml(searchQ)}" style="width:100%"/>
    </div>
  `;

  if (pageTags.length > 0) {
    html += `<div class="tag-filter-bar">`;
    for (const tag of pageTags) {
      html += `<button class="tag-chip ${activeTags.has(tag) ? 'active' : ''}" data-tag="${escHtml(tag)}">${escHtml(tag)}</button>`;
    }
    html += `</div>`;
  }

  if (notes.length === 0) {
    html += `<div class="empty-state"><div class="emoji">🗒️</div><p>Jot down facts or random notes — they live here for whenever you need them.</p></div>`;
  } else {
    html += `<div id="note-sort">`;
    for (const n of visible) html += renderNote(n);
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

  container.querySelector('#btn-add-note')?.addEventListener('click', () => openNoteModal(null, container));

  let t;
  container.querySelector('#note-search')?.addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { searchQ = e.target.value; render(container); }, 300);
  });

  const openEdit = (id) => {
    const n = notes.find((x) => x.id === Number(id));
    if (n) openNoteModal(n, container);
  };
  container.querySelectorAll('.note-edit-trigger.row-edit').forEach((el) => {
    el.addEventListener('click', () => openEdit(el.dataset.id));
  });

  makeSortable(container.querySelector('#note-sort'), '/api/notes/reorder');
  container.querySelectorAll('.btn-delete-note').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this note?')) return;
      try {
        await api(`/api/notes/${btn.dataset.id}`, 'DELETE');
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

function renderNote(n) {
  return `<div class="card" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:6px" data-id="${n.id}">
    ${DRAG_HANDLE}
    <div style="flex:1;min-width:0" class="note-edit-trigger row-edit" data-id="${n.id}">
      <div style="white-space:pre-wrap;font-size:.95rem">${escHtml(n.text)}</div>
      ${renderTagChips(n.tags)}
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:6px">${formatDate(n.created_at)}</div>
    </div>
    <button class="icon-btn btn-delete-note" data-id="${n.id}" title="Delete" style="flex-shrink:0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      </svg>
    </button>
  </div>`;
}

export function openNoteModal(note, container, refresh) {
  const isNew = !note;
  const n = note || {};
  const reload = () => (refresh || render)(container);

  const wrap = document.getElementById('modal-container');
  wrap.innerHTML = `
    <div class="modal-backdrop" id="note-modal">
      <div class="modal-sheet">
        <div class="modal-header">
          <span class="modal-title">${isNew ? 'New Note' : 'Edit Note'}</span>
          <button class="modal-close" id="note-modal-close">✕</button>
        </div>
        <form id="note-form">
          <div class="form-group">
            <label>Note *</label>
            <textarea name="text" rows="5" required>${escHtml(n.text || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Tags</label>
            <input type="text" name="tags" value="${escHtml(n.tags || '')}" placeholder="e.g. wifi,home" />
          </div>
          <button type="submit" class="btn btn-primary btn-full">${isNew ? 'Add' : 'Save'}</button>
        </form>
      </div>
    </div>
  `;

  wrap.querySelector('#note-modal-close').addEventListener('click', () => { wrap.innerHTML = ''; });
  wrap.querySelector('#note-modal').addEventListener('click', (e) => {
    if (e.target.id === 'note-modal') wrap.innerHTML = '';
  });

  wrap.querySelector('#note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { text: fd.get('text'), tags: fd.get('tags') || '' };
    try {
      if (isNew) await api('/api/notes', 'POST', body);
      else await api(`/api/notes/${n.id}`, 'PATCH', body);
      wrap.innerHTML = '';
      toast(isNew ? 'Note added!' : 'Saved!');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
