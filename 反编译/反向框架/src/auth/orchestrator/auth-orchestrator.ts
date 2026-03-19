import { CH } from '../types/auth-events';
import type { AuthProviderId, LoginExtra, UserInfo } from '../types/auth-types';
import { ProviderRegistry } from '../providers/provider-registry';
import { LoginFlow } from '../login/login-flow';
import { SetupLoginStatusStore } from '../login/setup-login-status';

export interface AuthOrchestratorDeps {
  providers: ProviderRegistry;
  broadcast: (channel: string, payload?: unknown) => void;
  tokenManager: {
    verifyTokenInBackground: (u?: UserInfo) => void;
    handleForceRefreshUserInfo?: (force?: boolean) => Promise<void>;
  };
  loginFlow: LoginFlow;
  setupStatus: SetupLoginStatusStore;
  onLoginSuccess?: (user: UserInfo) => void;
  onLogout?: () => void;
  onUserInfoChange?: (userInfo?: UserInfo, forceLogout?: boolean) => void;
}

export class AuthOrchestrator {
  private userInfo?: UserInfo;

  constructor(private readonly deps: AuthOrchestratorDeps) {}

  get cacheUserInfo(): UserInfo | undefined {
    return this.userInfo;
  }

  setUserInfo(userInfo?: UserInfo, forceLogout = false): void {
    this.userInfo = userInfo;
    this.deps.onUserInfoChange?.(userInfo, forceLogout);
    this.deps.broadcast(CH.MAIN_TO_SANDBOX_SEND_USER_INFO, userInfo);
    if (!userInfo && forceLogout) this.deps.onLogout?.();
  }

  async login(provider: AuthProviderId = 'bytedance', extra?: LoginExtra): Promise<UserInfo | undefined> {
    const p = this.deps.providers.getProvider(provider);
    if (!p) return undefined;

    const user = await this.deps.loginFlow.run(p, provider, extra);
    if (user) {
      this.setUserInfo(user, false);
      this.deps.onLoginSuccess?.(user);
      return user;
    }

    return undefined;
  }

  async getUserInfo(): Promise<UserInfo | undefined> {
    this.deps.tokenManager.verifyTokenInBackground(this.userInfo);
    return this.userInfo;
  }

  async logout(): Promise<boolean> {
    this.setUserInfo(undefined, true);
    return true;
  }

  async refreshUserInfo(force?: boolean): Promise<void> {
    await this.deps.tokenManager.handleForceRefreshUserInfo?.(force);
  }

  async setPrivacyMode(mode: 'on' | 'off' | 'unknown'): Promise<void> {
    this.deps.broadcast(CH.MAIN_TO_SANDBOX_DISPATCH_PRIVACY_MODE_CHANGE, mode);
  }

  async consumeSetupLoginFailedStatus(): Promise<string> {
    return this.deps.setupStatus.consume();
  }
}
