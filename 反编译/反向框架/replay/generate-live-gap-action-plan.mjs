import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const EVIDENCE_DOC = path.join(ROOT, 'docs', 'Provider字段证据差异.md');
const OUT_DOC = path.join(ROOT, 'docs', '在线差距行动计划.md');

const PROVIDER_FILES = {
  marscode: 'src/auth/providers/marscode-provider.ts',
  saas: 'src/auth/providers/saas-provider.ts',
  bytedance: 'src/auth/providers/bytedance-provider.ts'
};

function parseRows(md) {
  const rows = [];
  for (const line of md.split('\n')) {
    if (!line.startsWith('| ')) continue;
    if (line.includes('| --- |')) continue;

    const cells = line.split('|').map((x) => x.trim());
    if (cells.length < 12) continue;
    if (cells[1] === 'Provider') continue;

    rows.push({
      provider: cells[1],
      path: cells[2],
      captureSource: cells[3],
      captureCount: Number(cells[4] || 0),
      missingData: cells[7],
      missingHeaders: cells[10],
      status: cells[11]
    });
  }
  return rows;
}

function group(rows, predicate) {
  return rows.filter(predicate).sort((a, b) => {
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
    return a.path.localeCompare(b.path);
  });
}

function toTaskLine(row, idx) {
  const providerFile = PROVIDER_FILES[row.provider] || 'src/auth/providers/network/request-template.ts';
  const missingData = row.missingData && row.missingData !== '(none)' ? row.missingData : '(none)';
  const missingHeaders = row.missingHeaders && row.missingHeaders !== '(none)' ? row.missingHeaders : '(none)';
  return [
    `${idx + 1}. ${row.provider} ${row.path}`,
    `   - status: ${row.status} / captureSource: ${row.captureSource}`,
    `   - missingData: ${missingData}`,
    `   - missingHeaders: ${missingHeaders}`,
    `   - target file: ${providerFile}`
  ].join('\n');
}

function buildDoc(rows) {
  const total = rows.length;
  const liveAligned = rows.filter((x) => x.status === 'aligned_with_live_capture');
  const seedOnly = group(rows, (x) => x.status === 'aligned_with_seed_only');
  const noCapture = group(rows, (x) => x.status === 'no_capture');
  const gaps = group(rows, (x) => x.status === 'seed_capture_gap' || x.status === 'live_capture_gap');

  const lines = [];
  lines.push('# Live Gap Action Plan');
  lines.push('');
  lines.push('Date: 2026-03-18');
  lines.push(`Evidence Source: ${EVIDENCE_DOC}`);
  lines.push(`Total Routes: ${total}`);
  lines.push(`Live Aligned: ${liveAligned.length}`);
  lines.push(`Seed Only: ${seedOnly.length}`);
  lines.push(`No Capture: ${noCapture.length}`);
  lines.push(`Gap Routes: ${gaps.length}`);
  lines.push('');

  lines.push('## Priority A (Fix Functional Gaps First)');
  if (gaps.length === 0) {
    lines.push('- No functional gap route is currently reported.');
  } else {
    for (let i = 0; i < gaps.length; i += 1) lines.push(toTaskLine(gaps[i], i));
  }
  lines.push('');

  lines.push('## Priority B (Convert Seed-Only to Live Coverage)');
  if (seedOnly.length === 0) {
    lines.push('- No seed-only route remains.');
  } else {
    for (let i = 0; i < seedOnly.length; i += 1) lines.push(toTaskLine(seedOnly[i], i));
  }
  lines.push('');

  lines.push('## Priority C (Missing Capture Collection)');
  if (noCapture.length === 0) {
    lines.push('- No route is in no_capture state.');
  } else {
    for (let i = 0; i < noCapture.length; i += 1) lines.push(toTaskLine(noCapture[i], i));
  }
  lines.push('');

  lines.push('## Next Commands');
  lines.push('1. node replay/import-live-fingerprints-from-har.mjs');
  lines.push('2. node replay/register-live-fingerprint-captures.mjs');
  lines.push('3. node replay/analyze-fingerprint-evidence.mjs');
  lines.push('4. node replay/live-evidence-coverage-gate.mjs');
  lines.push('5. node tests/auth/run-live-coverage-strict-check.mjs');
  lines.push('');

  lines.push('## Note');
  lines.push('- This plan is auto-generated from evidence diff and should be refreshed after each live import batch.');

  return lines.join('\n');
}

async function main() {
  const evidence = await readFile(EVIDENCE_DOC, 'utf8');
  const rows = parseRows(evidence);
  const doc = buildDoc(rows);
  await writeFile(OUT_DOC, doc, 'utf8');
  console.log('LIVE_GAP_PLAN_OK', OUT_DOC, `rows=${rows.length}`);
}

main().catch((e) => {
  console.error('LIVE_GAP_PLAN_FAIL', e.message);
  process.exit(1);
});
