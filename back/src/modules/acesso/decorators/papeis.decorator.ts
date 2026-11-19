import { SetMetadata } from '@nestjs/common';
import { Papel } from '@/modules/acesso/enums/papel.enum';

export const PAPEIS_KEY = 'papeis';

// Papéis permitidos numa rota (permissoes.md). Basta o usuário ter um deles
// (AM-004 c).
export const Papeis = (...papeis: Papel[]) => SetMetadata(PAPEIS_KEY, papeis);
