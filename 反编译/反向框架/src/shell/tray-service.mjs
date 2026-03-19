export class TrayService {
  constructor() {
    this.items = [];
    this.active = false;
  }

  init() {
    this.active = true;
    this.items = [
      { id: 'open', label: 'Open' },
      { id: 'restart', label: 'Restart' },
      { id: 'quit', label: 'Quit' }
    ];
  }

  dispose() {
    this.active = false;
    this.items = [];
  }

  snapshot() {
    return { active: this.active, items: [...this.items] };
  }
}
