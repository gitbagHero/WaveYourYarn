# WaveYourYarn 项目完整规划（v0.2.5 → v2.0）

> 文档状态：主路线规划
>
> 制定日期：2026-07-17
>
> 最近调整：2026-07-21
>
> 当前代码基线：v0.2.5，首个 GitHub Release
>
> 维护规则：README 描述当前能力；本文件定义未来主路线；历史版本计划保留为实现记录，但不再作为总体优先级依据。

---

## 1. 执行摘要

WaveYourYarn 当前已经完成本地音乐数据中心的核心闭环：

```text
网易云登录
  → liked / 用户歌单同步
  → SQLite 本地缓存
  → 搜索、排序、详情与统计
  → CSV / JSON / Markdown 导出
```

v1.0 前的产品主线已经收敛为只读音乐数据和 AI 报告：

```text
可靠获取个人音乐数据
  → 将数据沉淀为可恢复的本地资产
  → 生成可解释的统计与 AI 报告
  → 导出可长期保存的报告成果
  → 扩展到 macOS 与 Windows
  → 统一 UI 与用户体验
  → v1.0 稳定 Release
```

v1.0 不包含网易云远端写入、AI 歌单整理或 Apple Music 迁移。原 v0.4.x 与 v0.5.x 范围整体迁移到 v2.0，作为统一的高级歌单管理能力重新设计。

产品不是第三方音乐播放器，而是：

> v1.0：一个本地优先、只读、安全、可解释的个人音乐数据与 AI 报告工具。
>
> v2.0：在不破坏原始账户内容的前提下，扩展高级歌单管理与跨平台迁移。

调整后的主版本顺序为：

| 阶段          | 目标                 | 关键交付                                            |
| ------------- | -------------------- | --------------------------------------------------- |
| v0.2.5        | 发布与质量基础       | 打包、端到端测试、安全加固、诊断与备份              |
| v0.3.x        | AI 音乐报告          | LLM 配置、结构化报告、证据链、报告历史与导出        |
| v0.4.x/v0.5.x | 取消 v1 前发布       | 原范围迁移到 v2.0，不复用版本号                     |
| v0.6.x        | Windows 与双平台稳定 | Windows x64、macOS/Windows 打包与核心流程兼容       |
| v0.7.x        | UI 与用户体验        | 视觉系统、交互状态、可访问性、性能与双平台体验      |
| v1.0.0        | 稳定开源 Release     | 功能冻结、完整回归、文档、未签名产物与校验值        |
| v2.0.x        | 高级歌单管理         | AI 推荐歌单、受控新歌单发布、Apple Music 匹配与迁移 |

---

## 2. 产品定位

### 2.1 核心用户

第一目标用户：

- 长期使用网易云音乐并积累了大量 liked 或歌单的个人用户；
- 希望备份、查看、回顾或分析自己的音乐偏好；
- 愿意使用桌面工具，但不希望把全部音乐数据托管到第三方服务；
- 对 AI 报告感兴趣，但希望知道分析依据并控制发送范围。

第二目标用户：

- 需要 CSV / JSON 数据做个人分析的音乐数据爱好者；
- 希望在 macOS 或 Windows 上离线查看音乐资产的用户；
- 未来可能需要高级歌单管理或 Apple Music 迁移的用户，这部分需求进入 v2.0。

### 2.2 核心用户任务

v1.0 用户进入 WaveYourYarn 后，应该能够完成三类任务：

1. **保存**：把个人音乐数据同步到本地并可靠备份；
2. **理解**：通过统计和 AI 报告理解自己的音乐偏好；
3. **讲述**：把音乐经历导出成可阅读、可分享的报告；

v2.0 再讨论两类高级任务：

4. **整理**：生成与管理新的推荐歌单方案；
5. **迁移**：把确认后的音乐资产安全迁移到其他平台。

### 2.3 明确不做

以下内容不进入 v1.0 主路线：

- 音乐播放、音频下载或离线音源管理；
- 解灰、绕过会员、绕过版权或批量刷行为；
- 云端托管用户 Cookie、音乐库或报告；
- 多用户在线账号系统、社交社区或公开排行榜；
- 任何网易云远端创建、删除、覆盖、重命名、添加或移除操作；
- AI 歌单整理与 Apple Music 授权、匹配或迁移；
- Linux 产品支持与安装包；
- macOS/Windows 签名、公证和自动更新通道；
- 把娱乐化音乐画像描述成心理诊断或事实判断。

---

## 3. 产品原则

### 3.1 本地优先

- SQLite 是个人音乐资产的主要本地存储；
- Cookie、LLM Key 等敏感信息只进入系统安全存储；
- 未经明确操作，不上传音乐数据、报告或诊断日志；
- 所有核心读取能力在网络不可用时优先使用所属账号缓存。

### 3.2 v1.0 远端完全只读

- v1.0 只读取网易云账号、liked、歌曲和歌单数据；
- renderer、preload、IPC、service 和 adapter 均不提供网易云写能力；
- AI 只生成报告，不获得网易云 Cookie 或账号操作能力；
- 报告重命名、删除、缓存清理属于本地数据管理，不改变远端账户；
- v2.0 的新歌单发布边界保留到 v2.0 立项时决定，但任何版本都不得删除、覆盖或更新用户原有远端歌单。

### 3.3 AI 结果可解释

- AI 输入必须来自版本化的分析数据集；
- 报告中的主要结论必须附带统计指标、歌曲样本或时间区间；
- 报告保存模型、模板版本、数据范围和生成时间；
- 无法获得准确 liked 时间时，必须明确说明使用列表顺序近似；
- AI 只生成内容，不能直接获得账号写入能力。

### 3.4 可恢复与可审计

- 数据库升级必须通过 migration runner；
- 批量任务必须记录状态、失败项和重试信息；
- 账号切换、缓存清理和报告生成失败都不能删除用户已导出的文件；
- 破坏性本地操作需要准确文案、确认和失败反馈。

### 3.5 Adapter 隔离外部变化

- v1.0 的网易云与 LLM 只能通过 adapter 接入；
- v2.0 若接入 Apple Music 或网易云发布能力，必须使用独立 adapter 和单独安全决策；
- service 不直接依赖第三方响应结构；
- renderer 不接触 Cookie、Token、Node.js、SQLite 或第三方 SDK；
- 上游变更首先由 adapter contract tests 和人工兼容矩阵发现。

---

## 4. v0.2.5 当前基线

### 4.1 已完成产品能力

| 领域              | 当前状态                                                             |
| ----------------- | -------------------------------------------------------------------- |
| Electron 桌面框架 | main / preload / renderer 三进程已建立                               |
| 登录              | 内置网页登录、手动 Cookie 兜底、登录态与退出                         |
| liked             | ID、顺序、收藏时间、歌曲详情同步与本地读取                           |
| 歌单              | 创建/收藏歌单列表、指定歌单歌曲、批量同步                            |
| 数据展示          | 搜索、筛选、排序、详情、空状态与错误状态                             |
| 导出              | liked/歌单，CSV/JSON/Markdown，范围与排序                            |
| 统计              | liked、全部缓存、指定歌单的摘要与 AI 数据集                          |
| 设置              | 默认导出目录和缓存/历史管理                                          |
| 数据安全          | 单活动账号缓存所有权、精确清理、safeStorage                          |
| 数据库            | 版本化 migration、事务回滚、旧库兼容和索引                           |
| IPC 安全          | sandbox、context isolation、受控 preload API、sender 与 URL 策略     |
| 恢复与诊断        | 脱敏数据库备份、校验恢复、应急快照、滚动日志和诊断导出               |
| 工程质量          | TypeScript、ESLint、Vitest、Electron E2E、打包态 smoke、生产构建守卫 |
| macOS 开发发行    | 应用图标、electron-builder、arm64/x64 DMG/ZIP 与 tag workflow        |

### 4.2 已存在的良好扩展点

- `StatisticsService.getAnalysisDataset()` 已提供最多 300 首的紧凑 AI 输入；
- `src/main/adapters/llm/` 已预留 LLM adapter；
- `src/main/adapters/apple-music/` 是 v2.0 预留目录，v1.0 不实现；
- 数据层已经支持后续 migration；
- IPC、service、repository 分层可以继续扩展领域模块；
- export 系统可以复用到 AI 报告。

### 4.3 主要缺口

| 缺口                             | 影响                                 | 进入版本         |
| -------------------------------- | ------------------------------------ | ---------------- |
| 真实账号完整人工矩阵仍需持续执行 | 上游登录与风控变化需要发布后跟踪     | 持续治理         |
| 没有后台任务统一状态模型         | AI 生成难以统一取消、恢复与审计      | v0.3.0           |
| LLM adapter 仍为空               | 无法生成 AI 报告                     | v0.3.0           |
| 没有报告持久化与证据模型         | 结果不可复现、不可解释               | v0.3.1           |
| 没有 Windows 打包与兼容矩阵      | 目前只有 macOS 开发发行能力          | v0.6.x           |
| 页面和 service 部分文件过大      | 后续功能扩展风险上升                 | 持续治理         |
| UI 与交互尚未统一收口            | 双平台使用体验和可访问性不足         | v0.7.x           |
| 未签名、未公证且没有自动更新     | 用户需要自行确认风险并手工获取新版本 | 已接受的 v1 限制 |
| 没有高级歌单与 Apple 能力        | 不影响 v1 的只读数据和 AI 报告主线   | v2.0.x           |

---

## 5. 目标产品结构

```text
数据接入层
├── 网易云登录与读取
└── LLM Provider
        ↓
本地音乐资产层
├── 账号与凭据边界
├── 歌曲/歌单标准模型
├── 同步快照与任务历史
├── 备份/恢复
└── 数据导出
        ↓
洞察层
├── 确定性统计
├── 版本化分析数据集
├── AI 音乐报告
└── 报告证据与历史
```

v2.0 才扩展高级歌单管理层，包括推荐方案、受控新歌单发布、Apple 曲目匹配和迁移。该层不进入 v1.0 的代码、数据库和 IPC 范围。

页面最终结构：

```text
Dashboard
连接与账号
音乐库
├── 我喜欢的音乐
├── 歌单
└── 统计
AI 报告
任务与历史
设置与诊断
```

v2.0 页面候选包括“高级歌单管理”和“迁移助手”，不在 v1.0 导航中预留不可用入口。

---

## 6. 目标技术架构

### 6.1 保持现有主干

```text
Renderer
  ↓ typed preload API
IPC boundary
  ↓ validation / sender check / result envelope
Domain Services
  ├── repositories → SQLite
  ├── adapters → external services
  ├── task manager
  └── filesystem / Electron capability
```

renderer 只负责：

- 展示状态；
- 收集非敏感参数；
- 展示数据发送预览和确认信息；
- 通过 preload 调用明确的业务 API。

main 负责：

- 凭据和本地文件；
- 外部网络请求；
- 数据迁移和事务；
- AI 输入构建和输出校验；
- 后台任务生命周期。

### 6.2 新增领域模块

```text
src/main/
├── adapters/
│   ├── ncm/
│   └── llm/
├── jobs/
│   ├── JobManager.ts
│   ├── JobCancellation.ts
│   └── JobProgress.ts
├── services/
│   ├── AIReportService.ts
│   ├── ReportExportService.ts
│   ├── BackupService.ts
│   └── DiagnosticsService.ts
└── policies/
    ├── ExternalUrlPolicy.ts
    ├── DataDisclosurePolicy.ts
    └── LogRedactionPolicy.ts
```

`ncm-write`、`apple-music`、整理、匹配和迁移模块全部推迟到 v2.0，且必须在 v2.0 安全边界确认后再设计，不能提前加入半成品接口。

### 6.3 统一后台任务模型

v1.0 的 AI 生成和长时间本地/同步任务使用同一种任务状态：

```text
pending → running → succeeded
                  ↘ partially_succeeded
                  ↘ failed
                  ↘ cancelled
```

任务必须具备：

- 可序列化输入摘要；
- 当前阶段、进度和处理数量；
- 开始/结束时间；
- 可取消标记；
- 失败原因和失败项；
- 重试来源任务 ID；
- 不包含 Cookie、Token、API Key 的安全日志。

### 6.4 外部服务接口

LLM adapter 最小接口：

```ts
interface LLMProvider {
  testConnection(): Promise<ConnectionTestResult>
  generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T>
  getCapabilities(): LLMCapabilities
}
```

v1.0 音乐平台 adapter 只定义读取能力：

```ts
interface MusicPlatformReader {
  getCurrentUser(): Promise<PlatformUser>
  getPlaylists(): Promise<PlatformPlaylist[]>
  getPlaylistTracks(id: string): Promise<PlatformTrack[]>
}
```

v1.0 不定义 `MusicPlatformWriter`。v2.0 是否新增以及如何限制写入能力，在 v2.0 立项时重新决策。

---

## 7. 数据模型演进

### 7.1 v0.3 数据模型

建议新增：

```text
job_runs
llm_profiles
ai_reports
ai_report_sources
```

约束：

- `llm_profiles` 只保存 provider、base URL、model 和公开参数；
- API Key 使用 `SecureStorageService`，数据库只保存 secret reference；
- `ai_reports` 保存报告类型、状态、模型、模板版本和内容；
- `ai_report_sources` 保存 source、数据集摘要、时间范围和歌曲 ID 快照；
- 用户删除源缓存时，不应静默篡改已生成报告的输入快照。

### 7.2 v2.0 高级歌单管理候选模型

建议新增：

```text
organize_plans
organize_groups
organize_plan_items
remote_write_runs
remote_write_items
```

约束：

- 整理方案在执行后保持不可变，编辑产生新 revision；
- 每首歌曲明确记录目标分组和归类依据；
- 写入记录保存目标歌单 ID、批次、成功项和失败项；
- 重试只能处理未成功项，不能重复添加已确认成功的歌曲。

### 7.3 v2.0 Apple Music 候选模型

建议新增：

```text
external_tracks
track_matches
migration_runs
migration_items
```

约束：

- 匹配记录保存算法版本和候选得分；
- 用户手工选择应覆盖自动匹配且保留审计信息；
- 高、中、低置信度阈值必须版本化；
- 迁移执行与匹配评审分离；
- 失败恢复不能重新创建重复目标歌单。

以上 v2.0 模型仅保存历史设计方向，不是已批准的 schema。v1.0 不创建这些表；v2.0 立项时需要重新确认原始歌单只读、系统生成对象归属、幂等和失败恢复边界。

### 7.4 数据库通用规则

1. 所有表结构变化必须新增 migration 版本；
2. 多表写入必须在事务中完成；
3. migration 必须测试新库、上一稳定版数据库和失败回滚；
4. 批量删除使用明确 repository 方法，不允许通用 `clearAll` 跨领域复用；
5. 关键关系增加唯一约束、外键策略或显式完整性检查；
6. 报告要区分“可重新生成缓存”和“用户成果数据”；v2.0 再扩展整理方案和迁移记录；
7. 账号切换默认清理可重建缓存，但保留用户明确保存的成果，除非用户选择删除。

---

## 8. 版本路线图

### 8.1 v0.2.5：发行与质量基础

目标：让当前数据中心达到可持续扩展、可生成安装包、可定位故障的状态。

状态：代码与本地无凭据自动化已于 2026-07-20 完成并发布首个 GitHub Release；arm64 原生包和 x64 Rosetta 包均通过本地打包态 E2E。2026-07-21 准入审计发现并修复原始 tag workflow 在源码 Electron E2E 前缺少 native rebuild；新的 Linux CI 和 macOS arm64/x64 原生 workflow 均通过。v0.2.5 开发与自动化准入闭环完成，真实账号人工矩阵继续作为稳定版本发布门禁。

范围：

1. **发布工程**
   - 增加 Electron 打包配置；
   - macOS arm64/x64 开发安装包；
   - 应用图标、包名、版本和产物命名；
   - 建立 tag 构建流程；
   - 暂不默认启用自动更新。
2. **Electron 安全**
   - 主窗口和登录窗口限制任意导航；
   - `shell.openExternal` 使用协议/域名白名单；
   - 设置 permission request handler；
   - 增加 renderer CSP；
   - IPC 校验 sender 与参数 schema。
3. **端到端质量**
   - 增加 Electron 启动、preload bridge 和基础路由 E2E；
   - 增加 adapter fixture contract tests；
   - 将真实账号登录/同步形成发布前人工清单；
   - CI 保留无凭据可运行。
4. **恢复与诊断**
   - 数据库备份和恢复入口；
   - 导出脱敏诊断包；
   - 统一结构化日志和敏感字段脱敏；
   - 展示应用、Electron、数据库 schema 和 adapter 版本。
5. **可维护性治理**
   - 拆分过大的 ExportPage、StatisticsService 等文件；
   - 统一 IPC 参数校验和错误码；
   - 清理历史未使用 SQL 与实际 migration source 的歧义。

验收：

- 全新安装和 v0.2.4 升级都可启动；
- Electron E2E 能发现 preload 缺失；
- 安装包可以完成登录、同步、查看、导出闭环；
- 备份恢复后核心数量和关联一致；
- 日志、诊断包和错误提示不包含 Cookie、Token 或 API Key；
- `pnpm run check` 和打包 workflow 通过。

明确不做：LLM 调用、远端写入、Apple Music。

### 8.2 v0.3.0：LLM 基础设施与隐私边界

目标：建立可替换、可测试、不会泄露凭据的 LLM 调用底座。

范围：

- OpenAI-compatible provider 作为首个实现；
- Provider、Base URL、模型、超时、语言和输入数量设置；
- API Key 进入 safeStorage；
- 连接测试使用最小请求；
- LLM 请求超时、取消、重试和结构化错误；
- JobManager 和 `job_runs`；
- 数据发送预览：字段、歌曲数量、目标域名；
- 自定义 Base URL 的 HTTPS/localhost 校验和 SSRF 防护；
- JSON Schema 或等价的严格结构化输出校验；
- 不保存完整敏感请求日志。

验收：

- renderer 无法读取 API Key；
- settings IPC 仍不能读取 secret；
- 用户可以保存配置、测试连接和删除凭据；
- 取消任务后不会继续落库为成功；
- 非法 URL、超时、限流、鉴权失败有可区分错误；
- provider adapter 使用 mock contract tests 覆盖。

明确不做：最终音乐报告 UI、自动歌单整理、远端写入。

### 8.3 v0.3.1：可解释 AI 音乐报告

目标：从现有 `MusicAnalysisDataset` 生成可保存、可追溯的音乐报告。

首批报告：

- 音乐人格摘要；
- 艺术家/专辑偏好；
- 收藏时间线与阶段变化；
- 情绪与场景关键词；
- 推荐的后续整理方向。

实现要求：

- 先由确定性统计生成事实摘要，再交给 LLM 组织语言；
- 报告输出使用版本化 schema；
- 主要结论附 `evidence`：统计值、歌曲样本、时间区间；
- 报告显示 provider、model、数据来源、歌曲数和生成时间；
- 明确娱乐用途与时间精度限制；
- 支持失败重试，但重试创建新 generation；
- 报告历史持久化，可删除、重命名和重新生成。

验收：

- 相同 fixture 能生成结构合法的报告；
- 每个主要章节至少具备一个可展示依据；
- 输出不得引用输入中不存在的歌曲 ID；
- 缺少 liked 时间时自动降级为列表顺序并提示；
- 删除报告不会删除音乐缓存；
- 断网时可阅读已保存报告。

### 8.4 v0.3.2：报告导出与分享

目标：把 AI 报告转化为可长期保存的个人成果。

范围：

- Markdown 和 HTML 导出；
- 可打印布局与 PDF 导出评估；
- 报告主题、封面标题和隐私字段开关；
- 分享前预览；
- 导出内容包含生成元数据和娱乐用途说明；
- 报告版本比较和重新生成入口。

验收：

- 导出结果和应用内报告章节一致；
- 用户可以关闭昵称、用户 ID 等身份字段；
- renderer 仍不能指定任意目标路径；
- 导出失败不会损坏已保存报告。

### 8.5 v0.4.x / v0.5.x：取消 v1 前发布

原 v0.4.x“AI 歌单整理与网易云发布”和 v0.5.x“Apple Music 迁移”不再进入 v1.0 前的开发序列。这两个版本号保留为历史规划记录，不用于其他功能，也不发布对应稳定版本。

迁移规则：

- 所有整理、远端新歌单发布、曲目匹配和 Apple Music 迁移能力统一进入 v2.0；
- v1.0 不增加相关表、IPC、adapter、页面或不可用入口；
- 已有 `src/main/adapters/apple-music/` 仅视为预留目录，不代表 v1 范围；
- 高级歌单边界问题在 v2.0 立项时重新评审；
- 任何未来版本都不得删除、覆盖或更新用户原有远端歌单。

### 8.6 v0.6.0：Windows x64 支持

目标：在不扩大业务功能的前提下，将当前 macOS 应用扩展到 Windows x64。

范围：

- electron-builder Windows x64 配置；
- Windows 安装包或便携 ZIP 产物；
- `better-sqlite3` Windows 原生模块构建；
- `safeStorage`、数据库、备份恢复和系统路径验证；
- 中文路径、长路径、导出文件名和文件对话框兼容；
- 网易云网页登录窗口、Cookie session 和外链策略验证；
- Windows 源码 Electron E2E 与打包态 E2E；
- GitHub Actions Windows 原生 runner 构建。

明确不做：

- Windows ARM；
- Linux 安装包或产品支持；
- macOS/Windows 代码签名；
- macOS 公证；
- 自动更新；
- 歌单整理、远端写入或 Apple Music。

### 8.7 v0.6.1：macOS / Windows 双平台稳定化

范围：

- macOS arm64/x64 与 Windows x64 核心只读流程回归；
- 两个平台的安装、首次启动、卸载和数据目录行为记录；
- 备份文件跨平台读取与恢复验证；
- 打包态 preload、native ABI、登录、同步、统计和导出 smoke；
- 崩溃恢复、诊断和上游兼容流程；
- 未签名风险、安装步骤与故障排查文档。

验收：

- 两个平台均可完成登录、同步、离线查看、导出、统计和 AI 报告主线；
- Windows 与 macOS 使用相同数据库 schema 和备份格式；
- 未签名产物具有 SHA-256 校验值和可审计构建记录；
- Linux CI 可以保留为无凭据工程校验，但不产生 Linux Release。

### 8.8 v0.7.x：UI 与用户体验专项

目标：在 macOS/Windows 功能一致后统一视觉和交互质量，不再增加新的业务范围。

范围：

- 统一颜色、字体、间距、图标和组件状态；
- 优化导航、信息层级、页面布局与跨平台一致性；
- 完善首次使用、登录、LLM 配置和数据披露引导；
- 统一 loading、empty、error、offline 和 partial 状态；
- 改善表格、搜索、统计、报告阅读与导出体验；
- 键盘导航、焦点、对比度和基础可访问性；
- 不同窗口尺寸、DPI 与长文本适配；
- 大型本地音乐库的列表与页面响应优化；
- 关键页面视觉回归和人工 UX 验收清单。

验收：

- macOS/Windows 关键页面视觉与交互一致；
- 核心只读与 AI 报告流程可以通过键盘完成；
- 异常、空数据、离线和长任务状态具有明确反馈；
- 10,000 首级别本地数据的主要列表和统计仍可用；
- 本版本没有新增远端账号能力。

### 8.9 v1.0.0-rc：发布候选

目标：冻结功能，验证正式 Release 所需的完整事实基线。

范围：

- 从 v0.2.4 数据库连续迁移到最新 schema；
- macOS arm64/x64、Windows x64 源码与打包态 E2E；
- 真实网易云账号只读人工矩阵；
- LLM mock 自动化与至少一个实际 provider 人工回归；
- 备份、恢复、诊断、日志脱敏和跨平台数据兼容演练；
- README、安装说明、隐私说明、已知限制与故障排查；
- 未签名产物、SHA-256 和 GitHub Release 草稿验证。

### 8.10 v1.0.0：稳定开源 Release

v1.0 不新增功能，只发布已经通过候选版本验证的稳定只读产品。

发布门槛：

1. v0.2.4 数据可连续迁移到最新 schema；
2. 登录、同步、离线查看、搜索、导出、统计、AI 报告、历史和报告导出全部通过回归；
3. renderer、preload、IPC、service 和 adapter 不存在网易云写能力；
4. 不存在已知凭据泄露、任意文件写入或未确认的 LLM 数据披露；
5. 用户文档、隐私说明、未签名风险、已知限制和第三方依赖说明完整；
6. 至少一个 release candidate 经过观察和修复周期；
7. 数据备份恢复和跨版本 migration 使用真实规模 fixture 验证；
8. 网易云只读接口与 LLM provider 兼容矩阵已记录；
9. macOS arm64/x64 与 Windows x64 未签名产物、SHA-256 和构建记录完整；
10. `main`、tag、package version 与发布产物版本一致。

### 8.11 v2.0.x：高级歌单管理

v2.0 统一承接原 v0.4.x 与 v0.5.x 范围，候选方向包括：

- AI 生成新的推荐歌单方案；
- 原始歌单与系统生成歌单严格分区；
- 用户明确选择后发布全新的网易云推荐歌单；
- Apple Music 授权、曲目匹配、人工复核和迁移；
- 方案、匹配、发布、迁移、审计和失败恢复的统一模型。

v2.0 尚未完成产品与技术边界决策。新歌单发布的唯一接口、系统生成对象归属、幂等、部分失败和后续追加规则均保留到 v2.0 立项时讨论。当前只确认一条永久原则：不得删除、覆盖或更新用户原有远端歌单。

---

## 9. 版本依赖关系

```text
v0.2.4 稳定本地数据中心
  ↓
v0.2.5 发布、E2E、安全、恢复
  ↓
v0.3.0 LLM 与任务底座
  ↓
v0.3.1 可解释报告
  ↓
v0.3.2 报告成果导出
  ↓
v0.6.0 Windows x64 支持
  ↓
v0.6.1 macOS/Windows 稳定化
  ↓
v0.7.x UI/UX 专项
  ↓
v1.0.0-rc 发布候选
  ↓
v1.0.0 稳定开源 Release
  ↓
v2.0.x 高级歌单管理
```

硬性依赖：

- 未完成 v0.3.0 任务模型和数据披露确认，不生成正式 AI 报告；
- 未完成 v0.3.1 报告持久化和证据校验，不实现稳定报告导出；
- 未完成 v0.6.x Windows 与双平台打包态回归，不进入统一 UI/UX 收口；
- 未完成 v0.7.x UI/UX 与可访问性验收，不创建 v1.0 release candidate；
- 未完成 release candidate、跨平台回归和真实账号只读矩阵，不发布 v1.0；
- v2.0 安全边界未重新确认前，不实现歌单整理、远端写入或 Apple Music。

---

## 10. 测试与质量策略

### 10.1 测试分层

| 层级             | 目标           | 示例                                 |
| ---------------- | -------------- | ------------------------------------ |
| Unit             | 纯业务算法     | 排序、采样、统计、dataset digest     |
| Repository       | 数据完整性     | migration、事务、关系、孤立数据      |
| Service          | 业务边界       | 账号隔离、报告生成、成果与缓存隔离   |
| Adapter contract | 上游结构变化   | 固定脱敏 fixture 与响应解析          |
| IPC integration  | 安全桥接       | 参数校验、错误 envelope、secret 隔离 |
| Electron E2E     | 真实运行时     | preload、路由、设置、导出对话框      |
| Manual           | 真实账号和平台 | 网易云只读闭环、实际 LLM、未签名包   |

### 10.2 每个版本的 Definition of Done

每个版本必须满足：

- 产品范围和不做项明确；
- 新业务逻辑有自动化测试；
- 新数据库结构有 migration 和升级 fixture；
- IPC 参数有运行时校验；
- 新 secret 只进入安全存储；
- 新外部请求有超时、错误分类和日志脱敏；
- UI 具备 loading、empty、error、offline/partial 状态；
- README、CHANGELOG、版本计划和 package version 同步；
- Node 22 下 `pnpm run check` 通过；
- 需要真实账号的人工回归有记录；
- 不将真实 Cookie、Token、API Key 或用户原始数据库加入测试。

### 10.3 发布阻断条件

出现以下任一情况不得发布：

- migration 可能丢失用户成果数据；
- preload、IPC 或登录在安装包中不可用；
- 日志或 UI 暴露凭据；
- renderer 可以指定任意文件写入路径；
- AI 输出无法通过 schema 校验却仍被保存为成功；
- 任一 v1.0 代码路径能够创建或修改网易云远端内容；
- macOS/Windows 打包态核心流程失败；
- 关键回归失败或上游接口结构未确认。

---

## 11. 安全与隐私规划

### 11.1 凭据

- 网易云 Cookie、LLM API Key 分别命名并独立删除；
- safeStorage 不可用时拒绝保存新凭据；
- renderer 只能收到“已配置/未配置”，不能收到 secret；
- 诊断包对 Cookie、Authorization、Token、Key、用户 ID 做脱敏；
- 退出、切换账号和彻底清理的行为范围必须区分。

### 11.2 网络

- 所有外部请求只在 main 发起；
- 自定义 LLM Base URL 必须通过 URL policy；
- 默认拒绝 `file:`、`ftp:`、内网非 localhost 地址和重定向到非法协议；
- 外链打开使用协议与域名白名单；
- 网易云登录窗口限制导航范围和权限请求；
- 网络错误不能导致本地成果被覆盖为空。

### 11.3 AI 数据披露

调用前向用户展示：

- 将发送的来源；
- 歌曲数量和字段；
- 是否包含昵称；
- Provider、模型和目标域名；
- 预计用途和不可逆的第三方处理风险。

默认不发送：

- Cookie、Token、API Key；
- 本地文件路径；
- 网易云原始响应中的无关字段；
- 用户未选择的歌单；
- 诊断日志。

### 11.4 远端写入

- v1.0 不定义、不注册、不暴露网易云远端写入 adapter、service、IPC 或 preload API；
- v1.0 的网易云依赖只能用于登录和读取；
- 自动化与人工回归需要证明同步、统计、导出和 AI 报告不会触发远端写入；
- v2.0 的受控新歌单发布边界另行决策；
- 永久禁止删除、覆盖或更新用户原有远端歌单。

---

## 12. 可靠性、性能与体验目标

### 12.1 可靠性目标

- 同步允许部分成功并保留失败 ID；
- 任何批量任务都能明确显示成功、失败、跳过数量；
- 应用异常退出后，已提交事务保持一致；
- 任务恢复不会重复执行已确认成功项；
- 配置错误不影响离线读取已有数据；
- 上游 API 不可用时给出可执行的恢复建议。

### 12.2 性能目标

以下为 v1.0 设计目标，不是当前测量结果：

- 10,000 首本地歌曲可正常分页、搜索和统计；
- 页面导航不因全量 JSON 解析长期阻塞；
- 批量详情和搜索遵守平台限流并可取消；
- AI 默认输入不超过 300 首紧凑歌曲数据；
- 大型导出使用流式或分块写入评估；
- 图片、报告和日志不无限增长，提供保留策略。

### 12.3 UX 目标

- Dashboard 展示当前账号、缓存新鲜度和未完成任务；
- 长任务有进度、阶段、取消和后台继续入口；
- 页面区分“没有数据”“未同步”“已退出但可离线”“接口失败”；
- AI 数据披露确认使用实际 provider、目标域名、字段和数量；
- 部分同步和报告生成失败不能用成功色掩盖；
- 核心流程支持键盘操作和清晰焦点状态。

---

## 13. 成功指标

默认不引入云端遥测。以下指标优先通过本地诊断、测试数据和自愿反馈评估：

### 数据闭环

- 登录后首次同步完成率；
- liked/歌单同步成功与部分成功比例；
- 导出成功率和导出记录一致性；
- 数据库升级与恢复成功率。

### AI 报告

- 结构化输出校验通过率；
- 报告主要结论证据覆盖率；
- 用户重新生成和导出行为；
- 因输入过大、超时、鉴权导致的失败分布。

### 双平台与体验

- macOS/Windows 安装包核心流程通过率；
- 备份文件跨平台读取与恢复结果；
- 首次使用、登录、同步、LLM 配置和报告导出的任务完成率；
- 键盘流程、错误状态和关键页面视觉回归通过率。

歌单整理、远端发布和 Apple Music 指标推迟到 v2.0 立项时定义。

---

## 14. 主要风险与应对

| 风险                        | 影响                         | 应对                                                    |
| --------------------------- | ---------------------------- | ------------------------------------------------------- |
| 网易云非官方 API 变化或风控 | 登录、同步或读取失效         | adapter 隔离、固定版本、contract fixture、真实账号回归  |
| 上游响应结构不稳定          | 本地数据错误或空覆盖         | schema 防御、部分成功、写前校验、不用空结果覆盖有效缓存 |
| Electron 安全配置回归       | preload 或 IPC 全面失效      | CJS 构建守卫、E2E、preload-error、安装包回归            |
| LLM 幻觉和过度解读          | 报告不可信                   | 统计事实优先、结构化 schema、evidence、娱乐用途说明     |
| LLM 成本与隐私              | 用户产生费用或泄露数据       | 发送预览、输入限制、Provider 明示、取消和超时           |
| 自定义 Base URL SSRF        | 访问本地敏感服务             | URL policy、协议/地址限制、重定向复核                   |
| SQLite 损坏或升级失败       | 用户数据不可用               | 启动前备份、事务 migration、恢复入口、真实规模 fixture  |
| Windows 平台差异            | 登录、路径或 native 模块失败 | Windows 原生 CI、打包态 E2E、跨平台备份回归             |
| 未签名发行                  | 系统警告、安装摩擦与用户疑虑 | 风险说明、SHA-256、公开构建记录、禁止绕过系统安全机制   |
| 范围持续膨胀                | 版本长期无法交付             | v1 功能冻结，高级歌单能力整体进入 v2.0                  |

---

## 15. 工程与发布治理

### 15.1 分支与版本

- `main` 始终保持可构建；
- 功能使用短生命周期分支；
- 版本采用 SemVer；
- release candidate 使用预发布版本，例如 `0.3.0-rc.1`；
- tag、package version、应用显示版本、CHANGELOG 必须一致；
- 数据库 migration 版本独立递增，不复用或修改已发布 migration。

### 15.2 CI/CD

持续集成至少包含：

- 类型检查；
- lint；
- unit / repository / service tests；
- Electron build 和 preload 验证；
- E2E smoke；
- migration matrix；
- 依赖和 secret 扫描；
- 发行阶段的 macOS arm64/x64 与 Windows x64 未签名打包；
- Linux 可以继续承担无凭据 CI，但不生成受支持的产品包。

发布 pipeline：

```text
main 通过 CI
  → 创建版本分支/RC tag
  → 构建未签名产物与 SHA-256
  → 安装包人工回归
  → 稳定 tag
  → GitHub Release、安装说明与校验值
```

v1.0 不接入自动更新，不把签名或公证作为发布门禁，也不尝试绕过操作系统安全提示。

### 15.3 上游依赖治理

- 网易云 adapter 作为关键运行时依赖单独维护兼容矩阵；
- 升级前比较上游 release 和本项目使用接口；
- 升级后运行 fixture contract tests 与真实账号只读回归；
- Electron/electron-vite 升级必须验证 preload、native ABI 和打包；
- LLM SDK 或协议实现必须通过 adapter 封装，避免类型渗透业务层；
- v1.0 不评估或升级任何网易云写接口与 Apple Music SDK。

---

## 16. 粗略工作量与节奏

以下按单人连续开发估算，仅用于排序，不作为固定交付承诺：

| 版本         | 估算     | 主要不确定性                           |
| ------------ | -------- | -------------------------------------- |
| v0.3.0       | 2–3 人周 | Provider 差异、结构化输出、隐私策略    |
| v0.3.1–0.3.2 | 3–5 人周 | 报告质量、证据模型、导出布局           |
| v0.6.0–0.6.1 | 3–5 人周 | Windows native 模块、登录与打包态兼容  |
| v0.7.x       | 2–4 人周 | 双平台视觉一致性、可访问性和大数据体验 |
| v1.0.0       | 2–3 人周 | 跨平台回归、RC 观察和发布文档          |

从当前进入 v0.3.x 到 v1.0 约为 12–20 人周。v2.0 高级歌单管理暂不估算，待安全边界和产品范围确认后单独规划。每个小版本结束后应根据真实结果重新估算，不应一次锁死全部日期。

---

## 17. 下一步执行清单

当前进入 v0.3.x，详细执行计划见 `docs/v0.3.x-plan.md`。推荐顺序：

### 第一批：关闭 v0.2.5 准入问题

1. Electron E2E native rebuild 修复已进入 `main`；
2. 新的 GitHub CI 已通过；
3. workflow dispatch 的 macOS arm64/x64 构建已通过；
4. 保留真实账号与双架构人工矩阵，作为 v0.3.0 稳定发布门禁。

### 第二批：v0.3.0 数据与安全底座

1. 按已确认决策实现多 LLM profile、统一 API 配置界面、可记住的披露确认和条件式 PDF；
2. 收口 migration source；
3. 将 `MusicAnalysisDataset` 升级为带 schema version、稳定歌曲 ID 和 digest 的 v1 契约；
4. 实现 schema 7、LLM profile、safeStorage secret 和 JobManager；
5. 实现 URL policy、main-only transport、protocol registry 和 OpenAI-compatible adapter；
6. 完成设置、连接测试和数据披露预览。

### 第三批：v0.3.1–v0.3.2 用户成果

1. 先生成确定性事实，再生成 LLM 叙事；
2. 实现 schema 8、报告 schema、evidence 校验和历史；
3. 实现报告阅读、重命名、删除、重新生成和离线访问；
4. 实现 Markdown/HTML、隐私预览和报告版本比较；
5. 完成国内兼容 provider、本地 provider、多 profile 切换与安装包人工回归。

### 第四批：v0.6.x 双平台

1. 增加 Windows x64 构建、安装包或便携包；
2. 验证 native module、safeStorage、路径、登录窗口和备份格式；
3. 建立 Windows 原生 CI、源码 E2E 和打包态 E2E；
4. 完成 macOS/Windows 双平台稳定化与未签名发行文档。

### 第五批：v0.7.x 与 v1.0

1. 冻结业务范围，完成统一 UI/UX、可访问性和性能专项；
2. 建立关键页面视觉回归与双平台人工验收；
3. 创建 v1.0 release candidate，执行迁移、备份、真实账号和实际 LLM 回归；
4. 生成 macOS arm64/x64、Windows x64 未签名产物和 SHA-256；
5. 发布 v1.0.0 GitHub Release。

---

## 18. 关键决策记录

当前主路线做出以下决策：

1. **桌面本地优先**，v1.0 前不建设云端用户系统；
2. **macOS 优先、Windows x64 在 v0.6 成为正式支持平台**，Linux 不进入产品支持范围；
3. **网易云继续使用 adapter 直连 Node 模块**，不额外启动本地 HTTP 服务；
4. **AI 是可选能力**，不影响基础同步、导出和统计；
5. **OpenAI-compatible 是首个 LLM 协议**，但业务层不绑定单一厂商；
6. **v1.0 的网易云能力完全只读**，AI、renderer、IPC 和 service 都不具备远端写权限；
7. **原 v0.4.x 与 v0.5.x 整体迁移到 v2.0**，统一为高级歌单管理；
8. **高级歌单发布边界保留到 v2.0 讨论**，永久禁止删除、覆盖或更新用户原有远端歌单；
9. **用户成果与可重建缓存分开管理**，报告不能因清缓存被误删；
10. **v0.7.x 专门进行 UI/UX 收口**，完成后才进入 v1.0 release candidate；
11. **v0.3.x 支持多个 LLM profile，但同一时刻只有一个活动 profile**，并提供统一 API 配置和模型管理界面；
12. **v0.3.x 不提供应用内代理设置**，网络层只负责 URL 安全、超时、取消、重定向和错误分类；
13. **AI 数据披露默认确认并允许记住**，授权可在设置中撤销，披露范围扩大时必须重新确认；
14. **v0.3.2 稳定承诺 Markdown/HTML**，PDF 仅在布局与跨平台质量达标后加入。
15. **签名、公证和自动更新不阻塞 v1.0**，发布未签名开源产物、风险说明、SHA-256 和公开构建记录；
16. **v1.0 只做稳定性收口与 GitHub Release**，不临时加入 v2.0 能力。

v0.3.x 决策的完整理由和数据模型影响见 `docs/v0.3-decisions.md`。
v1.0/v2.0 范围、平台、发行和 UI/UX 决策见 `docs/v1-v2-scope-decisions.md`。

---

## 19. 规划维护规则

- 每个版本启动时，从本文件拆出独立的 `docs/vX.Y.Z-plan.md`；
- 独立计划必须引用本文件中的目标、依赖和不做项；
- 实现中若改变产品边界、数据所有权或远端权限，先更新本文件；
- 每个稳定版本完成后更新“当前基线”和路线表；
- 历史计划不删除，只标记完成状态；
- 新想法先进入候选池，不直接插入正在进行的版本；
- 路线优先级始终为：数据安全 > 可恢复性 > 正确性 > 用户体验 > 新功能数量。
