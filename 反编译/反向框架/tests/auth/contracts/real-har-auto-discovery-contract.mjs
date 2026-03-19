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

function runBatch(env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['replay/promote-real-capture-batch.mjs'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env }
    });

    let out = '';
    let err = '';
    p.stdout.on('data', (d) => {
      out += String(d);
    });
    p.stderr.on('data', (d) => {
      err += String(d);
    });

    p.on('exit', (code) => {
      if (code === 0) {
        resolve({ out, err });
      } else {
        reject(new Error(`batch exit ${code}\n${out}\n${err}`));
      }
    });
  });
}

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), 'trae-real-har-discovery-'));
  const staleHar = path.join(dir, 'capture-old.har');
  const freshHar = path.join(dir, 'capture-new.har');

  const baseEntry = {
    startedDateTime: '2026-03-18T12:30:00.000Z',
    request: {
      method: 'POST',
      url: 'https://api.example.com/cloudide/api/v3/trae/GetUserInfo',
      headers: [
        { name: 'x-auth-provider', value: 'marscode' },
        { name: 'x-request-id', value: 'req_auto_har' },
        { name: 'x-cloudide-token', value: 'tok' }
      ],
      postData: { text: '{"AppVersion":"1"}' }
    }
  };

  await writeFile(staleHar, JSON.stringify({ log: { entries: [baseEntry] } }), 'utf8');
  await new Promise((r) => setTimeout(r, 20));
  await writeFile(freshHar, JSON.stringify({ log: { entries: [baseEntry] } }), 'utf8');

  const { out } = await runBatch({
    TRAE_AUTH_REAL_BATCH_MODE: 'import_replace_only',
    TRAE_AUTH_REQUIRE_REAL_HAR: '1',
    TRAE_AUTH_HAR_SEARCH_ROOT: dir,
    TRAE_AUTH_HAR_SEARCH_MAX_DEPTH: '2',
    TRAE_AUTH_AUTO_DISCOVER_REAL_HAR: '1'
  });

  assert(out.includes('REAL_BATCH_AUTO_HAR'), 'auto discovery marker missing');
  assert(out.includes('capture-new.har'), 'latest har should be selected');
  assert(out.includes('REAL_BATCH_OK mode=import_replace_only'), 'batch should complete in import_replace_only mode');

  console.log('TEST_OK real_har_auto_discovery_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL real_har_auto_discovery_contract', e.message);
  process.exit(1);
});
