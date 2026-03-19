import { access, readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const DEFAULT_REAL_HAR = path.join(ROOT, 'docs', 'capture.real.har');
const SEARCH_ROOT = process.env.TRAE_AUTH_HAR_SEARCH_ROOT || path.join(ROOT, 'docs');
const MAX_DEPTH = Number(process.env.TRAE_AUTH_HAR_SEARCH_MAX_DEPTH || '6');
const AUTO_DISCOVER = String(process.env.TRAE_AUTH_AUTO_DISCOVER_REAL_HAR || '1') !== '0';

const REQUIRE_HAR = String(process.env.TRAE_AUTH_REQUIRE_REAL_HAR || '0') === '1';
const REQUIRE_REAL = String(process.env.TRAE_AUTH_REQUIRE_REAL_LIVE_COVERAGE || '1') === '1';
const MIN_REAL = Number(process.env.TRAE_AUTH_REAL_LIVE_COVERAGE_MIN || '1');
const MODE = String(process.env.TRAE_AUTH_REAL_BATCH_MODE || 'full');

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function collectHarFiles(dir, depth, out) {
  if (depth > MAX_DEPTH) return;
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectHarFiles(full, depth + 1, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith('.har')) continue;
    try {
      const s = await stat(full);
      out.push({ file: full, mtimeMs: Number(s.mtimeMs || 0) });
    } catch {
      // ignore unreadable files
    }
  }
}

async function resolveHarFile() {
  const explicit = process.env.TRAE_AUTH_REAL_HAR_FILE;
  if (explicit) return explicit;

  if (await exists(DEFAULT_REAL_HAR)) return DEFAULT_REAL_HAR;
  if (!AUTO_DISCOVER) return DEFAULT_REAL_HAR;

  const found = [];
  await collectHarFiles(SEARCH_ROOT, 0, found);
  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (found.length > 0) {
    console.log('REAL_BATCH_AUTO_HAR', found[0].file, `candidates=${found.length}`);
    return found[0].file;
  }

  return DEFAULT_REAL_HAR;
}

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, ...env }
    });
    p.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`${cmd} ${args.join(' ')} exit ${code}`))));
  });
}

async function main() {
  const realHar = await resolveHarFile();
  const hasHar = await exists(realHar);
  if (!hasHar) {
    if (REQUIRE_HAR) throw new Error(`real HAR not found: ${realHar}`);
    console.log('REAL_BATCH_SKIP', realHar, 'not found');
    return;
  }

  await run('node', ['replay/import-live-fingerprints-from-har.mjs'], {
    TRAE_AUTH_HAR_FILE: realHar,
    TRAE_AUTH_FINGERPRINT_LIVE_IN: process.env.TRAE_AUTH_FINGERPRINT_LIVE_REAL_IN || path.join(ROOT, 'docs', 'provider-fingerprints.live.real.in.jsonl')
  });

  await run('node', ['replay/replace-bootstrap-with-real-captures.mjs']);

  if (MODE === 'import_replace_only') {
    console.log('REAL_BATCH_OK', `mode=${MODE}`, `har=${realHar}`);
    return;
  }

  await run('node', ['replay/register-live-fingerprint-captures.mjs']);
  await run('node', ['replay/analyze-fingerprint-evidence.mjs']);
  await run('node', ['replay/live-evidence-coverage-gate.mjs'], {
    TRAE_AUTH_REQUIRE_LIVE_COVERAGE: '1',
    TRAE_AUTH_LIVE_COVERAGE_MIN: '1'
  });

  if (REQUIRE_REAL) {
    await run('node', ['replay/live-evidence-quality-gate.mjs'], {
      TRAE_AUTH_REQUIRE_REAL_LIVE_COVERAGE: '1',
      TRAE_AUTH_REAL_LIVE_COVERAGE_MIN: String(MIN_REAL)
    });
  }

  await run('node', ['replay/generate-real-capture-backlog.mjs']);
  await run('node', ['replay/generate-live-gap-action-plan.mjs']);

  console.log('REAL_BATCH_OK', `mode=${MODE}`, `har=${realHar}`, `require_real=${REQUIRE_REAL ? '1' : '0'}`, `min_real=${MIN_REAL}`);
}

main().catch((e) => {
  console.error('REAL_BATCH_FAIL', e.message);
  process.exit(1);
});
