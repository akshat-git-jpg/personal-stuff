// Habits view

import { api, toast, formatDate, makeSortable, wireCheckbox } from '../app.js';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DRAG_HANDLE = `<span class="drag-handle" aria-label="Drag to reorder" style="margin-top:2px"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg></span>`;
const chartInstances = {};

let activeTags = new Set();

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  let habits, archived;
  try {
    [habits, archived] = await Promise.all([
      api('/api/habits'),
      api('/api/habits/archived'),
    ]);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>Failed to load: ${e.message}</p></div>`;
    return;
  }

  // Build tag list from active habits.
  const tagSet = new Set();
  for (const h of habits) {
    if (h.tags) h.tags.split(',').forEach((tag) => { if (tag) tagSet.add(tag); });
  }
  const pageTags = [...tagSet].sort();

  for (const t of activeTags) {
    if (!tagSet.has(t)) activeTags.delete(t);
  }

  const visible = activeTags.size === 0 ? habits : habits.filter((h) => {
    if (!h.tags) return false;
    return h.tags.split(',').some((tag) => activeTags.has(tag));
  });

  let html = `
    <div class="page-header">
      <h2>Habits</h2>
    </div>
    <div style="padding:0 12px 8px">
      <button class="btn btn-primary btn-sm" id="btn-add-habit">+ Add habit</button>
    </div>
  `;

  if (pageTags.length > 0) {
    html += `<div class="tag-filter-bar">`;
    for (const tag of pageTags) {
      html += `<button class="tag-chip ${activeTags.has(tag) ? 'active' : ''}" data-tag="${escHtml(tag)}">${escHtml(tag)}</button>`;
    }
    html += `</div>`;
  }

  if (habits.length === 0 && archived.length === 0) {
    html += `<div class="empty-state"><div class="emoji">💪</div><p>No habits yet. Add one!</p></div>`;
  }

  html += `<div id="habit-sort">`;
  for (const h of visible) {
    html += renderHabitCard(h);
  }
  html += `</div>`;

  if (archived.length > 0) {
    const ICON_ARCHIVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
    html += `<div class="section-title"><span class="section-icon" style="color:var(--text-muted)">${ICON_ARCHIVE}</span>Archived</div>`;
    for (const h of archived) {
      html += renderHabitCard(h, true);
    }
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

  // Add habit button
  container.querySelector('#btn-add-habit')?.addEventListener('click', () => {
    openHabitModal(null, container);
  });

  // Wire log checkboxes (today) — optimistic (no full re-render on toggle)
  container.querySelectorAll('.habit-check').forEach((btn) => {
    wireCheckbox(btn, {
      request: (done) => api(`/api/habits/${btn.dataset.id}/log`, 'POST', { done }),
    });
  });

  // Wire edit buttons + row click to edit
  const openEdit = (id) => {
    const habit = [...habits, ...archived].find((h) => h.id === Number(id));
    if (habit) openHabitModal(habit, container);
  };
  container.querySelectorAll('.btn-edit-habit').forEach((btn) => {
    btn.addEventListener('click', () => openEdit(btn.dataset.id));
  });
  container.querySelectorAll('.habit-edit-trigger.row-edit').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('canvas')) return;
      openEdit(el.dataset.id);
    });
  });

  // Wire delete buttons
  container.querySelectorAll('.btn-delete-habit').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!confirm('Delete this habit?')) return;
      try {
        await api(`/api/habits/${id}`, 'DELETE');
        render(container);
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  });

  // Drag-to-reorder active habits.
  makeSortable(container.querySelector('#habit-sort'), '/api/habits/reorder');

  // Load graphs
  for (const h of [...habits, ...archived]) {
    const canvas = container.querySelector(`#chart-${h.id}`);
    if (!canvas) continue;
    try {
      const series = await api(`/api/habits/${h.id}/graph?days=30`);
      renderChart(canvas, series, h);
    } catch {
      // ignore graph errors
    }
  }
}

function renderTagChips(tagsStr) {
  if (!tagsStr) return '';
  const chips = tagsStr.split(',').filter(Boolean).map((t) => `<span class="tag">${escHtml(t)}</span>`).join('');
  if (!chips) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${chips}</div>`;
}

function renderHabitCard(h, isArchived = false) {
  const days = String(h.weekdays).split(',').map((s) => WEEKDAY_LABELS[parseInt(s.trim(), 10)]).join(', ');
  return `<div class="card" style="margin-bottom:8px" data-id="${h.id}">
    <div style="display:flex;align-items:flex-start;gap:10px">
      ${!isArchived ? DRAG_HANDLE : ''}
      ${!isArchived ? `<button class="habit-check ${h.done_today ? 'checked' : ''}" data-id="${h.id}" style="margin-top:2px"></button>` : `<div style="width:28px;flex-shrink:0"></div>`}
      <div style="flex:1;min-width:0" class="habit-edit-trigger row-edit" data-id="${h.id}">
        <div style="font-weight:600;font-size:.95rem">${escHtml(h.name)}${h.inconsistent ? ` <span class="tag warn">⚠ inconsistent</span>` : ''}</div>
        ${h.description ? `<div style="font-size:.8rem;color:var(--text-muted);margin-top:2px">${escHtml(h.description)}</div>` : ''}
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">
          ${days} · 🔥 ${h.current_streak} day streak
          ${h.mode === 'fixed' && h.end_date ? ` · ends ${formatDate(h.end_date)}` : ''}
        </div>
        ${renderTagChips(h.tags)}
        <div class="chart-container">
          <canvas id="chart-${h.id}"></canvas>
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="icon-btn btn-edit-habit" data-id="${h.id}" title="Edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="icon-btn btn-delete-habit" data-id="${h.id}" title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </div>
    </div>
  </div>`;
}

function renderChart(canvas, series, habit) {
  const existing = chartInstances[habit.id];
  if (existing) existing.destroy();

  const labels = series.map((s) => s.date.slice(5));
  const data = series.map((s) => s.done ? 1 : (s.scheduled ? 0.3 : 0));
  const colors = series.map((s) => s.done ? '#8b5cf6' : (s.scheduled ? 'rgba(150,130,180,.28)' : 'transparent'));

  chartInstances[habit.id] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderRadius: 3,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false, min: 0, max: 1 },
      },
    },
  });
}

export function openHabitModal(habit, container, refresh) {
  const isNew = !habit;
  const h = habit || {};
  const reload = () => (refresh || render)(container);

  const selectedDays = new Set(
    h.weekdays ? String(h.weekdays).split(',').map((s) => parseInt(s.trim(), 10)) : []
  );

  const weekdayBtns = WEEKDAY_LABELS.map((label, i) =>
    `<button type="button" class="weekday-btn ${selectedDays.has(i) ? 'active' : ''}" data-day="${i}">${label.slice(0,2)}</button>`
  ).join('');

  const modalHtml = `
    <div class="modal-backdrop" id="habit-modal">
      <div class="modal-sheet">
        <div class="modal-header">
          <span class="modal-title">${isNew ? 'New Habit' : 'Edit Habit'}</span>
          <button class="modal-close" id="habit-modal-close">✕</button>
        </div>
        <form id="habit-form">
          <div class="form-group">
            <label>Name *</label>
            <input type="text" name="name" value="${escHtml(h.name || '')}" required />
          </div>
          <div class="form-group">
            <label>Description</label>
            <input type="text" name="description" value="${escHtml(h.description || '')}" />
          </div>
          <div class="form-group">
            <label>Tags</label>
            <input type="text" name="tags" value="${escHtml(h.tags || '')}" placeholder="e.g. health,skills" />
          </div>
          <div class="form-group">
            <label>Days</label>
            <input type="hidden" name="weekdays" id="weekdays-hidden" value="${h.weekdays || ''}" />
            <div class="weekday-picker">${weekdayBtns}</div>
          </div>
          <div class="form-group">
            <label>Time of day (optional)</label>
            <input type="time" name="time_of_day" value="${h.time_of_day || ''}" />
          </div>
          <div class="form-group">
            <label>Mode</label>
            <select name="mode" id="habit-mode">
              <option value="forever" ${(!h.mode || h.mode === 'forever') ? 'selected' : ''}>Forever</option>
              <option value="fixed" ${h.mode === 'fixed' ? 'selected' : ''}>Fixed duration</option>
            </select>
          </div>
          <div id="fixed-dates" style="${h.mode === 'fixed' ? '' : 'display:none'}">
            <div style="display:flex;gap:10px">
              <div class="form-group" style="flex:1">
                <label>Start</label>
                <input type="date" name="start_date" value="${h.start_date || ''}" />
              </div>
              <div class="form-group" style="flex:1">
                <label>End</label>
                <input type="date" name="end_date" value="${h.end_date || ''}" />
              </div>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-full">${isNew ? 'Create' : 'Save'}</button>
        </form>
      </div>
    </div>
  `;

  const wrap = document.getElementById('modal-container');
  wrap.innerHTML = modalHtml;

  // Weekday picker
  const weekdaysHidden = wrap.querySelector('#weekdays-hidden');
  const activeDays = new Set(selectedDays);

  wrap.querySelectorAll('.weekday-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const day = parseInt(btn.dataset.day, 10);
      if (activeDays.has(day)) {
        activeDays.delete(day);
        btn.classList.remove('active');
      } else {
        activeDays.add(day);
        btn.classList.add('active');
      }
      weekdaysHidden.value = [...activeDays].sort().join(',');
    });
  });

  // Mode toggle
  wrap.querySelector('#habit-mode').addEventListener('change', (e) => {
    wrap.querySelector('#fixed-dates').style.display = e.target.value === 'fixed' ? '' : 'none';
  });

  // Close
  wrap.querySelector('#habit-modal-close').addEventListener('click', () => { wrap.innerHTML = ''; });
  wrap.querySelector('#habit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'habit-modal') wrap.innerHTML = '';
  });

  wrap.querySelector('#habit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!weekdaysHidden.value) return toast('Select at least one day', 'error');
    const body = {
      name: fd.get('name'),
      description: fd.get('description') || null,
      weekdays: weekdaysHidden.value,
      time_of_day: fd.get('time_of_day') || null,
      mode: fd.get('mode'),
      start_date: fd.get('start_date') || null,
      end_date: fd.get('end_date') || null,
      tags: fd.get('tags') || '',
    };
    try {
      if (isNew) {
        await api('/api/habits', 'POST', body);
      } else {
        await api(`/api/habits/${h.id}`, 'PATCH', body);
      }
      wrap.innerHTML = '';
      toast(isNew ? 'Habit created!' : 'Saved!');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
