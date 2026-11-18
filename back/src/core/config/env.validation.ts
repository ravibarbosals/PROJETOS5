import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  // postgresql://user:password@host:5432/database (DEC-024). On Neon, end
  // with ?sslmode=verify-full.
  @Matches(/^postgres(ql)?:\/\/.+/)
  DATABASE_URL!: string;

  // DEC-013. At least 32 characters so a weak secret never reaches production.
  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  // Format accepted by jsonwebtoken: number + s/m/h/d (e.g. 8h).
  @Matches(/^\d+[smhd]$/)
  JWT_EXPIRES_IN: `${number}${'s' | 'm' | 'h' | 'd'}` = '8h';
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new Error(`Invalid environment variables:\n${messages.join('\n')}`);
  }

  return validated;
}
