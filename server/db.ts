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
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const appliedResult = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations'
    );
    const appliedSet = new Set(appliedResult.rows.map((r) => r.version));

    // Bootstrap tracking for databases that ran migrations before schema_migrations existed
    if (appliedSet.size === 0) {
      const tableCheck = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      );
      const tables = new Set(tableCheck.rows.map((r) => r.table_name));

      if (tables.has('daily_summaries')) appliedSet.add('001_init.sql');
      if (tables.has('source_archive_files')) appliedSet.add('002_archives.sql');
      if (tables.has('dashboard_sessions')) appliedSet.add('003_dashboard_sessions.sql');
      if (tables.has('health_raw_records')) appliedSet.add('004_raw_library.sql');

      const colCheck = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'daily_summaries' AND column_name = 'import_batch_id'`
      );
      if (colCheck.rows.length > 0) {
        appliedSet.add('005_daily_summary_cleanup.sql');
      }

      for (const preApplied of appliedSet) {
        await client.query(
          `INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING`,
          [preApplied]
        );
      }
    }

    for (const migrationFile of migrationFiles) {
      if (appliedSet.has(migrationFile)) {
        continue;
      }

      console.log(`[db] 执行数据库迁移: ${migrationFile}`);
      const sql = await fs.readFile(`${migrationsDirectory}/${migrationFile}`, 'utf8');
    await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING`,
        [migrationFile]
      );
      await client.query('COMMIT');
      appliedSet.add(migrationFile);
      console.log(`[db] 迁移完成: ${migrationFile}`);
    }
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
