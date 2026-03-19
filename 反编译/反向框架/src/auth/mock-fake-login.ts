import type { AuthProviderId, UserInfo } from './types/auth-types';

export const FAKE_LOGIN_ENV = 'TRAE_FAKE_LOGIN';

// 仅用于学习/测试：开启后跳过真实登录认证，直接返回本地模拟用户。
export function isFakeLoginEnabled(): boolean {
  const raw = String(process.env[FAKE_LOGIN_ENV] || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

// 仅用于学习/测试：构造可被现有流程消费的最小用户结构。
export function buildFakeUser(provider: AuthProviderId): UserInfo {
  const now = Date.now();
  const tokenTail = Math.random().toString(16).slice(2, 10);
  return {
    userId: 'mock-user',
    token: `mock-token-${provider}-${tokenTail}`,
    refreshToken: `mock-refresh-${provider}-${tokenTail}`,
    expiredAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    refreshExpiredAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    account: {
      scope: provider,
      userTag: 'mock',
      storeCountryCode: 'CN',
      storeRegion: 'SG',
      mockLogin: true
    },
    mockLogin: true,
    mockNotice: '该账号为假登录，仅用于离线学习与测试。'
  };
}
