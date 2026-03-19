import path from 'node:path';
import { ReconstructedAppShell } from '../../src/shell/app-shell.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const rootDir = `/tmp/reconstructed-shell-${Date.now()}`;
  const dataDir = path.join(rootDir, '.runtime-data');

  const shellA = new ReconstructedAppShell({
    rootDir,
    dataDir,
    defaultWorkspace: path.join(rootDir, 'workspace')
  });

  await shellA.start();

  const statusA = shellA.getStatus();
  assert(statusA.started === true, 'shell A should be started');
  assert(statusA.lifecycle.state === 'ready', 'shell A lifecycle should be ready');

  for (const ch of [
    'shell:get-status',
    'shell:ping',
    'workspace:open',
    'workspace:recent',
    'session:get',
    'session:ownership',
    'session:heartbeat',
    'session:takeover',
    'settings:get',
    'settings:set',
    'settings:merge-remote',
    'settings:conflicts',
    'settings:sync-status',
    'ext:status',
    'ext:restart',
    'ext:crash',
    'task:list',
    'task:run',
    'task:history'
  ]) {
    assert(statusA.bridge.registeredChannels.includes(ch), `bridge channel missing: ${ch}`);
  }

  const extStatus1 = await shellA.bridge.invoke('ext:status');
  assert(extStatus1.running === true, 'extension host should be running');
  assert(extStatus1.pid, 'extension host should expose isolated pid');

  const extStatus2 = await shellA.bridge.invoke('ext:restart', { reason: 'contract-test' });
  assert(extStatus2.bootCount >= 2, 'extension host restart should increase boot count');

  const extBootBeforeCrash = extStatus2.bootCount;
  await shellA.bridge.invoke('ext:crash', { reason: 'contract-crash' });
  await sleep(260);
  const extStatusAfterCrash = await shellA.bridge.invoke('ext:status');
  assert(extStatusAfterCrash.running === true, 'extension host should auto-restart after crash');
  assert(extStatusAfterCrash.bootCount > extBootBeforeCrash, 'auto-restart should increase extension host boot count');

  const tasks = await shellA.bridge.invoke('task:list');
  assert(Array.isArray(tasks) && tasks.length >= 3, 'task catalog should exist');

  const taskRun = await shellA.bridge.invoke('task:run', { name: 'test' });
  assert(taskRun.status === 'completed', 'task run should complete');
  assert(taskRun.stdout.includes('recon-test-ok'), 'task run should capture subprocess output');

  const taskHistory = await shellA.bridge.invoke('task:history');
  assert(Array.isArray(taskHistory) && taskHistory.length >= 1, 'task history should include executed task');

  const ownershipA = await shellA.bridge.invoke('session:ownership');
  assert(ownershipA?.id === shellA.ownerId, 'shell A should own the session');

  const heartbeat = await shellA.bridge.invoke('session:heartbeat', { leaseMs: 45_000 });
  assert(heartbeat === true, 'session heartbeat should succeed for owner');

  const pong = await shellA.bridge.invoke('shell:ping', { test: true });
  assert(pong?.pong === true, 'bridge ping should return pong');

  await shellA.bridge.invoke('settings:set', { key: 'locale', value: 'en-US', layer: 'user' });

  await shellA.bridge.invoke('settings:merge-remote', {
    policy: 'version-first',
    changes: [{ key: 'theme', value: 'light', version: 1, source: 'remote-a', updatedAt: '2026-01-01T00:00:00.000Z' }]
  });

  const mergeApplied = await shellA.bridge.invoke('settings:merge-remote', {
    policy: 'version-first',
    syncId: 'sync-shell-1',
    serverRevisionId: 'srv-shell-3',
    changes: [{ key: 'theme', value: 'sunrise', version: 4, revisionId: 'rr-3', source: 'remote-b', updatedAt: '2026-02-01T00:00:00.000Z' }]
  });
  assert(mergeApplied.applied >= 1, 'newer remote version should apply');
  assert(mergeApplied.ack?.entries?.length === 1, 'merge ack should include one entry');
  assert(mergeApplied.syncStatus?.lastServerRevisionId === 'srv-shell-3', 'merge sync status revision should match');

  const syncStatus = await shellA.bridge.invoke('settings:sync-status');
  assert(syncStatus.lastSyncId === 'sync-shell-1', 'sync status should expose latest sync id');

  const ws = await shellA.bridge.invoke('workspace:open', {
    kind: 'multi-root',
    roots: [path.join(rootDir, 'ws2'), path.join(rootDir, 'ws3')]
  });
  assert(ws.kind === 'multi-root', 'workspace should be multi-root');

  await shellA.bridge.invoke('settings:set', { key: 'tabSize', value: 2, layer: 'workspace', workspaceId: ws.id });
  const tabSize = await shellA.bridge.invoke('settings:get', { key: 'tabSize', workspaceId: ws.id });
  assert(tabSize === 2, 'workspace settings should resolve');

  const shellB = new ReconstructedAppShell({
    rootDir,
    dataDir,
    defaultWorkspace: path.join(rootDir, 'workspace')
  });
  await shellB.start();

  const sessB = await shellB.bridge.invoke('session:get');
  assert(sessB?.state === 'conflicted', 'shell B should start in conflicted session state when A owns lock');

  const takeoverB = await shellB.bridge.invoke('session:takeover');
  assert(takeoverB?.acquired === true, 'shell B takeover should acquire ownership');

  await shellA.stop();
  const stoppedA = shellA.getStatus();
  assert(stoppedA.started === false, 'shell A should stop');

  await shellB.stop();
  const stoppedB = shellB.getStatus();
  assert(stoppedB.started === false, 'shell B should stop');

  const shellRestored = new ReconstructedAppShell({
    rootDir,
    dataDir,
    defaultWorkspace: path.join(rootDir, 'workspace')
  });
  await shellRestored.start();

  const restoredRecent = await shellRestored.bridge.invoke('workspace:recent');
  assert(restoredRecent.length >= 2, 'restored recent workspace list missing');
  assert(restoredRecent.some((w) => w.kind === 'multi-root'), 'restored multi-root workspace missing');

  const restoredLocale = await shellRestored.bridge.invoke('settings:get', { key: 'locale' });
  assert(restoredLocale === 'en-US', 'restored user setting missing');

  const restoredTheme = await shellRestored.bridge.invoke('settings:get', { key: 'theme' });
  assert(restoredTheme === 'sunrise', 'restored merged remote setting missing');

  const conflictLog = await shellRestored.bridge.invoke('settings:conflicts');
  assert(Array.isArray(conflictLog), 'settings conflict log should be array');

  await shellRestored.stop();

  console.log('TEST_OK shell_contract');
}

main().catch((e) => {
  console.error('TEST_FAIL shell_contract', e.message);
  process.exit(1);
});
