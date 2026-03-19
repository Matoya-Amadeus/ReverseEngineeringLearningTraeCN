'use strict';

// 仅用于学习/测试：原生启动时拦截登录 IPC、外跳与远程网络，避免真实认证与真实后端调用。
if (String(process.env.TRAE_NATIVE_FAKE_LOGIN || '1') === '0') {
  process.stderr.write('[native-fake-login] disabled by env\n');
  return;
}

const Module = require('module');
const originalLoad = Module._load;
let installed = false;
let retryTimer = null;

function makeFakeUser(provider) {
  const scope = provider || 'bytedance';
  const uid = `mock-${scope}-user`;
  return {
    userId: uid,
    uid,
    token: `mock-token-${scope}`,
    refreshToken: `mock-refresh-${scope}`,
    isLogin: true,
    hasLogin: true,
    account: {
      scope,
      userTag: 'mock',
      storeCountryCode: 'CN',
      storeRegion: 'CN',
      mockLogin: true
    },
    mockLogin: true,
    mockNotice: '该账号为假登录，仅用于离线学习与测试。'
  };
}

function shouldBlockExternalUrl(url) {
  const text = String(url || '').toLowerCase();
  if (!text) return false;
  return (
    text.includes('oauth') ||
    text.includes('authorization') ||
    text.includes('login') ||
    text.includes('passport') ||
    text.includes('accounts.google.com') ||
    text.includes('trae.cn')
  );
}

function shouldBlockRemoteRequest(url) {
  if (String(process.env.TRAE_DISABLE_NETWORK || '1') === '0') {
    return false;
  }
  const text = String(url || '').toLowerCase();
  if (!text) return false;
  if (text.startsWith('file:')) return false;
  if (text.startsWith('devtools:')) return false;
  if (text.startsWith('chrome-extension:')) return false;
  if (text.startsWith('data:')) return false;
  if (text.startsWith('about:')) return false;
  return text.startsWith('http://') || text.startsWith('https://');
}

function installNetworkBlock(mod) {
  const session = mod && mod.session;
  if (!session || typeof session.fromPartition !== 'function') return;

  // 仅用于学习/测试：阻断远程请求，确保不接入真实后端数据。
  const bindBlocker = (ses, tag) => {
    try {
      if (!ses || !ses.webRequest || typeof ses.webRequest.onBeforeRequest !== 'function') return;
      ses.webRequest.onBeforeRequest((details, callback) => {
        if (shouldBlockRemoteRequest(details && details.url)) {
          process.stderr.write(`[native-fake-login] blocked network(${tag}): ${details.url}\n`);
          callback({ cancel: true });
          return;
        }
        callback({ cancel: false });
      });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      process.stderr.write(`[native-fake-login] network-block(${tag}) error: ${msg}\n`);
    }
  };

  bindBlocker(session.defaultSession, 'default');
  bindBlocker(session.fromPartition('persist:trae-webview'), 'trae-webview');
}

function emitLoginEvent(mod, user) {
  const BrowserWindow = mod && mod.BrowserWindow;
  if (!BrowserWindow || typeof BrowserWindow.getAllWindows !== 'function') return;
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (win && win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('vscode:main::sandbox-login-event', user);
        win.webContents.send('vscode:main::sandbox-send-userInfo', user);
      }
    } catch (_err) {
      // 忽略单窗口异常
    }
  }
}

function emitLogoutEvent(mod) {
  const BrowserWindow = mod && mod.BrowserWindow;
  if (!BrowserWindow || typeof BrowserWindow.getAllWindows !== 'function') return;
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (win && win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('vscode:main::sandbox-logout-event', true);
      }
    } catch (_err) {
      // 忽略单窗口异常
    }
  }
}

function makeEmptyModelPayload() {
  return {
    models: [],
    list: [],
    data: [],
    modelList: [],
    providers: [],
    hasMore: false,
    total: 0
  };
}

function installWithElectronLike(mod) {
  if (installed) return true;
  if (!mod) return false;

  const ipcMain = mod.ipcMain;
  const shell = mod.shell;
  const hasIpc = !!ipcMain && typeof ipcMain.handle === 'function';
  const hasShell = !!shell && typeof shell.openExternal === 'function';

  if (!hasIpc && !hasShell) return false;

  installNetworkBlock(mod);

  if (hasIpc) {
    const rawHandle = ipcMain.handle.bind(ipcMain);
    let currentUser = makeFakeUser('bytedance');

    ipcMain.handle = (channel, listener) => {
      const name = String(channel || '');
      const lc = name.toLowerCase();

      // 仅用于学习/测试：短路登录相关调用，始终返回假登录态。
      if (name === 'vscode:sandbox::main-invoke-login') {
        return rawHandle(channel, async (_event, provider) => {
          currentUser = makeFakeUser(provider || 'bytedance');
          emitLoginEvent(mod, currentUser);
          return currentUser;
        });
      }

      if (name === 'vscode:sandbox::main-invoke-getUserInfo' || name === 'vscode:sandbox::main-invoke-get-user-info') {
        return rawHandle(channel, async () => currentUser || makeFakeUser('bytedance'));
      }

      if (name === 'vscode:sandbox::main-send-logout') {
        return rawHandle(channel, async () => {
          currentUser = undefined;
          emitLogoutEvent(mod);
          return true;
        });
      }

      if (name === 'vscode:sandbox::main-refresh-userinfo') {
        return rawHandle(channel, async () => currentUser || makeFakeUser('bytedance'));
      }

      if (name === 'vscode:sandbox::main-invoke-getSetupPageLoginFailedStatus' || name === 'vscode:sandbox::main-get-setup-page-login-failed-status') {
        return rawHandle(channel, async () => '0');
      }

      // 仅用于学习/测试：清空模型管理相关查询，避免误接真实模型能力。
      if (String(process.env.TRAE_EMPTY_MODELS || '1') !== '0' && lc.includes('model') && lc.includes('invoke')) {
        return rawHandle(channel, async () => makeEmptyModelPayload());
      }

      // 兜底：任何主调用里只要命中登录关键词，也返回假登录。
      if (lc.includes('invoke') && lc.includes('login')) {
        return rawHandle(channel, async (_event, provider) => {
          currentUser = makeFakeUser(provider || 'bytedance');
          emitLoginEvent(mod, currentUser);
          return currentUser;
        });
      }

      return rawHandle(channel, listener);
    };
  }

  if (hasShell) {
    const rawOpenExternal = shell.openExternal.bind(shell);
    shell.openExternal = async (url, options) => {
      if (shouldBlockExternalUrl(url)) {
        process.stderr.write('[native-fake-login] blocked openExternal: ' + String(url) + '\n');
        return true;
      }
      return rawOpenExternal(url, options);
    };
  }

  installed = true;
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
  process.stderr.write('[native-fake-login] hook installed\n');
  return true;
}

function tryInstallNow() {
  if (installed) return true;
  const candidates = ['electron', 'electron/main'];
  for (const name of candidates) {
    try {
      const mod = originalLoad.call(Module, name, module, false);
      if (installWithElectronLike(mod)) return true;
    } catch (_err) {
      // 忽略，等待后续重试
    }
  }
  return false;
}

Module._load = function patchedModuleLoad(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (typeof request === 'string' && request.startsWith('electron')) {
    try {
      installWithElectronLike(loaded);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      process.stderr.write('[native-fake-login] install error: ' + msg + '\n');
    }
  }
  return loaded;
};

if (!tryInstallNow()) {
  // 仅用于学习/测试：主进程初始化较慢时持续重试，确保在用户触发登录前完成挂钩。
  let attempts = 0;
  retryTimer = setInterval(() => {
    attempts += 1;
    if (tryInstallNow()) return;
    if (attempts >= 300) {
      clearInterval(retryTimer);
      retryTimer = null;
      process.stderr.write('[native-fake-login] install timeout\n');
    }
  }, 100);
  process.stderr.write('[native-fake-login] retrying install\n');
} else {
  process.stderr.write('[native-fake-login] armed\n');
}
