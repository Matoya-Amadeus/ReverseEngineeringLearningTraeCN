import type { AccountInfo, AuthProvider, CheckTokenResult, UserInfo } from '../types/auth-types';
import { ProtocolRequester } from './network/protocol-requester';
import { requireString } from '../utils/validators';
import { buildCheckLoginPayload, buildExchangeTokenPayload, buildProtocolHint, buildUserInfoPayload } from './network/request-template';

export class SaasProvider implements AuthProvider {
  readonly id = 'saas' as const;

  constructor(private readonly protocol: ProtocolRequester, private readonly apiHost: string, private readonly loginHost: string) {}

  async getAccountUrl(): Promise<Record<string, unknown>> {
    return { loginHost: this.loginHost, consoleHost: this.apiHost, apiHost: this.apiHost };
  }

  async loginCredentialCallback(payload: Record<string, unknown>) {
    const refreshToken = String(payload.refreshToken || '');
    if (!refreshToken) return { code: 10002, message: 'missing refreshToken' };

    try {
      const userInfo = await this.refreshToken(refreshToken);
      return { code: 0, userInfo };
    } catch (e: any) {
      return { code: 10002, message: String(e?.message || 'login failed') };
    }
  }

  async refreshToken(refreshToken: string, current?: UserInfo): Promise<UserInfo> {
    if (!refreshToken) throw new Error('RefreshTokenError:TokenNullError');

    const exchange = await this.protocol.request<any>({
      provider: 'saas',
      path: '/cloudide/api/v3/trae/oauth/ExchangeToken',
      ...buildProtocolHint('saas', current),
      data: buildExchangeTokenPayload('saas', refreshToken, current)
    });

    const token = requireString(exchange?.Data?.Token, 'saas.exchange.Data.Token');

    const user = await this.protocol.request<any>({
      provider: 'saas',
      path: '/cloudide/api/v3/trae/GetUserInfo',
      token,
      ...buildProtocolHint('saas', current),
      data: buildUserInfoPayload('saas', current)
    });

    const account: AccountInfo = {
      scope: 'saas',
      userTag: 'cn',
      storeCountryCode: '',
      storeRegion: 'CN',
      tenant_name: user?.Data?.TenantInfoBase?.TenantName,
      tenant_id: user?.Data?.UserInfo?.TenantID,
      roleId: user?.Data?.RoleInfo?.RoleID
    };

    return {
      userId: String(user?.Data?.UserInfo?.UserID || ''),
      token,
      refreshToken: String(exchange?.Data?.RefreshToken || refreshToken),
      expiredAt: String(exchange?.Data?.TokenExpireAt || ''),
      refreshExpiredAt: String(exchange?.Data?.RefreshExpireAt || ''),
      account
    };
  }

  async checkToken(token: string, current?: UserInfo): Promise<CheckTokenResult> {
    try {
      const r = await this.protocol.request<any>({
        provider: 'saas',
        path: '/cloudide/api/v3/trae/CheckLogin',
        token,
        ...buildProtocolHint('saas', current),
        data: buildCheckLoginPayload('saas', current)
      });
      return (r.code ?? 0) === 0 ? { isValid: true } : { isValid: false, errorCode: r.code };
    } catch (e: any) {
      return { isValid: false, errorCode: String(e?.code || e?.message || 'unknown') };
    }
  }

  async refreshUserInfo(token: string, current?: UserInfo): Promise<AccountInfo> {
    const user = await this.protocol.request<any>({
      provider: 'saas',
      path: '/cloudide/api/v3/trae/GetUserInfo',
      token,
      ...buildProtocolHint('saas', current),
      data: buildUserInfoPayload('saas', current)
    });

    return {
      scope: 'saas',
      userTag: 'cn',
      storeCountryCode: '',
      storeRegion: 'CN',
      tenant_name: user?.Data?.TenantInfoBase?.TenantName,
      tenant_id: user?.Data?.UserInfo?.TenantID,
      roleId: user?.Data?.RoleInfo?.RoleID
    };
  }

  async logout(): Promise<void> {
    // no-op in reconstruction mode
  }
}
