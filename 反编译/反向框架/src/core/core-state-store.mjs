import fs from 'node:fs';
import path from 'node:path';

const EMPTY_STATE = {
  workspace: { current: undefined, recent: [] },
  session: { session: undefined, owner: undefined },
  settings: { user: {}, workspace: {}, remote: {}, remoteMeta: {}, conflicts: [], syncStatus: {} }
};

export class CoreStateStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  read() {
    if (!this.filePath) return cloneEmpty();
    if (!fs.existsSync(this.filePath)) return cloneEmpty();
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);

      const sessionParsed = normalizeSession(parsed?.session);

      return {
        workspace: {
          current: parsed?.workspace?.current,
          recent: Array.isArray(parsed?.workspace?.recent) ? parsed.workspace.recent : []
        },
        session: sessionParsed,
        settings: {
          user: parsed?.settings?.user || {},
          workspace: parsed?.settings?.workspace || {},
          remote: parsed?.settings?.remote || {},
          remoteMeta: parsed?.settings?.remoteMeta || {},
          conflicts: Array.isArray(parsed?.settings?.conflicts) ? parsed.settings.conflicts : [],
          syncStatus: parsed?.settings?.syncStatus || {}
        }
      };
    } catch {
      return cloneEmpty();
    }
  }

  write(state) {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}

function normalizeSession(input) {
  if (!input) return { session: undefined, owner: undefined };
  if (input.session !== undefined || input.owner !== undefined) {
    return {
      session: input.session,
      owner: input.owner
    };
  }

  // backward compatibility: old shape stored raw session object.
  return {
    session: input,
    owner: undefined
  };
}

function cloneEmpty() {
  return {
    workspace: { current: undefined, recent: [] },
    session: { session: undefined, owner: undefined },
    settings: { user: {}, workspace: {}, remote: {}, remoteMeta: {}, conflicts: [], syncStatus: {} }
  };
}
