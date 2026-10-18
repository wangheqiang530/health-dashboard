import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { config } from './config.ts';

const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB 单日志文件上限
const logDir = path.join(config.dataDir, 'logs');
const logFile = path.join(logDir, 'app.log');

try {
  fs.mkdirSync(logDir, { recursive: true });
} catch {
  // 目录若已存在忽略错误
}

function rotateLogIfNeeded(): void {
  try {
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size >= MAX_LOG_SIZE_BYTES) {
        const backupFile = path.join(logDir, 'app.1.log');
        try {
          if (fs.existsSync(backupFile)) {
            fs.unlinkSync(backupFile);
          }
          fs.renameSync(logFile, backupFile);
        } catch {
          // 重命名异常时静默忽略
        }
      }
    }
  } catch {
    // 状态检查异常忽略
  }
}

rotateLogIfNeeded();

let logStream = fs.createWriteStream(logFile, { flags: 'a', encoding: 'utf8' });

export function writeLogToFile(message: string): void {
  try {
    rotateLogIfNeeded();
    logStream.write(message);
  } catch {
    // 写入异常不中断主进程
  }
}

export const appLogStream = new Writable({
  write(chunk: Buffer | string, _encoding, callback) {
    const text = chunk.toString();
    process.stdout.write(text);
    writeLogToFile(text);
    callback();
  },
});

const originalConsoleLog = console.log.bind(console);
const originalConsoleInfo = console.info.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const originalConsoleError = console.error.bind(console);

const formatLine = (level: string, args: unknown[]): string => {
  const line = args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.stack || arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
  return `[${new Date().toISOString()}] [${level}] ${line}\n`;
};

console.log = (...args: unknown[]) => {
  originalConsoleLog(...args);
  writeLogToFile(formatLine('INFO', args));
};

console.info = (...args: unknown[]) => {
  originalConsoleInfo(...args);
  writeLogToFile(formatLine('INFO', args));
};

console.warn = (...args: unknown[]) => {
  originalConsoleWarn(...args);
  writeLogToFile(formatLine('WARN', args));
};

console.error = (...args: unknown[]) => {
  originalConsoleError(...args);
  writeLogToFile(formatLine('ERROR', args));
};

export function closeLogger(): void {
  try {
    logStream.end();
  } catch {
    // 忽略
  }
}
