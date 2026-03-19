import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const doc = await readFile(`${ROOT}/docs/Provider路由对齐矩阵.md`, 'utf8');

  assert(doc.includes('Provider Route Alignment Matrix'), 'matrix title missing');
  assert(doc.includes('/cloudide/api/v3/trae/oauth/ExchangeToken'), 'exchange token path missing');
  assert(doc.includes('/cloudide/api/v3/trae/GenerateTempToken'), 'generate temp token path missing');
  assert(doc.includes('/api/v2/GetUserToken'), 'bytedance token path missing');
  assert(doc.includes('buildBytedanceTokenPayload'), 'bytedance payload builder mapping missing');
  assert(doc.includes('buildGenerateTempTokenPayload'), 'temp token payload builder mapping missing');
  assert(doc.includes('TRAE_AUTH_FINGERPRINT_FILE'), 'fingerprint env note missing');
  assert(doc.includes('Evidence Level'), 'evidence level column missing');
  assert(doc.includes('inferred-high-fidelity'), 'inferred evidence marker missing');

  console.log('TEST_OK alignment_matrix_doc_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL alignment_matrix_doc_contract', e.message);
  process.exit(1);
});
