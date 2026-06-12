import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SeriesEvent } from '../../series-events/infrastructure/relational/persistence/entities/series-event.entity';
import { DataSource, Repository } from 'typeorm';
import { SeriesGeneratorService } from '../../series-events/services/series-generator.service';

@Injectable()
export class SeriesReorganizationService {
  private readonly logger = new Logger(SeriesReorganizationService.name);

  constructor(
    @InjectRepository(SeriesEvent)
    private readonly seriesRepository: Repository<SeriesEvent>,

    private readonly seriesGenerator: SeriesGeneratorService,

    private readonly dataSource: DataSource,
  ) {}

  async run(): Promise<void> {
    const activeSeries = await this.seriesRepository.find({
      where: {
        active: true,
      },
    });

    const targetDate = new Date();

    targetDate.setHours(0, 0, 0, 0);
    targetDate.setFullYear(targetDate.getFullYear() + 2);

    for (const series of activeSeries) {
      await this.reorganizeSeries(series, targetDate);
    }
  }

  private async reorganizeSeries(
    series: SeriesEvent,
    targetDate: Date,
  ): Promise<void> {
    let changed = false;
    await this.dataSource.transaction(async (manager) => {
      if (series.seriesEnd < new Date()) {
        return;
      }

      if (
        series.lastGeneratedUntil &&
        series.lastGeneratedUntil >= targetDate
      ) {
        return;
      }

      const generateFrom = new Date(
        series.lastGeneratedUntil ?? series.seriesStart,
      );

      generateFrom.setDate(generateFrom.getDate() + 1);

      await this.seriesGenerator.generateRange(
        manager,
        series,
        generateFrom,
        targetDate,
      );

      const generatedUntil =
        series.seriesEnd < targetDate ? series.seriesEnd : targetDate;

      series.lastGeneratedUntil = generatedUntil;

      series.lastReorganizationAt = new Date();

      await manager.save(series);
      changed = true;
    });

    if (changed) {
      this.logger.log(`Series ${series.id} reorganized`);
    }
  }
}
