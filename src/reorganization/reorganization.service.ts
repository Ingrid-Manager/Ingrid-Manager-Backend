import { Injectable } from '@nestjs/common';

import { HolidayReorganizationService } from './services/holiday-reorganization.service';
import { SeriesReorganizationService } from './services/series-reorganization.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class ReorganizationService {
  constructor(
    private readonly holidayReorganizationService: HolidayReorganizationService,
    private readonly seriesReorganizationService: SeriesReorganizationService,
  ) {}

  @Cron('0 3 1 * *')
  async runMonthlyReorganization() {
    await this.holidayReorganizationService.run();
    await this.seriesReorganizationService.run();
  }

  async runNow() {
    await this.holidayReorganizationService.run();
    await this.seriesReorganizationService.run();

    return { success: true };
  }
}
