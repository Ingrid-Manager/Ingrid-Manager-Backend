import { Resource } from '../../infrastructure/relational/persistence/entities/resource.entity';
import { ResourceNamesResponse } from '../dto/resource-names.dto';
import { ResourceResponseDto } from '../dto/resource-response.dto';

export class ResourceMapper {
  static toResponse(resource: Resource): ResourceResponseDto {
    return {
      id: resource.id,
      title: resource.title,
      color: resource.color,
      manager_email: resource.manager_email,
      inventoryid: resource.inventoryid,
    };
  }

  static toResponseList(resource: Resource[]): ResourceResponseDto[] {
    return resource.map(this.toResponse);
  }

  static toNameResponse(resource: Resource[]): ResourceNamesResponse[] {
    return resource.map(this.toResponse);
  }
}
