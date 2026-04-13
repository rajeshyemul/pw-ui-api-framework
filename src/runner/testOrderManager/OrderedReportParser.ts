import { JsonSuite, JsonSpec, JsonReport, JsonTestResult } from '@helper/models/runner/orderReportInterface';
import { DiscoveredTestCase, ExecutedTestResult } from '../../helper/models/runner/runnerTypes';
import { OrderedExecution } from './OrderedExecution';

export class OrderedReportParser {

  /**
   *  Recursively collects all test specifications from a nested suite structure in the JSON report. This method traverses through the suites and their child suites, accumulating all specs into a single list. It is used to extract the relevant test cases for further processing, such as discovery or execution result parsing.
   * @param suites - The list of suites to collect specs from, which may contain nested suites and specs.
   * @param acc - An accumulator array that collects the specs as they are found during the recursive traversal. This is typically called with an empty array on the initial invocation.
   * @returns A flat list of all specs found within the provided suites and their nested structures.
   */
  private static collectSpecs(suites: JsonSuite[] | undefined, acc: JsonSpec[] = []): JsonSpec[] {
    for (const suite of suites ?? []) {
      acc.push(...(suite.specs ?? []));
      this.collectSpecs(suite.suites, acc);
    }

    return acc;
  }

  /**
   * Extracts error messages from a test result, handling both single error objects and arrays of errors. This method ensures that all relevant error messages are collected, even if they are structured differently in the JSON report. It provides a consistent way to retrieve error information for failed tests, which can be used for reporting or debugging purposes.
   * @param result - The test result object from which to extract error messages, which may contain an 'error' field for single errors and an 'errors' array for multiple errors.
   * @returns A list of error messages extracted from the test result, which may be empty if no errors are present.
   */
  private static getErrorMessages(result: JsonTestResult): string[] {
    const errors = result.errors ?? [];
    const errorMessages = errors
      .map((error) => error.message ?? error.value)
      .filter((message): message is string => Boolean(message));

    const fallbackMessage = result.error?.message ?? result.error?.value;
    if (!errorMessages.length && fallbackMessage) {
      errorMessages.push(fallbackMessage);
    }

    return errorMessages;
  }

  /**
   * Parses the discovery report from the JSON structure, extracting relevant information about each test case. This method transforms the raw JSON data into a structured format that includes test IDs, titles, file locations, and normalized tags. It ensures that each test case is represented as a DiscoveredTestCase object, which can be used for further processing in the test ordering and execution logic.
   * @param report - The JSON report containing the suites and specs to parse for test discovery.
   * @returns A list of DiscoveredTestCase objects representing the tests found in the report, with their associated metadata and normalized tags.
   */
  public static parseDiscoveryReport(report: JsonReport): DiscoveredTestCase[] {
    const specs = this.collectSpecs(report.suites);
    const seenIds = new Set<string>();
    const discoveredTests: DiscoveredTestCase[] = [];

    for (const spec of specs) {
      if (seenIds.has(spec.id)) {
        continue;
      }

      seenIds.add(spec.id);
      const normalizedTags = OrderedExecution.normalizeTags((spec.tags ?? []).map((tag) => `@${tag}`));

      discoveredTests.push({
        id: spec.id,
        title: spec.title,
        file: spec.file,
        line: spec.line,
        column: spec.column,
        tags: spec.tags ?? [],
        normalizedTags,
        priorityTag: OrderedExecution.getPriorityTag(normalizedTags),
      });
    }

    return discoveredTests;
  }

  /**
   * Parses the executed tests from the JSON report, extracting detailed information about each test's execution outcome. This method processes the test results to determine the final status, duration, and any error messages associated with each test case. It transforms the raw JSON data into a structured format that includes all relevant execution details, which can be used for reporting, analysis, or debugging purposes.
   * @param report - The JSON report containing the suites and specs with their execution results to parse.
   * @returns An object containing a list of ExecutedTestResult objects representing the executed tests and their outcomes, as well as the total duration of all tests.
   */
  public static parseExecutedTests(report: JsonReport): {
    tests: ExecutedTestResult[];
    durationMs: number;
  } {
    const specs = this.collectSpecs(report.suites);
    const tests: ExecutedTestResult[] = [];

    for (const spec of specs) {
      for (const test of spec.tests ?? []) {
        const totalDuration = test.results.reduce((sum, result) => sum + (result.duration ?? 0), 0);
        const finalResult = test.results[test.results.length - 1];
        const finalStatus = finalResult?.status ?? 'unknown';
        const errorMessages = test.results.flatMap((result) => this.getErrorMessages(result));

        tests.push({
          id: spec.id,
          title: spec.title,
          file: spec.file,
          line: spec.line,
          tags: OrderedExecution.normalizeTags((spec.tags ?? []).map((tag) => `@${tag}`)),
          outcome: test.status,
          finalStatus,
          durationMs: totalDuration,
          errorMessages,
        });
      }
    }

    return {
      tests,
      durationMs: report.stats?.duration ?? tests.reduce((sum, test) => sum + test.durationMs, 0),
    };
  }
}
