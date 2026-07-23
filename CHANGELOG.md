# Changelog

本项目的重要版本变化记录在此文件中。

## Unreleased

### v0.3 LLM 基础

- 建立 development-only OpenAI-compatible 配置、Chat Completions adapter 和 Release 泄露门禁；
- 将分析数据升级为 `MusicAnalysisDatasetV1`，固定最近 100 首、稳定歌曲 ID、时间精度与 SHA-256 digest；
- 增加音乐偏好人格报告调研、确定性事实层、报告 JSON 契约、安全提示词和 evidence 校验；
- 增加本地 mock provider contract tests 与只读真实 provider smoke runner，并用 JSON Mode 完成最近 100 首报告的受控人工验证；
- 将数据库迁移收口为单一注册表，并加入 schema 7 的 LLM profile、任务运行和数据披露授权表；
- 增加公开配置与系统安全存储分离的 profile 服务，以及可取消、可恢复、错误脱敏的 JobManager；
- 增加公网 HTTPS/本机地址策略、DNS 与重定向复核的 main-only 网络层、统一 Provider 接口和协议注册表；
- 增加严格校验的 LLM Profile IPC、typed preload 与设置界面，API Key 仅通过独立通道进入系统安全存储；
- 增加不发送音乐数据、可轮询和取消的最小连接测试，并阻止同一 Profile 重复产生测试请求；
- 将校验后的 DNS 地址固定到实际 socket 连接，同时恢复应用退出前遗留的 pending/running 任务；
- 增加 AI 数据披露预览与设置界面：显示目标域名、模型、歌曲数量和精确字段清单，并支持始终确认、记住同范围授权及一键撤销；
- 增加 main-only 的短时单次披露 token，绑定 profile、目标、协议、来源、字段哈希、歌曲上限与 dataset digest，范围扩大后强制重新确认；
- 修复 Node 原生请求在 DNS `all` lookup 模式下无法使用已校验固定地址的问题，恢复真实 LLM Profile 连接；
- 固定 AI 报告 prompt template version，新增 schema 8 报告与来源快照、软删除 Repository，并确保清理音乐缓存或删除模型配置不会连带删除历史报告；
- 串联披露授权、报告 Provider、内容校验、JobManager 与 schema 8 原子落库，失败、取消、非法输出和持久化异常不会产生成功报告，重试会重新授权并建立新任务；
- 新增 AI 音乐报告入口、发送前披露确认、生成进度、离线历史与报告详情，支持 evidence 降级展示、本地重命名、软删除和按原来源重新生成；

### 项目路线

- 将 v1.0 范围收敛为网易云只读数据、统计、LLM 音乐报告、报告历史与导出；
- 原 v0.4.x AI 歌单整理与 v0.5.x Apple Music 迁移整体迁移到 v2.0 高级歌单管理；
- v0.6.x 调整为 Windows x64 与 macOS/Windows 双平台稳定化；
- 新增 v0.7.x UI 与用户体验专项，完成后再进入 v1.0 release candidate；
- v1.0 允许发布未签名、未公证的 macOS/Windows 开源产物，不接入自动更新，并要求风险说明、SHA-256 与公开构建记录。

## 0.2.5 - 2026-07-20

### Electron 运行时与安全

- 限制主窗口与网易云登录窗口的导航、弹窗、外链和权限请求；
- 为所有业务 IPC 增加主 frame 与受信 renderer URL 校验；
- 增加 renderer CSP 和可单元测试的 URL 信任策略；
- 修复并固化 sandbox preload CommonJS 产物，构建阶段自动验证 bridge；
- 增加生产构建及 macOS 开发包的 preload、IPC ping、主路由、备份与诊断 E2E。

### 备份与诊断

- 增加带 manifest、SHA-256、schema 和数量摘要的 `.wyybackup` 格式；
- 使用 SQLite Online Backup 创建不含登录凭据的一致性快照；
- 恢复前校验完整性、迁移与关系，自动创建应急快照，并在替换失败时回滚；
- 增加设置页备份、恢复、运行时诊断和主动诊断导出入口；
- 增加 JSONL 滚动日志，并统一脱敏凭据、URL query 与本地用户目录名。

### 发行与工程质量

- 接入 electron-builder，配置固定 bundle id、asar 原生模块解包及 macOS arm64/x64 构建；
- 增加应用图标和 macOS 双架构 tag workflow；
- 拆分导出页面和统计算法，统一 IPC result 封装；
- 增加代表性 v0.2.4 数据库夹具，以及备份、回滚、脱敏、诊断和结构算法测试；
- 更新总体路线、开发计划、发布说明和发布前人工回归清单。

## 0.2.4 - 2026-07-17

### 稳定性

- 增加带版本记录、事务回滚和旧 v0.2.3 数据库兼容能力的 migration runner；
- 精确清理 liked、歌单及孤立歌曲缓存，避免跨业务误删；
- 增加单活动账号缓存所有权、账号切换清理、liked 歌单合并和陈旧歌单移除；
- 兼容无所有权标记的 v0.2.3 缓存：可推断时继承原账号，无法确认时在登录阶段保守清理；
- 退出登录后保留同账号离线缓存，并修复离线 liked 查询边界。

### 设置与安全

- 实现公开 settings IPC 和默认导出目录设置；
- 设置白名单仅公开 `default_export_directory`；
- 系统安全存储不可用时不再明文保存新 Cookie，并自动迁移可加密的历史明文凭据；
- 导出请求不再接受渲染进程传入的目标路径，文件和目录打开操作改为通过导出记录 ID 解析；
- 启用 Electron renderer sandbox，数据库迁移失败时停止应用启动。
- 将 sandboxed preload 固定为单文件 CommonJS，并增加构建守卫与运行时错误日志，修复所有 IPC 退回 browser fallback 的问题。

### 工程质量

- 增加 Vitest、临时 SQLite 测试工厂和关键数据边界回归测试；
- 增加统一 `pnpm run check` 校验命令和 GitHub Actions CI；
- 更新 README、版本号和发布说明。

## 0.2.3

- 完成基础音乐数据统计与后续 AI 分析所需的数据摘要底座。
