import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../../root-resolver.mjs';

const root = resolveFrameworkRoot(import.meta.url);

async function main() {
  await new Promise((resolve, reject) => {
    const p = spawn('node', ['tests/core/core-contract.mjs'], { cwd: root, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`core-contract exit ${code}`))));
  });
  console.log('TEST_SUITE_OK core_suite');
}

main().catch((e) => {
  console.error('TEST_SUITE_FAIL core_suite', e.message);
  process.exit(1);
});
