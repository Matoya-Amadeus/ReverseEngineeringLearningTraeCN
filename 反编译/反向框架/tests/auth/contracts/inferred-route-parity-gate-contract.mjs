import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../../../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runGate(registerFile, requireMarked = '1') {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['replay/inferred-route-parity-gate.mjs'], {
      cwd: ROOT,
      stdio: 'pipe',
      env: { ...process.env, TRAE_AUTH_REQUIRE_INFERRED_MARKING: requireMarked, TRAE_AUTH_INFERRED_REGISTER: registerFile }
    });

    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => {
      stdout += String(d);
    });
    p.stderr.on('data', (d) => {
      stderr += String(d);
    });

    p.on('exit', (code) => {
      resolve({ code: Number(code || 0), stdout, stderr });
    });
  });
}

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), 'trae-inferred-parity-contract-'));
  const registerFile = path.join(dir, '推断路由登记表.md');

  const goodDoc = [
    '# Inferred Route Register',
    '',
    '| # | Provider | Path | Coverage State | Reconstruction Mode | Payload Builder | Evidence Level | Note |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 1 | marscode | /r1 | bootstrap-only | inferred-high-fidelity | buildX | inferred-high-fidelity | note |',
    '| 2 | saas | /r2 | real-captured | evidence-backed | buildY | inferred-high-fidelity | note |',
    ''
  ].join('\n');

  await writeFile(registerFile, goodDoc, 'utf8');
  const pass = await runGate(registerFile, '1');
  assert(pass.code === 0, 'gate should pass when inferred routes are marked');

  const badDoc = [
    '# Inferred Route Register',
    '',
    '| # | Provider | Path | Coverage State | Reconstruction Mode | Payload Builder | Evidence Level | Note |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 1 | marscode | /r1 | bootstrap-only | evidence-backed | buildX | inferred-high-fidelity | note |',
    ''
  ].join('\n');

  await writeFile(registerFile, badDoc, 'utf8');
  const fail = await runGate(registerFile, '1');
  assert(fail.code !== 0, 'gate should fail when unresolved route is not inferred-marked');

  console.log('TEST_OK inferred_route_parity_gate_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL inferred_route_parity_gate_contract', e.message);
  process.exit(1);
});
