import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AvmLocation } from './infrastructure/relational/persistence/entities/avm-location.entity';
import { Repository } from 'typeorm';
import { CreateAvmLocationDto } from './infrastructure/application/dto/create-avm-location.dto';
import { AvmLoactionMapper } from './infrastructure/application/mapper/avm-location.mapper';
import { UpdateAvmLocationDto } from './infrastructure/application/dto/update-avm-location.dto';
import { AvmConnection } from './avm-connection.type';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class AvmLocationsService {
  private readonly logger = new Logger(AvmLocationsService.name);

  constructor(
    @InjectRepository(AvmLocation)
    private repo: Repository<AvmLocation>,
    private readonly cryptoService: CryptoService,
  ) {}

  async create(dto: CreateAvmLocationDto) {
    const entity = this.repo.create({
      title: dto.title,
      ahaurl: dto.ahaurl,
      ahauser: dto.ahauser,
      ahapassword: dto.ahapassword
        ? this.cryptoService.encrypt(dto.ahapassword)
        : undefined,
      ahasid: dto.ahasid,
    });

    const saved = await this.repo.save(entity);

    return AvmLoactionMapper.toResponse(saved);
  }

  async findAll() {
    const entities = await this.repo.find({
      order: {
        title: 'ASC',
      },
    });

    return AvmLoactionMapper.toResponses(entities);
  }

  async update(dto: UpdateAvmLocationDto) {
    const entity = await this.repo.findOne({
      where: {
        id: dto.id,
      },
    });

    if (!entity) {
      throw new NotFoundException('AVM Location not found');
    }

    if (dto.title !== undefined) {
      entity.title = dto.title;
    }

    if (dto.ahaurl !== undefined) {
      entity.ahaurl = dto.ahaurl;
    }

    if (dto.ahauser !== undefined) {
      entity.ahauser = dto.ahauser;
    }

    if (dto.ahapassword) {
      entity.ahapassword = this.cryptoService.encrypt(dto.ahapassword);
    }

    if (dto.ahasid !== undefined) {
      entity.ahasid = dto.ahasid;
    }

    const saved = await this.repo.save(entity);
    return AvmLoactionMapper.toResponse(saved);
  }

  /*
   * Liefert die (entschlüsselten) Zugangsdaten der FRITZ!Box einer
   * Location.
   *
   * @throws NotFoundException wenn die Location nicht existiert
   * @throws UnprocessableEntityException wenn URL, Benutzer oder Passwort
   *         der Location nicht hinterlegt sind
   */
  async getConnection(id: number): Promise<AvmConnection> {
    const entity = await this.repo.findOne({
      where: {
        id,
      },
    });

    if (!entity) {
      throw new NotFoundException(`AVM Location ${id} not found`);
    }

    if (!entity.ahaurl || !entity.ahauser || !entity.ahapassword) {
      throw new UnprocessableEntityException(
        `AVM Location ${id} has no complete FRITZ!Box configuration`,
      );
    }

    const { value: password, needsReEncryption } =
      this.cryptoService.decryptWithMetadata(entity.ahapassword);

    if (needsReEncryption) {
      await this.reEncryptPassword(entity, password);
    }

    return {
      locationId: entity.id,
      title: entity.title || `AVM Location ${entity.id}`,
      url: entity.ahaurl,
      username: entity.ahauser,
      password,
    };
  }

  /*
   * Überführt ein Passwort im alten Format (bzw. mit dem vorherigen
   * Schlüssel verschlüsselt) in das aktuelle Format. Ein Fehler dabei
   * verhindert die Verbindung nicht; es wird beim nächsten Zugriff erneut
   * versucht.
   */
  private async reEncryptPassword(
    entity: AvmLocation,
    password: string,
  ): Promise<void> {
    try {
      await this.repo.update(
        { id: entity.id },
        { ahapassword: this.cryptoService.encrypt(password) },
      );
    } catch (error) {
      this.logger.warn(
        `Passwort der AVM Location ${entity.id} konnte nicht neu verschlüsselt werden: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
