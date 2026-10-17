/**
 * iGPSPORT (迹驰) 码表骑行活动数据与原始 .FIT 文件全自动同步脚本
 * 适用设备: BSC500, BSC100/200/300 系列, iGS 全系列码表
 * 运行要求: Node.js >= 18 (零外部 npm 依赖，开箱即用)
 * 运行方式: node igpsport_sync.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';

// -----------------------------
// 独立诊断脚本配置。正式数据同步请使用网页配置中心。
// 示例: $env:IGPSPORT_USERNAME="..."; $env:IGPSPORT_PASSWORD="..."
// -----------------------------
export const IGPSPORT_CONFIG = {
  username: process.env.IGPSPORT_USERNAME ?? '',
  password: process.env.IGPSPORT_PASSWORD ?? '',
  // FIT 文件本地保存目录
  fitOutputDir: './igpsport_fits',
  // 检查最近的骑行数量 (例如同步最近 10 次，也可设更大或全量)
  syncLimit: Number(process.env.IGPSPORT_SYNC_LIMIT ?? 10),
  // 是否输出骑行活动摘要为 JSON 文件
  saveSummaryJson: true,
  summaryJsonPath: './igpsport_rides_summary.json',
};

const BASE_URL = 'https://prod.zh.igpsport.com/service';

// -----------------------------
// 核心 API 请求封装
// -----------------------------
export async function loginIgpsport(username = IGPSPORT_CONFIG.username, password = IGPSPORT_CONFIG.password) {
  const res = await fetch(`${BASE_URL}/auth/account/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://login.passport.igpsport.cn',
      'Referer': 'https://login.passport.igpsport.cn/',
    },
    body: JSON.stringify({
      appId: 'igpsport-web',
      username,
      password,
    }),
  });

  const json = await res.json();
  if (json.code !== 0 || !json.data?.access_token) {
    throw new Error(`iGPSPORT 登录失败: ${json.message || json.code}`);
  }
  return json.data.access_token;
}

export async function getRideList(token, pageNo = 1, pageSize = 20) {
  const res = await fetch(
    `${BASE_URL}/web-gateway/web-analyze/activity/queryMyActivity?pageNo=${pageNo}&pageSize=${pageSize}&reqType=0&sort=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    }
  );
  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(`获取活动列表失败: ${json.message || json.code}`);
  }
  return json.data;
}

export async function getRideDetail(token, rideId) {
  const res = await fetch(`${BASE_URL}/web-gateway/web-analyze/activity/queryActivityDetail/${rideId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
  });
  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(`获取活动详情失败 (${rideId}): ${json.message || json.code}`);
  }
  return json.data;
}

export async function downloadFitFile(token, rideId, destPath = null) {
  const urlRes = await fetch(`${BASE_URL}/web-gateway/web-analyze/activity/getDownloadUrl/${rideId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
  });
  const urlJson = await urlRes.json();
  const fitUrl = urlJson.data;
  if (!fitUrl) {
    throw new Error(`无法获取 Ride ID ${rideId} 的 FIT 下载链接`);
  }

  const fileRes = await fetch(fitUrl);
  const buffer = Buffer.from(await fileRes.arrayBuffer());

  if (destPath) {
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, buffer);
  }
  return { fitUrl, size: buffer.length, buffer };
}

export async function syncRecentRides(options = {}) {
  const config = { ...IGPSPORT_CONFIG, ...options };
  if (!config.username || !config.password) {
    throw new Error('请设置 IGPSPORT_USERNAME 与 IGPSPORT_PASSWORD 环境变量。');
  }
  const outputDir = path.resolve(config.fitOutputDir);
  await fs.mkdir(outputDir, { recursive: true });

  // 1. 登录
  const token = await loginIgpsport(config.username, config.password);

  // 2. 获取最近骑行列表
  const activityData = await getRideList(token, 1, config.syncLimit);
  const rows = activityData?.rows || [];
  const totalRows = activityData?.totalRows || 0;

  const syncedRides = [];

  for (const row of rows) {
    const rideId = row.rideId;
    const detail = await getRideDetail(token, rideId);

    // 生成与码表相同的标准规范文件名: YYYY-MM-DD-HH-mm-ss.fit
    const startStr = detail.startTime || row.startTime;
    const sanitizedDate = startStr.replace(/[\s:]/g, '-');
    const fitFileName = `${sanitizedDate}.fit`;
    const localFilePath = path.join(outputDir, fitFileName);

    // 检查本地是否已存在，避免重复下载
    let existed = false;
    try {
      await fs.access(localFilePath);
      existed = true;
    } catch {
      existed = false;
    }

    let fileSize = 0;
    if (!existed) {
      const dlResult = await downloadFitFile(token, rideId, localFilePath);
      fileSize = dlResult.size;
    } else {
      const stat = await fs.stat(localFilePath);
      fileSize = stat.size;
    }

    syncedRides.push({
      ride_id: rideId,
      title: detail.title,
      device: detail.deviceInfo?.deviceName || row.productName || 'BSC500',
      start_time: detail.startTime,
      end_time: detail.endTime,
      moving_time_sec: detail.totalMovingTime,
      distance_km: Number((detail.rideDistance / 1000).toFixed(2)),
      avg_speed_kmh: Number((detail.avgSpeed * 3.6).toFixed(1)),
      max_speed_kmh: Number((detail.maxSpeed * 3.6).toFixed(1)),
      avg_heart_rate: detail.avgHrm || null,
      max_heart_rate: detail.maxHrm || null,
      avg_cadence: detail.avgCad || null,
      avg_power: detail.avgPower || null,
      max_power: detail.maxPower || null,
      normalized_power_np: detail.pwrNP || null,
      tss: detail.pwrTSS || null,
      ascent_m: detail.totalAscent,
      calories: detail.calorie,
      fit_file_path: localFilePath,
      fit_file_name: fitFileName,
      file_size_bytes: fileSize,
      already_existed: existed,
    });
  }

  return {
    total_account_rides: totalRows,
    synced_count: syncedRides.length,
    output_directory: outputDir,
    rides: syncedRides,
  };
}

// -----------------------------
// CLI 直接运行逻辑
// -----------------------------
async function main() {
  console.log('正在连接 iGPSPORT 云端同步骑行数据与 .FIT 文件...');
  try {
    const result = await syncRecentRides();
    console.log(`账号历史累计骑行: ${result.total_account_rides} 次，本次同步最近 ${result.synced_count} 次活动`);
    console.log(`FIT 文件归档保存目录: ${result.output_directory}\n`);

    for (const r of result.rides) {
      const tag = r.already_existed ? '[已有跳过]' : '[新增下载]';
      console.log(
        `${tag} ${r.start_time} | ${r.title} | 里程: ${r.distance_km}km | 均速: ${r.avg_speed_kmh}km/h | 心率: ${r.avg_heart_rate || '-'} | 功率: ${r.avg_power || '-'}W -> ${r.fit_file_name} (${(r.file_size_bytes / 1024).toFixed(1)} KB)`
      );
    }

    if (IGPSPORT_CONFIG.saveSummaryJson) {
      const resolvedSummaryPath = path.resolve(IGPSPORT_CONFIG.summaryJsonPath);
      await fs.writeFile(resolvedSummaryPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`\n骑行摘要索引已保存至: ${resolvedSummaryPath}`);
    }
  } catch (err) {
    console.error('同步失败:', err);
  }
}

if (process.argv[1]?.endsWith('igpsport_sync.mjs')) {
  main();
}
