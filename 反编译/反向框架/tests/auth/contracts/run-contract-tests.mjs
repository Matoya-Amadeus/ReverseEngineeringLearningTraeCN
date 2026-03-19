import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

const scripts = [
  'provider-protocol-contract.mjs',
  'provider-payload-contract.mjs',
  'error-model-contract.mjs',
  'ipc-contract.mjs',
  'network-context-contract.mjs',
  'request-alignment-contract.mjs',
  'fingerprint-recorder-contract.mjs',
  'live-fingerprint-register-contract.mjs',
  'live-har-import-contract.mjs',
  'real-har-auto-discovery-contract.mjs',
  'replace-bootstrap-with-real-contract.mjs',
  'real-capture-batch-contract.mjs',
  'real-capture-backlog-doc-contract.mjs',
  'inferred-route-register-contract.mjs',
  'inferred-route-parity-gate-contract.mjs',
  'live-evidence-coverage-contract.mjs',
  'live-evidence-quality-contract.mjs',
  'live-gap-plan-doc-contract.mjs',
  'alignment-matrix-doc-contract.mjs',
  'evidence-diff-doc-contract.mjs'
];

async function run(script) {
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [script], {
      cwd: `${ROOT}/tests/auth/contracts`,
      stdio: 'inherit'
    });
    p.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`${script} exit ${code}`))));
  });
}

async function main() {
  for (const script of scripts) {
    await run(script);
  }
  console.log('TEST_SUITE_OK auth_contracts');
}

main().catch((e) => {
  console.error('TEST_SUITE_FAIL auth_contracts', e.message);
  process.exit(1);
});
