import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import databaseConfig from './database/config/database.config';
import authConfig from './auth/config/auth.config';
import appConfig from './config/app.config';
import mailConfig from './mail/config/mail.config';
import path from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { I18nModule } from 'nestjs-i18n';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { MailModule } from './mail/mail.module';
import { HomeModule } from './home/home.module';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AllConfigType } from './config/config.type';
import { SessionModule } from './session/session.module';
import { MailerModule } from './mailer/mailer.module';
import { RoomsModule } from './rooms/rooms.module';
import { AvmLocationsModule } from './avm-locations/avm-locations.module';
import { CategoriesModule } from './categories/categories.module';
import { CalendarEventsModule } from './calendar-events/calendar-events.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReorganizationModule } from './reorganization/reorganization.module';
import { SeriesEventsModule } from './series-events/series-events.module';
import { SettingsModule } from './settings/settings.module';
import { ResourceModule } from './resources/resource.module';
import { ResourceEventsModule } from './resource-events/resource-events.module';
//import { AvmTestModule } from './avm-test/avm-test.module';
import { CryptoModule } from './crypto/crypto.module';

const infrastructureDatabaseModule = TypeOrmModule.forRootAsync({
  useClass: TypeOrmConfigService,
  dataSourceFactory: async (options?: DataSourceOptions) => {
    return new DataSource(options!).initialize();
  },
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, appConfig, mailConfig],
      envFilePath: ['.env'],
    }),
    infrastructureDatabaseModule,
    I18nModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: {
          path: path.join(__dirname, 'i18n'),
          watch: true,
        },
      }),
    }),

    //AvmTestModule,
    UsersModule,
    AuthModule,
    SessionModule,
    MailModule,
    MailerModule,
    HomeModule,
    RoomsModule,
    AvmLocationsModule,
    CategoriesModule,
    CalendarEventsModule,
    ScheduleModule.forRoot(),
    ReorganizationModule,
    SeriesEventsModule,
    SettingsModule,
    ResourceModule,
    ResourceEventsModule,
    CryptoModule,
  ],
})
export class AppModule {}
