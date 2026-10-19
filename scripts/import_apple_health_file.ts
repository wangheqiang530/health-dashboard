import fs from 'node:fs/promises';
import path from 'node:path';
import { importAppleHealthZip } from '../server/appleHealthXml.ts';
import { migrate, closeDatabase } from '../server/db.ts';

const filePath = process.argv[2];
if (!filePath) {
  throw new Error('用法: pnpm import:apple-health -- /path/to/export.zip');
}

const buffer = await fs.readFile(filePath);
await migrate();
const result = await importAppleHealthZip(buffer, path.basename(filePath));
console.log(JSON.stringify(result, null, 2));
await closeDatabase();
