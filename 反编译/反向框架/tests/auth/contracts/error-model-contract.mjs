import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const errorTs = await readFile(`${ROOT}/src/auth/errors/auth-error.ts`, 'utf8');

  for (const code of ['NETWORK_TIMEOUT', 'NETWORK_RETRY_EXHAUSTED', 'PROVIDER_REFRESH_INVALID', 'IPC_CHANNEL_MISMATCH', 'RISK_REGION_BLOCKED']) {
    assert(errorTs.includes(code), `missing auth error code ${code}`);
  }

  assert(errorTs.includes('mapProviderCodeToAuthError'), 'provider error mapping helper missing');

  console.log('TEST_OK error_model_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL error_model_contract', e.message);
  process.exit(1);
});
