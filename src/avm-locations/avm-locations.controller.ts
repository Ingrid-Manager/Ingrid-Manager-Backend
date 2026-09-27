import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { AvmLocationsService } from './avm-locations.service';
import { CreateAvmLocationDto } from './infrastructure/application/dto/create-avm-location.dto';
import { UpdateAvmLocationDto } from './infrastructure/application/dto/update-avm-location.dto';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin, RoleEnum.verwaltung)
@Controller({
  path: 'avm-locations',
  version: '1',
})
export class AvmLocationsController {
  constructor(private readonly service: AvmLocationsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(
    @Body(new ValidationPipe())
    dto: CreateAvmLocationDto,
  ) {
    return this.service.create(dto);
  }

  @Patch()
  update(
    @Body(new ValidationPipe())
    dto: UpdateAvmLocationDto,
  ) {
    return this.service.update(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
