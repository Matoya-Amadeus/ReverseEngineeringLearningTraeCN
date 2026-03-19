import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const EVIDENCE_DOC = process.env.TRAE_AUTH_EVIDENCE_DOC || path.join(ROOT, 'docs', 'Provider字段证据差异.md');
const REQUIRE = String(process.env.TRAE_AUTH_REQUIRE_LIVE_COVERAGE || '0') === '1';
const MIN = Number(process.env.TRAE_AUTH_LIVE_COVERAGE_MIN || '0');

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
      status: cells[11]
    });
  }
  return rows;
}

function countByStatus(rows) {
  const out = {
    total: rows.length,
    alignedWithLive: 0,
    alignedWithSeedOnly: 0,
    noCapture: 0,
    seedCaptureGap: 0,
    liveCaptureGap: 0,
    unknown: 0
  };

  for (const row of rows) {
    switch (row.status) {
      case 'aligned_with_live_capture':
        out.alignedWithLive += 1;
        break;
      case 'aligned_with_seed_only':
        out.alignedWithSeedOnly += 1;
        break;
      case 'no_capture':
        out.noCapture += 1;
        break;
      case 'seed_capture_gap':
        out.seedCaptureGap += 1;
        break;
      case 'live_capture_gap':
        out.liveCaptureGap += 1;
        break;
      default:
        out.unknown += 1;
        break;
    }
  }

  return out;
}

async function main() {
  const doc = await readFile(EVIDENCE_DOC, 'utf8');
  const rows = parseRows(doc);
  const stats = countByStatus(rows);

  const ratio = stats.total > 0 ? stats.alignedWithLive / stats.total : 0;

  console.log(
    'LIVE_COVERAGE',
    `doc=${EVIDENCE_DOC}`,
    `total=${stats.total}`,
    `aligned_live=${stats.alignedWithLive}`,
    `aligned_seed_only=${stats.alignedWithSeedOnly}`,
    `no_capture=${stats.noCapture}`,
    `seed_gap=${stats.seedCaptureGap}`,
    `live_gap=${stats.liveCaptureGap}`,
    `unknown=${stats.unknown}`,
    `ratio=${ratio.toFixed(4)}`,
    `require=${REQUIRE ? '1' : '0'}`,
    `min=${MIN}`
  );

  if (REQUIRE && ratio < MIN) {
    throw new Error(`live coverage ratio ${ratio.toFixed(4)} below min ${MIN}`);
  }

  console.log('LIVE_COVERAGE_OK');
}

main().catch((e) => {
  console.error('LIVE_COVERAGE_FAIL', e.message);
  process.exit(1);
});
