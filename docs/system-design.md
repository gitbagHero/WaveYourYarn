# WaveYourYarn 软件系统说明文档

## 1. 项目概述

**WaveYourYarn** 是一个面向桌面端的个人音乐数据工具平台。

项目名称含义为：

> **让你的音乐故事像声波一样荡漾开来。**

本项目希望围绕用户在网易云音乐中的个人音乐数据，提供一组实用且有趣的工具能力，包括：

- 导出网易云音乐“我喜欢的音乐”列表；
- 基于喜欢的歌曲生成个人音乐画像；
- 接入大模型 API，生成音乐人格、情绪偏好、成长心路历程等娱乐化分析报告；
- 根据歌曲风格、情绪、语言、年代等维度自动整理子歌单；
- 自动在网易云音乐中创建整理后的新歌单；
- 后续支持将网易云音乐歌单迁移到 Apple Music。

项目定位不是“第三方网易云播放器”，也不是音乐下载工具，而是：

> **个人音乐数据迁移、分析、整理与故事生成工具。**

------

## 2. 项目目标

### 2.1 核心目标

WaveYourYarn 的核心目标是帮助用户把自己的音乐偏好数据变成可导出、可分析、可整理、可迁移的个人音乐资产。

具体包括：

1. **数据导出**
   - 读取网易云音乐“我喜欢的音乐”；
   - 导出为 CSV、JSON、Markdown 等格式；
   - 支持后续作为 AI 分析、歌单整理和跨平台迁移的数据基础。
2. **音乐画像分析**
   - 接入外部大模型 API；
   - 根据前 100 首、前 300 首或全部喜欢歌曲生成分析；
   - 输出音乐人格、情绪倾向、听歌偏好、成长心路历程等内容。
3. **歌单自动整理**
   - 根据歌曲风格、情绪、语言、年代、歌手等维度自动聚类；
   - 生成子歌单建议；
   - 用户确认后自动在网易云音乐中创建新歌单并添加歌曲。
4. **Apple Music 迁移**
   - 将网易云音乐歌单匹配到 Apple Music 曲库；
   - 创建 Apple Music 歌单；
   - 批量导入匹配成功的歌曲；
   - 该功能涉及 Apple Music API、歌曲匹配算法和复杂测试，因此放在后期开发。

------

## 3. 项目边界

### 3.1 当前计划支持的内容

- 网易云账号登录；
- 读取用户基础信息；
- 读取“我喜欢的音乐”；
- 读取用户创建和收藏的歌单；
- 导出歌曲数据；
- 本地缓存音乐数据；
- 大模型分析音乐偏好；
- 生成音乐报告；
- 自动整理子歌单；
- 自动创建网易云歌单；
- 后期支持 Apple Music 迁移。

### 3.2 暂不考虑的内容

为了保证项目定位清晰，前期不做以下内容：

- 音乐播放功能；
- 音乐下载功能；
- 解灰、绕过会员、绕过版权限制等功能；
- 批量刷播放量、自动签到等与音乐数据工具无关的功能；
- 商业 SaaS 服务端托管；
- 多用户在线账号系统。

项目优先以**本地桌面端应用**为主，用户数据尽量保存在本机。

------

## 4. 采用的已有方案

### 4.1 NeteaseCloudMusicApiEnhanced/api-enhanced

本项目计划采用社区方案：

```text
NeteaseCloudMusicApiEnhanced/api-enhanced
```

该项目是一个基于 Node.js 的网易云音乐第三方 API 工具，提供了网易云音乐相关的数据访问能力。

在 WaveYourYarn 中，`api-enhanced` 主要承担以下职责：

- 网易云账号登录；
- 获取用户信息；
- 获取用户歌单；
- 获取“我喜欢的音乐”列表；
- 获取歌曲详情；
- 获取专辑、歌手、歌词等补充信息；
- 创建歌单；
- 向歌单中添加歌曲。

### 4.2 使用方式设想

考虑到 WaveYourYarn 采用 Electron 技术栈，而 `api-enhanced` 本身也是 Node.js 生态，因此可以比较自然地集成到 Electron 主进程中。

初步有两种接入方式：

#### 方式一：作为 Node 模块直接调用

```text
Electron Main Process
  └── 调用 api-enhanced 提供的接口方法
```

优点：

- 集成简单；
- 不需要额外启动本地服务；
- 更适合桌面端单体应用。

缺点：

- 需要处理模块封装、错误边界和接口变化；
- 后续如果要切换其他 API 源，适配成本略高。

#### 方式二：作为本地 API 服务运行

```text
Electron App
  └── Local API Server
        └── api-enhanced
```

优点：

- 主应用和网易云 API 层解耦；
- 更容易调试；
- 后续可以独立替换 API Adapter。

缺点：

- 需要管理本地服务启动、端口、异常恢复；
- 应用架构稍微复杂。

### 4.3 推荐方案

第一阶段建议采用：

```text
Electron Main Process 直接集成 api-enhanced
```

原因是第一版项目的重点是快速跑通核心功能，不需要过早引入复杂的本地服务架构。

但是代码结构上应该提前封装 `NCMAdapter`，避免业务代码直接到处调用 `api-enhanced`。

推荐封装方式：

```text
src/main/adapters/ncm/
  ├── NCMAuthService.ts
  ├── NCMUserService.ts
  ├── NCMPlaylistService.ts
  ├── NCMSongService.ts
  └── NCMAdapter.ts
```

这样未来即使更换 API 来源，也只需要修改 Adapter 层。

------

## 5. 技术栈设计

### 5.1 桌面端框架

```text
Electron
```

选择 Electron 的原因：

- 与 Node.js 生态天然兼容；
- 方便集成 `api-enhanced`；
- 跨平台支持 macOS、Windows、Linux；
- 适合快速开发桌面端工具；
- 社区成熟，打包、自动更新、文件读写等方案丰富。

第一阶段优先支持：

```text
macOS
```

后续可扩展支持：

```text
Windows
Linux
```

------

### 5.2 前端技术栈

推荐使用：

```text
React + TypeScript + Vite
```

原因：

- React 生态成熟；
- TypeScript 适合处理复杂数据结构；
- Vite 开发体验较好；
- 和 Electron 集成方便。

UI 方案可选：

```text
Tailwind CSS + shadcn/ui
```

原因：

- 适合快速搭建现代化界面；
- 表格、弹窗、卡片、设置页等组件容易实现；
- 方便后续做暗色主题和音乐报告卡片。

状态管理可选：

```text
Zustand
```

适合管理：

- 当前登录状态；
- 当前选择的歌单；
- 导出任务状态；
- AI 分析任务状态；
- 歌单整理任务状态；
- 全局设置。

------

### 5.3 Electron 主进程技术栈

推荐使用：

```text
Node.js + TypeScript
```

主进程负责：

- 调用 `api-enhanced`；
- 管理网易云登录态；
- 读写本地文件；
- 操作 SQLite 数据库；
- 调用大模型 API；
- 执行 Apple Music API 请求；
- 通过 IPC 向前端暴露安全接口。

------

### 5.4 本地数据库

推荐使用：

```text
SQLite
```

Node.js 库可考虑：

```text
better-sqlite3
```

本地数据库用于缓存：

- 用户信息；
- 歌曲详情；
- 歌单详情；
- 导出历史；
- AI 分析报告；
- 自动整理方案；
- Apple Music 匹配结果；
- 应用设置。

SQLite 的优势：

- 本地单文件存储；
- 不需要额外部署数据库；
- 适合桌面端工具；
- 易于备份和迁移。

------

### 5.5 大模型 API 接入

大模型接口建议设计为 OpenAI-compatible Adapter。

优先支持：

```text
OpenAI-compatible API
DeepSeek
通义千问
智谱
Ollama 本地模型
自定义 Base URL + API Key
```

不要把某一个模型供应商写死在项目中。

推荐抽象：

```text
src/main/adapters/llm/
  ├── LLMAdapter.ts
  ├── OpenAICompatibleAdapter.ts
  ├── DeepSeekAdapter.ts
  ├── OllamaAdapter.ts
  └── PromptTemplateService.ts
```

大模型主要用于：

- 生成音乐人格画像；
- 生成情绪偏好报告；
- 生成成长心路历程；
- 生成子歌单分类方案；
- 生成歌单名称和描述；
- 生成报告导出文案。

------

### 5.6 文件导出

第一阶段支持：

```text
CSV
JSON
Markdown
```

后续支持：

```text
HTML
PDF
图片卡片
Apple Music 导入中间文件
```

------

## 6. 系统整体架构

### 6.1 总体结构

```text
WaveYourYarn
├── Electron Main Process
│   ├── NCM Adapter
│   │   └── api-enhanced
│   ├── LLM Adapter
│   ├── Apple Music Adapter
│   ├── Export Service
│   ├── Playlist Organize Service
│   ├── Local Database Service
│   └── IPC Handlers
│
├── Electron Renderer Process
│   ├── React UI
│   ├── Login Page
│   ├── Dashboard
│   ├── Liked Songs Page
│   ├── Export Page
│   ├── AI Report Page
│   ├── Playlist Organizer Page
│   ├── Apple Music Migration Page
│   └── Settings Page
│
└── Local Storage
    ├── SQLite Database
    ├── Exported Files
    ├── Cached Covers
    └── User Settings
```

------

### 6.2 数据流示意

```text
网易云账号登录
  ↓
api-enhanced 获取用户数据
  ↓
NCM Adapter 标准化数据
  ↓
SQLite 本地缓存
  ↓
前端页面展示
  ↓
用户选择工具功能
  ├── 导出 CSV / JSON / Markdown
  ├── 调用 LLM 生成音乐报告
  ├── 生成子歌单整理方案
  └── 迁移到 Apple Music
```

------

## 7. 功能需求拆解

## 7.1 阶段一：网易云账号连接与“我喜欢的音乐”导出

这是项目第一个 MVP，也是后续所有功能的数据基础。

### 7.1.1 网易云登录

功能点：

- 支持扫码登录；
- 支持检测当前登录状态；
- 支持退出登录；
- 支持登录失败提示；
- 支持登录态过期后重新登录。

页面设计：

```text
登录页
├── 网易云扫码登录
├── 当前登录状态
├── 用户昵称 / 头像
└── 重新登录按钮
```

------

### 7.1.2 用户信息读取

功能点：

- 获取用户 ID；
- 获取用户昵称；
- 获取用户头像；
- 获取用户等级、关注数、粉丝数等可选信息；
- 将用户基础信息缓存到本地。

------

### 7.1.3 “我喜欢的音乐”读取

功能点：

- 获取“我喜欢的音乐”歌曲 ID 列表；
- 批量获取歌曲详情；
- 展示歌曲列表；
- 支持按歌曲名、歌手、专辑搜索；
- 支持按歌手、专辑、歌曲时长等字段排序；
- 支持刷新数据；
- 支持本地缓存；
- 支持增量更新。

歌曲基础字段：

```text
songId
name
artists
album
duration
coverUrl
alias
source
orderIndex
rawData
createdAt
updatedAt
```

说明：

- `orderIndex` 表示歌曲在喜欢列表中的顺序；
- 如果接口无法稳定提供具体喜欢时间，不应在 UI 中直接展示为“喜欢时间”；
- 可以将顺序用于后续生成“推测音乐时间线”。

------

### 7.1.4 数据导出

功能点：

- 导出为 CSV；
- 导出为 JSON；
- 导出为 Markdown；
- 支持选择导出字段；
- 支持选择导出范围；
- 支持导出全部喜欢歌曲；
- 支持导出当前筛选结果；
- 支持保存导出历史。

导出格式示例：

```text
CSV:
歌名,歌手,专辑,时长,网易云ID

JSON:
[
  {
    "songId": 123,
    "name": "xxx",
    "artists": ["xxx"],
    "album": "xxx"
  }
]

Markdown:
| 歌名 | 歌手 | 专辑 | 时长 |
|---|---|---|---|
```

------

## 7.2 阶段二：本地音乐数据中心

该阶段目标是把 WaveYourYarn 从简单导出工具扩展成“个人音乐数据库”。

### 7.2.1 本地缓存管理

功能点：

- 缓存用户基础信息；
- 缓存喜欢歌曲详情；
- 缓存用户歌单；
- 缓存歌曲封面；
- 支持手动刷新；
- 支持清空缓存；
- 支持查看最近同步时间。

------

### 7.2.2 用户歌单读取

功能点：

- 读取用户创建的歌单；
- 读取用户收藏的歌单；
- 展示歌单名称、封面、歌曲数量；
- 支持进入歌单查看歌曲；
- 支持导出指定歌单；
- 支持选择多个歌单作为后续 AI 分析输入。

------

### 7.2.3 音乐数据统计

功能点：

- 统计喜欢歌曲数量；
- 统计歌手出现次数；
- 统计专辑出现次数；
- 统计歌曲语言；
- 统计歌曲时长分布；
- 统计高频歌手；
- 统计高频关键词；
- 统计可能的年代分布。

页面示例：

```text
数据概览页
├── 喜欢歌曲总数
├── 高频歌手 Top 20
├── 高频专辑 Top 20
├── 歌曲语言分布
├── 歌曲时长分布
└── 最近同步时间
```

------

## 7.3 阶段三：AI 音乐报告生成

该阶段是项目的特色功能之一，用于提升趣味性和传播性。

### 7.3.1 大模型配置

功能点：

- 配置 API Provider；
- 配置 Base URL；
- 配置 API Key；
- 配置模型名称；
- 测试连接；
- 设置最大输入歌曲数量；
- 设置生成语言；
- 设置报告风格。

配置项示例：

```text
Provider: OpenAI-compatible
Base URL: https://api.xxx.com/v1
Model: deepseek-chat
API Key: sk-xxxx
```

------

### 7.3.2 音乐人格画像

功能点：

- 选择分析范围；
  - 前 50 首；
  - 前 100 首；
  - 前 300 首；
  - 全部歌曲；
- 提取歌曲元数据；
- 构造结构化 Prompt；
- 调用 LLM 生成报告；
- 展示报告结果；
- 支持重新生成；
- 支持导出 Markdown。

报告内容可包括：

```text
你的音乐人格关键词
你的情绪底色
你的审美偏好
你的隐藏听歌习惯
你的音乐社交气质
适合你的歌单名称
```

注意：

该功能应明确标注为娱乐化分析，不代表严肃心理测量或心理诊断。

------

### 7.3.3 音乐成长心路历程

功能点：

- 根据喜欢列表顺序生成时间线；
- 分析前期、中期、近期音乐偏好变化；
- 生成“音乐成长故事”；
- 提取阶段关键词；
- 输出阶段标题；
- 支持导出为 Markdown。

示例输出结构：

```text
第一阶段：孤独的自我对话
第二阶段：情绪释放与表达
第三阶段：走向轻盈和松弛
第四阶段：重新建立生活节奏
```

注意：

如果无法获取准确喜欢时间，则应使用“喜欢列表顺序”作为近似分析依据，并在报告中说明。

------

### 7.3.4 情绪与风格分析

功能点：

- 分析歌曲标题、歌手、专辑、歌词摘要等信息；
- 生成情绪标签；
- 生成风格标签；
- 输出情绪分布；
- 输出推荐整理方向。

可选标签：

```text
治愈
孤独
热烈
浪漫
怀旧
叛逆
安静
自由
梦幻
破碎感
松弛感
```

------

### 7.3.5 报告导出

功能点：

- 导出 Markdown；
- 导出 HTML；
- 后续支持导出图片卡片；
- 后续支持导出 PDF。

------

## 7.4 阶段四：AI 自动整理网易云子歌单

该阶段是 WaveYourYarn 的核心高级功能。

### 7.4.1 选择整理来源

功能点：

- 选择“我喜欢的音乐”；
- 选择某个用户歌单；
- 选择多个歌单合并整理；
- 选择歌曲数量范围；
- 支持排除指定歌曲。

------

### 7.4.2 选择整理策略

系统预设策略：

```text
按情绪整理
按风格整理
按语言整理
按年代整理
按歌手聚类
按场景整理
按人生阶段整理
自定义 Prompt 整理
```

场景类歌单示例：

```text
深夜独处
通勤路上
学习专注
运动提神
雨天散步
失眠循环
周末放空
```

------

### 7.4.3 生成整理方案

功能点：

- 调用 LLM 生成歌单分组；
- 每个分组生成歌单名称；
- 每个分组生成歌单描述；
- 每首歌分配到一个或多个分组；
- 给出分组理由；
- 支持人工编辑。

生成结果示例：

```text
歌单 1：深夜情绪漫游
描述：适合夜晚独处时听的慢歌和情绪型歌曲。
歌曲：
- 歌曲 A
- 歌曲 B
- 歌曲 C

歌单 2：通勤能量补给
描述：节奏更明显，适合路上听。
歌曲：
- 歌曲 D
- 歌曲 E
```

------

### 7.4.4 用户确认机制

所有写入网易云的操作都必须经过用户确认。

确认页需要展示：

- 将创建哪些歌单；
- 每个歌单包含哪些歌曲；
- 是否存在重复歌曲；
- 是否存在无法添加的歌曲；
- 是否需要跳过已经存在的歌单；
- 是否需要给新歌单添加统一前缀。

推荐默认新歌单命名格式：

```text
WaveYourYarn - 深夜情绪漫游
WaveYourYarn - 通勤能量补给
WaveYourYarn - 雨天散步
```

------

### 7.4.5 创建网易云歌单

功能点：

- 创建新歌单；
- 批量添加歌曲；
- 记录创建结果；
- 记录失败歌曲；
- 支持导出执行报告。

初期只做：

```text
新建歌单 + 添加歌曲
```

暂不做：

```text
删除原歌单
清空原歌单
覆盖已有歌单
批量删除歌曲
```

这样可以降低误操作风险。

------

## 7.5 阶段五：Apple Music 迁移助手

Apple Music 迁移助手放在最后开发。

原因：

- 涉及 Apple Developer 相关配置；
- 涉及 Apple Music API 授权；
- 涉及 Music User Token；
- 涉及跨平台歌曲匹配；
- 测试成本较高；
- 需要处理大量匹配失败和误匹配情况。

### 7.5.1 功能目标

将网易云音乐中的歌单迁移到 Apple Music。

支持来源：

```text
我喜欢的音乐
用户创建的歌单
用户收藏的歌单
AI 整理后的子歌单
```

目标：

```text
Apple Music 新建歌单
```

------

### 7.5.2 歌曲匹配流程

```text
网易云歌曲
  ↓
标准化歌曲信息
  ↓
Apple Music 搜索
  ↓
计算匹配置信度
  ↓
用户确认低置信度匹配
  ↓
创建 Apple Music 歌单
  ↓
添加歌曲
  ↓
生成迁移报告
```

------

### 7.5.3 匹配策略

优先级：

```text
1. ISRC 精确匹配
2. 歌名 + 歌手 + 专辑 + 时长匹配
3. 歌名 + 主歌手 + 时长匹配
4. 歌名 + 歌手搜索后人工确认
```

匹配结果需要分为：

```text
高置信度匹配
中置信度匹配
低置信度匹配
未匹配
```

------

### 7.5.4 迁移报告

迁移完成后生成报告：

```text
源歌单：我喜欢的音乐
源歌曲数：1000
成功匹配：842
需要确认：97
未匹配：61
成功导入：839
导入失败：3
目标歌单：WaveYourYarn - 网易云我喜欢
```

------

## 8. 推荐开发顺序

整体开发顺序如下：

```text
阶段一：网易云登录 + 我喜欢的音乐读取 + 导出
阶段二：本地音乐数据中心 + 用户歌单读取 + 数据统计
阶段三：LLM 音乐画像报告
阶段四：AI 自动整理子歌单 + 回写网易云
阶段五：Apple Music 迁移助手
```

更细的版本规划：

| 版本 | 目标                 | 核心功能                                       |
| ---- | -------------------- | ---------------------------------------------- |
| v0.1 | 跑通网易云数据读取   | 登录、读取我喜欢、歌曲详情、导出 CSV/JSON      |
| v0.2 | 做成本地音乐数据中心 | SQLite 缓存、歌单读取、数据统计、搜索筛选      |
| v0.3 | 加入 AI 报告         | 大模型配置、音乐人格、心路历程、Markdown 导出  |
| v0.4 | 自动整理歌单         | LLM 分组、预览确认、创建网易云歌单、添加歌曲   |
| v0.5 | 完善体验             | 设置页、任务历史、错误处理、主题美化、打包发布 |
| v1.0 | Apple Music 迁移     | Apple 授权、歌曲匹配、创建歌单、迁移报告       |

------

## 9. 页面规划

### 9.1 登录页

功能：

- 网易云扫码登录；
- 显示登录状态；
- 登录失败提示；
- 重新登录；
- 退出登录。

------

### 9.2 首页 Dashboard

展示：

- 用户信息；
- 喜欢歌曲数量；
- 歌单数量；
- 最近同步时间；
- 最近导出记录；
- 最近 AI 报告；
- 快捷入口。

快捷入口：

```text
同步我喜欢的音乐
导出歌曲列表
生成音乐画像
整理子歌单
```

------

### 9.3 我喜欢的音乐页

功能：

- 展示歌曲列表；
- 搜索；
- 筛选；
- 排序；
- 查看歌曲详情；
- 手动刷新；
- 选择部分歌曲；
- 导出选中歌曲。

------

### 9.4 歌单页

功能：

- 查看用户歌单；
- 查看歌单歌曲；
- 导出歌单；
- 选择歌单作为 AI 分析输入；
- 选择歌单作为自动整理输入。

------

### 9.5 数据统计页

功能：

- 高频歌手；
- 高频专辑；
- 歌曲数量统计；
- 歌曲时长统计；
- 风格/语言/年代统计；
- 可视化图表。

------

### 9.6 AI 报告页

功能：

- 选择分析对象；
- 选择报告类型；
- 配置报告风格；
- 生成报告；
- 查看历史报告；
- 导出报告。

报告类型：

```text
音乐人格画像
情绪偏好分析
成长心路历程
听歌习惯总结
歌单命名建议
```

------

### 9.7 歌单整理页

功能：

- 选择源歌曲；
- 选择整理策略；
- 生成整理方案；
- 手动编辑方案；
- 预览将创建的歌单；
- 确认执行；
- 查看执行结果。

------

### 9.8 Apple Music 迁移页

后期开发。

功能：

- Apple Music 授权；
- 选择源歌单；
- 匹配歌曲；
- 人工确认；
- 创建 Apple Music 歌单；
- 导入歌曲；
- 查看迁移报告。

------

### 9.9 设置页

功能：

- 网易云登录管理；
- LLM API 配置；
- 本地缓存管理；
- 导出路径设置；
- 主题设置；
- 数据清理；
- 关于项目。

------

## 10. 数据模型初步设计

### 10.1 User

```ts
interface User {
  id: string
  ncmUserId: string
  nickname: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}
```

------

### 10.2 Song

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
  rawData?: unknown
  createdAt: string
  updatedAt: string
}
```

------

### 10.3 Playlist

```ts
interface Playlist {
  id: string
  ncmPlaylistId: string
  name: string
  description?: string
  coverUrl?: string
  trackCount?: number
  ownerUserId?: string
  type: 'liked' | 'created' | 'subscribed' | 'generated'
  rawData?: unknown
  createdAt: string
  updatedAt: string
}
```

------

### 10.4 PlaylistSong

```ts
interface PlaylistSong {
  id: string
  playlistId: string
  songId: string
  orderIndex?: number
  createdAt: string
}
```

------

### 10.5 AIReport

```ts
interface AIReport {
  id: string
  title: string
  type: 'personality' | 'emotion' | 'timeline' | 'summary'
  inputType: 'liked' | 'playlist' | 'custom'
  inputRefId?: string
  modelProvider: string
  modelName: string
  content: string
  createdAt: string
}
```

------

### 10.6 OrganizePlan

```ts
interface OrganizePlan {
  id: string
  title: string
  sourceType: 'liked' | 'playlist' | 'custom'
  sourceRefId?: string
  strategy: string
  status: 'draft' | 'confirmed' | 'executed' | 'failed'
  planData: unknown
  createdAt: string
  updatedAt: string
}
```

------

### 10.7 AppSettings

```ts
interface AppSettings {
  id: string
  key: string
  value: string
  updatedAt: string
}
```

------

## 11. 非功能需求

### 11.1 本地优先

用户的网易云登录信息、歌曲数据、AI 报告和导出记录应优先保存在本地。

除以下情况外，不应上传用户数据：

- 用户主动调用外部大模型 API；
- 用户主动使用 Apple Music 迁移功能；
- 用户主动导出或分享报告。

------

### 11.2 隐私保护

需要注意：

- API Key 不应明文展示；
- 本地配置文件应避免直接暴露敏感信息；
- 日志中不应输出 Cookie、Token、API Key；
- AI 分析前应提示用户将发送哪些数据；
- 用户应可以清空本地缓存和历史报告。

------

### 11.3 可恢复性

需要处理：

- 网易云登录过期；
- 网络请求失败；
- 接口返回异常；
- 歌曲详情获取失败；
- LLM 请求超时；
- 创建歌单失败；
- 添加歌曲失败；
- 本地数据库读写失败。

对于批量任务，应支持：

- 失败重试；
- 跳过失败项；
- 导出失败报告；
- 保留任务执行记录。

------

### 11.4 可扩展性

系统应尽量采用 Adapter 结构。

推荐抽象：

```text
MusicPlatformAdapter
├── NeteaseMusicAdapter
└── AppleMusicAdapter

LLMAdapter
├── OpenAICompatibleAdapter
├── DeepSeekAdapter
├── OllamaAdapter
└── CustomAdapter

ExportAdapter
├── CSVExporter
├── JSONExporter
├── MarkdownExporter
└── HTMLExporter
```

这样后续可以扩展：

- Spotify；
- QQ 音乐；
- YouTube Music；
- 本地音乐库；
- 更多大模型供应商；
- 更多导出格式。

------

## 12. 初步目录结构建议

```text
WaveYourYarn
├── package.json
├── electron.vite.config.ts
├── src
│   ├── main
│   │   ├── index.ts
│   │   ├── ipc
│   │   │   ├── auth.ipc.ts
│   │   │   ├── songs.ipc.ts
│   │   │   ├── playlists.ipc.ts
│   │   │   ├── export.ipc.ts
│   │   │   ├── llm.ipc.ts
│   │   │   └── organize.ipc.ts
│   │   ├── adapters
│   │   │   ├── ncm
│   │   │   ├── llm
│   │   │   └── apple-music
│   │   ├── services
│   │   │   ├── AuthService.ts
│   │   │   ├── SongService.ts
│   │   │   ├── PlaylistService.ts
│   │   │   ├── ExportService.ts
│   │   │   ├── AIReportService.ts
│   │   │   └── PlaylistOrganizeService.ts
│   │   ├── db
│   │   │   ├── database.ts
│   │   │   ├── migrations
│   │   │   └── repositories
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
│   ├── system-design.md
│   ├── api-adapter-design.md
│   ├── llm-prompts.md
│   └── roadmap.md
│
└── README.md
```

------

## 13. 关键开发原则

### 13.1 先读后写

前期优先开发读取、展示、导出能力。

涉及写入网易云的功能，例如创建歌单、添加歌曲，必须放在用户明确确认之后执行。

------

### 13.2 所有 AI 结果都需要可解释

AI 生成的音乐画像和歌单整理方案，应尽量附带依据。

例如：

```text
这个歌单被归类为“深夜情绪漫游”，主要因为其中慢节奏歌曲较多，歌名中高频出现“夜”“梦”“雨”等意象，并且歌手风格偏抒情。
```

------

### 13.3 不直接让 AI 操作用户账号

AI 只能生成方案，不能直接执行账号写操作。

正确流程：

```text
AI 生成方案
  ↓
用户查看和编辑
  ↓
用户确认
  ↓
系统执行
```

------

### 13.4 保留原始数据

从网易云接口获取到的数据，建议保留部分 `rawData`，便于后续补充字段或排查问题。

同时业务层需要使用标准化后的数据结构，避免直接依赖原始接口返回格式。

------

## 14. 主要风险与应对方案

| 风险                 | 说明                                   | 应对方案                       |
| -------------------- | -------------------------------------- | ------------------------------ |
| 网易云接口变化       | 第三方 API 可能受网易云接口变化影响    | 封装 NCM Adapter，降低影响范围 |
| 登录态过期           | Cookie 或二维码登录可能失效            | 增加登录状态检测和重新登录机制 |
| 歌曲信息不完整       | 部分歌曲可能缺少专辑、封面、歌词等字段 | 允许字段为空，保留失败记录     |
| AI 分析过度解读      | 音乐人格不等于真实人格                 | 标注娱乐化分析，不做心理诊断   |
| 自动歌单误操作       | 自动创建或添加歌曲可能不符合用户预期   | 所有写操作前必须预览和确认     |
| Apple Music 匹配错误 | 跨平台曲库差异导致误匹配               | 使用置信度和人工确认机制       |
| API Key 泄露         | LLM 或 Apple API Key 属于敏感信息      | 本地存储、隐藏展示、日志脱敏   |

------

## 15. 第一阶段 MVP 详细任务清单

### v0.1.0：项目初始化

- 初始化 Electron + React + TypeScript 项目；
- 配置 Vite；
- 配置 ESLint / Prettier；
- 配置基础目录结构；
- 配置 IPC 通信；
- 搭建基础 UI；
- 实现首页、登录页、设置页骨架。

------

### v0.1.1：网易云登录

- 集成 `api-enhanced`；
- 封装 `NCMAuthService`；
- 实现扫码登录；
- 获取登录状态；
- 获取用户信息；
- 登录信息本地缓存；
- 退出登录。

------

### v0.1.2：读取我喜欢的音乐

- 获取用户 ID；
- 获取喜欢歌曲 ID 列表；
- 批量获取歌曲详情；
- 标准化歌曲数据；
- 存入 SQLite；
- 前端展示歌曲表格。

------

### v0.1.3：导出功能

- 导出 CSV；
- 导出 JSON；
- 导出 Markdown；
- 支持选择导出路径；
- 支持选择导出字段；
- 支持导出完成提示；
- 保存导出历史。

------

### v0.1.4：基础体验优化

- 加载状态；
- 错误提示；
- 空状态页面；
- 登录过期提示；
- 刷新数据按钮；
- 本地缓存清理；
- 基础暗色主题。

------

## 16. 后续路线图

### v0.2：本地音乐数据中心

- 用户歌单读取；
- 歌单歌曲展示；
- 数据统计页；
- 高频歌手统计；
- 高频专辑统计；
- 搜索筛选增强；
- 同步历史。

------

### v0.3：AI 音乐报告

- LLM API 配置；
- Prompt 模板管理；
- 音乐人格报告；
- 情绪偏好报告；
- 成长心路历程；
- Markdown 导出；
- 历史报告管理。

------

### v0.4：AI 子歌单整理

- 整理策略选择；
- LLM 歌曲分组；
- 歌单名称生成；
- 歌单描述生成；
- 人工编辑整理方案；
- 创建网易云歌单；
- 批量添加歌曲；
- 执行报告。

------

### v0.5：应用完善

- UI 美化；
- 任务中心；
- 错误日志；
- 数据备份与恢复；
- 自动更新；
- macOS 打包；
- GitHub Release；
- README 和使用文档完善。

------

### v1.0：Apple Music 迁移助手

- Apple Developer 配置；
- Apple Music 授权；
- Apple Music Catalog 搜索；
- 歌曲匹配算法；
- 人工确认界面；
- 创建 Apple Music 歌单；
- 批量添加歌曲；
- 迁移报告。

------

## 17. 项目一句话介绍

> WaveYourYarn 是一个基于 Electron 的开源桌面端音乐数据工具平台，帮助用户导出网易云音乐“我喜欢的音乐”，生成 AI 音乐画像，自动整理子歌单，并在后续支持迁移到 Apple Music。

------

## 18. 项目当前推荐技术方案总结

```text
应用形态：桌面端应用
桌面框架：Electron
前端框架：React
开发语言：TypeScript
构建工具：Vite
UI 方案：Tailwind CSS + shadcn/ui
状态管理：Zustand
网易云接口：NeteaseCloudMusicApiEnhanced/api-enhanced
本地数据库：SQLite / better-sqlite3
大模型接口：OpenAI-compatible Adapter
导出格式：CSV / JSON / Markdown
后期迁移：Apple Music API
```

------

## 19. 当前阶段最优先任务

当前最优先要完成的不是 AI 报告，也不是 Apple Music 迁移，而是：

```text
网易云登录
  ↓
读取“我喜欢的音乐”
  ↓
批量获取歌曲详情
  ↓
本地缓存
  ↓
导出 CSV / JSON / Markdown
```

只要这个闭环跑通，WaveYourYarn 就已经具备了作为开源工具的最小价值。后续所有 AI 分析、子歌单整理和 Apple Music 迁移，都可以基于这套稳定的数据底座继续扩展。