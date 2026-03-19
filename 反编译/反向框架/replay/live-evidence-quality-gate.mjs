import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const MATRIX_DOC = process.env.TRAE_AUTH_MATRIX_DOC || path.join(ROOT, 'docs', 'Provider路由对齐矩阵.md');
const LIVE_FILE = process.env.TRAE_AUTH_FINGERPRINT_LIVE_OUT || path.join(ROOT, 'docs', 'provider-fingerprints.live.jsonl');
const REQUIRE_REAL = String(process.env.TRAE_AUTH_REQUIRE_REAL_LIVE_COVERAGE || '0') === '1';
const MIN_REAL = Number(process.env.TRAE_AUTH_REAL_LIVE_COVERAGE_MIN || '0');
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
  const mode = String(row?.captureMode || '').toLowerCase();
  return mode.includes('bootstrap');
}

function isRealQualified(row) {
  if (isBootstrap(row)) return false;
  const mode = String(row?.captureMode || '').toLowerCase();
  const evidence = String(row?.captureEvidence || '').toLowerCase();
  if (REAL_MODES.has(mode)) return true;
  if (evidence === 'har' && mode === 'har-import') return true;
  return false;
}

async function main() {
  const matrixRows = parseMatrix(await readFile(MATRIX_DOC, 'utf8'));
  const liveRows = parseJsonl(await readFile(LIVE_FILE, 'utf8'));

  const byRoute = new Map();
  for (const row of liveRows) {
    const key = `${row.provider} ${row.path}`;
    const prev = byRoute.get(key) || { any: false, real: false, bootstrap: false };
    prev.any = true;
    if (isRealQualified(row)) prev.real = true;
    else if (isBootstrap(row)) prev.bootstrap = true;
    byRoute.set(key, prev);
  }

  let realCovered = 0;
  let bootstrapOnly = 0;
  let noLive = 0;

  for (const route of matrixRows) {
    const state = byRoute.get(`${route.provider} ${route.path}`);
    if (!state || !state.any) {
      noLive += 1;
      continue;
    }
    if (state.real) realCovered += 1;
    else if (state.bootstrap) bootstrapOnly += 1;
  }

  const totalRoutes = matrixRows.length;
  const realRatio = totalRoutes > 0 ? realCovered / totalRoutes : 0;

  console.log(
    'LIVE_QUALITY',
    `matrix=${MATRIX_DOC}`,
    `live=${LIVE_FILE}`,
    `total=${totalRoutes}`,
    `real_covered=${realCovered}`,
    `bootstrap_only=${bootstrapOnly}`,
    `no_live=${noLive}`,
    `real_ratio=${realRatio.toFixed(4)}`,
    `require_real=${REQUIRE_REAL ? '1' : '0'}`,
    `min_real=${MIN_REAL}`,
    `real_modes=${[...REAL_MODES].join(',')}`
  );

  if (REQUIRE_REAL && realRatio < MIN_REAL) {
    throw new Error(`real live coverage ratio ${realRatio.toFixed(4)} below min ${MIN_REAL}`);
  }

  console.log('LIVE_QUALITY_OK');
}

main().catch((e) => {
  console.error('LIVE_QUALITY_FAIL', e.message);
  process.exit(1);
});
