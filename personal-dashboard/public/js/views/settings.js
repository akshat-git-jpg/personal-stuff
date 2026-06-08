// Settings view

import { api, toast } from '../app.js';

export async function render(container) {
  container.innerHTML = '<div class="spinner"></div>';

  let settings;
  try {
    settings = await api('/api/settings');
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>Failed to load: ${e.message}</p></div>`;
    return;
  }

  const { model, has_key, capture_rules_md, timezone, dark_mode, google } = settings;

  let html = `
    <div class="page-header"><h2>Settings</h2></div>

    <!-- LLM -->
    <div class="settings-section">
      <h3>LLM / Capture</h3>
      <div class="settings-card">
        <form id="llm-form" style="padding:14px 16px">
          <div class="form-group">
            <label>OpenRouter model</label>
            <input type="text" name="openrouter_model" value="${escHtml(model)}" />
          </div>
          <div class="form-group">
            <label>API key ${has_key ? '(set ✓)' : '(not set)'}</label>
            <input type="password" name="openrouter_key" placeholder="${has_key ? 'Enter to replace' : 'sk-or-…'}" autocomplete="off" />
          </div>
          <div class="form-group">
            <label>Capture rules (markdown)</label>
            <textarea name="capture_rules_md" rows="6">${escHtml(capture_rules_md)}</textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Save LLM settings</button>
        </form>
      </div>
    </div>

    <!-- Preferences -->
    <div class="settings-section">
      <h3>Preferences</h3>
      <div class="settings-card">
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Timezone</div>
            <div class="settings-row-hint">e.g. Asia/Kolkata, America/New_York</div>
          </div>
          <input type="text" id="tz-input" value="${escHtml(timezone)}" style="width:160px" />
        </div>
        <div class="settings-row">
          <div class="settings-row-label">Dark mode</div>
          <label class="toggle">
            <input type="checkbox" id="dark-toggle" ${(localStorage.getItem('pd-theme') || 'dark') !== 'light' ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- Google Calendar -->
    <div class="settings-section">
      <h3>Google Calendar</h3>
      <div class="settings-card">
        <div class="settings-row">
          <div>
            <div class="settings-row-label">Status</div>
            <div class="settings-row-hint">${google.connected ? `Connected · last synced ${google.lastSynced ? new Date(google.lastSynced).toLocaleString() : 'never'}` : 'Not connected'}</div>
          </div>
          <div style="display:flex;gap:8px">
            ${google.connected
              ? `<button class="btn btn-outline btn-sm" id="btn-google-sync">Sync now</button>`
              : `<a class="btn btn-primary btn-sm" href="/api/settings/google/auth">Connect</a>`
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Account -->
    <div class="settings-section">
      <h3>Account</h3>
      <div class="settings-card">
        <form id="pw-form" style="padding:14px 16px">
          <div class="form-group">
            <label>Current password</label>
            <input type="password" name="current" autocomplete="current-password" />
          </div>
          <div class="form-group">
            <label>New password</label>
            <input type="password" name="next" autocomplete="new-password" />
          </div>
          <button type="submit" class="btn btn-outline btn-sm">Change password</button>
        </form>
      </div>
    </div>

    <!-- Data -->
    <div class="settings-section">
      <h3>Data</h3>
      <div class="settings-card">
        <div class="settings-row">
          <div class="settings-row-label">Export all data</div>
          <a class="btn btn-outline btn-sm" href="/api/settings/export" download>Export JSON</a>
        </div>
      </div>
    </div>

    <div style="height:20px"></div>
  `;

  container.innerHTML = html;

  // LLM form
  container.querySelector('#llm-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { openrouter_model: fd.get('openrouter_model') };
    const key = fd.get('openrouter_key');
    if (key) body.openrouter_key = key;
    body.capture_rules_md = fd.get('capture_rules_md');
    try {
      await api('/api/settings', 'PATCH', body);
      toast('Saved!');
      render(container);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Timezone
  let tzTimeout;
  container.querySelector('#tz-input')?.addEventListener('change', async (e) => {
    try {
      await api('/api/settings', 'PATCH', { timezone: e.target.value });
      toast('Timezone saved!');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Dark mode toggle
  container.querySelector('#dark-toggle')?.addEventListener('change', async (e) => {
    const val = e.target.checked;
    // localStorage is the source of truth for the theme; apply immediately.
    localStorage.setItem('pd-theme', val ? 'dark' : 'light');
    applyDarkMode(val);
    // Mirror to the server too (keeps the JSON export accurate).
    try {
      await api('/api/settings', 'PATCH', { dark_mode: val });
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Google sync
  container.querySelector('#btn-google-sync')?.addEventListener('click', async () => {
    try {
      const res = await api('/api/settings/google/sync', 'POST');
      toast(`Synced! ${res.eventCount} events today.`);
      render(container);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Password change
  container.querySelector('#pw-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/api/auth/change-password', 'POST', { current: fd.get('current'), next: fd.get('next') });
      toast('Password changed!');
      e.target.reset();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function applyDarkMode(enabled) {
  document.documentElement.classList.toggle('dark', enabled);
  document.documentElement.classList.toggle('light', !enabled);
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
