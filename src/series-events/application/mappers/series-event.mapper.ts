import { SeriesEvent } from '../../infrastructure/relational/persistence/entities/series-event.entity';
import { SeriesEventResponseDto } from '../dto/series-event-response.dto';

export class SeriesEventMapper {
  static toResponse(entity: SeriesEvent): SeriesEventResponseDto {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description,
      roomid: entity.roomid,
      categoryid: entity.categoryid,
      startTime: entity.startTime,
      endTime: entity.endTime,
      seriesStart: entity.seriesStart,
      seriesEnd: entity.seriesEnd,
      weekdays: entity.weekdays,
      runDuringSchoolHolidays: entity.runDuringSchoolHolidays,
      active: entity.active,
      lastGeneratedUntil: entity.lastGeneratedUntil,
      lastReorganizationAt: entity.lastReorganizationAt,
    };
  }
}
