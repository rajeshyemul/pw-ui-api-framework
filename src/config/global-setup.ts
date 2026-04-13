import { MetricsCollector, metricsCollector } from '@observability/MetricsCollector';
import { logger } from '@helper/logger/Logger';

export default async function globalSetup(): Promise<void> {
  MetricsCollector.clearBuffer();
  metricsCollector.reset();
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('Global Setup - unified framework run started');
  logger.info('MetricsCollector buffer cleared - ready to record API calls');
  logger.info('═══════════════════════════════════════════════════════════');
}
