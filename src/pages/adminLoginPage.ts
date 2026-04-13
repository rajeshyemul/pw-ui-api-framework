import { ConfigManager } from '@config/ConfigManager';
import { PageActions } from '@helper/actions/PageActions';
import { StepRunner } from '@helper/reporting/StepRunner';
import { BasePage } from '@pages/base/BasePage';
import { ApplicationUrls } from '@support/constants/ApplicationUrls';
import { AdminLoginPageLocators } from '@support/locators/AdminLoginPageLocators';

export class AdminLoginPage extends BasePage {
  protected pageUrl = ApplicationUrls.ADMIN;
  protected pageTitle = /Restful-booker-platform demo/i;
  protected pageReadySelector = AdminLoginPageLocators.USERNAME;

  constructor(pageActions: PageActions) {
    super(pageActions);
  }

  async verifyLoginFormVisible(): Promise<void> {
    await StepRunner.run('Admin Login - verify login form', async () => {
      await this.expectUtils.expectElementToHaveText(
        this.locator(AdminLoginPageLocators.LOGIN_HEADING),
        'admin login heading',
        /login/i,
        'Admin login heading is not visible or does not contain expected text'
      );
      await this.expectUtils.expectElementToBeVisible(
        this.locator(AdminLoginPageLocators.USERNAME),
        'admin username input',
        'Admin username input is not visible'
      );
      await this.expectUtils.expectElementToBeVisible(
        this.locator(AdminLoginPageLocators.PASSWORD),
        'admin password input',
        'Admin password input is not visible'
      );
      await this.expectUtils.expectElementToBeVisible(
        this.locator(AdminLoginPageLocators.LOGIN_BUTTON),
        'admin login button',
        'Admin login button is not visible'
      );
    });
  }

  async login(username: string, password: string): Promise<void> {
    await StepRunner.run('Admin Login - submit credentials', async () => {
      await this.ui.editBox.fill(AdminLoginPageLocators.USERNAME, username);
      await this.ui.editBox.fill(AdminLoginPageLocators.PASSWORD, password);

      await Promise.all([
        this.pageActions.waitForNavigation(/\/admin\/rooms/, 30_000),
        this.ui.element.click(this.locator(AdminLoginPageLocators.LOGIN_BUTTON)),
      ]);
    });
  }

  async loginAsAdmin(): Promise<void> {
    await this.login(ConfigManager.getUsername(), ConfigManager.getPassword());
  }
}
