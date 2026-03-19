import path from 'node:path';
import { ProjectBootstrap } from '../../src/core/project-bootstrap.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const root = `/tmp/core-contract-${Date.now()}`;
  const dataDir = path.join(root, '.runtime-data');

  const project = new ProjectBootstrap({ dataDir, ownerId: 'owner_A' });
  const initialized = project.initialize({ workspacePath: '/tmp/core-workspace', userId: 'u_core' });

  assert(initialized.workspace.path === '/tmp/core-workspace', 'workspace path mismatch');
  assert(initialized.session.userId === 'u_core', 'session user mismatch');
  assert(initialized.session.state === 'active', 'session should be active');
  assert(initialized.ownership.acquired === true, 'owner A should acquire session ownership');
  assert(initialized.settings.locale === 'zh-CN', 'default locale mismatch');
  assert(initialized.extension.running === true, 'extension host should be started on initialize');
  assert(initialized.extension.pid, 'extension host should run in isolated process');
  assert(initialized.tasks.taskCount >= 1, 'task runtime should bootstrap on initialize');

  project.setSetting({ key: 'locale', value: 'en-US', layer: 'user' });
  project.setSetting({ key: 'theme', value: 'dark', layer: 'remote' });
  project.setSetting({ key: 'tabSize', value: 2, layer: 'workspace', workspaceId: initialized.workspace.id });

  const mergeRemoteR1 = project.mergeRemoteSettings({
    policy: 'version-first',
    changes: [{ key: 'theme', value: 'light', version: 1, source: 'cloud-1', updatedAt: '2026-01-01T00:00:00.000Z' }]
  });
  assert(mergeRemoteR1.rejected >= 1, 'older remote version should be rejected');

  const mergeRemoteR2 = project.mergeRemoteSettings({
    policy: 'version-first',
    syncId: 'sync-core-1',
    serverRevisionId: 'srv-rev-11',
    changes: [{ key: 'theme', value: 'sunrise', version: 4, revisionId: 'r-11', source: 'cloud-2', updatedAt: '2026-02-01T00:00:00.000Z' }]
  });
  assert(mergeRemoteR2.applied >= 1, 'newer remote version should be applied');
  assert(mergeRemoteR2.ack?.entries?.length === 1, 'merge ack entries should be returned');
  assert(mergeRemoteR2.ack?.entries?.[0]?.applied === true, 'merge ack should mark apply=true');
  assert(mergeRemoteR2.syncStatus?.lastServerRevisionId === 'srv-rev-11', 'sync status should track server revision');

  assert(project.getSetting({ key: 'locale' }) === 'en-US', 'user layer setting failed');
  assert(project.getSetting({ key: 'theme' }) === 'sunrise', 'remote merge setting failed');
  assert(project.getSetting({ key: 'tabSize', workspaceId: initialized.workspace.id }) === 2, 'workspace layer setting failed');

  const extRestart = project.restartExtensionHost({ reason: 'test-restart' });
  assert(extRestart.bootCount >= 2, 'extension host restart should increase boot count');
  const extStatus = project.getExtensionHostStatus();
  assert(extStatus.running === true, 'extension host should be running');

  const preCrashBootCount = extStatus.bootCount;
  project.crashExtensionHost({ reason: 'test-crash' });
  await sleep(260);
  const postCrash = project.getExtensionHostStatus();
  assert(postCrash.running === true, 'extension host should auto-restart after crash');
  assert(postCrash.bootCount > preCrashBootCount, 'extension host boot count should increase after crash restart');
  assert(postCrash.restartHistory.some((x) => x.reason === 'auto:crash-restart'), 'crash auto-restart record missing');

  const taskList = project.listTasks();
  assert(taskList.length >= 3, 'task catalog should contain baseline tasks');
  const taskRun = await project.runTask({ name: 'test' });
  assert(taskRun.status === 'completed', 'task run should complete in reconstruction mode');
  assert(taskRun.stdout.includes('recon-test-ok'), 'task run should capture real subprocess stdout');
  assert(project.getTaskHistory().length >= 1, 'task history should record run');

  const ws2 = project.openWorkspace({
    kind: 'multi-root',
    roots: ['/tmp/core-workspace-2', '/tmp/core-workspace-3']
  });
  assert(!!ws2.id, 'workspace id missing');
  assert(ws2.kind === 'multi-root', 'workspace kind should be multi-root');
  assert(Array.isArray(ws2.roots) && ws2.roots.length === 2, 'multi-root paths missing');
  assert(project.workspace.listRecent().length >= 2, 'recent workspace index should include multiple entries');

  const projectB = new ProjectBootstrap({ dataDir, ownerId: 'owner_B' });
  const initializedB = projectB.initialize({ userId: 'u_core' });
  assert(initializedB.ownership.acquired === false, 'owner B should not acquire active ownership');
  assert(initializedB.session.state === 'conflicted', 'owner conflict should mark session conflicted');

  const takeover = projectB.forceTakeover('owner_B');
  assert(takeover.acquired === true, 'forced takeover should acquire ownership');

  project.endSession('owner_A');
  assert(project.getSession()?.state === 'closed', 'session should be closed');

  const restored = new ProjectBootstrap({ dataDir, ownerId: 'owner_C' });
  restored.initialize({ userId: 'u_core', forceTakeover: true });
  assert(restored.workspace.listRecent().length >= 2, 'restored recent workspaces missing');
  assert(restored.getSetting({ key: 'theme' }) === 'sunrise', 'restored merged setting missing');
  assert(restored.getSettingConflicts().length >= 1, 'merge conflict log should persist');
  assert(restored.getSettingSyncStatus().lastServerRevisionId === 'srv-rev-11', 'restored sync status should persist');

  restored.endSession('owner_C');
  projectB.endSession('owner_B');

  console.log('TEST_OK core_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL core_contract', e.message);
  process.exit(1);
});
