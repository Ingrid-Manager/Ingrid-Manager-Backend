import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SeriesEvent } from './infrastructure/relational/persistence/entities/series-event.entity';

import { CreateSeriesEventDto } from './application/dto/create-series-event.dto';

import { SeriesGeneratorService } from './services/series-generator.service';
import { UpdateSeriesFromDateDto } from './application/dto/update-series-from-date.dto';
import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { SeriesEventMapper } from './application/mappers/series-event.mapper';
import { UpdateSeriesEventDto } from './application/dto/update-series-event.dto';

@Injectable()
export class SeriesEventsService {
  constructor(
    @InjectRepository(SeriesEvent)
    private readonly repo: Repository<SeriesEvent>,

    private readonly generator: SeriesGeneratorService,
    @InjectRepository(CalendarEvent)
    private readonly calendarRepo: Repository<CalendarEvent>,
  ) {}

  async create(dto: CreateSeriesEventDto, user: any) {
    const series = this.repo.create({
      ...dto,

      startTime: dto.startTime,
      endTime: dto.endTime,

      seriesStart: new Date(dto.seriesStart),
      seriesEnd: new Date(dto.seriesEnd),

      createdbyid: user.id,

      active: true,
    });

    const twoYearsAhead = new Date();

    twoYearsAhead.setFullYear(twoYearsAhead.getFullYear() + 2);

    const saved = await this.repo.manager.transaction(async (manager) => {
      const saved = await manager.save(series);

      await this.generator.generateRange(
        manager,
        saved,
        saved.seriesStart,
        twoYearsAhead,
      );

      saved.lastGeneratedUntil =
        saved.seriesEnd < twoYearsAhead ? saved.seriesEnd : twoYearsAhead;

      return manager.save(saved);
    });

    return saved;
  }

  async updateFromDate(dto: UpdateSeriesFromDateDto, user: any) {
    const series = await this.repo.findOne({
      where: {
        id: dto.id,
      },
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    const splitDate = new Date(dto.splitDate);

    await this.splitSeries(series, splitDate, dto, user);

    return {
      success: true,
    };
  }

  private async splitSeries(
    series: SeriesEvent,
    splitDate: Date,
    dto: UpdateSeriesFromDateDto,
    user: any,
  ) {
    const oldSeriesEnd = series.seriesEnd;

    const dayBeforeSplit = new Date(splitDate);
    dayBeforeSplit.setDate(dayBeforeSplit.getDate() - 1);

    const newSeries = this.repo.create({
      title: dto.title ?? series.title,
      description: dto.description ?? series.description,
      roomid: dto.roomid ?? series.roomid,
      categoryid: dto.categoryid ?? series.categoryid,
      startTime: dto.startTime ?? series.startTime,
      endTime: dto.endTime ?? series.endTime,
      weekdays: dto.weekdays ?? series.weekdays,
      runDuringSchoolHolidays:
        dto.runDuringSchoolHolidays ?? series.runDuringSchoolHolidays,
      createdbyid: user.id,
      active: true,
      seriesStart: splitDate,
      seriesEnd: dto.seriesEnd ? new Date(dto.seriesEnd) : oldSeriesEnd,
    });

    const generateUntil = new Date(splitDate);
    generateUntil.setFullYear(generateUntil.getFullYear() + 2);

    await this.repo.manager.transaction(async (manager) => {
      /*
       * Alte Serie beenden
       */
      series.seriesEnd = dayBeforeSplit;
      await manager.save(series);

      /*
       * Zukünftige nicht bearbeitete Termine löschen
       */
      await manager
        .createQueryBuilder()
        .softDelete()
        .from(CalendarEvent)
        .where('seriesid = :seriesid', {
          seriesid: series.id,
        })
        .andWhere('start >= :splitDate', {
          splitDate,
        })
        .andWhere('isModified = false')
        .execute();

      /*
       * Neue Serie anlegen
       */
      const saved = await manager.save(newSeries);

      /*
       * Termine für neue Serie generieren
       */
      await this.generator.generateRange(
        manager,
        saved,
        splitDate,
        generateUntil,
      );

      /*
       * Generierungsstatus aktualisieren
       */
      saved.lastGeneratedUntil =
        saved.seriesEnd < generateUntil ? saved.seriesEnd : generateUntil;

      await manager.save(saved);
    });
  }

  async findAll() {
    const entities = await this.repo.find({
      order: {
        startTime: 'ASC',
      },
    });

    return entities.map(SeriesEventMapper.toResponse);
  }

  async findOne(id: number) {
    const entity = await this.repo.findOne({
      where: {
        id,
      },
    });

    if (!entity) {
      throw new NotFoundException('Series not found');
    }

    return SeriesEventMapper.toResponse(entity);
  }

  async update(dto: UpdateSeriesEventDto) {
    const entity = await this.repo.findOne({
      where: {
        id: dto.id,
      },
    });

    if (!entity) {
      throw new NotFoundException('Series not found');
    }

    Object.assign(entity, dto);

    return this.repo.save(entity);
  }

  async deactivate(id: number) {
    const entity = await this.repo.findOne({
      where: { id },
    });

    if (!entity) {
      throw new NotFoundException();
    }

    entity.active = false;

    return this.repo.save(entity);
  }

  async delete(id: number) {
    const series = await this.repo.findOne({
      where: { id },
    });

    if (!series) {
      throw new NotFoundException('Serie kann nicht gefunden werden!');
    }

    await this.calendarRepo
      .createQueryBuilder()
      .delete()
      .from(CalendarEvent)
      .where('seriesid = :id', { id })
      .execute();

    await this.repo.delete(id);

    return { success: true };
  }
}
