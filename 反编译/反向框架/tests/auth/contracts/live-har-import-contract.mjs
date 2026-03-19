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

function runImport(harFile, outFile) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['replay/import-live-fingerprints-from-har.mjs'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        TRAE_AUTH_HAR_FILE: harFile,
        TRAE_AUTH_FINGERPRINT_LIVE_IN: outFile
      }
    });
    p.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`har import exit ${code}`))));
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
  const dir = await mkdtemp(path.join(tmpdir(), 'trae-har-import-contract-'));
  const harFile = path.join(dir, 'capture.har');
  const outFile = path.join(dir, 'provider-fingerprints.live.in.jsonl');

  const har = {
    log: {
      entries: [
        {
          startedDateTime: '2026-03-18T12:30:00.000Z',
          request: {
            method: 'POST',
            url: 'https://api.example.com/cloudide/api/v3/trae/GetUserInfo',
            headers: [
              { name: 'x-auth-provider', value: 'marscode' },
              { name: 'x-request-id', value: 'har_req_1' },
              { name: 'x-cloudide-token', value: 'tok' },
              { name: 'x-auth-sign', value: 'sig' }
            ],
            postData: { text: '{"AppVersion":"1","IDEVersion":"1"}' }
          }
        },
        {
          startedDateTime: '2026-03-18T12:30:01.000Z',
          request: {
            method: 'POST',
            url: 'https://api.example.com/not-trae/path',
            headers: [{ name: 'x-request-id', value: 'har_req_x' }],
            postData: { text: '{}' }
          }
        }
      ]
    }
  };

  await writeFile(harFile, JSON.stringify(har), 'utf8');
  await runImport(harFile, outFile);

  const rows = parseJsonl(await readFile(outFile, 'utf8'));
  assert(rows.length === 1, 'expected only one route-matched imported row');
  assert(rows[0].provider === 'marscode', 'provider infer mismatch');
  assert(rows[0].path === '/cloudide/api/v3/trae/GetUserInfo', 'path mismatch');
  assert(rows[0].captureMode === 'har-import', 'captureMode should be har-import');
  assert(rows[0].dataKeys.includes('AppVersion'), 'data keys should parse from post body');

  console.log('TEST_OK live_har_import_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL live_har_import_contract', e.message);
  process.exit(1);
});
