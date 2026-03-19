import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const LIVE_IN = process.env.TRAE_AUTH_FINGERPRINT_LIVE_IN || path.join(ROOT, 'docs', 'provider-fingerprints.live.in.jsonl');
const REAL_IN = process.env.TRAE_AUTH_FINGERPRINT_LIVE_REAL_IN || path.join(ROOT, 'docs', 'provider-fingerprints.live.real.in.jsonl');

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
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
  const mode = String(row?.captureMode || '').toLowerCase();
  return mode.includes('bootstrap');
}

function keyOf(row) {
  return `${String(row.provider || '')} ${String(row.path || '')}`;
}

function normalizeReal(row) {
  return {
    ...row,
    source: 'live',
    captureMode: String(row.captureMode || 'real-import')
  };
}

function dedupe(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = [row.provider, row.path, row.requestId || row.ts || ''].join('|');
    map.set(key, row);
  }
  return [...map.values()];
}

async function main() {
  if (!(await exists(LIVE_IN))) {
    throw new Error(`live input not found: ${LIVE_IN}`);
  }
  if (!(await exists(REAL_IN))) {
    console.log('REAL_REPLACE_SKIP', REAL_IN, 'not found');
    return;
  }

  const baseRows = parseJsonl(await readFile(LIVE_IN, 'utf8'));
  const realRowsRaw = parseJsonl(await readFile(REAL_IN, 'utf8'));
  const realRows = realRowsRaw.map(normalizeReal).filter((x) => x.provider && x.path);

  const realRouteSet = new Set(realRows.map((x) => keyOf(x)));

  const kept = baseRows.filter((row) => {
    const routeKey = keyOf(row);
    if (!realRouteSet.has(routeKey)) return true;
    return !isBootstrap(row);
  });

  const merged = dedupe([...kept, ...realRows]);
  const content = merged.map((x) => JSON.stringify(x)).join('\n') + (merged.length > 0 ? '\n' : '');
  await writeFile(LIVE_IN, content, 'utf8');

  console.log(
    'REAL_REPLACE_OK',
    LIVE_IN,
    `base=${baseRows.length}`,
    `real=${realRows.length}`,
    `routes=${realRouteSet.size}`,
    `result=${merged.length}`
  );
}

main().catch((e) => {
  console.error('REAL_REPLACE_FAIL', e.message);
  process.exit(1);
});
