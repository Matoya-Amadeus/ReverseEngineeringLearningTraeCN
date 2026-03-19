import type { UserInfo } from '../types/auth-types';

export interface StorageLike {
  getItem(key: string): string | undefined;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TncTagLike {
  getTncUserTag(userId: string): string | undefined;
  deleteTncUserRegion(): Promise<void>;
}

export class UserStorage {
  private readonly userTagKey = 'iCubeAuthInfo://usertag';

  constructor(
    private readonly providerId: string,
    private readonly storage: StorageLike,
    private readonly tnc: TncTagLike
  ) {}

  get persistedKey(): string {
    return `iCubeAuthInfo://${this.providerId}`;
  }

  getUserInfoFromLocalStorage(): UserInfo | undefined {
    const raw = this.storage.getItem(this.persistedKey);
    if (!raw) return undefined;

    try {
      return JSON.parse(raw) as UserInfo;
    } catch {
      return undefined;
    }
  }

  async updateUserInfoStorage(userInfo?: UserInfo, forceLogout = false): Promise<void> {
    if (userInfo) {
      this.storage.setItem(this.persistedKey, JSON.stringify(userInfo));
      if (userInfo.userId && userInfo.account?.userTag) {
        await this.persistUserTag(userInfo.userId, userInfo.account.userTag);
      }
      return;
    }

    if (forceLogout) {
      this.storage.removeItem(this.persistedKey);
      await this.tnc.deleteTncUserRegion();
    }
  }

  async getStorageUserTag(userId: string): Promise<string | undefined> {
    const map = await this.readUserTagMap();
    return map[userId] ?? this.tnc.getTncUserTag(userId);
  }

  private async persistUserTag(userId: string, userTag: string): Promise<void> {
    const map = await this.readUserTagMap();
    map[userId] = userTag;
    this.storage.setItem(this.userTagKey, JSON.stringify(map));
  }

  private async readUserTagMap(): Promise<Record<string, string>> {
    const raw = this.storage.getItem(this.userTagKey);
    if (!raw) return {};

    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }
}
