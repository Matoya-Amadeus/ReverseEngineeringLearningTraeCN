export type AuthErrorCode =
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_RETRY_EXHAUSTED'
  | 'PROVIDER_TOKEN_INVALID'
  | 'PROVIDER_REFRESH_INVALID'
  | 'PROVIDER_RESPONSE_INVALID'
  | 'IPC_CHANNEL_MISMATCH'
  | 'RISK_REGION_BLOCKED'
  | 'STORAGE_CORRUPTED'
  | 'UNKNOWN';

export interface AuthErrorShape {
  code: AuthErrorCode;
  message: string;
  provider?: 'bytedance' | 'marscode' | 'saas';
  status?: number;
  retryable?: boolean;
  details?: unknown;
}

export class AuthError extends Error implements AuthErrorShape {
  code: AuthErrorCode;
  provider?: 'bytedance' | 'marscode' | 'saas';
  status?: number;
  retryable?: boolean;
  details?: unknown;

  constructor(shape: AuthErrorShape) {
    super(shape.message);
    this.name = 'AuthError';
    this.code = shape.code;
    this.provider = shape.provider;
    this.status = shape.status;
    this.retryable = shape.retryable;
    this.details = shape.details;
  }
}

export function toAuthError(error: unknown, fallback: Omit<AuthErrorShape, 'message'> & { message?: string }): AuthError {
  if (error instanceof AuthError) return error;
  const msg = typeof error === 'object' && error && 'message' in error ? String((error as any).message) : undefined;
  return new AuthError({ ...fallback, message: msg || fallback.message || 'unknown auth error' });
}

export function mapProviderCodeToAuthError(provider: 'bytedance' | 'marscode' | 'saas', code?: number, message?: string): AuthError | undefined {
  if (code === 30021 || code === 30022) {
    return new AuthError({ code: 'PROVIDER_REFRESH_INVALID', provider, message: message || 'refresh token invalid', retryable: false });
  }
  if (code && code !== 0) {
    return new AuthError({ code: 'PROVIDER_TOKEN_INVALID', provider, message: message || `provider code ${code}`, retryable: false });
  }
  return undefined;
}
