import { AuthError } from '../errors/auth-error';

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AuthError({ code: 'PROVIDER_RESPONSE_INVALID', message: `field ${field} must be non-empty string`, retryable: false, details: { field, value } });
  }
  return value;
}

export function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AuthError({ code: 'PROVIDER_RESPONSE_INVALID', message: `field ${field} must be object`, retryable: false, details: { field, value } });
  }
  return value as Record<string, unknown>;
}
