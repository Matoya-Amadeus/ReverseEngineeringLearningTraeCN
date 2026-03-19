export class MenuService {
  constructor() {
    this.menu = [];
  }

  buildDefaultMenu() {
    this.menu = [
      { id: 'file', label: 'File' },
      { id: 'edit', label: 'Edit' },
      { id: 'view', label: 'View' },
      { id: 'help', label: 'Help' }
    ];
    return this.menu;
  }

  snapshot() {
    return [...this.menu];
  }
}
