import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const doc = await readFile(`${ROOT}/docs/Provider字段证据差异.md`, 'utf8');

  assert(doc.includes('Provider Field Evidence Diff'), 'evidence diff title missing');
  assert(doc.includes('Seed Source:'), 'seed source line missing');
  assert(doc.includes('Live Source:'), 'live source line missing');
  assert(doc.includes('/cloudide/api/v3/trae/oauth/ExchangeToken'), 'exchange route row missing');
  assert(doc.includes('/api/v2/GetUserToken'), 'bytedance route row missing');
  assert(
    doc.includes('aligned_with_seed_only') ||
      doc.includes('aligned_with_live_capture') ||
      doc.includes('no_capture') ||
      doc.includes('seed_capture_gap') ||
      doc.includes('live_capture_gap'),
    'status markers missing'
  );

  console.log('TEST_OK evidence_diff_doc_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL evidence_diff_doc_contract', e.message);
  process.exit(1);
});
