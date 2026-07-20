# Changelog

本项目的重要版本变化记录在此文件中。

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
