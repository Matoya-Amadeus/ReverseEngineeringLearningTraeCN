function normalizeRoots(input) {
  if (!Array.isArray(input?.roots)) return [];
  return input.roots.map((r) => String(r || '')).filter(Boolean);
}

export class WorkspaceManager {
  constructor(options = {}) {
    this.maxRecent = options.maxRecent || 20;
    this.current = undefined;
    this.recent = [];
  }

  openWorkspace(input) {
    const roots = normalizeRoots(input);
    const isMultiRoot = roots.length > 1 || input?.kind === 'multi-root';

    const workspace = {
      id: `ws_${Date.now()}`,
      path: String(input?.path || (roots[0] || '')),
      kind: isMultiRoot ? 'multi-root' : (input?.kind || 'folder'),
      roots,
      openedAt: new Date().toISOString()
    };
    if (!workspace.path) {
      throw new Error('workspace path required');
    }

    this.current = workspace;
    this.recent = [workspace, ...this.recent.filter((x) => x.path !== workspace.path)].slice(0, this.maxRecent);
    return workspace;
  }

  restore(snapshot = {}) {
    this.current = snapshot.current;
    this.recent = Array.isArray(snapshot.recent) ? snapshot.recent.slice(0, this.maxRecent) : [];
  }

  getCurrent() {
    return this.current;
  }

  listRecent() {
    return [...this.recent];
  }

  snapshot() {
    return {
      current: this.current,
      recent: [...this.recent]
    };
  }
}
