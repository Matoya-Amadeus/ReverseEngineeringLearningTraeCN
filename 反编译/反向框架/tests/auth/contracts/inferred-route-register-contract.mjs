import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../../../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const DOC = `${ROOT}/docs/推断路由登记表.md`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function generateRegister() {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['replay/generate-inferred-route-register.mjs'], {
      cwd: ROOT,
      stdio: 'inherit'
    });
    p.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`generate inferred register exit ${code}`))));
  });
}

async function main() {
  await generateRegister();
  const doc = await readFile(DOC, 'utf8');

  assert(doc.includes('Inferred Route Register'), 'inferred register title missing');
  assert(doc.includes('inferred-high-fidelity'), 'inferred mode marker missing');
  assert(doc.includes('/cloudide/api/v3/trae/oauth/ExchangeToken'), 'exchange token route missing');
  assert(doc.includes('/api/v2/GetUserNativeRegion'), 'bytedance native region route missing');

  console.log('TEST_OK inferred_route_register_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL inferred_route_register_contract', e.message);
  process.exit(1);
});
