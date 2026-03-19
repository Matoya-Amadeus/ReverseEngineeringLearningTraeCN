import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const mars = await readFile(`${ROOT}/src/auth/providers/marscode-provider.ts`, 'utf8');
  const saas = await readFile(`${ROOT}/src/auth/providers/saas-provider.ts`, 'utf8');
  const byted = await readFile(`${ROOT}/src/auth/providers/bytedance-provider.ts`, 'utf8');

  assert(mars.includes('this.protocol.request'), 'marscode provider must call protocol requester');
  assert(saas.includes('this.protocol.request'), 'saas provider must call protocol requester');
  assert(byted.includes('this.protocol.request'), 'bytedance provider must call protocol requester');

  assert(mars.includes('generateTempToken'), 'marscode provider temp token branch missing');
  assert(saas.includes('checkToken'), 'saas checkToken branch missing');
  assert(byted.includes('GetUserNativeRegion'), 'bytedance region branch missing');

  console.log('TEST_OK provider_protocol_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL provider_protocol_contract', e.message);
  process.exit(1);
});
