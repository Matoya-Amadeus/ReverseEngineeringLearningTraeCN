function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

class MockProvider {
  constructor(opts = {}) {
    this.opts = opts;
  }
  async login() {
    return {
      userId: 'u_1001',
      token: 'token_valid',
      refreshToken: 'refresh_valid',
      account: { scope: 'marscode' }
    };
  }
  async refreshToken() {
    if (this.opts.refreshInvalid) throw new Error('RefreshTokenInvalid');
    return {
      userId: 'u_1001',
      token: 'token_new',
      refreshToken: 'refresh_new',
      account: { scope: 'marscode' }
    };
  }
  async checkToken() {
    if (this.opts.strictInvalid) return { isValid: false, errorCode: '40101' };
    return { isValid: true };
  }
}

class MiniTokenManager {
  constructor(provider) {
    this.provider = provider;
    this.forceLogoutCount = 0;
  }
  forceLogout() {
    this.forceLogoutCount += 1;
  }
  async refreshPath() {
    try {
      await this.provider.refreshToken('refresh_valid');
    } catch (e) {
      if (String(e.message).includes('RefreshTokenInvalid')) this.forceLogout();
    }
  }
  async strictPath() {
    const r = await this.provider.checkToken('token_valid');
    if (!r.isValid) this.forceLogout();
  }
}

async function main() {
  const loginProvider = new MockProvider();
  const user = await loginProvider.login();
  assert(user.userId === 'u_1001', 'login_success failed');

  const refreshTM = new MiniTokenManager(new MockProvider({ refreshInvalid: true }));
  await refreshTM.refreshPath();
  assert(refreshTM.forceLogoutCount === 1, 'refresh_invalid_force_logout failed');

  const strictTM = new MiniTokenManager(new MockProvider({ strictInvalid: true }));
  await strictTM.strictPath();
  assert(strictTM.forceLogoutCount === 1, 'strict_invalid_force_logout failed');

  console.log('SCENARIO_OK login_success');
  console.log('SCENARIO_OK refresh_invalid_force_logout');
  console.log('SCENARIO_OK strict_invalid_force_logout');
}

main().catch((e) => {
  console.error('SCENARIO_FAIL', e.message);
  process.exit(1);
});
