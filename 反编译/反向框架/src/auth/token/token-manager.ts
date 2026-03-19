import { CH } from '../types/auth-events';
import type { AuthProviderId, UserInfo } from '../types/auth-types';
import { ProviderRegistry } from '../providers/provider-registry';

export type RefreshAction = 'CREATE_TOKEN' | 'REFRESH_TOKEN';
export type TokenAction = 'need-login' | 'need-refresh' | 'need-update' | 'valid-token';

export interface TokenManagerDeps {
  providers: ProviderRegistry;
  getUserInfo: () => UserInfo | undefined;
  setUserInfo: (userInfo?: UserInfo, forceLogout?: boolean) => void;
  broadcast: (channel: string, payload?: unknown) => void;
  decideTokenAction?: (userInfo: UserInfo) => TokenAction;
  writeTempToken?: (token: string) => void;
  clearTempTokenFile?: () => void;
}

export class TokenManager {
  private refreshTokenPromise?: Promise<UserInfo | undefined>;
  private strictCheckPromise?: Promise<void>;
  private refreshTempTokenPromise?: Promise<void>;
  private jwtRefreshTimer?: ReturnType<typeof setTimeout>;
  private jwtEnabled = false;
  private disableRefreshFlag = false;

  constructor(private readonly deps: TokenManagerDeps) {}

  verifyTokenInBackground(user?: UserInfo): void {
    if (!user?.refreshToken || !user?.account?.scope) return;

    const action = this.deps.decideTokenAction ? this.deps.decideTokenAction(user) : 'valid-token';
    if (action === 'need-login' || action === 'need-refresh' || action === 'need-update') {
      void this.refreshUserInfoByToken(user.refreshToken, 'REFRESH_TOKEN', user.account.scope, user);
      return;
    }

    void this.checkLoginToken(user);
  }

  async refreshUserInfoByToken(
    refreshToken: string,
    action: RefreshAction,
    scope: AuthProviderId,
    current?: UserInfo
  ): Promise<UserInfo | undefined> {
    if (this.disableRefreshFlag) return undefined;

    const provider = this.deps.providers.getProvider(scope);
    if (!provider) return undefined;

    if (this.refreshTokenPromise) return this.refreshTokenPromise;

    this.refreshTokenPromise = (async () => {
      try {
        const refreshed = await provider.refreshToken(refreshToken, current ?? this.deps.getUserInfo());
        this.deps.setUserInfo(refreshed, false);
        return refreshed;
      } catch (e: any) {
        const message = String(e?.message || '');
        let forceLogout = false;

        if (
          message.includes('RefreshTokenError:TokenVersionError:1.0') ||
          message.includes('RefreshTokenError:TokenNullError') ||
          message.includes('OauthService:UserInfoNotMatchError')
        ) {
          this.disableRefreshFlag = true;
        } else if (message.includes('RefreshTokenInvalid')) {
          forceLogout = true;
        }

        if (action === 'CREATE_TOKEN' || forceLogout) {
          this.deps.setUserInfo(undefined, forceLogout);
        }

        return undefined;
      } finally {
        this.refreshTokenPromise = undefined;
      }
    })();

    return this.refreshTokenPromise;
  }

  async checkLoginToken(user: UserInfo): Promise<void> {
    if (this.strictCheckPromise) return this.strictCheckPromise;

    const provider = this.deps.providers.getProvider(user.account.scope);
    if (!provider) return;

    this.strictCheckPromise = (async () => {
      try {
        const result = await provider.checkToken(user.token, user).catch(() => ({ isValid: true }));
        if (!result.isValid) {
          this.deps.setUserInfo(undefined, true);
          this.deps.broadcast(CH.MAIN_TO_SANDBOX_SHOW_AUTH_INVALID_DIALOG, { errorCode: result.errorCode });
        }
      } finally {
        this.strictCheckPromise = undefined;
      }
    })();

    return this.strictCheckPromise;
  }

  async handleForceRefreshUserInfo(_force?: boolean): Promise<void> {
    const user = this.deps.getUserInfo();
    if (!user?.account?.scope) return;

    const provider = this.deps.providers.getProvider(user.account.scope);
    if (!provider?.refreshUserInfo) return;

    try {
      const account = await provider.refreshUserInfo(user.token, user);
      const merged: UserInfo = { ...user, account };
      this.deps.setUserInfo(merged, false);
    } catch {
      // Keep behavior consistent with upstream: refreshUserInfo failure should not force logout directly.
    }
  }

  setJwtTokenEnabled(enabled: boolean): void {
    this.jwtEnabled = enabled;

    if (!enabled) {
      if (this.jwtRefreshTimer) clearTimeout(this.jwtRefreshTimer);
      this.jwtRefreshTimer = undefined;
      this.deps.clearTempTokenFile?.();
      return;
    }

    const current = this.deps.getUserInfo();
    if (current) void this.refreshTempToken(current);
  }

  private async refreshTempToken(user: UserInfo): Promise<void> {
    if (!this.jwtEnabled) return;

    const scope = user.account.scope;
    if (scope !== 'marscode' && scope !== 'bytedance') return;

    const provider = this.deps.providers.getProvider('marscode');
    if (!provider?.generateTempToken) return;

    if (this.refreshTempTokenPromise) return this.refreshTempTokenPromise;

    this.refreshTempTokenPromise = (async () => {
      try {
        const result = await provider.generateTempToken(user.token, user);
        this.deps.writeTempToken?.(result.Token);

        const expiredTs = new Date(result.ExpiredAt).getTime();
        const now = Date.now();
        const remaining = Math.max(0, expiredTs - now);
        const nextDelay = Math.max(Math.floor(remaining / 2), 60_000);

        if (this.jwtRefreshTimer) clearTimeout(this.jwtRefreshTimer);
        this.jwtRefreshTimer = setTimeout(() => {
          const latest = this.deps.getUserInfo();
          if (latest) void this.refreshTempToken(latest);
        }, nextDelay);
      } finally {
        this.refreshTempTokenPromise = undefined;
      }
    })();

    return this.refreshTempTokenPromise;
  }
}
