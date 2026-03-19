import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

async function main() {
  await new Promise((resolve, reject) => {
    const p = spawn('node', ['src/shell/start-shell.mjs'], {
      cwd: `${ROOT}`,
      stdio: 'pipe',
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
        reject(new Error(`shell bootstrap failed: ${out}`));
        return;
      }
      if (!out.includes('SHELL_OK started')) {
        reject(new Error(`shell bootstrap marker missing: ${out}`));
        return;
      }
      if (!out.includes('SHELL_OK stopped_after_boot')) {
        reject(new Error(`shell quick-exit marker missing: ${out}`));
        return;
      }
      resolve(undefined);
    });
  });

  console.log('TEST_OK shell_smoke');
}

main().catch((e) => {
  console.error('TEST_FAIL shell_smoke', e.message);
  process.exit(1);
});
