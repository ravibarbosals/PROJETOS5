import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
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

  // postgresql://usuario:senha@host:5432/banco (DEC-024). No Neon, termina com
  // ?sslmode=verify-full.
  @Matches(/^postgres(ql)?:\/\/.+/)
  DATABASE_URL!: string;

  // DEC-013. No mínimo 32 caracteres, para um segredo fraco nunca chegar à
  // produção.
  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  // Formato aceito pelo jsonwebtoken: número + s/m/h/d (ex.: 8h).
  @Matches(/^\d+[smhd]$/)
  JWT_EXPIRES_IN: `${number}${'s' | 'm' | 'h' | 'd'}` = '8h';

  // DEC-015: intervalo do job de alertas, abaixo da latência máxima de 1 h
  // (PR-010).
  @IsInt()
  @Min(1)
  @Max(59)
  ALERTA_INTERVALO_MINUTOS: number = 10;

  // RN-015 #1: horas seguidas abaixo do limiar de saída para encerrar.
  @IsInt()
  @Min(1)
  @Max(24)
  ALERTA_ESTABILIZACAO_HORAS: number = 2;

  // RN-015 #3: horas sem leitura nova da fonte para expirar.
  @IsInt()
  @Min(1)
  @Max(72)
  ALERTA_EXPIRACAO_HORAS: number = 6;

  // DEC-037: e-mail do alerta por SMTP. Sem SMTP_HOST, o envio fica desligado
  // (testes, scripts) e a API só registra o aviso no log.
  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 587;

  // Usuário e senha só se o servidor exigir (o Mailpit do compose não exige).
  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @IsString()
  SMTP_FROM: string = 'O Vigia <alertas@vigia.local>';
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
