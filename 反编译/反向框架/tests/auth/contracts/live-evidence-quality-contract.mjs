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

function runGate(env = {}) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['replay/live-evidence-quality-gate.mjs'], {
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

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), 'trae-live-quality-contract-'));
  const matrixFile = path.join(dir, 'matrix.md');
  const liveFile = path.join(dir, 'live.jsonl');

  const matrix = [
    '# Matrix',
    '',
    '| Provider | Path | Required Data | Required Headers | Rule Type | Note | Extra |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| marscode | /r1 | (none required by rule) | (none required by rule) | hard | - | - |',
    '| saas | /r2 | (none required by rule) | (none required by rule) | hard | - | - |',
    '| bytedance | /r3 | (none required by rule) | (none required by rule) | hard | - | - |',
    ''
  ].join('\n');

  const liveRows = [
    JSON.stringify({ provider: 'marscode', path: '/r1', captureMode: 'bootstrap-sample', requestId: 'a1' }),
    JSON.stringify({ provider: 'saas', path: '/r2', captureMode: 'real-har', requestId: 'a2' })
  ].join('\n') + '\n';

  await writeFile(matrixFile, matrix, 'utf8');
  await writeFile(liveFile, liveRows, 'utf8');

  const relaxed = await runGate({
    TRAE_AUTH_MATRIX_DOC: matrixFile,
    TRAE_AUTH_FINGERPRINT_LIVE_OUT: liveFile,
    TRAE_AUTH_REQUIRE_REAL_LIVE_COVERAGE: '0'
  });
  assert(relaxed.code === 0, 'relaxed quality gate should pass');
  assert(relaxed.stdout.includes('LIVE_QUALITY_OK'), 'relaxed quality gate should print success marker');

  const strictFail = await runGate({
    TRAE_AUTH_MATRIX_DOC: matrixFile,
    TRAE_AUTH_FINGERPRINT_LIVE_OUT: liveFile,
    TRAE_AUTH_REQUIRE_REAL_LIVE_COVERAGE: '1',
    TRAE_AUTH_REAL_LIVE_COVERAGE_MIN: '0.8'
  });
  assert(strictFail.code !== 0, 'strict quality gate should fail when real ratio below min');
  assert(strictFail.stderr.includes('LIVE_QUALITY_FAIL'), 'strict quality gate should print fail marker');

  const strictPass = await runGate({
    TRAE_AUTH_MATRIX_DOC: matrixFile,
    TRAE_AUTH_FINGERPRINT_LIVE_OUT: liveFile,
    TRAE_AUTH_REQUIRE_REAL_LIVE_COVERAGE: '1',
    TRAE_AUTH_REAL_LIVE_COVERAGE_MIN: '0.3'
  });
  assert(strictPass.code === 0, 'strict quality gate should pass when real ratio meets min');

  console.log('TEST_OK live_evidence_quality_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL live_evidence_quality_contract', e.message);
  process.exit(1);
});
