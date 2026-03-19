import { AuthError } from '../errors/auth-error';
import type { UserInfo } from '../types/auth-types';

export interface RegionRiskPolicy {
  blockedCountryCodes: string[];
  blockedRegions: string[];
}

export class RegionRiskGateService {
  constructor(private readonly policy: RegionRiskPolicy) {}

  check(user?: UserInfo): void {
    const countryCode = String(user?.account?.storeCountryCode || '').toUpperCase();
    const storeRegion = String(user?.account?.storeRegion || '').toUpperCase();

    if (countryCode && this.policy.blockedCountryCodes.includes(countryCode)) {
      throw new AuthError({
        code: 'RISK_REGION_BLOCKED',
        message: `country blocked by risk policy: ${countryCode}`,
        retryable: false,
        details: { countryCode }
      });
    }

    if (storeRegion && this.policy.blockedRegions.includes(storeRegion)) {
      throw new AuthError({
        code: 'RISK_REGION_BLOCKED',
        message: `region blocked by risk policy: ${storeRegion}`,
        retryable: false,
        details: { storeRegion }
      });
    }
  }
}
