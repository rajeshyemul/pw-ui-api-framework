import { Locator, Page } from '@playwright/test';
import { PageActions } from '@helper/actions/PageActions';
import { LocatorFactory } from '@helper/actions/LocatorFactory';
import { UIActions } from '@helper/actions/UIActions';
import { AssertUtils } from '@helper/assertions/ui/AssertUtils';
import { ExpectUtils } from '@helper/assertions/ui/ExpectUtils';
import { Logger } from '@helper/logger/Logger';
import { StepRunner } from '@helper/reporting/StepRunner';
import { WaitUtils } from '@helper/waits/WaitUtils';

export abstract class BasePage {
  protected pageActions: PageActions;
  protected ui: UIActions;
  protected assertUtils: AssertUtils;
  protected expectUtils: ExpectUtils;
  protected waitUtils: WaitUtils;

  protected abstract pageUrl: string;
  protected abstract pageTitle: string | RegExp;
  protected abstract pageReadySelector: string;

  constructor(pageActions: PageActions) {
    this.pageActions = pageActions;
    this.ui = new UIActions(pageActions);
    this.assertUtils = new AssertUtils();
    this.expectUtils = new ExpectUtils(pageActions);
    this.waitUtils = new WaitUtils(pageActions);

    Logger.debug(`${this.constructor.name} initialized`);
  }

  protected get page(): Page {
    return this.pageActions.getPage();
  }

  protected locator(selector: string): Locator {
    return LocatorFactory.getLocator(this.pageActions, selector);
  }

  protected locatorByText(text: string | RegExp): Locator {
    return LocatorFactory.getLocatorByText(this.pageActions, text);
  }

  protected locatorByRole(
    role: 'button' | 'link' | 'textbox' | 'heading' | 'img' | 'list' | 'listitem',
    options?: { name?: string | RegExp }
  ): Locator {
    return LocatorFactory.getLocatorByRole(this.pageActions, role, options);
  }

  async navigate(): Promise<void> {
    const pageName = this.constructor.name;
    await StepRunner.run(`${pageName} - navigation`, async () => {
      await this.pageActions.gotoURL(this.pageUrl, pageName);
      await this.waitUtils.waitForPageLoad();
      await this.waitUtils.waitForPageReady(this.pageReadySelector);
    });
  }

  async verifyPageLoaded(): Promise<void> {
    const pageName = this.constructor.name;
    await StepRunner.run(`${pageName} - title verification`, async () => {
      await this.expectUtils.expectPageToHaveTitle(
        this.pageTitle,
        `${pageName} title verification`,
        'Page title did not match expected value'
      );
    });
  }

  async reload(): Promise<void> {
    await this.pageActions.reloadPage();
    await this.waitUtils.waitForPageLoad();
    await this.waitUtils.waitForPageReady(this.pageReadySelector);
  }
}
