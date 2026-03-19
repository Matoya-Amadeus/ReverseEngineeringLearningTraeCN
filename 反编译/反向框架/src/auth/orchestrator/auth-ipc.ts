import { CH } from '../types/auth-events';
import type { AuthProviderId, LoginExtra, PrivacyMode } from '../types/auth-types';
import { AuthOrchestrator } from './auth-orchestrator';

type IpcLike = {
  handle: (ch: string, fn: (...args: any[]) => any) => void;
  on: (ch: string, fn: (...args: any[]) => void) => void;
};

export function registerAuthIpc(
  ipc: IpcLike,
  auth: AuthOrchestrator,
  tokenManager: { setJwtTokenEnabled: (enabled: boolean) => void }
): void {
  ipc.handle(CH.SANDBOX_TO_MAIN_INVOKE_GET_USER_INFO, () => auth.getUserInfo());
  ipc.handle(CH.SANDBOX_TO_MAIN_INVOKE_LOGIN, (_e, provider?: AuthProviderId, extra?: LoginExtra) => auth.login(provider, extra));
  ipc.handle(CH.SANDBOX_TO_MAIN_SEND_LOGOUT, () => auth.logout());
  ipc.handle(CH.SANDBOX_TO_MAIN_CHANGE_PRIVACY_MODE, (_e, mode: PrivacyMode) => auth.setPrivacyMode(mode));
  ipc.handle(CH.SANDBOX_TO_MAIN_REFRESH_USERINFO, (_e, force?: boolean) => auth.refreshUserInfo(force));
  ipc.handle(CH.SANDBOX_TO_MAIN_GET_SETUP_PAGE_LOGIN_FAILED_STATUS, () => auth.consumeSetupLoginFailedStatus());
  ipc.on(CH.SANDBOX_TO_MAIN_SET_JWT_TOKEN_ENABLED, (_e, enabled: boolean) => tokenManager.setJwtTokenEnabled(enabled));
}
