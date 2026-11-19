import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginResponseDto } from '@/modules/acesso/dto/login-response.dto';
import { UsuarioResponseDto } from '@/modules/acesso/dto/usuario-response.dto';
import { RegistroAcesso } from '@/modules/acesso/entities/registro-acesso.entity';
import { PasswordHasher } from '@/modules/acesso/services/password-hasher.service';
import { UsuarioService } from '@/modules/acesso/services/usuario.service';

export const LOGIN_INVALIDO_MESSAGE = 'E-mail ou senha inválidos';

export interface JwtPayload {
  sub: number;
}

@Injectable()
export class AuthService {
  // Usado na comparação quando o e-mail não existe, para o tempo de resposta
  // não revelar quais e-mails estão cadastrados.
  private dummyHash?: Promise<string>;

  constructor(
    private readonly usuarios: UsuarioService,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
    @InjectRepository(RegistroAcesso)
    private readonly registros: Repository<RegistroAcesso>,
  ) {}

  // FLX-001, RN-010 #5, RN-011.
  async login(email: string, senha: string): Promise<LoginResponseDto> {
    const usuario = await this.usuarios.buscarParaLogin(email);

    const senhaConfere = usuario
      ? await this.hasher.verify(usuario.senhaHash, senha)
      : await this.hasher
          .verify(await this.hashFicticio(), senha)
          .then(() => false);
    const sucesso = Boolean(usuario?.ativo && senhaConfere);

    await this.registros.insert({
      emailInformado: email.trim(),
      idUsuario: usuario?.id ?? null,
      sucesso,
    });

    // Mesma mensagem para e-mail inexistente, senha errada e usuário inativo.
    if (!usuario || !sucesso)
      throw new UnauthorizedException(LOGIN_INVALIDO_MESSAGE);

    const payload: JwtPayload = { sub: usuario.id };
    return {
      access_token: await this.jwt.signAsync(payload),
      usuario: UsuarioResponseDto.from(usuario),
    };
  }

  private hashFicticio(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('senha-ficticia-para-tempo-constante');
    return this.dummyHash;
  }
}
