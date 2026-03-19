function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

class ProviderRegistry {
  constructor() {
    this.map = new Map();
  }
  register(provider) {
    this.map.set(provider.id, provider);
  }
  getProvider(id) {
    if (id && this.map.has(id)) return this.map.get(id);
    return this.map.get('marscode');
  }
}

class BytedanceProvider {
  constructor(http, base) {
    this.id = 'bytedance';
    this.http = http;
    this.base = base;
  }
  async loginCredentialCallback(payload) {
    const token = payload.originCredential || payload.token || '';
    const tokenRes = await this.http.request({
      method: 'POST',
      url: `${this.base}/api/v2/GetUserToken`,
      data: { Token: token }
    });
    const regionRes = await this.http.request({
      method: 'POST',
      url: `${this.base}/api/v2/GetUserNativeRegion`,
      data: {}
    });
    return {
      code: 0,
      userInfo: {
        userId: String(tokenRes.Result?.UserID || 'u_bt'),
        token: String(tokenRes.Result?.Token || ''),
        refreshToken: '',
        account: {
          scope: 'bytedance',
          storeCountryCode: String(regionRes.Result?.AIRegion || ''),
          userTag: 'row'
        }
      }
    };
  }
}

class MarscodeProvider {
  constructor(http, apiHost) {
    this.id = 'marscode';
    this.http = http;
    this.apiHost = apiHost;
  }
  async loginCredentialCallback(payload) {
    const refreshToken = String(payload.refreshToken || '');
    const exchange = await this.http.request({
      method: 'POST',
      url: `${this.apiHost}/cloudide/api/v3/trae/oauth/ExchangeToken`,
      data: { RefreshToken: refreshToken }
    });
    if (exchange.code !== 0) {
      return { code: exchange.code || -1 };
    }
    const user = await this.http.request({
      method: 'POST',
      url: `${this.apiHost}/cloudide/api/v3/trae/GetUserInfo`,
      headers: { 'x-cloudide-token': exchange.Data?.Token || '' },
      data: {}
    });
    return {
      code: 0,
      userInfo: {
        userId: String(user.UserID || user.Data?.UserInfo?.UserID || 'u_mc'),
        token: String(exchange.Data?.Token || ''),
        refreshToken: String(exchange.Data?.RefreshToken || refreshToken),
        account: {
          scope: 'marscode',
          storeCountryCode: String(user.StoreCountry || ''),
          userTag: 'row'
        }
      }
    };
  }
}

class AuthOrchestrator {
  constructor(deps) {
    this.deps = deps;
    this.userInfo = undefined;
  }
  setUserInfo(userInfo) {
    this.userInfo = userInfo;
    this.deps.onUserInfoChange?.(userInfo);
    this.deps.broadcast('vscode:main::sandbox-send-userInfo', userInfo);
  }
  async login(provider = 'bytedance', extra = {}) {
    const p = this.deps.providers.getProvider(provider);
    if (!p) return undefined;
    const result = await p.loginCredentialCallback({ provider, ...extra });
    if (result?.code === 0 && result.userInfo) {
      this.setUserInfo(result.userInfo);
      return result.userInfo;
    }
    this.deps.broadcast('vscode:main::sandbox-login-failed', { provider, code: result?.code ?? -1 });
    return undefined;
  }
  getUserInfo() {
    return this.userInfo;
  }
}

function createAuthRuntime(http, opts) {
  const events = [];
  const providers = new ProviderRegistry();
  providers.register(new BytedanceProvider(http, opts.bytedanceBase));
  providers.register(new MarscodeProvider(http, opts.marscodeApi));

  let sharedUser;
  const orchestrator = new AuthOrchestrator({
    providers,
    broadcast: (channel, payload) => events.push({ channel, payload }),
    onUserInfoChange: (u) => {
      sharedUser = u;
    }
  });

  function getStoreRegion() {
    const cc = String(sharedUser?.account?.storeCountryCode || '').toUpperCase();
    if (cc === 'US') return { region: 'US', countryCode: 'US', countryCodeSrc: 'uid' };
    if (cc) return { region: 'SG', countryCode: cc, countryCodeSrc: 'uid' };
    return { region: 'UNKNOWN', countryCode: '', countryCodeSrc: 'none' };
  }

  return {
    login: (provider, extra) => orchestrator.login(provider, extra),
    getUserInfo: () => orchestrator.getUserInfo(),
    getStoreRegion,
    events
  };
}

class FakeHttp {
  async request(req) {
    if (req.url.includes('/api/v2/GetUserToken')) {
      return { Result: { Token: 'bt_jwt', ExpiredAt: '2026-03-20T00:00:00.000Z', UserID: 'u_bt' } };
    }
    if (req.url.includes('/api/v2/GetUserNativeRegion')) {
      return { Result: { Allow: true, AIRegion: 'sg' } };
    }
    if (req.url.includes('/oauth/ExchangeToken')) {
      const rt = req.data?.RefreshToken;
      if (rt === 'bad') return { code: 30021 };
      return {
        code: 0,
        Data: {
          Token: 'mc_jwt',
          RefreshToken: 'mc_refresh',
          TokenExpireAt: '2026-03-20T00:00:00.000Z',
          RefreshExpireAt: '2026-03-27T00:00:00.000Z'
        }
      };
    }
    if (req.url.includes('/GetUserInfo')) {
      return { code: 0, UserID: 'u_mc', StoreCountry: 'US', Data: { UserInfo: { UserID: 'u_mc' } } };
    }
    return { code: 0 };
  }
}

async function main() {
  const rt = createAuthRuntime(new FakeHttp(), {
    bytedanceBase: 'https://byted.mock',
    marscodeApi: 'https://mars.mock',
    saasApi: 'https://saas.mock',
    saasLogin: 'https://saas-login.mock',
    dataDir: '/tmp/reconstructed-auth'
  });

  const byted = await rt.login('bytedance', { originCredential: 'seed_jwt' });
  assert(byted?.userId === 'u_bt', 'bytedance login failed');

  const mars = await rt.login('marscode', { refreshToken: 'good' });
  assert(mars?.userId === 'u_mc', 'marscode login failed');

  const fail = await rt.login('marscode', { refreshToken: 'bad' });
  assert(fail === undefined, 'bad refresh should fail login');

  const region = rt.getStoreRegion();
  assert(region.region === 'US' || region.region === 'UNKNOWN', 'region pipeline failed');

  const user = rt.getUserInfo();
  assert(!!user, 'getUserInfo should return cached user');

  const hasFailEvent = rt.events.some((e) => e.channel === 'vscode:main::sandbox-login-failed');
  assert(hasFailEvent, 'failed login event should be emitted');

  console.log('SCENARIO_OK full_runtime_e2e');
}

main().catch((e) => {
  console.error('SCENARIO_FAIL', e.message);
  process.exit(1);
});
