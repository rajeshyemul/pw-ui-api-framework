
import { FlakyTestConstants } from "@support/constants/FlakyTestConstants";
import { TestHistory, TestRun } from "../../models/testReliabilityMonitor/FlakyTestTypes";
import fs from "fs";

export class FlakyTestStore {
  private history: Record<string, TestHistory> = {};

  // Load history from disk — called once at suite start
  load(): void {
    fs.mkdirSync(FlakyTestConstants.FLAKY_ROOT, { recursive: true });
    if (!fs.existsSync(FlakyTestConstants.FLAKY_HISTORY_FILE)) {
      this.history = {};
      return;
    }
    try {
      this.history = JSON.parse(fs.readFileSync(FlakyTestConstants.FLAKY_HISTORY_FILE, "utf-8"));
    } catch {
      this.history = {};
    } // corrupt file — start fresh
  }

  // Write history to disk — called once after all results processed
  save(): void {
    fs.mkdirSync(FlakyTestConstants.FLAKY_ROOT, { recursive: true });
    fs.writeFileSync(FlakyTestConstants.FLAKY_HISTORY_FILE, JSON.stringify(this.history, null, 2));
  }

  // Record one test attempt
  record(testKey: string, testTitle: string, testFile: string, run: TestRun, isFlaky: boolean): void {
    if (!this.history[testKey]) {
      this.history[testKey] = {
        testTitle,
        testFile,
        runs: [],
        flakyCount: 0,
        totalRuns: 0,
        lastSeen: run.date
      };
    }
    const rec = this.history[testKey];
    rec.runs.push(run);
    // Keep only the most recent MAX_RUNS_PER_TEST entries
    if (rec.runs.length > FlakyTestConstants.MAX_RUNS_PER_TEST) rec.runs = rec.runs.slice(rec.runs.length - FlakyTestConstants.MAX_RUNS_PER_TEST);
    rec.totalRuns++;
    if (isFlaky) rec.flakyCount++;
    rec.lastSeen = run.date;
    rec.testFile = testFile;
  }

  getAll(): TestHistory[] {
    return Object.values(this.history);
  }
}
