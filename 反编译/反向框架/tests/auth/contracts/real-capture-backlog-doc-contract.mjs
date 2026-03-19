import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const doc = await readFile(`${ROOT}/docs/真实抓包待办清单.md`, 'utf8');

  assert(doc.includes('Real Capture Backlog'), 'backlog title missing');
  assert(doc.includes('Missing Real Captures'), 'missing section missing');
  assert(doc.includes('Real Coverage Ratio:'), 'coverage ratio line missing');
  assert(doc.includes('TRAE_AUTH_HAR_FILE=<your-real.har>'), 'suggested command missing');

  console.log('TEST_OK real_capture_backlog_doc_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL real_capture_backlog_doc_contract', e.message);
  process.exit(1);
});
