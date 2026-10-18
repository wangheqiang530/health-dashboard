# 📊 健康面板 (Health Dashboard) - 完整项目状态报告 (v0.0.6)

## 1. 核心模块与实现状态

| 模块 / 组件 | 技术栈 | 状态 | 说明 |
| :--- | :--- | :---: | :--- |
| **仪表盘总览 (Overview)** | React 19 + Tailwind v4 | ✅ 100% | 包含运动三环、今日核心指标、心率静息与最大值、睡眠简报与快捷同步卡片 |
| **体征走势 (Metrics Trend)** | Lucide + Recharts / SVG | ✅ 100% | 支持步数、活动能量、心率范围、静息心率、HRV（心率变异性）日/周/月跨度查看 |
| **睡眠分析 (Sleep)** | Framer Motion + TS | ✅ 100% | 支持核心睡眠、深度睡眠、REM 快速眼动与清醒时间分期对比与规律性评分 |
| **身体成分 (Body Composition)** | Fitdays API + Fastify | ✅ 100% | 体重、BMI、体脂率、骨骼肌率、水分率、内脏脂肪、骨量、身体年龄等 13+ 指标追踪 |
| **运动记录与骑行 (Workouts)** | iGPSPORT API + HAE | ✅ 100% | 骑行里程、爬升高度、均速、踏频、运动消耗，集成单次活动明细与路线元数据 |
| **数据管道 (Ingestion Pipelines)**| Fastify + Adm-Zip + Zod | ✅ 100% | 支持 Health Auto Export (JSON/Zip/GPX)、Fitdays 定时拉取、iGPSPORT 批量同步 |
| **首次启动向导 (Onboarding)** | React Modal + Wizard | ✅ 100% | 自动检测零数据状态，提供交互式 3 步向导引导配置 HAE、体脂秤与骑行码表 |
| **实时诊断面板 (Live Diagnostics)**| API Health Endpoint | ✅ 100% | 实时检测 Webhook 连通性、最近同步包大小、时间戳与解析耗时 |
| **本地全量持久化 (Persistence)** | Docker Volume Mount | ✅ 100% | PG 数据、归档原始数据、冷备 SQL、运行日志全量宿主机挂载（适配 NAS） |
| **数据库自动备份 (Auto Backup)** | pg_dump + Gzip + Cron | ✅ 100% | 每天凌晨全量导出至 `data/backups/manual_*.sql.gz`，支持单指令一键还原 |

---

## 2. 数据库表架构设计 (PostgreSQL)

已在 `server/db/schema.ts` 中定义并由自动化 Migration 初始化，包含 8 张核心表：

1. `users`: 用户表（支持单用户与未来多用户扩展）
2. `metrics_daily`: 每日汇总体征指标（步数、总卡路里、站立时长、静息心率、平均 HRV）
3. `metrics_samples`: 高频时序采样点（每分钟/每小时心率、血氧、体温、分期数据）
4. `sleep_sessions`: 睡眠会话表（入睡时间、醒来时间、各睡眠阶段详细时长）
5. `body_composition`: 体脂秤全量身体成分记录（关联 Fitdays 数据）
6. `workouts`: 运动健身记录（跑步、骑行、徒步、力量训练等）
7. `workout_routes`: 运动 GPS 轨迹路线数据（经纬度坐标序列、海拔剖面）
8. `sync_logs`: 各数据源的历史同步日志（包大小、耗时、状态、错误信息）

---

## 3. 测试与验证报告

- **构建验证**：前端 `pnpm build` 与服务端 `tsc` 校验 100% 通过，类型检查无错误。
- **代码规范**：通过 `oxlint` 快速代码质量扫描。
- **容器镜像**：
  - 官方 Hub 镜像：`wangheqiang/health-dashboard:0.0.6`（多平台构建，体积优化）
  - 本地容器运行：已通过持续健康检查 (`healthy`)，内存开销 < 80MB。
- **网络穿透与反代**：支持 Nginx Proxy Manager 反向代理，支持自定义端口及安全 HTTPS 协议。
