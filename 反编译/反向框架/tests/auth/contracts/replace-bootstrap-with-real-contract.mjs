import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../../../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runReplace(liveIn, realIn) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['replay/replace-bootstrap-with-real-captures.mjs'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        TRAE_AUTH_FINGERPRINT_LIVE_IN: liveIn,
        TRAE_AUTH_FINGERPRINT_LIVE_REAL_IN: realIn
      }
    });
    p.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`replace script exit ${code}`))));
  });
}

function parseJsonl(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), 'trae-replace-bootstrap-contract-'));
  const liveIn = path.join(dir, 'live.in.jsonl');
  const realIn = path.join(dir, 'live.real.in.jsonl');

  const baseRows = [
    { provider: 'marscode', path: '/r1', requestId: 'b1', captureMode: 'bootstrap-sample' },
    { provider: 'marscode', path: '/r2', requestId: 'b2', captureMode: 'bootstrap-sample' },
    { provider: 'saas', path: '/r3', requestId: 'x1', captureMode: 'real-har' }
  ];

  const realRows = [
    { provider: 'marscode', path: '/r1', requestId: 'r1', captureMode: 'real-har' },
    { provider: 'bytedance', path: '/r4', requestId: 'r2', captureMode: 'real-har' }
  ];

  await writeFile(liveIn, baseRows.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8');
  await writeFile(realIn, realRows.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8');

  await runReplace(liveIn, realIn);

  const rows = parseJsonl(await readFile(liveIn, 'utf8'));

  const r1 = rows.filter((x) => x.provider === 'marscode' && x.path === '/r1');
  assert(r1.length === 1, 'r1 should have only one row after replacement');
  assert(String(r1[0].captureMode).includes('real'), 'r1 should be replaced with real row');

  const r2 = rows.filter((x) => x.provider === 'marscode' && x.path === '/r2');
  assert(r2.length === 1, 'r2 row should remain');
  assert(String(r2[0].captureMode).includes('bootstrap'), 'r2 should keep bootstrap row without real replacement');

  const r4 = rows.filter((x) => x.provider === 'bytedance' && x.path === '/r4');
  assert(r4.length === 1, 'new real-only route should be added');

  console.log('TEST_OK replace_bootstrap_with_real_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL replace_bootstrap_with_real_contract', e.message);
  process.exit(1);
});
