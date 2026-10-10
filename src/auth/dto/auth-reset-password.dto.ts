import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength, Matches } from 'class-validator';

export class AuthResetPasswordDto {
  @ApiProperty()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).+$/, {
    message:
      'Das Passwort muss Groß und Kleinbuchstaben, sowie mindestens eine Zahl oder ein Sonderzeichen beinhalten!',
  })
  password!: string;

  @ApiProperty()
  @IsNotEmpty()
  hash!: string;
}
