import { logger } from '@helper/logger/Logger';
import { metricsCollector, RequestMetric } from './MetricsCollector';

/**
 * FailureAnalyzer categorizes API failures and surfaces actionable diagnostics.
 *
 * Architectural note: knowing *that* a test failed is not enough at scale.
 * Teams need to know *why* — network fault, schema drift, auth expiry, or
 * server error. This layer translates raw failure signals into diagnostic
 * categories, making triage faster and CI noise easier to filter.
 */

export type FailureCategory =
  | 'AUTH_FAILURE'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'SCHEMA_VIOLATION'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface FailureDiagnostic {
  endpoint:   string;
  method:     string;
  category:   FailureCategory;
  statusCode: number;
  suggestion: string;
  count:      number;
}

export class FailureAnalyzer {
  /**
   * Analyze all recorded metrics and return a list of failure diagnostics.
   * Call this after a test suite completes to get a structured failure report.
   */
  static analyze(collector = metricsCollector): FailureDiagnostic[] {
    const failures = collector.getAll().filter(m => !m.success);

    if (failures.length === 0) return [];

    // Group identical failures so we report count rather than noise
    const grouped = this.groupFailures(failures);
    const diagnostics: FailureDiagnostic[] = [];

    for (const [, metrics] of Object.entries(grouped)) {
      const sample = metrics[0];
      const category = this.categorize(sample);
      diagnostics.push({
        endpoint:   sample.endpoint,
        method:     sample.method,
        category,
        statusCode: sample.statusCode,
        suggestion: this.suggest(category, sample),
        count:      metrics.length,
      });
    }

    return diagnostics.sort((a, b) => b.count - a.count);
  }

  static printReport(collector = metricsCollector): void {
    const diagnostics = this.analyze(collector);

    if (diagnostics.length === 0) {
      logger.info('FailureAnalyzer: No failures detected.');
      return;
    }

    logger.warn('─────────────────────────────────────────────────────────');
    logger.warn(`FailureAnalyzer: ${diagnostics.length} failure pattern(s) detected`);
    logger.warn('─────────────────────────────────────────────────────────');

    diagnostics.forEach(d => {
      logger.warn(`[${d.category}] ${d.method} ${d.endpoint} (×${d.count})`, {
        statusCode: d.statusCode,
        suggestion: d.suggestion,
      });
    });

    logger.warn('─────────────────────────────────────────────────────────');
  }

  private static categorize(metric: RequestMetric): FailureCategory {
    // Schema violations are flagged explicitly by ResponseValidator — check
    // this first so they don't fall through to a status-code category.
    if (metric.schemaViolation)                    return 'SCHEMA_VIOLATION';

    const { statusCode } = metric;

    if (statusCode === 401 || statusCode === 403)  return 'AUTH_FAILURE';
    if (statusCode === 404)                        return 'NOT_FOUND';
    if (statusCode >= 500)                         return 'SERVER_ERROR';
    if (statusCode >= 400)                         return 'CLIENT_ERROR';

    // statusCode === 0 means the request never got a response.
    // Distinguish timeouts from other network failures via the error message
    // stored on the metric (Playwright timeout errors contain "timeout").
    if (statusCode === 0) {
      const msg = (metric as RequestMetric & { errorMessage?: string }).errorMessage ?? '';
      if (msg.toLowerCase().includes('timeout'))   return 'TIMEOUT';
      return 'NETWORK_ERROR';
    }

    return 'UNKNOWN';
  }

  private static suggest(category: FailureCategory, metric: RequestMetric): string {
    const suggestions: Record<FailureCategory, string> = {
      AUTH_FAILURE:     'Check token expiry or credential rotation. Verify AuthManager.login() was called before this request.',
      NOT_FOUND:        `Verify resource ID/path is valid. Endpoint: ${metric.endpoint}`,
      SERVER_ERROR:     'Server-side fault. Check application logs. May be transient — consider retry.',
      CLIENT_ERROR:     'Inspect request payload and required headers. Validate against the API contract.',
      SCHEMA_VIOLATION: 'Response shape does not match the Zod schema. Check for a recent API change.',
      TIMEOUT:          `Request exceeded timeout. Consider increasing API_TIMEOUT (currently ${process.env.API_TIMEOUT || 30000}ms).`,
      NETWORK_ERROR:    'Could not reach the server. Check baseURL, network connectivity, and firewall rules.',
      UNKNOWN:          'Unclassified failure. Enable DEBUG=true for full response body.',
    };
    return suggestions[category];
  }

  private static groupFailures(
    failures: RequestMetric[]
  ): Record<string, RequestMetric[]> {
    return failures.reduce<Record<string, RequestMetric[]>>((acc, m) => {
      const key = `${m.method}:${m.endpoint}:${m.statusCode}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(m);
      return acc;
    }, {});
  }
}
