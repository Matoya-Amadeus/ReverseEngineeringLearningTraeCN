import path from 'node:path';
import { CH } from './types/auth-events';
import type { LoginExtra, UserInfo } from './types/auth-types';
import type { HttpClient } from './providers/network/http-client';
import { buildDefaultProviders } from './providers/provider-factory';
import { TokenManager } from './token/token-manager';
import { AuthOrchestrator } from './orchestrator/auth-orchestrator';
import { registerAuthIpc } from './orchestrator/auth-ipc';
import { InMemoryIpc } from './runtime/in-memory-ipc';
import { IpcAdapter } from './runtime/ipc-adapter';
import { UserStorage, type StorageLike } from './storage/user-storage';
import { TncRegionService } from './region/tnc-region-service';
import { StoreRegionService } from './region/store-region-service';
import { RegionRiskGateService } from './region/risk-gate-service';
import { AuthWatchService, type CheckIntervalRule } from './token/auth-watch-service';
import { AuthConfigSource } from './config/auth-config-source';
import { FileTokenStore } from './utils/file-token-store';
import { JsonFileStore } from './storage/json-file-store';
import { buildAuthPathLayout } from './storage/path-layout';
import { SetupLoginStatusStore } from './login/setup-login-status';
import { LoginFlow } from './login/login-flow';
import { buildFakeUser, isFakeLoginEnabled } from './mock-fake-login';

export interface AuthRuntimeOptions {
  bytedanceBase: string;
  marscodeApi: string;
  saasApi: string;
  saasLogin: string;
  dataDir: string;
  availableIpcChannels?: string[];
}

export interface AuthRuntime {
  login: (provider?: 'bytedance' | 'marscode' | 'saas', extra?: LoginExtra) => Promise<UserInfo | undefined>;
  getUserInfo: () => Promise<UserInfo | undefined>;
  logout: () => Promise<boolean>;
  getStoreRegion: () => Promise<any>;
  setWatchRules: (rules: CheckIntervalRule[]) => void;
  ipc: InMemoryIpc;
  tokenManager: TokenManager;
  orchestrator: AuthOrchestrator;
  events: { channel: string; payload?: unknown }[];
}

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | undefined {
    return this.map.get(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

export function createAuthRuntime(http: HttpClient, opts: AuthRuntimeOptions): AuthRuntime {
  const events: { channel: string; payload?: unknown }[] = [];
  const ipc = new InMemoryIpc();
  const configSource = new AuthConfigSource();
  const runtimeConfig = configSource.getConfig();

  const providers = buildDefaultProviders(http, {
    bytedanceBase: opts.bytedanceBase,
    marscodeApi: opts.marscodeApi,
    saasApi: opts.saasApi,
    saasLogin: opts.saasLogin,
    timeoutMs: runtimeConfig.timeoutMs,
    maxRetries: runtimeConfig.maxRetries
  });

  const storage = new MemoryStorage();
  const tnc = new TncRegionService();
  const userStorage = new UserStorage('marscode', storage, tnc);
  const layout = buildAuthPathLayout(opts.dataDir);
  const tokenFile = new FileTokenStore(layout.tokenFile);
  const userFileStore = new JsonFileStore<UserInfo>(layout.userFile);
  const setupStatus = new SetupLoginStatusStore();
  const loginFlow = new LoginFlow({ setupStatus, timeoutMs: runtimeConfig.timeoutMs * 2 });
  const riskGate = new RegionRiskGateService({
    blockedCountryCodes: runtimeConfig.blockedCountryCodes,
    blockedRegions: runtimeConfig.blockedRegions
  });

  let sharedUser: UserInfo | undefined = userFileStore.read() || userStorage.getUserInfoFromLocalStorage();
  let orchestratorRef: AuthOrchestrator | undefined;

  const tokenManager = new TokenManager({
    providers,
    getUserInfo: () => sharedUser,
    setUserInfo: (userInfo, forceLogout) => {
      sharedUser = userInfo;
      if (userInfo) {
        userFileStore.write(userInfo);
      } else {
        userFileStore.clear();
      }
      orchestratorRef?.setUserInfo(userInfo, !!forceLogout);
    },
    broadcast: (channel, payload) => {
      events.push({ channel, payload });
    },
    writeTempToken: (token) => tokenFile.write(token),
    clearTempTokenFile: () => {
      tokenFile.clear();
      events.push({ channel: 'local:temp-token-cleared' });
    }
  });

  const orchestrator = new AuthOrchestrator({
    providers,
    tokenManager,
    loginFlow,
    setupStatus,
    broadcast: (channel, payload) => {
      events.push({ channel, payload });
    },
    onUserInfoChange: (userInfo, forceLogout) => {
      sharedUser = userInfo;
      if (userInfo) {
        userFileStore.write(userInfo);
      } else {
        userFileStore.clear();
      }
      void userStorage.updateUserInfoStorage(userInfo, !!forceLogout);
      watch.updateUser(userInfo);
    }
  });

  orchestratorRef = orchestrator;

  const watch = new AuthWatchService({
    check: async (user) => {
      await tokenManager.checkLoginToken(user);
    },
    getUser: () => sharedUser,
    getRules: () => configSource.getRules()
  });
  watch.start();

  const unbind = configSource.onRulesChanged((rules) => {
    watch.updateRules(rules);
  });
  void unbind;

  const channelSpec = {
    handle: [
      CH.SANDBOX_TO_MAIN_INVOKE_GET_USER_INFO,
      CH.SANDBOX_TO_MAIN_INVOKE_LOGIN,
      CH.SANDBOX_TO_MAIN_SEND_LOGOUT,
      CH.SANDBOX_TO_MAIN_CHANGE_PRIVACY_MODE,
      CH.SANDBOX_TO_MAIN_REFRESH_USERINFO,
      CH.SANDBOX_TO_MAIN_GET_SETUP_PAGE_LOGIN_FAILED_STATUS
    ],
    on: [CH.SANDBOX_TO_MAIN_SET_JWT_TOKEN_ENABLED]
  };

  const adapter = new IpcAdapter(ipc, channelSpec);
  adapter.register((ipcMain) => registerAuthIpc(ipcMain, orchestrator, tokenManager), opts.availableIpcChannels);

  const storeRegion = new StoreRegionService(
    tnc,
    async (u) => {
      const p = providers.getProvider('marscode');
      if (!p?.refreshUserInfo) return u;
      const account = await p.refreshUserInfo(u.token, u);
      const merged = { ...u, account };
      riskGate.check(merged);
      sharedUser = merged;
      orchestrator.setUserInfo(merged, false);
      return merged;
    },
    (userId, countryCode, userTag) => ({
      region: countryCode.toUpperCase() === 'US' ? 'US' : 'SG',
      countryCode,
      countryCodeSrc: 'uid',
      query: { is_new_registered_user: userTag, user_id: userId }
    }),
    (userId) => userStorage.getStorageUserTag(userId)
  );

  return {
    login: async (provider = 'bytedance', extra) => {
      // 仅用于学习/测试：开启 TRAE_FAKE_LOGIN 后直接走假登录，不触发真实认证网络。
      if (isFakeLoginEnabled()) {
        const fakeUser = buildFakeUser(provider);
        orchestrator.setUserInfo(fakeUser, false);
        events.push({ channel: 'local:fake-login-enabled', payload: { provider } });
        return fakeUser;
      }

      const user = await ipc.invoke(CH.SANDBOX_TO_MAIN_INVOKE_LOGIN, provider, extra);
      riskGate.check(user);
      return user;
    },
    getUserInfo: () => ipc.invoke(CH.SANDBOX_TO_MAIN_INVOKE_GET_USER_INFO),
    logout: async () => {
      const current = sharedUser;
      if (current) {
        const p = providers.getProvider(current.account.scope);
        await p?.logout?.(current);
      }
      return ipc.invoke(CH.SANDBOX_TO_MAIN_SEND_LOGOUT);
    },
    getStoreRegion: () => storeRegion.getStoreRegion(sharedUser),
    setWatchRules: (rules) => configSource.updateRules(rules),
    ipc,
    tokenManager,
    orchestrator,
    events
  };
}
