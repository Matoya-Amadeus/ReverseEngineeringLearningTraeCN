import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const IN = process.env.TRAE_AUTH_FINGERPRINT_LIVE_IN || path.join(ROOT, 'docs', 'provider-fingerprints.live.in.jsonl');
const OUT = process.env.TRAE_AUTH_FINGERPRINT_LIVE_OUT || path.join(ROOT, 'docs', 'provider-fingerprints.live.jsonl');

async function exists(p) {
  try {
    await access(p);
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

function normalize(row) {
  return {
    ts: String(row.ts || new Date().toISOString()),
    source: 'live',
    captureMode: String(row.captureMode || ''),
    provider: String(row.provider || ''),
    path: String(row.path || ''),
    method: String(row.method || 'POST'),
    hasToken: !!row.hasToken,
    requestId: String(row.requestId || ''),
    traceId: String(row.traceId || ''),
    dataKeys: Array.isArray(row.dataKeys) ? [...new Set(row.dataKeys.map((x) => String(x)).filter(Boolean))].sort() : [],
    headerKeys: Array.isArray(row.headerKeys) ? [...new Set(row.headerKeys.map((x) => String(x)).filter(Boolean))].sort() : [],
    missingDataKeys: Array.isArray(row.missingDataKeys) ? row.missingDataKeys : [],
    missingHeaderKeys: Array.isArray(row.missingHeaderKeys) ? row.missingHeaderKeys : []
  };
}

function dedupe(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = [row.provider, row.path, row.requestId || row.ts].join('|');
    map.set(key, row);
  }
  return [...map.values()];
}

async function main() {
  if (!(await exists(IN))) {
    console.log('LIVE_SKIP', IN, 'not found');
    return;
  }

  const incoming = parseJsonl(await readFile(IN, 'utf8')).map(normalize).filter((x) => x.provider && x.path);
  const existing = (await exists(OUT)) ? parseJsonl(await readFile(OUT, 'utf8')).map(normalize).filter((x) => x.provider && x.path) : [];

  const merged = dedupe([...existing, ...incoming]);
  const content = merged.map((x) => JSON.stringify(x)).join('\n') + (merged.length > 0 ? '\n' : '');
  await writeFile(OUT, content, 'utf8');

  console.log('LIVE_OK', OUT, 'records=' + merged.length, 'added=' + incoming.length);
}

main().catch((e) => {
  console.error('LIVE_FAIL', e.message);
  process.exit(1);
});
