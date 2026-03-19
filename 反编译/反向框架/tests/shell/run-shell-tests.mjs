import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../../root-resolver.mjs';

const root = resolveFrameworkRoot(import.meta.url);
const jobs = [
  'tests/shell/shell-smoke.mjs',
  'tests/shell/shell-contract.mjs',
  'tests/shell/shell-launcher-contract.mjs'
];

function run(script) {
  return new Promise((resolve, reject) => {
    const p = spawn('node', [script], { cwd: root, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`${script} exit ${code}`))));
  });
}

async function main() {
  for (const script of jobs) {
    await run(script);
  }
  console.log('TEST_SUITE_OK shell_suite');
}

main().catch((e) => {
  console.error('TEST_SUITE_FAIL shell_suite', e.message);
  process.exit(1);
});
