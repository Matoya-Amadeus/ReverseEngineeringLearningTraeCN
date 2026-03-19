import type { UserInfo } from '../types/auth-types';
import { TncRegionService, type TncRegion } from './tnc-region-service';

export type RefreshStoreCountryCodeFn = (user: UserInfo) => Promise<UserInfo | undefined>;
export type BuildStoreRegionByUidCountryFn = (userId: string, countryCode: string, userTag: string) => TncRegion;

export class StoreRegionService {
  constructor(
    private readonly tnc: TncRegionService,
    private readonly refreshStoreCountryCode: RefreshStoreCountryCodeFn,
    private readonly buildStoreRegionByUidCountry: BuildStoreRegionByUidCountryFn,
    private readonly getStorageUserTag: (userId: string) => Promise<string | undefined>,
    private readonly isI18nPackage = false
  ) {}

  async getStoreRegion(user?: UserInfo): Promise<TncRegion> {
    const tncRegion = this.tnc.getTncRegion();
    const scope = user?.account?.scope;

    if (scope === 'bytedance' || this.isI18nPackage) {
      return {
        ...tncRegion,
        region: user ? this.deriveByCountryCode(tncRegion.countryCode) : this.deriveByCountryCode(tncRegion.countryCode),
        countryCodeSrc: tncRegion.countryCodeSrc || 'did'
      };
    }

    if (scope === 'marscode') {
      if (!user?.account?.storeCountryCode || !user?.account?.userTag) {
        if (user) void this.refreshStoreCountryCode(user);
        return { ...tncRegion, region: 'UNKNOWN' };
      }

      if (!tncRegion.countryCode || tncRegion.countryCodeSrc !== 'uid') {
        return { ...tncRegion, region: 'UNKNOWN' };
      }

      const tag = (await this.getStorageUserTag(user.userId)) ?? 'row';
      return this.buildStoreRegionByUidCountry(user.userId, tncRegion.countryCode, tag);
    }

    return {
      ...tncRegion,
      region: this.deriveByCountryCode(tncRegion.countryCode),
      countryCodeSrc: tncRegion.countryCodeSrc || 'did'
    };
  }

  private deriveByCountryCode(countryCode?: string): string {
    if (!countryCode) return 'UNKNOWN';

    const cc = countryCode.toUpperCase();
    const US = ['US', 'CA', 'MX'];
    return US.includes(cc) ? 'US' : 'SG';
  }
}
