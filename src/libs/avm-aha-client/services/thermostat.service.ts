import { HttpService } from './http.service';
import { Injectable } from '@nestjs/common';
import { AvmConnection } from '../interfaces/avm-connection.interface';
import { TemperatureUtil } from '../utils/temperature.util';
import { ThermostatDto } from '../dto/thermostat.dto';
import { ThermostatMapper } from '../mappers/thermostat.mapper';
import { XmlParser } from '../parsers/xml.parser';

@Injectable()
export class ThermostatService {
  constructor(private readonly httpService: HttpService) {}

  async setTargetTemperature(
    connection: AvmConnection,
    ain: string,
    temperature: number,
  ): Promise<void> {
    await this.httpService.call(connection, 'sethkrtsoll', {
      ain,
      param: TemperatureUtil.toAvm(temperature),
    });
  }

  async getThermostat(
    connection: AvmConnection,
    ain: string,
  ): Promise<ThermostatDto> {
    const xml = await this.httpService.call(connection, 'getdeviceinfos', {
      ain,
    });

    const result = await XmlParser.parse(xml);
    return ThermostatMapper.fromAvm(result.devicelist.device);
  }

  async setComfortTemperature(
    connection: AvmConnection,
    ain: string,
  ): Promise<void> {
    await this.httpService.call(connection, 'sethkrkomfort', {
      ain,
    });
  }

  async setEcoTemperature(
    connection: AvmConnection,
    ain: string,
  ): Promise<void> {
    await this.httpService.call(connection, 'sethkred', {
      ain,
    });
  }

  async setBoostMode(
    connection: AvmConnection,
    ain: string,
    enabled: boolean,
  ): Promise<void> {
    await this.httpService.call(connection, 'sethkrboost', {
      ain,
      param: enabled ? 1 : 0,
    });
  }

  async setWindowOpen(
    connection: AvmConnection,
    ain: string,
    enabled: boolean,
  ): Promise<void> {
    await this.httpService.call(connection, 'sethwindowopen', {
      ain,
      activate: enabled ? 1 : 0,
    });
  }
}
