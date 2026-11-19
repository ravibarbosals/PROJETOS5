import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Rotas abertas sem login (PER-001, PER-013). Todas as outras exigem token.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
