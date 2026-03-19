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

function runBatch(env = {}) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['replay/promote-real-capture-batch.mjs'], {
      cwd: ROOT,
      stdio: 'pipe',
      env: { ...process.env, ...env }
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

function parseJsonl(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function main() {
  const skip = await runBatch({
    TRAE_AUTH_REAL_HAR_FILE: '/tmp/non-existent-real-capture.har',
    TRAE_AUTH_REQUIRE_REAL_HAR: '0',
    TRAE_AUTH_REQUIRE_REAL_LIVE_COVERAGE: '0'
  });
  assert(skip.code === 0, 'skip mode should succeed when real HAR is missing');
  assert(skip.stdout.includes('REAL_BATCH_SKIP'), 'skip mode should print skip marker');

  const dir = await mkdtemp(path.join(tmpdir(), 'trae-real-batch-contract-'));
  const harFile = path.join(dir, 'capture.real.har');
  const liveIn = path.join(dir, 'live.in.jsonl');
  const realIn = path.join(dir, 'live.real.in.jsonl');

  const baseRows = [
    { provider: 'marscode', path: '/cloudide/api/v3/trae/GetUserInfo', requestId: 'b1', captureMode: 'bootstrap-sample' },
    { provider: 'saas', path: '/cloudide/api/v3/trae/CheckLogin', requestId: 'b2', captureMode: 'bootstrap-sample' }
  ];
  await writeFile(liveIn, baseRows.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8');

  const har = {
    log: {
      entries: [
        {
          startedDateTime: '2026-03-18T12:40:00.000Z',
          request: {
            method: 'POST',
            url: 'https://api.example.com/cloudide/api/v3/trae/GetUserInfo',
            headers: [
              { name: 'x-auth-provider', value: 'marscode' },
              { name: 'x-request-id', value: 'batch_real_req_1' },
              { name: 'x-cloudide-token', value: 'tok' },
              { name: 'x-auth-sign', value: 'sig' }
            ],
            postData: { text: '{"AppVersion":"1","IDEVersion":"1","Platform":"mac","Region":"cn"}' }
          }
        }
      ]
    }
  };

  await writeFile(harFile, JSON.stringify(har), 'utf8');

  const run = await runBatch({
    TRAE_AUTH_REAL_HAR_FILE: harFile,
    TRAE_AUTH_REQUIRE_REAL_HAR: '1',
    TRAE_AUTH_REQUIRE_REAL_LIVE_COVERAGE: '0',
    TRAE_AUTH_REAL_BATCH_MODE: 'import_replace_only',
    TRAE_AUTH_FINGERPRINT_LIVE_IN: liveIn,
    TRAE_AUTH_FINGERPRINT_LIVE_REAL_IN: realIn
  });
  assert(run.code === 0, `real batch should succeed with a valid HAR, got: ${run.stderr || run.stdout}`);
  assert(run.stdout.includes('REAL_BATCH_OK'), 'real batch should print success marker');

  const rows = parseJsonl(await readFile(liveIn, 'utf8'));
  const replaced = rows.find((x) => x.provider === 'marscode' && x.path === '/cloudide/api/v3/trae/GetUserInfo');
  assert(replaced && !String(replaced.captureMode).toLowerCase().includes('bootstrap'), 'marscode route should be replaced by non-bootstrap row');

  console.log('TEST_OK real_capture_batch_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL real_capture_batch_contract', e.message);
  process.exit(1);
});
