// Today view

import { api, toast, formatDate, formatTime, wireCheckbox } from '../app.js';
import { openTodoModal } from './todos.js';
import { openHabitModal } from './habits.js';
import { openRememberModal } from './remembers.js';

// SVG icon snippets (stroke="currentColor", fill="none", stroke-width="2")
const ICON_MINDSET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const ICON_STAR    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const ICON_CAL     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const ICON_TODOS   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
const ICON_HABITS  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  let data;
  try {
    data = await api('/api/today');
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>Failed to load: ${e.message}</p></div>`;
    return;
  }

  const { remember, top3, calendarEvents, todosDue, habitsToday, doneTodayCount } = data;

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  let html = '';

  // Greeting header
  html += `<header class="day-header">
    <div class="day-greeting">${greeting}</div>
    <div class="day-date">${dateStr}</div>
  </header>`;

  // Remember card
  html += `<div class="remember-card${remember ? ' row-edit' : ''}"${remember ? ` data-remember-id="${remember.id}"` : ''}>
    <div class="card-label">✨ Mindset</div>
    <div>${remember ? escHtml(remember.text) : 'Add mindset lines in the Mindset tab.'}</div>
  </div>`;

  // Top 3
  if (top3 && top3.length > 0) {
    html += `<div class="section-title"><span class="section-icon c-calendar">${ICON_STAR}</span>Top 3 Today</div>`;
    html += `<ul class="todo-list" id="top3-list">`;
    for (const t of top3) {
      html += renderTodoItem(t, true);
    }
    html += `</ul>`;
  }

  // Calendar
  html += `<div class="section-title"><span class="section-icon c-calendar">${ICON_CAL}</span>Today's Schedule</div>`;
  html += `<div class="card">`;
  if (!calendarEvents || calendarEvents.length === 0) {
    html += `<div style="color:var(--text-muted);font-size:.9rem">No events — or Google Calendar not connected.</div>`;
  } else {
    for (const ev of calendarEvents) {
      const timeStr = ev.allDay ? 'All day' : formatTime(ev.start);
      html += `<div class="cal-event">
        <div class="cal-event-time">${timeStr}</div>
        <div class="cal-event-title">${escHtml(ev.summary)}</div>
      </div>`;
    }
  }
  html += `</div>`;

  // Todos due
  html += `<div class="section-title"><span class="section-icon c-todo">${ICON_TODOS}</span>Due Today</div>`;
  if (!todosDue || todosDue.length === 0) {
    html += `<div class="empty-state" style="padding:24px"><p>Nothing due — great!</p></div>`;
  } else {
    html += `<ul class="todo-list" id="todos-due-list">`;
    for (const t of todosDue) {
      html += renderTodoItem(t, false);
    }
    html += `</ul>`;
  }

  // Habits today
  html += `<div class="section-title"><span class="section-icon c-habit">${ICON_HABITS}</span>Habits Today</div>`;
  if (!habitsToday || habitsToday.length === 0) {
    html += `<div class="empty-state" style="padding:24px"><p>No habits scheduled for today.</p></div>`;
  } else {
    html += `<div id="habits-today-list">`;
    for (const h of habitsToday) {
      html += renderHabitItem(h);
    }
    html += `</div>`;
  }

  // Done today count
  html += `<div class="done-banner">You've completed <span id="done-count-val">${doneTodayCount}</span> ${doneTodayCount === 1 ? 'task' : 'tasks'} today 🎉</div>`;

  container.innerHTML = html;

  // Helper to update the done-banner count optimistically
  let doneCount = doneTodayCount;
  function adjustDoneCount(delta) {
    doneCount = Math.max(0, doneCount + delta);
    const span = container.querySelector('#done-count-val');
    if (span) {
      span.textContent = doneCount;
      const banner = container.querySelector('.done-banner');
      if (banner) {
        banner.innerHTML = `You've completed <span id="done-count-val">${doneCount}</span> ${doneCount === 1 ? 'task' : 'tasks'} today 🎉`;
      }
    }
  }

  // Wire todo checkboxes — optimistic
  container.querySelectorAll('.todo-check').forEach((btn) => {
    const li = btn.closest('.todo-item');
    const wasChecked = btn.classList.contains('checked');
    wireCheckbox(btn, {
      rowEl: li,
      request: (done) => api(`/api/todos/${btn.dataset.id}`, 'PATCH', { done }),
      onChange: (next) => {
        if (wasChecked) {
          // item was done → toggling off = uncomplete
          adjustDoneCount(next ? 0 : -1);
        } else {
          adjustDoneCount(next ? 1 : -1);
        }
      },
    });
  });

  // Wire habit checkboxes — optimistic
  container.querySelectorAll('.habit-check').forEach((btn) => {
    wireCheckbox(btn, {
      request: (done) => api(`/api/habits/${btn.dataset.id}/log`, 'POST', { done }),
    });
  });

  // Row click → edit (reuses the per-type modals; refresh re-renders Today).
  const refresh = () => render(container);
  const allTodos = [...(top3 || []), ...(todosDue || [])];
  container.querySelectorAll('.todo-body.row-edit').forEach((el) => {
    el.addEventListener('click', () => {
      const t = allTodos.find((x) => x.id === Number(el.dataset.todoId));
      if (t) openTodoModal(t, container, refresh);
    });
  });
  container.querySelectorAll('.habit-body.row-edit').forEach((el) => {
    el.addEventListener('click', () => {
      const h = (habitsToday || []).find((x) => x.id === Number(el.dataset.habitId));
      if (h) openHabitModal(h, container, refresh);
    });
  });
  const rememberCard = container.querySelector('.remember-card.row-edit');
  if (rememberCard && remember) {
    rememberCard.addEventListener('click', () => openRememberModal(remember, container, refresh));
  }
}

function renderTodoItem(t, isTop3) {
  const overdueClass = t.slipping ? 'slipping' : '';
  const checkedClass = t.done ? 'checked' : '';
  const doneClass = t.done ? 'done' : '';
  return `<li class="todo-item ${doneClass} ${overdueClass}">
    <button class="todo-check ${checkedClass}" data-id="${t.id}" aria-label="Toggle done"></button>
    <div class="todo-body row-edit" data-todo-id="${t.id}">
      <div class="todo-title">${escHtml(t.title)}</div>
      <div class="todo-meta">
        ${t.deadline ? `<span class="tag ${t.slipping ? 'overdue' : 'deadline'}">${formatDate(t.deadline)}</span>` : ''}
        ${t.slipping ? `<span class="tag warn">⚠ slipping</span>` : ''}
        ${t.stale ? `<span class="tag warn">⚠ pending ${t.age_days}d</span>` : ''}
        ${t.area ? `<span class="tag">${escHtml(t.area)}</span>` : ''}
        ${t.priority && t.priority !== 'normal' ? `<span class="tag priority-${t.priority}">${t.priority}</span>` : ''}
      </div>
    </div>
  </li>`;
}

function renderHabitItem(h) {
  const checkedClass = h.done_today ? 'checked' : '';
  return `<div class="habit-item">
    <button class="habit-check ${checkedClass}" data-id="${h.id}" aria-label="Toggle habit"></button>
    <div class="habit-body row-edit" data-habit-id="${h.id}">
      <div class="habit-name">${escHtml(h.name)}${h.inconsistent ? ` <span class="tag warn">⚠ inconsistent</span>` : ''}</div>
      <div class="habit-streak">🔥 ${h.current_streak} day streak</div>
    </div>
  </div>`;
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
