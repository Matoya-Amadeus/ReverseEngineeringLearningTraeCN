import type { AuthProvider, AuthProviderId } from '../types/auth-types';

export class ProviderRegistry {
  private readonly providers = new Map<AuthProviderId, AuthProvider>();

  register(provider: AuthProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id?: AuthProviderId): AuthProvider | undefined {
    if (id && this.providers.has(id)) return this.providers.get(id);
    return this.providers.get('marscode');
  }
}
