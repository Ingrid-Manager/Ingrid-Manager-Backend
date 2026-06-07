import { Controller, Post } from '@nestjs/common';
import { ReorganizationService } from './reorganization.service';

@Controller({
  path: 'reorganization',
  version: '1',
})
export class ReorganizationController {
  constructor(private readonly service: ReorganizationService) {}

  @Post('run')
  run() {
    return this.service.runNow();
  }
}
