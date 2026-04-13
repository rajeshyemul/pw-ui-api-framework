import { ApiClient } from '@core/ApiClient';
import { logger } from '@core/Logger';
import { ConfigManager } from '@config/ConfigManager';
import { LoginRequest, LoginResponse } from '@contracts/AuthContract';

class AuthManager {
  private token: string | null = null;

  async login(apiClient: ApiClient): Promise<string> {
    if (this.token) {
      logger.debug('Returning cached admin token');
      return this.token;
    }

    const credentials: LoginRequest = {
      username: ConfigManager.getUsername(),
      password: ConfigManager.getPassword(),
    };

    logger.info('Authenticating admin user', { username: credentials.username });

    const response = await apiClient.post('/auth/login', credentials);

    if (response.status() !== 200) {
      const body = await response.text().catch(() => '<unreadable>');
      throw new Error(`Admin login failed. Status: ${response.status()}, Body: ${body}`);
    }

    const payload = (await response.json()) as LoginResponse;
    this.token = payload.token;

    logger.info('Admin authentication successful');

    return this.token;
  }

  getAuthHeaders(): Record<string, string> {
    return this.token ? { Cookie: `token=${this.token}` } : {};
  }

  getToken(): string | null {
    return this.token;
  }

  clearToken(): void {
    this.token = null;
    logger.debug('Admin auth token cleared');
  }
}

export const authManager = new AuthManager();
