import type { AuthProvider, LoginExtra, UserInfo } from '../types/auth-types';
import { SetupLoginStatusStore } from './setup-login-status';

export interface LoginFlowDeps {
  timeoutMs?: number;
  setupStatus: SetupLoginStatusStore;
}

export class LoginFlow {
  constructor(private readonly deps: LoginFlowDeps) {}

  async run(provider: AuthProvider, providerId: string, extra?: LoginExtra): Promise<UserInfo | undefined> {
    const payload = {
      ...(await provider.getAccountUrl({ provider: providerId, ...extra })),
      provider: providerId,
      email: extra?.email,
      customDomain: extra?.customDomain,
      refreshToken: extra?.refreshToken,
      originCredential: extra?.originCredential,
      ...(extra?.providerPayload || {})
    } as Record<string, unknown>;

    const timeoutMs = this.deps.timeoutMs ?? 30_000;
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('CloudIDETokenError:LoginTimeoutError')), timeoutMs);
    });

    try {
      const result = await Promise.race([provider.loginCredentialCallback(payload), timeout]);
      if ((result as any)?.code === 0 && (result as any)?.userInfo) {
        return (result as any).userInfo as UserInfo;
      }

      // 登录失败标记（复刻 d3 的一次性消费语义，便于 UI 提示）
      if ((payload as any).error_code || (result as any)?.message?.includes('banned')) {
        this.deps.setupStatus.markFailed('1');
      }

      return undefined;
    } catch (e: any) {
      if (String(e?.message || '').includes('LoginTimeoutError')) {
        this.deps.setupStatus.markFailed('1');
      }
      return undefined;
    }
  }
}
