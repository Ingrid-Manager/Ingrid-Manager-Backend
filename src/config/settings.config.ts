import { registerAs } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import validateConfig from '../utils/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  ORG_NAME!: string;

  @IsString()
  @IsOptional()
  ORG_TYPE!: string;

  @IsString()
  @IsOptional()
  ORG_EMAIL!: string;

  @IsString()
  @IsOptional()
  ORG_WEBSITE!: string;

  @IsString()
  @IsOptional()
  ORG_BUNDESLAND!: string;

  @IsString()
  @IsOptional()
  TECH_FIRST_NAME!: string;

  @IsString()
  @IsOptional()
  TECH_LAST_NAME!: string;

  @IsString()
  @IsOptional()
  TECH_EMAIL!: string;
}

export default registerAs('org', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    orgName: process.env.ORG_NAME,
    orgType: process.env.ORG_TYPE,
    orgEmail: process.env.ORG_EMAIL,
    orgWebsite: process.env.ORG_WEBSITE,
    orgBundesland: process.env.ORG_BUNDESLAND,
    techFirstName: process.env.TECH_FIRST_NAME,
    techLastName: process.env.TECH_LAST_NAME,
    techEmail: process.env.TECH_EMAIL,
  };
});