import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const MATRIX_DOC = process.env.TRAE_AUTH_MATRIX_DOC || path.join(ROOT, 'docs', 'Provider路由对齐矩阵.md');
const LIVE_FILE = process.env.TRAE_AUTH_FINGERPRINT_LIVE_OUT || path.join(ROOT, 'docs', 'provider-fingerprints.live.jsonl');
const OUT_DOC = path.join(ROOT, 'docs', '推断路由登记表.md');
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
    if (cells.length < 10) continue;
    if (cells[1] === 'Provider') continue;
    rows.push({
      provider: cells[1],
      path: cells[2],
      payloadBuilder: cells[5],
      ruleType: cells[6],
      evidenceLevel: cells[7],
      status: cells[8],
      note: cells[9]
    });
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

function isReal(row) {
  if (isBootstrap(row)) return false;
  const mode = String(row?.captureMode || '').toLowerCase();
  const evidence = String(row?.captureEvidence || '').toLowerCase();
  return REAL_MODES.has(mode) || (evidence === 'har' && mode === 'har-import');
}

function buildState(liveRows) {
  const byRoute = new Map();
  for (const row of liveRows) {
    const key = `${row.provider} ${row.path}`;
    const prev = byRoute.get(key) || { any: false, real: false, bootstrap: false };
    prev.any = true;
    if (isReal(row)) prev.real = true;
    else if (isBootstrap(row)) prev.bootstrap = true;
    byRoute.set(key, prev);
  }
  return byRoute;
}

function formatRows(matrixRows, byRoute) {
  return matrixRows.map((r, idx) => {
    const state = byRoute.get(`${r.provider} ${r.path}`) || { any: false, real: false, bootstrap: false };
    const coverageState = state.real ? 'real-captured' : state.bootstrap ? 'bootstrap-only' : 'no-live-capture';
    const reconstructionMode = state.real ? 'evidence-backed' : 'inferred-high-fidelity';
    return `| ${idx + 1} | ${r.provider} | ${r.path} | ${coverageState} | ${reconstructionMode} | ${r.payloadBuilder} | ${r.evidenceLevel} | ${r.note || '-'} |`;
  });
}

async function main() {
  const matrix = parseMatrix(await readFile(MATRIX_DOC, 'utf8'));
  const liveRows = parseJsonl(await readFile(LIVE_FILE, 'utf8'));
  const byRoute = buildState(liveRows);

  const lines = [
    '# Inferred Route Register',
    '',
    'Date: 2026-03-18',
    `Matrix Source: ${MATRIX_DOC}`,
    `Live Source: ${LIVE_FILE}`,
    '',
    'This register marks routes that are currently reconstructed via high-fidelity inference (decompiled pseudo-code + replay) and should be promoted to real-captured evidence later.',
    '',
    '| # | Provider | Path | Coverage State | Reconstruction Mode | Payload Builder | Evidence Level | Note |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...formatRows(matrix, byRoute),
    '',
    '## Promotion Rule',
    '- If `Coverage State=bootstrap-only` or `no-live-capture`, keep `Reconstruction Mode=inferred-high-fidelity` and preserve explicit note.',
    '- Once real HAR evidence exists, update capture records and regenerate docs to move route to `evidence-backed`.',
    ''
  ];

  await writeFile(OUT_DOC, lines.join('\n'), 'utf8');
  const inferredCount = formatRows(matrix, byRoute).filter((line) => line.includes('| inferred-high-fidelity |')).length;
  console.log('INFERRED_REGISTER_OK', OUT_DOC, `routes=${matrix.length}`, `inferred=${inferredCount}`);
}

main().catch((e) => {
  console.error('INFERRED_REGISTER_FAIL', e.message);
  process.exit(1);
});
