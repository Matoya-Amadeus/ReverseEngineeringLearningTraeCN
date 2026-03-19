import type { ProtocolProvider, ProtocolRequest } from './protocol-requester';
import type { ProtocolRequestContext } from './request-context';

export interface ProtocolRoutePolicy {
  requireToken: boolean;
  defaultMethod: 'GET' | 'POST';
  extraHeaders?: Record<string, string>;
}

export function resolveRoutePolicy(
  provider: ProtocolProvider,
  request: ProtocolRequest,
  ctx: ProtocolRequestContext
): ProtocolRoutePolicy {
  const path = String(request.path || '');

  const commonHeaders: Record<string, string> = {
    'x-request-id': ctx.requestId,
    'x-trace-id': ctx.traceId,
    'x-client-version': ctx.appVersion,
    'x-client-platform': ctx.platform,
    'x-auth-scope': ctx.authScope,
    'x-device-id': ctx.deviceId,
    'x-auth-nonce': ctx.nonce,
    'x-auth-ts': ctx.ts
  };

  if (ctx.region) {
    commonHeaders['x-auth-region'] = ctx.region;
  }

  if (provider === 'bytedance') {
    return {
      requireToken: path.includes('GetUserToken') ? false : true,
      defaultMethod: 'POST',
      extraHeaders: {
        ...commonHeaders,
        'x-tt-env': 'prod',
        'x-tt-request-source': 'reconstructed'
      }
    };
  }

  if (provider === 'marscode') {
    return {
      requireToken: !path.includes('ExchangeToken'),
      defaultMethod: 'POST',
      extraHeaders: {
        ...commonHeaders,
        'x-mars-region': ctx.region || 'ROW'
      }
    };
  }

  return {
    requireToken: !path.includes('ExchangeToken'),
    defaultMethod: 'POST',
    extraHeaders: {
      ...commonHeaders,
      'x-saas-tenant-mode': 'standard'
    }
  };
}
