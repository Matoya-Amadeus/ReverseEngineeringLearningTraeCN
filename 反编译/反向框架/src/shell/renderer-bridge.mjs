export class RendererBridge {
  constructor() {
    this.handlers = new Map();
    this.messages = [];
  }

  register(channel, fn) {
    this.handlers.set(channel, fn);
  }

  async invoke(channel, payload) {
    this.messages.push({ direction: 'renderer->main', channel, payload, ts: new Date().toISOString() });
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`bridge handler missing: ${channel}`);
    }
    return await handler(payload);
  }

  dispatch(channel, payload) {
    this.messages.push({ direction: 'main->renderer', channel, payload, ts: new Date().toISOString() });
  }

  snapshot() {
    return {
      registeredChannels: Array.from(this.handlers.keys()),
      messages: [...this.messages]
    };
  }
}
