import { createHash } from 'node:crypto';
import type { ProtocolProvider, ProtocolRequest } from './protocol-requester';
import type { ProtocolRequestContext } from './request-context';

export function defaultSigner(
  provider: ProtocolProvider,
  request: ProtocolRequest,
  ctx: ProtocolRequestContext
): Record<string, string> {
  const secret = process.env.TRAE_AUTH_SIGN_SECRET || 'reconstructed-secret';
  const raw = [
    provider,
    request.path,
    request.method || 'POST',
    ctx.ts,
    ctx.nonce,
    ctx.requestId,
    secret
  ].join(':');

  const sign = createHash('sha256').update(raw).digest('base64');
  return {
    'x-auth-ts': ctx.ts,
    'x-auth-nonce': ctx.nonce,
    'x-auth-sign': sign,
    'x-auth-sign-v': 'v2'
  };
}
