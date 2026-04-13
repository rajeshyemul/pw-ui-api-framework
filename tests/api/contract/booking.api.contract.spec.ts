import { AllureReporter } from '@helper/reporting/AllureReporter';
import { apiTest as test } from '@fixtures/ApiFixture';
import { ResponseValidator } from '@helper/assertions/api/ResponseValidator';
import { BookingResponseSchema, BookingSummarySchema } from '@contracts/BookingContract';
import { BookingFactory } from '@test-data/BookingFactory';

test.describe('@contract - Restful Booker Platform Booking API contracts', () => {
  test(
    'TC-API-CON-004: POST /booking matches BookingResponseSchema',
    { tag: ['@contract', '@api', '@P1'] },
    async ({ apiClient, registry, assertUtils }) => {
      await AllureReporter.attachDetails({
        epic: 'Unified Framework',
        feature: 'API Contract',
        story: 'Booking creation responses honour the booking contract',
        severity: 'critical',
        tags: ['api', 'contract', 'booking'],
      });

      const payload = BookingFactory.create();
      const response = await apiClient.post('/booking', payload);

      await ResponseValidator.expectStatus(response, 201);
      const booking = await ResponseValidator.validateSchema(
        response,
        BookingResponseSchema,
        'contract:POST /booking'
      );

      registry.track('booking', booking.bookingid);
      await assertUtils.assertEquals(
        booking.roomid,
        payload.roomid,
        'Validated booking room id should match the request payload'
      );
    }
  );

  test(
    'TC-API-CON-005: GET /booking/summary matches BookingSummarySchema',
    { tag: ['@contract', '@api', '@P1'] },
    async ({ apiClient, authService }) => {
      await authService.login();

      const response = await apiClient.get('/booking/summary?roomid=1', { authenticated: true });

      await ResponseValidator.expectStatus(response, 200);
      await ResponseValidator.expectSchemaMatch(
        response,
        BookingSummarySchema,
        'contract:GET /booking/summary'
      );
    }
  );
});
