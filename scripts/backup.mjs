#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import 'dotenv/config';

const dataDir = path.resolve(process.env.DATA_DIR ?? './data');
const backupDir = path.join(dataDir, 'backups');
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://health:health@localhost:5433/health_dashboard';

async function main() {
  await fs.mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetFile = path.join(backupDir, `manual_${timestamp}.sql.gz`);
  const tempFile = `${targetFile}.tmp`;

  console.log(`[Backup] Connecting to database...`);
  console.log(`[Backup] Target: ${targetFile}`);

  try {
    const child = spawn('pg_dump', [databaseUrl], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (c) => (stderr += c.toString()));

    const dumpPromise = new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pg_dump exited with ${code}: ${stderr}`));
      });
    });

    await Promise.all([
      pipeline(child.stdout, createGzip(), createWriteStream(tempFile)),
      dumpPromise,
    ]);

    await fs.rename(tempFile, targetFile);
    const stat = await fs.stat(targetFile);
    console.log(`[Backup] Success! File size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (err) {
    if (existsSync(tempFile)) await fs.unlink(tempFile).catch(() => {});
    console.error(`[Backup] Failed:`, err);
    process.exit(1);
  }
}

main();
