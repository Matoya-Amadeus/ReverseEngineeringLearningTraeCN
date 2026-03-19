import type { AuthProvider, CheckTokenResult, UserInfo } from '../types/auth-types';
import { ProtocolRequester } from './network/protocol-requester';
import { requireString } from '../utils/validators';
import { buildBytedanceRegionPayload, buildBytedanceTokenPayload, buildProtocolHint } from './network/request-template';

export class BytedanceProvider implements AuthProvider {
  readonly id = 'bytedance' as const;

  constructor(private readonly protocol: ProtocolRequester, private readonly baseUrl: string) {}

  async getAccountUrl(): Promise<Record<string, unknown>> {
    return { loginHost: this.baseUrl, consoleHost: this.baseUrl, apiHost: this.baseUrl };
  }

  async loginCredentialCallback(payload: Record<string, unknown>) {
    const token = String(payload.originCredential || payload.refreshToken || '');
    if (!token) return { code: 10002, message: 'missing token' };

    try {
      const userInfo = await this.refreshToken(token);
      return { code: 0, userInfo };
    } catch (e: any) {
      return { code: 10002, message: String(e?.message || 'login failed') };
    }
  }

  async refreshToken(refreshToken: string, current?: UserInfo): Promise<UserInfo> {
    if (!refreshToken) throw new Error('RefreshTokenError:TokenNullError');

    const jwt = await this.protocol.request<any>({
      provider: 'bytedance',
      path: '/api/v2/GetUserToken',
      headers: { 'X-Cloudide-Token': refreshToken },
      ...buildProtocolHint('bytedance', current),
      data: buildBytedanceTokenPayload(refreshToken, current)
    });

    const reg = await this.protocol.request<any>({
      provider: 'bytedance',
      path: '/api/v2/GetUserNativeRegion',
      headers: { 'X-Cloudide-Token': refreshToken },
      ...buildProtocolHint('bytedance', current),
      data: buildBytedanceRegionPayload(current)
    });

    const token = requireString(jwt?.Result?.Token, 'bytedance.Result.Token');

    return {
      userId: String(jwt?.Result?.UserID || ''),
      token,
      refreshToken,
      expiredAt: String(jwt?.Result?.ExpiredAt || ''),
      account: {
        scope: 'bytedance',
        storeCountryCode: '',
        userTag: 'row',
        storeRegion: 'SG'
      },
      userRegion: { _aiRegion: reg?.Result?.AIRegion }
    };
  }

  async checkToken(): Promise<CheckTokenResult> {
    return { isValid: true };
  }

  async logout(): Promise<void> {
    // upstream does not hard-require bytedance logout RPC in auth reconstruction phase
  }
}
