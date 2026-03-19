import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../../root-resolver.mjs';

const root = resolveFrameworkRoot(import.meta.url);

const jobs = [
  ['node', 'replay/full-runtime-e2e-replay.mjs'],
  ['node', 'replay/minimal-auth-replay.mjs'],
  ['node', 'replay/region-self-heal-replay.mjs'],
  ['node', 'replay/orchestrator-wire-replay.mjs'],
  ['node', 'replay/runtime-bootstrap-replay.mjs'],
  ['node', 'tests/auth/run-replay-tests.mjs'],
  ['node', 'replay/generate-route-alignment-matrix.mjs'],
  ['node', 'replay/seed-fingerprint-captures.mjs'],
  ['node', 'replay/register-live-fingerprint-captures.mjs'],
  ['node', 'replay/analyze-fingerprint-evidence.mjs'],
  ['node', 'replay/live-evidence-coverage-gate.mjs'],
  ['node', 'replay/live-evidence-quality-gate.mjs'],
  ['node', 'replay/generate-real-capture-backlog.mjs'],
  ['node', 'replay/generate-inferred-route-register.mjs'],
  ['node', 'replay/inferred-route-parity-gate.mjs'],
  ['node', 'replay/generate-live-gap-action-plan.mjs'],
  ['node', 'tests/auth/contracts/run-contract-tests.mjs'],
  ['node', 'tests/core/run-core-tests.mjs'],
  ['node', 'tests/shell/run-shell-tests.mjs']
];

function run(cmd, arg) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, [arg], { cwd: root, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`${cmd} ${arg} exit ${code}`))));
  });
}

async function main() {
  for (const [cmd, arg] of jobs) {
    await run(cmd, arg);
  }
  console.log('TEST_SUITE_OK auth_all_checks');
}

main().catch((e) => {
  console.error('TEST_SUITE_FAIL auth_all_checks', e.message);
  process.exit(1);
});
