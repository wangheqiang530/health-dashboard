/**
 * Fitdays (沃莱/易康萌讯) 智能体脂秤数据全自动获取脚本
 * 适用设备: 沃莱/Fitdays/乐福 4电极及8电极体脂秤
 * 运行要求: Node.js >= 18 (零外部 npm 依赖，开箱即用)
 * 运行方式: node fitdays_sync.mjs
 */

import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// -----------------------------
// 独立诊断脚本配置。正式数据同步请使用网页配置中心。
// 示例: $env:FITDAYS_ACCOUNT="..."; $env:FITDAYS_PASSWORD="..."
// -----------------------------
export const FITDAYS_CONFIG = {
  account: process.env.FITDAYS_ACCOUNT ?? '',
  password: process.env.FITDAYS_PASSWORD ?? '',
  // 主号档案 SUID: 王贺强 (UID: 36152895, SUID: 36152905)
  targetSuid: process.env.FITDAYS_TARGET_SUID
    ? Number(process.env.FITDAYS_TARGET_SUID)
    : null,
  // 数据同步天数窗口 (默认拉取过去 3 年)
  syncDays: Number(process.env.FITDAYS_SYNC_DAYS ?? 1095),
  // 是否输出保存为本地 JSON 文件
  saveJson: true,
  jsonOutputPath: './fitdays_latest_data.json',
};

// -----------------------------
// 底层加密与签名算法 (逆向自官方 SDK)
// -----------------------------
const md5Hex = (input) => createHash('md5').update(input, 'utf8').digest('hex');

const hashPassword = (plaintext) => {
  const inner = md5Hex(plaintext + 'hx').toUpperCase();
  return md5Hex(inner).toUpperCase();
};

const newClientId = () => md5Hex(randomUUID()).toUpperCase();
const newRequestId = () => md5Hex(randomUUID());

const javaUrlEncode = (s) =>
  encodeURIComponent(s)
    .replace(/%20/g, '+')
    .replace(/[!'()~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

const buildSign = (params) => {
  const keys = Object.keys(params).sort();
  const raw = keys.map((k) => `${k}=${params[k]}`).join('&');
  return md5Hex(javaUrlEncode(raw + 'hxsign'));
};

async function fitdaysRequest(path, body, token = '', uid = '0') {
  const clientId = newClientId();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signParams = {
    app_ver: '1.21.0',
    client_id: clientId,
    country: 'CN',
    device_model: 'AndroidSDKbuiltforarm64-6.0',
    language: 'zh',
    os_type: '0',
    request_id: newRequestId(),
    source: '0',
    timestamp,
    token: token || '',
    uid: uid ? String(uid) : '0',
  };
  const sign = buildSign(signParams);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(signParams)) qs.append(k, v);
  qs.append('sign', sign);
  qs.append('capp_ver', '1.21.0');

  const url = `https://online.fitdays.cn/${path.replace(/^\//, '')}?${qs.toString()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      'user-agent': 'okhttp/4.9.3',
    },
    body: JSON.stringify(body),
  });
  return await res.json();
}

// -----------------------------
// 核心业务方法
// -----------------------------
export async function fetchFitdaysRecords(options = {}) {
  const config = { ...FITDAYS_CONFIG, ...options };
  if (!config.account || !config.password) {
    throw new Error('请设置 FITDAYS_ACCOUNT 与 FITDAYS_PASSWORD 环境变量。');
  }

  // 1. 登录
  const loginRes = await fitdaysRequest('api/users/login', {
    email: config.account,
    password: hashPassword(config.password),
  });

  if (loginRes.code !== 0 && loginRes.code !== 200) {
    throw new Error(`Fitdays 登录失败: ${loginRes.msg || loginRes.code}`);
  }

  const token = loginRes.data.token || loginRes.data.account?.token;
  const uid = loginRes.data.account?.uid;
  const activeSuid = config.targetSuid || loginRes.data.account?.active_suid;
  const users = loginRes.data.users || [];
  const devices = loginRes.data.devices || [];

  // 2. 云端全量数据同步
  const now = Math.floor(Date.now() / 1000);
  const syncRes = await fitdaysRequest(
    'api/sync/syncFromServer',
    {
      end_time: now - config.syncDays * 86400,
      start_time: now,
    },
    token,
    uid
  );

  if (!syncRes.data || !syncRes.data.weight_list) {
    return { users, devices, records: [] };
  }

  // 3. 过滤并格式化属于主号的测量数据
  const records = syncRes.data.weight_list
    .filter((w) => w.suid === activeSuid && w.is_deleted === 0)
    .sort((a, b) => b.measured_time - a.measured_time)
    .map((r) => {
      let extParsed = null;
      if (r.ext_data) {
        try {
          extParsed = JSON.parse(r.ext_data);
        } catch {
          extParsed = r.ext_data;
        }
      }
      return {
        measured_time: r.measured_time,
        measured_date: new Date(r.measured_time * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        weight_kg: r.weight_kg,
        bmi: Number(r.bmi.toFixed(1)),
        body_fat_rate: Number(r.bfr.toFixed(1)), // 体脂率 %
        skeletal_muscle_rate: Number(r.rosm.toFixed(1)), // 骨骼肌率 %
        muscle_rate: Number(r.rom.toFixed(1)), // 肌肉率 %
        lean_body_mass_kg: Number((r.weight_kg * (1 - r.bfr / 100)).toFixed(2)), // 去脂体重 kg
        visceral_fat_level: r.uvi, // 内脏脂肪等级 (1-9正常)
        water_rate: Number(r.vwc.toFixed(1)), // 水分率 %
        bone_mass_kg: Number(r.bm.toFixed(2)), // 骨量 kg
        bmr_kcal: r.bmr, // 基础代谢 kcal
        subcutaneous_fat_rate: Number(r.sfr.toFixed(1)), // 皮下脂肪率 %
        protein_rate: Number(r.pp.toFixed(1)), // 蛋白质率 %
        body_age: r.bodyage, // 身体年龄
        heart_rate: r.hr || null, // 心率
        score: extParsed?.bodyScore || null, // 综合身体评分
        smi: extParsed?.smi || null, // 骨骼肌指数
        whr: extParsed?.whr ? Number(extParsed.whr.toFixed(3)) : null, // 腰臀比
        raw_record: r,
        segmental_data: extParsed, // 8电极分段扩展指标
      };
    });

  return {
    account_uid: uid,
    active_suid: activeSuid,
    users,
    devices,
    total_count: records.length,
    records,
  };
}

// -----------------------------
// CLI 直接运行逻辑
// -----------------------------
async function main() {
  console.log('正在连接 Fitdays 官方云端获取体脂数据...');
  try {
    const result = await fetchFitdaysRecords();
    console.log(`成功获取主号档案 (SUID: ${result.active_suid}) 的体脂记录共 ${result.total_count} 条`);

    if (result.records.length > 0) {
      const latest = result.records[0];
      console.log('\n--- 最新一次体测详情 ---');
      console.log(`测量时间:     ${latest.measured_date}`);
      console.log(`体重:         ${latest.weight_kg} kg`);
      console.log(`BMI:          ${latest.bmi}`);
      console.log(`体脂率:       ${latest.body_fat_rate} %`);
      console.log(`骨骼肌率:     ${latest.skeletal_muscle_rate} %`);
      console.log(`去脂体重:     ${latest.lean_body_mass_kg} kg`);
      console.log(`内脏脂肪等级: ${latest.visceral_fat_level}`);
      console.log(`身体水分率:   ${latest.water_rate} %`);
      console.log(`基础代谢:     ${latest.bmr_kcal} kcal`);
      console.log(`身体综合评分: ${latest.score} 分`);
    }

    if (FITDAYS_CONFIG.saveJson) {
      const resolvedPath = path.resolve(FITDAYS_CONFIG.jsonOutputPath);
      await fs.writeFile(resolvedPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`\n完整全量数据已保存至: ${resolvedPath}`);
    }
  } catch (err) {
    console.error('获取失败:', err);
  }
}

if (process.argv[1]?.endsWith('fitdays_sync.mjs')) {
  main();
}
