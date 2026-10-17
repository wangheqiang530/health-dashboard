import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config.ts';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (error) => {
  console.error('PostgreSQL 连接池异常:', error);
});

export async function migrate(): Promise<void> {
  const migrationsDirectory = fileURLToPath(new URL('./migrations', import.meta.url));
  const migrationFiles = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    for (const migrationFile of migrationFiles) {
      const sql = await fs.readFile(`${migrationsDirectory}/${migrationFile}`, 'utf8');
      await client.query(sql);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
