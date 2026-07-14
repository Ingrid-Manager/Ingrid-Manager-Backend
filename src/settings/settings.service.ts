import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsDto } from './dto/settings.dto';
import packageJSON from '../../package.json';

@Injectable()
export class SettingsService {
  constructor(private readonly configService: ConfigService) {}

  getSettings(): SettingsDto {
    return {
      orgName: this.configService.get<string>('ORG_NAME', { infer: true }),
      orgType: this.configService.get<string>('ORG_TYPE', { infer: true }),
      orgEmail: this.configService.get<string>('ORG_EMAIL', { infer: true }),
      orgWebsite: this.configService.get<string>('ORG_WEBSITE', {
        infer: true,
      }),
      orgBundesland: this.configService.get<string>('ORG_BUNDESLAND', {
        infer: true,
      }),
      techFirstName: this.configService.get<string>('TECH_FIRST_NAME', {
        infer: true,
      }),
      techLastName: this.configService.get<string>('TECH_LAST_NAME', {
        infer: true,
      }),
      techEmail: this.configService.get<string>('TECH_EMAIL', { infer: true }),
    };
  }

  getVersion(): { version: string } {
    return { version: packageJSON.version };
  }
}
