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
  const tpl = await readFile(`${ROOT}/src/auth/providers/network/request-template.ts`, 'utf8');

  assert(tpl.includes('buildExchangeTokenPayload'), 'request template should define exchange payload builder');
  assert(tpl.includes('buildUserInfoPayload'), 'request template should define user info payload builder');
  assert(tpl.includes('buildCheckLoginPayload'), 'request template should define check login payload builder');
  assert(tpl.includes('buildBytedanceTokenPayload'), 'request template should define bytedance token payload builder');
  assert(tpl.includes('buildBytedanceRegionPayload'), 'request template should define bytedance region payload builder');
  assert(tpl.includes('buildGenerateTempTokenPayload'), 'request template should define temp token payload builder');

  assert(mars.includes('buildExchangeTokenPayload'), 'marscode provider should use exchange payload template');
  assert(mars.includes('buildCheckLoginPayload'), 'marscode provider should use check-login payload template');
  assert(mars.includes('buildGenerateTempTokenPayload'), 'marscode provider should use temp-token payload template');
  assert(mars.includes('buildProtocolHint'), 'marscode provider should pass protocol hint');

  assert(saas.includes('buildExchangeTokenPayload'), 'saas provider should use exchange payload template');
  assert(saas.includes('buildCheckLoginPayload'), 'saas provider should use check-login payload template');
  assert(saas.includes('buildProtocolHint'), 'saas provider should pass protocol hint');

  assert(byted.includes('buildBytedanceTokenPayload'), 'bytedance provider should use token payload template');
  assert(byted.includes('buildBytedanceRegionPayload'), 'bytedance provider should use region payload template');
  assert(byted.includes('buildProtocolHint'), 'bytedance provider should pass protocol hint');

  console.log('TEST_OK provider_payload_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL provider_payload_contract', e.message);
  process.exit(1);
});
