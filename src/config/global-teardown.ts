import { FailureAnalyzer } from '@observability/FailureAnalyzer';
import { MetricsCollector } from '@observability/MetricsCollector';
import { logger } from '@helper/logger/Logger';

export default async function globalTeardown(): Promise<void> {
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('Global Teardown - unified framework run complete');
  logger.info('═══════════════════════════════════════════════════════════');

  const collector = MetricsCollector.loadFromDisk();
  collector.printSummary();
  FailureAnalyzer.printReport(collector);

  logger.info('═══════════════════════════════════════════════════════════');
}
