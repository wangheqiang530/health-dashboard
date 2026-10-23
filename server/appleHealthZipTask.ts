import fsp from 'node:fs/promises';
import {
  importAppleHealthZip,
  type AppleHealthZipProgressUpdate,
} from './appleHealthXml.ts';
import {
  completeImportTask,
  failImportTask,
  updateImportTask,
} from './importTasks.ts';

export function startAppleHealthZipTask(input: {
  taskId: string;
  filePath: string;
  fileName: string;
}): void {
  void (async () => {
    let currentStage = 'archiving';
    let lastQueuedAt = 0;
    let lastQueuedStage = '';
    let progressWrite = Promise.resolve();

    const queueProgress = (
      update: AppleHealthZipProgressUpdate,
      force = false
    ): void => {
      const now = Date.now();
      if (!force && update.stage === lastQueuedStage && now - lastQueuedAt < 400) {
        return;
      }
      lastQueuedAt = now;
      lastQueuedStage = update.stage;
      currentStage = update.stage;
      progressWrite = progressWrite
        .then(() =>
          updateImportTask(input.taskId, {
            stage: update.stage,
            stageLabel: update.stageLabel,
            progress: update.progress,
            processedCount: update.processedCount,
            totalCount: update.totalCount,
            bytesProcessed: update.bytesProcessed,
            bytesTotal: update.bytesTotal,
          })
        )
        .then(() => undefined)
        .catch((error) => {
          console.error(`[import-task:${input.taskId}] 写入进度失败`, error);
        });
    };

    try {
      await updateImportTask(input.taskId, {
        status: 'running',
        stage: 'archiving',
        stageLabel: '正在保存原始 ZIP 归档',
        progress: 8,
      });
      const result = await importAppleHealthZip(input.filePath, input.fileName, {
        onProgress: (update) => queueProgress(update),
      });
      queueProgress(
        {
          stage: 'finalizing',
          stageLabel: '导入完成，正在写入任务结果',
          progress: 99,
          processedCount: result.normalizedRecordCount,
        },
        true
      );
      await progressWrite;
      await completeImportTask(input.taskId, result);
    } catch (error) {
      await progressWrite.catch(() => undefined);
      await failImportTask(input.taskId, error, currentStage).catch((taskError) => {
        console.error(`[import-task:${input.taskId}] 标记失败状态失败`, taskError);
      });
    } finally {
      await fsp.unlink(input.filePath).catch(() => undefined);
    }
  })();
}
