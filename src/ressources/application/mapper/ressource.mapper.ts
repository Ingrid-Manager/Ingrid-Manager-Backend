import { Ressource } from '../../infrastructure/relational/persistence/entities/ressource.entity';
import { RessourceNamesResponse } from '../dto/ressource-names.dto';
import { RessourceResponseDto } from '../dto/ressource-response.dto';

export class RessourceMapper {
  static toResponse(ressource: Ressource): RessourceResponseDto {
    return {
      id: ressource.id,
      title: ressource.title,
      color: ressource.color,
      manager_email: ressource.manager_email,
      inventoryid: ressource.inventoryid,
    };
  }

  static toResponseList(ressource: Ressource[]): RessourceResponseDto[] {
    return ressource.map(this.toResponse);
  }

  static toNameResponse(ressource: Ressource[]): RessourceNamesResponse[] {
    return ressource.map(this.toResponse);
  }
}
