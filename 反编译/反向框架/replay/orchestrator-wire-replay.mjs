function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

class ProviderRegistry {
  constructor(provider) {
    this.provider = provider;
  }
  getProvider() {
    return this.provider;
  }
}

class AuthOrchestrator {
  constructor(deps) {
    this.deps = deps;
    this.userInfo = undefined;
  }
  setUserInfo(userInfo, forceLogout = false) {
    this.userInfo = userInfo;
    this.deps.broadcast('vscode:main::sandbox-send-userInfo', userInfo);
    if (!userInfo && forceLogout) this.deps.onLogout?.();
  }
  async login(provider = 'bytedance', extra = {}) {
    const p = this.deps.providers.getProvider(provider);
    if (!p) return undefined;
    const accountUrl = await p.getAccountUrl({ provider, ...extra });
    const payload = {
      ...(accountUrl || {}),
      ...(extra.providerPayload || {}),
      provider,
      email: extra.email,
      customDomain: extra.customDomain,
      refreshToken: extra.refreshToken,
      originCredential: extra.originCredential
    };
    try {
      const result = await p.loginCredentialCallback(payload);
      if (result?.code === 0 && result.userInfo) {
        this.setUserInfo(result.userInfo, false);
        this.deps.onLoginSuccess?.(result.userInfo);
        return result.userInfo;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
}

async function main() {
  const calls = [];
  const provider = {
    async getAccountUrl() {
      return { apiHost: 'https://mock.local' };
    },
    async loginCredentialCallback(payload) {
      calls.push(payload);
      if (payload.refreshToken === 'ok') {
        return {
          code: 0,
          userInfo: {
            userId: 'u_wire',
            token: 't_wire',
            refreshToken: 'ok',
            account: { scope: 'marscode' }
          }
        };
      }
      throw new Error('login failed');
    }
  };

  let lastBroadcast;
  const orchestrator = new AuthOrchestrator({
    providers: new ProviderRegistry(provider),
    broadcast: (_ch, payload) => {
      lastBroadcast = payload;
    },
    tokenManager: { verifyTokenInBackground() {} }
  });

  const ok = await orchestrator.login('marscode', {
    refreshToken: 'ok',
    originCredential: 'origin_ok',
    providerPayload: { userTag: 'row' }
  });

  assert(ok?.userId === 'u_wire', 'login success expected');
  assert(calls[0].refreshToken === 'ok', 'refreshToken not forwarded');
  assert(calls[0].originCredential === 'origin_ok', 'originCredential not forwarded');
  assert(calls[0].userTag === 'row', 'providerPayload not merged');
  assert(lastBroadcast?.userId === 'u_wire', 'broadcast user missing');

  const fail = await orchestrator.login('marscode', { refreshToken: 'bad' });
  assert(fail === undefined, 'failed login should return undefined');
  assert(orchestrator.userInfo?.userId === 'u_wire', 'failed login should not overwrite previous user');

  console.log('SCENARIO_OK orchestrator_wire_success_and_failure');
}

main().catch((e) => {
  console.error('SCENARIO_FAIL', e.message);
  process.exit(1);
});
