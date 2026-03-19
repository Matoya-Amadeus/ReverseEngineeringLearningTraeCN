import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const MATRIX_DOC = path.join(ROOT, 'docs', 'Provider路由对齐矩阵.md');
const OUT_DOC = path.join(ROOT, 'docs', 'Provider字段证据差异.md');
const SEED_FILE = process.env.TRAE_AUTH_FINGERPRINT_FILE || path.join(ROOT, 'docs', 'provider-fingerprints.jsonl');
const LIVE_FILE = process.env.TRAE_AUTH_FINGERPRINT_LIVE_OUT || path.join(ROOT, 'docs', 'provider-fingerprints.live.jsonl');

function parseMatrix(md) {
  const lines = md.split('\n');
  const routes = [];

  for (const line of lines) {
    if (!line.startsWith('| ')) continue;
    if (line.includes('| --- |')) continue;

    const cells = line.split('|').map((x) => x.trim());
    if (cells.length < 8) continue;
    if (cells[1] === 'Provider') continue;

    routes.push({
      provider: cells[1],
      path: cells[2],
      requiredData: splitKeys(cells[3]),
      requiredHeaders: splitKeys(cells[4])
    });
  }

  return routes;
}

function splitKeys(raw) {
  const text = String(raw || '');
  if (!text || text === '(none required by rule)') return [];
  return text.split(',').map((x) => x.trim()).filter(Boolean);
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJsonl(file) {
  if (!(await exists(file))) return [];
  const content = await readFile(file, 'utf8');
  const rows = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      // ignore malformed lines
    }
  }
  return rows;
}

function aggregate(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.provider + ' ' + row.path;
    if (!map.has(key)) {
      map.set(key, {
        dataKeys: new Set(),
        headerKeys: new Set(),
        count: 0
      });
    }

    const item = map.get(key);
    item.count += 1;
    for (const k of row.dataKeys || []) item.dataKeys.add(k);
    for (const k of row.headerKeys || []) item.headerKeys.add(k);
  }
  return map;
}

function missing(required, observedSet) {
  return required.filter((k) => !observedSet.has(k));
}

function formatSet(setObj) {
  const list = [...setObj].sort();
  return list.length > 0 ? list.join(', ') : '(none)';
}

function pickObserved(live, seed) {
  if (live) {
    return { source: 'live', dataKeys: live.dataKeys, headerKeys: live.headerKeys, count: live.count };
  }
  if (seed) {
    return { source: 'seed', dataKeys: seed.dataKeys, headerKeys: seed.headerKeys, count: seed.count };
  }
  return { source: 'none', dataKeys: new Set(), headerKeys: new Set(), count: 0 };
}

function statusOf(source, missingData, missingHeaders) {
  if (source === 'none') return 'no_capture';
  if (missingData.length === 0 && missingHeaders.length === 0) {
    return source === 'live' ? 'aligned_with_live_capture' : 'aligned_with_seed_only';
  }
  return source === 'live' ? 'live_capture_gap' : 'seed_capture_gap';
}

function buildDoc(routes, liveMap, seedMap, sourcePaths) {
  const lines = [];
  lines.push('# Provider Field Evidence Diff');
  lines.push('');
  lines.push('Date: 2026-03-18');
  lines.push('Seed Source: ' + sourcePaths.seed);
  lines.push('Live Source: ' + sourcePaths.live);
  lines.push('');
  lines.push('| Provider | Path | Capture Source | Capture Count | Required Data | Observed Data | Missing Data | Required Headers | Observed Headers | Missing Headers | Status |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const route of routes) {
    const key = route.provider + ' ' + route.path;
    const observed = pickObserved(liveMap.get(key), seedMap.get(key));

    const missingData = missing(route.requiredData, observed.dataKeys);
    const missingHeaders = missing(route.requiredHeaders, observed.headerKeys);
    const status = statusOf(observed.source, missingData, missingHeaders);

    lines.push(
      '| ' +
        route.provider +
        ' | ' +
        route.path +
        ' | ' +
        observed.source +
        ' | ' +
        observed.count +
        ' | ' +
        (route.requiredData.join(', ') || '(none)') +
        ' | ' +
        formatSet(observed.dataKeys) +
        ' | ' +
        (missingData.join(', ') || '(none)') +
        ' | ' +
        (route.requiredHeaders.join(', ') || '(none)') +
        ' | ' +
        formatSet(observed.headerKeys) +
        ' | ' +
        (missingHeaders.join(', ') || '(none)') +
        ' | ' +
        status +
        ' |'
    );
  }

  lines.push('');
  lines.push('## Notes');
  lines.push('- Status priority is live > seed > none.');
  lines.push('- `aligned_with_seed_only` means currently aligned but still waiting for live capture evidence.');
  lines.push('- Feed live captures by placing JSONL rows into `provider-fingerprints.live.in.jsonl` then run `replay/register-live-fingerprint-captures.mjs`.');
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const matrix = await readFile(MATRIX_DOC, 'utf8');
  const routes = parseMatrix(matrix);

  const seedRows = await readJsonl(SEED_FILE);
  const liveRows = await readJsonl(LIVE_FILE);

  const seedMap = aggregate(seedRows);
  const liveMap = aggregate(liveRows);

  const doc = buildDoc(routes, liveMap, seedMap, { seed: SEED_FILE, live: LIVE_FILE });
  await writeFile(OUT_DOC, doc, 'utf8');

  console.log('EVIDENCE_OK', OUT_DOC, 'rows=' + routes.length, 'seed=' + seedRows.length, 'live=' + liveRows.length);
}

main().catch((e) => {
  console.error('EVIDENCE_FAIL', e.message);
  process.exit(1);
});
