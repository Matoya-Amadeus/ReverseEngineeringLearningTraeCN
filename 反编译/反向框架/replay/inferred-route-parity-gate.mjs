import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const REGISTER = process.env.TRAE_AUTH_INFERRED_REGISTER || path.join(ROOT, 'docs', '推断路由登记表.md');
const REQUIRE_MARKED = String(process.env.TRAE_AUTH_REQUIRE_INFERRED_MARKING || '1') === '1';

function parseRegister(md) {
  const rows = [];
  for (const line of md.split('\n')) {
    if (!line.startsWith('| ')) continue;
    if (line.includes('| --- |')) continue;
    const cells = line.split('|').map((x) => x.trim());
    if (cells.length < 10) continue;
    if (cells[1] === '#') continue;
    rows.push({
      provider: cells[2],
      path: cells[3],
      coverageState: cells[4],
      reconstructionMode: cells[5],
      evidenceLevel: cells[7]
    });
  }
  return rows;
}

async function main() {
  const rows = parseRegister(await readFile(REGISTER, 'utf8'));

  let inferredNeeded = 0;
  let inferredMarked = 0;

  for (const row of rows) {
    const unresolved = row.coverageState === 'bootstrap-only' || row.coverageState === 'no-live-capture';
    if (!unresolved) continue;
    inferredNeeded += 1;
    const isMarked = row.reconstructionMode === 'inferred-high-fidelity' && String(row.evidenceLevel).includes('inferred');
    if (isMarked) inferredMarked += 1;
  }

  console.log(
    'INFERRED_PARITY',
    `register=${REGISTER}`,
    `routes=${rows.length}`,
    `inferred_needed=${inferredNeeded}`,
    `inferred_marked=${inferredMarked}`,
    `require_marked=${REQUIRE_MARKED ? '1' : '0'}`
  );

  if (REQUIRE_MARKED && inferredMarked < inferredNeeded) {
    throw new Error(`inferred route marking incomplete ${inferredMarked}/${inferredNeeded}`);
  }

  console.log('INFERRED_PARITY_OK');
}

main().catch((e) => {
  console.error('INFERRED_PARITY_FAIL', e.message);
  process.exit(1);
});
