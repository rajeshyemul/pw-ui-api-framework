import { devices, type PlaywrightTestConfig, type ReporterDescription } from '@playwright/test';
import os from 'os';
import path from 'path';
import { ConfigManager } from './ConfigManager';
import { PathConstants } from '../support/constants/PathConstants';
import { SetupConstants } from '../support/constants/SetupConstants';

const FLAKY_REPORTER: ReporterDescription = ['./src/runner/testReliabilityMonitor/FlakyTestReporter.ts'];

const browserDeviceMap = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
} as const;

export class PlaywrightConfigFactory {
  static readonly TEST_DIR = './tests';
  static readonly GLOBAL_SETUP_PATH = './src/config/global-setup';
  static readonly GLOBAL_TEARDOWN_PATH = './src/config/global-teardown';

  private static getReportRoot(): string {
    if (!process.env.REPORT_ROOT) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
      process.env.REPORT_ROOT = path.join(process.cwd(), 'reports', timestamp);
    }

    return process.env.REPORT_ROOT;
  }

  private static isOrderedDiscovery(): boolean {
    return process.env.ORDERED_DISCOVERY === 'true';
  }

  private static isOrderedRun(): boolean {
    return process.env.ORDERED_RUN === 'true';
  }

  private static getSelectedBrowser() {
    return ConfigManager.getBrowser();
  }

  private static getReportPath(...segments: string[]): string {
    return path.join(this.getReportRoot(), ...segments);
  }

  private static parseNumber(value: string | undefined, fallback: number): number {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
  }

  private static getEnvironmentInfo(): Record<string, string> {
    return {
      Framework: SetupConstants.FRAMEWORK_TITLE,
      Environment: ConfigManager.getEnvironment(),
      Browser: this.getSelectedBrowser(),
      UI_Base_URL: ConfigManager.getUiBaseUrl(),
      API_Base_URL: ConfigManager.getApiBaseUrl(),
      OS_Platform: os.platform(),
      OS_Release: os.release(),
      Node_Version: process.version,
      Report_Generation_Time: new Date().toLocaleString(),
    };
  }

  static getConfiguredWorkers(): number | undefined {
    if (process.env.WORKERS) {
      return this.parseNumber(process.env.WORKERS, 1);
    }

    if (ConfigManager.isCI()) {
      return this.parseNumber(process.env.CI_WORKERS, 1);
    }

    return undefined;
  }

  static getRetries(): number {
    return this.parseNumber(process.env.RETRIES, ConfigManager.isCI() ? 1 : 0);
  }

  static getTestTimeout(): number {
    return this.parseNumber(process.env.TEST_TIMEOUT, 60_000);
  }

  static getOutputDirectory(): string {
    if (this.isOrderedRun()) {
      return path.join(
        this.getReportRoot(),
        PathConstants.FOLDER_ARTIFACTS,
        process.env.ORDERED_BUCKET_NAME || 'ordered-run'
      );
    }

    return this.getReportPath(PathConstants.FOLDER_ARTIFACTS);
  }

  private static createAllureReporter(environmentInfo: Record<string, string>): ReporterDescription {
    return [
      'allure-playwright',
      {
        detail: true,
        resultsDir: this.getReportPath(PathConstants.ALLURE_REPORTS_PATH),
        suiteTitle: true,
        environmentInfo,
      },
    ];
  }

  private static getDefaultReporters(): ReporterDescription[] {
    return [
      ['list'],
      [
        'html',
        {
          open: SetupConstants.NEVER,
          title: SetupConstants.HTML_REPORT_TITLE,
          outputFolder: this.getReportPath(PathConstants.HTML_REPORTS_PATH),
          noSnippets: true,
        },
      ],
      ['junit', { outputFile: this.getReportPath(PathConstants.JUNIT_REPORTS_PATH) }],
      ['json', { outputFile: this.getReportPath(PathConstants.JSON_REPORTS_PATH) }],
      this.createAllureReporter(this.getEnvironmentInfo()),
      FLAKY_REPORTER,
    ];
  }

  private static getOrderedDiscoveryReporters(): ReporterDescription[] {
    return [
      [
        'json',
        {
          outputFile:
            process.env.ORDERED_DISCOVERY_OUTPUT_FILE ||
            this.getReportPath(PathConstants.ORDERED_RESULTS_PATH, 'discovery.json'),
        },
      ],
    ];
  }

  private static getOrderedRunReporters(): ReporterDescription[] {
    return [
      ['list'],
      [
        'blob',
        {
          outputDir:
            process.env.ORDERED_BLOB_OUTPUT_DIR ||
            this.getReportPath(PathConstants.BLOB_REPORTS_PATH),
          fileName: process.env.ORDERED_BLOB_FILE_NAME || 'ordered-run.zip',
        },
      ],
      [
        'json',
        {
          outputFile:
            process.env.ORDERED_BUCKET_JSON_OUTPUT_FILE ||
            this.getReportPath(PathConstants.ORDERED_RESULTS_PATH, 'ordered-run.json'),
        },
      ],
      this.createAllureReporter({
        ...this.getEnvironmentInfo(),
        Ordered_Bucket: process.env.ORDERED_BUCKET_NAME || 'unknown',
      }),
      FLAKY_REPORTER,
    ];
  }

  static getReporters(): ReporterDescription[] {
    if (this.isOrderedDiscovery()) {
      return this.getOrderedDiscoveryReporters();
    }

    if (this.isOrderedRun()) {
      return this.getOrderedRunReporters();
    }

    return this.getDefaultReporters();
  }

  static getUseOptions(): PlaywrightTestConfig['use'] {
    return {
      baseURL: ConfigManager.getUiBaseUrl(),
      headless: ConfigManager.isHeadless(),
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
      screenshot: SetupConstants.ONLY_ON_FAILURE as 'only-on-failure',
      video: SetupConstants.RETAIN_ON_FAILURE as 'retain-on-failure',
      trace: SetupConstants.RETAIN_ON_FAILURE as 'retain-on-failure',
    };
  }

  static getProjects(): PlaywrightTestConfig['projects'] {
    const selectedBrowser = this.getSelectedBrowser();

    return [
      {
        name: `framework-${selectedBrowser}`,
        use: {
          ...browserDeviceMap[selectedBrowser],
          browserName: selectedBrowser,
        },
      },
    ];
  }
}
