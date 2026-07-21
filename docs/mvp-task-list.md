# WaveYourYarn MVP 开发任务清单

> 文档状态：历史 MVP 设计记录
>
> 本文保留项目初始化阶段的原始目标和任务拆解，不再代表当前版本优先级。当前主路线见 `docs/project-roadmap.md`，v1.0/v2.0 范围调整见 `docs/v1-v2-scope-decisions.md`。

## 1. MVP 目标

WaveYourYarn 的 MVP 阶段目标是先跑通最核心的数据闭环：

```text
网易云账号登录
  ↓
读取“我喜欢的音乐”
  ↓
批量获取歌曲详情
  ↓
本地缓存
  ↓
歌曲列表展示
  ↓
导出 CSV / JSON / Markdown
```

MVP 阶段暂时不开发：

```text
AI 音乐报告
AI 自动整理子歌单
Apple Music 迁移
复杂数据统计
多平台音乐服务接入
```

MVP 的判断标准是：

> 用户可以在桌面端应用中登录网易云音乐，读取自己的“我喜欢的音乐”列表，并将歌曲信息导出为本地文件。

------

# 2. MVP 功能范围

## 2.1 必须完成的功能

### 功能 1：Electron 桌面应用基础框架

需要完成：

- 初始化 Electron + React + TypeScript 项目；
- 配置 Vite 开发环境；
- 配置 Electron 主进程、预加载脚本、渲染进程；
- 配置基础 IPC 通信；
- 配置项目目录结构；
- 实现基础页面路由；
- 实现基础布局；
- 实现应用启动页。

------

### 功能 2：网易云账号登录

需要完成：

- 集成 `NeteaseCloudMusicApiEnhanced/api-enhanced`；
- 封装网易云 API 适配层；
- 支持扫码登录；
- 支持获取二维码登录状态；
- 支持登录成功后获取用户信息；
- 支持检测当前登录态；
- 支持退出登录；
- 支持登录失败提示；
- 支持登录态过期提示。

------

### 功能 3：读取“我喜欢的音乐”

需要完成：

- 获取当前登录用户 ID；
- 获取“我喜欢的音乐”歌曲 ID 列表；
- 根据歌曲 ID 批量获取歌曲详情；
- 标准化歌曲数据结构；
- 处理歌曲详情获取失败的情况；
- 支持手动刷新；
- 支持展示最近同步时间。

------

### 功能 4：本地缓存

需要完成：

- 集成 SQLite；
- 设计用户表；
- 设计歌曲表；
- 设计歌单表；
- 设计歌单歌曲关联表；
- 保存当前用户信息；
- 保存“我喜欢的音乐”列表；
- 保存歌曲详情；
- 支持读取本地缓存；
- 支持清空缓存。

------

### 功能 5：歌曲列表展示

需要完成：

- 展示“我喜欢的音乐”歌曲表格；
- 展示歌曲名；
- 展示歌手；
- 展示专辑；
- 展示歌曲时长；
- 展示网易云歌曲 ID；
- 展示列表顺序；
- 支持搜索歌曲名；
- 支持搜索歌手；
- 支持表格加载状态；
- 支持空状态；
- 支持错误状态。

------

### 功能 6：数据导出

需要完成：

- 导出 CSV；
- 导出 JSON；
- 导出 Markdown；
- 支持选择导出路径；
- 支持导出全部歌曲；
- 支持导出当前筛选结果；
- 支持导出完成提示；
- 支持导出失败提示；
- 保存导出历史记录。

------

## 2.2 MVP 阶段暂不完成的功能

以下功能不进入 MVP：

- AI 音乐人格画像；
- AI 成长心路历程；
- AI 情绪分析；
- AI 自动生成子歌单；
- 自动创建网易云歌单；
- Apple Music 授权；
- Apple Music 歌曲匹配；
- Apple Music 歌单创建；
- 歌词分析；
- 封面缓存；
- 图片报告生成；
- PDF 导出；
- 自动更新；
- 多用户切换；
- 多平台音乐服务接入。

------

# 3. 推荐版本拆分

MVP 可以拆成 5 个小版本开发。

```text
v0.1.0 项目初始化
v0.1.1 网易云登录
v0.1.2 读取我喜欢的音乐
v0.1.3 本地缓存与歌曲列表
v0.1.4 数据导出与体验优化
```

------

# 4. v0.1.0 项目初始化任务

## 4.1 项目脚手架

任务：

- 创建项目仓库；
- 初始化 Electron + Vite + React + TypeScript；
- 配置 `package.json`；
- 配置开发启动命令；
- 配置生产构建命令；
- 配置 Electron 主进程入口；
- 配置 Electron preload 入口；
- 配置 React renderer 入口。

验收标准：

- 可以通过开发命令启动桌面应用；
- 应用窗口可以正常打开；
- React 页面可以正常渲染；
- 主进程和渲染进程没有明显报错。

------

## 4.2 TypeScript 与代码规范

任务：

- 配置 TypeScript；
- 配置 ESLint；
- 配置 Prettier；
- 配置路径别名；
- 配置基础类型目录；
- 配置 Git ignore；
- 配置基础 README。

验收标准：

- TypeScript 编译无错误；
- ESLint 可以正常运行；
- Prettier 可以格式化代码；
- 项目目录结构清晰。

------

## 4.3 基础目录结构

建议目录：

```text
WaveYourYarn
├── src
│   ├── main
│   │   ├── index.ts
│   │   ├── ipc
│   │   ├── adapters
│   │   ├── services
│   │   ├── db
│   │   └── utils
│   │
│   ├── preload
│   │   └── index.ts
│   │
│   └── renderer
│       ├── src
│       │   ├── pages
│       │   ├── components
│       │   ├── stores
│       │   ├── hooks
│       │   ├── api
│       │   ├── types
│       │   └── utils
│       └── index.html
│
├── docs
├── package.json
└── README.md
```

验收标准：

- 主进程、预加载脚本、渲染进程职责分离；
- 后续功能可以按模块继续扩展；
- 不把业务逻辑直接写在页面组件中。

------

## 4.4 基础 UI

任务：

- 配置 React Router；
- 创建基础 Layout；
- 创建侧边栏或顶部导航；
- 创建首页 Dashboard；
- 创建登录页；
- 创建“我喜欢的音乐”页面；
- 创建导出页面；
- 创建设置页；
- 创建 404 页面。

页面结构：

```text
首页 Dashboard
登录页
我喜欢的音乐页
导出页
设置页
```

验收标准：

- 页面之间可以正常跳转；
- 页面结构清晰；
- 基础布局可用；
- 暂无数据时有占位状态。

------

## 4.5 IPC 基础通信

任务：

- 在 preload 中暴露安全 API；
- 渲染进程不能直接访问 Node.js 能力；
- 创建基础 IPC handler；
- 实现一个测试 IPC，例如 `app:get-version`；
- 在前端页面调用测试 IPC。

建议结构：

```text
src/main/ipc/
├── app.ipc.ts
├── auth.ipc.ts
├── songs.ipc.ts
├── export.ipc.ts
└── index.ts
```

验收标准：

- 渲染进程可以通过 preload 调用主进程能力；
- IPC 调用有统一错误处理；
- 不直接暴露 Node.js 原生 API 给前端页面。

------

# 5. v0.1.1 网易云登录任务

## 5.1 集成 api-enhanced

任务：

- 安装 `NeteaseCloudMusicApiEnhanced/api-enhanced`；
- 验证项目中可以正常调用 API；
- 封装基础请求方法；
- 统一处理返回结果；
- 统一处理错误。

建议封装：

```text
src/main/adapters/ncm/
├── NCMAdapter.ts
├── NCMAuthService.ts
├── NCMUserService.ts
├── NCMSongService.ts
└── NCMPlaylistService.ts
```

验收标准：

- 可以在主进程中成功调用网易云相关接口；
- 不在前端页面中直接调用 api-enhanced；
- API 调用失败时有明确错误信息。

------

## 5.2 扫码登录

任务：

- 获取二维码 key；
- 获取二维码图片；
- 在前端登录页展示二维码；
- 轮询二维码状态；
- 处理等待扫码状态；
- 处理已扫码待确认状态；
- 处理登录成功状态；
- 处理二维码过期状态；
- 支持刷新二维码。

页面状态：

```text
等待扫码
已扫码，请在手机上确认
登录成功
二维码已过期，请刷新
登录失败
```

验收标准：

- 用户可以通过网易云手机客户端扫码登录；
- 登录状态可以实时更新；
- 二维码过期后可以重新获取；
- 登录成功后进入首页或 Dashboard。

------

## 5.3 登录态管理

任务：

- 保存登录后的 Cookie 或必要凭证；
- 检测当前登录状态；
- 应用启动时自动检查登录态；
- 登录过期时提示用户重新登录；
- 支持退出登录；
- 退出登录后清理本地登录态。

验收标准：

- 关闭应用后再次打开，可以识别之前是否登录；
- 登录过期时不会一直请求失败；
- 退出登录后不再显示用户数据。

------

## 5.4 用户信息读取

任务：

- 获取用户 ID；
- 获取用户昵称；
- 获取用户头像；
- 获取用户基础 profile；
- 前端 Dashboard 展示用户信息；
- 本地保存用户信息。

用户信息字段：

```ts
interface NCMUserProfile {
  userId: string
  nickname: string
  avatarUrl?: string
  signature?: string
}
```

验收标准：

- 登录成功后可以显示用户昵称和头像；
- 可以拿到用户 ID；
- 用户 ID 可以用于后续读取“我喜欢的音乐”。

------

# 6. v0.1.2 读取“我喜欢的音乐”任务

## 6.1 获取喜欢歌曲 ID 列表

任务：

- 使用当前用户 ID 请求喜欢歌曲列表；
- 获取歌曲 ID 数组；
- 保存歌曲 ID 顺序；
- 处理空列表；
- 处理接口请求失败；
- 处理登录态失效。

建议标准化结构：

```ts
interface LikedSongIdItem {
  ncmSongId: string
  orderIndex: number
}
```

验收标准：

- 可以获取当前用户“我喜欢的音乐”歌曲 ID；
- 可以正确统计歌曲数量；
- 可以保留接口返回顺序。

------

## 6.2 批量获取歌曲详情

任务：

- 根据歌曲 ID 批量请求歌曲详情；
- 支持分批请求，避免一次请求过大；
- 合并歌曲详情和 orderIndex；
- 处理部分歌曲详情缺失；
- 记录失败歌曲 ID；
- 支持重试失败项。

建议歌曲结构：

```ts
interface Song {
  id: string
  ncmSongId: string
  name: string
  artists: string[]
  album?: string
  duration?: number
  coverUrl?: string
  alias?: string[]
  orderIndex?: number
  rawData?: unknown
  createdAt: string
  updatedAt: string
}
```

验收标准：

- 可以根据喜欢歌曲 ID 获取歌曲名、歌手、专辑等信息；
- 部分歌曲获取失败不会导致整个任务失败；
- 可以展示成功数量和失败数量。

------

## 6.3 同步任务状态

任务：

- 设计同步任务状态；
- 前端显示同步进度；
- 显示当前正在处理的批次；
- 显示成功数量；
- 显示失败数量；
- 支持同步完成提示；
- 支持同步失败提示。

任务状态示例：

```ts
interface SyncLikedSongsTask {
  status: 'idle' | 'running' | 'success' | 'failed'
  total: number
  finished: number
  successCount: number
  failedCount: number
  message?: string
}
```

验收标准：

- 用户点击“同步我喜欢的音乐”后，可以看到任务进度；
- 同步完成后可以进入歌曲列表页面查看结果；
- 同步失败时有明确提示。

------

# 7. v0.1.3 本地缓存与歌曲列表任务

## 7.1 SQLite 初始化

任务：

- 安装 SQLite 相关依赖；
- 初始化数据库文件；
- 设置数据库保存路径；
- 创建数据库连接；
- 创建 migration 机制；
- 应用启动时自动初始化数据库。

建议保存位置：

```text
用户应用数据目录 / WaveYourYarn / waveyouryarn.db
```

验收标准：

- 应用启动时可以自动创建数据库；
- 数据库文件保存在用户本地目录；
- 数据库初始化失败时有错误提示。

------

## 7.2 数据表设计

MVP 阶段至少需要以下表：

```text
users
songs
playlists
playlist_songs
export_records
app_settings
```

------

### users 表

字段建议：

```sql
id TEXT PRIMARY KEY
ncm_user_id TEXT NOT NULL
nickname TEXT NOT NULL
avatar_url TEXT
raw_data TEXT
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
```

------

### songs 表

字段建议：

```sql
id TEXT PRIMARY KEY
ncm_song_id TEXT NOT NULL UNIQUE
name TEXT NOT NULL
artists_json TEXT NOT NULL
album TEXT
duration INTEGER
cover_url TEXT
alias_json TEXT
raw_data TEXT
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
```

------

### playlists 表

字段建议：

```sql
id TEXT PRIMARY KEY
ncm_playlist_id TEXT NOT NULL
name TEXT NOT NULL
description TEXT
cover_url TEXT
track_count INTEGER
type TEXT NOT NULL
raw_data TEXT
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
```

------

### playlist_songs 表

字段建议：

```sql
id TEXT PRIMARY KEY
playlist_id TEXT NOT NULL
song_id TEXT NOT NULL
order_index INTEGER
created_at TEXT NOT NULL
```

------

### export_records 表

字段建议：

```sql
id TEXT PRIMARY KEY
export_type TEXT NOT NULL
file_path TEXT NOT NULL
song_count INTEGER NOT NULL
created_at TEXT NOT NULL
```

------

### app_settings 表

字段建议：

```sql
id TEXT PRIMARY KEY
key TEXT NOT NULL UNIQUE
value TEXT
updated_at TEXT NOT NULL
```

验收标准：

- 所有表可以正常创建；
- 歌曲可以保存；
- 歌曲可以更新；
- 歌曲和歌单关联可以保存；
- 导出记录可以保存。

------

## 7.3 Repository 封装

任务：

- 创建 UserRepository；
- 创建 SongRepository；
- 创建 PlaylistRepository；
- 创建 ExportRecordRepository；
- 创建 SettingsRepository；
- 避免业务代码直接写 SQL；
- 提供基础 CRUD 方法。

建议目录：

```text
src/main/db/repositories/
├── UserRepository.ts
├── SongRepository.ts
├── PlaylistRepository.ts
├── ExportRecordRepository.ts
└── SettingsRepository.ts
```

验收标准：

- 业务服务层通过 Repository 操作数据库；
- 数据库逻辑和业务逻辑分离；
- 后续更换数据库实现时影响较小。

------

## 7.4 保存“我喜欢的音乐”

任务：

- 创建或更新“我喜欢的音乐”虚拟歌单；
- 保存歌曲详情；
- 保存歌曲与喜欢歌单的关联；
- 保存歌曲顺序；
- 保存最近同步时间；
- 支持重复同步时更新已有数据。

验收标准：

- 同步完成后关闭应用再打开，歌曲数据仍然存在；
- 重复同步不会产生重复歌曲；
- 歌曲顺序可以保持。

------

## 7.5 歌曲列表页面

任务：

- 从本地数据库读取歌曲；
- 展示歌曲表格；
- 支持加载状态；
- 支持空状态；
- 支持错误状态；
- 支持刷新按钮；
- 支持同步按钮；
- 支持显示最近同步时间。

表格字段：

```text
序号
歌名
歌手
专辑
时长
网易云 ID
```

验收标准：

- 可以展示本地缓存的喜欢歌曲；
- 歌曲数量正确；
- 歌曲信息显示清晰；
- 无数据时提示用户先同步。

------

## 7.6 搜索与筛选

任务：

- 支持按歌名搜索；
- 支持按歌手搜索；
- 支持按专辑搜索；
- 支持清空搜索条件；
- 支持显示筛选后的歌曲数量；
- 支持导出当前筛选结果。

验收标准：

- 输入关键词后表格可以正确过滤；
- 清空关键词后恢复全部歌曲；
- 当前筛选结果可以传递给导出功能。

------

# 8. v0.1.4 数据导出与体验优化任务

## 8.1 CSV 导出

任务：

- 将歌曲列表转换为 CSV；
- 处理逗号、换行、引号等特殊字符；
- 支持 UTF-8；
- 支持选择导出路径；
- 支持导出全部歌曲；
- 支持导出筛选结果。

CSV 字段：

```text
序号
歌名
歌手
专辑
时长
网易云歌曲ID
封面链接
```

验收标准：

- 导出的 CSV 可以用 Excel、Numbers 或文本编辑器打开；
- 中文内容不乱码；
- 字段顺序正确；
- 特殊字符不会破坏 CSV 格式。

------

## 8.2 JSON 导出

任务：

- 将歌曲列表转换为 JSON；
- 支持格式化输出；
- 支持保留标准化字段；
- 可选是否包含 rawData；
- 支持选择导出路径。

JSON 结构示例：

```json
{
  "source": "Netease Cloud Music",
  "playlist": "我喜欢的音乐",
  "exportedAt": "2026-06-30T00:00:00.000Z",
  "count": 2,
  "songs": [
    {
      "ncmSongId": "123",
      "name": "歌曲 A",
      "artists": ["歌手 A"],
      "album": "专辑 A",
      "duration": 240000,
      "orderIndex": 1
    }
  ]
}
```

验收标准：

- 导出的 JSON 格式正确；
- 可以被重新解析；
- 包含导出时间和歌曲数量。

------

## 8.3 Markdown 导出

任务：

- 将歌曲列表转换为 Markdown 表格；
- 支持导出标题；
- 支持导出统计信息；
- 支持导出歌曲表格；
- 支持选择导出路径。

Markdown 示例：

```md
# 网易云我喜欢的音乐导出

导出时间：2026-06-30  
歌曲数量：100

| 序号 | 歌名 | 歌手 | 专辑 | 时长 |
|---|---|---|---|---|
| 1 | 歌曲 A | 歌手 A | 专辑 A | 04:00 |
```

验收标准：

- Markdown 文件可以正常预览；
- 表格格式正确；
- 中文内容正常显示。

------

## 8.4 导出历史

任务：

- 每次导出后保存导出记录；
- 记录导出类型；
- 记录导出路径；
- 记录导出歌曲数量；
- 记录导出时间；
- 在导出页面展示最近导出记录。

验收标准：

- 导出完成后可以看到历史记录；
- 点击历史路径可以打开文件或所在目录；
- 导出失败不应写入成功记录。

------

## 8.5 设置页

MVP 设置页需要包含：

- 当前网易云登录状态；
- 退出登录按钮；
- 清空本地缓存按钮；
- 默认导出路径设置；
- 关于 WaveYourYarn；
- 当前应用版本。

验收标准：

- 用户可以在设置页查看基础状态；
- 用户可以清空缓存；
- 用户可以退出登录；
- 用户可以查看应用版本。

------

## 8.6 基础错误处理

需要处理的错误：

```text
未登录
登录过期
二维码过期
网络错误
网易云接口请求失败
歌曲详情获取失败
数据库初始化失败
数据库写入失败
导出路径无权限
导出文件写入失败
```

错误提示原则：

- 不能只显示 `Error`；
- 需要告诉用户发生了什么；
- 尽量告诉用户可以怎么处理；
- 对开发者保留详细日志。

示例：

```text
同步失败：当前网易云登录状态已过期，请重新登录后再试。
```

------

## 8.7 基础日志

任务：

- 主进程记录关键任务日志；
- 记录登录状态变化；
- 记录同步任务开始和结束；
- 记录导出任务开始和结束；
- 记录错误堆栈；
- 日志中不能输出 Cookie、Token、API Key 等敏感信息。

验收标准：

- 出现问题时可以通过日志定位；
- 日志不泄露敏感信息。

------

# 9. MVP IPC 接口清单

## 9.1 Auth IPC

```ts
auth:getLoginQr
auth:checkQrStatus
auth:getLoginStatus
auth:getCurrentUser
auth:logout
```

------

## 9.2 Songs IPC

```ts
songs:syncLikedSongs
songs:getLikedSongs
songs:searchLikedSongs
songs:getSyncStatus
songs:clearLikedSongsCache
```

------

## 9.3 Export IPC

```ts
export:exportCsv
export:exportJson
export:exportMarkdown
export:getExportRecords
export:openExportFile
export:openExportFolder
```

------

## 9.4 Settings IPC

```ts
settings:get
settings:set
settings:getAll
settings:clearCache
settings:getAppInfo
```

------

# 10. MVP 前端页面任务清单

## 10.1 Dashboard 首页

展示内容：

- 应用名称；
- 项目一句话介绍；
- 当前登录用户；
- 喜欢歌曲数量；
- 最近同步时间；
- 最近导出记录；
- 快捷按钮。

快捷按钮：

```text
登录网易云
同步我喜欢的音乐
查看歌曲列表
导出歌曲
```

------

## 10.2 登录页

展示内容：

- 二维码；
- 登录状态；
- 刷新二维码按钮；
- 登录成功提示；
- 登录失败提示。

状态：

```text
未登录
等待扫码
已扫码待确认
登录成功
二维码过期
登录失败
```

------

## 10.3 我喜欢的音乐页

展示内容：

- 同步按钮；
- 最近同步时间；
- 歌曲总数；
- 搜索框；
- 歌曲表格；
- 当前筛选数量；
- 导出当前结果按钮。

------

## 10.4 导出页

展示内容：

- 选择导出范围；
- 选择导出格式；
- 选择导出路径；
- 导出按钮；
- 导出历史记录；
- 打开文件；
- 打开所在目录。

------

## 10.5 设置页

展示内容：

- 当前用户信息；
- 当前登录状态；
- 默认导出路径；
- 清空缓存；
- 退出登录；
- 关于项目。

------

# 11. MVP 数据类型定义

## 11.1 用户类型

```ts
export interface UserProfile {
  id: string
  ncmUserId: string
  nickname: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}
```

------

## 11.2 歌曲类型

```ts
export interface Song {
  id: string
  ncmSongId: string
  name: string
  artists: string[]
  album?: string
  duration?: number
  coverUrl?: string
  alias?: string[]
  orderIndex?: number
  rawData?: unknown
  createdAt: string
  updatedAt: string
}
```

------

## 11.3 歌曲同步结果

```ts
export interface SyncLikedSongsResult {
  total: number
  successCount: number
  failedCount: number
  failedSongIds: string[]
  syncedAt: string
}
```

------

## 11.4 导出选项

```ts
export interface ExportOptions {
  format: 'csv' | 'json' | 'markdown'
  scope: 'all' | 'filtered'
  filePath: string
  includeRawData?: boolean
}
```

------

## 11.5 导出记录

```ts
export interface ExportRecord {
  id: string
  exportType: 'csv' | 'json' | 'markdown'
  filePath: string
  songCount: number
  createdAt: string
}
```

------

# 12. MVP 验收标准

MVP 完成时，应该满足以下标准。

## 12.1 基础应用

- 应用可以在 macOS 上启动；
- 页面可以正常切换；
- 没有明显白屏或崩溃；
- 开发环境和构建命令可用。

------

## 12.2 网易云登录

- 用户可以扫码登录网易云；
- 登录成功后可以看到昵称和头像；
- 应用重启后可以识别登录状态；
- 用户可以退出登录；
- 登录过期时可以提示重新登录。

------

## 12.3 数据同步

- 可以读取“我喜欢的音乐”歌曲 ID；
- 可以批量获取歌曲详情；
- 可以保存到本地 SQLite；
- 可以展示歌曲总数；
- 可以展示歌曲列表；
- 部分歌曲失败不会导致整个同步失败。

------

## 12.4 歌曲列表

- 可以查看歌曲名、歌手、专辑、时长、网易云 ID；
- 可以按歌名搜索；
- 可以按歌手搜索；
- 可以查看当前筛选数量；
- 可以刷新数据。

------

## 12.5 数据导出

- 可以导出 CSV；
- 可以导出 JSON；
- 可以导出 Markdown；
- 可以选择导出路径；
- 可以导出全部歌曲；
- 可以导出筛选结果；
- 导出后可以查看历史记录；
- 中文内容不乱码。

------

## 12.6 错误处理

- 未登录时不能直接同步；
- 登录过期时有提示；
- 网络错误时有提示；
- 数据库错误时有提示；
- 导出失败时有提示；
- 日志不泄露敏感信息。

------

# 13. MVP 开发优先级

## P0：必须完成

```text
项目初始化
Electron 基础框架
IPC 通信
api-enhanced 集成
网易云扫码登录
用户信息获取
喜欢歌曲 ID 获取
歌曲详情获取
SQLite 本地缓存
歌曲列表展示
CSV / JSON / Markdown 导出
基础错误处理
```

------

## P1：建议完成

```text
搜索筛选
导出历史
默认导出路径
同步进度展示
失败歌曲记录
清空缓存
退出登录
应用基础设置页
```

------

## P2：可以延后

```text
表格排序
封面展示
高级筛选
导出字段自定义
暗色主题
日志查看页面
数据备份
应用自动更新
```

------

# 14. 不进入 MVP 的后续功能入口预留

虽然 MVP 不实现 AI 和 Apple Music，但代码结构可以提前预留入口。

## 14.1 LLM Adapter 预留

```text
src/main/adapters/llm/
```

暂时只保留目录，不实现具体逻辑。

------

## 14.2 Apple Music Adapter 预留

```text
src/main/adapters/apple-music/
```

暂时只保留目录，不实现具体逻辑。

------

## 14.3 Playlist Organizer Service 预留

```text
src/main/services/PlaylistOrganizeService.ts
```

暂时不接入页面。

------

# 15. MVP 推荐开发顺序

## 第一步：搭建项目

```text
Electron + React + TypeScript
基础页面
基础 IPC
```

完成后应用应该可以正常启动和跳转页面。

------

## 第二步：接入 api-enhanced

```text
安装 api-enhanced
主进程调用测试
封装 NCMAdapter
```

完成后应可以在主进程里调用网易云 API。

------

## 第三步：实现登录

```text
二维码生成
二维码状态轮询
登录成功获取用户信息
登录态保存
退出登录
```

完成后应可以在应用里登录网易云账号。

------

## 第四步：读取喜欢歌曲

```text
获取用户 ID
获取喜欢歌曲 ID
批量获取歌曲详情
标准化歌曲结构
```

完成后应可以在控制台或页面看到完整歌曲列表。

------

## 第五步：接入 SQLite

```text
初始化数据库
创建表
保存用户信息
保存歌曲信息
保存喜欢歌单关系
```

完成后应可以关闭应用再打开仍然看到缓存数据。

------

## 第六步：实现歌曲列表页

```text
读取本地歌曲
表格展示
搜索筛选
同步按钮
同步状态
```

完成后用户可以正常浏览自己的喜欢歌曲。

------

## 第七步：实现导出

```text
CSV 导出
JSON 导出
Markdown 导出
导出历史
打开导出文件
```

完成后 MVP 核心功能闭环完成。

------

## 第八步：补齐错误处理和体验

```text
加载状态
空状态
错误提示
登录过期
同步失败
导出失败
基础日志
```

完成后可以准备发布第一个 GitHub 预览版。

------

# 16. MVP 完成后的下一步

MVP 完成后，下一阶段建议进入：

```text
v0.2 本地音乐数据中心
```

重点开发：

- 用户创建歌单读取；
- 用户收藏歌单读取；
- 指定歌单导出；
- 高频歌手统计；
- 高频专辑统计；
- 基础数据可视化。

再之后进入：

```text
v0.3 AI 音乐报告
v0.4 AI 自动整理子歌单
v1.0 Apple Music 迁移助手
```
