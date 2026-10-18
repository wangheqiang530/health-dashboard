# 📦 健康面板 - 跨电脑迁移与恢复指南 (Migration Guide)

本指南指导你将本项目完整迁移至另一台电脑（无论是 Windows、macOS 还是 Linux），并在新电脑上直接通过 Codex 或 Docker 恢复所有数据与运行环境。

---

## 目录包含内容清单

迁移压缩包解压后包含：

1. **项目源码与构建配置**：`src/`、`server/`、`scripts/`、`package.json`、`vite.config.ts`、`Dockerfile`、`docker-compose.yml`
2. **完整数据资产 (data/)**：
   - `data/backups/latest_health_dashboard_dump.sql.gz`（最新全量 PostgreSQL 导出文件）
   - `data/archive/`（Fitdays、HAE、iGPSPORT 历史原始同步包）
   - `data/apple_health_raw/`（iPhone 全量健康导出 XML 及轨迹）
   - `data/postgres/`（本地数据库底层存储目录）
   - `igpsport_fits/`、`fitdays_latest_data.json`、`igpsport_rides_summary.json`
3. **真实配置与凭证**：`.env` 与 `.env.example`
4. **全套历史对话记录 (codex_context/)**：
   - `codex_context/SESSION_INDEX.md`：12 阶段完整会话索引
   - `codex_context/transcripts/`：格式化 Markdown 对话记录
   - `codex_context/raw_sessions/`：原始 Codex session JSONL 文件
5. **Codex 接管配置**：`CODEX.md`、`CONTINUE_PROMPT.md`、`PROJECT_STATUS.md`

---

## 步骤 1：在新电脑上解压并放置工作目录

将压缩包解压到你希望存放的任意目录，例如：
- Windows: `D:\Projects\健康面板` 或 `C:\Users\<你的用户名>\Documents\ChatGPT\健康面板`
- macOS / Linux: `~/Projects/health-dashboard`

---

## 步骤 2：在新电脑上启动 Codex 接手

1. 打开新电脑上的 **Codex (Desktop)**。
2. 选择 **Open Folder / 打开文件夹**，选中刚刚解压的 `健康面板` 目录。
3. 打开根目录下的 `CONTINUE_PROMPT.md`，复制其中的提示词，发送给 Codex。
4. Codex 会自动读取 `CODEX.md`，完成环境与上下文接管，并汇报项目状态！

---

## 步骤 3：启动 Docker 服务（两种方式）

### 方式 1：直接运行 Docker Compose（最省心）
```bash
docker compose up -d
```
启动后访问：`http://localhost:8443` 即可进入面板！

### 方式 2：如果新电脑是全新数据库需要导入备份
若新电脑上的 PostgreSQL 容器刚刚初始化，只需在项目根目录下运行一键恢复指令：
```bash
pnpm run restore:db
```
脚本会自动读取 `data/backups/latest_health_dashboard_dump.sql.gz`，5 秒内将所有用户数据、体征指标、睡眠分期、体脂记录和骑行轨迹恢复至数据库！

---

## 步骤 4：在 iPhone 或外部服务中更新同步地址（如需要）

如果新电脑的内网 IP 发生了变动：
1. 打开 iPhone 上的 **Health Auto Export** App。
2. 进入自动化（Automations）或同步设置，将 URL 修改为新机器 IP 或你在公网配置的域名（如 `https://health.mrwoo.cn:53000/api/hae`）。
3. 点击测试，即可继续无缝自动上传！
