import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const SESSIONS_DIR = 'C:\\Users\\wangheqiang\\.codex\\sessions\\2026\\10';
const OUT_RAW_DIR = path.resolve('codex_context/raw_sessions');
const OUT_TRANSCRIPTS_DIR = path.resolve('codex_context/transcripts');

fs.mkdirSync(OUT_RAW_DIR, { recursive: true });
fs.mkdirSync(OUT_TRANSCRIPTS_DIR, { recursive: true });

function cleanUserText(text) {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, '');
  cleaned = cleaned.replace(/<external_codex_apps_open_page>[\s\S]*?<\/external_codex_apps_open_page>/gi, '');
  cleaned = cleaned.replace(/<collaboration_mode>[\s\S]*?<\/collaboration_mode>/gi, '');
  cleaned = cleaned.replace(/<in-app-browser-context[\s\S]*?<\/in-app-browser-context>/gi, '');
  return cleaned.trim();
}

function scanDir(dir) {
  const files = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) files.push(...scanDir(full));
    else if (ent.name.endsWith('.jsonl')) files.push(full);
  }
  return files;
}

// Known target session IDs and descriptive stage titles
const KNOWN_SESSIONS = [
  {
    prefix: '01_选型调研',
    id: '01a145a7-090d-74a0-9435-bb2304bf74ea',
    title: 'iOS健康数据自动导出与选型调研',
    desc: '探讨iOS健康App与Apple Watch数据导出方案，对比各类工具与自动化方案，最终敲定Health Auto Export。'
  },
  {
    prefix: '02_架构发想',
    id: '01a145c5-9d8f-7821-86ae-f74045244e80',
    title: '人体探针概念规划与Health Auto Export对接',
    desc: '规划“人体探针”大盘定位，设定数据流转管道，初步梳理睡眠、心率、活动等多维指标。'
  },
  {
    prefix: '03_参数解析',
    id: '01a145e1-fab8-7710-8624-0e9f6a0f4cdd',
    title: 'Health Auto Export导出参数与最优配置',
    desc: '详细拆解Health Auto Export手动导出与自动同步各菜单项意义，确立高精度JSON格式与传输策略。'
  },
  {
    prefix: '04_前端重构',
    id: '01a14872-7f97-7cb2-9c3f-5d2bf47cbb6c',
    title: '苹果风格健康面板前端页面重做',
    desc: '推翻简陋UI，按原生Apple健康精致质感重构前端页面，强化数据颗粒度、多层级看板与卡片视觉。'
  },
  {
    prefix: '05_面板实装',
    id: '01a14927-c2de-7d12-9cb9-a648adcf0911',
    title: '根据真实iOS健康数据实装大盘组件',
    desc: '解析真实导出的XML与JSON结构，构建运动圆环、心率热力图、睡眠分期、步数趋势及卡路里消耗组件。'
  },
  {
    prefix: '06_体脂秤逆向',
    id: '01a14979-ed9c-7eb3-939d-4580d36c1f9e',
    title: 'Fitdays体脂秤API逆向与云端定时同步',
    desc: '深入逆向Fitdays云端接口，实现账号免密/Token签名登录，提取全身体成分（骨量、肌肉率、内脏脂肪等）。'
  },
  {
    prefix: '07_数据库选型',
    id: '01a149a3-35d1-7303-a664-156cbb54e214',
    title: '后端架构设计与PostgreSQL数据库选型',
    desc: '对比SQLite、Redis与PostgreSQL特性，结合时序健康指标与高吞吐持久化需求，正式确定采用PostgreSQL 16。'
  },
  {
    prefix: '08_后端实装',
    id: '01a14ae7-12d4-70e1-a287-6d138995e38b',
    title: 'Express服务端架构、PG数据表设计与自动入库',
    desc: '创建完整PostgreSQL Schema，开发HAE数据接收端点、Fitdays定时同步任务、iGPSPORT骑行记录解析器。'
  },
  {
    prefix: '09_部署排查',
    id: '01a14b58-b3ed-7801-8bca-fa6859f45763',
    title: '本地容器化部署、联调测试与Bug修复',
    desc: '构建Docker镜像，启动前后端联调，修复指标聚合时区偏差、路由空指针异常与前端图表刷新问题。'
  },
  {
    prefix: '10_持久化改造',
    id: '01a14e48-5960-7691-af2c-c58de16f5f11',
    title: '全量持久化改造、零Env开箱即用与v0.0.3发布',
    desc: '重构docker-compose支持纯字面量输入，将PG库、归档数据、日志文件、冷备SQL全量挂载到宿主机，发布v0.0.3。'
  },
  {
    prefix: '11_反代与向导',
    id: '01a14eba-4e20-7fb1-9fe2-8ac43c900b3d',
    title: '公网反向代理排查、首次使用向导与v0.0.4发布',
    desc: '排查域名反代端口与访问问题，打造首次启动安装向导Wizard、空白状态提示与HAE实时连接诊断，发布v0.0.4。'
  },
  {
    prefix: '12_全量迁移',
    id: '01a14ef4-6dca-7813-a109-83416f2680f3',
    title: '项目全量打包、对话上下文导出与无缝迁移',
    desc: '完整归档代码、数据、配置、数据库快照、历史会话与恢复提示词，实现新机器Codex一键接管。'
  }
];

async function main() {
  console.log('[History Export] Scanning session files in', SESSIONS_DIR);
  const allFiles = scanDir(SESSIONS_DIR);
  console.log(`[History Export] Found ${allFiles.length} total jsonl session files.`);

  const sessionIndex = [];

  for (const item of KNOWN_SESSIONS) {
    const matchedFiles = allFiles.filter(f => f.includes(item.id));
    if (matchedFiles.length === 0) {
      console.warn(`[Warn] No session file found for ID ${item.id}`);
      continue;
    }

    console.log(`[Processing] ${item.prefix}: ${item.title} (${matchedFiles.length} files)`);

    // Copy raw jsonl files
    for (const src of matchedFiles) {
      const dest = path.join(OUT_RAW_DIR, path.basename(src));
      fs.copyFileSync(src, dest);
    }

    // Parse messages across matched files (main + continuation subthreads)
    const turns = [];
    let sessionMeta = null;

    for (const src of matchedFiles) {
      const rl = readline.createInterface({ input: fs.createReadStream(src), crlfDelay: Infinity });
      for await (const line of rl) {
        try {
          const obj = JSON.parse(line);
          if (obj.type === 'session_meta' && !sessionMeta) {
            sessionMeta = obj.payload;
          }
          if (obj.type === 'response_item') {
            const p = obj.payload;
            if (p?.role === 'user') {
              const raw = (p.content || []).map(c => c.text || '').join('');
              const cleaned = cleanUserText(raw);
              if (cleaned) {
                turns.push({ role: 'User', text: cleaned, timestamp: obj.timestamp || '' });
              }
            } else if (p?.role === 'assistant') {
              const raw = (p.content || []).map(c => c.text || '').join('');
              if (raw.trim()) {
                turns.push({ role: 'Codex', text: raw.trim(), timestamp: obj.timestamp || '' });
              }
            }
          }
        } catch (e) {}
      }
    }

    // Merge adjacent same-role turns if any
    const mergedTurns = [];
    for (const t of turns) {
      if (mergedTurns.length > 0 && mergedTurns[mergedTurns.length - 1].role === t.role) {
        mergedTurns[mergedTurns.length - 1].text += '\n\n' + t.text;
      } else {
        mergedTurns.push({ ...t });
      }
    }

    // Write Markdown transcript
    const mdLines = [
      `# ${item.title}`,
      ``,
      `> **阶段标识**：${item.prefix}  `,
      `> **会话 ID**：\`${item.id}\`  `,
      `> **创建时间**：${sessionMeta?.timestamp || '2026-10-18'}  `,
      `> **使用模型**：\`${sessionMeta?.model || 'gpt-5 / codex'}\`  `,
      `> **工作目录**：\`${sessionMeta?.cwd || 'C:\\Users\\wangheqiang\\Documents\\ChatGPT\\健康面板'}\`  `,
      ``,
      `## 阶段背景与核心目标`,
      ``,
      item.desc,
      ``,
      `---`,
      ``,
      `## 对话详细记录`,
      ``
    ];

    let turnIdx = 1;
    for (const t of mergedTurns) {
      if (t.role === 'User') {
        mdLines.push(`### 👤 提问 #${turnIdx}`);
        mdLines.push(``);
        mdLines.push(t.text);
        mdLines.push(``);
      } else {
        mdLines.push(`### 🤖 Codex 回复 #${turnIdx}`);
        mdLines.push(``);
        mdLines.push(t.text);
        mdLines.push(``);
        mdLines.push(`---`);
        mdLines.push(``);
        turnIdx++;
      }
    }

    const transcriptFile = path.join(OUT_TRANSCRIPTS_DIR, `${item.prefix}_${item.title.replace(/[\/\\:*?"<>|]/g, '_')}.md`);
    fs.writeFileSync(transcriptFile, mdLines.join('\n'), 'utf8');

    sessionIndex.push({
      prefix: item.prefix,
      id: item.id,
      title: item.title,
      desc: item.desc,
      turnCount: mergedTurns.length,
      file: path.basename(transcriptFile)
    });
  }

  // Generate SESSION_INDEX.md
  const indexLines = [
    `# 📜 健康面板项目开发会话全记录索引 (Codex Session Index)`,
    ``,
    `本项目从最初的概念构想、数据逆向、数据库架构设计，到全量持久化改造与首次启动向导开发，全部历程完整记录如下。`,
    `每个阶段均包含原始会话 JSONL 文件（存放在 \`raw_sessions/\`）与格式化的人机可读 Markdown 记录（存放在 \`transcripts/\`）。`,
    ``,
    `| 阶段 | 主题 | 会话 ID | 对话轮次 | 详细记录文件 |`,
    `| :--- | :--- | :--- | :---: | :--- |`
  ];

  for (const s of sessionIndex) {
    indexLines.push(`| **${s.prefix}** | ${s.title} | \`${s.id.slice(0, 8)}...\` | ${s.turnCount} | [${s.file}](./transcripts/${encodeURIComponent(s.file)}) |`);
  }

  indexLines.push(``);
  indexLines.push(`## 各阶段要点说明`);
  indexLines.push(``);
  for (const s of sessionIndex) {
    indexLines.push(`### ${s.prefix}. ${s.title}`);
    indexLines.push(`- **阶段 ID**：\`${s.id}\``);
    indexLines.push(`- **核心概述**：${s.desc}`);
    indexLines.push(`- **阅读入口**：[查看完整对话记录](./transcripts/${encodeURIComponent(s.file)})`);
    indexLines.push(``);
  }

  fs.writeFileSync(path.join(path.resolve('codex_context'), 'SESSION_INDEX.md'), indexLines.join('\n'), 'utf8');
  console.log('[History Export] Successfully generated SESSION_INDEX.md and all transcripts!');
}

main().catch(err => {
  console.error('[History Export] Error:', err);
  process.exit(1);
});
