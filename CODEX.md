# 🩺 健康面板 (Health Dashboard / 人体探针) - Codex 项目接管与上下文指南

> **致接手本项目的 Codex**：
> 本文件是项目的核心全景图。当你在这台新电脑上被唤醒时，读取本文件即可完全理解项目的所有历史决策、技术选型、数据库状态、持久化路径以及当前进度。你可以直接在此基础上继续迭代开发，无需重复探索。

---

## 1. 项目基本概况

 - **当前版本**：`v0.0.15`
- **定位**：全功能私有化人体健康数据大盘（“人体探针”），基于苹果原生健康（Apple Health）精致质感设计，整合手机日常生理指标、Apple Watch 运动体征、Fitdays 智能体脂秤体成分，以及 iGPSPORT 专业骑行码表数据。
- **核心架构**：
  - **前端**：React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide React + Framer Motion
  - **后端**：Node.js 22 (TSX) + Fastify v5 + node-cron + undici
  - **数据库**：PostgreSQL 16 Alpine
  - **部署形态**：Docker Compose 容器化部署（支持纯字面量无环境依赖启动）
  - **官方镜像**：`wangheqiang/health-dashboard:0.0.15`
  - **GitHub 仓库**：`https://github.com/wangheqiang530/health-dashboard.git`

---

## 2. 核心端口与凭证配置

项目的 `docker-compose.yml` 已经过**零环境变量依赖改造**，直接通过纯字面量运行：

| 服务 | 容器名称 | 宿主机端口 | 内部端口 | 账号 / 库名 / 密码 |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | `health-dashboard-db` | `5433` | `5432` | 库: `health_dashboard` / 用户: `health` / 密码: `HealthPassword12345` |
| **Web & API** | `health-dashboard-app` | `8443` | `8080` | 加密密钥: `APP_ENCRYPTION_KEY`；密码找回文件: `data/dashboard-password.txt` |

> **外网反代说明**：
> 用户之前使用 Nginx Proxy Manager 反向代理到内网 `http://127.0.0.1:8443`，绑定公网域名 `https://health.mrwoo.cn:53000/`。

---

## 3. 持久化数据目录结构 (./data)

所有业务核心数据、日志与备份均挂载在宿主机根目录 `./data` 下（由用户 NAS/磁盘安全存储）：

```text
data/
├── dashboard-password.txt # 当前面板密码本地找回文件（0600）
├── postgres/            # PostgreSQL 16 数据库底层集群物理文件（挂载到 /var/lib/postgresql/data）
├── backups/             # 每日自动冷备及迁移快照（.sql.gz）
│   └── latest_health_dashboard_dump.sql.gz # 本次迁移的最新全量 PG 数据转储（~6MB）
├── archive/             # 历史接收原始数据完整归档（按年/月归档）
│   ├── hae/             # Health Auto Export 传入的 JSON / Zip 原始归档
│   ├── fitdays/         # 每次与 Fitdays 云端同步拉取的全量体脂指标快照
│   └── igpsport/        # iGPSPORT 骑行活动详情及 FIT 原始数据
├── apple_health_raw/    # 初始手动从 iPhone 导出的全量数据解包（含 导出.xml 及 workout-routes）
├── logs/                # 循环滚动的应用与同步日志
├── map-tiles/           # OSM / CARTO 地图瓦片服务端缓存
└── temp_unzip/          # 临时解压缓存目录（自动清理）
```

---

## 4. 三大数据源集成机制

1. **Health Auto Export (iOS App - 核心源)**
   - **端点**：`POST /api/v1/health-auto-export`
   - **传输格式**：支持 HAE V2 JSON；Apple Health 官方 ZIP 可通过配置中心单独导入
   - **鉴权**：Header `X-Api-Key` 或 `Authorization`
   - **入库**：自动解析步数、静息心率、HRV、睡眠分期、活动能量、站立时间，存入 `metrics_daily` / `metrics_samples` 表。
2. **Fitdays 智能体脂秤 (云端接口逆向)**
   - **端点**：`POST /api/fitdays/sync`（定时任务每 6 小时自动执行一次）
   - **数据结构**：提取体重、BMI、体脂率、骨骼肌率、内脏脂肪等级、身体年龄、基础代谢率等，存入 `body_composition` 表。
3. **iGPSPORT 码表 (骑行数据集成)**
   - **端点**：`POST /api/igpsport/sync`
   - **数据结构**：拉取骑行活动列表，解析距离、爬升、均速、踏频、心率，存入 `workouts` 及 `workout_routes` 表。

---

## 5. 项目已完成功能与进度 (截至 v0.0.15)

- [x] **原生苹果风格 UI**：运动三环（活动、锻炼、站立）、心率趋势、睡眠深度分期、体重与体脂曲线、骑行里程与路线轨迹图。
- [x] **首次使用向导 (First-Launch Wizard)**：初次进入或数据库为空时自动引导配置数据源，附带各数据源详细教程及快速诊断。
- [x] **零数据空状态与骨架屏**：数据未同步时友好展示空白卡片与一键检查按钮。
- [x] **HAE 实时联通诊断**：在前端设置面板展示专属 Webhook URL、密钥状态及最近一条同步记录的时间与字节数。
- [x] **自动冷备份与日志轮转**：每天凌晨自动 `pg_dump` 压缩归档至 `data/backups/`，日志按 10MB 自动轮换。
- [x] **外网反代与跨域支持**：支持任意公网反代域名及 HTTPS 协议头解析（`x-forwarded-proto`, `x-forwarded-host`）。
- [x] **面板密码与会话**：首次登录仅提供“仅本次”和“保持登录”；当前明文密码同步写入 `data/dashboard-password.txt`，配置中心可修改密码和保持时长。
- [x] **五部位身体详情**：恢复躯干、左右上肢、左右下肢的肌肉量、脂肪量与 20 kHz / 100 kHz 双频阻抗趋势。
- [x] **训练记录独立查询**：日期区间筛选与快捷选择器不再受 HAE `daily_summaries` 日期边界限制。
- [x] **FIT 遥测回填**：同步与启动回填会解析 iGPSPORT FIT 的 GPS、心率、踏频、功率、速度、左右平衡和逐点遥测。
- [x] **地图瓦片代理**：OSM / CARTO 瓦片由服务端代理并缓存，避免浏览器直连导致的空地图。
- [x] **真实数据模式**：移除所有固定回退值、模拟趋势、伪 GPS 路线与伪造 FIT 入库；缺数据显示空状态。
- [x] **体测多次测量**：同一天多次 Fitdays 测量默认取最新一次，并在身体详情提供时间/体重明细切换。
- [x] **官方三环着色器**：主圆环与七日迷你圆环共用 WebGL ActivityRingsVisual。
- [x] **真实 FIT 解析**：使用 Garmin FIT SDK 读取会话、功率、心率区间与 GPS 轨迹。
- [x] **趋势交互细化**：睡眠分期悬停读数、身体指标周期联动趋势、最高/最低点标注与心率图无点十字导航。

---

## 6. 新电脑接管启动流程 (Quick Start)

### 方案 A：Docker Compose 启动（推荐，与生产完全一致）
```bash
# 1. 进入项目根目录
cd 健康面板

# 2. 一键启动数据库与后端 Web 服务
docker compose up -d

# 3. 检查容器状态
docker compose ps

# 4. 验证服务健康
curl http://localhost:8443/api/health
```
*如果在新电脑上由于操作系统权限导致 `data/postgres` 未能直接挂载数据，只需运行：*
```bash
pnpm run restore:db
```
*脚本会自动将 `data/backups/latest_health_dashboard_dump.sql.gz` 瞬间恢复进容器！*

### 方案 B：本地 Node.js 源码开发模式
```bash
# 1. 安装依赖
pnpm install

# 2. 启动前端 Vite 开发服务器 (默认端口 5173)
pnpm dev

# 3. 启动后端 API 开发服务器 (需本地或 Docker 数据库在 5433 端口运行)
pnpm dev:api
```

---

## 7. 历史对话上下文索引

所有与用户的历史设计讨论、架构演化和代码调试记录已完整提取保存在 `codex_context/` 目录下：

- `codex_context/SESSION_INDEX.md`：12 个阶段的对话索引大纲
- `codex_context/transcripts/`：人机可读的 Markdown 格式对话详细记录
- `codex_context/raw_sessions/`：原始 Codex session JSONL 归档

当你需要了解用户对某一功能（例如体脂算法、HAE 字段过滤、UI 偏好）的具体要求时，随时查阅 `codex_context/transcripts/`。

---

## 8. 接手后的建议继续方向

1. **多用户与家庭成员支持**：目前以单用户主视角为主，可扩展多成员体脂与健康切换。
2. **运动路线地图渲染深化**：将 Leaflet/MapLibre 离线瓦片或高德地图轨迹回放组件深度集成至骑行板块。
3. **健康周报/月报 AI 总结**：利用大模型根据过去 7 天或 30 天的体征数据生成个性化作息与训练建议。
4. **移动端 PWA 离线缓存优化**：增加 ServiceWorker 与桌面添加到主屏幕支持。
