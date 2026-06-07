import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { lowerCaseTransformer } from '../../utils/transformers/lower-case.transformer';
import { vMsg } from '../../utils/i18n-validations';

export class AuthEmailLoginDto {
  @ApiProperty({ example: 'test1@example.com', type: String })
  @Transform(lowerCaseTransformer)
  @IsEmail({}, { message: vMsg('isEmail') })
  //@IsEmail({}, { message: i18nValidationMessage('validation.isEmail') })
  @IsNotEmpty({ message: vMsg('isNotEmpty') })
  email!: string;

  @ApiProperty()
  @IsNotEmpty({ message: vMsg('isNotEmpty') })
  password!: string;
}
