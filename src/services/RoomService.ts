import { ResponseValidator } from '@helper/assertions/api/ResponseValidator';
import { ApiClient } from '@core/ApiClient';
import {
  ActionSuccessResponse,
  ActionSuccessSchema,
  CreateRoomRequest,
  CreateRoomSchema,
  Room,
  RoomSchema,
  RoomsList,
  RoomsListSchema,
} from '@contracts/RoomContract';

export class RoomService {
  constructor(private readonly api: ApiClient) {}

  async getRooms(): Promise<RoomsList> {
    const response = await this.api.get('/room');
    await ResponseValidator.expectStatus(response, 200);
    return ResponseValidator.validateSchema(response, RoomsListSchema, 'getRooms');
  }

  async getRoomById(roomId: number): Promise<Room> {
    const response = await this.api.get(`/room/${roomId}`);
    await ResponseValidator.expectStatus(response, 200);
    return ResponseValidator.validateSchema(response, RoomSchema, `getRoomById:${roomId}`);
  }

  async createRoom(payload: CreateRoomRequest): Promise<ActionSuccessResponse> {
    CreateRoomSchema.parse(payload);
    const response = await this.api.post('/room', payload, { authenticated: true });
    await ResponseValidator.expectStatus(response, 200);
    return ResponseValidator.validateSchema(response, ActionSuccessSchema, 'createRoom');
  }

  async deleteRoom(roomId: number): Promise<ActionSuccessResponse> {
    const response = await this.api.delete(`/room/${roomId}`, { authenticated: true });
    await ResponseValidator.expectStatus(response, 200);
    return ResponseValidator.validateSchema(response, ActionSuccessSchema, 'deleteRoom');
  }
}
