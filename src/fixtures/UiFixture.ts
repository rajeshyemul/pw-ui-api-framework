import '@config/PageSetup';
import { test as baseTest } from '@playwright/test';
import { PageActions } from '@helper/actions/PageActions';
import { AssertUtils } from '@helper/assertions/ui/AssertUtils';
import { Logger } from '@helper/logger/Logger';
import { AdminLoginPage } from '@pages/adminLoginPage';
import { AdminRoomsPage } from '@pages/adminRoomsPage';
import { HomePage } from '@pages/homePage';

type UiFixtures = {
  pageActions: PageActions;
  assertUtils: AssertUtils;
  homePage: HomePage;
  adminLoginPage: AdminLoginPage;
  adminRoomsPage: AdminRoomsPage;
};

export const uiTest = baseTest.extend<UiFixtures>({
  pageActions: async ({ page, context }, use) => {
    Logger.info('Creating PageActions instance for test');
    const pageActions = new PageActions(page, context);
    await use(pageActions);
    Logger.info('PageActions fixture cleanup complete');
  },

  assertUtils:
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
    Logger.info('Creating AssertUtils instance for test');
    await use(new AssertUtils());
    Logger.info('AssertUtils fixture cleanup complete');
    },

  homePage: async ({ pageActions }, use) => {
    Logger.info('Creating HomePage instance');
    await use(new HomePage(pageActions));
    Logger.info('HomePage fixture cleanup complete');
  },

  adminLoginPage: async ({ pageActions }, use) => {
    Logger.info('Creating AdminLoginPage instance');
    await use(new AdminLoginPage(pageActions));
    Logger.info('AdminLoginPage fixture cleanup complete');
  },

  adminRoomsPage: async ({ pageActions }, use) => {
    Logger.info('Creating AdminRoomsPage instance');
    await use(new AdminRoomsPage(pageActions));
    Logger.info('AdminRoomsPage fixture cleanup complete');
  },
});
