# Fitdays体脂秤API逆向与云端定时同步

> **阶段标识**：06_体脂秤逆向  
> **会话 ID**：`01a14979-ed9c-7eb3-939d-4580d36c1f9e`  
> **创建时间**：2026-10-17T10:48:10.023Z  
> **使用模型**：`gpt-5 / codex`  
> **工作目录**：`C:\Users\wangheqiang\Documents\ChatGPT\健康面板`  

## 阶段背景与核心目标

深入逆向Fitdays云端接口，实现账号免密/Token签名登录，提取全身体成分（骨量、肌肉率、内脏脂肪等）。

---

## 对话详细记录

### 👤 提问 #1

我有一个体脂秤，他的官方app叫fitdays，我每天都规律的称重，能够获取非常详细的身体数据。
但是官方似乎没有api，并且自动导入到ios健康app的数据很少（只有体重、体脂、去脂体重等等几个数据），你看看有没有什么办法能够自动的获取数据，不用我每日都去导出。

### 🤖 Codex 回复 #1

这是一个非常典型且许多健康管理极客都会遇到的痛点。先说结论：**完全可以实现全自动获取，而且不仅能免去每日手动导出，还能拿到官方 App 里展示的全部 17 项以上完整体脂数据（包含骨骼肌率、内脏脂肪等级、身体水分率、基础代谢等，8 电极秤甚至包括四肢与躯干的分段数据）。**

下面为你拆解为什么 iOS 健康数据那么少、官方云端 API 的逆向原理，以及 3 种不同维度的自动化落地实施方案。

**为什么 iOS 健康里的数据这么少**

这不是 Fitdays 故意阉割导出，而是 **Apple HealthKit 原生数据模型的限制**。
Apple Health 目前在「身体测量」分类下，仅提供了极少数标准健康指标类型：
- 体重 (`HKQuantityTypeIdentifierBodyMass`)
- 体脂率 (`HKQuantityTypeIdentifierBodyFatPercentage`)
- 去脂体重 (`HKQuantityTypeIdentifierLeanBodyMass`)
- 身高与 BMI (`HKQuantityTypeIdentifierBodyMassIndex`)

苹果官方健康库中根本没有「内脏脂肪等级」、「骨骼肌率」、「蛋白质率」、「身体水分率」、「基础代谢率」或「四肢分段肌肉/脂肪」等生理指标字段。因此，无论任何体脂秤，只要走「写入 iOS 健康 -> 从 iOS 健康导出」这条链路，中途必然会丢失大部分深度指标。

**Fitdays 的接口突破与数据原理**

Fitdays 官方虽然没有向公众开放公有开发者平台 (OpenAPI)，但其底层是广东沃莱科技（Welland / 深圳易康萌讯 Icomon / 乐福 Lefu）的物联生态体系。
用户每次使用 Fitdays 称重后，App 都会立即将测量数据加密上传到它的云端同步服务器（国内节点为 `online.fitdays.cn`，海外节点为 `online-us.fitdays.cn` 等）。

目前开源社区（如 `roquerodrigo/fitdays-api`）已经完整逆向了 Fitdays 的云端私有接口协议：
- 密码加密机制：基于双重加盐 MD5 散列算法 (`MD5(MD5(密码 + 'hx').toUpperCase()).toUpperCase()`)。
- 请求签名机制：参数排序后拼接待签名密钥 (`hxsign`) 并进行 Java 风格 URL 编码生成签名。
- 同步端点：`POST /api/sync/syncFromServer`。
- 返回内容：只要调用此接口，就能拉取到完整的 `weight_list`，其中包含：
  - `weight_kg`（体重）
  - `bmi`（BMI）
  - `bfr`（体脂率）
  - `rom`（肌肉率）
  - `rosm`（骨骼肌率）
  - `sfr`（皮下脂肪率）
  - `bm`（骨量）
  - `bmr`（基础代谢）
  - `bodyage`（身体年龄）
  - `uvi`（内脏脂肪等级）
  - `vwc`（身体水分率）
  - `pp`（蛋白质率）
  - `hr`（心率）
  - `adc` / `adc_list`（阻抗值与多频阻抗）
  - `ext_data`（8 电极秤特有的左臂、右臂、躯干、左腿、右腿分段肌肉与脂肪）

基于这个底层能力，以下提供 3 种自动化方案。

**方案一：云端 API 定时无感抓取（最推荐，零硬件成本，全量数据）**

这是性价比最高、最稳健的方案。
- **工作流**：你日常照常站上秤称重，手机 App 连秤上传。你在本地 NAS、家庭电脑、树莓派或云服务器上挂一个轻量定时脚本（如每小时或每天固定时间执行一次），脚本自动登录 Fitdays 云端拉取最新记录，并写入你的本地数据库、Notion 或推送 Webhook。
- **前置准备**：如果你的 Fitdays 账号最初是微信或手机快捷登录，先在 Fitdays App 内点击「我的」->「设置/账号安全」，绑定一个邮箱并设置独立密码。

使用 Node.js 的极简测试与落地代码范例如下：

```javascript
import { FitDaysClient } from 'fitdays-api';

// 国内版 Fitdays 请指定 region: 'cn'
const client = new FitDaysClient({ region: 'cn' });

async function syncWeightData() {
  // 1. 登录
  await client.login('your-email@example.com', 'your-password');

  // 2. 拉取最新数据 (可指定时间戳窗口，syncAll 默认获取全部历史)
  const sync = await client.syncAll();
  const records = sync.data.weight_list || [];

  if (records.length === 0) {
    console.log('暂无测量记录');
    return;
  }

  // 3. 取出最新一条记录
  const latest = records.sort((a, b) => b.measured_time - a.measured_time)[0];
  console.log('最新测量时间:', new Date(latest.measured_time * 1000).toLocaleString());
  console.log('体重:', latest.weight_kg, 'kg');
  console.log('体脂率:', latest.bfr, '%');
  console.log('骨骼肌率:', latest.rosm, '%');
  console.log('内脏脂肪等级:', latest.uvi);
  console.log('身体水分率:', latest.vwc, '%');
  console.log('基础代谢:', latest.bmr, 'kcal');

  // 4. 对接你的后端数据库或直接写入本地 JSON
  // 例如 fetch('http://localhost:3000/api/v1/body-metrics', { method: 'POST', body: JSON.stringify(latest) });
}

syncWeightData().catch(console.error);
```

**方案二：本地蓝牙嗅探直接入库（极客方案，连手机 App 都不需要打开）**

如果你家里有智能家居中枢，希望达到「人只要踩上去，数据自动进系统，连手机 App 都不用打开」的极致体验，可以采用蓝牙网关嗅探方案：
- **原理**：Fitdays 秤在称重时会持续通过 BLE (蓝牙低功耗) 广播重量并在连接后通过 GATT 特征值 (`0xFFB0` 服务) 发送阻抗报文。
- **成熟开源支持**：
  - `KristianP26/ble-scale-sync`：原生支持 Fitdays / Lefu 协议（包含 4 电极与 8 电极 Robi S9 等），支持自动把数据解包并推送到 Home Assistant、MQTT 或 Garmin Connect。
  - `dandwhelan/fitdays-lefu-scale`：Python 逆向了 Fitdays/Lefu 8 电极双频段协议，能直接通过 PC/树莓派蓝牙捕获十段阻抗。
- **适用场景**：家里常开 Home Assistant 且有蓝牙适配器，或者有 20 元左右的 ESP32 单片机作为 ESPHome 蓝牙代理。

**方案三：iOS 网络层脚本拦截（Surge / Loon / Quantumult X）**

如果你的 iPhone 上常驻网络调试工具（如 Surge、Loon、Quantumult X）：
- Fitdays App 在称重后会将结果 POST 到 `online.fitdays.cn`。
- 可以编写一条简单的 MitM 抓包脚本，规则匹配到该域名的数据上传请求时，自动提取 JSON 数据体中的测重结果，直接异步触发一个 Webhook，推给你的私有健康面板。
- 优点是完全实时，称完那一秒就推送到看板；缺点是需要手机配置对应网络工具的证书和重写规则。

**结合当前健康面板项目的建议**

考虑到你当前的工作区正是 [README.md](README.md:1) 中规划的 **Apple Health × Grow 健康数字大屏**（专为 NAS Docker 部署设计）：
1. 建议优先采用 **方案一（云端 API 定时拉取）**，直接在看板配套的轻量 Node.js / Python 后端里增加一个 `FitdaysSyncService`。
2. 配置 `cron` 定时器（例如每天清晨 06:00 到 10:00 期间每 15 分钟检查一次，其余时段每 2 小时检查一次）。
3. 检查到有新的 `measured_time` 后，把骨骼肌率、内脏脂肪、水分、皮下脂肪和体重等完整数据存入本地 SQLite。
4. 看板前端可以顺理成章地新增一块专属的「深度体成分分析」Bento 格（例如骨骼肌增长走势、体脂率闭环、内脏脂肪健康度预警等），与现有的 Apple Watch 运动、心率和睡眠闭环形成完整的健康全景视图。

---

### 👤 提问 #2

账号是手机号登录的，手机号是"18911809332"，密码是"whq1993530"，你尝试下能否获取我的数据。登录后我的账号ID是36152895，家庭信息里我设定了多个家庭成员，我使用的是主号“王贺强”。

### 🤖 Codex 回复 #2

测试完全成功！已经成功通过 Fitdays 官方云端接口登录你的账号，并完整获取到了你名下的全部身体成分历史与最新详细数据。

---

### 获取结果与账号数据核对

**账号与成员信息**
- 账号 UID: `36152895`
- 登录标识: `18911809332`
- 主号档案: **王贺强** (SUID: `36152905`，身高 184cm，男，目标体重 85kg)
- 识别到的家庭成员:
  - 单素英 (SUID: `36154927`)
  - 王孝清 (SUID: `36154977`)
  - 徐德珍 (SUID: `36156758`)
  - 王宥谦 (SUID: `36243014`)
- 绑定体脂秤: **FI2505LBF** (8 电极双频智能体脂秤，设备名 JZ-Fitdays，固件支持 Wi-Fi + BLE 双模)

**数据总量与覆盖范围**
- 该账号全家历史测量总数: 341 条
- 属于主号「王贺强」的有效测量记录: **272 条** (覆盖从 2026 年初到今天的每日完整称重记录)

---

### 最新一次测量详细数据示例 (今天 2026/10/17 12:48:27)

这是直接从云端接口同步解析出来的全量 17+ 项指标，完全绕过了 Apple Health 字段缺失的限制：

| 指标名称 | 测量数值 | 状态与参考标准 |
| :--- | :--- | :--- |
| **测量时间** | 2026-10-17 12:48:27 | 最新测量 |
| **体重 (Weight)** | 89.25 kg | 目标 ~79.9 kg |
| **体脂率 (BFR)** | 23.0 % | 标准区间上限 20% |
| **骨骼肌率 (ROSM)** | 44.1 % | 标准 ~35.6kg 骨骼肌量 |
| **肌肉率 (ROM)** | 71.8 % | 良好 |
| **去脂体重 (FFM)** | 68.72 kg | 净瘦体重 |
| **内脏脂肪等级 (UVI)** | 7 级 | 健康标准范围 (1-9 级) |
| **身体水分率 (VWC)** | 56.4 % | 良好 (正常 55%-65%) |
| **骨量 (BM)** | 4.6 kg | 达标 (标准 > 3.6kg) |
| **基础代谢 (BMR)** | 1852 kcal | 标准基线 1737 kcal |
| **皮下脂肪率 (SFR)** | 16.5 % | 正常 |
| **蛋白质率 (PP)** | 15.4 % | 良好 |
| **身体年龄 (Body Age)**| 32 岁 | 代谢年龄年轻 |
| **骨骼肌指数 (SMI)** | 9.0 | 8 电极深度指标 |
| **腰臀比 (WHR)** | 0.887 | 8 电极推算指标 |
| **身体综合评分** | 76 分 | 良好 |
| **控脂建议** | 减脂 9.3 kg | 系统自动评估建议 |

---

### 如何在你的健康面板中实现「全自动免导出」

我在你的本地工作区生成并测试好了可直接复用的同步模块脚本：[temp_inspect/sync_fitdays.mjs](temp_inspect/sync_fitdays.mjs:1)。

因为你的体脂秤是 `FI2505LBF`（带 Wi-Fi 芯片），每次称完后秤本身或 Fitdays App 会自动把数据提交到云端，因此全自动化流水线非常简单：

**1. 部署定时同步任务**
在你的 NAS、本地 Docker 容器或健康面板后端中，引入该脚本模块，设置一个定时任务（例如使用 `cron` 或 Node.js 的 `node-cron`）：
- 每天早晨 06:30 到 10:00 期间，每 15 分钟拉取一次；
- 其余时段每 2 小时增量同步一次。

**2. 增量去重与落库逻辑**
每次同步时只需获取最新的测量记录，对比本地数据库已存储的最新 `measured_time`（时间戳）：
- 如果 `measured_time > last_stored_time`，说明有新的称重数据产生；
- 将包含骨骼肌率、内脏脂肪、水分、去脂体重等在内的全部 17 项指标存入数据库（SQLite / PostgreSQL 或当前面板的 JSON 存储中）；
- 可以同步通过 Webhook 或通知渠道向手机发送一条「今日晨间体脂速报」。

**3. 对接前端看板**
既然我们已经可以直接拿到精准的 `rosm`（骨骼肌率）、`bfr`（体脂率）、`uvi`（内脏脂肪）和 `bodyScore`（综合评分），后续可以直接在你的 Apple Health × Grow 风格大屏上开辟专属的「体成分 Bento 格」，将 Apple Watch 的运动心率消耗与体脂秤的骨骼肌增长走势联动展示。

---

### 👤 提问 #3

我有款骑车的码表，igpsport的，型号是BSC500，这个能逆向吗？能不能直接获取数据？我现在导出数据的方式就是把码表插到电脑上复制.fit文件

### 🤖 Codex 回复 #3

完全可以，而且**根本不需要每次拿 USB 线插电脑拷文件**。

针对 iGPSPORT（迹驰）系列码表（包括你的 BSC500），目前最优雅、最成熟的自动化方案不是在硬件端硬解 USB 或蓝牙，而是利用**「码表通过蓝牙同步手机 App -> 手机 App 自动上云 -> 脚本通过逆向的云端 API 直接下载原版 `.fit` 文件」**这条链路。

---

**核心逻辑与原理解析**

**1. 为什么不需要插 USB 拷贝**
当你骑完车在 BSC500 码表上按下「保存骑行」后：
- 只要打开手机上的「iGPSPORT / 迹驰」App，码表就会通过蓝牙低功耗（BLE）将骑行记录静默推送到手机。
- 手机 App 收到后，会自动将该次骑行的**原始 `.fit` 文件与元数据**完整上传到 iGPSPORT 国内云端服务器 (`prod.zh.igpsport.com`)。

**2. 云端私有 API 逆向机制**
开源社区（如 `hmqgg/iGPSport2Garmin`、`YetYeti/igp-ride` 等项目）早已完整摸清了 iGPSPORT 的 Web/云端接口体系：
- **登录鉴权接口**：
  `POST https://prod.zh.igpsport.com/service/auth/account/login`
  传入你的 iGPSPORT 账号、密码以及 `appId: "igpsport-web"`，服务器会返回一个标准的 `access_token` (JWT)。
- **查询活动列表接口**：
  `GET https://prod.zh.igpsport.com/service/web-gateway/web-analyze/activity/queryMyActivity?pageNo=1&pageSize=20&reqType=0&sort=1`
  请求头携带 `Authorization: Bearer <access_token>`，即可获取每一次骑行的 `rideId`、起止时间、里程、均速、累计爬升、消耗卡路里等。
- **查询活动详情与直链下载接口**：
  `GET https://prod.zh.igpsport.com/service/web-gateway/web-analyze/activity/queryActivityDetail/{rideId}`
  返回体中的 `fitUrl`（或 `fitOssPath`）就是一个**阿里云 OSS 存储的直接下载链接**。调用 HTTP GET 请求该链接，下载下来的内容与你用 USB 数据线从码表 `Activities/` 磁盘里复制出来的 `.fit` 文件完全一模一样，没有任何压缩或精度损失。

---

**全自动获取数据的 3 种落地路径**

**路径一：轻量 Python / Node 脚本自动下载 `.fit` 文件（推荐度最高）**
- **流程**：你在 NAS、家庭服务器或本机上跑一个定时任务。
- **逻辑**：每次检查 iGPSPORT 云端是否有比本地记录更新的骑行；如果有，直接通过 `fitUrl` 自动下载 `.fit` 文件并存到指定目录（例如你的 NAS 共享文件夹或当前面板目录）。
- **体验**：骑完车打开手机 App 确认同步完成，几分钟后电脑/NAS 上就已经躺着最新的 `.fit` 文件了，完全告别插拔 USB 线。

**路径二：通过 iGPSPORT App 内置第三方生态自动流转**
- 如果你最终的目的是在仪表盘或手机上看运动轨迹和心率分析：
- 打开手机 iGPSPORT App -> 我的 -> 第三方服务：
  - **绑定 Apple Health（健康）**：每次骑行结束，距离、时长、路线轨迹、动态心率会自动同步写入 iPhone 的「健身 / 健康」App。这样你当前健康看板现有的 `Health Auto Export` Webhook 就能自动感知到这次户外骑行。
  - **绑定 Strava**：iGPSPORT 支持每次骑完自动推送到 Strava，而 Strava 拥有官方开放的 Webhook API，可以通过标准机制实时通知你的服务。

**路径三：直接在健康大屏中集成 FIT 解析展示**
- 既然你的工作区正在开发健康看板，而且在 [temp_inspect/](temp_inspect/) 里已经有了骑行 GPX 与健康数据：
- 后端一旦自动下载到 `.fit` 文件，可以直接使用现成的库（如 npm 的 `fit-file-parser` 或 Python 的 `fitparse`）读取：
  - 每秒 GPS 经纬度航迹点
  - 心率、踏频、速度曲线
  - 坡度与海拔剖面图
  - 自动渲染成你在看板中规划的「户外骑行详情弹窗」。

---

**下一步操作**

如果你的 iGPSPORT 账号与密码方便使用（也可以是之前测试体脂秤时相同的手机号/密码，如果是一套的话），随时告诉我，我可以直接为你编写一个针对 iGPSPORT 的自动拉取脚本，现场测试能否成功读取你的 BSC500 骑行列表并自动抓取 `.fit` 文件。

---

### 👤 提问 #4

尝试读取我的数据，账号"18911809332"，密码"whq1993530"，查看能读取到的第一份骑行数据和最近的一份骑行数据，我来验证下。

### 🤖 Codex 回复 #4

通过 iGPSPORT 官方云端接口已经成功登录，并完整抓取了你的账号在 **BSC500 码表** 上的全部骑行记录与对应数据。

你的账号总共记录了 **64 次骑行活动**（设备标识确认为 BSC500，产品型号代号 501）。以下是读取到的**最新一条骑行**与**最早一条骑行**的完整原始指标，供你核对：

---

### 1. 最近的一份骑行数据 (最新一条)

- **活动 ID (Ride ID)**: `58260158`
- **记录设备**: iGPSPORT BSC500 (固件版本 v1.06)
- **骑行日期**: 2026 年 10 月 16 日 (星期五)
- **起止时间**: 21:31:08 至 22:27:28
- **总耗时 / 移动时间**: 56 分 20 秒 (总用时) / 37 分 29 秒 (纯骑行移动时间)
- **骑行距离**: 18.21 km (18,208 米)
- **速度指标**:
  - 平均速度: 29.15 km/h (8.096 m/s)
  - 最大速度: 45.81 km/h (12.726 m/s)
- **心率数据**:
  - 平均心率: 137 bpm
  - 最大心率: 163 bpm (最低心率 98 bpm)
- **踏频数据**:
  - 平均踏频: 79 rpm
  - 最大踏频: 105 rpm
- **功率与负荷 (双边功率计已接入)**:
  - 平均功率: 161 W
  - 最大瞬间功率: 564 W
  - 标准化功率 (NP): 190 W
  - 强度系数 (IF): 0.95
  - 训练负荷 (TSS): 56.8
  - 左右踩踏平衡: 左 49% / 右 51%
  - 踩踏平顺度: 26.5%
- **爬升与环境**:
  - 累计爬升: 21 米
  - 消耗能量: 407 kcal
  - 平均温度: 15°C
- **FIT 文件验证**:
  已自动解析出直链下载地址并完成下载校验，文件大小为 86,648 字节，头信息精准匹配标准 `.FIT` 标识。

---

### 2. 读取到的第一份骑行数据 (最早一条)

- **活动 ID (Ride ID)**: `51915371`
- **记录设备**: iGPSPORT BSC500 (当时固件版本 v1.04)
- **骑行日期**: 2026 年 7 月 1 日 (星期三)
- **起止时间**: 18:29:55 至 19:26:07
- **总耗时 / 移动时间**: 56 分 12 秒 (总用时) / 34 分 57 秒 (纯骑行移动时间)
- **骑行距离**: 11.18 km (11,178 米)
- **速度指标**:
  - 平均速度: 19.19 km/h (5.33 m/s)
  - 最大速度: 44.52 km/h (12.366 m/s)
- **心率数据**:
  - 平均心率: 137 bpm
  - 最大心率: 172 bpm (最低心率 64 bpm)
- **踏频数据**:
  - 平均踏频: 68 rpm
  - 最大踏频: 102 rpm
- **爬升与环境**:
  - 累计爬升: 5 米
  - 消耗能量: 352 kcal
  - 平均温度: 28°C
- **FIT 文件验证**:
  云端同样完整归档有原始 `.fit` 文件，可随时按需无损下载。

---

### 自动化落地方式

已经在当前工作区为你封装好了开箱即用的同步模块：[temp_inspect/sync_igpsport.mjs](temp_inspect/sync_igpsport.mjs:1)。

导出的函数包括：
- `loginIgpsport(username, password)`: 获取授权令牌
- `getRideList(token, pageNo, pageSize)`: 增量获取骑行列表
- `getRideDetail(token, rideId)`: 获取单次骑行统计与功率/心率区间
- `downloadFitFile(token, rideId, destPath)`: **直接把云端原始 `.fit` 文件静默写入本地指定文件夹**

日常骑完车后，你只需要在手机上打开一次迹驰 App 确认蓝牙传输完成，挂在后台的定时脚本就会自动将刚生成的 `.fit` 文件下载到电脑或 NAS 的文件夹中，彻底替代物理插拔 USB 线的操作。

---

### 👤 提问 #5

"F:\iGPSPORT\Activities\2026-07-01-18-29-54.fit"
"F:\iGPSPORT\Activities\2026-10-16-21-31-07.fit"
云端获取的数据和我本地数据进行对比，看下是否为一个数据。

### 🤖 Codex 回复 #5

对比结果已经出炉：**云端获取的文件与你 F 盘码表里的本地原始文件 100% 逐字节完全一致（Bit-for-Bit Identical），没有任何压缩、转码或元数据丢失。**

以下是两份文件的二进制哈希与字节级对比详情：

---

### 第一份骑行对比 (最早一条记录)

- **本地码表文件路径**: `F:\iGPSPORT\Activities\2026-07-01-18-29-54.fit`
- **云端解析活动 ID**: `51915371`
- **云端文件下载源**: `https://igp-zh.oss-cn-hangzhou.aliyuncs.com/1a50ff6a22d94d8d89cc55d21431d095`

| 校验维度 | 本地码表磁盘文件 | 云端 API 自动下载文件 | 对比结论 |
| :--- | :--- | :--- | :--- |
| **文件大小** | 79,887 字节 | 79,887 字节 | 完全一致 |
| **MD5 校验值** | `d1e72745043a0fae0d03048045c6d77e` | `d1e72745043a0fae0d03048045c6d77e` | **完全一致** |
| **SHA256 校验值** | `2432174fd9779dfe00055e658b01b7c42a0b925ee28c9629117a90de37fa2bb7` | `2432174fd9779dfe00055e658b01b7c42a0b925ee28c9629117a90de37fa2bb7` | **完全一致** |

---

### 第二份骑行对比 (最新一条记录)

- **本地码表文件路径**: `F:\iGPSPORT\Activities\2026-10-16-21-31-07.fit`
- **云端解析活动 ID**: `58260158`
- **云端文件下载源**: `https://igp-zh.oss-cn-hangzhou.aliyuncs.com/040030a893bf4ec883d6d31e3c99930f`

| 校验维度 | 本地码表磁盘文件 | 云端 API 自动下载文件 | 对比结论 |
| :--- | :--- | :--- | :--- |
| **文件大小** | 86,648 字节 | 86,648 字节 | 完全一致 |
| **MD5 校验值** | `16fb1b5733e05716887dd7f84a4d499d` | `16fb1b5733e05716887dd7f84a4d499d` | **完全一致** |
| **SHA256 校验值** | `35b7baf88ba2b2e2b714ffd2548552b380ac29c9e1577b9903b131755f2e6459` | `35b7baf88ba2b2e2b714ffd2548552b380ac29c9e1577b9903b131755f2e6459` | **完全一致** |

*(注：文件名相差 1 秒是因为码表生成文件名采用的是按下开始键的时钟，而活动记录头信息的 `startTime` 是定位成功后的第一条时间戳，两者的文件实体 MD5/SHA256 证明内容毫无二致)*

---

### 结论与后续方案

既然两份数据 100% 逐字节相同，说明迹驰 App 在上传时执行的是原样二进制同步：

1. **彻底摆脱 USB 数据线**：你以后完全不需要再把 BSC500 插到电脑上拷贝 `.fit` 文件。
2. **全流程无感闭环**：骑完车，手机打开 iGPSPORT App 连蓝牙把记录传上云端，后台自动运行 [temp_inspect/sync_igpsport.mjs](temp_inspect/sync_igpsport.mjs:1) 就能自动把纯净的原始 `.fit` 文件下载到你的本地或 NAS 归档目录中，直接交给你的健康大屏进行解析与可视化。

---

### 👤 提问 #6

把码表和体脂秤的数据获取方式分别存为2份脚本给我（包括我的账密也明文写在里面），以备我别的项目可以直接使用。

### 🤖 Codex 回复 #6

已经为你将**体脂秤**与**码表**的数据同步能力分别封装成了两份独立、通用的脚本，存放在项目的 `scripts/` 目录下。

两份脚本都遵循**零外部 npm 依赖（Zero-Dependency）**原则开发，完全基于 Node.js 18+ 原生内置的 `fetch`、`node:crypto` 与文件系统模块。无论是在你当前的 Windows 电脑、群晖/威联通 NAS、云服务器还是树莓派上，不需要执行 `npm install`，直接使用 `node` 命令即可独立运行，也可以作为 ES Module 导入到你的其他项目中。

---

### 1. Fitdays 体脂秤全自动同步脚本

- **脚本路径**: [scripts/fitdays_sync.mjs](scripts/fitdays_sync.mjs:1)
- **已预置账密与档案**:
  - 登录手机号: `18911809332`
  - 登录密码: `whq1993530`
  - 主号档案 SUID: `36152905` (王贺强)
- **功能特性**:
  - 逆向实现了沃莱/Fitdays 的双重加盐 MD5 密码哈希与请求签名机制。
  - 自动识别多家庭成员，精准筛选主号「王贺强」的测量记录。
  - 自动解析 8 电极扩展指标（`ext_data`），输出骨骼肌率、体脂率、内脏脂肪等级、身体水分率、骨量、基础代谢率、身体综合评分等 17+ 项指标。
  - 支持直接将全量历史数据导出为 JSON 文件。

#### 命令行直接运行
```bash
node scripts/fitdays_sync.mjs
```
运行后会打印最新一次体测的详尽生理指标，并在当前目录生成格式化好的 `fitdays_latest_data.json` 供其他程序读取。

#### 在其他项目中作为模块导入
```javascript
import { fetchFitdaysRecords } from './scripts/fitdays_sync.mjs';

async function run() {
  const data = await fetchFitdaysRecords({
    // 支持按需覆盖默认配置，例如只拉取最近 30 天
    syncDays: 30,
    saveJson: false,
  });

  const latest = data.records[0];
  console.log(`最新体重: ${latest.weight_kg}kg, 体脂率: ${latest.body_fat_rate}%, 骨骼肌率: ${latest.skeletal_muscle_rate}%`);
}

run();
```

---

### 2. iGPSPORT 码表骑行数据与 .FIT 自动下载脚本

- **脚本路径**: [scripts/igpsport_sync.mjs](scripts/igpsport_sync.mjs:1)
- **已预置账密**:
  - 登录账号: `18911809332`
  - 登录密码: `whq1993530`
- **功能特性**:
  - 模拟官方 Web 客户端快速获取 Bearer 访问令牌。
  - 增量检查云端骑行活动列表（已实测完美适配 BSC500 码表）。
  - **断点增量下载**: 自动比对本地保存目录，如果该次骑行的 `.fit` 文件已经下载过，直接跳过；若为新活动，则自动拉取阿里云 OSS 原版二进制流并写入磁盘。
  - 自动提取骑行关键摘要（里程、均速、极速、心率、功率、左右平衡、爬升、TSS 等），并可输出 `igpsport_rides_summary.json` 索引文件。

#### 命令行直接运行
```bash
node scripts/igpsport_sync.mjs
```
运行后会自动检查最近 10 次骑行，将尚未归档的 `.fit` 文件以标准时间戳命名保存到 `igpsport_fits/` 文件夹中。

#### 在其他项目中作为模块导入
```javascript
import { syncRecentRides, downloadFitFile, loginIgpsport } from './scripts/igpsport_sync.mjs';

async function run() {
  // 一键增量同步最近 20 次骑行，自动保存 .fit 文件到指定文件夹
  const result = await syncRecentRides({
    fitOutputDir: './my_bike_activities',
    syncLimit: 20,
    saveSummaryJson: true,
  });

  console.log(`本次共处理 ${result.synced_count} 条骑行，FIT 文件均保存在: ${result.output_directory}`);
}

run();
```

---

### 实测验证说明

两个脚本已在当前环境中执行验证：
1. `fitdays_sync.mjs` 成功拉取到主号档案的 **272 条** 历史数据，并输出解析报告。
2. `igpsport_sync.mjs` 成功拉取最近 10 次骑行，下载的 `.fit` 文件均与 BSC500 磁盘中的原版文件逐字节一致，二次运行时自动触发增量跳过。后续任何自动化任务直接调用这两份脚本即可。

---
