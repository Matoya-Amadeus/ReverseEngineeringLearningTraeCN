import path from 'node:path';

export interface AuthPathLayout {
  rootDir: string;
  tokenFile: string;
  userFile: string;
  regionFile: string;
  configFile: string;
}

export function buildAuthPathLayout(rootDir: string): AuthPathLayout {
  return {
    rootDir,
    tokenFile: path.join(rootDir, 'token', 'trae-jwt-token'),
    userFile: path.join(rootDir, 'storage', 'auth-user.json'),
    regionFile: path.join(rootDir, 'storage', 'region-cache.json'),
    configFile: path.join(rootDir, 'config', 'auth-config.json')
  };
}
