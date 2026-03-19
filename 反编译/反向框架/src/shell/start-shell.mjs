import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReconstructedAppShell, createDefaultShellOptions } from './app-shell.mjs';

function shouldExitAfterBoot() {
  if (process.argv.includes('--quick-exit')) return true;
  return String(process.env.TRAE_SHELL_EXIT_AFTER_BOOT || '0') === '1';
}

async function waitUntilSignal() {
  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(undefined);
    };

    process.once('SIGINT', finish);
    process.once('SIGTERM', finish);
    process.once('SIGHUP', finish);
  });
}

async function main() {
  const currentFile = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');
  const shell = new ReconstructedAppShell(createDefaultShellOptions(projectRoot));
  const info = await shell.start();

  const bridgePing = await shell.bridge.invoke('shell:ping', { from: 'startup-check' });
  const status = shell.getStatus();

  console.log('SHELL_OK started');
  console.log(JSON.stringify({ info, bridgePing, status }, null, 2));

  if (shouldExitAfterBoot()) {
    await shell.stop();
    console.log('SHELL_OK stopped_after_boot');
    return;
  }

  console.log('SHELL_RUNNING press Ctrl+C to stop');
  await waitUntilSignal();
  await shell.stop();
  console.log('SHELL_OK stopped_by_signal');
}

main().catch((e) => {
  console.error('SHELL_FAIL', e.message);
  process.exit(1);
});
