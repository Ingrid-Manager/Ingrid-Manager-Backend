import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateRessourceDto {
  @IsNumber()
  id!: number;

  @IsString()
  title!: string;

  @IsString()
  color!: string;

  @IsString()
  @IsOptional()
  manager_email?: string;

  @IsString()
  @IsOptional()
  inventoryid?: string;
}
