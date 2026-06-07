// Today view

import { api, toast, formatDate, formatTime } from '../app.js';
import { openTodoModal } from './todos.js';
import { openHabitModal } from './habits.js';
import { openRememberModal } from './remembers.js';

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

  let html = '';

  // Remember card
  html += `<div class="remember-card${remember ? ' row-edit' : ''}"${remember ? ` data-remember-id="${remember.id}"` : ''}>
    <div class="card-label">✨ Mindset</div>
    <div>${remember ? escHtml(remember.text) : 'Add mindset lines in the Mindset tab.'}</div>
  </div>`;

  // Top 3
  if (top3 && top3.length > 0) {
    html += `<div class="section-title">⭐ Top 3 Today</div>`;
    html += `<ul class="todo-list" id="top3-list">`;
    for (const t of top3) {
      html += renderTodoItem(t, true);
    }
    html += `</ul>`;
  }

  // Calendar
  html += `<div class="section-title">📅 Today's Schedule</div>`;
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
  html += `<div class="section-title">📋 Due Today</div>`;
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
  html += `<div class="section-title">💪 Habits Today</div>`;
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
  html += `<div class="done-banner">You've completed <span>${doneTodayCount}</span> ${doneTodayCount === 1 ? 'task' : 'tasks'} today 🎉</div>`;

  container.innerHTML = html;

  // Wire todo checkboxes
  container.querySelectorAll('.todo-check').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const done = btn.classList.contains('checked') ? 0 : 1;
      try {
        await api(`/api/todos/${id}`, 'PATCH', { done });
        render(container);
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  });

  // Wire habit checkboxes
  container.querySelectorAll('.habit-check').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const done = btn.classList.contains('checked') ? 0 : 1;
      try {
        await api(`/api/habits/${id}/log`, 'POST', { done });
        render(container);
      } catch (e) {
        toast(e.message, 'error');
      }
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
