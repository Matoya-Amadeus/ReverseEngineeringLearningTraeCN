import { AuthError } from '../../errors/auth-error';
import type { HttpClient, HttpRequest } from './http-client';

export interface RetryHttpOptions {
  timeoutMs?: number;
  maxRetries?: number;
  backoffMs?: number;
}

export class RetryHttpClient implements HttpClient {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly backoffMs: number;

  constructor(private readonly base: HttpClient, opts: RetryHttpOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.backoffMs = opts.backoffMs ?? 200;
  }

  async request<T = any>(req: HttpRequest): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i <= this.maxRetries; i += 1) {
      try {
        return await this.withTimeout(this.base.request<T>({ ...req, timeoutMs: req.timeoutMs ?? this.timeoutMs }), req.timeoutMs ?? this.timeoutMs);
      } catch (e) {
        lastError = e;
        if (i >= this.maxRetries) break;
        await wait(this.backoffMs * (i + 1));
      }
    }

    throw new AuthError({
      code: 'NETWORK_RETRY_EXHAUSTED',
      message: 'request retry exhausted',
      retryable: true,
      details: { req, lastError }
    });
  }

  private async withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new AuthError({ code: 'NETWORK_TIMEOUT', message: `request timeout ${timeoutMs}ms`, retryable: true }));
      }, timeoutMs);
    });

    try {
      return await Promise.race([p, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
