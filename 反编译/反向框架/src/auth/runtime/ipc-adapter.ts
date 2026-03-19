import { AuthError } from '../errors/auth-error';

export interface IpcChannelSpec {
  handle: string[];
  on: string[];
}

export interface IpcMainLike {
  handle: (channel: string, fn: (...args: any[]) => any) => void;
  on: (channel: string, fn: (...args: any[]) => void) => void;
}

export function validateIpcChannels(spec: IpcChannelSpec, available: string[]): void {
  const expected = [...spec.handle, ...spec.on];
  const missing = expected.filter((ch) => !available.includes(ch));
  if (missing.length > 0) {
    throw new AuthError({ code: 'IPC_CHANNEL_MISMATCH', message: `missing ipc channels: ${missing.join(', ')}`, details: { missing } });
  }
}

export class IpcAdapter {
  constructor(private readonly ipc: IpcMainLike, private readonly spec: IpcChannelSpec) {}

  register(registerFn: (ipc: IpcMainLike) => void, availableChannels?: string[]): void {
    if (availableChannels) validateIpcChannels(this.spec, availableChannels);
    registerFn(this.ipc);
  }
}
