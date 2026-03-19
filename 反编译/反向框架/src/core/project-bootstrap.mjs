import path from 'node:path';
import { WorkspaceManager } from './workspace-manager.mjs';
import { SessionManager } from './session-manager.mjs';
import { SettingsManager } from './settings-manager.mjs';
import { CoreStateStore } from './core-state-store.mjs';
import { ExtensionHostManager } from './extension-host-manager.mjs';
import { TaskRuntimeManager } from './task-runtime-manager.mjs';

export class ProjectBootstrap {
  constructor(options = {}) {
    this.workspace = new WorkspaceManager({ maxRecent: options.maxRecent || 20 });
    this.session = new SessionManager();
    this.settings = new SettingsManager({ locale: 'zh-CN' });
    this.extensionHost = new ExtensionHostManager();
    this.taskRuntime = new TaskRuntimeManager();

    this.ownerId = String(options.ownerId || `owner_${process.pid}_${Date.now()}`);
    this.ownerLeaseMs = options.ownerLeaseMs || 30_000;

    const stateFile = options.stateFile || (options.dataDir ? path.join(options.dataDir, 'core-state.json') : undefined);
    this.store = new CoreStateStore(stateFile);
  }

  initialize(payload = {}) {
    this.restore();

    let ownership = this.session.claimOwnership(payload.ownerId || this.ownerId, {
      leaseMs: payload.ownerLeaseMs || this.ownerLeaseMs,
      force: payload.forceTakeover === true
    });

    if (!ownership.acquired && isLikelyDeadOwner(ownership.owner?.id)) {
      ownership = this.session.claimOwnership(payload.ownerId || this.ownerId, {
        leaseMs: payload.ownerLeaseMs || this.ownerLeaseMs,
        force: true
      });
    }

    let ws = this.workspace.getCurrent();
    if (!ws || payload.forceWorkspace) {
      ws = this.workspace.openWorkspace({
        path: String(payload.workspacePath || '/tmp/reconstructed-project'),
        kind: payload.kind || 'folder',
        roots: payload.roots
      });
    }

    let sess;
    if (ownership.acquired) {
      sess = this.session.startSession(
        { userId: payload.userId || 'anonymous', workspaceId: ws.id },
        { resumeIfActive: true }
      );
      this.session.recoverStale();
    } else {
      sess = this.session.markConflict({
        userId: payload.userId || 'anonymous',
        workspaceId: ws.id,
        conflictWith: ownership.owner?.id
      });
    }

    const extension = this.extensionHost.start({ workspaceId: ws.id, workspacePath: ws.path, sessionId: sess.id });
    const tasks = this.taskRuntime.bootstrap({ workspaceId: ws.id, workspacePath: ws.path });

    this.persist();
    return {
      workspace: ws,
      session: sess,
      ownership,
      extension,
      tasks,
      settings: this.settings.getAll({ workspaceId: ws.id })
    };
  }

  restore() {
    const state = this.store.read();
    this.workspace.restore(state.workspace);
    this.session.restore(state.session);
    this.settings.restore(state.settings);
  }

  persist() {
    this.store.write(this.snapshot());
  }

  openWorkspace(payload = {}) {
    const ws = this.workspace.openWorkspace(payload);
    const currentSession = this.session.getSession();
    if (currentSession?.state === 'active') {
      this.session.startSession({
        userId: currentSession.userId,
        workspaceId: ws.id
      });
    }
    this.extensionHost.onWorkspaceChanged(ws.id, ws.path);
    this.taskRuntime.onWorkspaceChanged(ws.id, ws.path);
    this.persist();
    return ws;
  }

  getSession() {
    return this.session.getSession();
  }

  getOwnership() {
    return this.session.getOwnership();
  }

  heartbeat(ownerId, leaseMs) {
    const touched = this.session.touchOwnership(ownerId || this.ownerId, leaseMs || this.ownerLeaseMs);
    this.persist();
    return touched;
  }

  forceTakeover(ownerId) {
    const ownership = this.session.claimOwnership(ownerId || this.ownerId, {
      leaseMs: this.ownerLeaseMs,
      force: true
    });
    this.persist();
    return ownership;
  }

  endSession(ownerId) {
    this.session.endSession();
    this.session.releaseOwnership(ownerId || this.ownerId);
    this.extensionHost.stop();
    this.persist();
  }

  setSetting(payload = {}) {
    this.settings.set(payload.key, payload.value, payload.layer || 'user', payload.workspaceId);
    this.persist();
    return this.settings.getAll({ workspaceId: payload.workspaceId });
  }

  mergeRemoteSettings(payload = {}) {
    const changes = Array.isArray(payload.changes) ? payload.changes : [];
    const result = this.settings.mergeRemote(changes, {
      policy: payload.policy || 'version-first',
      syncId: payload.syncId,
      serverRevisionId: payload.serverRevisionId
    });
    this.persist();
    return {
      ...result,
      conflicts: this.settings.getConflicts(),
      syncStatus: this.settings.getSyncStatus()
    };
  }

  getSetting(payload = {}) {
    if (payload.key) {
      return this.settings.get(String(payload.key), { workspaceId: payload.workspaceId });
    }
    return this.settings.getAll({ workspaceId: payload.workspaceId });
  }

  getSettingConflicts() {
    return this.settings.getConflicts();
  }

  getSettingSyncStatus() {
    return this.settings.getSyncStatus();
  }

  getExtensionHostStatus() {
    return this.extensionHost.snapshot();
  }

  restartExtensionHost(payload = {}) {
    const currentWorkspace = this.workspace.getCurrent();
    const status = this.extensionHost.restart({
      workspaceId: payload.workspaceId || currentWorkspace?.id,
      workspacePath: payload.workspacePath || currentWorkspace?.path,
      sessionId: this.session.getSession()?.id,
      reason: payload.reason || 'manual'
    });
    this.persist();
    return status;
  }

  crashExtensionHost(payload = {}) {
    const result = this.extensionHost.simulateCrash(payload.reason || 'manual-crash');
    this.persist();
    return result;
  }

  listTasks() {
    return this.taskRuntime.listTasks();
  }

  async runTask(payload = {}) {
    const currentWorkspace = this.workspace.getCurrent();
    const run = await this.taskRuntime.runTask({
      ...payload,
      workspaceId: payload.workspaceId || currentWorkspace?.id,
      workspacePath: payload.workspacePath || currentWorkspace?.path
    });
    this.persist();
    return run;
  }

  getTaskHistory() {
    return this.taskRuntime.getRunHistory();
  }

  snapshot() {
    return {
      workspace: this.workspace.snapshot(),
      session: this.session.snapshot(),
      settings: this.settings.snapshot(),
      extensionHost: this.extensionHost.snapshot(),
      taskRuntime: this.taskRuntime.snapshot()
    };
  }
}

function isLikelyDeadOwner(ownerId) {
  const parsed = parseOwnerPid(ownerId);
  if (!parsed) return false;
  try {
    process.kill(parsed, 0);
    return false;
  } catch {
    return true;
  }
}

function parseOwnerPid(ownerId) {
  const id = String(ownerId || '');
  const match = /^shell_(\d+)_/.exec(id);
  if (!match) return undefined;
  const pid = Number(match[1]);
  return Number.isFinite(pid) ? pid : undefined;
}
