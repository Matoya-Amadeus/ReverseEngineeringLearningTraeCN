import { AuthError, mapProviderCodeToAuthError, toAuthError } from '../../errors/auth-error';
import type { HttpClient } from './http-client';
import { createProtocolContext, type ProtocolRequestContext } from './request-context';
import { resolveRoutePolicy } from './protocol-profile';
import { diffRequiredKeys, resolveRouteAlignment } from './route-alignment';
import { RequestFingerprintRecorder } from './request-fingerprint-recorder';

export type ProtocolProvider = 'bytedance' | 'marscode' | 'saas';

export interface ProtocolRequest {
  provider: ProtocolProvider;
  path: string;
  method?: 'GET' | 'POST';
  token?: string;
  data?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  traceId?: string;
  requestId?: string;
  authScope?: string;
  region?: string;
}

export interface ProtocolRequesterDeps {
  http: HttpClient;
  hosts: Record<ProtocolProvider, string>;
  signer?: (provider: ProtocolProvider, request: ProtocolRequest, ctx: ProtocolRequestContext) => Record<string, string>;
  contextProvider?: (request: ProtocolRequest) => Partial<ProtocolRequestContext>;
  recorder?: RequestFingerprintRecorder;
}

export class ProtocolRequester {
  constructor(private readonly deps: ProtocolRequesterDeps) {}

  async request<T = any>(req: ProtocolRequest): Promise<T> {
    const host = this.deps.hosts[req.provider];
    const url = String(host || '') + String(req.path || '');

    const ctx = this.#buildContext(req);
    const policy = resolveRoutePolicy(req.provider, req, ctx);

    if (policy.requireToken && !req.token) {
      throw new AuthError({
        code: 'PROVIDER_RESPONSE_INVALID',
        provider: req.provider,
        message: 'token required by route policy: ' + req.provider + ' ' + req.path,
        retryable: false,
        details: { req }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-auth-provider': req.provider,
      ...(policy.extraHeaders || {}),
      ...(req.token ? { 'x-cloudide-token': req.token } : {}),
      ...(this.deps.signer ? this.deps.signer(req.provider, req, ctx) : {}),
      ...(req.headers || {})
    };

    const alignment = resolveRouteAlignment(req.provider, req.path);
    const diff = diffRequiredKeys(alignment, req.data, headers);

    this.#recordFingerprint(req, ctx, headers, diff.missingDataKeys, diff.missingHeaderKeys);

    if (diff.missingDataKeys.length > 0 || diff.missingHeaderKeys.length > 0) {
      throw new AuthError({
        code: 'PROVIDER_RESPONSE_INVALID',
        provider: req.provider,
        message:
          'route alignment check failed: ' +
          req.provider +
          ' ' +
          req.path +
          ' missingData=' +
          diff.missingDataKeys.join(',') +
          ' missingHeaders=' +
          diff.missingHeaderKeys.join(','),
        retryable: false,
        details: { req, alignment }
      });
    }

    try {
      const result = await this.deps.http.request<T>({
        method: req.method ?? policy.defaultMethod,
        url,
        headers,
        data: req.data,
        timeoutMs: req.timeoutMs
      });
      const code = (result as any)?.code;
      const mapped = mapProviderCodeToAuthError(req.provider, code, (result as any)?.message);
      if (mapped) throw mapped;
      return result;
    } catch (e) {
      throw toAuthError(e, {
        code: 'UNKNOWN',
        message: 'protocol request failed: ' + req.provider + ' ' + req.path,
        provider: req.provider,
        retryable: true,
        details: req
      });
    }
  }

  #buildContext(req: ProtocolRequest): ProtocolRequestContext {
    const overrides = this.deps.contextProvider ? this.deps.contextProvider(req) : {};

    return createProtocolContext({
      provider: req.provider,
      traceId: req.traceId || overrides.traceId,
      requestId: req.requestId || overrides.requestId,
      authScope: req.authScope || overrides.authScope,
      region: req.region || overrides.region,
      appVersion: overrides.appVersion,
      platform: overrides.platform,
      deviceId: overrides.deviceId
    });
  }

  #recordFingerprint(
    req: ProtocolRequest,
    ctx: ProtocolRequestContext,
    headers: Record<string, string>,
    missingDataKeys: string[],
    missingHeaderKeys: string[]
  ) {
    this.deps.recorder?.record({
      ts: new Date().toISOString(),
      provider: req.provider,
      path: req.path,
      method: req.method || 'POST',
      hasToken: !!req.token,
      requestId: ctx.requestId,
      traceId: ctx.traceId,
      dataKeys: req.data && typeof req.data === 'object' ? Object.keys(req.data as Record<string, unknown>).sort() : [],
      headerKeys: Object.keys(headers || {}).sort(),
      missingDataKeys,
      missingHeaderKeys
    });
  }
}
