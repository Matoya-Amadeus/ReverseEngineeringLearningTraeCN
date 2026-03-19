import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const requester = await readFile(`${ROOT}/src/auth/providers/network/protocol-requester.ts`, 'utf8');
  const signer = await readFile(`${ROOT}/src/auth/providers/network/default-signer.ts`, 'utf8');
  const profile = await readFile(`${ROOT}/src/auth/providers/network/protocol-profile.ts`, 'utf8');
  const context = await readFile(`${ROOT}/src/auth/providers/network/request-context.ts`, 'utf8');

  assert(requester.includes('resolveRoutePolicy'), 'protocol requester should apply route policy resolver');
  assert(requester.includes('createProtocolContext'), 'protocol requester should build request context');
  assert(requester.includes('token required by route policy'), 'protocol requester must enforce token-required routes');
  assert(requester.includes('x-auth-provider'), 'protocol requester should still emit provider header');

  assert(profile.includes('x-request-id'), 'protocol profile should include request-id header');
  assert(profile.includes('x-trace-id'), 'protocol profile should include trace-id header');
  assert(profile.includes('x-device-id'), 'protocol profile should include device-id header');

  assert(context.includes('requestId'), 'request context must contain requestId field');
  assert(context.includes('traceId'), 'request context must contain traceId field');

  assert(signer.includes("x-auth-sign-v': 'v2"), 'default signer should expose v2 signature header');
  assert(signer.includes('createHash'), 'default signer should use hash-based signature');

  console.log('TEST_OK network_context_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL network_context_contract', e.message);
  process.exit(1);
});
