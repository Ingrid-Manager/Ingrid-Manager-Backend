import { IsDateString, IsNumber, IsString } from 'class-validator';

export class CreateResourceEventDto {
  @IsString()
  title!: string;

  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsNumber()
  resourceid!: number;
}
