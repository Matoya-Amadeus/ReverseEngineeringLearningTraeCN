import type { AccountInfo, AuthProvider, CheckTokenResult, UserInfo } from '../types/auth-types';
import { ProtocolRequester } from './network/protocol-requester';
import { requireString } from '../utils/validators';
import { buildCheckLoginPayload, buildExchangeTokenPayload, buildGenerateTempTokenPayload, buildProtocolHint, buildUserInfoPayload } from './network/request-template';

export class MarscodeProvider implements AuthProvider {
  readonly id = 'marscode' as const;

  constructor(private readonly protocol: ProtocolRequester, private readonly apiHost: string) {}

  async getAccountUrl(): Promise<Record<string, unknown>> {
    return { loginHost: this.apiHost, consoleHost: this.apiHost, apiHost: this.apiHost };
  }

  async loginCredentialCallback(payload: Record<string, unknown>) {
    const refreshToken = String(payload.refreshToken || payload.originCredential || '');
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
      provider: 'marscode',
      path: '/cloudide/api/v3/trae/oauth/ExchangeToken',
      ...buildProtocolHint('marscode', current),
      data: buildExchangeTokenPayload('marscode', refreshToken, current)
    });

    const token = requireString(exchange?.Data?.Token, 'marscode.exchange.Data.Token');

    const user = await this.protocol.request<any>({
      provider: 'marscode',
      path: '/cloudide/api/v3/trae/GetUserInfo',
      token,
      ...buildProtocolHint('marscode', current),
      data: buildUserInfoPayload('marscode', current)
    });

    const userId = requireString(user?.UserID || user?.Data?.UserInfo?.UserID, 'marscode.user.UserID');

    const account: AccountInfo = {
      scope: 'marscode',
      userTag: current?.account?.userTag || 'row',
      storeCountryCode: String(user?.StoreCountry || ''),
      storeRegion: String(current?.account?.storeRegion || 'UNKNOWN')
    };

    return {
      userId,
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
        provider: 'marscode',
        path: '/cloudide/api/v3/trae/CheckLogin',
        token,
        ...buildProtocolHint('marscode', current),
        data: buildCheckLoginPayload('marscode', current)
      });
      return (r.code ?? 0) === 0 ? { isValid: true } : { isValid: false, errorCode: r.code };
    } catch (e: any) {
      return { isValid: false, errorCode: String(e?.code || e?.message || 'unknown') };
    }
  }

  async refreshUserInfo(token: string, current?: UserInfo): Promise<AccountInfo> {
    const user = await this.protocol.request<any>({
      provider: 'marscode',
      path: '/cloudide/api/v3/trae/GetUserInfo',
      token,
      ...buildProtocolHint('marscode', current),
      data: buildUserInfoPayload('marscode', current)
    });

    return {
      scope: 'marscode',
      userTag: 'row',
      storeCountryCode: String(user?.StoreCountry || ''),
      storeRegion: String(user?.StoreCountry || '') ? 'US' : 'UNKNOWN'
    };
  }

  async generateTempToken(token: string): Promise<{ Token: string; ExpiredAt: string }> {
    const r = await this.protocol.request<any>({
      provider: 'marscode',
      path: '/cloudide/api/v3/trae/GenerateTempToken',
      token,
      ...buildProtocolHint('marscode'),
      data: buildGenerateTempTokenPayload()
    });

    return {
      Token: requireString(r?.Result?.Token, 'marscode.temp.Result.Token'),
      ExpiredAt: requireString(r?.Result?.ExpiredAt, 'marscode.temp.Result.ExpiredAt')
    };
  }

  async logout(): Promise<void> {
    // no-op for reconstruction: upstream logout side-effects are carried by clearing local user state.
  }
}
