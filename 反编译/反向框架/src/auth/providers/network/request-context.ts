import { randomUUID } from 'node:crypto';
import type { ProtocolProvider } from './protocol-requester';

export interface ProtocolRequestContext {
  requestId: string;
  traceId: string;
  deviceId: string;
  appVersion: string;
  platform: string;
  authScope: string;
  region?: string;
  nonce: string;
  ts: string;
}

export function createProtocolContext(input: {
  provider: ProtocolProvider;
  traceId?: string;
  requestId?: string;
  authScope?: string;
  region?: string;
  appVersion?: string;
  platform?: string;
  deviceId?: string;
}): ProtocolRequestContext {
  const ts = Date.now().toString();
  const requestId = input.requestId || randomUUID();
  const traceId = input.traceId || requestId;

  return {
    requestId,
    traceId,
    deviceId: input.deviceId || process.env.TRAE_AUTH_DEVICE_ID || 'reconstructed-device',
    appVersion: input.appVersion || process.env.TRAE_AUTH_APP_VERSION || 'reconstructed-0.2',
    platform: input.platform || process.env.TRAE_AUTH_PLATFORM || process.platform,
    authScope: input.authScope || input.provider,
    region: input.region,
    nonce: randomUUID().replace(/-/g, '').slice(0, 16),
    ts
  };
}
