import path from "path";

export class FlakyTestConstants {
// ─── Storage Paths ────────────────────────────────────────────────────────
static readonly FLAKY_ROOT = path.join(process.cwd(), "flaky-report");
static readonly FLAKY_HISTORY_FILE = path.join(this.FLAKY_ROOT, "flaky-history.json");
static readonly FLAKY_REPORT_HTML = path.join(this.FLAKY_ROOT, "flaky-report.html");
static readonly FLAKY_SUMMARY_JSON = path.join(this.FLAKY_ROOT, "flaky-summary.json");

static createRunFolderName(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
}

static getRunFolder(runFolderName: string): string {
  return path.join(this.FLAKY_ROOT, runFolderName);
}

static getRunSummaryFile(runFolderName: string): string {
  return path.join(this.getRunFolder(runFolderName), "flaky-summary.json");
}

static getRunReportHtml(runFolderName: string): string {
  return path.join(this.getRunFolder(runFolderName), "flaky-report.html");
}

// ─── Thresholds ───────────────────────────────────────────────────────────

// How many past runs to keep per test in history
static readonly MAX_RUNS_PER_TEST = 20;

// Minimum runs before a test can be classified as flaky
// Prevents a single retry from immediately flagging a new test
static readonly MIN_RUNS_TO_CLASSIFY = 1;

// >= 40% flaky rate = HIGH risk
static readonly HIGH_FLAKY_THRESHOLD = 0.4;

// >= 20% flaky rate = MEDIUM risk
static readonly MED_FLAKY_THRESHOLD = 0.2;
}
