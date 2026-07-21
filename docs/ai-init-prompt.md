# WaveYourYarn 项目初始化提示词

> 文档状态：历史初始化提示词
>
> 本文记录项目启动时的原始设想，不再作为当前路线或验收依据。当前主路线见 `docs/project-roadmap.md`，v1.0/v2.0 范围调整见 `docs/v1-v2-scope-decisions.md`。

你现在需要帮助我初始化一个桌面端开源项目，项目名称为 **WaveYourYarn**。

项目含义是：

> 让你的音乐故事像声波一样荡漾开来。

这是一个基于 Electron 的个人音乐数据工具平台，第一阶段 MVP 的目标是：

```text
网易云账号登录
  ↓
读取网易云音乐“我喜欢的音乐”
  ↓
批量获取歌曲详情
  ↓
本地 SQLite 缓存
  ↓
桌面端展示歌曲列表
  ↓
导出 CSV / JSON / Markdown
```

当前任务不是实现所有业务功能，而是**完成项目初始化和基础架构搭建**，为后续开发 MVP 功能打好工程基础。

------

# 1. 项目定位

WaveYourYarn 不是第三方网易云播放器，也不是音乐下载工具。

它的定位是：

> 一个面向个人音乐数据的桌面端工具平台，用于导出、分析、整理和迁移用户自己的音乐偏好数据。

后续功能包括：

- 导出网易云“我喜欢的音乐”；
- 读取和管理用户歌单；
- 接入大模型 API 生成音乐人格画像；
- 根据喜欢歌曲生成成长心路历程；
- 使用 AI 自动整理子歌单；
- 自动在网易云创建整理后的新歌单；
- 最后阶段支持迁移到 Apple Music。

但本次初始化阶段只需要关注：

```text
Electron 桌面应用基础框架
React 前端页面骨架
TypeScript 工程配置
IPC 通信基础封装
SQLite 接入准备
NeteaseCloudMusicApiEnhanced/api-enhanced 接入准备
项目目录结构
基础页面
基础类型定义
基础服务层结构
```

------

# 2. 技术栈要求

请使用以下技术栈初始化项目：

```text
桌面框架：Electron
前端框架：React
开发语言：TypeScript
构建工具：Vite
UI 样式：Tailwind CSS
组件库：shadcn/ui，可以先搭建基础结构，组件后续逐步补充
状态管理：Zustand
本地数据库：SQLite，推荐 better-sqlite3
网易云 API：NeteaseCloudMusicApiEnhanced/api-enhanced
导出格式：CSV / JSON / Markdown
```

优先支持 macOS 开发环境，但项目结构应保留跨平台能力。

------

# 3. 初始化目标

本次初始化完成后，项目应该满足以下标准：

1. 可以通过命令启动 Electron 桌面应用；
2. Electron 主进程、preload、renderer 三部分结构清晰；
3. React 页面可以正常渲染；
4. 页面之间可以正常跳转；
5. Tailwind CSS 可以正常使用；
6. TypeScript 类型检查可以正常运行；
7. ESLint / Prettier 可以正常使用；
8. preload 中暴露安全的 IPC API；
9. renderer 不能直接访问 Node.js API；
10. 主进程中预留 NCM Adapter、SQLite、导出服务等模块；
11. 可以通过一个测试 IPC 从 renderer 调用 main；
12. 项目目录结构适合继续开发后续 MVP 功能。

------

# 4. 项目基础目录结构

请按照以下结构创建项目：

```text
WaveYourYarn
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── README.md
│
├── docs
│   ├── system-design.md
│   ├── mvp-task-list.md
│   └── ai-init-prompt.md
│
├── src
│   ├── main
│   │   ├── index.ts
│   │   ├── ipc
│   │   │   ├── index.ts
│   │   │   ├── app.ipc.ts
│   │   │   ├── auth.ipc.ts
│   │   │   ├── songs.ipc.ts
│   │   │   ├── export.ipc.ts
│   │   │   └── settings.ipc.ts
│   │   │
│   │   ├── adapters
│   │   │   ├── ncm
│   │   │   │   ├── NCMAdapter.ts
│   │   │   │   ├── NCMAuthService.ts
│   │   │   │   ├── NCMUserService.ts
│   │   │   │   ├── NCMSongService.ts
│   │   │   │   └── NCMPlaylistService.ts
│   │   │   │
│   │   │   ├── llm
│   │   │   │   └── README.md
│   │   │   │
│   │   │   └── apple-music
│   │   │       └── README.md
│   │   │
│   │   ├── services
│   │   │   ├── AuthService.ts
│   │   │   ├── SongService.ts
│   │   │   ├── PlaylistService.ts
│   │   │   ├── ExportService.ts
│   │   │   └── SettingsService.ts
│   │   │
│   │   ├── db
│   │   │   ├── database.ts
│   │   │   ├── migrations
│   │   │   │   └── 001_init.sql
│   │   │   └── repositories
│   │   │       ├── UserRepository.ts
│   │   │       ├── SongRepository.ts
│   │   │       ├── PlaylistRepository.ts
│   │   │       ├── ExportRecordRepository.ts
│   │   │       └── SettingsRepository.ts
│   │   │
│   │   ├── types
│   │   │   ├── user.ts
│   │   │   ├── song.ts
│   │   │   ├── playlist.ts
│   │   │   ├── export.ts
│   │   │   └── common.ts
│   │   │
│   │   └── utils
│   │       ├── logger.ts
│   │       ├── paths.ts
│   │       ├── errors.ts
│   │       └── time.ts
│   │
│   ├── preload
│   │   ├── index.ts
│   │   └── types.ts
│   │
│   └── renderer
│       ├── index.html
│       └── src
│           ├── main.tsx
│           ├── App.tsx
│           ├── routes.tsx
│           ├── styles
│           │   └── globals.css
│           │
│           ├── pages
│           │   ├── DashboardPage.tsx
│           │   ├── LoginPage.tsx
│           │   ├── LikedSongsPage.tsx
│           │   ├── ExportPage.tsx
│           │   ├── SettingsPage.tsx
│           │   └── NotFoundPage.tsx
│           │
│           ├── components
│           │   ├── layout
│           │   │   ├── AppLayout.tsx
│           │   │   ├── Sidebar.tsx
│           │   │   └── Topbar.tsx
│           │   │
│           │   └── common
│           │       ├── EmptyState.tsx
│           │       ├── ErrorState.tsx
│           │       ├── LoadingState.tsx
│           │       └── PageHeader.tsx
│           │
│           ├── stores
│           │   ├── authStore.ts
│           │   ├── songStore.ts
│           │   └── appStore.ts
│           │
│           ├── api
│           │   ├── appApi.ts
│           │   ├── authApi.ts
│           │   ├── songsApi.ts
│           │   ├── exportApi.ts
│           │   └── settingsApi.ts
│           │
│           ├── types
│           │   ├── user.ts
│           │   ├── song.ts
│           │   ├── export.ts
│           │   └── preload.d.ts
│           │
│           └── utils
│               ├── format.ts
│               └── constants.ts
```

如果使用的 Electron 模板生成的默认结构略有不同，可以在不破坏职责划分的前提下适当调整，但必须保持：

```text
main 主进程
preload 安全桥接层
renderer React 前端
adapters 外部服务适配层
services 业务服务层
db 本地数据库层
ipc 主进程接口层
```

------

# 5. package.json 脚本要求

请配置常用命令：

```json
{
  "scripts": {
    "dev": "启动 Electron 开发环境",
    "build": "构建应用",
    "preview": "预览构建结果",
    "typecheck": "运行 TypeScript 类型检查",
    "lint": "运行 ESLint",
    "format": "运行 Prettier 格式化",
    "db:init": "初始化本地数据库，若暂时不需要可保留占位"
  }
}
```

具体命令请根据实际 Electron + Vite 模板配置。

------

# 6. Electron 主进程要求

主进程入口文件：

```text
src/main/index.ts
```

需要完成：

- 创建 Electron BrowserWindow；
- 配置窗口标题为 `WaveYourYarn`；
- 设置合理的默认窗口大小，例如 1200x800；
- 开发环境加载 Vite dev server；
- 生产环境加载打包后的 HTML；
- 注册所有 IPC handlers；
- 初始化应用数据目录；
- 初始化 SQLite 数据库；
- 捕获主进程常见错误；
- 不在日志中输出敏感信息。

窗口基础要求：

```text
title: WaveYourYarn
width: 1200
height: 800
minWidth: 960
minHeight: 640
```

安全要求：

```text
nodeIntegration: false
contextIsolation: true
sandbox: false 或根据模板推荐配置
preload: 指向 src/preload/index.ts
```

------

# 7. preload 要求

preload 文件：

```text
src/preload/index.ts
```

需要通过 `contextBridge` 暴露安全 API。

不要把 Node.js 原生能力直接暴露给 renderer。

推荐暴露结构：

```ts
window.waveYourYarn = {
  app: {
    getVersion: () => Promise<string>,
    ping: () => Promise<string>
  },

  auth: {
    getLoginStatus: () => Promise<unknown>,
    getCurrentUser: () => Promise<unknown>,
    logout: () => Promise<void>
  },

  songs: {
    syncLikedSongs: () => Promise<unknown>,
    getLikedSongs: () => Promise<unknown>,
    searchLikedSongs: (keyword: string) => Promise<unknown>
  },

  export: {
    exportCsv: (options: unknown) => Promise<unknown>,
    exportJson: (options: unknown) => Promise<unknown>,
    exportMarkdown: (options: unknown) => Promise<unknown>,
    getExportRecords: () => Promise<unknown>
  },

  settings: {
    get: (key: string) => Promise<unknown>,
    set: (key: string, value: string) => Promise<void>,
    getAll: () => Promise<unknown>
  }
}
```

当前初始化阶段只需要 `app.ping` 和 `app.getVersion` 能正常工作，其他 API 可以先返回 mock 数据或 `not implemented`。

------

# 8. IPC 设计要求

IPC 文件放在：

```text
src/main/ipc/
```

请实现一个统一注册入口：

```ts
registerIpcHandlers()
```

并在主进程启动时调用。

MVP 规划中的 IPC 包括：

```ts
// app.ipc.ts
app:get-version
app:ping

// auth.ipc.ts
auth:get-login-status
auth:get-current-user
auth:logout

// songs.ipc.ts
songs:sync-liked-songs
songs:get-liked-songs
songs:search-liked-songs

// export.ipc.ts
export:csv
export:json
export:markdown
export:get-records

// settings.ipc.ts
settings:get
settings:set
settings:get-all
```

初始化阶段必须实现：

```text
app:get-version
app:ping
```

其他 IPC 可以先注册占位逻辑，返回：

```ts
{
  success: false,
  message: 'Not implemented yet'
}
```

所有 IPC 返回值建议统一结构：

```ts
export interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}
```

------

# 9. React 前端要求

前端放在：

```text
src/renderer/src
```

需要实现基础页面：

```text
DashboardPage
LoginPage
LikedSongsPage
ExportPage
SettingsPage
NotFoundPage
```

需要实现基础布局：

```text
AppLayout
Sidebar
Topbar
```

页面导航建议：

```text
/
  Dashboard 首页

/login
  网易云登录

/liked-songs
  我喜欢的音乐

/export
  数据导出

/settings
  设置
```

------

# 10. 页面内容要求

## 10.1 DashboardPage

展示：

- 项目名称：WaveYourYarn；
- 项目标语：让你的音乐故事像声波一样荡漾开来；
- 当前版本；
- 当前登录状态，占位即可；
- 喜欢歌曲数量，占位即可；
- 最近同步时间，占位即可；
- 快捷入口按钮。

按钮：

```text
连接网易云
同步我喜欢的音乐
查看歌曲列表
导出歌曲数据
```

当前按钮只需要能跳转页面，不需要真实业务。

------

## 10.2 LoginPage

展示：

- 网易云登录标题；
- 登录说明；
- 二维码占位区域；
- 登录状态占位；
- 刷新二维码按钮；
- 返回首页按钮。

目前可以先写 mock 状态：

```text
登录功能将在接入 api-enhanced 后启用。
```

------

## 10.3 LikedSongsPage

展示：

- 页面标题：我喜欢的音乐；
- 同步按钮；
- 搜索框；
- 歌曲表格占位；
- 空状态提示。

表格列：

```text
序号
歌名
歌手
专辑
时长
网易云 ID
```

可以先放几条 mock 数据，或者显示空状态。

------

## 10.4 ExportPage

展示：

- 页面标题：数据导出；
- 导出格式选择；
- 导出范围选择；
- 导出路径占位；
- 导出按钮；
- 导出历史占位。

格式包括：

```text
CSV
JSON
Markdown
```

------

## 10.5 SettingsPage

展示：

- 应用信息；
- 当前版本；
- 网易云登录状态；
- 默认导出路径；
- 清空缓存按钮；
- 关于项目。

当前可以先使用 mock 数据。

------

# 11. UI 风格要求

整体风格建议：

```text
简洁
柔和
现代
有音乐感
适合桌面工具
```

可以采用：

- 左侧 Sidebar；
- 顶部 Topbar；
- 主内容卡片；
- 大量留白；
- 轻微圆角；
- 支持后续暗色主题。

颜色不需要过度复杂，先保证布局清晰。

------

# 12. Zustand 状态管理要求

请创建基础 store。

## 12.1 authStore

字段建议：

```ts
interface AuthState {
  isLoggedIn: boolean
  user: UserProfile | null
  loading: boolean
  error: string | null
}
```

方法占位：

```ts
checkLoginStatus()
logout()
setUser()
```

------

## 12.2 songStore

字段建议：

```ts
interface SongState {
  likedSongs: Song[]
  loading: boolean
  syncing: boolean
  keyword: string
  error: string | null
}
```

方法占位：

```ts
loadLikedSongs()
syncLikedSongs()
setKeyword()
```

------

## 12.3 appStore

字段建议：

```ts
interface AppState {
  appVersion: string
  sidebarCollapsed: boolean
}
```

方法：

```ts
loadAppVersion()
toggleSidebar()
```

------

# 13. 类型定义要求

请在 main 和 renderer 中定义清晰类型。可以先重复定义，后续再考虑提取 shared 目录。

基础类型：

```ts
export interface UserProfile {
  id: string
  ncmUserId: string
  nickname: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}
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
export interface ExportRecord {
  id: string
  exportType: 'csv' | 'json' | 'markdown'
  filePath: string
  songCount: number
  createdAt: string
}
export interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}
```

------

# 14. SQLite 初始化要求

初始化阶段需要先搭好数据库基础结构，但可以不实现完整业务写入。

请创建：

```text
src/main/db/database.ts
src/main/db/migrations/001_init.sql
```

`001_init.sql` 至少包含以下表：

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  ncm_user_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  raw_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  ncm_song_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  artists_json TEXT NOT NULL,
  album TEXT,
  duration INTEGER,
  cover_url TEXT,
  alias_json TEXT,
  raw_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  ncm_playlist_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  track_count INTEGER,
  type TEXT NOT NULL,
  raw_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  order_index INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id),
  FOREIGN KEY (song_id) REFERENCES songs(id)
);

CREATE TABLE IF NOT EXISTS export_records (
  id TEXT PRIMARY KEY,
  export_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  song_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TEXT NOT NULL
);
```

数据库文件应保存在 Electron 的用户数据目录中。

请封装：

```ts
getDatabase()
initDatabase()
closeDatabase()
```

初始化阶段只要能在应用启动时创建数据库文件和数据表即可。

------

# 15. Repository 占位要求

请创建以下 Repository 文件并写入基础类结构：

```text
UserRepository.ts
SongRepository.ts
PlaylistRepository.ts
ExportRecordRepository.ts
SettingsRepository.ts
```

每个 Repository 可以先实现基础方法占位，例如：

```ts
findAll()
findById()
create()
update()
delete()
```

当前不需要实现所有复杂逻辑，但不要留空文件。

------

# 16. NCM Adapter 占位要求

请创建：

```text
src/main/adapters/ncm/
```

并实现基础类结构。

## 16.1 NCMAdapter.ts

职责：

- 作为网易云 API 的统一出口；
- 聚合 Auth、User、Song、Playlist 服务；
- 后续所有业务服务都通过该 Adapter 访问网易云。

初始化阶段可以先返回 mock 或抛出 `Not implemented yet`。

## 16.2 NCMAuthService.ts

预留方法：

```ts
getQrKey()
createQrCode()
checkQrStatus()
getLoginStatus()
logout()
```

## 16.3 NCMUserService.ts

预留方法：

```ts
getCurrentUser()
getUserProfile(userId: string)
```

## 16.4 NCMSongService.ts

预留方法：

```ts
getLikedSongIds(userId: string)
getSongDetails(songIds: string[])
```

## 16.5 NCMPlaylistService.ts

预留方法：

```ts
getUserPlaylists(userId: string)
getPlaylistDetail(playlistId: string)
createPlaylist(name: string, description?: string)
addSongsToPlaylist(playlistId: string, songIds: string[])
```

------

# 17. Service 层占位要求

请创建以下服务：

```text
AuthService.ts
SongService.ts
PlaylistService.ts
ExportService.ts
SettingsService.ts
```

当前初始化阶段可以先使用 mock 逻辑。

职责划分：

```text
AuthService
  负责登录状态、当前用户、退出登录

SongService
  负责同步喜欢歌曲、读取本地歌曲、搜索歌曲

PlaylistService
  负责读取歌单，后续负责创建歌单

ExportService
  负责 CSV / JSON / Markdown 导出

SettingsService
  负责应用设置读写
```

------

# 18. ExportService 初始化要求

虽然 MVP 后续才实现完整导出，但初始化阶段请先创建基础结构。

需要预留方法：

```ts
exportCsv(songs: Song[], filePath: string)
exportJson(songs: Song[], filePath: string, includeRawData?: boolean)
exportMarkdown(songs: Song[], filePath: string)
```

可以先返回 `Not implemented yet`，但方法签名要明确。

后续导出字段包括：

```text
序号
歌名
歌手
专辑
时长
网易云歌曲 ID
封面链接
```

------

# 19. 工具函数要求

请创建以下工具函数文件：

## 19.1 logger.ts

提供：

```ts
logger.info()
logger.warn()
logger.error()
```

要求：

- 初始化阶段可以简单封装 console；
- 后续可以替换为 electron-log；
- 不要输出 Cookie、Token、API Key。

## 19.2 paths.ts

提供：

```ts
getUserDataPath()
getDatabasePath()
getDefaultExportPath()
```

## 19.3 errors.ts

提供：

```ts
AppError
createErrorResult()
createSuccessResult()
```

## 19.4 time.ts

提供：

```ts
formatDateTime()
nowISOString()
```

------

# 20. README 要求

请生成基础 README，内容包括：

```text
项目名称
项目简介
项目定位
当前 MVP 目标
技术栈
开发环境启动方式
项目目录结构
当前开发阶段
后续路线图
```

README 中需要明确说明：

```text
WaveYourYarn 当前不是播放器，不提供音乐下载能力。
当前阶段目标是读取和导出用户自己的网易云音乐数据。
```

------

# 21. docs 要求

请创建 docs 目录，并预留：

```text
system-design.md
mvp-task-list.md
ai-init-prompt.md
```

其中：

- `system-design.md` 可以先写项目说明和架构概述；
- `mvp-task-list.md` 可以先写 MVP 开发阶段列表；
- `ai-init-prompt.md` 可以放本提示词内容或占位说明。

------

# 22. 代码质量要求

请遵守以下要求：

1. 使用 TypeScript，不要使用 any，确实无法确定时使用 unknown；
2. 不要把业务逻辑写死在 React 页面组件里；
3. 不要让 renderer 直接调用 Node.js API；
4. 不要在 renderer 中直接操作 SQLite；
5. 不要在 renderer 中直接调用 api-enhanced；
6. 外部服务统一放在 adapters；
7. 业务流程统一放在 services；
8. 数据库访问统一放在 repositories；
9. IPC 返回值使用统一结构；
10. 代码中添加必要注释，但不要过度注释；
11. 先保证项目能启动，再逐步补充复杂功能；
12. 初始化阶段不需要实现真实网易云登录，但要为后续实现留好结构。

------

# 23. 当前必须实现的功能

初始化阶段请至少实现以下可运行功能：

## 23.1 应用启动

- 运行开发命令后打开 Electron 窗口；
- 显示 React 页面；
- 页面无白屏；
- 控制台无严重错误。

## 23.2 页面路由

可以访问：

```text
/
 /login
 /liked-songs
 /export
 /settings
```

## 23.3 基础 IPC

在 Dashboard 页面中调用：

```ts
window.waveYourYarn.app.getVersion()
window.waveYourYarn.app.ping()
```

并展示结果。

## 23.4 数据库初始化

应用启动时调用 `initDatabase()`，创建本地 SQLite 数据库和基础表。

## 23.5 基础 UI

至少完成：

- 左侧导航栏；
- 顶部标题栏；
- Dashboard 页面；
- Login 页面；
- Liked Songs 页面；
- Export 页面；
- Settings 页面。

------

# 24. 当前不要实现的功能

本次初始化阶段不要实现以下复杂功能：

```text
真实网易云扫码登录
真实读取“我喜欢的音乐”
真实导出文件
真实 Apple Music API
真实 LLM API
自动创建网易云歌单
打包发布
自动更新
复杂图表
```

但要把代码结构预留好，后续可以直接继续开发。

------

# 25. 初始化完成后的验收方式

请在完成后告诉我：

1. 项目如何安装依赖；
2. 项目如何启动开发环境；
3. 项目如何运行类型检查；
4. 项目如何运行 lint；
5. 项目当前已实现哪些页面；
6. 项目当前已实现哪些 IPC；
7. SQLite 数据库文件保存在哪里；
8. 后续应该优先开发哪个模块。

同时请确保：

```text
npm install
npm run dev
npm run typecheck
npm run lint
```

这些命令可用，或者如果使用 pnpm / yarn，请在 README 中明确写出对应命令。

------

# 26. 推荐开发顺序

请严格按照以下顺序实现：

```text
1. 初始化 Electron + React + TypeScript + Vite
2. 配置 Tailwind CSS
3. 配置基础目录结构
4. 实现 Electron 主窗口
5. 实现 preload 安全 API
6. 实现 app:ping 和 app:get-version IPC
7. 实现 React Router 页面路由
8. 实现 AppLayout / Sidebar / Topbar
9. 实现 Dashboard / Login / LikedSongs / Export / Settings 页面
10. 初始化 SQLite 基础结构
11. 创建 Repository / Service / Adapter 占位文件
12. 创建 Zustand stores
13. 创建 README 和 docs 占位文档
14. 运行 typecheck / lint，修复明显错误
```

------

# 27. 输出要求

请直接修改和创建项目文件。

完成后输出：

```text
已完成的内容
项目目录结构概览
启动命令
验证命令
下一步开发建议
```

不要只给解释，不要只给伪代码，需要实际创建可运行的项目骨架。

------

# 28. 项目一句话总结

> WaveYourYarn 是一个基于 Electron + React + TypeScript 的开源桌面端音乐数据工具平台，第一阶段目标是帮助用户读取并导出网易云音乐“我喜欢的音乐”，后续扩展 AI 音乐报告、自动整理子歌单和 Apple Music 迁移能力。
