import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const recorder = await readFile(`${ROOT}/src/auth/providers/network/request-fingerprint-recorder.ts`, 'utf8');
  const factory = await readFile(`${ROOT}/src/auth/providers/provider-factory.ts`, 'utf8');

  assert(recorder.includes('RequestFingerprintRecorder'), 'recorder class missing');
  assert(recorder.includes('record(item'), 'recorder should support record method');
  assert(recorder.includes('appendFileSync'), 'recorder should support optional file export');
  assert(recorder.includes('snapshot()'), 'recorder should support snapshot method');

  assert(factory.includes('new RequestFingerprintRecorder'), 'provider factory should instantiate fingerprint recorder');
  assert(factory.includes('TRAE_AUTH_FINGERPRINT_FILE'), 'provider factory should read recorder output env');
  assert(factory.includes('recorder'), 'provider factory should pass recorder to protocol requester');

  console.log('TEST_OK fingerprint_recorder_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL fingerprint_recorder_contract', e.message);
  process.exit(1);
});
