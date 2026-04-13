import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import {
  BucketExecutionRecord,
  BucketPlan,
  DiscoveredTestCase,
  OrderedRunSummary,
} from '../../helper/models/runner/runnerTypes';
import { RunnerConstants } from '../../support/constants/RunnerConstants';
import { OrderedReportParser } from './OrderedReportParser';
import { OrderedSummaryWriter } from './OrderedSummary';
import { PathConstants } from '../../support/constants/PathConstants';
import { OrderedExecution } from './OrderedExecution';

export class TestOrderManager {
  /**
   * Loads environment variables from a .env file if it exists.
   * This allows users to configure the ordered runner using a .env file in addition to command-line arguments.
   * The method uses the dotenv package to read the .env file and populate process.env with the defined variables.
   * If no .env file is found, it simply leaves process.env unchanged, allowing for flexibility in how users choose to configure their test runs.
   */
  private static loadEnvironment(): void {
    dotenv.config();
  }

  /**
   * Generates a timestamp for use in creating unique report directories.
   * @returns A string representing the current timestamp in a specific format.
   */
  private static timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  }

  /**
   * Logs a message to the console.
   * @param message The message to log.
   */
  private static log(message: string): void {
    process.stdout.write(`[TestOrderManager] ${message}\n`);
  }

  /**
   * Ensures that a directory exists, creating it if necessary.
   * @param dirPath The path to the directory to ensure.
   */
  private static ensureDir(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  /**
   * Reads a JSON file and returns its parsed content.
   * @param filePath The path to the JSON file.
   * @returns The parsed content of the JSON file.
   */
  private static readJsonFile<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  }

  /**
   * Gets the path to the Playwright CLI.
   * @returns The path to the Playwright CLI.
   */
  private static getPlaywrightCliPath(): string {
    const cliPath = path.join(process.cwd(), 'node_modules', 'playwright', 'cli.js');
    if (!fs.existsSync(cliPath)) {
      throw new Error(
        `Playwright CLI not found at ${cliPath}. Run npm install before using the ordered runner.`
      );
    }

    return cliPath;
  }

  /**
   * Gets the path to the Playwright configuration file.
   * @returns The path to the Playwright configuration file.
   */
  private static getPlaywrightConfigPath(): string {
    return path.join(process.cwd(), 'playwright.config.ts');
  }

  /**
   * Gets the path to the merge configuration file.
   * @returns The path to the merge configuration file.
   */
  private static getMergeConfigPath(): string {
    return path.join(process.cwd(), 'src', 'runner', 'playwright.merge.config.ts');
  }

  /**
   * Creates the root directory for the test run reports, using either a specified environment variable or a default path that includes a timestamp.
   * This ensures that each test run has a unique directory for storing its results, preventing conflicts and making it easier to organize and access past test runs.
   * @returns
   */
  private static createReportRoot(): string {
    return process.env.REPORT_ROOT || path.join(process.cwd(), 'reports', this.timestamp());
  }

  /**
   * Spawns a child process to run Playwright with the specified arguments and environment variables.
   * This method is responsible for executing Playwright commands in a separate process, allowing the ordered runner to control the execution flow and capture results without blocking the main process.
   * It returns a promise that resolves with the exit code of the child process, enabling the caller to determine if the Playwright command executed successfully or if it encountered errors.
   * @param args  - The command-line arguments to pass to the Playwright CLI.
   * @param env  - The environment variables to set for the child process, allowing for dynamic configuration of the Playwright execution context.
   * @returns A promise that resolves with the exit code of the child process, indicating the success or failure of the Playwright command.
   */
  private static async spawnPlaywrightProcess(
    args: string[],
    env: NodeJS.ProcessEnv
  ): Promise<number> {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: process.cwd(),
        env,
        stdio: 'inherit',
      });

      child.on('error', reject);
      child.on('close', (code) => resolve(code ?? 1));
    });
  }

  /**
   * Gets the location arguments for a bucket of tests.
   * @param bucket The bucket plan containing the tests.
   * @returns An array of location arguments for each test in the bucket.
   */
  private static getBucketLocationArgs(bucket: BucketPlan): string[] {
    return bucket.tests.map((test) => `${path.normalize(test.file)}:${test.line}`);
  }

  /**
   * Discovers tests for a given report root and forwarded arguments.
   * @param reportRoot The root directory for the test run reports.
   * @param forwardedArgs The command-line arguments to forward to the Playwright CLI.
   * @returns A promise resolving to the list of discovered test cases.
   */
  private static async discoverTests(
    reportRoot: string,
    forwardedArgs: string[]
  ): Promise<DiscoveredTestCase[]> {
    const discoveryOutputPath = path.join(
      reportRoot,
      PathConstants.ORDERED_RESULTS_PATH,
      'discovery.json'
    );
    const env = {
      ...process.env,
      REPORT_ROOT: reportRoot,
      ORDERED_DISCOVERY: 'true',
      ORDERED_DISCOVERY_OUTPUT_FILE: discoveryOutputPath,
    };

    this.ensureDir(path.dirname(discoveryOutputPath));

    const exitCode = await this.spawnPlaywrightProcess(
      [
        this.getPlaywrightCliPath(),
        'test',
        '--list',
        '-c',
        this.getPlaywrightConfigPath(),
        ...forwardedArgs,
      ],
      env
    );

    if (exitCode !== 0) {
      throw new Error(`Playwright discovery failed with exit code ${exitCode}.`);
    }

    if (!fs.existsSync(discoveryOutputPath)) {
      throw new Error(`Discovery output was not created at ${discoveryOutputPath}.`);
    }

    return OrderedReportParser.parseDiscoveryReport(this.readJsonFile<any>(discoveryOutputPath));
  }

  /**
   * Summarizes the test results for a bucket of tests.
   * @param bucketTests The list of executed tests in the bucket.
   * @returns A summary of the test results.
   */
  private static summarizeBucketTests(
    bucketTests: ReturnType<typeof OrderedReportParser.parseExecutedTests>['tests']
  ): BucketExecutionRecord['stats'] {
    const summary = {
      total: bucketTests.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
    };

    for (const test of bucketTests) {
      if (test.outcome === 'flaky') {
        summary.flaky++;
        summary.passed++;
        continue;
      }

      if (test.outcome === 'skipped') {
        summary.skipped++;
        continue;
      }

      if (
        test.outcome === 'unexpected' ||
        test.finalStatus === 'failed' ||
        test.finalStatus === 'timedOut'
      ) {
        summary.failed++;
        continue;
      }

      if (test.finalStatus === 'interrupted') {
        summary.failed++;
        continue;
      }

      summary.passed++;
    }

    return summary;
  }

  /**
   * Builds a single executable bucket record from a grouped set of adjacent buckets.
   * @param group - A grouped set of adjacent bucket plans.
   * @returns A merged bucket plan that can be executed as one Playwright run.
   */
  private static buildGroupBucket(group: BucketPlan[]): BucketPlan {
    const tests = OrderedExecution.mergeGroupTests(group);

    return {
      key: group.map((bucket) => bucket.key).join('+'),
      label: group.map((bucket) => bucket.label).join(', '),
      kind: group[0]?.kind ?? 'none',
      critical: group.some((bucket) => bucket.critical),
      tests,
    };
  }

  /**
   * Creates a skipped record for a grouped or single bucket when nothing matched.
   * @param bucket - The bucket plan to represent in the summary.
   * @param reason - The reason the bucket was skipped.
   * @returns A bucket execution record marked as skipped.
   */
  private static createSkippedRecord(
    bucket: BucketPlan,
    reason: string,
    status: BucketExecutionRecord['status'] = 'skipped'
  ): BucketExecutionRecord {
    return {
      key: bucket.key,
      label: bucket.label,
      kind: bucket.kind,
      critical: bucket.critical,
      matchedCount: 0,
      executed: false,
      skipped: true,
      skippedReason: reason,
      durationMs: 0,
      status,
      stats: { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 },
      failedTests: [],
      slowTests: [],
    };
  }

  /**
   * Executes a single bucket of tests.
   * @param bucket The bucket plan containing the tests to execute.
   * @param reportRoot The root directory for the test run reports.
   * @param forwardedArgs The command-line arguments to forward to the Playwright CLI.
   * @returns A promise resolving to the execution record for the bucket.
   */
  private static async executeBucket(
    bucket: BucketPlan,
    reportRoot: string,
    forwardedArgs: string[]
  ): Promise<BucketExecutionRecord> {
    if (!bucket.tests.length) {
      return {
        key: bucket.key,
        label: bucket.label,
        kind: bucket.kind,
        critical: bucket.critical,
        matchedCount: 0,
        executed: false,
        skipped: true,
        skippedReason: 'No tests matched this bucket.',
        durationMs: 0,
        status: 'skipped',
        stats: { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 },
        failedTests: [],
        slowTests: [],
      };
    }

    const resultsDir = path.join(reportRoot, PathConstants.ORDERED_RESULTS_PATH);
    const bucketJsonPath = path.join(resultsDir, `${bucket.key}.json`);

    this.ensureDir(resultsDir);

    const env = {
      ...process.env,
      REPORT_ROOT: reportRoot,
      ORDERED_RUN: 'true',
      ORDERED_BUCKET_NAME: bucket.key,
      ORDERED_BUCKET_JSON_OUTPUT_FILE: bucketJsonPath,
      ORDERED_BLOB_OUTPUT_DIR: path.join(reportRoot, PathConstants.BLOB_REPORTS_PATH),
      ORDERED_BLOB_FILE_NAME: `${bucket.key}.zip`,
    };

    const startedAt = Date.now();
    const exitCode = await this.spawnPlaywrightProcess(
      [
        this.getPlaywrightCliPath(),
        'test',
        '-c',
        this.getPlaywrightConfigPath(),
        ...this.getBucketLocationArgs(bucket),
        ...forwardedArgs,
      ],
      env
    );
    const durationMs = Date.now() - startedAt;

    const parsedResults = fs.existsSync(bucketJsonPath)
      ? OrderedReportParser.parseExecutedTests(this.readJsonFile<any>(bucketJsonPath))
      : { tests: [], durationMs };
    const stats = this.summarizeBucketTests(parsedResults.tests);
    const failedTests = parsedResults.tests.filter(
      (test) =>
        test.outcome === 'unexpected' ||
        test.finalStatus === 'failed' ||
        test.finalStatus === 'timedOut'
    );
    const slowTests = [...parsedResults.tests]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 5);

    let status: BucketExecutionRecord['status'] = 'passed';
    if (exitCode !== 0 && !failedTests.length && !parsedResults.tests.length) {
      status = 'interrupted';
    } else if (failedTests.length || exitCode !== 0) {
      status = 'failed';
    }

    return {
      key: bucket.key,
      label: bucket.label,
      kind: bucket.kind,
      critical: bucket.critical,
      matchedCount: bucket.tests.length,
      executed: true,
      skipped: false,
      durationMs: parsedResults.durationMs || durationMs,
      status,
      stats,
      failedTests,
      slowTests,
    };
  }

  /**
   * Merges the blob reports for a given report root.
   * @param reportRoot The root directory for the test run reports.
   * @returns A promise resolving to the exit code of the merge process.
   */
  private static async mergeBlobReports(reportRoot: string): Promise<number> {
    const blobDir = path.join(reportRoot, PathConstants.BLOB_REPORTS_PATH);

    if (!fs.existsSync(blobDir)) {
      return 0;
    }

    return await this.spawnPlaywrightProcess(
      [this.getPlaywrightCliPath(), 'merge-reports', '-c', this.getMergeConfigPath(), blobDir],
      {
        ...process.env,
        REPORT_ROOT: reportRoot,
      }
    );
  }

  /**
   * Builds a summary of the ordered test run.
   * @param reportRoot The root directory for the test run reports.
   * @param mode The execution mode.
   * @param failurePolicy The failure policy.
   * @param dryRun Whether to perform a dry run.
   * @returns A promise resolving to the summary of the test run.
   */
  private static buildSummary(
    reportRoot: string,
    mode: ReturnType<typeof OrderedExecution.resolveOrderMode>,
    failurePolicy: ReturnType<typeof OrderedExecution.resolveFailurePolicy>,
    dryRun: boolean,
    discoveredTests: DiscoveredTestCase[],
    buckets: BucketPlan[],
    executedBuckets: BucketExecutionRecord[],
    scopeTags: string[],
    orderedTags: string[],
    stopReason?: string
  ): OrderedRunSummary {
    const executedTests = executedBuckets.reduce((sum, bucket) => sum + bucket.stats.total, 0);
    const failedCriticalTests = executedBuckets
      .filter((bucket) => bucket.critical)
      .flatMap((bucket) => bucket.failedTests);
    const topSlowTests = executedBuckets
      .flatMap((bucket) => bucket.slowTests)
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 10);

    return {
      mode,
      failurePolicy,
      dryRun,
      reportRoot,
      scopeTags,
      orderedTags,
      totals: {
        discovered: discoveredTests.length,
        selected: buckets.reduce((sum, bucket) => sum + bucket.tests.length, 0),
        executed: executedTests,
        passed: executedBuckets.reduce((sum, bucket) => sum + bucket.stats.passed, 0),
        failed: executedBuckets.reduce((sum, bucket) => sum + bucket.stats.failed, 0),
        skipped: executedBuckets.reduce((sum, bucket) => sum + bucket.stats.skipped, 0),
        flaky: executedBuckets.reduce((sum, bucket) => sum + bucket.stats.flaky, 0),
      },
      buckets: executedBuckets,
      stopReason,
      failedCriticalTests,
      topSlowTests,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Creates a stop reason message based on the bucket that caused the failure and the failure policy.
   * @param bucket - The bucket that was executed when the failure occurred, containing metadata about its criticality and label.
   * @param failurePolicy - The failure policy that determines when to abort the test run, such as 'immediate' or 'critical-only'.
   * @returns A string message explaining why the test run was aborted, including details about the bucket and the failure policy.
   */
  private static createStopReason(
    bucket: BucketPlan,
    failurePolicy: ReturnType<typeof OrderedExecution.resolveFailurePolicy>
  ): string {
    if (failurePolicy === 'immediate') {
      return `Execution aborted after failure in ${bucket.label}.`;
    }

    return `Execution aborted after critical failure in ${bucket.label}.`;
  }

  /** Runs the ordered test execution process, including loading environment variables, discovering tests, building buckets, executing tests, and generating a summary report.
   * This is the main entry point for the TestOrderManager and orchestrates the entire flow of the ordered test execution.
   * It handles configuration, error handling, and reporting to ensure that tests are executed in the defined order and that results are captured accurately.
   * @returns A promise that resolves when the test execution process is complete.
   */
  public static async run(): Promise<void> {
    this.loadEnvironment();
    const enableGrouping = process.env.ENABLE_BUCKET_GROUPING === 'true';
    this.log(`Bucket Grouping: ${enableGrouping ? 'ENABLED (safe, mode-aware)' : 'DISABLED'}`);

    const forwardedArgs = process.argv.slice(2);
    const mode = OrderedExecution.resolveOrderMode(process.env.ORDER_MODE);
    const failurePolicy = OrderedExecution.resolveFailurePolicy(process.env.FAILURE_POLICY);
    const dryRun = process.env.ORDER_DRY_RUN === 'true';
    const orderedTags = OrderedExecution.parseOrderedTags(process.env.ORDERED_TAGS);
    const scopeTags = OrderedExecution.parseScopeTags(process.env.SCOPE_TAGS);
    const reportRoot = this.createReportRoot();

    process.env.REPORT_ROOT = reportRoot;
    this.ensureDir(reportRoot);

    this.log(`Report root: ${reportRoot}`);
    this.log(`Mode: ${mode}`);
    this.log(`Failure Policy: ${failurePolicy}`);

    if (mode === 'custom' && !orderedTags.length) {
      throw new Error(
        'ORDER_MODE=custom requires ORDERED_TAGS to be set, for example ORDERED_TAGS=P1,P3.'
      );
    }

    const invalidOrderedTags = orderedTags.filter(
      (tag) =>
        tag !== RunnerConstants.NO_PRIORITY_TOKEN &&
        !RunnerConstants.PRIORITY_TAGS.includes(
          tag as (typeof RunnerConstants.PRIORITY_TAGS)[number]
        )
    );
    if (invalidOrderedTags.length) {
      throw new Error(
        `Unsupported ORDERED_TAGS value(s): ${invalidOrderedTags.join(', ')}. Use P1, P2, P3, P4, or NoPriority.`
      );
    }

    const discoveredTests = await this.discoverTests(reportRoot, forwardedArgs);
    const validationErrors = OrderedExecution.validateDiscoveredTests(discoveredTests);
    if (validationErrors.length) {
      validationErrors.forEach((error) => this.log(`Validation error: ${error}`));
      throw new Error(
        `Ordered execution validation failed with ${validationErrors.length} error(s).`
      );
    }

    const buckets = OrderedExecution.buildBuckets(discoveredTests, {
      mode,
      scopeTags,
      orderedTags,
    });

    const bucketRecords: BucketExecutionRecord[] = [];
    let stopReason: string | undefined;
    let encounteredFailure = false;
    const executionGroups = enableGrouping
      ? OrderedExecution.groupBuckets(buckets)
      : buckets.map((bucket) => [bucket]);
    this.log(
      `Execution Units: ${executionGroups.map((g) => g.map((b) => b.key).join('+')).join(' | ')}`
    );

    if (!dryRun) {
      for (const group of executionGroups) {
        const executionBucket = this.buildGroupBucket(group);

        if (stopReason) {
          bucketRecords.push(this.createSkippedRecord(executionBucket, stopReason, 'not-run'));
          continue;
        }

        if (!executionBucket.tests.length) {
          bucketRecords.push(
            this.createSkippedRecord(executionBucket, 'No tests matched this bucket group.')
          );
          continue;
        }

        this.log(
          `Executing bucket group ${executionBucket.label} with ${executionBucket.tests.length} test(s)`
        );
        const bucketRecord = await this.executeBucket(executionBucket, reportRoot, forwardedArgs);
        bucketRecords.push(bucketRecord);

        if (bucketRecord.status === 'failed' || bucketRecord.status === 'interrupted') {
          encounteredFailure = true;
        }

        if (
          OrderedExecution.shouldAbortAfterBucket(
            executionBucket,
            bucketRecord.status,
            mode,
            failurePolicy
          )
        ) {
          stopReason = this.createStopReason(executionBucket, failurePolicy);
        }
      }
    } else {
      for (const group of executionGroups) {
        const executionBucket = this.buildGroupBucket(group);
        bucketRecords.push(this.createSkippedRecord(executionBucket, 'Dry run only.', 'not-run'));
      }
    }

    let mergeExitCode = 0;
    if (!dryRun) {
      mergeExitCode = await this.mergeBlobReports(reportRoot);
      if (mergeExitCode !== 0) {
        encounteredFailure = true;
        stopReason = stopReason
          ? `${stopReason} Blob report merge also failed.`
          : 'Blob report merge failed.';
      }
    }

    const summary = this.buildSummary(
      reportRoot,
      mode,
      failurePolicy,
      dryRun,
      discoveredTests,
      buckets,
      bucketRecords,
      scopeTags,
      orderedTags,
      stopReason
    );
    OrderedSummaryWriter.writeOrderedSummary(reportRoot, summary);

    if (encounteredFailure) {
      process.exitCode = 1;
    }
  }
}

/** Runs the ordered test execution process. */
TestOrderManager.run().catch((error: Error) => {
  process.stderr.write(`[TestOrderManager] ${error.message}\n`);
  process.exitCode = 1;
});
