import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { IsAppPassword } from '../../utils/validators/is-app-password.decorator';

export class AuthResetPasswordDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsAppPassword()
  password!: string;

  @ApiProperty()
  @IsNotEmpty()
  hash!: string;
}
