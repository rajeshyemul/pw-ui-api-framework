import * as fs   from 'fs';
import * as path from 'path';
import { logger } from '@helper/logger/Logger';

/**
 * MetricsCollector instruments every HTTP call made through the framework.
 *
 * Architectural note: observability is not a test-level concern, it belongs
 * in the infrastructure layer. By collecting metrics inside ApiClient, every
 * service and test automatically gains visibility without any additional code.
 *
 * Cross-process persistence:
 *   Playwright runs global setup/teardown in a separate Node.js process from
 *   the test workers, so the in-memory singleton cannot be read by teardown
 *   directly. Instead, workers call flush() after each test to append metrics
 *   to a shared NDJSON buffer file. Global teardown calls loadFromDisk() to
 *   reconstruct the full picture before printing the summary.
 *
 * Buffer file: reports/.metrics-buffer.ndjson
 *   - Created/cleared by global-setup
 *   - Appended to (one JSON line per metric) by each worker after every test
 *   - Read back by global-teardown for reporting
 */

/** Absolute path to the cross-process metrics buffer file. */
export const METRICS_BUFFER_PATH = path.resolve(
  __dirname, '..', '..', 'reports', '.metrics-buffer.ndjson'
);

export interface RequestMetric {
  method:          string;
  endpoint:        string;
  statusCode:      number;
  durationMs:      number;
  success:         boolean;
  timestamp:       string;
  retries:         number;
  schemaViolation?: boolean;   // set by ResponseValidator on Zod parse failures
  errorMessage?:   string;     // set by ApiClient on network/timeout errors
}

export interface EndpointSummary {
  endpoint:    string;
  totalCalls:  number;
  successRate: string;
  avgMs:       number;
  p95Ms:       number;
  minMs:       number;
  maxMs:       number;
  failCount:   number;
}

export class MetricsCollector {
  private metrics: RequestMetric[] = [];

  record(metric: RequestMetric): void {
    this.metrics.push(metric);
    logger.debug('Metric recorded', {
      method:     metric.method,
      endpoint:   metric.endpoint,
      status:     metric.statusCode,
      durationMs: metric.durationMs,
    });
  }

  getAll(): RequestMetric[] {
    return [...this.metrics];
  }

  getSummary(): EndpointSummary[] {
    const grouped = this.groupByEndpoint();

    return Object.entries(grouped).map(([endpoint, calls]) => {
      const durations = calls.map(c => c.durationMs).sort((a, b) => a - b);
      const failCount = calls.filter(c => !c.success).length;

      return {
        endpoint,
        totalCalls:  calls.length,
        successRate: `${(((calls.length - failCount) / calls.length) * 100).toFixed(1)}%`,
        avgMs:       Math.round(durations.reduce((s, d) => s + d, 0) / durations.length),
        p95Ms:       this.percentile(durations, 95),
        minMs:       durations[0],
        maxMs:       durations[durations.length - 1],
        failCount,
      };
    });
  }

  printSummary(): void {
    const summary = this.getSummary();

    if (summary.length === 0) {
      logger.info('No API calls recorded in this run.');
      return;
    }

    logger.info('─────────────────────────────────────────────────────────');
    logger.info('API Execution Metrics Summary');
    logger.info('─────────────────────────────────────────────────────────');

    summary.forEach(s => {
      logger.info(`${s.endpoint}`, {
        calls:       s.totalCalls,
        successRate: s.successRate,
        avgMs:       s.avgMs,
        p95Ms:       s.p95Ms,
        failures:    s.failCount,
      });
    });

    logger.info('─────────────────────────────────────────────────────────');
  }

  reset(): void {
    this.metrics = [];
  }

  /**
   * Appends all in-memory metrics to the shared NDJSON buffer file and clears
   * the in-memory list. Safe to call from multiple concurrent workers — each
   * line is a self-contained JSON object, and appendFileSync is atomic per line.
   *
   * Call this from the ApiFixture after each test's context is disposed.
   */
  flush(): void {
    if (this.metrics.length === 0) return;

    try {
      fs.mkdirSync(path.dirname(METRICS_BUFFER_PATH), { recursive: true });
      const lines = this.metrics.map(m => JSON.stringify(m)).join('\n') + '\n';
      fs.appendFileSync(METRICS_BUFFER_PATH, lines, 'utf8');
    } catch (err) {
      logger.warn('MetricsCollector.flush() failed — metrics will not appear in teardown report', { err });
    }

    this.metrics = [];
  }

  /**
   * Reads the NDJSON buffer file and loads all metrics into memory.
   * Call this from global-teardown before printing the summary.
   */
  static loadFromDisk(): MetricsCollector {
    const collector = new MetricsCollector();

    if (!fs.existsSync(METRICS_BUFFER_PATH)) return collector;

    try {
      const raw = fs.readFileSync(METRICS_BUFFER_PATH, 'utf8');
      const metrics = raw
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => JSON.parse(line) as RequestMetric);
      collector.metrics.push(...metrics);
    } catch (err) {
      logger.warn('MetricsCollector.loadFromDisk() failed — report may be incomplete', { err });
    }

    return collector;
  }

  /**
   * Deletes the buffer file. Call from global-setup to ensure a clean slate
   * at the start of every run.
   */
  static clearBuffer(): void {
    try {
      if (fs.existsSync(METRICS_BUFFER_PATH)) {
        fs.unlinkSync(METRICS_BUFFER_PATH);
      }
    } catch (err) {
      logger.warn('MetricsCollector.clearBuffer() failed', { err });
    }
  }

  private groupByEndpoint(): Record<string, RequestMetric[]> {
    return this.metrics.reduce<Record<string, RequestMetric[]>>((acc, m) => {
      const key = `${m.method} ${m.endpoint}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(m);
      return acc;
    }, {});
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }
}

// Singleton — shared across all workers in a test run
export const metricsCollector = new MetricsCollector();
