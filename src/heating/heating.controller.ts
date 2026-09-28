import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { HeatingService } from './heating.service';
import { ConnectHeatingDto } from './dto/connect-heating.dto';
import { SetTemperatureDto } from './dto/set-temperature.dto';

/*
 * Diagnose- und Steuerungsendpunkte für FRITZ!Box-Thermostate.
 *
 * Nur für Administration/Verwaltung: die Endpunkte setzen Temperaturen und
 * lassen das Backend über POST /heating/connect Verbindungen zu beliebigen
 * URLs aufbauen (sonst SSRF-Vektor für nicht angemeldete Aufrufer).
 *
 * Wie alle anderen Controller unter /api/v1/heating erreichbar. Die frühere,
 * unversionierte Route /api/heating bleibt übergangsweise (VERSION_NEUTRAL)
 * erhalten, damit bestehende Aufrufer nicht brechen.
 */
@ApiTags('Heating')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin, RoleEnum.verwaltung)
@Controller({ path: 'heating', version: ['1', VERSION_NEUTRAL] })
export class HeatingController {
  constructor(private readonly heatingService: HeatingService) {}

  @Post('connect')
  @ApiOperation({
    summary: 'Verbindung zur FRITZ!Box herstellen',
  })
  @ApiBody({
    type: ConnectHeatingDto,
  })
  @ApiResponse({
    status: 201,
    description: 'FRITZ!Box erfolgreich verbunden',
  })
  async connect(@Body() dto: ConnectHeatingDto) {
    return this.heatingService.connect(dto);
  }

  @Get('connection')
  @ApiOperation({
    summary: 'Verbindung zur FRITZ!Box testen',
  })
  @ApiResponse({
    status: 200,
    description: 'Aktuellen Verbindungsstatus zurückgeben',
  })
  connection() {
    return this.heatingService.testConnection();
  }

  @Get('devices')
  @ApiOperation({
    summary: 'Alle Geräte der FRITZ!Box abrufen',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste aller AHA-Geräte',
  })
  async devices() {
    return this.heatingService.getDevices();
  }

  @Post('disconnect')
  @ApiOperation({
    summary: 'Verbindung zur FRITZ!Box trennen',
  })
  async disconnect() {
    return this.heatingService.disconnect();
  }

  @Get('devices/:ain')
  getDevice(@Param('ain') ain: string) {
    return this.heatingService.getDevice(ain);
  }

  @Get('thermostats')
  getThermostats() {
    return this.heatingService.getThermostats();
  }

  @Get('groups/:ain/isGroup')
  isGroup(@Param('ain') ain: string) {
    return this.heatingService.isGroup(ain);
  }

  @Get('groups')
  @ApiOperation({
    summary: 'Alle Gruppen der FRITZ!Box abrufen',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste aller AHA-Gruppen',
  })
  groups() {
    return this.heatingService.getGroups();
  }

  @Post('thermostats/:ain/temperature')
  @ApiOperation({
    summary: 'Zieltemperatur eines Thermostats oder einer Gruppe setzen',
  })
  @ApiParam({
    name: 'ain',
    description: 'AIN des Thermostats oder der Gruppe',
    example: '09995 0179707',
  })
  @ApiBody({
    type: SetTemperatureDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Zieltemperatur wurde gesetzt',
  })
  async setTemperature(
    @Param('ain') ain: string,
    @Body() dto: SetTemperatureDto,
  ) {
    return this.heatingService.setTemperature(ain, dto.temperature);
  }

  @Get('devices/:ain/temperature')
  @ApiOperation({
    summary: 'Aktuelle Temperatur eines Thermostats oder einer Gruppe abrufen',
  })
  @ApiParam({
    name: 'ain',
    description: 'AIN des Thermostats oder der Gruppe',
    example: '09995 0179707',
  })
  @ApiResponse({
    status: 200,
    description: 'Aktuelle Temperatur und Zieltemperatur',
  })
  getTemperature(@Param('ain') ain: string) {
    return this.heatingService.getTemperature(ain);
  }
}
