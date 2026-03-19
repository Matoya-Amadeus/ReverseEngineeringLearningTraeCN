import type { CheckIntervalRule } from '../token/auth-watch-service';

type Listener = (rules: CheckIntervalRule[]) => void;

export interface AuthRuntimeConfig {
  checkRules: CheckIntervalRule[];
  blockedCountryCodes: string[];
  blockedRegions: string[];
  timeoutMs: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: AuthRuntimeConfig = {
  checkRules: [],
  blockedCountryCodes: [],
  blockedRegions: [],
  timeoutMs: 15_000,
  maxRetries: 2
};

export class AuthConfigSource {
  private listeners: Listener[] = [];
  private runtimeOverride: Partial<AuthRuntimeConfig> = {};

  getRules(): CheckIntervalRule[] {
    return this.getConfig().checkRules;
  }

  getConfig(): AuthRuntimeConfig {
    const envTimeout = Number(process.env.TRAE_AUTH_TIMEOUT_MS || '0');
    const envRetries = Number(process.env.TRAE_AUTH_MAX_RETRIES || '0');
    const envBlockedCc = parseCsv(process.env.TRAE_AUTH_BLOCKED_COUNTRIES);
    const envBlockedRegion = parseCsv(process.env.TRAE_AUTH_BLOCKED_REGIONS);

    const merged: AuthRuntimeConfig = {
      ...DEFAULT_CONFIG,
      timeoutMs: envTimeout > 0 ? envTimeout : DEFAULT_CONFIG.timeoutMs,
      maxRetries: envRetries >= 0 ? envRetries : DEFAULT_CONFIG.maxRetries,
      blockedCountryCodes: envBlockedCc.length > 0 ? envBlockedCc : DEFAULT_CONFIG.blockedCountryCodes,
      blockedRegions: envBlockedRegion.length > 0 ? envBlockedRegion : DEFAULT_CONFIG.blockedRegions,
      ...this.runtimeOverride
    };

    return merged;
  }

  updateRules(rules: CheckIntervalRule[]): void {
    this.runtimeOverride = { ...this.runtimeOverride, checkRules: rules };
    for (const l of this.listeners) l(this.getRules());
  }

  updateRuntimeOverride(override: Partial<AuthRuntimeConfig>): void {
    this.runtimeOverride = { ...this.runtimeOverride, ...override };
    for (const l of this.listeners) l(this.getRules());
  }

  onRulesChanged(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== listener);
    };
  }
}

function parseCsv(v?: string): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
}
