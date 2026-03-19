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
    const p = spawn(process.execPath, ['replay/live-evidence-coverage-gate.mjs'], {
      cwd: ROOT,
      stdio: 'pipe',
      env: {
        ...process.env,
        ...env
      }
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
  const dir = await mkdtemp(path.join(tmpdir(), 'trae-live-coverage-contract-'));
  const doc = path.join(dir, 'Provider字段证据差异.md');

  const md = [
    '# Provider Field Evidence Diff',
    '',
    '| Provider | Path | Capture Source | Capture Count | Required Data | Observed Data | Missing Data | Required Headers | Observed Headers | Missing Headers | Status |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| marscode | /a | live | 1 | (none) | (none) | (none) | (none) | (none) | (none) | aligned_with_live_capture |',
    '| saas | /b | seed | 1 | (none) | (none) | (none) | (none) | (none) | (none) | aligned_with_seed_only |',
    '| bytedance | /c | none | 0 | (none) | (none) | (none) | (none) | (none) | (none) | no_capture |',
    ''
  ].join('\n');

  await writeFile(doc, md, 'utf8');

  const relaxed = await runGate({
    TRAE_AUTH_EVIDENCE_DOC: doc,
    TRAE_AUTH_REQUIRE_LIVE_COVERAGE: '0'
  });
  assert(relaxed.code === 0, 'relaxed mode should pass');
  assert(relaxed.stdout.includes('LIVE_COVERAGE_OK'), 'relaxed mode should print success marker');

  const strictFail = await runGate({
    TRAE_AUTH_EVIDENCE_DOC: doc,
    TRAE_AUTH_REQUIRE_LIVE_COVERAGE: '1',
    TRAE_AUTH_LIVE_COVERAGE_MIN: '0.8'
  });
  assert(strictFail.code !== 0, 'strict mode should fail when ratio is below min');
  assert(strictFail.stderr.includes('LIVE_COVERAGE_FAIL'), 'strict mode should print failure marker');

  const strictPass = await runGate({
    TRAE_AUTH_EVIDENCE_DOC: doc,
    TRAE_AUTH_REQUIRE_LIVE_COVERAGE: '1',
    TRAE_AUTH_LIVE_COVERAGE_MIN: '0.3'
  });
  assert(strictPass.code === 0, 'strict mode should pass when ratio meets min');

  console.log('TEST_OK live_evidence_coverage_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL live_evidence_coverage_contract', e.message);
  process.exit(1);
});
