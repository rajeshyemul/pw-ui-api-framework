import { ConfigManager } from '@config/ConfigManager';
import { LoginRequest } from '@contracts/AuthContract';

export class AuthFactory {
  static validCredentials(): LoginRequest {
    return {
      username: ConfigManager.getUsername(),
      password: ConfigManager.getPassword(),
    };
  }

  static invalidCredentials(): LoginRequest {
    return {
      username: 'invalid-admin-user',
      password: 'invalid-password',
    };
  }
}
