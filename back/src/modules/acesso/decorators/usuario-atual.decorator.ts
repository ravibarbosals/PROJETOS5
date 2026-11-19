import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';

export interface RequestAutenticada extends Request {
  usuario?: Usuario;
}

// O usuário carregado pelo AuthGuard na requisição atual.
export const UsuarioAtual = createParamDecorator(
  (_: unknown, context: ExecutionContext): Usuario => {
    const request = context.switchToHttp().getRequest<RequestAutenticada>();
    if (!request.usuario) {
      throw new Error('UsuarioAtual used on a public route');
    }
    return request.usuario;
  },
);
