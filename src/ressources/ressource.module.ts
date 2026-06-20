import { Module } from '@nestjs/common';
import { RessourceService } from './ressource.service';
import { RessourceController } from './ressource.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ressource } from './infrastructure/relational/persistence/entities/ressource.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ressource])],
  providers: [RessourceService],
  controllers: [RessourceController],
})
export class RessourceModule {}
