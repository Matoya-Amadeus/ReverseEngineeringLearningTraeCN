import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveFrameworkRoot } from '../../root-resolver.mjs';

const ROOT = resolveFrameworkRoot(import.meta.url);
const OPEN_LAUNCHER = `${ROOT}/launcher/open-reconstructed.command`;
const ACCEPT_LAUNCHER = `${ROOT}/launcher/run-shell-acceptance.command`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function checkExecutable(file) {
  await access(file, constants.F_OK | constants.X_OK);
}

function runOpenLauncher() {
  return new Promise((resolve, reject) => {
    const p = spawn('/bin/zsh', [OPEN_LAUNCHER], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TRAE_SHELL_EXIT_AFTER_BOOT: '1'
      }
    });
    let out = '';
    p.stdout.on('data', (b) => {
      out += String(b);
    });
    p.stderr.on('data', (b) => {
      out += String(b);
    });
    p.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`open launcher exit ${code}: ${out}`));
        return;
      }
      if (!out.includes('SHELL_OK started')) {
        reject(new Error(`open launcher missing marker: ${out}`));
        return;
      }
      if (!out.includes('SHELL_OK stopped_after_boot')) {
        reject(new Error(`open launcher quick-exit marker missing: ${out}`));
        return;
      }
      resolve(undefined);
    });
  });
}

async function main() {
  await checkExecutable(OPEN_LAUNCHER);
  await checkExecutable(ACCEPT_LAUNCHER);
  await runOpenLauncher();
  console.log('TEST_OK shell_launcher_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL shell_launcher_contract', e.message);
  process.exit(1);
});
