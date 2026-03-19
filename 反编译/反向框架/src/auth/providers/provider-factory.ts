import { ProviderRegistry } from './provider-registry';
import type { HttpClient } from './network/http-client';
import { BytedanceProvider } from './bytedance-provider';
import { MarscodeProvider } from './marscode-provider';
import { SaasProvider } from './saas-provider';
import { RetryHttpClient } from './network/retry-http-client';
import { ProtocolRequester } from './network/protocol-requester';
import { defaultSigner } from './network/default-signer';
import { RequestFingerprintRecorder } from './network/request-fingerprint-recorder';

export interface ProviderFactoryOptions {
  bytedanceBase: string;
  marscodeApi: string;
  saasApi: string;
  saasLogin: string;
  timeoutMs?: number;
  maxRetries?: number;
  appVersion?: string;
  platform?: string;
  deviceId?: string;
  region?: string;
}

export function buildDefaultProviders(http: HttpClient, opts: ProviderFactoryOptions): ProviderRegistry {
  const r = new ProviderRegistry();
  const retryHttp = new RetryHttpClient(http, { timeoutMs: opts.timeoutMs, maxRetries: opts.maxRetries });
  const recorder = new RequestFingerprintRecorder(process.env.TRAE_AUTH_FINGERPRINT_FILE);

  const protocol = new ProtocolRequester({
    http: retryHttp,
    hosts: {
      bytedance: opts.bytedanceBase,
      marscode: opts.marscodeApi,
      saas: opts.saasApi
    },
    signer: defaultSigner,
    contextProvider: (req) => ({
      appVersion: opts.appVersion || process.env.TRAE_AUTH_APP_VERSION,
      platform: opts.platform || process.env.TRAE_AUTH_PLATFORM,
      deviceId: opts.deviceId || process.env.TRAE_AUTH_DEVICE_ID,
      region: req.region || opts.region || process.env.TRAE_AUTH_REGION
    }),
    recorder
  });

  r.register(new BytedanceProvider(protocol, opts.bytedanceBase));
  r.register(new MarscodeProvider(protocol, opts.marscodeApi));
  r.register(new SaasProvider(protocol, opts.saasApi, opts.saasLogin));
  return r;
}
