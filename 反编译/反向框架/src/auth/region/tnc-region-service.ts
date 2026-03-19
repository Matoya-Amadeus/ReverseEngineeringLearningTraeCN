export type TncRegion = {
  region: string;
  countryCode: string;
  countryCodeSrc: 'uid' | 'did' | '';
  query?: { is_new_registered_user?: string; user_id?: string };
};

export class TncRegionService {
  private region: TncRegion = {
    region: 'SG',
    countryCode: '',
    countryCodeSrc: 'did'
  };

  getTncRegion(): TncRegion {
    return this.region;
  }

  async deleteTncUserRegion(): Promise<void> {
    this.region = {
      region: 'SG',
      countryCode: '',
      countryCodeSrc: 'did'
    };
  }

  getTncUserTag(userId: string): string | undefined {
    const q = this.region.query;
    if (this.region.countryCodeSrc === 'uid' && q?.user_id === userId) return q.is_new_registered_user;
    return undefined;
  }

  async updateUserToTnc(userTag: string, userId: string, storeCountryCode: string): Promise<boolean> {
    if (!storeCountryCode) return false;

    this.region = {
      region: this.regionFromCountry(storeCountryCode, userTag),
      countryCode: storeCountryCode,
      countryCodeSrc: 'uid',
      query: {
        is_new_registered_user: userTag,
        user_id: userId
      }
    };

    return true;
  }

  async tryReUpdateUserToTnc(userTag: string, userId: string, storeCountryCode: string): Promise<boolean> {
    const q = this.region.query;
    if (
      this.region.countryCode !== storeCountryCode ||
      this.region.countryCodeSrc !== 'uid' ||
      q?.is_new_registered_user !== userTag ||
      q?.user_id !== userId
    ) {
      return this.updateUserToTnc(userTag, userId, storeCountryCode);
    }

    return true;
  }

  private regionFromCountry(countryCode: string, userTag: string): string {
    const cc = countryCode.toUpperCase();
    const USTTP = ['AS', 'GU', 'MP', 'PR', 'UM', 'US', 'VI'];
    const US = ['US', 'CA', 'MX'];

    if (userTag === 'usttp') return 'USTTP';
    if (USTTP.includes(cc)) return 'US';
    if (US.includes(cc)) return 'US';
    return 'SG';
  }
}
