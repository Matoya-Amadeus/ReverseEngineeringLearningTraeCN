import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const requester = await readFile(`${ROOT}/src/auth/providers/network/protocol-requester.ts`, 'utf8');
  const alignment = await readFile(`${ROOT}/src/auth/providers/network/route-alignment.ts`, 'utf8');

  assert(requester.includes('resolveRouteAlignment'), 'protocol requester should resolve route alignment rules');
  assert(requester.includes('diffRequiredKeys'), 'protocol requester should diff required keys');
  assert(requester.includes('route alignment check failed'), 'protocol requester should fail on alignment mismatch');
  assert(requester.includes('RequestFingerprintRecorder'), 'protocol requester should support request fingerprint recorder');
  assert(requester.includes('#recordFingerprint'), 'protocol requester should record request fingerprints');

  assert(alignment.includes('requiredDataKeys'), 'route-alignment should define required data keys');
  assert(alignment.includes('requiredHeaderKeys'), 'route-alignment should define required header keys');
  assert(alignment.includes('/oauth/ExchangeToken'), 'route-alignment should cover exchange token route');
  assert(alignment.includes('/GetUserInfo'), 'route-alignment should cover user info route');
  assert(alignment.includes('/CheckLogin'), 'route-alignment should cover check-login route');

  console.log('TEST_OK request_alignment_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL request_alignment_contract', e.message);
  process.exit(1);
});
