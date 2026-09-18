import { Injectable } from '@nestjs/common';

import {
  HolidayReorganizationService,
  ReorganizationActingUser,
} from './services/holiday-reorganization.service';
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

  async runNow(user?: ReorganizationActingUser | null) {
    await this.holidayReorganizationService.run(user);
    await this.seriesReorganizationService.run();

    return { success: true };
  }

  async listHolidays() {
    return this.holidayReorganizationService.list();
  }
}
