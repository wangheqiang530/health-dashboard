#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createGunzip } from 'node:zlib';
import 'dotenv/config';

const dataDir = path.resolve(process.env.DATA_DIR ?? './data');
const backupDir = path.join(dataDir, 'backups');

function findLatestBackup() {
  if (!fs.existsSync(backupDir)) return null;
  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.sql.gz') || f.endsWith('.sql'))
    .map(f => ({
      name: f,
      fullPath: path.join(backupDir, f),
      mtime: fs.statSync(path.join(backupDir, f)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? files[0] : null;
}

async function restoreViaDocker(backupFile) {
  console.log(`[Restore] Attempting restore via Docker container 'health-dashboard-db'...`);
  const isGz = backupFile.endsWith('.sql.gz');
  
  // Check if docker container is running
  try {
    execSync('docker inspect -f "{{.State.Running}}" health-dashboard-db', { stdio: 'pipe' });
  } catch (e) {
    throw new Error('Docker container health-dashboard-db is not running. Please start it with: docker-compose up -d db');
  }

  console.log(`[Restore] Streaming ${backupFile} into PostgreSQL container...`);
  
  const cmd = isGz 
    ? 'sh -c "gunzip -c | psql -U health -d health_dashboard"'
    : 'psql -U health -d health_dashboard';

  const child = spawn('docker', ['exec', '-i', 'health-dashboard-db', 'sh', '-c', isGz ? 'gunzip -c | psql -U health -d health_dashboard' : 'psql -U health -d health_dashboard'], {
    stdio: ['pipe', 'inherit', 'inherit']
  });

  const fileStream = fs.createReadStream(backupFile);
  fileStream.pipe(child.stdin);

  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Docker restore failed with exit code ${code}`));
    });
  });

  console.log('[Restore] Database restored successfully via Docker!');
}

async function main() {
  const target = process.argv[2];
  let backupFile = null;

  if (target) {
    backupFile = path.resolve(target);
    if (!fs.existsSync(backupFile)) {
      console.error(`[Error] Specified backup file not found: ${backupFile}`);
      process.exit(1);
    }
  } else {
    const latest = findLatestBackup();
    if (!latest) {
      console.error(`[Error] No backup files (.sql / .sql.gz) found in ${backupDir}`);
      process.exit(1);
    }
    backupFile = latest.fullPath;
  }

  console.log(`[Restore] Target backup: ${backupFile}`);
  await restoreViaDocker(backupFile);
}

main().catch(err => {
  console.error('[Restore] Failed:', err.message);
  process.exit(1);
});
