import { criarPool } from './db.js';
import { tratar } from './pipeline.js';

const pool = criarPool();

try {
  if (!(await tratar(pool))) {
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}