export interface HttpRequest {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  data?: unknown;
  timeoutMs?: number;
}

export interface HttpClient {
  request<T = any>(req: HttpRequest): Promise<T>;
}

export interface ExchangeTokenData {
  Token: string;
  RefreshToken: string;
  TokenExpireAt: string;
  RefreshExpireAt: string;
  TokenExpireDuration?: number;
}

export type ApiEnvelope<T> = {
  code?: number;
  Data?: T;
  Result?: T;
  message?: string;
};
