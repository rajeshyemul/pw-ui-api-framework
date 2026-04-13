import { FlakyTestConstants } from "@support/constants/FlakyTestConstants";
import { FlakySummary, FlakyTestResult, TestHistory } from "../../models/testReliabilityMonitor/FlakyTestTypes";
import { DateUtils } from "../../utils/DateUtils";

export class FlakyTestAnalyser {
  public static analyze(history: TestHistory): FlakyTestResult {
    const { testTitle, testFile, runs, flakyCount, totalRuns, lastSeen } = history;

    // Only classify after MIN_RUNS_TO_CLASSIFY runs to avoid false positives
    const flakyRate = totalRuns >= FlakyTestConstants.MIN_RUNS_TO_CLASSIFY ? flakyCount / totalRuns : 0;

    const riskLevel = flakyRate >= FlakyTestConstants.HIGH_FLAKY_THRESHOLD ? "HIGH" : flakyRate >= FlakyTestConstants.MED_FLAKY_THRESHOLD ? "MEDIUM" : flakyRate > 0 ? "LOW" : "STABLE";

    const lastError = [...runs].reverse().find((r) => r.status === "failed" && r.errorMessage)?.errorMessage;

    return {
      testTitle,
      testFile,
      riskLevel,
      flakyRate,
      flakyRateLabel: `${Math.round(flakyRate * 100)}%`,
      totalRuns,
      flakyCount,
      lastError,
      lastSeen,
      recentRuns: runs.slice(-5)
    };
  }

  public static buildSummary(histories: TestHistory[]): FlakySummary {
    const riskOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, STABLE: 3 };
    const results = histories
      .map((h) => this.analyze(h))
      .sort((a, b) => {
        const rd = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        return rd !== 0 ? rd : b.flakyRate - a.flakyRate;
      });
    const flaky = results.filter((r) => r.riskLevel !== "STABLE");
    return {
      generatedAt: DateUtils.getDateWithFormat(),
      totalTests: results.length,
      stableTests: results.length - flaky.length,
      flakyTests: flaky.length,
      highRisk: results.filter((r) => r.riskLevel === "HIGH").length,
      mediumRisk: results.filter((r) => r.riskLevel === "MEDIUM").length,
      lowRisk: results.filter((r) => r.riskLevel === "LOW").length,
      results
    };
  }
}
