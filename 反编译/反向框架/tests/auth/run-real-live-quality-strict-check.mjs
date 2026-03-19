import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../../root-resolver.mjs';

const root = resolveFrameworkRoot(import.meta.url);
const min = Number(process.env.TRAE_AUTH_REAL_LIVE_COVERAGE_MIN || '1');

async function runAll() {
  await new Promise((resolve, reject) => {
    const p = spawn('node', ['tests/auth/run-all-checks.mjs'], {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        TRAE_AUTH_REQUIRE_REAL_LIVE_COVERAGE: '1',
        TRAE_AUTH_REAL_LIVE_COVERAGE_MIN: String(min)
      }
    });
    p.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`strict real-live quality check exit ${code}`))));
  });
}

runAll()
  .then(() => {
    console.log('TEST_SUITE_OK real_live_quality_strict_check');
  })
  .catch((e) => {
    console.error('TEST_SUITE_FAIL real_live_quality_strict_check', e.message);
    process.exit(1);
  });
