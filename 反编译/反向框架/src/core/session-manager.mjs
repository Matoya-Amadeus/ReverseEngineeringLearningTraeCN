function nowMs() {
  return Date.now();
}

function isOwnerExpired(owner) {
  if (!owner?.leaseUntil) return true;
  return owner.leaseUntil <= nowMs();
}

export class SessionManager {
  constructor() {
    this.session = undefined;
    this.owner = undefined;
  }

  claimOwnership(ownerId, options = {}) {
    const leaseMs = options.leaseMs || 30_000;
    const request = { id: String(ownerId || ''), leaseMs };
    if (!request.id) {
      throw new Error('owner id required');
    }

    if (!this.owner || isOwnerExpired(this.owner) || this.owner.id === request.id || options.force === true) {
      this.owner = {
        id: request.id,
        leaseUntil: nowMs() + leaseMs,
        updatedAt: new Date().toISOString()
      };
      return { acquired: true, conflict: false, owner: this.owner };
    }

    return { acquired: false, conflict: true, owner: this.owner };
  }

  touchOwnership(ownerId, leaseMs = 30_000) {
    if (!this.owner || this.owner.id !== String(ownerId || '')) {
      return false;
    }
    this.owner = {
      ...this.owner,
      leaseUntil: nowMs() + leaseMs,
      updatedAt: new Date().toISOString()
    };
    return true;
  }

  releaseOwnership(ownerId) {
    if (!this.owner) return;
    if (!ownerId || this.owner.id === String(ownerId)) {
      this.owner = undefined;
    }
  }

  startSession(payload = {}, options = {}) {
    if (options.resumeIfActive && this.session?.state === 'active') {
      return this.session;
    }

    this.session = {
      id: `sess_${Date.now()}`,
      userId: String(payload.userId || 'anonymous'),
      workspaceId: String(payload.workspaceId || ''),
      startedAt: new Date().toISOString(),
      state: 'active'
    };
    return this.session;
  }

  markConflict(payload = {}) {
    this.session = {
      id: `sess_conflict_${Date.now()}`,
      userId: String(payload.userId || 'anonymous'),
      workspaceId: String(payload.workspaceId || ''),
      startedAt: new Date().toISOString(),
      state: 'conflicted',
      conflictWith: payload.conflictWith || this.owner?.id || 'unknown'
    };
    return this.session;
  }

  restore(snapshot = {}) {
    this.session = snapshot.session;
    this.owner = snapshot.owner;
  }

  recoverStale(maxAgeMs = 12 * 60 * 60 * 1000) {
    if (!this.session || this.session.state !== 'active') return this.session;
    const startedAt = Number(new Date(this.session.startedAt || 0));
    if (!startedAt || Date.now() - startedAt > maxAgeMs) {
      this.session = {
        ...this.session,
        state: 'recovered',
        recoveredAt: new Date().toISOString()
      };
    }
    return this.session;
  }

  endSession() {
    if (!this.session) return;
    this.session = {
      ...this.session,
      state: 'closed',
      endedAt: new Date().toISOString()
    };
  }

  getSession() {
    return this.session;
  }

  getOwnership() {
    return this.owner;
  }

  snapshot() {
    return {
      session: this.session,
      owner: this.owner
    };
  }
}
