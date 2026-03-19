export type AuthProviderId = 'bytedance' | 'marscode' | 'saas';
export type PrivacyMode = 'on' | 'off' | 'unknown';

export interface AccountInfo {
  scope: AuthProviderId;
  userTag?: string;
  storeCountryCode?: string;
  storeRegion?: string;
  [k: string]: unknown;
}

export interface UserInfo {
  userId: string;
  token: string;
  refreshToken?: string;
  account: AccountInfo;
  expiredAt?: string;
  refreshExpiredAt?: string;
  [k: string]: unknown;
}

export interface LoginExtra {
  email?: string;
  customDomain?: string;
  refreshToken?: string;
  originCredential?: string;
  providerPayload?: Record<string, unknown>;
}

export interface CheckTokenResult {
  isValid: boolean;
  errorCode?: string | number;
}

export interface LoginProviderResult {
  code: number;
  userInfo?: UserInfo;
  message?: string;
}

export interface AuthProvider {
  id: AuthProviderId;
  getAccountUrl(ctx?: unknown): Promise<Record<string, unknown>>;
  loginCredentialCallback(payload: Record<string, unknown>): Promise<LoginProviderResult>;
  refreshToken(refreshToken: string, current?: UserInfo): Promise<UserInfo>;
  checkToken(token: string, current?: UserInfo): Promise<CheckTokenResult>;
  refreshUserInfo?(token: string, current: UserInfo): Promise<AccountInfo>;
  generateTempToken?(token: string, current: UserInfo): Promise<{ Token: string; ExpiredAt: string }>;
  logout?(current?: UserInfo): Promise<void>;
}
