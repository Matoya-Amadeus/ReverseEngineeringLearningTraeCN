import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const doc = await readFile(`${ROOT}/docs/在线差距行动计划.md`, 'utf8');

  assert(doc.includes('Live Gap Action Plan'), 'plan title missing');
  assert(doc.includes('Priority A (Fix Functional Gaps First)'), 'priority A section missing');
  assert(doc.includes('Priority B (Convert Seed-Only to Live Coverage)'), 'priority B section missing');
  assert(doc.includes('Priority C (Missing Capture Collection)'), 'priority C section missing');

  const hasRouteTask =
    doc.includes('/cloudide/api/v3/trae/GetUserInfo') ||
    doc.includes('/api/v2/GetUserToken') ||
    doc.includes('/cloudide/api/v3/trae/oauth/ExchangeToken');
  const noSeedOnlyLeft = doc.includes('No seed-only route remains.');
  assert(hasRouteTask || noSeedOnlyLeft, 'priority B should contain route tasks or explicit no-seed-only marker');

  assert(doc.includes('node tests/auth/run-live-coverage-strict-check.mjs'), 'next command section missing strict check');

  console.log('TEST_OK live_gap_plan_doc_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL live_gap_plan_doc_contract', e.message);
  process.exit(1);
});
