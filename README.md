# 🏃 Health Dashboard · 个人私有健康数字中枢

> **“告别数据孤岛与付费云壁垒，让你的心率、体脂与骑行轨迹，100% 真正属于你自己。”**

[![Docker Image Version](https://img.shields.io/badge/docker%20image-v1.0.0-blue?logo=docker)](https://hub.docker.com/r/wangheqiang/health-dashboard)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)]()
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue.svg)]()

一款专为极客、运动爱好者与 NAS 玩家打造的**开源私有化健康数据看板**。完美融合 **Apple Fitness 三环美学** 与 **Grow Bento 风格**，无缝聚合 Apple Watch、Fitdays (沃莱) 智能体脂秤与 iGPSPORT (迹驰) 骑行码表全量时序数据，实现从采集、解析、图表可视化到物理持久化的全流程闭环。

![综合看板预览](docs/images/overview.png)

## 🆕 v1.0.0 正式版

- **同步体验正式版**：同步参数与结果统一中文化，Fitdays 支持从弹窗直接获取家庭档案 SUID；回看天数与活动数只影响增量同步，全量同步始终拉取完整历史。
- **数据质量与恢复**：手动删除记录进入忽略列表，支持误删恢复；缺少体脂、骨骼肌、水分、基础代谢或电极阻抗的不完整体测会自动忽略，避免污染看板。
- **身体详情重构**：所有可读体测指标均可作为卡片展示，支持排序和显隐；每张卡提供昨日与七日均值对比，箭头方向表示数值升降，颜色表示好坏。
- **趋势体验修复**：身体指标趋势小窗支持最高/最低值标注、十字导航和均值虚线，修复宽容器下鼠标与十字线错位。
- **运动心率增强**：读取 Apple 健康逐点心率与训练后恢复采样，室内骑行等无 GPS 运动也能展示真实心率曲线。
- **地图网络代理**：GPS 瓦片统一经服务端代理与缓存，配置中心可设置仅用于地图的 HTTP/HTTPS/SOCKS 代理，适配无系统代理的 NAS 环境。
- **正式版清理**：移除独立 demo 页面、demo 构建入口与演示资源，发布链路统一到正式应用。

---

## 🆕 v0.0.16 更新

- **HAE 多设备推送 API 管理**：可为多台手机分别生成 API Key、备注设备名、禁用/恢复和删除，配置中心会展示最近使用时间与来源 IP。
- **数据审计与异常清理**：按日期查阅单条体脂秤测量或运动记录，查看上游原始字段，确认后删除并写入同步忽略表，避免后续同步回灌。
- **真实解剖身体详情**：五部位身体成分替换为真实肌肉解剖 SVG，悬停高亮、点击联动与肌脂/阻抗趋势保持一致。
- **训练卡路里 emoji**：食物等价展示统一为 emoji，移除名称和数量文字，仅使用 emoji 作为食物衡量。
- **趋势探针修复**：修复分段肌脂趋势十字导航在宽容器下与鼠标位置错位的问题。

---

## 🆕 v0.0.15 更新

- **心率与自主神经逻辑重做**：24H 曲线改为按真实采样时间定位，不再把采样点平均铺满横轴；静息、睡眠、步行与 HRV 点击后默认进入 7 日趋势。
- **缺失值与最近实测**：当天尚未生成静息、睡眠或步行心率时，卡片展示最近 7 天内的实测值并标明来源日期；日/周趋势中的缺失日期保持空白，不再推算补齐。
- **HRV 多周期视图**：HRV 与心率共用“时段 24H / 日 7D / 周 4W”视图，支持真实时段测量、7 日均值与 4 周周均值，并显示有效记录覆盖天数。
- **身体状态容错评分**：不再要求静息心率、HRV、睡眠三项必须同时齐全；具备至少两项时即可生成参考评分，并明确显示今日实测覆盖与最近静息心率来源。
- **部署验证**：使用真实 PostgreSQL 备份完成 Docker 环境恢复、服务健康检查与页面交互回归。

---

## 🆕 v0.0.14 更新

- **浅色模式加载优化**：修复刷新页面时“正在加载健康档案”卡片硬编码深色玻璃样式的问题，加载界面自适应系统与用户的浅色/深色主题，首屏杜绝深色闪烁。
- **睡眠分析时序化与交互重构**：睡眠成分条全面重构为按夜间实际睡眠时间段一段一段的真实时序分布（超慢波睡眠周期），拒绝抹平整合；支持鼠标悬浮双向联动突出高亮对应数值方块与阶段；睡眠得分匹配 Apple 原生灵动 Emoji（✨/🌙/💤/🥱）。
- **心率与自主神经大盘重做**：重做心率卡片与周期联动图表；支持小时 (24H)、日 (7D 浮动范围条)、周 (4W 周期心肺对比) 与 HRV 自主神经压力视图；点击卡片（最新、静息、睡眠、步行、HRV、峰值）平滑联动图表高光与参考线；精准提取计算夜间睡眠心率与日间步行心率。
- **健康趋势历史跨度联动修复**：修复在健康趋势中切换历史日期后图表保持最新 21 天不变的缺陷，改为严格以选择的时间点为基准展示历史趋势走势。
- **全站日历真实绿点指示器**：彻底修复日历绿点展示逻辑，身体详情仅标注有真实体测数据的日期，综合看板与健康趋势仅标注有实际体征信号的日期，解决选中日期绿点隐退与无数据日期误标绿点问题。
- **身体详情空值与阻抗防御**：深度排查体脂秤纯重/离线未完成云端计算导致的 0 值污染问题，建立基线继承与 BMI 自算机制，防御 0% 体脂与去脂体重全满异常，身体各部位肌脂与双频阻抗保持稳健展现。

---

## 🆕 v0.0.13 更新

- **全量原始数据层**：Apple Health ZIP、HAE、Fitdays 与 iGPSPORT 均逐条保存原始对象，新增导入批次、标准化样本和幂等校验。
- **数据库导入概览**：配置中心运行日志新增“数据导入”选项卡，按时间展示渠道、导入类型、原始/标准化数量、写入状态与失败原因。
- **Fitdays 刷新竞态修复**：手动同步完成后等待看板重新读取数据库，再展示成功结果，避免体测已入库但页面暂时无数据。
- **历史占位日清理**：自动移除 1969/2017 全零占位日，健康档案天数只统计有实际信号的数据。
- **综合看板增强**：体重与体脂率悬浮展示最近 7 日折线，身体成分长条悬浮展示最近 7 日柱状趋势。
- **睡眠交互增强**：睡眠分期时间轴、分期卡片与 7 日柱状图加入鼠标悬浮微放大动画。
- **身体趋势修复**：分段肌脂和阻抗趋势跳过缺失值，不再出现异常跌至 0 的折线。
- **训练页增强**：默认最近一周，食物热量换算改为悬浮展示，日期区间统计与筛选结果保持一致。
- **GPS 轨迹升级**：轨迹按速度绿到红渐变，静止路段为黄色；v1.0.0 起底图统一经服务端代理，并支持地图专用网络代理。
- **日期快速跳转**：综合看板、健康趋势、身体详情和体能训练均支持年/月下拉，并标记有数据的年月。

---

## ✨ 为什么选择 Health Dashboard？

* 🍏 **颜值即正义 · 原生 Apple 级交互**  
  深度还原 Apple Fitness 经典三色健身圆环合盖动画、身体状态能量电池、24 小时心率曲线与体脂秤实测身体成分。五部位双频阻抗来自 Fitdays 实测，分段肌脂明确标注为按全身总量估算。
* 💾 **全要素纯本地持久化 · NAS 深度友好**  
  摒弃难以管理的 Docker 内部匿名卷，**数据库实体文件、运行日志、每日自动压缩 SQL 冷备、采集原始流通通落盘在宿主机本地 `./data` 目录**。在群晖/威联通/Unraid 上不仅一眼可见，更支持直接文件级冷备迁移。
* 🚀 **超轻量流式解包引擎 · 轻松吞吐 G 级大包**  
  很多健康面板在导入 iPhone 官方“导出健康数据.zip”（常常解压出 800MB+ 的 XML）时容易 OOM 崩溃。本项目自研流式事件解析器，几秒内静默消化数百万行健康记录，内存占用极度克制。
* 🔄 **多端静默汇流 · 告别手动记账**  
  * **iOS 健康**：支持 Health Auto Export 自动化 Webhook 实时接收，支持全量官方 ZIP 拖拽导入；
  * **Fitdays 智能体脂秤**：云端静默抓取体重、BMI、体脂率、骨骼肌率、水分率等整身指标；同一天多次测量默认取最新一次，并可在身体详情中切换；
  * **iGPSPORT 码表**：骑行活动自动同步，不仅有里程、时速、爬升、踏频与心率区间，还自动归档原汁原味的 `.fit` 轨迹源文件。
* 🔒 **隐私至上 · 100% 数据主权**  
  没有第三方埋点，没有厂商云端分析。面板使用密码登录与 HttpOnly 会话 Cookie，HAE Webhook 使用独立 API Key；所有外部同步密码均通过 **AES-256-GCM** 加密后保存在本地数据库。

---

## ⚡ 1 分钟极速启动 (Docker Compose)

无需克隆庞大仓库，只需准备一个干净的目录与一个 `docker-compose.yml`，即可一键启动：

```yaml
name: health-dashboard

services:
  db:
    image: postgres:16-alpine
    container_name: health-dashboard-db
    restart: unless-stopped
    ports:
      - "5433:5432"
    environment:
      POSTGRES_DB: health_dashboard
      POSTGRES_USER: health
      POSTGRES_PASSWORD: "YourStrongPassword2026!" # 数据库密码（建议纯字母数字）
      TZ: Asia/Shanghai
    volumes:
      - ./data/postgres:/var/lib/postgresql/data   # 数据库物理文件直接存放在 NAS/本地目录
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U health -d health_dashboard"]
      interval: 5s
      timeout: 5s
      retries: 20
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  app:
    image: wangheqiang/health-dashboard:1.0.0
    container_name: health-dashboard-app
    restart: unless-stopped
    init: true
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://health:YourStrongPassword2026!@db:5432/health_dashboard
      APP_ENCRYPTION_KEY: efae74cfab1ed18c2473d39f62475a898e59b6b05d0ed69d07dbab4b657e1f0a # 64位十六进制密钥
      PUBLIC_BASE_URL: ""
      TZ: Asia/Shanghai
      LOG_LEVEL: info
      MAX_HAE_BYTES: 268435456     # 单次上传允许最大字节（默认 256MB，ZIP 导入支持 500MB）
      BACKUP_RETENTION_DAYS: 0     # 0 表示永久保留；正整数表示滚动保留天数
    ports:
      - "8443:8080"
    volumes:
      - ./data:/app/data           # 日志、冷备、原始文件全部持久化在本地
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8080/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 10
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 启动服务

```bash
docker compose up -d
```

启动完成后，打开浏览器访问：`http://<NAS或服务器IP>:8443`，立即体验！

首次启动时服务端会自动生成随机面板密码，保存在宿主机：

```bash
cat ./data/dashboard-password.txt
```

首次登录只提供“仅本次”和“保持登录”两个选项。登录一次后，服务端会按配置中心设置的保持时长签发 HttpOnly 会话 Cookie，有效期内访问页面不再重复验证。登录后可在配置中心修改密码；当前明文密码始终同步到 `data/dashboard-password.txt` 供本地找回。也可以在 Compose 中通过可选的 `DASHBOARD_PASSWORD` 指定首次密码。HAE Webhook 使用另一把独立密钥。

---

## 📂 本地持久化文件全景 (NAS Directory Structure)

项目所有的运行时核心状态、数据库实体、日常抓包流与历史备份都规整地落在本地 `./data` 目录下，结构一目了然：

```text
./data/
├── postgres/        # PostgreSQL 数据库物理文件（数据表、索引、WAL 日志，换机直接拷贝走）
├── logs/            # 应用运行日志与错误输出（app.log，自带 10MB 自动轮转防护）
├── backups/         # 数据库定时 SQL 快照（每日 03:15 自动生成 .sql.gz 冷备）
├── dashboard-password.txt # 当前面板密码的本地明文找回文件（0600 权限）
├── archive/         # 各数据源抓取到的原始数据报文（默认永久保留）
│   ├── hae/         # iOS 导入的原始 JSON/ZIP
│   ├── fitdays/     # 沃莱云端每次拉取的原始 JSON.gz
│   └── igpsport/    # 码表原始活动报文与 .fit 轨迹原件
├── map-tiles/       # 地图瓦片服务端缓存（OSM / CARTO，无需 API Key）
└── temp_unzip/      # 大包解析临时解压池（解析完毕即刻自动清理，零空间残留）
```

---

## 📱 数据源接入指引

系统启动后，在右上角进入 **设置中心 (Settings)** 即可直观配置各数据源：

### 1. iOS 苹果健康
* **自动化无感上报**：在 iPhone 安装 *Health Auto Export* App，设置 REST API Webhook 地址为 `http://<你的IP>:8443/api/v1/health-auto-export`，在 `X-Api-Key` Header 填入配置中心展示的专属 API Key；
* **历史全量导入**：在 iPhone“健康”App 点击右上角头像 ➔“导出所有健康数据”➔ 将生成的 `导出.zip` 在看板设置页直接点击“导入苹果健康 ZIP 包”，系统会逐条保存原始对象与标准化样本，并重建多年历史汇总。

### 2. Fitdays (沃莱) 智能体脂秤
* 填入 Fitdays App 的账号与密码，系统内嵌 AES 加密保护；
* 默认每 6 小时自动查询一次最新称重记录，支持立即测试连接并全量拉取。

### 3. iGPSPORT (迹驰) 骑行码表
* 填入 iGPSPORT 账号密码，定时静默抓取最新骑行活动；
* 自动下载活动对应的原始 `.fit` 轨迹并结构化提取功率、踏频、心率区间与海拔高度。

---

## 🛠️ 进阶管理与脚本工具

项目内置开箱即用的运维脚本，可以在容器内或本地终端中随时使用：

```bash
# 立即手动执行一次数据库完整快照（生成压缩 .sql.gz 至 ./data/backups/）
docker exec health-dashboard-app pnpm backup:db

# 实时查看后端运行日志
docker compose logs -f app

# 也可以直接在宿主机打开日志文件实时排查
tail -f ./data/logs/app.log
```

---

## 💡 常见问题 (FAQ)

* **Q：复杂密码包含特殊字符怎么办？**  
  A：在 `docker-compose.yml` 或 `.env` 中用双引号包裹（如 `POSTGRES_PASSWORD: "MyPassword2026!"`）。如果密码中包含 `$`，需写成 `$$` 转义，连接串中若含有 `@` 或 `:` 请注意做 URL 编码；最推荐使用 32 位以上的纯字母数字随机字符串，高强度且零语法冲突。
* **Q：在 NAS 上怎么对外暴露？**  
  A：支持反向代理（Nginx Proxy Manager / Traefik / 群晖内置反代）。将域名或子路径反代至容器的 `8443` 端口即可，可开启 HTTPS。

---

## 🤝 参与贡献

欢迎提交 Issue 或 Pull Request！未来规划支持 Garmin、Keep、迈金 (Magene) 等更多运动健康设备生态接入。如果你喜欢这个项目，欢迎点一颗 ⭐️ Star 支持！

**MIT License © 2026 wangheqiang**

### 5. 配置中心与数据管道 (Config Center)
配置中心提供完整的后端管理与个性化控制：
- **官方导出 ZIP 一键导入**：直接上传 iPhone「健康」App 导出的 `导出.zip`，流式解析数百 MB XML，逐条保存 `Record`、`Workout`、`ActivitySummary`、`Correlation` 原始对象与标准化样本。
- **Health Auto Export 自动化 Webhook**：提供局域网 REST URL 与密钥，支持自动推送。
- **Fitdays & iGPSPORT 定时同步**：配置 Cron 定时器，凭据 AES-256-GCM 密文入库，支持测试连通性与立即同步。
- **本地来源备份管理**：默认永久保留，支持随时调整保留期、下载备份包或单项手动删除。
- **GPS 轨迹回放**：浏览器直连 OpenStreetMap / OpenTopoMap 免费瓦片，无需 API Key；轨迹按实时速度从绿色渐变到红色，静止路段显示黄色。
- **多视图日期导航**：综合看板、健康趋势、身体详情和体能训练均支持年/月下拉快速跳跃，并标记有数据的年月。
- **苹果液态玻璃与弥散流光动态调节**：实时拖动滑块自定义底色流光速度、模糊半径、玻璃饱和度与高光反射。

![配置中心](docs/images/config.png)

![ZIP包导入弹窗](docs/images/zip_import_modal.png)

---

## 快速开始

### 方式一：Docker Compose 单文件免 .env 运行 (最推荐 NAS / 群晖 / 威联通 / Unraid)

在 NAS 上的任意目录（如 `/volume1/docker/health-dashboard`）创建 `docker-compose.yml`，粘贴以下内容（配置已直接写入，**无需任何 .env 文件**）：

```yaml
name: health-dashboard

services:
  db:
    image: postgres:16-alpine
    container_name: health-dashboard-db
    restart: unless-stopped
    ports:
      - "5433:5432"
    environment:
      POSTGRES_DB: health_dashboard
      POSTGRES_USER: health
      POSTGRES_PASSWORD: HealthSecretPassword2026!
      TZ: Asia/Shanghai
    volumes:
      - health_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U health -d health_dashboard"]
      interval: 5s
      timeout: 5s
      retries: 20

  app:
    image: wangheqiang/health-dashboard:1.0.0
    container_name: health-dashboard-app
    restart: unless-stopped
    init: true
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://health:HealthSecretPassword2026!@db:5432/health_dashboard
      APP_ENCRYPTION_KEY: efae74cfab1ed18c2473d39f62475a898e59b6b05d0ed69d07dbab4b657e1f0a
      DASHBOARD_PASSWORD: ""
      PUBLIC_BASE_URL: ""
      TZ: Asia/Shanghai
      LOG_LEVEL: info
      MAX_HAE_BYTES: 268435456
      BACKUP_RETENTION_DAYS: 0
      APP_VERSION: 1.0.0
      DOCKERHUB_REPOSITORY: wangheqiang/health-dashboard
      GITHUB_REPOSITORY: wangheqiang530/health-dashboard
    ports:
      - "8443:8080"
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8080/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 10

volumes:
  health_pgdata:
```

在同级目录下执行启动（群晖 Container Manager / Portainer 用户直接在图形界面粘贴保存并启动）：

```bash
docker compose up -d
```

4. 打开浏览器访问：

```text
http://localhost:8443
```

> **提示**：初次启动时数据库默认是 0 数据的干净状态，页面将引导前往「配置中心」导入健康数据或连接数据源。

---

### 方式二：源码本地开发

```bash
# 1. 安装依赖 (Node.js >= 22)
pnpm install

# 2. 启动开发环境
pnpm dev:api   # 启动后端 API (默认 8080)
pnpm dev       # 启动 Vite 前端开发服务器 (默认 5173)

# 3. 生产打包与语法检查
pnpm build
pnpm lint
```

---

## 数据导入与源配置指南

### 1. iOS 健康 App 官方压缩包 (`导出.zip`)
1. 打开 iPhone 上的「健康」App，点击右上角个人头像。
2. 滑动到最下方，点击 **导出所有健康数据**，等待 iPhone 打包完成并生成 `导出.zip`。
3. 将 `导出.zip` 发送至电脑端。
4. 打开大屏 **配置中心 ➔ 导入 iOS 健康 App 官方导出包 (.zip)**，拖入文件点击开始导入。
5. 系统将永久保存原始压缩包，并在导入事务内逐条写入原始对象、标准化样本、训练明细与每日聚合。

### 2. Health Auto Export 实时自动推送 (Webhook)
1. 在 iPhone 安装并打开 **Health Auto Export** App。
2. 进入「Automations」页面，添加 REST API 导出任务。
3. 从配置中心复制对应的 `REST API URL`（例如 `http://192.168.1.100:8443/api/v1/health-auto-export`）与 `X-Api-Key`。
4. 勾选需要导出的所有指标与 Workouts，开启每日后台自动化同步。

### 3. Fitdays 智能体脂秤云端直连
1. 打开配置中心 ➔ **Fitdays 体脂秤** 卡片。
2. 填写注册账号（手机号）与密码。若家庭多用户，可填入主号档案 SUID（留空则自动识别当前活跃档案）。
3. 设定定时拉取 Cron 表达式（默认每 6 小时同步一次：`15 */6 * * *`）。
4. 点击 **保存配置** 并点击 **立即同步**。

### 4. iGPSPORT 骑行码表全量活动直连
1. 打开配置中心 ➔ **iGPSPORT 码表** 卡片。
2. 填写 iGPSPORT 登录手机号与密码。
3. 设定每次拉取活动数量（例如 `100`）及 Cron 定时表达式。
4. 点击 **立即同步**，系统将自动拉取所有骑行记录、踏频、功率及海拔，并自动下载归档原始 `.fit` 文件。

如果浏览器当前使用 `localhost` 打开页面，复制出的 URL 不能从 iPhone 访问。请改用电脑的局域网 IP 打开网页，例如：

```text
http://192.168.1.20:8443
---

## 环境变量说明 (`.env`)

| 环境变量 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `POSTGRES_PASSWORD` | - | PostgreSQL 数据库连接强密码 |
| `POSTGRES_PORT` | `5433` | PostgreSQL 宿主机暴露端口（供外部 AI、Dify 或客户端直连） |
| `APP_ENCRYPTION_KEY` | - | 32 字节随机 Hex 秘钥，用于加密存储数据源密码与 Webhook API Key |
| `DASHBOARD_PORT` | `8443` | 宿主机 Web 访问端口 |
| `APP_VERSION` | `1.0.0` | 当前发布的容器镜像版本号 |
| `DASHBOARD_PASSWORD` | 自动生成 | 可选的首个面板密码；当前密码始终同步到 `data/dashboard-password.txt`，登录后可在配置中心修改 |
| `BACKUP_RETENTION_DAYS` | `0` | 本地原始备份（ZIP / gzip / FIT）保留天数；`0` 表示永久保留 |
| `MAX_HAE_BYTES` | `268435456` | 请求体积上限 (256MB)，满足超大型健康导出包上传 |
| `TZ` | `Asia/Shanghai` | 系统与 Cron 调度时区 |
| `CONTAINER_HTTP_PROXY` | - | 容器内部外部同步请求的 HTTP 代理 (例如 `http://host.docker.internal:10808`) |
| `CONTAINER_HTTPS_PROXY` | - | 容器内部外部同步请求的 HTTPS 代理 |

---

## 外部调用与 AI / Agent 接入指南

本项目自带完善的 API 与标准化数据库，非常适合与本地或云端 AI（如 Dify、FastGPT、OpenAI Function Calling、n8n、Home Assistant 等）联动，实现个性化智能健康管家与自然语言查询。

### 方式一：通过 REST API 接入（推荐，最适合 AI Agent 与自动化工作流）

无需理解复杂的底层数据库表结构，直接请求清洗聚合好的 JSON 数据接口：

```bash
# 1. 使用面板密码登录，响应中的 token 可用于 Bearer 调用
curl -c cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"password":"<面板密码>","duration":"30d"}' \
  http://<NAS_IP>:8443/api/v1/auth/login

# 2. 使用会话 Cookie 或登录响应中的 token 访问数据
curl -b cookies.txt http://<NAS_IP>:8443/api/v1/dashboard
curl -H 'Authorization: Bearer <登录响应中的 token>' \
  'http://<NAS_IP>:8443/api/v1/workouts?from=2026-10-01&to=2026-10-18'
```

**场景示例**：在 Dify / FastGPT 中添加 HTTP 工具，挂载该 API，即可让大模型轻松回答：“分析我最近一周的睡眠深度与心率负荷”、“我本周骑行与力量训练的卡路里总消耗是多少并给出补剂建议”。

### 方式二：直接连接 PostgreSQL 数据库（适合数据分析、Metabase、Python、DBeaver）

默认配置已将 PostgreSQL 映射到宿主机 `5433` 端口（避免与 NAS 自带的 5432 冲突）：

- **主机 (Host)**：`NAS的局域网IP`
- **端口 (Port)**：`5433` (可通过 `.env` 中的 `POSTGRES_PORT` 更改)
- **数据库 (Database)**：`health_dashboard`
- **用户名 (User)**：`health`
- **密码 (Password)**：`.env` 中设置的 `POSTGRES_PASSWORD`

**核心数据表说明**：

| 表名 | 数据内容与用途 | 关键字段 |
| :--- | :--- | :--- |
| `daily_summaries` | 每日综合健康大屏数据（按天聚合的完整 JSONB 字段） | `day`, `summary`, `updated_at` |
| `body_measurements` | Fitdays 8 电极体测历史明细（当前样本 273 次记录） | `measured_date`, `weight_kg`, `bmi`, `body_fat_rate`, `skeletal_muscle_rate`, `visceral_fat_level`, `bmr_kcal`, `bone_mass_kg`, `raw_record` |
| `cycling_activities` | 码表骑行活动全记录（里程、踏频、功率、爬升） | `started_at`, `distance_km`, `avg_speed_kmh`, `avg_cadence`, `avg_power`, `ascent_m`, `fit_file_path` |
| `health_workouts` | 苹果健康训练明细（跑步、力量、骑行、游泳等） | `name`, `started_at`, `duration_sec`, `active_energy_kcal`, `avg_heart_rate` |
| `health_metric_points` | 高频生理指标时序采样点（心率、步数、血氧等） | `metric_name`, `recorded_at`, `local_date`, `value` |
| `import_batches` | 每次 ZIP、HAE、Fitdays、iGPSPORT 导入的批次、计数与错误状态 | `source_id`, `import_kind`, `status`, `raw_count`, `normalized_count` |
| `health_raw_records` | 所有来源逐条原始对象，保留原始 JSON/XML、内容哈希与多次出现记录 | `source_id`, `object_type`, `content_hash`, `raw_payload`, `raw_xml` |
| `health_samples` | 由原始对象生成的统一时序样本，按自然键保存最新修正值 | `source_id`, `natural_key`, `metric_name`, `start_at`, `value_num` |

---

## 路线图 (Roadmap)

- [x] iOS 健康 App 官方 `导出.zip` 流式解析与本地持久化归档
- [x] Fitdays 沃莱体脂秤整身指标、同一天多次测量切换与实测历史趋势
- [x] iGPSPORT 码表全量骑行活动、踏频、气压计爬升与原始 `.fit` 归档
- [x] 全页面历史任意日期日历选择与全屏数据联动
- [x] 交互折线图垂直十字探针与悬停数据标注
- [x] 原始归档默认永久保留、可配置滚动清理与单项手动删除
- [ ] Strava / Garmin 码表云端直连适配
- [ ] 导出 PDF 格式的体检与体态报告

---

## 安全与隐私说明

- **无外泄风险**：所有个人体征指标与运动轨迹仅存储于您自己的 PostgreSQL 数据库和本地归档目录。
- **密码与会话隔离**：面板使用 scrypt 密码哈希与随机服务端会话，浏览器 Cookie 设置 HttpOnly + SameSite=Strict；明文找回文件仅保存在宿主机数据目录并限制为 `0600`；Health Auto Export Webhook 使用独立 `X-Api-Key`。
- **敏感凭据加密**：三方数据源密码与 Webhook API Key 使用 `AES-256-GCM` 硬件级强加密落盘。
- **开源安全发布**：发布版本默认 0 数据，不含任何内置账号密码或演示测试数据。

---

## 开源协议

本项目采用 [MIT License](LICENSE) 协议开源。
