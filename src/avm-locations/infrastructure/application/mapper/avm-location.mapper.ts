import { AvmLocation } from '../../relational/persistence/entities/avm-location.entity';
import { AvmLocationResponseDto } from '../dto/avm-location-response.dto';

export class AvmLoactionMapper {
  static toResponse(entity: AvmLocation): AvmLocationResponseDto {
    return {
      id: entity.id,
      title: entity.title,
      ahaurl: entity.ahaurl,
      ahauser: entity.ahauser,
    };
  }

  static toResponses(entities: AvmLocation[]): AvmLocationResponseDto[] {
    return entities.map(this.toResponse);
  }
}
