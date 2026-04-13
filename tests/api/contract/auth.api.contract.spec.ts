import { AllureReporter } from '@helper/reporting/AllureReporter';
import { apiTest as test } from '@fixtures/ApiFixture';
import { ResponseValidator } from '@helper/assertions/api/ResponseValidator';
import { LoginResponseSchema } from '@contracts/AuthContract';
import { AuthFactory } from '@test-data/AuthFactory';

test.describe('@contract - Restful Booker Platform Auth API contracts', () => {
  test(
    'TC-API-CON-001: POST /auth/login matches LoginResponseSchema',
    { tag: ['@contract', '@api', '@P1'] },
    async ({ apiClient, assertUtils }) => {
      await AllureReporter.attachDetails({
        epic: 'Unified Framework',
        feature: 'API Contract',
        story: 'Authentication responses honour the login contract',
        severity: 'critical',
        tags: ['api', 'contract', 'auth'],
      });

      const response = await apiClient.post('/auth/login', AuthFactory.validCredentials());

      await ResponseValidator.expectStatus(response, 200);
      const payload = await ResponseValidator.validateSchema(
        response,
        LoginResponseSchema,
        'contract:POST /auth/login'
      );

      await assertUtils.assertGreaterThan(
        payload.token.length,
        5,
        'Validated login token length should be greater than five characters'
      );
    }
  );
});
