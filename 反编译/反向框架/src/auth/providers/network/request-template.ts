import type { UserInfo } from '../../types/auth-types';
import type { ProtocolProvider } from './protocol-requester';

interface RequestMeta {
  ideVersion: string;
  appVersion: string;
  platform: string;
  region: string;
  userId: string;
}

export function buildExchangeTokenPayload(provider: ProtocolProvider, refreshToken: string, current?: UserInfo): Record<string, unknown> {
  const meta = resolveMeta(provider, current);
  return {
    RefreshToken: refreshToken,
    ClientSecret: '-',
    UserID: meta.userId,
    IDEVersion: meta.ideVersion,
    AppVersion: meta.appVersion,
    Platform: meta.platform,
    Region: meta.region,
    Channel: provider,
    NonceMode: 'v2'
  };
}

export function buildUserInfoPayload(provider: ProtocolProvider, current?: UserInfo): Record<string, unknown> {
  const meta = resolveMeta(provider, current);
  return {
    UserID: meta.userId,
    IDEVersion: meta.ideVersion,
    AppVersion: meta.appVersion,
    Platform: meta.platform,
    Region: meta.region,
    IncludePolicy: true,
    IncludeEntitlement: true
  };
}

export function buildCheckLoginPayload(provider: ProtocolProvider, current?: UserInfo): Record<string, unknown> {
  const meta = resolveMeta(provider, current);
  return {
    UserID: meta.userId,
    IDEVersion: meta.ideVersion,
    AppVersion: meta.appVersion,
    Platform: meta.platform,
    Region: meta.region,
    CheckMode: 'strict'
  };
}

export function buildBytedanceTokenPayload(seedToken: string, current?: UserInfo): Record<string, unknown> {
  const meta = resolveMeta('bytedance', current);
  return {
    Token: seedToken,
    IDEVersion: meta.ideVersion,
    AppVersion: meta.appVersion,
    Platform: meta.platform,
    Region: meta.region,
    Scene: 'trae_auth_login',
    NeedTenantInfo: true
  };
}

export function buildBytedanceRegionPayload(current?: UserInfo): Record<string, unknown> {
  const meta = resolveMeta('bytedance', current);
  return {
    IDEVersion: meta.ideVersion,
    AppVersion: meta.appVersion,
    Platform: meta.platform,
    Region: meta.region,
    Scene: 'trae_region_probe'
  };
}

export function buildGenerateTempTokenPayload(current?: UserInfo): Record<string, unknown> {
  const meta = resolveMeta('marscode', current);
  return {
    IDEVersion: meta.ideVersion,
    AppVersion: meta.appVersion,
    Platform: meta.platform,
    Region: meta.region,
    Scene: 'trae_temp_token'
  };
}

export function buildProtocolHint(provider: ProtocolProvider, current?: UserInfo): { authScope: string; region: string } {
  const meta = resolveMeta(provider, current);
  return {
    authScope: provider,
    region: meta.region
  };
}

function resolveMeta(provider: ProtocolProvider, current?: UserInfo): RequestMeta {
  const regionByProvider: Record<ProtocolProvider, string> = {
    bytedance: 'SG',
    marscode: 'ROW',
    saas: 'CN'
  };

  const userId = String(current?.userId || '');
  const storeRegion = String(current?.account?.storeRegion || '').toUpperCase();

  return {
    ideVersion: process.env.TRAE_AUTH_IDE_VERSION || 'reconstructed-0.2.1',
    appVersion: process.env.TRAE_AUTH_APP_VERSION || 'reconstructed-0.2.1',
    platform: process.env.TRAE_AUTH_PLATFORM || process.platform,
    region: storeRegion || process.env.TRAE_AUTH_REGION || regionByProvider[provider],
    userId
  };
}
