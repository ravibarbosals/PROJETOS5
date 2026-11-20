// Ponto de entrada do `npm run seed:demo` (TASK-050). Só no Postgres local;
// nunca roda na subida da aplicação. `-- --ativo` acrescenta um alerta ATIVO
// para a apresentação.
import dataSource from '@/infrastructure/database/data-source';
import { exigirBancoLocal } from '@/infrastructure/database/seed-demo/banco-local';
import {
  seedDemo,
  validarSenhaDemo,
} from '@/infrastructure/database/seed-demo/seed-demo';
import { PasswordHasher } from '@/modules/acesso/services/password-hasher.service';

async function main() {
  exigirBancoLocal(process.env.DATABASE_URL);
  const senha = validarSenhaDemo(process.env.DEMO_SENHA);
  const ativo = process.argv.includes('--ativo');

  await dataSource.initialize();
  try {
    const resultado = await seedDemo(dataSource, new PasswordHasher(), {
      senha,
      ativo,
    });
    console.log(
      resultado.base === 'criado'
        ? 'Dados de demonstração criados.'
        : 'Dados de demonstração já existiam; nada foi alterado.',
    );
    if (resultado.ativo === 'criado') {
      console.log('Alerta ativo de demonstração criado.');
    } else if (resultado.ativo === 'ja-existe') {
      console.log(
        'Já existe um alerta ativo de chuva no Recife; nenhum outro foi criado.',
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
