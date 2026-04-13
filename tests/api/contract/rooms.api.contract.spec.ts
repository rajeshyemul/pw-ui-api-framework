import { AllureReporter } from '@helper/reporting/AllureReporter';
import { apiTest as test } from '@fixtures/ApiFixture';
import { ResponseValidator } from '@helper/assertions/api/ResponseValidator';
import { RoomSchema, RoomsListSchema } from '@contracts/RoomContract';

test.describe('@contract - Restful Booker Platform Room API contracts', () => {
  test(
    'TC-API-CON-002: GET /room matches RoomsListSchema',
    { tag: ['@contract', '@api', '@P1'] },
    async ({ apiClient, assertUtils }) => {
      await AllureReporter.attachDetails({
        epic: 'Unified Framework',
        feature: 'API Contract',
        story: 'Public room list responses honour the catalog contract',
        severity: 'critical',
        tags: ['api', 'contract', 'rooms'],
      });

      const response = await apiClient.get('/room');

      await ResponseValidator.expectStatus(response, 200);
      const payload = await ResponseValidator.validateSchema(
        response,
        RoomsListSchema,
        'contract:GET /room'
      );

      await assertUtils.assertGreaterThan(
        payload.rooms.length,
        0,
        'Validated room catalog should include at least one room'
      );
    }
  );

  test(
    'TC-API-CON-003: GET /room/:id matches RoomSchema',
    { tag: ['@contract', '@api', '@P1'] },
    async ({ apiClient }) => {
      const response = await apiClient.get('/room/1');

      await ResponseValidator.expectStatus(response, 200);
      await ResponseValidator.expectSchemaMatch(response, RoomSchema, 'contract:GET /room/:id');
    }
  );
});
