import path from 'node:path';
import { MainLifecycle } from './lifecycle.mjs';
import { MenuService } from './menu-service.mjs';
import { TrayService } from './tray-service.mjs';
import { CrashGuard } from './crash-guard.mjs';
import { RendererBridge } from './renderer-bridge.mjs';
import { ProjectBootstrap } from '../core/project-bootstrap.mjs';

function createOwnerId() {
  return `shell_${process.pid}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export class ReconstructedAppShell {
  constructor(options) {
    this.options = options;
    this.ownerId = createOwnerId();

    this.lifecycle = new MainLifecycle();
    this.menu = new MenuService();
    this.tray = new TrayService();
    this.crashGuard = new CrashGuard();
    this.bridge = new RendererBridge();
    this.project = new ProjectBootstrap({
      dataDir: options.dataDir,
      maxRecent: 30,
      ownerId: this.ownerId,
      ownerLeaseMs: 30_000
    });

    this.state = {
      started: false,
      windows: [],
      diagnostics: []
    };
  }

  async start() {
    try {
      this.crashGuard.install();
      this.lifecycle.boot();
      this.menu.buildDefaultMenu();
      this.tray.init();
      this.registerBridge();

      const initialized = this.project.initialize({
        workspacePath: this.options.defaultWorkspace || path.join(this.options.rootDir, 'workspace'),
        userId: 'shell-user',
        ownerId: this.ownerId
      });

      this.state.started = true;
      this.state.diagnostics.push({ stage: 'boot', ok: true, ts: new Date().toISOString() });

      const mainWindow = {
        id: 'main',
        route: 'home',
        title: 'Trae Reconstructed',
        visible: true
      };
      this.state.windows.push(mainWindow);

      this.lifecycle.ready();
      this.bridge.dispatch('shell:ready', {
        windowId: mainWindow.id,
        workspaceId: initialized.workspace.id,
        sessionId: initialized.session?.id,
        ownership: initialized.ownership,
        extension: initialized.extension,
        tasks: initialized.tasks,
        ownerId: this.ownerId
      });

      return {
        pid: process.pid,
        rootDir: this.options.rootDir,
        dataDir: this.options.dataDir,
        ownerId: this.ownerId,
        windowCount: this.state.windows.length
      };
    } catch (e) {
      this.crashGuard.report(e, 'shell.start');
      throw e;
    }
  }

  async stop() {
    this.project.endSession(this.ownerId);
    this.tray.dispose();
    this.lifecycle.shutdown();
    this.state.started = false;
  }

  registerBridge() {
    this.bridge.register('shell:get-status', async () => this.getStatus());
    this.bridge.register('shell:ping', async (payload) => ({ pong: true, payload: payload || null }));

    this.bridge.register('workspace:open', async (payload) => this.project.openWorkspace(payload || {}));
    this.bridge.register('workspace:recent', async () => this.project.workspace.listRecent());

    this.bridge.register('session:get', async () => this.project.getSession());
    this.bridge.register('session:ownership', async () => this.project.getOwnership());
    this.bridge.register('session:heartbeat', async (payload) => this.project.heartbeat(payload?.ownerId || this.ownerId, payload?.leaseMs));
    this.bridge.register('session:takeover', async (payload) => this.project.forceTakeover(payload?.ownerId || this.ownerId));

    this.bridge.register('settings:get', async (payload) => this.project.getSetting(payload || {}));
    this.bridge.register('settings:set', async (payload) => {
      if (!payload?.key) throw new Error('settings key required');
      return this.project.setSetting(payload);
    });
    this.bridge.register('settings:merge-remote', async (payload) => this.project.mergeRemoteSettings(payload || {}));
    this.bridge.register('settings:conflicts', async () => this.project.getSettingConflicts());
    this.bridge.register('settings:sync-status', async () => this.project.getSettingSyncStatus());

    this.bridge.register('ext:status', async () => this.project.getExtensionHostStatus());
    this.bridge.register('ext:restart', async (payload) => this.project.restartExtensionHost(payload || {}));
    this.bridge.register('ext:crash', async (payload) => this.project.crashExtensionHost(payload || {}));

    this.bridge.register('task:list', async () => this.project.listTasks());
    this.bridge.register('task:run', async (payload) => this.project.runTask(payload || {}));
    this.bridge.register('task:history', async () => this.project.getTaskHistory());
  }

  getStatus() {
    return {
      started: this.state.started,
      ownerId: this.ownerId,
      windows: this.state.windows,
      diagnostics: this.state.diagnostics,
      lifecycle: this.lifecycle.snapshot(),
      menu: this.menu.snapshot(),
      tray: this.tray.snapshot(),
      crashGuard: this.crashGuard.snapshot(),
      bridge: this.bridge.snapshot(),
      project: this.project.snapshot()
    };
  }
}

export function createDefaultShellOptions(projectRoot) {
  return {
    rootDir: projectRoot,
    dataDir: path.join(projectRoot, '.runtime-data'),
    defaultWorkspace: path.join(projectRoot, 'workspace')
  };
}
