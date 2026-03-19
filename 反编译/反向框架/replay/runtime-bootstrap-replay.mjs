function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

class ProviderRegistry {
  constructor() {
    this.map = new Map();
  }
  register(p) {
    this.map.set(p.id, p);
  }
  getProvider(id) {
    if (id && this.map.has(id)) return this.map.get(id);
    return this.map.get('marscode');
  }
}

class MarscodeProvider {
  constructor(http, apiHost) {
    this.id = 'marscode';
    this.http = http;
    this.apiHost = apiHost;
  }
  async getAccountUrl() {
    return { loginHost: this.apiHost, consoleHost: this.apiHost, apiHost: this.apiHost };
  }
  async loginCredentialCallback(payload) {
    const rt = String(payload.refreshToken || '');
    const exchange = await this.http.request({ method: 'POST', url: `${this.apiHost}/cloudide/api/v3/trae/oauth/ExchangeToken`, data: { RefreshToken: rt } });
    const user = await this.http.request({ method: 'POST', url: `${this.apiHost}/cloudide/api/v3/trae/GetUserInfo`, headers: { 'x-cloudide-token': exchange.Data.Token }, data: {} });
    return {
      code: 0,
      userInfo: {
        userId: String(user.UserID || user.Data?.UserInfo?.UserID || 'u_boot'),
        token: exchange.Data.Token,
        refreshToken: exchange.Data.RefreshToken || rt,
        account: { scope: 'marscode', storeCountryCode: String(user.StoreCountry || ''), userTag: 'row', storeRegion: 'US' }
      }
    };
  }
}

class AuthOrchestrator {
  constructor(deps) {
    this.deps = deps;
    this.userInfo = undefined;
  }
  setUserInfo(userInfo, forceLogout = false) {
    this.userInfo = userInfo;
    this.deps.onUserInfoChange?.(userInfo, forceLogout);
    this.deps.broadcast('vscode:main::sandbox-send-userInfo', userInfo);
  }
  async login(provider = 'bytedance', extra = {}) {
    const p = this.deps.providers.getProvider(provider);
    if (!p) return undefined;
    const accountUrl = await p.getAccountUrl({ provider, ...extra });
    const payload = { ...(accountUrl || {}), ...(extra.providerPayload || {}), provider, refreshToken: extra.refreshToken };
    const result = await p.loginCredentialCallback(payload);
    if (result?.code === 0 && result.userInfo) {
      this.setUserInfo(result.userInfo, false);
      return result.userInfo;
    }
    return undefined;
  }
}

function createRuntime(http, opts) {
  const events = [];
  const providers = new ProviderRegistry();
  providers.register(new MarscodeProvider(http, opts.marscodeApi));

  let sharedUser;
  const orchestrator = new AuthOrchestrator({
    providers,
    broadcast: (channel, payload) => events.push({ channel, payload }),
    onUserInfoChange: (u) => {
      sharedUser = u;
    }
  });

  return {
    login: (provider, extra) => orchestrator.login(provider, extra),
    events,
    getUser: () => sharedUser
  };
}

async function main() {
  const http = {
    async request(req) {
      if (req.url.includes('/oauth/ExchangeToken')) {
        return {
          code: 0,
          Data: {
            Token: 'jwt_boot',
            RefreshToken: 'refresh_boot',
            TokenExpireAt: '2026-03-18T00:00:00.000Z',
            RefreshExpireAt: '2026-03-25T00:00:00.000Z'
          }
        };
      }
      if (req.url.includes('/GetUserInfo')) {
        return { code: 0, UserID: 'u_boot', StoreCountry: 'US', Data: { UserInfo: { UserID: 'u_boot' } } };
      }
      throw new Error('unexpected url');
    }
  };

  const rt = createRuntime(http, { marscodeApi: 'https://mars.mock' });
  const user = await rt.login('marscode', { refreshToken: 'seed_refresh' });

  assert(user?.userId === 'u_boot', 'runtime login should return user');
  assert(rt.getUser()?.userId === 'u_boot', 'shared user should be updated');
  assert(rt.events.some((e) => e.channel === 'vscode:main::sandbox-send-userInfo'), 'user info broadcast missing');

  console.log('SCENARIO_OK runtime_bootstrap_login_path');
}

main().catch((e) => {
  console.error('SCENARIO_FAIL', e.message);
  process.exit(1);
});
