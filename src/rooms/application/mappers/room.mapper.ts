import { Room } from '../../infrastructure/relational/persistence/entities/room.entity';
import { RoomNamesResponseDto } from '../dto/room-names.dto';
import { RoomResponseDto } from '../dto/room-response.dto';

export class RoomMapper {
  static toResponse(room: Room): RoomResponseDto {
    return {
      id: room.id,
      title: room.title,
      avm_id: room.avm_id,
      comfort_temp: room.comfort_temp,
      empty_temp: room.empty_temp,
      prelim_time: room.prelim_time,
      heated: room.heated,
      color: room.color,
      hidden: room.hidden,
      locationid: room.locationid,

      location: room.location
        ? {
            id: room.location.id,
          }
        : undefined,
    };
  }

  static toResponseList(rooms: Room[]): RoomResponseDto[] {
    return rooms.map(this.toResponse);
  }

  static toNameResponse(rooms: Room[]): RoomNamesResponseDto[] {
    return rooms.map(this.toResponse);
  }
}
