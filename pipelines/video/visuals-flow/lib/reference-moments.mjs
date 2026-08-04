import fs from 'node:fs';

export const SCENE_THRESHOLD = 0.25;
export const LUMA_DELTA = 22;
export const CLUSTER_GAP = 1.5;
export const SHEET_HALF = 0.7;

export function parseSceneLog(text) {
  const result = [];
  const lines = text.split('\n');
  let currentT = null;
  
  for (const line of lines) {
    const ptsMatch = line.match(/pts_time:([\d\.]+)/);
    if (ptsMatch) {
      currentT = parseFloat(ptsMatch[1]);
    }
    
    const scoreMatch = line.match(/lavfi\.scene_score=([\d\.]+)/);
    if (scoreMatch && currentT !== null) {
      result.push({ t: currentT, score: parseFloat(scoreMatch[1]) });
      currentT = null;
    }
  }
  return result;
}

export function parseLumaCsv(text) {
  const result = [];
  const lines = text.trim().split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length >= 2) {
      result.push({ t: parseFloat(parts[0]), yavg: parseFloat(parts[1]) });
    }
  }
  return result;
}

export function lumaSpikes(rows, { delta }) {
  const spikes = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    const jump = Math.abs(curr.yavg - prev.yavg);
    if (jump >= delta) {
      spikes.push({ t: curr.t, jump });
    }
  }
  return spikes;
}

export function clusterMoments(scenes, spikes, { gap }) {
  // Combine all raw moments
  const all = [
    ...scenes.map(s => ({ t: s.t, kind: 'cut', val: s.score })),
    ...spikes.map(s => ({ t: s.t, kind: 'flash', val: s.jump }))
  ];
  
  all.sort((a, b) => a.t - b.t);
  
  if (all.length === 0) return [];
  
  const clusters = [];
  let currentCluster = [all[0]];
  
  for (let i = 1; i < all.length; i++) {
    const curr = all[i];
    const lastInCluster = currentCluster[currentCluster.length - 1];
    
    if (curr.t - lastInCluster.t <= gap) {
      currentCluster.push(curr);
    } else {
      clusters.push(currentCluster);
      currentCluster = [curr];
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }
  
  const result = clusters.map(cluster => {
    // Use the earliest time in the cluster
    const t = cluster[0].t;
    const kindsSet = new Set(cluster.map(x => x.kind));
    const kinds = Array.from(kindsSet).sort();
    const score = Math.max(...cluster.map(x => x.val));
    
    return { t, kinds, score };
  });
  
  // Sort descending by score for ranking
  result.sort((a, b) => b.score - a.score);
  return result;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.includes('--cli')) return;
  
  let sceneLogPath, lumaCsvPath, outPath;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scene-log') sceneLogPath = args[i + 1];
    if (args[i] === '--luma-csv') lumaCsvPath = args[i + 1];
    if (args[i] === '--out') outPath = args[i + 1];
  }
  
  if (!sceneLogPath || !lumaCsvPath || !outPath) {
    console.error('Usage: node lib/reference-moments.mjs --cli --scene-log <f> --luma-csv <f> --out <f>');
    process.exit(1);
  }
  
  const sceneText = fs.readFileSync(sceneLogPath, 'utf8');
  const lumaText = fs.readFileSync(lumaCsvPath, 'utf8');
  
  const scenes = parseSceneLog(sceneText);
  const lumaRows = parseLumaCsv(lumaText);
  const spikes = lumaSpikes(lumaRows, { delta: LUMA_DELTA });
  
  const moments = clusterMoments(scenes, spikes, { gap: CLUSTER_GAP });
  
  fs.writeFileSync(outPath, JSON.stringify(moments, null, 2));
}

main();
