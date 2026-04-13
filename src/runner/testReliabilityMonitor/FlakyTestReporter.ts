import { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from "@playwright/test/reporter";
import fs from "fs";
import path from "path";

import { TestRun } from "../../models/testReliabilityMonitor/FlakyTestTypes";
import { FlakyTestAnalyser } from "./FlakyTestAnalyser";
import { FlakyTestHtmlReport } from "./FlakyTestHtmlReport";
import { FlakyTestStore } from "./FlakyTestStore";
import { FlakyTestConstants } from "@support/constants/FlakyTestConstants";

/**
 * FlakyTestReporter
 *
 * A custom Playwright reporter that detects and tracks flaky tests.
 *
 * HOW FLAKINESS IS DETECTED:
 * ─────────────────────────────────────────────────────────────────────────────
 * Playwright calls onTestEnd() for EVERY retry attempt of a test, not just
 * the final outcome. This means we get a complete picture of all attempts for each test,
 * which is crucial for accurately identifying flakiness.
 *
 * result.retry  tells us which attempt number this is (0 = first attempt).
 * result.status tells us what happened on THIS attempt.
 *
 * A test is flaky when:
 *   - It failed on attempt 0 (or any earlier attempt), AND
 *   - It eventually passed on a later attempt (result.status === 'passed'
 *     AND result.retry > 0)
 *
 * We track the attempts in-memory per test title during the run,
 * then write to persistent history in onEnd().
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * OUTPUT FILES:
 *   flaky-report/flaky-history.json                    — rolling history across runs
 *   flaky-report/<timestamp>/flaky-summary.json        — run analysis
 *   flaky-report/<timestamp>/flaky-report.html         — visual report (open in browser)
 */
export default class FlakyTestReporter implements Reporter {
  private store = new FlakyTestStore();
  private readonly isEnabled: boolean = process.env.FLAKY_TRACKING?.toLowerCase() === "true";

  /**
   * In-memory accumulator for the CURRENT run only.
   * Key = test title. Value = all attempts seen in this run.
   */
  private currentRunAttempts = new Map<
    string,
    {
      testTitle: string;
      testFile: string;
      attempts: Array<{ status: string; retry: number; durationMs: number; errorMessage?: string }>;
    }
  >();

  private getTestTitle(test: TestCase): string {
    return test.titlePath().slice(1).join(" › ");
  }

  private getTestKey(testFile: string, testTitle: string): string {
    return `${testFile}::${testTitle}`;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  onBegin(_config: FullConfig, _suite: Suite): void {
    if (!this.isEnabled) {
      console.log("  ⏸  Test Reliability Monitor — tracking disabled (FLAKY_TRACKING=false in .env)");
      return;
    }
    fs.mkdirSync(FlakyTestConstants.FLAKY_ROOT, { recursive: true });
    this.store.load();
    this.currentRunAttempts.clear();
  }

  /**
   * Called by Playwright after EVERY test attempt (including retries).
   * We accumulate all attempts here and resolve flakiness in onEnd().
   */
  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.isEnabled) return;
    const testTitle = this.getTestTitle(test);
    const testFile = path.relative(process.cwd(), test.location.file);
    const testKey = this.getTestKey(testFile, testTitle);

    if (!this.currentRunAttempts.has(testKey)) {
      this.currentRunAttempts.set(testKey, { testTitle, testFile, attempts: [] });
    }

    const entry = this.currentRunAttempts.get(testKey)!;
    entry.attempts.push({
      status: result.status,
      retry: result.retry,
      durationMs: result.duration,
      errorMessage: result.error?.message?.split("\n")[0] // first line only
    });
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (!this.isEnabled) return;
    const runDate = new Date();
    const now = runDate.toISOString();
    const runFolderName = FlakyTestConstants.createRunFolderName(runDate);
    const runFolder = FlakyTestConstants.getRunFolder(runFolderName);

    // ── Process each test seen in this run ──────────────────────────────────
    for (const [testKey, { testTitle, testFile, attempts }] of this.currentRunAttempts) {
      // Sort attempts by retry number to ensure correct order
      attempts.sort((a, b) => a.retry - b.retry);

      const finalAttempt = attempts[attempts.length - 1];

      /**
       * Flakiness detection logic:
       *
       * Case 1: Test failed on first attempt AND passed on a retry
       *   → Clearly flaky. Record the FIRST failed attempt as the flaky event.
       *
       * Case 2: Test failed on ALL attempts (pure failure)
       *   → NOT flaky. Just failing. Record the final attempt only.
       *
       * Case 3: Test passed on first attempt (no retries needed)
       *   → STABLE. Record it as a normal pass.
       */
      const hadFailure = attempts.some((a) => a.status === "failed" || a.status === "timedOut");
      const eventuallyPassed = finalAttempt.status === "passed";
      const isFlaky = hadFailure && eventuallyPassed && attempts.length > 1;

      if (isFlaky) {
        // Record the failed attempts — these are the ones that reveal flakiness
        for (const attempt of attempts.filter((a) => a.status !== "passed")) {
          const run: TestRun = {
            date: now,
            status: attempt.status,
            retry: attempt.retry,
            durationMs: attempt.durationMs,
            errorMessage: attempt.errorMessage
          };
          this.store.record(testKey, testTitle, testFile, run, true);
        }
        // Also record the passing attempt (no flaky flag on the pass itself)
        const passingAttempt = attempts.find((a) => a.status === "passed")!;
        this.store.record(
          testKey,
          testTitle,
          testFile,
          {
            date: now,
            status: "passed",
            retry: passingAttempt.retry,
            durationMs: passingAttempt.durationMs
          },
          false
        );
      } else {
        // Not flaky — just record the final outcome
        const run: TestRun = {
          date: now,
          status: finalAttempt.status,
          retry: finalAttempt.retry,
          durationMs: finalAttempt.durationMs,
          errorMessage: finalAttempt.errorMessage
        };
        this.store.record(testKey, testTitle, testFile, run, false);
      }
    }

    // ── Persist updated history ─────────────────────────────────────────────
    this.store.save();
    fs.mkdirSync(runFolder, { recursive: true });

    // ── Build summary and reports ───────────────────────────────────────────
    const summary = FlakyTestAnalyser.buildSummary(this.store.getAll());

    fs.writeFileSync(FlakyTestConstants.FLAKY_SUMMARY_JSON, JSON.stringify(summary, null, 2), "utf-8");
    fs.writeFileSync(FlakyTestConstants.getRunSummaryFile(runFolderName), JSON.stringify(summary, null, 2), "utf-8");

    const html = FlakyTestHtmlReport.generate(summary);
    fs.writeFileSync(FlakyTestConstants.FLAKY_REPORT_HTML, html, "utf-8");
    fs.writeFileSync(FlakyTestConstants.getRunReportHtml(runFolderName), html, "utf-8");

    // ── Print terminal summary ──────────────────────────────────────────────
    this.printTerminalSummary(summary, runFolder);
  }

  // ── Terminal output ─────────────────────────────────────────────────────────

  private printTerminalSummary(summary: ReturnType<typeof FlakyTestAnalyser.buildSummary>, runFolder: string): void {
    const line = "═".repeat(58);
    const thin = "─".repeat(58);

    console.log(`\n${line}`);
    console.log("   🔍 FLAKY TEST DETECTOR SUMMARY");
    console.log(line);
    console.log(`  Tests tracked : ${summary.totalTests}`);
    console.log(`  Stable        : ${summary.stableTests}`);
    console.log(`  Flaky         : ${summary.flakyTests}`);
    console.log(thin);

    const flaky = summary.results.filter((r) => r.riskLevel !== "STABLE");

    if (flaky.length === 0) {
      console.log("  ✅ No flaky tests detected. All tests are stable.");
    } else {
      console.log("");

      // Group by risk level for clean output
      const byRisk: Record<string, typeof flaky> = { HIGH: [], MEDIUM: [], LOW: [] };
      flaky.forEach((r) => {
        if (byRisk[r.riskLevel]) byRisk[r.riskLevel].push(r);
      });

      if (byRisk.HIGH.length > 0) {
        console.log("  🔴 HIGH RISK:");
        byRisk.HIGH.forEach((r) => console.log(`     [${r.flakyRateLabel}] ${r.testTitle}`));
        console.log("");
      }
      if (byRisk.MEDIUM.length > 0) {
        console.log("  🟠 MEDIUM RISK:");
        byRisk.MEDIUM.forEach((r) => console.log(`     [${r.flakyRateLabel}] ${r.testTitle}`));
        console.log("");
      }
      if (byRisk.LOW.length > 0) {
        console.log("  🟡 LOW RISK:");
        byRisk.LOW.forEach((r) => console.log(`     [${r.flakyRateLabel}] ${r.testTitle}`));
        console.log("");
      }
    }

    console.log(thin);
    console.log(`  Reports saved to: flaky-report/`);
    console.log(`  ├─ flaky-history.json  (rolling history across runs)`);
    console.log(`  ├─ flaky-summary.json  (latest run summary)`);
    console.log(`  ├─ flaky-report.html   (latest HTML report)`);
    console.log(`  └─ ${path.relative(process.cwd(), runFolder)}/  (timestamped run snapshot)`);
    console.log(`${line}\n`);
  }
}
