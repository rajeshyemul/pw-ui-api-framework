import { uiTest } from '@fixtures/UiFixture';
import { Logger } from '@helper/logger/Logger';
import { ApiClient } from '@core/ApiClient';
import { AuthService } from '@services/AuthService';
import { BookingService } from '@services/BookingService';
import { RoomService } from '@services/RoomService';
import { APIRequestContext, request } from '@playwright/test';
import { ConfigManager } from '@config/ConfigManager';
import { metricsCollector } from '@observability/MetricsCollector';
import { TestDataCleanup } from '@test-data/TestDataCleanup';
import { TestDataRegistry } from '@test-data/TestDataRegistry';

type AppFixtures = {
  apiContext: APIRequestContext;
  apiClient: ApiClient;
  authService: AuthService;
  roomService: RoomService;
  authenticatedRoomService: RoomService;
  bookingService: BookingService;
  authenticatedBookingService: BookingService;
  registry: TestDataRegistry;
  flushMetrics: void;
};

export const appTest = uiTest.extend<AppFixtures>({
  apiContext:
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
    const context = await request.newContext({
      baseURL: ConfigManager.getApiRequestBaseUrl(),
      extraHTTPHeaders: {
        Accept: 'application/json',
      },
    });

    await use(context);
    await context.dispose();
    },

  apiClient: async ({ apiContext }, use) => {
    Logger.info('Creating ApiClient instance');
    await use(new ApiClient(apiContext));
  },

  authService: async ({ apiClient }, use) => {
    await use(new AuthService(apiClient));
  },

  roomService: async ({ apiClient }, use) => {
    await use(new RoomService(apiClient));
  },

  authenticatedRoomService: async ({ apiClient, authService }, use) => {
    await authService.login();
    await use(new RoomService(apiClient));
  },

  bookingService: async ({ apiClient }, use) => {
    await use(new BookingService(apiClient));
  },

  authenticatedBookingService: async ({ apiClient, authService }, use) => {
    await authService.login();
    await use(new BookingService(apiClient));
  },

  registry: async ({ apiClient, authService }, use) => {
    const registry = new TestDataRegistry();
    await authService.login();
    await use(registry);
    const cleanup = new TestDataCleanup(apiClient);
    await cleanup.cleanup(registry);
  },

  flushMetrics: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
        await use();
        metricsCollector.flush();
      },
    { auto: true },
  ],
});
