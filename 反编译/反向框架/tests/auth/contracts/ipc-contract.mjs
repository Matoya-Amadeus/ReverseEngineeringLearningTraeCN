import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const bootstrap = await readFile(`${ROOT}/src/auth/bootstrap.ts`, 'utf8');
  const ipcAdapter = await readFile(`${ROOT}/src/auth/runtime/ipc-adapter.ts`, 'utf8');

  assert(bootstrap.includes('const channelSpec'), 'bootstrap missing channelSpec');
  assert(bootstrap.includes('adapter.register'), 'bootstrap missing IPC adapter registration');
  assert(ipcAdapter.includes('IPC_CHANNEL_MISMATCH'), 'ipc adapter missing mismatch guard');

  console.log('TEST_OK ipc_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL ipc_contract', e.message);
  process.exit(1);
});
