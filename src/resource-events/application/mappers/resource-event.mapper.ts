import { ResourceEvent } from '../../infrastructure/relational/persistence/entities/resource-event.entity';
import { ResourceEventResponseDto } from '../dto/resource-event-response.dto';

export class ResourceEventMapper {
  static toResponse(entity: ResourceEvent): ResourceEventResponseDto {
    return {
      id: entity.id,
      title: entity.title,
      start: entity.start,
      end: entity.end,
      color: entity.resource.color,
      resource_id: entity.resource.id,
      resource_title: entity.resource.title,
      user_id: entity.user.id,
      user_name: entity.user.firstName + ' ' + entity.user.lastName,
    };
  }
}
