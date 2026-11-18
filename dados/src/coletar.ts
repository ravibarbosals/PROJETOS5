import { criarPool } from './db.js';
import { coletar } from './pipeline.js';

const pool = criarPool();

try {
  if (!(await coletar(pool))) {
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}