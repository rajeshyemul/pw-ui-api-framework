// One recorded attempt of a test
export type TestRun = {
  date: string; // ISO timestamp
  status: string; // passed | failed | skipped | timedOut
  retry: number; // 0 = first attempt, 1 = first retry, etc.
  durationMs: number;
  errorMessage?: string; // first line of error, if failed
};

// Full history for one test — persisted in flaky-history.json
export type TestHistory = {
  testTitle: string;
  testFile: string;
  runs: TestRun[];
  flakyCount: number; // times this test was detected as flaky
  totalRuns: number; // total times executed
  lastSeen: string;
};

// Analysis result for one test — shown in report
export type FlakyTestResult = {
  testTitle: string;
  testFile: string;
  riskLevel: string; // 'HIGH' | 'MEDIUM' | 'LOW' | 'STABLE'
  flakyRate: number; // 0.0 to 1.0
  flakyRateLabel: string; // e.g. "35%"
  totalRuns: number;
  flakyCount: number;
  lastError?: string;
  lastSeen: string;
  recentRuns: TestRun[];
};

// Top-level summary for the current run
export type FlakySummary = {
  generatedAt: string;
  totalTests: number;
  stableTests: number;
  flakyTests: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  results: FlakyTestResult[];
};
