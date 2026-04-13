import {
  BucketExecutionRecord,
  BucketPlan,
  BuildBucketOptions,
  DiscoveredTestCase,
  FailurePolicy,
  OrderMode,
  PriorityTag,
} from '../../helper/models/runner/runnerTypes';
import { RunnerConstants } from '../../support/constants/RunnerConstants';

export class OrderedExecution {
  private static unique<T>(items: T[]): T[] {
    return [...new Set(items)];
  }

  /**
   * Sorts tests by file, line, column, and title to ensure a consistent order across different runs and environments.
   * @param tests  - The list of discovered test cases to sort.
   * @returns The sorted list of test cases.
   */
  private static sortTests(tests: DiscoveredTestCase[]): DiscoveredTestCase[] {
    return [...tests].sort((left, right) => {
      const fileComparison = left.file.localeCompare(right.file);
      if (fileComparison !== 0) {
        return fileComparison;
      }

      if (left.line !== right.line) {
        return left.line - right.line;
      }

      if (left.column !== right.column) {
        return left.column - right.column;
      }

      return left.title.localeCompare(right.title);
    });
  }

  /**
   * Claims tests that match a given predicate and are not already selected.
   * @param tests - The list of eligible tests to claim from.
   * @param selectedIds - A set of test IDs that have already been selected in previous buckets to avoid duplication.
   * @param predicate - A function that determines whether a test should be claimed for the current bucket based on its properties (e.g., tags).
   * @returns  The list of tests that have been claimed for the current bucket, sorted in a consistent order.
   */
  private static claimTests(
    tests: DiscoveredTestCase[],
    selectedIds: Set<string>,
    predicate: (test: DiscoveredTestCase) => boolean
  ): DiscoveredTestCase[] {
    const claimed = tests.filter((test) => !selectedIds.has(test.id) && predicate(test));

    for (const test of claimed) {
      selectedIds.add(test.id);
    }

    return this.sortTests(claimed);
  }

  /**
   * Determines if a given tag is a recognized priority bucket tag (e.g., @P1, @P2, @P3, @P4) based on predefined constants.
   * @param tag - The tag to evaluate.
   * @returns A boolean indicating whether the tag is a valid priority bucket tag, which helps ensure that only appropriate tags are used for bucket categorization in the test ordering process.
   */
  private static isPriorityBucketTag(tag: string): tag is PriorityTag {
    return RunnerConstants.PRIORITY_TAGS.includes(tag as PriorityTag);
  }

  /**
   * Normalizes a raw tag string by trimming whitespace, ensuring it starts with '@', and converting known patterns (e.g., 'runfirst', 'runlast', 'p1'-'p4') to standardized forms. This helps maintain consistency in tag usage across test cases and facilitates accurate bucket assignment during the test ordering process.
   * @param rawTag - The raw tag string to normalize, which may come from various sources and formats in the test definitions.
   * @returns The normalized tag string, standardized for consistent processing in the test ordering logic.
   */
  public static normalizeTag(rawTag: string): string {
    const trimmedTag = rawTag.trim();
    if (!trimmedTag) {
      return trimmedTag;
    }

    if (/^no[-_ ]?priority$/i.test(trimmedTag)) {
      return RunnerConstants.NO_PRIORITY_TOKEN;
    }

    const prefixedTag = trimmedTag.startsWith('@') ? trimmedTag : `@${trimmedTag}`;

    if (/^@runfirst$/i.test(prefixedTag)) {
      return RunnerConstants.RUN_FIRST_TAG;
    }

    if (/^@runlast$/i.test(prefixedTag)) {
      return RunnerConstants.RUN_LAST_TAG;
    }

    const priorityMatch = prefixedTag.match(/^@p([1-4])$/i);
    if (priorityMatch) {
      return `@P${priorityMatch[1]}`;
    }

    return prefixedTag;
  }

  /**
   * Normalizes a list of raw tag strings by trimming whitespace, ensuring they start with '@', and converting known patterns (e.g., 'runfirst', 'runlast', 'p1'-'p4') to standardized forms. This helps maintain consistency in tag usage across test cases and facilitates accurate bucket assignment during the test ordering process.
   * @param tags - The list of raw tag strings to normalize, which may come from various sources and formats in the test definitions.
   * @returns The list of normalized tag strings, standardized for consistent processing in the test ordering logic.
   */
  public static normalizeTags(tags: string[]): string[] {
    return this.unique(
      tags
        .map((tag) => this.normalizeTag(tag))
        .filter((tag) => Boolean(tag) && tag !== RunnerConstants.NO_PRIORITY_TOKEN)
    );
  }

  /**
   * Parses a comma-separated string of scope tags, normalizes them, and returns a list of unique tags. This is used to determine which tests fall within the defined scope for ordered execution based on their tags.
   * @param value - The raw comma-separated string of scope tags, which may include various formats and whitespace.
   * @returns The list of normalized scope tags.
   */
  public static parseScopeTags(value: string | undefined): string[] {
    if (!value) {
      return [];
    }

    return this.normalizeTags(value.split(','));
  }

  /**
   * Parses a comma-separated string of ordered tags, normalizes them, and returns a list of unique tags. This is used to define custom bucket categories for test ordering based on specific tags.
   * @param value - The raw comma-separated string of ordered tags, which may include various formats and whitespace.
   * @returns The list of normalized ordered tags.
   */ 
  public static parseOrderedTags(value: string | undefined): string[] {
    if (!value) {
      return [];
    }

    return this.unique(
      value
        .split(',')
        .map((tag) => this.normalizeTag(tag))
        .filter(Boolean)
    );
  }

  /**
   * Resolves the order mode based on the provided value, defaulting to 'priority' if the value is not recognized.
   * @param value - The raw order mode string, which may come from configuration or command-line arguments.
   * @returns The resolved order mode, ensuring it is one of the valid options.
   */ 
  public static resolveOrderMode(value: string | undefined): OrderMode {
    if (value === 'basic' || value === 'custom' || value === 'priority') {
      return value;
    }

    return 'priority';
  }

  /**
   * Resolves the failure policy based on the provided value, defaulting to 'critical' if the value is not recognized.
   * @param value - The raw failure policy string, which may come from configuration or command-line arguments.
   * @returns The resolved failure policy, ensuring it is one of the valid options.
   */ 
  public static resolveFailurePolicy(value: string | undefined): FailurePolicy {
    if (value === 'continue' || value === 'immediate' || value === 'critical') {
      return value;
    }

    return 'critical';
  }

  /**
   * Retrieves the priority tag from a normalized list of tags, if one exists.
   * @param normalizedTags - The normalized list of tags to search.
   * @returns The priority tag if found, otherwise null.
   */
  public static getPriorityTag(normalizedTags: string[]): PriorityTag | null {
    return RunnerConstants.PRIORITY_TAGS.find((tag) => normalizedTags.includes(tag)) ?? null;
  }

  /**
   * Validates a list of discovered tests, checking for any issues with their tags. 
   * This includes ensuring that tests do not have multiple priority tags and that they do not use conflicting boundary tags (e.g., @runfirst and @runlast). 
   * The method returns a list of error messages describing any validation issues found, which can be used to inform users of problems in their test definitions before execution.
   * @param tests - The list of discovered test cases to validate, which may contain various tag configurations that need to be checked for consistency and correctness.
   * @returns A list of error messages describing any validation issues found with the test cases, or an empty list if all tests are valid.
   */
  public static validateDiscoveredTests(tests: DiscoveredTestCase[]): string[] {
    const errors: string[] = [];

    for (const test of tests) {
      const normalizedTags = test.normalizedTags;
      const priorityTags = normalizedTags.filter((tag) =>
        RunnerConstants.PRIORITY_TAGS.includes(tag as PriorityTag)
      );
      const hasRunFirst = normalizedTags.includes(RunnerConstants.RUN_FIRST_TAG);
      const hasRunLast = normalizedTags.includes(RunnerConstants.RUN_LAST_TAG);

      if (priorityTags.length > 1) {
        errors.push(
          `Test "${test.title}" in ${test.file}:${test.line} has multiple priority tags: ${priorityTags.join(', ')}`
        );
      }

      if (hasRunFirst && hasRunLast) {
        errors.push(
          `Test "${test.title}" in ${test.file}:${test.line} cannot use both ${RunnerConstants.RUN_FIRST_TAG} and ${RunnerConstants.RUN_LAST_TAG}`
        );
      }
    }

    return errors;
  }

  /**
   * Checks if a test matches the specified scope tags.
   * @param test - The test case to check.
   * @param scopeTags - The list of scope tags to match against.
   * @returns True if the test matches the scope tags, otherwise false.
   */
  public static matchesScope(test: DiscoveredTestCase, scopeTags: string[]): boolean {
    if (!scopeTags.length) {
      return true;
    }

    return scopeTags.some((scopeTag) => test.normalizedTags.includes(scopeTag));
  }

  /**
   * Builds the execution buckets based on the discovered tests and the specified options. Tests are categorized into buckets according to their tags and the defined ordering mode (basic, priority, or custom). The method ensures that tests are assigned to appropriate buckets without duplication and that the buckets are sorted in a consistent order for execution.
   * This is a critical step in preparing the test execution plan for ordered test runs. 
   * @param tests - The list of discovered test cases to categorize into buckets, which may have various tags that determine their placement in the execution order.
   * @param options - The options that define how buckets should be built, including the ordering mode, scope tags, and any custom ordered tags that influence bucket categorization.
   * @returns A list of bucket plans, each containing the tests that belong to that bucket, ready for execution in the defined order.
   */
  public static buildBuckets(tests: DiscoveredTestCase[], options: BuildBucketOptions): BucketPlan[] {
    const eligibleTests = this.sortTests(
      tests.filter((test) => this.matchesScope(test, options.scopeTags))
    );
    const selectedIds = new Set<string>();
    const buckets: BucketPlan[] = [];

    const addBucket = (
      bucket: Omit<BucketPlan, 'tests'>,
      predicate: (test: DiscoveredTestCase) => boolean
    ): void => {
      buckets.push({
        ...bucket,
        tests: this.claimTests(eligibleTests, selectedIds, predicate),
      });
    };

    addBucket(
      {
        key: 'run-first',
        label: RunnerConstants.RUN_FIRST_TAG,
        kind: 'boundary',
        critical: true,
      },
      (test) => test.normalizedTags.includes(RunnerConstants.RUN_FIRST_TAG)
    );

    if (options.mode === 'basic') {
      addBucket(
        {
          key: 'default',
          label: 'Default',
          kind: 'none',
          critical: false,
        },
        (test) => {
          const normalizedTags = test.normalizedTags;
          return !normalizedTags.includes(RunnerConstants.RUN_FIRST_TAG) && !normalizedTags.includes(RunnerConstants.RUN_LAST_TAG);
        }
      );
    }

    if (options.mode === 'priority') {
      for (const priorityTag of RunnerConstants.PRIORITY_TAGS) {
        addBucket(
          {
            key: priorityTag.slice(1).toLowerCase(),
            label: priorityTag,
            kind: 'priority',
            critical: priorityTag === '@P1',
          },
          (test) => {
            const normalizedTags = test.normalizedTags;
            return (
              !normalizedTags.includes(RunnerConstants.RUN_FIRST_TAG) &&
              !normalizedTags.includes(RunnerConstants.RUN_LAST_TAG) &&
              normalizedTags.includes(priorityTag)
            );
          }
        );
      }

      addBucket(
        {
          key: 'no-priority',
          label: RunnerConstants.NO_PRIORITY_TOKEN,
          kind: 'none',
          critical: false,
        },
        (test) => {
          const normalizedTags = test.normalizedTags;
          return (
            !normalizedTags.includes(RunnerConstants.RUN_FIRST_TAG) &&
            !normalizedTags.includes(RunnerConstants.RUN_LAST_TAG) &&
            !RunnerConstants.PRIORITY_TAGS.some((priorityTag) => normalizedTags.includes(priorityTag))
          );
        }
      );
    }

    if (options.mode === 'custom') {
      for (const orderedTag of options.orderedTags) {
        if (orderedTag === RunnerConstants.NO_PRIORITY_TOKEN) {
          addBucket(
            {
              key: 'no-priority',
              label: RunnerConstants.NO_PRIORITY_TOKEN,
              kind: 'none',
              critical: false,
            },
            (test) => {
              const normalizedTags = test.normalizedTags;
              return (
                !normalizedTags.includes(RunnerConstants.RUN_FIRST_TAG) &&
                !normalizedTags.includes(RunnerConstants.RUN_LAST_TAG) &&
                !RunnerConstants.PRIORITY_TAGS.some((priorityTag) => normalizedTags.includes(priorityTag))
              );
            }
          );
          continue;
        }

        if (!this.isPriorityBucketTag(orderedTag)) {
          continue;
        }

        addBucket(
          {
            key: orderedTag.slice(1).toLowerCase(),
            label: orderedTag,
            kind: 'priority',
            critical: orderedTag === '@P1',
          },
          (test) => {
            const normalizedTags = test.normalizedTags;
            return (
              !normalizedTags.includes(RunnerConstants.RUN_FIRST_TAG) &&
              !normalizedTags.includes(RunnerConstants.RUN_LAST_TAG) &&
              normalizedTags.includes(orderedTag)
            );
          }
        );
      }
    }

    addBucket(
      {
        key: 'run-last',
        label: RunnerConstants.RUN_LAST_TAG,
        kind: 'boundary',
        critical: false,
      },
      (test) => test.normalizedTags.includes(RunnerConstants.RUN_LAST_TAG)
    );

    return buckets;
  }

  /**
   * Groups adjacent buckets so the runner can merge non-critical middle buckets into fewer Playwright invocations.
   * Critical buckets and boundary buckets remain isolated to preserve stop semantics.
   * @param buckets - The ordered bucket plans produced by buildBuckets.
   * @returns A list of execution groups, each containing one or more bucket plans.
   */
  public static groupBuckets(buckets: BucketPlan[]): BucketPlan[][] {
    const groups: BucketPlan[][] = [];
    let currentGroup: BucketPlan[] = [];

    const flushCurrentGroup = (): void => {
      if (!currentGroup.length) {
        return;
      }

      groups.push(currentGroup);
      currentGroup = [];
    };

    for (const bucket of buckets) {
      const shouldIsolate = bucket.kind === 'boundary' || bucket.critical;

      if (shouldIsolate) {
        flushCurrentGroup();
        groups.push([bucket]);
        continue;
      }

      currentGroup.push(bucket);
    }

    flushCurrentGroup();
    return groups;
  }

  /**
   * Flattens tests from a grouped set of buckets into the single list used for one Playwright invocation.
   * @param group - A grouped set of adjacent bucket plans.
   * @returns The merged list of discovered tests.
   */
  public static mergeGroupTests(group: BucketPlan[]): DiscoveredTestCase[] {
    return group.flatMap((bucket) => bucket.tests);
  }

  /**
   * Determines whether test execution should be aborted after completing a bucket based on the bucket's properties, 
   * the execution status of the bucket, the overall ordering mode, and the defined failure policy. 
   * This logic is crucial for enforcing the desired behavior when test failures occur, such as stopping execution immediately 
   * or allowing certain buckets to run even if previous ones have failed, depending on the configured failure policy.
   * @param bucket - The bucket plan that has just been executed, containing information about its criticality and other properties.
   * @param status - The execution status of the bucket, which can be 'passed', 'failed', 'skipped', 'interrupted', or 'not-run'.
   * @param mode - The overall ordering mode (basic, priority, or custom) that influences how buckets are categorized and executed.
   * @param failurePolicy - The defined failure policy (critical, continue, or immediate) that dictates how the system should respond to test failures in terms of aborting further execution.
   * @returns A boolean indicating whether test execution should be aborted after completing the bucket, based on the provided parameters and the logic defined for handling failures in different scenarios.
   */
  public static shouldAbortAfterBucket(
    bucket: BucketPlan,
    status: BucketExecutionRecord['status'],
    mode: OrderMode,
    failurePolicy: FailurePolicy
  ): boolean {
    if (status !== 'failed' && status !== 'interrupted') {
      return false;
    }

    if (failurePolicy === 'continue') {
      return false;
    }

    if (failurePolicy === 'immediate') {
      return true;
    }

    if (mode === 'basic') {
      return bucket.key === 'run-first';
    }

    return bucket.key === 'run-first' || bucket.label === '@P1';
  }
}
