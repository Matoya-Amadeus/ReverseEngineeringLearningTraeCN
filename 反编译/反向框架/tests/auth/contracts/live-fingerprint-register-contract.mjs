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

function runRegister(inFile, outFile) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['replay/register-live-fingerprint-captures.mjs'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        TRAE_AUTH_FINGERPRINT_LIVE_IN: inFile,
        TRAE_AUTH_FINGERPRINT_LIVE_OUT: outFile
      }
    });
    p.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`register script exit ${code}`))));
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
  const dir = await mkdtemp(path.join(tmpdir(), 'trae-live-contract-'));
  const inFile = path.join(dir, 'provider-fingerprints.live.in.jsonl');
  const outFile = path.join(dir, 'provider-fingerprints.live.jsonl');

  const lines = [
    JSON.stringify({
      provider: 'marscode',
      path: '/cloudide/api/v3/trae/GetUserInfo',
      requestId: 'req-live-1',
      dataKeys: ['Region', 'AppVersion', 'Region'],
      headerKeys: ['x-auth-provider', 'x-auth-sign', 'x-auth-sign'],
      hasToken: true
    }),
    JSON.stringify({
      provider: 'marscode',
      path: '/cloudide/api/v3/trae/GetUserInfo',
      requestId: 'req-live-1',
      dataKeys: ['Region', 'IDEVersion'],
      headerKeys: ['x-auth-provider', 'x-cloudide-token'],
      hasToken: true
    }),
    JSON.stringify({
      provider: 'saas',
      path: '/cloudide/api/v3/trae/CheckLogin',
      requestId: 'req-live-2',
      dataKeys: ['Platform', 'AppVersion'],
      headerKeys: ['x-auth-provider'],
      hasToken: true
    }),
    '{malformed-json}'
  ];

  await writeFile(inFile, lines.join('\n') + '\n', 'utf8');

  await runRegister(inFile, outFile);

  const rows = parseJsonl(await readFile(outFile, 'utf8'));
  assert(rows.length === 2, 'expected 2 deduped live rows');

  const first = rows.find((x) => x.provider === 'marscode');
  const second = rows.find((x) => x.provider === 'saas');

  assert(first, 'marscode row missing');
  assert(second, 'saas row missing');

  assert(first.source === 'live', 'source should be live');
  assert(Array.isArray(first.dataKeys) && first.dataKeys.includes('IDEVersion'), 'marscode merged data keys missing');
  assert(Array.isArray(first.headerKeys) && first.headerKeys.includes('x-cloudide-token'), 'marscode merged header keys missing');

  console.log('TEST_OK live_fingerprint_register_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL live_fingerprint_register_contract', e.message);
  process.exit(1);
});
