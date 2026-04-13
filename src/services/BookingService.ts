import { ResponseValidator } from '@helper/assertions/api/ResponseValidator';
import { ApiClient } from '@core/ApiClient';
import {
  ActionSuccessSchema,
  BookingActionSuccess,
  BookingDetail,
  BookingDetailSchema,
  BookingResponse,
  BookingResponseSchema,
  BookingSummary,
  BookingSummarySchema,
  CreateBookingRequest,
  CreateBookingSchema,
} from '@contracts/BookingContract';

export class BookingService {
  constructor(private readonly api: ApiClient) {}

  async createBooking(payload: CreateBookingRequest): Promise<BookingResponse> {
    CreateBookingSchema.parse(payload);
    const response = await this.api.post('/booking', payload);
    await ResponseValidator.expectStatus(response, 201);
    return ResponseValidator.validateSchema(response, BookingResponseSchema, 'createBooking');
  }

  async getBookingById(bookingId: number): Promise<BookingDetail> {
    const response = await this.api.get(`/booking/${bookingId}`, { authenticated: true });
    await ResponseValidator.expectStatus(response, 200);
    return ResponseValidator.validateSchema(response, BookingDetailSchema, `getBookingById:${bookingId}`);
  }

  async getBookingSummary(roomId: number): Promise<BookingSummary> {
    const response = await this.api.get(`/booking/summary?roomid=${roomId}`, { authenticated: true });
    await ResponseValidator.expectStatus(response, 200);
    return ResponseValidator.validateSchema(response, BookingSummarySchema, `getBookingSummary:${roomId}`);
  }

  async deleteBooking(bookingId: number): Promise<BookingActionSuccess> {
    const response = await this.api.delete(`/booking/${bookingId}`, { authenticated: true });
    await ResponseValidator.expectStatus(response, 200);
    return ResponseValidator.validateSchema(response, ActionSuccessSchema, `deleteBooking:${bookingId}`);
  }
}
