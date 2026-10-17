# Apple Health × Grow · 私有化健康数字大屏

iOS 健康、Apple Watch、Fitdays 体脂秤与 iGPSPORT 码表的本地数据中枢。前端使用 React + Vite，后端使用 Fastify + PostgreSQL，整个项目由 Docker Compose 启动。

当前版本：**v0.0.1**

- GitHub：<https://github.com/wangheqiang530/health-dashboard>
- Docker Hub：`wangheqiang/health-dashboard`

## 架构

```text
iPhone / HAE ── REST Webhook ──┐
Fitdays 云端 ── Cron 拉取 ─────┼── Fastify API ── PostgreSQL
iGPSPORT 云端 ── Cron 拉取 ────┘        │
                                        └── React 静态站点
```

- **PostgreSQL 16**：保存原始导入、标准化指标、训练、身体测量、骑行活动与页面聚合。
- **Fastify API**：配置管理、HAE Webhook、定时同步、同步任务记录与看板查询。
- **node-cron**：进程内调度器。Cron 从数据库恢复，修改配置后立即重载。
- **AES-256-GCM**：Fitdays/iGPSPORT 密码和 HAE 接收密钥加密后入库。
- **单应用容器**：生产环境同时提供 `/api/*` 和前端静态文件，减少 NAS 上的容器数量。

## 本机启动

1. 创建环境文件并替换其中所有随机值：

```powershell
Copy-Item .env.example .env
```

2. 启动 PostgreSQL 和应用：

```powershell
docker compose up -d --build
```

3. 打开：

```text
http://localhost:8443
```

也可以直接运行已发布镜像：

```powershell
docker pull wangheqiang/health-dashboard:0.0.1
```

容器状态与日志：

```powershell
docker compose ps
docker compose logs -f app
docker compose logs -f db
```

PostgreSQL 只映射到宿主机 `127.0.0.1:5433`，数据库名 `health_dashboard`，用户 `health`。密码来自 `.env`。

如果宿主机通过本地代理访问 Docker Hub 或外部健康服务，可在 `.env` 中配置容器代理：

```dotenv
CONTAINER_HTTP_PROXY=http://host.docker.internal:10808
CONTAINER_HTTPS_PROXY=http://host.docker.internal:10808
CONTAINER_NO_PROXY=localhost,127.0.0.1,db
```

没有代理时保持为空即可。

## 配置数据源

进入网页的 **配置中心 → PostgreSQL 数据管道**。

### Fitdays 体脂秤

填写登录账号、密码、档案 SUID（留空则使用账号当前档案）、回看天数和 Cron。首次保存后密码密文入库，后续留空密码即可保留原密码。

### iGPSPORT 码表

填写登录账号、密码、每次拉取活动数量和 Cron。FIT 文件保存到：

```text
data/igpsport_fits/
```

### Cron 示例

调度时区由 `.env` 的 `TZ` 决定，默认 `Asia/Shanghai`。

```text
15 */6 * * *     每 6 小时的第 15 分钟
0 8 * * *        每天 08:00
30 7 * * 1-5     工作日 07:30
```

保存配置后可以点击“立即同步”。任务异步执行，状态会写入 `sync_runs`，网页显示结果和最近错误。

每个来源都有“测试连接”按钮：

- Fitdays/iGPSPORT 会实际登录云端并读取一条最近数据，不会写入数据库。
- HAE 会检查 Webhook 最近接收记录和本地归档目录写入权限。

## 来源备份与保留期

三个来源的数据都遵循同一顺序：

```text
云端/Webhook 元数据 → 本地 gzip 备份 → 导入 PostgreSQL
```

备份目录：

```text
data/archive/hae/
data/archive/fitdays/
data/archive/igpsport/
data/archive/igpsport/fits/
```

配置中心可以设置备份文件保留天数。超过期限时，只删除本地 gzip 备份和 FIT 文件，PostgreSQL 中的历史数据不会删除。备份文件可以在配置中心直接下载。

## Health Auto Export

1. 在 iPhone 上打开 Health Auto Export。
2. 新建 REST API 自动化。
3. 在配置中心复制 Webhook URL 和 `X-Api-Key`。
4. 选择需要导出的健康指标与 Workouts，启用后台自动导出。

Webhook：

```text
POST /api/v1/health-auto-export
X-Api-Key: <配置中心中显示的密钥>
Content-Type: application/json
```

如果浏览器当前使用 `localhost` 打开页面，复制出的 URL 不能从 iPhone 访问。请改用电脑的局域网 IP 打开网页，例如：

```text
http://192.168.1.20:8443
```

也可以设置：

```dotenv
PUBLIC_BASE_URL=http://192.168.1.20:8443
```

一次 HAE 导入会同时写入：

- `source_archive_files`：本地 gzip 备份索引、校验值、大小和过期状态。
- `hae_imports`：HAE 原始 JSON 与导入摘要。
- `health_metric_points`：标准化指标点。
- `health_workouts`：HAE 训练。
- `daily_summaries`：前端每日聚合。

网页也支持手动导入 HAE JSON 文件；导入会先写 PostgreSQL，再刷新看板。

## API

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/health` | 应用与数据库健康检查 |
| `GET` | `/api/v1/dashboard` | 看板聚合数据 |
| `GET` | `/api/v1/config` | 数据源、HAE 参数和数据库计数 |
| `GET` | `/api/v1/version` | 当前版本与 Docker Hub 新版本检查 |
| `PUT` | `/api/v1/config/sources/:sourceId` | 保存 Fitdays/iGPSPORT 配置 |
| `POST` | `/api/v1/config/sources/:sourceId/test` | 测试三个来源连接 |
| `POST` | `/api/v1/config/sources/:sourceId/sync` | 立即同步 |
| `PUT` | `/api/v1/config/storage` | 设置备份文件保留天数 |
| `POST` | `/api/v1/health-auto-export` | HAE Webhook |

`sourceId` 可取 `hae`、`fitdays` 或 `igpsport`；同步接口只接受后两者。

## 数据库备份

```powershell
docker compose exec -T db pg_dump -U health -d health_dashboard -Fc > health-dashboard.dump
```

恢复：

```powershell
docker compose exec -T db pg_restore -U health -d health_dashboard --clean --if-exists < health-dashboard.dump
```

持久化卷：

```text
health-dashboard_health_pgdata
data/
```

删除容器不会删除这两处数据；不要随意执行 `docker compose down -v`。

## 本地开发

只启动数据库：

```powershell
docker compose up -d db
```

本地 `.env` 中设置：

```dotenv
DATABASE_URL=postgresql://health:<POSTGRES_PASSWORD>@localhost:5433/health_dashboard
```

分别启动 API 与 Vite：

```powershell
pnpm dev:api
pnpm dev
```

Vite 会把 `/api` 代理到 `http://127.0.0.1:8080`。

构建与检查：

```powershell
pnpm build
pnpm lint
```

## 自动发布

`.github/workflows/docker-publish.yml` 会在推送 `v*` 标签时构建并推送 Docker Hub 镜像。仓库需要配置：

```text
DOCKERHUB_USERNAME
DOCKERHUB_TOKEN
```

版本徽标显示 `package.json` 中的当前版本，并通过 Docker Hub 标签检查是否有新版本。

## 安全边界

- HAE 接收接口使用 `X-Api-Key` 鉴权。
- 数据源密码和 HAE 密钥使用 `APP_ENCRYPTION_KEY` 加密。更换该密钥后，旧密文无法解密。
- 配置接口没有内置用户登录，默认只适合可信局域网。若通过公网反向代理访问，必须在反向代理层增加 HTTPS 和身份认证。
- `.env`、个人健康 JSON、FIT 文件与 `data/` 已加入 `.gitignore`，不要提交到代码仓库。
