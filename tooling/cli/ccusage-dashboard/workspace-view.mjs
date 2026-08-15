export const WORKSPACE_CSS = `
.ws-toolbar { display:flex; gap:15px; margin-bottom:15px; align-items:center; }
.wstable { width:100%; border-collapse:collapse; font-size:12px; text-align:left; margin-bottom:10px; }
.wstable th { padding:8px 10px; font-weight:600; color:#7b828c; cursor:pointer; user-select:none; border-bottom:1px solid #20242b; }
.wstable td { padding:8px 10px; color:#e6e8eb; border-bottom:1px solid #1c2027; }
.wstable tbody tr:last-child td { border-bottom:none; }
.ws-pill { display:inline-block; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
.ws-pill.active { color:#5fd08a; }
.ws-pill.unused { color:#e0b24a; }
.ws-pill.disabled { color:#7b828c; }
.ws-dead-toggle { display:flex; align-items:center; gap:6px; font-size:12px; color:#cfd3da; cursor:pointer; }
.tabs { display:flex; gap:15px; margin:0 25px; }
.tab { background:none; border:none; color:#7b828c; font-size:14px; font-weight:600; cursor:pointer; padding:6px 0; border-bottom:2px solid transparent; text-transform:uppercase; letter-spacing:0.5px; }
.tab:hover { color:#e6e8eb; }
.tab.on { color:#e6e8eb; border-bottom:2px solid #5aa0e8; }
`;

export const WORKSPACE_JS = `
let wsData = null;
let wsSort = {
  apps: { key: 'name', dir: 1 },
  routines: { key: 'name', dir: 1 },
  memory: { key: 'path', dir: 1 },
  skills: { key: 'name', dir: 1 }
};
let wsDeadOnly = false;
let wsFetchFailed = false;

function switchTab(tabId) {
  const isUsage = tabId === 'usage';
  document.getElementById('app').hidden = !isUsage;
  document.getElementById('ws-app').hidden = isUsage;
  
  document.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === tabId);
  });
  
  const url = new URL(window.location);
  url.searchParams.set('tab', tabId);
  window.history.replaceState(null, '', url);

  if (!isUsage && !wsData && !wsFetchFailed) {
    loadWorkspace();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const url = new URL(window.location);
  const tab = url.searchParams.get('tab') === 'workspace' ? 'workspace' : 'usage';
  
  document.querySelectorAll('.tab').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
  
  switchTab(tab);
});

function loadWorkspace() {
  if (wsFetchFailed) return;
  wsFetchFailed = false;
  renderWorkspace();
  fetch('/api/workspace')
    .then(r => {
      if(!r.ok) throw new Error('not ok');
      return r.json();
    })
    .then(d => {
      wsData = d;
      renderWorkspace();
    })
    .catch(e => {
      wsFetchFailed = true;
      renderWorkspace();
    });
}

function handleWsSort(layer, key) {
  if (wsSort[layer].key === key) {
    wsSort[layer].dir *= -1;
  } else {
    wsSort[layer] = { key, dir: 1 };
  }
  renderWorkspace();
}

function formatBytes(bytes) {
  if (bytes == null) return '—';
  return (bytes / 1024).toFixed(1) + ' kB';
}

function renderWsPill(status, disabled) {
  if (disabled) return '<span class="ws-pill disabled">off</span>';
  if (status === 'active') return '<span class="ws-pill active">active</span>';
  if (status === 'unused') return '<span class="ws-pill unused">never used</span>';
  if (status === 'disabled') return '<span class="ws-pill disabled">off</span>';
  return '<span class="ws-pill">' + (status||'—') + '</span>';
}

function renderWsTable(layer, cols, data, colsMap) {
  let html = '<table class="wstable"><thead><tr>';
  cols.forEach(c => {
    const key = colsMap[c];
    const s = wsSort[layer];
    const icon = s.key === key ? (s.dir === 1 ? ' ▲' : ' ▼') : '';
    html += '<th onclick="handleWsSort(\\'' + layer + '\\', \\'' + key + '\\')">' + c + icon + '</th>';
  });
  html += '</tr></thead><tbody>';

  let rows = data;
  if (wsDeadOnly) {
    if (layer !== 'memory') {
      rows = rows.filter(r => r.status === 'unused' || r.status === 'disabled' || r.disabled);
    }
  }

  const s = wsSort[layer];
  rows = [...rows].sort((a, b) => {
    let va = a[s.key], vb = b[s.key];
    if (va == null) va = '';
    if (vb == null) vb = '';
    
    if (s.key === 'uses' || s.key === 'descChars' || s.key === 'bytes') {
      return (Number(va) - Number(vb)) * s.dir;
    }
    return String(va).localeCompare(String(vb)) * s.dir;
  });

  if (data.length === 0) {
    html += '<tr><td colspan="' + cols.length + '">nothing found</td></tr>';
  } else if (wsDeadOnly && rows.length === 0) {
    html += '<tr><td colspan="' + cols.length + '">nothing dead here</td></tr>';
  } else {
    rows.forEach(r => {
      html += '<tr>';
      cols.forEach(c => {
        const k = colsMap[c];
        if (k === 'lastUsed' || k === 'mtime') {
          html += '<td>' + (fmtAge(r[k]) || '—') + '</td>';
        } else if (k === 'bytes') {
          html += '<td>' + formatBytes(r[k]) + '</td>';
        } else if (k === 'status') {
          html += '<td>' + renderWsPill(r.status, r.disabled) + '</td>';
        } else {
          html += '<td>' + (r[k] == null ? '—' : r[k]) + '</td>';
        }
      });
      html += '</tr>';
    });
  }

  html += '</tbody></table>';
  return html;
}

function renderWorkspace() {
  const root = document.getElementById('ws-app');
  if (wsFetchFailed) {
    root.innerHTML = '<div class="lnote">scan failed — is workspace.mjs present?</div>';
    return;
  }
  if (!wsData) {
    root.innerHTML = '<div class="lnote">scanning…</div>';
    return;
  }

  let html = '<div class="ws-toolbar">' +
    '<label class="ws-dead-toggle">' +
      '<input type="checkbox" ' + (wsDeadOnly ? 'checked' : '') + ' onchange="wsDeadOnly=this.checked; renderWorkspace()">' +
      'Show dead only' +
    '</label>' +
    '<button class="refreshbtn" onclick="wsData=null; loadWorkspace()">↻ refresh</button>' +
  '</div>';

  if (wsData.warnings && wsData.warnings.length > 0) {
    html += '<div class="lnote" style="margin-bottom:15px; color:#e0b24a;">';
    wsData.warnings.forEach(w => {
      html += '<div>⚠ ' + w + '</div>';
    });
    html += '</div>';
  }
  
  const accText = wsData.accounts.map(a => {
    if (!a.present) return '<span style="color:#7b828c">' + a.id + ' (not found)</span>';
    return '<span>' + a.id + '</span>';
  }).join(' · ');
  html += '<div class="sec-h">Accounts: <span style="font-weight:normal; margin-left:8px; display:inline-flex; gap:8px;">' + accText + '</span></div>';

  const appsCols = ['Name', 'Kind', 'Scope', 'Account', 'Uses', 'Last used', 'Status'];
  const appsMap = { 'Name':'name', 'Kind':'kind', 'Scope':'scope', 'Account':'account', 'Uses':'uses', 'Last used':'lastUsed', 'Status':'status' };
  html += '<div class="sec-h">Apps &amp; connections</div><div class="panel">';
  html += renderWsTable('apps', appsCols, wsData.layers.apps, appsMap);
  html += '</div>';

  const routinesCols = ['Job', 'Schedule (IST)', 'UTC cron', 'Code path', 'Status'];
  const routinesMap = { 'Job':'name', 'Schedule (IST)':'schedule', 'UTC cron':'cronUtc', 'Code path':'codePath', 'Status':'status' };
  html += '<div class="sec-h">Routines</div><div class="panel">';
  html += renderWsTable('routines', routinesCols, wsData.layers.routines, routinesMap);
  if (wsData.layers.routines.length === 0) {
    const w = wsData.warnings.find(w => w.includes('vps-crons'));
    if (w) html += '<div class="lnote" style="margin-top:10px;">' + w + '</div>';
  }
  html += '</div>';

  const memCols = ['File', 'Role', 'Size', 'Modified'];
  const memMap = { 'File':'path', 'Role':'role', 'Size':'bytes', 'Modified':'mtime' };
  html += '<div class="sec-h">Memory</div><div class="panel">';
  html += renderWsTable('memory', memCols, wsData.layers.memory, memMap);
  if (wsDeadOnly) html += '<div class="lnote" style="margin-top:10px;">no status for memory files</div>';
  html += '</div>';

  const skillsCols = ['Name', 'Source', 'Account', 'Uses', 'Last used', 'Desc chars', 'Status'];
  const skillsMap = { 'Name':'name', 'Source':'source', 'Account':'account', 'Uses':'uses', 'Last used':'lastUsed', 'Desc chars':'descChars', 'Status':'status' };
  html += '<div class="sec-h">Skills</div><div class="panel">';
  html += renderWsTable('skills', skillsCols, wsData.layers.skills, skillsMap);
  html += '</div>';

  root.innerHTML = html;
}
`;
