import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

function readSkillMeta(text, dirName) {
  let name = dirName, desc = '';
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    const fm = end > 0 ? text.slice(3, end) : '';
    const n = fm.match(/^name:[ \t]*(.+)$/m);
    if (n) name = n[1].trim();
    // description may be a plain scalar OR a folded block (`>-` then indented lines)
    const d = fm.match(/^description:[ \t]*(>[-+]?|\|[-+]?)?[ \t]*\n?((?:.|\n(?=[ \t]))*)/m);
    if (d) desc = (d[2] || '').split('\n').map((s) => s.trim()).filter(Boolean).join(' ');
  }
  return { name, desc };
}

const norm = (s) => s.replace(/[^a-zA-Z0-9_-]/g, '_');

function tryReadJSON(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return null;
  }
}

export async function scanWorkspace(opts = {}) {
  const repoRoot = opts.repoRoot || resolve(new URL('.', import.meta.url).pathname, '../../..');
  const accounts = opts.accounts || [
    { id: 'work', dir: `${homedir()}/.claude-work` },
    { id: 'personal', dir: `${homedir()}/.claude-personal` }
  ];
  const cronsRoot = opts.cronsRoot || resolve(repoRoot, '../vps-crons');
  const maxTranscripts = opts.maxTranscripts || 50;

  const result = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    accounts: [],
    layers: { apps: [], routines: [], memory: [], skills: [] },
    warnings: []
  };

  // 1. Accounts
  for (const acct of accounts) {
    let present = false;
    try {
      if (statSync(acct.dir).isDirectory()) present = true;
    } catch { }
    result.accounts.push({ id: acct.id, dir: acct.dir, present });
  }

  // 2. Apps
  // 2.1 Local apps (repo)
  try {
    const appsJson = tryReadJSON(join(repoRoot, 'tooling/cli/local-apps-dashboard/apps.json'));
    if (appsJson && appsJson.apps) {
      for (const app of appsJson.apps) {
        result.layers.apps.push({
          id: app.id,
          name: app.name || app.id,
          kind: 'local-app',
          scope: 'repo',
          account: null,
          port: app.port || null,
          url: app.url || null,
          status: 'active',
          uses: 0,
          lastUsed: null
        });
      }
    }
  } catch (e) {
    result.warnings.push(`Failed to read apps.json: ${e.message}`);
  }

  // 2.2 Repo-scope MCP servers
  try {
    const repoMcp = tryReadJSON(join(repoRoot, '.mcp.json'));
    if (repoMcp && repoMcp.mcpServers) {
      for (const name of Object.keys(repoMcp.mcpServers)) {
        result.layers.apps.push({
          id: name,
          name,
          kind: 'mcp',
          scope: 'repo',
          account: null,
          port: null,
          url: null,
          status: 'active',
          uses: 0,
          lastUsed: null
        });
      }
    }
  } catch (e) {
    result.warnings.push(`Failed to read repo .mcp.json: ${e.message}`);
  }

  // 2.3 CLIs
  try {
    const clisDir = join(repoRoot, 'tooling/cli');
    const clis = readdirSync(clisDir, { withFileTypes: true });
    for (const cli of clis) {
      if (cli.isDirectory()) {
        result.layers.apps.push({
          id: cli.name,
          name: cli.name,
          kind: 'cli',
          scope: 'repo',
          account: null,
          port: null,
          url: null,
          status: 'active',
          uses: 0,
          lastUsed: null
        });
      }
    }
  } catch (e) {
    result.warnings.push(`Failed to read CLIs: ${e.message}`);
  }

  const disabledMcp = new Set();
  const disabledSkills = new Set();
  const mcpUses = new Map();
  const skillUses = new Map();

  for (const acct of result.accounts) {
    if (!acct.present) continue;

    const settings = tryReadJSON(join(acct.dir, 'settings.json'));
    if (settings && settings.skillOverrides) {
      for (const [name, val] of Object.entries(settings.skillOverrides)) {
        if (val === 'off') disabledSkills.add(name);
      }
    }

    const claudeJson = tryReadJSON(join(acct.dir, '.claude.json'));
    if (claudeJson) {
      if (claudeJson.mcpServers) {
        for (const name of Object.keys(claudeJson.mcpServers)) {
          result.layers.apps.push({
            id: name,
            name,
            kind: 'mcp',
            scope: 'user',
            account: acct.id,
            port: null,
            url: null,
            status: 'active',
            uses: 0,
            lastUsed: null
          });
        }
      }

      if (claudeJson.projects && claudeJson.projects[repoRoot]) {
        const p = claudeJson.projects[repoRoot];
        if (p.disabledMcpServers) {
          p.disabledMcpServers.forEach(n => disabledMcp.add(n));
        }
        if (p.disabledMcpjsonServers) {
          p.disabledMcpjsonServers.forEach(n => disabledMcp.add(n));
        }
      }

      if (claudeJson.skillUsage) {
        for (const [name, usage] of Object.entries(claudeJson.skillUsage)) {
          if (!skillUses.has(name)) skillUses.set(name, { uses: 0, lastUsed: 0 });
          const cur = skillUses.get(name);
          cur.uses += usage.usageCount || 0;
          if (usage.lastUsedAt && usage.lastUsedAt > cur.lastUsed) {
            cur.lastUsed = usage.lastUsedAt;
          }
        }
      }
    }

    try {
      const projDir = join(acct.dir, 'projects');
      const projects = readdirSync(projDir, { withFileTypes: true });
      let allTranscripts = [];
      for (const p of projects) {
        if (!p.isDirectory()) continue;
        const logDir = join(projDir, p.name, '.system_generated', 'logs');
        try {
          const files = readdirSync(logDir, { withFileTypes: true });
          for (const f of files) {
            if (f.isFile() && f.name.endsWith('.jsonl')) {
              const fullPath = join(logDir, f.name);
              allTranscripts.push({
                path: fullPath,
                mtime: statSync(fullPath).mtimeMs
              });
            }
          }
        } catch { }
      }
      
      allTranscripts.sort((a, b) => b.mtime - a.mtime);
      allTranscripts = allTranscripts.slice(0, maxTranscripts);

      for (const t of allTranscripts) {
        try {
          if (statSync(t.path).size > 64 * 1024 * 1024) continue;
          const content = readFileSync(t.path, 'utf8');
          const lines = content.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.tool_calls) {
                for (const tc of parsed.tool_calls) {
                  if (tc.name && tc.name.startsWith('mcp__')) {
                    const parts = tc.name.split('__');
                    if (parts.length >= 3) {
                      const serverNorm = parts[1];
                      if (!mcpUses.has(serverNorm)) {
                        mcpUses.set(serverNorm, { uses: 0, lastUsed: 0 });
                      }
                      const cur = mcpUses.get(serverNorm);
                      cur.uses += 1;
                      if (t.mtime > cur.lastUsed) cur.lastUsed = t.mtime;
                    }
                  }
                }
              }
            } catch { }
          }
        } catch { }
      }
    } catch (e) {
      result.warnings.push(`Failed to read transcripts for ${acct.id}: ${e.message}`);
    }
  }

  for (const app of result.layers.apps) {
    if (app.kind === 'mcp') {
      if (disabledMcp.has(app.name)) {
        app.status = 'disabled';
      } else {
        const n = norm(app.name);
        const usage = mcpUses.get(n);
        if (usage) {
          app.uses = usage.uses;
          app.lastUsed = new Date(usage.lastUsed).toISOString();
        }
        if (app.status !== 'disabled') {
          app.status = app.uses === 0 ? 'unused' : 'active';
        }
      }
    }
  }

  // 3. Routines
  try {
    const readmePath = join(cronsRoot, 'README.md');
    const content = readFileSync(readmePath, 'utf8');
    const lines = content.split('\n');
    let inTable = false;
    for (const line of lines) {
      if (line.includes('| Job | Schedule (IST) | UTC cron | Real code path (in `personal-stuff` repo) | Status |')) {
        inTable = true;
        continue;
      }
      if (inTable) {
        if (line.startsWith('|---')) continue;
        if (!line.startsWith('|')) {
          inTable = false;
          continue;
        }
        const parts = line.split('|').map(s => s.trim());
        if (parts.length >= 6) {
          // the Job cell is a markdown link — `[my-planner](./my-planner/)` — so
          // pull the label out; a bare id still works.
          const linked = parts[1].match(/^\[([^\]]+)\]/);
          const id = linked ? linked[1].trim() : parts[1];
          const schedule = parts[2];
          const cronUtc = parts[3].replace(/`/g, '');
          const codePath = parts[4].replace(/`/g, '');
          const status = parts[5];
          
          if (!id.startsWith('_')) {
             try {
                if (statSync(join(cronsRoot, id)).isDirectory()) {
                    result.layers.routines.push({
                      id,
                      name: id,
                      schedule,
                      cronUtc,
                      codePath,
                      status
                    });
                }
             } catch {}
          }
        }
      }
    }
  } catch (e) {
    result.warnings.push(`Failed to read routines from ${cronsRoot}: ${e.message}`);
  }

  // 4. Memory
  const addMemory = (path, role, scope) => {
    try {
      const st = statSync(path);
      if (st.isFile()) {
        result.layers.memory.push({
          path,
          role,
          bytes: st.size,
          mtime: st.mtimeMs,
          scope
        });
      }
    } catch { }
  };

  addMemory(join(repoRoot, 'CLAUDE.md'), 'always-loaded', 'repo');
  ['decisions.md', 'INFRA.md', 'VPS-CRONS.md', 'my-hosted-sites.md', 'README.md'].forEach(f => {
    addMemory(join(repoRoot, f), 'index', 'repo');
  });

  try {
    const ctxDir = join(repoRoot, 'context');
    const files = readdirSync(ctxDir);
    for (const f of files) {
      if (f.endsWith('.md')) {
        addMemory(join(ctxDir, f), 'context', 'repo');
      }
    }
  } catch { }

  for (const acct of result.accounts) {
    if (!acct.present) continue;
    const sanitizedRepo = repoRoot.replace(/\//g, '-');
    addMemory(join(acct.dir, 'projects', sanitizedRepo, 'memory', 'MEMORY.md'), 'auto-memory', 'user');
  }

  // 5. Skills
  const processSkillDir = (dirPath, source, accountId) => {
    try {
      const skills = readdirSync(dirPath, { withFileTypes: true });
      for (const skill of skills) {
        if (skill.isDirectory() || skill.isSymbolicLink()) {
           try {
             const skillMdPath = join(dirPath, skill.name, 'SKILL.md');
             const content = readFileSync(skillMdPath, 'utf8');
             const meta = readSkillMeta(content, skill.name);
             
             const usage = skillUses.get(meta.name);
             const uses = usage ? usage.uses : 0;
             const lastUsed = usage && usage.lastUsed ? new Date(usage.lastUsed).toISOString() : null;
             const disabled = disabledSkills.has(meta.name);
             
             let status = 'active';
             if (disabled) status = 'disabled';
             else if (uses === 0) status = 'unused';

             result.layers.skills.push({
               name: meta.name,
               source,
               account: accountId,
               uses,
               lastUsed,
               disabled,
               status,
               descChars: meta.name.length + meta.desc.length
             });
           } catch { }
        }
      }
    } catch { }
  };

  processSkillDir(join(repoRoot, '.claude', 'skills'), 'project', null);

  for (const acct of result.accounts) {
    if (!acct.present) continue;
    processSkillDir(join(acct.dir, 'skills'), 'user', acct.id);
  }

  return result;
}

let cache = { at: 0, data: null, inflight: null };

export async function getWorkspace(opts = {}) {
  if (opts.accounts) return scanWorkspace(opts);

  if (Date.now() - cache.at < 60000 && cache.data) {
    return cache.data;
  }

  if (cache.inflight) return cache.inflight;

  cache.inflight = scanWorkspace(opts).then((data) => {
    cache = { at: Date.now(), data, inflight: null };
    return data;
  }).catch((e) => {
    cache.inflight = null;
    throw e;
  });

  return cache.inflight;
}
