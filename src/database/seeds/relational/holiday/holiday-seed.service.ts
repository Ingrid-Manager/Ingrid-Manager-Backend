import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AvmLocation } from '../../../../avm-locations/infrastructure/relational/persistence/entities/avm-location.entity';
import { Category } from '../../../../categories/infrastructure/relational/persistence/entities/category.entity';
import { resolveHolidayIds } from '../../../../config/holiday-ids';
import { RoleEnum } from '../../../../roles/roles.enum';
import { Room } from '../../../../rooms/infrastructure/relational/persistence/entities/room.entity';
import { UserEntity } from '../../../../users/infrastructure/persistence/relational/entities/user.entity';

export const HOLIDAY_CATEGORY_TITLE = 'Ferien';
export const HOLIDAY_ROOM_TITLE = 'Ferien Dummy';
export const EXAMPLE_LOCATION_TITLE = 'Beispiel-Location';

/*
 * Legt die Stammdaten für den Ferienimport an (Kategorie und versteckter
 * Raum unter HOLIDAY_CATEGORY_ID bzw. HOLIDAY_ROOM_ID, Default 9999).
 * Gibt es noch keine Location, wird eine Beispiel-Location ohne
 * FRITZ!Box-Zugangsdaten angelegt, der der Ferienraum zugeordnet wird.
 * Idempotent: vorhandene Datensätze werden nicht verändert.
 */
@Injectable()
export class HolidaySeedService {
  private readonly logger = new Logger(HolidaySeedService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(AvmLocation)
    private readonly locationRepository: Repository<AvmLocation>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly configService: ConfigService,
  ) {}

  async run() {
    const holidayIds = resolveHolidayIds(this.configService);

    await this.ensureCategory(holidayIds.categoryId);
    const location = await this.ensureLocation();
    await this.ensureRoom(holidayIds.roomId, location);
  }

  private async ensureCategory(id: number): Promise<void> {
    const count = await this.categoryRepository.count({ where: { id } });

    if (!count) {
      await this.categoryRepository.save(
        this.categoryRepository.create({ id, title: HOLIDAY_CATEGORY_TITLE }),
      );
    }
  }

  private async ensureLocation(): Promise<AvmLocation> {
    const [existing] = await this.locationRepository.find({
      order: { id: 'ASC' },
      take: 1,
    });

    if (existing) {
      return existing;
    }

    // Ohne Benutzer und Passwort baut die Heizungssteuerung keine
    // Verbindung auf; die Zugangsdaten werden in der Verwaltung ergänzt.
    return this.locationRepository.save(
      this.locationRepository.create({
        title: EXAMPLE_LOCATION_TITLE,
        ahaurl: 'http://fritz.box',
        ahauser: '',
        ahapassword: '',
        ahasid: '',
      }),
    );
  }

  private async ensureRoom(id: number, location: AvmLocation): Promise<void> {
    const count = await this.roomRepository.count({
      where: { id },
      withDeleted: true,
    });

    if (count) {
      return;
    }

    const owner =
      (await this.userRepository.findOne({
        where: { role: { id: RoleEnum.admin } },
        order: { id: 'ASC' },
      })) ??
      (await this.userRepository.findOne({
        where: {},
        order: { id: 'ASC' },
      }));

    if (!owner) {
      this.logger.warn(
        `Raum "${HOLIDAY_ROOM_TITLE}" (ID ${id}) nicht angelegt: kein Benutzer vorhanden`,
      );
      return;
    }

    await this.roomRepository.save(
      this.roomRepository.create({
        id,
        title: HOLIDAY_ROOM_TITLE,
        avm_id: null,
        comfort_temp: 20,
        empty_temp: 16,
        prelim_time: 0,
        heated: false,
        color: '#999999',
        hidden: true,
        locationid: location.id,
        createdbyid: owner.id,
      }),
    );
  }
}
