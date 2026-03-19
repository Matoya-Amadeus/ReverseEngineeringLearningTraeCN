export class MainLifecycle {
  constructor() {
    this.state = 'idle';
    this.events = [];
  }

  boot() {
    this.state = 'booted';
    this.events.push({ name: 'boot', ts: new Date().toISOString() });
  }

  ready() {
    this.state = 'ready';
    this.events.push({ name: 'ready', ts: new Date().toISOString() });
  }

  shutdown() {
    this.state = 'stopped';
    this.events.push({ name: 'shutdown', ts: new Date().toISOString() });
  }

  snapshot() {
    return { state: this.state, events: [...this.events] };
  }
}
