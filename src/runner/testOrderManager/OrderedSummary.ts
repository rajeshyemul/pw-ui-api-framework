import fs from 'fs';
import path from 'path';
import { OrderedRunSummary } from '../../helper/models/runner/runnerTypes';
import { PathConstants } from '../../support/constants/PathConstants';

export class OrderedSummaryWriter {
  /**
   * Escapes special HTML characters in a string to prevent rendering issues and potential security vulnerabilities when displaying user-generated content in the generated HTML report. 
   * This method replaces characters such as &, <, >, ", and ' with their corresponding HTML entities, ensuring that the content is displayed correctly and safely in the browser.
   * @param value - The string value to escape for safe HTML rendering, which may contain special characters that need to be converted to their HTML entity equivalents.
   * @returns  The escaped string with special HTML characters replaced by their corresponding entities, suitable for safe inclusion in the generated HTML report.
   */
  private static escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Formats a duration in milliseconds into a human-readable string format, converting it into seconds and minutes as appropriate. This method provides a more user-friendly representation of test durations in the generated report, making it easier to understand the time taken for each test or bucket of tests at a glance.
   * @param durationMs - The duration in milliseconds to format, which may be a positive number representing the time taken for a test or a group of tests.
   * @returns A formatted string representing the duration in a more human-readable format, such as "500 ms", "2 s", or "1 m 30 s", depending on the length of the duration.
   */
  private static formatDuration(durationMs: number): string {
    if (!durationMs) {
      return '0 ms';
    }

    if (durationMs < 1000) {
      return `${durationMs} ms`;
    }

    const totalSeconds = Math.round(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (!minutes) {
      return `${seconds} s`;
    }

    return `${minutes} m ${seconds} s`;
  }

  /**
   * Determines the CSS class to apply based on the test status, which is used to visually differentiate between passed, failed, and other test outcomes in the generated HTML report. 
   * This method maps specific test statuses to corresponding CSS classes that define the color and styling of status indicators (e.g., pills) in the report, enhancing the readability and visual appeal of the execution summary.
   * @param status 
   * @returns 
   */
  private static getStatusClass(status: string): string {
    if (status === 'passed') {
      return 'passed';
    }

    if (status === 'failed' || status === 'interrupted') {
      return 'failed';
    }

    return 'muted';
  }

  /**
   * Builds the HTML content for the ordered execution summary report based on the provided summary data. This method constructs a complete HTML document that includes styling and structured content to present the execution results in a clear and visually appealing manner. It incorporates various sections such as overall metrics, bucket order details, failed critical scenarios, and slowest tests, all formatted according to the data in the OrderedRunSummary object.
   * @param summary - The OrderedRunSummary object containing all relevant data about the test execution, including totals, bucket details, failed critical tests, and slowest tests, which will be used to populate the content of the HTML report.
   * @returns A string containing the complete HTML content for the ordered execution summary report, ready to be written to a file or displayed in a browser.
   */
  private static buildHtml(summary: OrderedRunSummary): string {
    const bucketRows = summary.buckets
      .map((bucket) => {
        const counts = `${bucket.stats.passed} passed / ${bucket.stats.failed} failed / ${bucket.stats.skipped} skipped`;
        const note = bucket.skipped ? bucket.skippedReason ?? 'Not executed' : counts;

        return `
        <tr>
          <td>${this.escapeHtml(bucket.label)}</td>
          <td><span class="pill ${this.getStatusClass(bucket.status)}">${this.escapeHtml(bucket.status)}</span></td>
          <td>${bucket.matchedCount}</td>
          <td>${this.escapeHtml(note)}</td>
          <td>${this.formatDuration(bucket.durationMs)}</td>
        </tr>
      `;
      })
      .join('');

    const failedCritical = summary.failedCriticalTests.length
      ? summary.failedCriticalTests
          .map(
            (test) => `
            <li>
              <strong>${this.escapeHtml(test.title)}</strong>
              <span>${this.escapeHtml(`${test.file}:${test.line}`)}</span>
            </li>
          `
          )
          .join('')
      : '<li>No failed critical tests recorded.</li>';

    const slowTests = summary.topSlowTests.length
      ? summary.topSlowTests
          .map(
            (test) => `
            <li>
              <strong>${this.escapeHtml(test.title)}</strong>
              <span>${this.formatDuration(test.durationMs)}</span>
            </li>
          `
          )
          .join('')
      : '<li>No executed tests available.</li>';

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ordered Execution Summary</title>
    <style>
      :root {
        --bg: #f7f4ee;
        --panel: #fffdf8;
        --ink: #1f2937;
        --muted: #6b7280;
        --accent: #0f766e;
        --danger: #b91c1c;
        --border: #e5dccf;
      }

      body {
        margin: 0;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top right, rgba(15, 118, 110, 0.10), transparent 32%),
          linear-gradient(180deg, #f8f1e7 0%, var(--bg) 100%);
        color: var(--ink);
      }

      main {
        max-width: 1120px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }

      h1, h2 {
        margin: 0 0 12px;
      }

      p {
        color: var(--muted);
      }

      .hero {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 24px;
        box-shadow: 0 18px 48px rgba(31, 41, 55, 0.08);
      }

      .hero-grid,
      .cards {
        display: grid;
        gap: 16px;
      }

      .hero-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        margin-top: 18px;
      }

      .cards {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        margin-top: 20px;
      }

      .card,
      .table-card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 20px;
      }

      .metric {
        font-size: 28px;
        font-weight: 700;
      }

      .label {
        color: var(--muted);
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .pill.passed {
        color: var(--accent);
        background: rgba(15, 118, 110, 0.12);
      }

      .pill.failed {
        color: var(--danger);
        background: rgba(185, 28, 28, 0.12);
      }

      .pill.muted {
        color: var(--muted);
        background: rgba(107, 114, 128, 0.12);
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        text-align: left;
        padding: 12px 10px;
        border-bottom: 1px solid var(--border);
        vertical-align: top;
      }

      th {
        color: var(--muted);
        font-size: 13px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      ul {
        margin: 0;
        padding-left: 18px;
      }

      li {
        margin-bottom: 10px;
      }

      li span {
        display: block;
        color: var(--muted);
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>Ordered Execution Summary</h1>
        <p>Mode: ${this.escapeHtml(summary.mode)} | Failure policy: ${this.escapeHtml(summary.failurePolicy)} | Generated: ${this.escapeHtml(summary.generatedAt)}</p>
        <div class="hero-grid">
          <div>
            <div class="label">Discovered</div>
            <div class="metric">${summary.totals.discovered}</div>
          </div>
          <div>
            <div class="label">Selected</div>
            <div class="metric">${summary.totals.selected}</div>
          </div>
          <div>
            <div class="label">Executed</div>
            <div class="metric">${summary.totals.executed}</div>
          </div>
          <div>
            <div class="label">Failures</div>
            <div class="metric">${summary.totals.failed}</div>
          </div>
        </div>
        <p>${this.escapeHtml(summary.stopReason ?? 'Execution completed without an ordered stop condition.')}</p>
      </section>

      <section class="table-card" style="margin-top: 20px;">
        <h2>Bucket Order</h2>
        <table>
          <thead>
            <tr>
              <th>Bucket</th>
              <th>Status</th>
              <th>Matched</th>
              <th>Result</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>${bucketRows}</tbody>
        </table>
      </section>

      <section class="cards">
        <article class="card">
          <h2>Failed Critical Scenarios</h2>
          <ul>${failedCritical}</ul>
        </article>
        <article class="card">
          <h2>Slowest Tests</h2>
          <ul>${slowTests}</ul>
        </article>
      </section>
    </main>
  </body>
</html>`;
  }

  /**
   * Writes the ordered execution summary to both JSON and HTML files in the specified report root directory. This method ensures that the summary data is saved in a structured format for potential further processing (JSON) and also provides a user-friendly visual representation of the execution results (HTML). It creates the necessary directories if they do not exist and handles the file writing operations, making it easy to access and share the execution summary after a test run.
   * @param reportRoot - The root directory where the summary files should be written, which is typically organized by test runs or buckets to keep reports structured and accessible.
   * @param summary - The OrderedRunSummary object containing all relevant data about the test execution, which will be serialized to JSON and used to generate the HTML content for the report.
   */
  public static writeOrderedSummary(reportRoot: string, summary: OrderedRunSummary): void {
    fs.mkdirSync(reportRoot, { recursive: true });

    const summaryJsonPath = path.join(reportRoot, PathConstants.ORDERED_SUMMARY_JSON_PATH);
    const summaryHtmlPath = path.join(reportRoot, PathConstants.ORDERED_SUMMARY_HTML_PATH);

    fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf8');
    fs.writeFileSync(summaryHtmlPath, this.buildHtml(summary), 'utf8');
  }
}
