export class CrashGuard {
  constructor() {
    this.errors = [];
    this.installed = false;
  }

  install() {
    this.installed = true;
  }

  report(error, scope = 'unknown') {
    this.errors.push({
      scope,
      message: String(error?.message || error || 'unknown error'),
      ts: new Date().toISOString()
    });
  }

  snapshot() {
    return { installed: this.installed, errors: [...this.errors] };
  }
}
