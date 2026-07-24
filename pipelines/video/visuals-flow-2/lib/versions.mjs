import fs from 'node:fs';
import path from 'node:path';

export function nextLabel(versionsJson) {
  const versions = versionsJson?.versions || [];
  let max = 0;
  for (const v of versions) {
    const match = v.label.match(/^v(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return `v${max + 1}`;
}

export function registerVersion(kbWorkdir, finalMp4Path, { label, draft = false } = {}) {
  const versionsJsonPath = path.join(kbWorkdir, 'versions.json');
  const versionsDir = path.join(kbWorkdir, 'versions');
  
  if (!fs.existsSync(versionsDir)) {
    fs.mkdirSync(versionsDir, { recursive: true });
  }

  let versionsJson = { versions: [] };
  if (fs.existsSync(versionsJsonPath)) {
    try {
      versionsJson = JSON.parse(fs.readFileSync(versionsJsonPath, 'utf8'));
    } catch (e) {
      // ignore
    }
  }

  const finalLabel = label || nextLabel(versionsJson);
  const destFile = `versions/${finalLabel}.mp4`;
  const destPath = path.join(kbWorkdir, destFile);

  fs.copyFileSync(finalMp4Path, destPath);

  const existingIdx = versionsJson.versions.findIndex(v => v.label === finalLabel);
  const entry = {
    label: finalLabel,
    file: destFile,
    created: new Date().toISOString(),
    draft: !!draft
  };

  if (existingIdx !== -1) {
    versionsJson.versions[existingIdx] = entry;
  } else {
    versionsJson.versions.push(entry);
  }

  fs.writeFileSync(versionsJsonPath, JSON.stringify(versionsJson, null, 2));
  return entry;
}
