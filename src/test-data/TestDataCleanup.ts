import { ApiClient } from '@core/ApiClient';
import { logger } from '@helper/logger/Logger';
import { TestDataRegistry } from '@test-data/TestDataRegistry';

export class TestDataCleanup {
  constructor(private readonly api: ApiClient) {}

  async cleanup(registry: TestDataRegistry): Promise<void> {
    const resources = registry.getAll().reverse();

    for (const resource of resources) {
      try {
        switch (resource.domain) {
          case 'booking':
            await this.api.delete(`/booking/${resource.id}`, { authenticated: true });
            break;
          case 'room':
            await this.api.delete(`/room/${resource.id}`, { authenticated: true });
            break;
        }
      } catch (error) {
        logger.warn('Cleanup failed', {
          domain: resource.domain,
          id: resource.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    registry.clear();
  }
}
