function ts(input) {
  const value = Number(new Date(input || 0));
  return Number.isFinite(value) ? value : 0;
}

function cleanRevisionId(input) {
  if (input === undefined || input === null) return '';
  return String(input);
}

export class SettingsManager {
  constructor(defaults = {}) {
    this.defaults = {
      locale: 'en-US',
      telemetryEnabled: false,
      autoUpdate: false,
      ...defaults
    };
    this.user = {};
    this.workspace = {};
    this.remote = {};
    this.remoteMeta = {};
    this.conflicts = [];
    this.syncStatus = {
      lastSyncId: '',
      lastAckAt: '',
      lastPolicy: 'version-first',
      lastServerRevisionId: '',
      applied: 0,
      rejected: 0,
      total: 0,
      conflictCount: 0
    };
  }

  restore(snapshot = {}) {
    this.user = snapshot.user || {};
    this.workspace = snapshot.workspace || {};
    this.remote = snapshot.remote || {};
    this.remoteMeta = snapshot.remoteMeta || {};
    this.conflicts = Array.isArray(snapshot.conflicts) ? snapshot.conflicts : [];
    this.syncStatus = {
      lastSyncId: snapshot?.syncStatus?.lastSyncId || '',
      lastAckAt: snapshot?.syncStatus?.lastAckAt || '',
      lastPolicy: snapshot?.syncStatus?.lastPolicy || 'version-first',
      lastServerRevisionId: snapshot?.syncStatus?.lastServerRevisionId || '',
      applied: Number(snapshot?.syncStatus?.applied || 0),
      rejected: Number(snapshot?.syncStatus?.rejected || 0),
      total: Number(snapshot?.syncStatus?.total || 0),
      conflictCount: Number(snapshot?.syncStatus?.conflictCount || 0)
    };
  }

  set(key, value, layer = 'user', workspaceId) {
    if (layer === 'user') {
      this.user[key] = value;
      return;
    }

    if (layer === 'remote') {
      this.remote[key] = value;
      const currentVersion = Number(this.remoteMeta[key]?.version || 0);
      this.remoteMeta[key] = {
        version: currentVersion + 1,
        updatedAt: new Date().toISOString(),
        source: 'local-remote-set',
        revisionId: cleanRevisionId(this.remoteMeta[key]?.revisionId)
      };
      return;
    }

    if (layer === 'workspace') {
      const wsId = String(workspaceId || 'default');
      this.workspace[wsId] = this.workspace[wsId] || {};
      this.workspace[wsId][key] = value;
      return;
    }

    throw new Error(`unsupported settings layer: ${layer}`);
  }

  mergeRemote(changes = [], options = {}) {
    const policy = options.policy || 'version-first';
    const syncId = String(options.syncId || `sync_${Date.now()}`);
    const ackedAt = new Date().toISOString();
    const serverRevisionId = cleanRevisionId(options.serverRevisionId || '');

    let applied = 0;
    let rejected = 0;
    const ackEntries = [];

    for (const change of changes) {
      const key = String(change?.key || '');
      if (!key) continue;

      const incomingVersion = Number(change?.version || 0);
      const incomingUpdatedAt = change?.updatedAt || ackedAt;
      const incomingSource = String(change?.source || 'remote-sync');
      const incomingRevisionId = cleanRevisionId(change?.revisionId);

      const localMeta = this.remoteMeta[key] || { version: 0, updatedAt: '1970-01-01T00:00:00.000Z', source: 'none', revisionId: '' };
      const localVersion = Number(localMeta.version || 0);

      let shouldApply = false;
      let reason = 'rejected_version';
      if (incomingVersion > localVersion) {
        shouldApply = true;
        reason = 'applied_newer_version';
      } else if (incomingVersion === localVersion) {
        if (ts(incomingUpdatedAt) >= ts(localMeta.updatedAt)) {
          shouldApply = true;
          reason = 'applied_newer_or_equal_timestamp';
        } else {
          reason = 'rejected_older_timestamp';
        }
      } else if (policy === 'lww' && ts(incomingUpdatedAt) > ts(localMeta.updatedAt)) {
        shouldApply = true;
        reason = 'applied_lww_timestamp';
      }

      if (shouldApply) {
        this.remote[key] = change.value;
        this.remoteMeta[key] = {
          version: incomingVersion,
          updatedAt: incomingUpdatedAt,
          source: incomingSource,
          revisionId: incomingRevisionId || cleanRevisionId(localMeta.revisionId)
        };
        applied += 1;
      } else {
        rejected += 1;
        this.conflicts.push({
          key,
          policy,
          incoming: {
            version: incomingVersion,
            updatedAt: incomingUpdatedAt,
            source: incomingSource,
            revisionId: incomingRevisionId,
            value: change.value
          },
          existing: {
            version: localVersion,
            updatedAt: localMeta.updatedAt,
            source: localMeta.source,
            revisionId: cleanRevisionId(localMeta.revisionId),
            value: this.remote[key]
          },
          ts: ackedAt
        });
      }

      const afterMeta = this.remoteMeta[key] || localMeta;
      ackEntries.push({
        key,
        applied: shouldApply,
        reason,
        incoming: {
          version: incomingVersion,
          updatedAt: incomingUpdatedAt,
          revisionId: incomingRevisionId
        },
        local: {
          version: Number(afterMeta.version || 0),
          updatedAt: afterMeta.updatedAt,
          revisionId: cleanRevisionId(afterMeta.revisionId)
        }
      });
    }

    this.syncStatus = {
      lastSyncId: syncId,
      lastAckAt: ackedAt,
      lastPolicy: policy,
      lastServerRevisionId: serverRevisionId || this.syncStatus.lastServerRevisionId || '',
      applied,
      rejected,
      total: applied + rejected,
      conflictCount: this.conflicts.length
    };

    return {
      policy,
      syncId,
      serverRevisionId: this.syncStatus.lastServerRevisionId,
      applied,
      rejected,
      conflictCount: this.conflicts.length,
      ack: {
        syncId,
        ackedAt,
        serverRevisionId: this.syncStatus.lastServerRevisionId,
        entries: ackEntries
      }
    };
  }

  getConflicts() {
    return [...this.conflicts];
  }

  getSyncStatus() {
    return { ...this.syncStatus };
  }

  get(key, options = {}) {
    const wsId = options.workspaceId ? String(options.workspaceId) : undefined;
    const workspaceLayer = wsId ? this.workspace[wsId] || {} : {};

    if (key in workspaceLayer) return workspaceLayer[key];
    if (key in this.remote) return this.remote[key];
    if (key in this.user) return this.user[key];
    return this.defaults[key];
  }

  getAll(options = {}) {
    const wsId = options.workspaceId ? String(options.workspaceId) : undefined;
    const workspaceLayer = wsId ? this.workspace[wsId] || {} : {};
    return { ...this.defaults, ...this.user, ...this.remote, ...workspaceLayer };
  }

  snapshot() {
    return {
      user: { ...this.user },
      workspace: { ...this.workspace },
      remote: { ...this.remote },
      remoteMeta: { ...this.remoteMeta },
      conflicts: [...this.conflicts],
      syncStatus: { ...this.syncStatus }
    };
  }
}
