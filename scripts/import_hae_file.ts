import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { importHaePayload } from '../server/hae.ts';
import { migrate, closeDatabase } from '../server/db.ts';

const filePath = process.argv[2];
if (!filePath) {
  throw new Error('用法: pnpm import:hae -- /path/to/health-auto-export.json[.gz]');
}

const file = await fs.readFile(filePath);
const content = filePath.endsWith('.gz')
  ? gunzipSync(file).toString('utf8')
  : file.toString('utf8');
const payload = JSON.parse(content) as unknown;

await migrate();
const result = await importHaePayload(payload, {
  payloadSizeBytes: file.byteLength,
  sourceIp: 'cli',
});
console.log(JSON.stringify(result, null, 2));
await closeDatabase();
