import type { ProtocolProvider } from './protocol-requester';

export interface RouteAlignmentRule {
  requiredDataKeys: string[];
  requiredHeaderKeys: string[];
  description: string;
}

const EMPTY_RULE: RouteAlignmentRule = {
  requiredDataKeys: [],
  requiredHeaderKeys: [],
  description: 'no explicit alignment rule'
};

export function resolveRouteAlignment(provider: ProtocolProvider, path: string): RouteAlignmentRule {
  const p = String(path || '');

  if (provider === 'marscode' || provider === 'saas') {
    if (p.includes('/oauth/ExchangeToken')) {
      return {
        requiredDataKeys: ['RefreshToken', 'ClientSecret', 'IDEVersion', 'AppVersion', 'Platform', 'Region'],
        requiredHeaderKeys: ['x-auth-provider', 'x-request-id', 'x-trace-id', 'x-auth-sign'],
        description: 'exchange token baseline payload and tracing/signature headers'
      };
    }
    if (p.includes('/GetUserInfo')) {
      return {
        requiredDataKeys: ['IDEVersion', 'AppVersion', 'Platform', 'Region'],
        requiredHeaderKeys: ['x-auth-provider', 'x-cloudide-token', 'x-request-id', 'x-auth-sign'],
        description: 'userinfo route requires token header and runtime metadata'
      };
    }
    if (p.includes('/CheckLogin')) {
      return {
        requiredDataKeys: ['IDEVersion', 'AppVersion', 'Platform', 'Region'],
        requiredHeaderKeys: ['x-auth-provider', 'x-cloudide-token', 'x-request-id', 'x-auth-sign'],
        description: 'check-login route requires token and runtime metadata'
      };
    }
  }

  if (provider === 'marscode' && p.includes('/GenerateTempToken')) {
    return {
      requiredDataKeys: ['IDEVersion', 'AppVersion', 'Platform', 'Region', 'Scene'],
      requiredHeaderKeys: ['x-auth-provider', 'x-cloudide-token', 'x-request-id', 'x-auth-sign'],
      description: 'temp-token route requires runtime metadata, scene tag, and token header'
    };
  }

  if (provider === 'bytedance') {
    if (p.includes('/GetUserToken')) {
      return {
        requiredDataKeys: ['Token', 'IDEVersion', 'AppVersion', 'Platform', 'Region'],
        requiredHeaderKeys: ['x-auth-provider', 'x-auth-sign', 'X-Cloudide-Token'],
        description: 'bytedance token route requires cloudide token seed and signed headers'
      };
    }
    if (p.includes('/GetUserNativeRegion')) {
      return {
        requiredDataKeys: ['IDEVersion', 'AppVersion', 'Platform', 'Region', 'Scene'],
        requiredHeaderKeys: ['x-auth-provider', 'x-auth-sign', 'X-Cloudide-Token'],
        description: 'native region route requires signed headers and runtime metadata'
      };
    }
  }

  return EMPTY_RULE;
}

export function diffRequiredKeys(rule: RouteAlignmentRule, data: unknown, headers: Record<string, string>) {
  const dataObj = typeof data === 'object' && data ? (data as Record<string, unknown>) : {};
  const missingDataKeys = rule.requiredDataKeys.filter((k) => !(k in dataObj));

  const headerSet = new Set(Object.keys(headers || {}));
  const missingHeaderKeys = rule.requiredHeaderKeys.filter((k) => !headerSet.has(k));

  return {
    missingDataKeys,
    missingHeaderKeys
  };
}
