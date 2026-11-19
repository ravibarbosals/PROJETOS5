import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

// Hash de senha (DEC-013). Encapsulado para os services poderem ser testados
// sem o argon2.
@Injectable()
export class PasswordHasher {
  hash(senha: string): Promise<string> {
    return argon2.hash(senha, { type: argon2.argon2id });
  }

  verify(hash: string, senha: string): Promise<boolean> {
    return argon2.verify(hash, senha);
  }
}
