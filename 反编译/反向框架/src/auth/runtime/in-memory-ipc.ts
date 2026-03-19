type Handler = (...args: any[]) => any;

export class InMemoryIpc {
  private readonly handlers = new Map<string, Handler>();
  private readonly listeners = new Map<string, Handler[]>();

  handle(channel: string, fn: Handler): void {
    this.handlers.set(channel, fn);
  }

  on(channel: string, fn: Handler): void {
    const list = this.listeners.get(channel) || [];
    list.push(fn);
    this.listeners.set(channel, list);
  }

  async invoke<T = any>(channel: string, ...args: any[]): Promise<T> {
    const h = this.handlers.get(channel);
    if (!h) throw new Error(`No handler for channel: ${channel}`);
    return h({ sender: { id: 'sandbox' } }, ...args) as T;
  }

  emit(channel: string, ...args: any[]): void {
    const list = this.listeners.get(channel) || [];
    for (const fn of list) fn({ sender: { id: 'sandbox' } }, ...args);
  }
}
