function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

class TncRegionService {
  constructor() {
    this.region = { region: 'SG', countryCode: '', countryCodeSrc: 'did' };
  }
  getTncRegion() {
    return this.region;
  }
  async updateUserToTnc(userTag, userId, storeCountryCode) {
    this.region = {
      region: storeCountryCode === 'US' ? 'US' : 'SG',
      countryCode: storeCountryCode,
      countryCodeSrc: 'uid',
      query: { is_new_registered_user: userTag, user_id: userId }
    };
    return true;
  }
}

class StoreRegionService {
  constructor(tnc, refreshStoreCountryCode, getStorageUserTag) {
    this.tnc = tnc;
    this.refreshStoreCountryCode = refreshStoreCountryCode;
    this.getStorageUserTag = getStorageUserTag;
  }
  async getStoreRegion(user) {
    const tncRegion = this.tnc.getTncRegion();
    if (user.account.scope === 'marscode') {
      if (!user.account.storeCountryCode || !user.account.userTag) {
        void this.refreshStoreCountryCode(user);
        return { ...tncRegion, region: 'UNKNOWN' };
      }
      if (!tncRegion.countryCode || tncRegion.countryCodeSrc !== 'uid') return { ...tncRegion, region: 'UNKNOWN' };
      const tag = (await this.getStorageUserTag(user.userId)) ?? 'row';
      return {
        region: tncRegion.countryCode === 'US' ? 'US' : 'SG',
        countryCode: tncRegion.countryCode,
        countryCodeSrc: 'uid',
        query: { is_new_registered_user: tag, user_id: user.userId }
      };
    }
    return tncRegion;
  }
}

async function main() {
  const tnc = new TncRegionService();
  const user = {
    userId: 'u_2001',
    token: 'token_valid',
    refreshToken: 'refresh_valid',
    account: { scope: 'marscode', storeCountryCode: '', userTag: '' }
  };

  const refreshStoreCountryCode = async (u) => {
    u.account.storeCountryCode = 'US';
    u.account.userTag = 'row';
    await tnc.updateUserToTnc('row', u.userId, 'US');
    return u;
  };

  const service = new StoreRegionService(tnc, refreshStoreCountryCode, async () => 'row');

  const first = await service.getStoreRegion(user);
  assert(first.region === 'UNKNOWN', 'first region should be UNKNOWN');

  await new Promise((r) => setTimeout(r, 10));
  const second = await service.getStoreRegion(user);
  assert(second.region === 'US' && second.countryCodeSrc === 'uid', 'second region should self-heal to UID region');

  console.log('SCENARIO_OK region_self_heal');
}

main().catch((e) => {
  console.error('SCENARIO_FAIL', e.message);
  process.exit(1);
});
