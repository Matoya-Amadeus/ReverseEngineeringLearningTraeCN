import fs from 'node:fs';
import { spawn } from 'node:child_process';

function toTaskId() {
  return `task_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
}

function trimOutput(text, cap = 8_000) {
  if (!text) return '';
  return text.length > cap ? text.slice(0, cap) : text;
}

export class TaskRuntimeManager {
  constructor() {
    this.workspaceId = undefined;
    this.workspacePath = undefined;
    this.catalog = [
      {
        name: 'build',
        command: 'node',
        args: ['-e', "console.log('recon-build-ok')"],
        timeoutMs: 15_000
      },
      {
        name: 'test',
        command: 'node',
        args: ['-e', "console.log('recon-test-ok')"],
        timeoutMs: 20_000
      },
      {
        name: 'lint',
        command: 'node',
        args: ['-e', "console.log('recon-lint-ok')"],
        timeoutMs: 15_000
      }
    ];
    this.runs = [];
  }

  bootstrap(payload = {}) {
    this.workspaceId = payload.workspaceId;
    this.workspacePath = payload.workspacePath;
    return this.snapshot();
  }

  onWorkspaceChanged(workspaceId, workspacePath) {
    this.workspaceId = workspaceId;
    this.workspacePath = workspacePath;
  }

  listTasks() {
    return this.catalog.map((x) => ({
      name: x.name,
      command: x.command,
      args: [...(x.args || [])],
      timeoutMs: x.timeoutMs
    }));
  }

  async runTask(payload = {}) {
    const name = String(payload.name || '');
    const task = this.catalog.find((x) => x.name === name);
    if (!task) {
      throw new Error(`task not found: ${name}`);
    }

    const cwd = resolveWorkingDir(String(payload.cwd || payload.workspacePath || this.workspacePath || process.cwd()));
    const timeoutMs = Number(payload.timeoutMs || task.timeoutMs || 15_000);
    const run = {
      id: toTaskId(),
      name: task.name,
      command: task.command,
      args: [...(task.args || [])],
      workspaceId: payload.workspaceId || this.workspaceId,
      workspacePath: cwd,
      status: 'running',
      startedAt: new Date().toISOString(),
      endedAt: undefined,
      exitCode: undefined,
      timeoutMs,
      stdout: '',
      stderr: ''
    };

    const result = await executeTask({
      command: task.command,
      args: task.args || [],
      cwd,
      timeoutMs,
      env: payload.env
    });

    run.stdout = trimOutput(result.stdout);
    run.stderr = trimOutput(result.stderr);
    run.exitCode = result.exitCode;
    run.endedAt = new Date().toISOString();

    if (result.timedOut) {
      run.status = 'timed_out';
    } else if (result.exitCode === 0) {
      run.status = 'completed';
    } else {
      run.status = 'failed';
    }

    this.runs.push(run);
    return { ...run, args: [...run.args] };
  }

  getRunHistory() {
    return this.runs.map((x) => ({ ...x, args: [...(x.args || [])] }));
  }

  snapshot() {
    return {
      workspaceId: this.workspaceId,
      workspacePath: this.workspacePath,
      taskCount: this.catalog.length,
      runCount: this.runs.length,
      lastRun: this.runs[this.runs.length - 1]
    };
  }
}

function executeTask({ command, args, cwd, timeoutMs, env }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...(env || {})
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: -1,
        timedOut: false,
        stdout,
        stderr: `${stderr}\n${String(err?.message || err)}`.trim()
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: Number.isInteger(code) ? code : -1,
        timedOut,
        stdout,
        stderr
      });
    });
  });
}

function resolveWorkingDir(candidate) {
  const cwd = String(candidate || '');
  if (cwd && fs.existsSync(cwd)) return cwd;
  return process.cwd();
}
