import { APIRequestContext, APIResponse } from '@playwright/test';
import { ConfigManager } from '@config/ConfigManager';
import { authManager } from '@core/AuthManager';
import { logger } from '@helper/logger/Logger';
import { metricsCollector } from '@observability/MetricsCollector';

export class ApiClient {
  private readonly maxRetries: number;

  constructor(private readonly request: APIRequestContext) {
    this.maxRetries = ConfigManager.getRetryCount();
  }

  private normalizeEndpoint(endpoint: string): string {
    if (/^https?:\/\//i.test(endpoint)) {
      return endpoint;
    }

    return endpoint.replace(/^\/+/, '');
  }

  private buildHeaders(custom?: Record<string, string>, authenticated = false): Record<string, string> {
    const authHeaders = authenticated ? authManager.getAuthHeaders() : {};

    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders,
      ...custom,
    };
  }

  private async executeWithRetry(
    fn: () => Promise<APIResponse>,
    method: string,
    endpoint: string
  ): Promise<APIResponse> {
    let lastResponse: APIResponse | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const start = Date.now();

      try {
        const response = await fn();
        const durationMs = Date.now() - start;
        const success = response.ok();

        metricsCollector.record({
          method,
          endpoint,
          statusCode: response.status(),
          durationMs,
          success,
          timestamp: new Date().toISOString(),
          retries: attempt,
        });

        logger.info(`${method} ${endpoint}`, {
          status: response.status(),
          durationMs,
          attempt: attempt || undefined,
        });

        if (ConfigManager.isDebug()) {
          const body = await response.text();
          logger.debug('Response body', { body: body.slice(0, 800) });
        }

        if (!success && response.status() >= 500 && attempt < this.maxRetries) {
          logger.warn(`Retrying ${method} ${endpoint}`, {
            status: response.status(),
            attempt: attempt + 1,
          });
          lastResponse = response;
          continue;
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        const durationMs = Date.now() - start;

        metricsCollector.record({
          method,
          endpoint,
          statusCode: 0,
          durationMs,
          success: false,
          timestamp: new Date().toISOString(),
          retries: attempt,
          errorMessage: lastError.message,
        });

        logger.error(`${method} ${endpoint} failed`, { error: lastError.message });

        if (attempt < this.maxRetries) {
          continue;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    return lastResponse!;
  }

  async get(
    endpoint: string,
    options?: { headers?: Record<string, string>; authenticated?: boolean }
  ): Promise<APIResponse> {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    return this.executeWithRetry(
      () =>
        this.request.get(normalizedEndpoint, {
          headers: this.buildHeaders(options?.headers, options?.authenticated),
          timeout: ConfigManager.getTimeout(),
        }),
      'GET',
      normalizedEndpoint
    );
  }

  async post(
    endpoint: string,
    body: unknown,
    options?: { headers?: Record<string, string>; authenticated?: boolean }
  ): Promise<APIResponse> {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    return this.executeWithRetry(
      () =>
        this.request.post(normalizedEndpoint, {
          headers: this.buildHeaders(options?.headers, options?.authenticated),
          data: body,
          timeout: ConfigManager.getTimeout(),
        }),
      'POST',
      normalizedEndpoint
    );
  }

  async put(
    endpoint: string,
    body: unknown,
    options?: { headers?: Record<string, string>; authenticated?: boolean }
  ): Promise<APIResponse> {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    return this.executeWithRetry(
      () =>
        this.request.put(normalizedEndpoint, {
          headers: this.buildHeaders(options?.headers, options?.authenticated),
          data: body,
          timeout: ConfigManager.getTimeout(),
        }),
      'PUT',
      normalizedEndpoint
    );
  }

  async patch(
    endpoint: string,
    body: unknown,
    options?: { headers?: Record<string, string>; authenticated?: boolean }
  ): Promise<APIResponse> {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    return this.executeWithRetry(
      () =>
        this.request.patch(normalizedEndpoint, {
          headers: this.buildHeaders(options?.headers, options?.authenticated),
          data: body,
          timeout: ConfigManager.getTimeout(),
        }),
      'PATCH',
      normalizedEndpoint
    );
  }

  async delete(
    endpoint: string,
    options?: { headers?: Record<string, string>; authenticated?: boolean }
  ): Promise<APIResponse> {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    return this.executeWithRetry(
      () =>
        this.request.delete(normalizedEndpoint, {
          headers: this.buildHeaders(options?.headers, options?.authenticated),
          timeout: ConfigManager.getTimeout(),
        }),
      'DELETE',
      normalizedEndpoint
    );
  }
}
