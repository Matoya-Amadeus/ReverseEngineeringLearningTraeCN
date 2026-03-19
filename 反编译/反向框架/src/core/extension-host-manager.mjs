import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));

export class ExtensionHostManager {
  constructor(options = {}) {
    this.workerScript = options.workerScript || path.join(THIS_DIR, 'extension-host-worker.mjs');
    this.policy = {
      autoRestartMax: Number(options.autoRestartMax || 3),
      autoRestartWindowMs: Number(options.autoRestartWindowMs || 30_000),
      restartDelayMs: Number(options.restartDelayMs || 120)
    };

    this.child = undefined;
    this.stopping = false;

    this.state = {
      running: false,
      pid: undefined,
      bootCount: 0,
      workspaceId: undefined,
      workspacePath: undefined,
      sessionId: undefined,
      startedAt: undefined,
      lastExit: undefined,
      restartHistory: []
    };
  }

  start(payload = {}) {
    this.state.workspaceId = payload.workspaceId;
    this.state.workspacePath = payload.workspacePath;
    this.state.sessionId = payload.sessionId;

    if (this.child && !this.child.killed) {
      this.state.running = true;
      this.state.pid = this.child.pid;
      return this.snapshot();
    }

    this.#spawn('start');
    return this.snapshot();
  }

  restart(payload = {}) {
    this.#markRestart(payload.reason || 'manual');
    this.stop({ reason: payload.reason || 'manual' });
    this.start(payload);
    return this.snapshot();
  }

  stop(payload = {}) {
    this.stopping = true;
    this.#markRestart(`stop:${payload.reason || 'manual'}`);

    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM');
      setTimeout(() => {
        if (this.child && !this.child.killed) this.child.kill('SIGKILL');
      }, 400).unref?.();
    }

    this.state.running = false;
    this.state.pid = undefined;
    this.state.sessionId = undefined;
    this.child = undefined;
    return this.snapshot();
  }

  simulateCrash(reason = 'contract-test') {
    if (!this.child || this.child.killed) {
      throw new Error('extension host is not running');
    }
    this.#markRestart(`crash:${reason}`);
    this.child.kill('SIGKILL');
    return this.snapshot();
  }

  onWorkspaceChanged(workspaceId, workspacePath) {
    this.state.workspaceId = workspaceId;
    this.state.workspacePath = workspacePath;
  }

  snapshot() {
    return {
      running: this.state.running,
      pid: this.state.pid,
      bootCount: this.state.bootCount,
      workspaceId: this.state.workspaceId,
      workspacePath: this.state.workspacePath,
      sessionId: this.state.sessionId,
      startedAt: this.state.startedAt,
      lastExit: this.state.lastExit,
      restartHistory: [...this.state.restartHistory],
      policy: { ...this.policy }
    };
  }

  #spawn(trigger) {
    this.stopping = false;
    const child = spawn('node', [this.workerScript], {
      cwd: resolveWorkingDir(this.state.workspacePath),
      env: {
        ...process.env,
        TRAE_RECON_WORKSPACE_ID: String(this.state.workspaceId || ''),
        TRAE_RECON_SESSION_ID: String(this.state.sessionId || ''),
        TRAE_RECON_TRIGGER: String(trigger || 'start')
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout?.on('data', () => {});
    child.stderr?.on('data', () => {});

    child.on('error', (err) => {
      this.state.running = false;
      this.state.pid = undefined;
      this.state.lastExit = {
        code: null,
        signal: 'spawn_error',
        ts: new Date().toISOString(),
        pid: null,
        message: String(err?.message || err)
      };
    });

    child.on('exit', (code, signal) => {
      const exitedPid = child.pid;
      if (this.child === child) {
        this.child = undefined;
      }

      this.state.running = false;
      this.state.pid = undefined;
      this.state.lastExit = {
        code: Number.isInteger(code) ? code : null,
        signal: signal || null,
        ts: new Date().toISOString(),
        pid: exitedPid
      };

      if (!this.stopping && this.#shouldAutoRestart()) {
        this.#markRestart('auto:crash-restart');
        setTimeout(() => {
          if (!this.child && !this.stopping) this.#spawn('auto-restart');
        }, this.policy.restartDelayMs).unref?.();
      }
    });

    this.child = child;
    this.state.running = true;
    this.state.pid = child.pid;
    this.state.bootCount += 1;
    this.state.startedAt = new Date().toISOString();
  }

  #markRestart(reason) {
    this.state.restartHistory.push({ reason, ts: new Date().toISOString() });
    if (this.state.restartHistory.length > 50) {
      this.state.restartHistory = this.state.restartHistory.slice(-50);
    }
  }

  #shouldAutoRestart() {
    const now = Date.now();
    const windowStart = now - this.policy.autoRestartWindowMs;
    const autoCount = this.state.restartHistory.filter((x) => {
      const ts = Date.parse(x.ts || '');
      return x.reason.startsWith('auto:') && Number.isFinite(ts) && ts >= windowStart;
    }).length;
    return autoCount < this.policy.autoRestartMax;
  }
}

function resolveWorkingDir(candidate) {
  const cwd = String(candidate || '');
  if (cwd && fs.existsSync(cwd)) return cwd;
  return process.cwd();
}
