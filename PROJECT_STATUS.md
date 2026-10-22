# 📊 健康面板 (Health Dashboard) - 完整项目状态报告 (v1.0.0)

## 1. 核心模块与实现状态

| 模块 / 组件 | 技术栈 | 状态 | 说明 |
| :--- | :--- | :---: | :--- |
| **仪表盘总览 (Overview)** | React 19 + Tailwind v4 | ✅ 100% | 包含运动三环、今日核心指标、心率静息与最大值、睡眠简报与快捷同步卡片 |
| **体征走势 (Metrics Trend)** | Lucide + Recharts / SVG | ✅ 100% | 支持步数、活动能量、心率范围、静息心率、HRV（心率变异性）日/周/月跨度查看 |
| **睡眠分析 (Sleep)** | Framer Motion + TS | ✅ 100% | 支持核心睡眠、深度睡眠、REM 快速眼动与清醒时间分期对比与规律性评分 |
| **身体成分 (Body Composition)** | Fitdays API + Fastify | ✅ 100% | 13+ 整身指标、五部位肌脂、20 kHz / 100 kHz 双频阻抗与历史趋势 |
| **运动记录与骑行 (Workouts)** | iGPSPORT API + HAE | ✅ 100% | 独立数据库查询、日期筛选、FIT 遥测回放、IF/NP/TSS/左右平衡、单次活动完整明细 |
| **数据管道 (Ingestion Pipelines)**| Fastify + Adm-Zip + Zod | ✅ 100% | 支持 Health Auto Export (JSON/Zip/GPX)、Fitdays 定时拉取、iGPSPORT 批量同步 |
| **首次启动向导 (Onboarding)** | React Modal + Wizard | ✅ 100% | 自动检测零数据状态，提供交互式 3 步向导引导配置 HAE、体脂秤与骑行码表 |
| **实时诊断面板 (Live Diagnostics)**| API Health Endpoint | ✅ 100% | 实时检测 Webhook 连通性、最近同步包大小、时间戳与解析耗时 |
| **本地全量持久化 (Persistence)** | Docker Volume Mount | ✅ 100% | PG 数据、归档原始数据、冷备 SQL、运行日志全量宿主机挂载（适配 NAS） |
| **数据库自动备份 (Auto Backup)** | pg_dump + Gzip + Cron | ✅ 100% | 每天凌晨全量导出至 `data/backups/manual_*.sql.gz`，支持单指令一键还原 |

---

## 2. 数据库表架构设计 (PostgreSQL)

数据库由 `server/migrations/001_init.sql` 至 `009_body_quality_ignore.sql`
自动初始化，当前核心表为：

1. `data_sources`：数据源开关、账号、加密密码、Cron 与同步状态
2. `daily_summaries`：按天聚合的健康摘要 JSON
3. `health_metric_points`：HAE 原始指标点
4. `health_workouts`：HAE 运动记录
5. `hae_imports`：HAE 导入批次与原始载荷
6. `body_measurements`：Fitdays 每次体测记录，支持同一天多次测量
7. `cycling_activities`：iGPSPORT/FIT 骑行活动与轨迹元数据
8. `sync_runs`：手动与定时同步任务日志
9. `source_archive_files`：原始来源归档文件索引
10. `app_settings`：加密保存的 HAE Key、面板密码哈希、默认会话有效期与保留策略
11. `dashboard_sessions`：服务端登录会话与过期时间（不保存明文 token）
12. `import_batches`：各来源导入批次、原始/标准化计数、耗时与失败原因
13. `health_raw_records`：逐条原始健康对象与完整 JSON/XML 载荷
14. `health_samples`：跨来源统一时序样本，按自然键保存最新修正值
15. `data_tombstones`：手动删除与自动异常记录的同步忽略规则及恢复快照
16. `hae_api_keys`：多设备 HAE Webhook API Key、备注、启停与最近使用信息

---

## 3. 测试与验证报告

- **构建验证**：前端 `pnpm build` 与服务端 `tsc` 校验 100% 通过，类型检查无错误。
- **代码规范**：通过 `oxlint` 快速代码质量扫描。
- **数据真实性**：HAE、Apple Health ZIP、FIT 与体脂详情均不再填充固定模拟值；缺数据时显示空状态。
- **访问控制**：scrypt 密码哈希、本地明文密码找回文件、HttpOnly 会话 Cookie、配置中心可调保持时长；HAE Webhook 使用独立 `X-Api-Key`。
- **FIT 解析**：使用 `@garmin/fitsdk` 解析实际会话、功率、心率、踏频、速度、左右平衡、GPS 与逐点遥测。
- **真实数据回归**：冷备恢复后验证 `273` 次体测、`65` 次骑行、`78` 条统一训练记录；`65/65` 条骑行 FIT 已回填 GPS 轨迹。
- **原始层回归**：Apple Health ZIP 重复导入保持幂等；28 MB HAE 样例完整写入 `34,381` 条原始对象，HAE 同时间修正值按最新导入覆盖。
- **遥测回归**：10 月 18 日骑行解析出 `907` 个轨迹点与 `907` 帧遥测；IF `1.05`、NP `210 W`、TSS `55.9`、左右平衡 `49/51`。
- **界面回归**：本地浏览器验证睡眠分期悬停读数、身体详情周期趋势、最高/最低点标注、悬浮层层级、心率十字导航与训练心率区间数据源说明。
- **v0.0.16 本地副本回归**：使用最新 PostgreSQL 冷备恢复独立测试库，验证真实解剖身体详情、数据审计删除、HAE 多设备 API 管理及训练 emoji 展示。
- **v1.0.0 正式版回归**：验证 Fitdays 全量/增量同步、SUID 档案选择、不完整体测自动忽略与误删恢复、身体指标对比卡片、趋势小窗十字导航、Apple 健康运动心率恢复采样，以及地图 HTTP 代理和服务端瓦片缓存。
- **容器镜像**：
  - 官方 Hub 镜像：`wangheqiang/health-dashboard:1.0.0`（多平台构建，体积优化）
  - 本地容器运行：已通过持续健康检查 (`healthy`)，内存开销 < 80MB。
- **网络穿透与反代**：支持 Nginx Proxy Manager 反向代理，支持自定义端口及安全 HTTPS 协议。
