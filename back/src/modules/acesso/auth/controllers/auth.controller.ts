import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '@/core/auth/public.decorator';
import { UsuarioAtual } from '@/modules/acesso/decorators/usuario-atual.decorator';
import { UsuarioResponseDto } from '@/modules/acesso/usuario/dto/usuario-response.dto';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';
import { LoginResponseDto } from '@/modules/acesso/auth/dto/login-response.dto';
import { LoginDto } from '@/modules/acesso/auth/dto/login.dto';
import { AuthService } from '@/modules/acesso/auth/services/auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // PER-001: aberto a todos.
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha inválidos' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(dto.email, dto.senha);
  }

  // PER-002: qualquer usuário logado.
  @Get('me')
  @ApiBearerAuth()
  me(@UsuarioAtual() usuario: Usuario): UsuarioResponseDto {
    return UsuarioResponseDto.from(usuario);
  }
}
