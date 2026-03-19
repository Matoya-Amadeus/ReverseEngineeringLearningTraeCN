import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const MATRIX_DOC = process.env.TRAE_AUTH_MATRIX_DOC || path.join(ROOT, 'docs', 'Provider路由对齐矩阵.md');
const LIVE_FILE = process.env.TRAE_AUTH_FINGERPRINT_LIVE_OUT || path.join(ROOT, 'docs', 'provider-fingerprints.live.jsonl');
const OUT_DOC = process.env.TRAE_AUTH_REAL_BACKLOG_DOC || path.join(ROOT, 'docs', '真实抓包待办清单.md');
const REAL_MODES = new Set(
  String(process.env.TRAE_AUTH_REAL_CAPTURE_MODES || 'har-import,real-har,proxy-capture')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
);

function parseMatrix(md) {
  const rows = [];
  for (const line of md.split('\n')) {
    if (!line.startsWith('| ')) continue;
    if (line.includes('| --- |')) continue;
    const cells = line.split('|').map((x) => x.trim());
    if (cells.length < 8) continue;
    if (cells[1] === 'Provider') continue;
    rows.push({ provider: cells[1], path: cells[2] });
  }
  return rows;
}

function parseJsonl(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      rows.push(JSON.parse(t));
    } catch {
      // ignore malformed rows
    }
  }
  return rows;
}

function isBootstrap(row) {
  return String(row?.captureMode || '').toLowerCase().includes('bootstrap');
}

function isRealQualified(row) {
  if (isBootstrap(row)) return false;
  const mode = String(row?.captureMode || '').toLowerCase();
  const evidence = String(row?.captureEvidence || '').toLowerCase();
  return REAL_MODES.has(mode) || (evidence === 'har' && mode === 'har-import');
}

function routeKey(provider, pathValue) {
  return `${provider} ${pathValue}`;
}

function buildDoc(matrixRows, missingRows, realCovered, bootstrapOnly) {
  const total = matrixRows.length;
  const ratio = total > 0 ? realCovered / total : 0;

  const lines = [];
  lines.push('# Real Capture Backlog');
  lines.push('');
  lines.push('Date: 2026-03-18');
  lines.push(`Matrix Source: ${MATRIX_DOC}`);
  lines.push(`Live Source: ${LIVE_FILE}`);
  lines.push(`Total Routes: ${total}`);
  lines.push(`Real Covered: ${realCovered}`);
  lines.push(`Bootstrap Only: ${bootstrapOnly}`);
  lines.push(`Real Coverage Ratio: ${ratio.toFixed(4)}`);
  lines.push('');

  lines.push('## Missing Real Captures');
  if (missingRows.length === 0) {
    lines.push('- No missing real capture route.');
  } else {
    for (let i = 0; i < missingRows.length; i += 1) {
      const r = missingRows[i];
      lines.push(`${i + 1}. ${r.provider} ${r.path}`);
    }
  }
  lines.push('');

  lines.push('## Suggested Next Command');
  lines.push('1. TRAE_AUTH_HAR_FILE=<your-real.har> TRAE_AUTH_REQUIRE_REAL_HAR=1 node replay/promote-real-capture-batch.mjs');
  lines.push('2. node tests/auth/run-real-live-quality-strict-check.mjs');

  return lines.join('\n');
}

async function main() {
  const matrixRows = parseMatrix(await readFile(MATRIX_DOC, 'utf8'));
  const liveRows = parseJsonl(await readFile(LIVE_FILE, 'utf8'));

  const state = new Map();
  for (const row of liveRows) {
    const key = routeKey(row.provider, row.path);
    const prev = state.get(key) || { real: false, bootstrap: false };
    if (isRealQualified(row)) prev.real = true;
    else if (isBootstrap(row)) prev.bootstrap = true;
    state.set(key, prev);
  }

  const missing = [];
  let realCovered = 0;
  let bootstrapOnly = 0;
  for (const row of matrixRows) {
    const s = state.get(routeKey(row.provider, row.path)) || { real: false, bootstrap: false };
    if (s.real) realCovered += 1;
    else {
      if (s.bootstrap) bootstrapOnly += 1;
      missing.push(row);
    }
  }

  const doc = buildDoc(matrixRows, missing, realCovered, bootstrapOnly);
  await writeFile(OUT_DOC, doc, 'utf8');

  console.log('REAL_BACKLOG_OK', OUT_DOC, `missing=${missing.length}`, `real=${realCovered}`);
}

main().catch((e) => {
  console.error('REAL_BACKLOG_FAIL', e.message);
  process.exit(1);
});
