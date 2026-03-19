export const CH = {
  SANDBOX_TO_MAIN_INVOKE_GET_USER_INFO: 'vscode:sandbox::main-invoke-getUserInfo',
  SANDBOX_TO_MAIN_INVOKE_LOGIN: 'vscode:sandbox::main-invoke-login',
  SANDBOX_TO_MAIN_SEND_LOGOUT: 'vscode:sandbox::main-send-logout',
  SANDBOX_TO_MAIN_REFRESH_USERINFO: 'vscode:sandbox::main-refresh-userinfo',
  SANDBOX_TO_MAIN_SEND_NEED_REFRESH_USER_INFO: 'vscode:sandbox::main-send-needRefreshUserInfo',
  SANDBOX_TO_MAIN_CHANGE_PRIVACY_MODE: 'vscode:sandbox::main-change-privacy',
  SANDBOX_TO_MAIN_GET_SETUP_PAGE_LOGIN_FAILED_STATUS: 'vscode:sandbox::main-invoke-getSetupPageLoginFailedStatus',
  SANDBOX_TO_MAIN_SET_JWT_TOKEN_ENABLED: 'vscode:sandbox::main-set-jwt-token-enabled',
  MAIN_TO_SANDBOX_SEND_USER_INFO: 'vscode:main::sandbox-send-userInfo',
  MAIN_TO_SANDBOX_SHOW_AUTH_INVALID_DIALOG: 'vscode:main::sandbox-show-auth-invalid-dialog',
  MAIN_TO_SANDBOX_DISPATCH_PRIVACY_MODE_CHANGE: 'vscode:main::sandbox-dispatch-privacy-mode-change'
} as const;
