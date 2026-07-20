# WaveYourYarn

WaveYourYarn 是一个基于 Electron 的个人音乐数据桌面工具，用于同步、整理、统计和导出用户自己的网易云音乐数据。当前稳定版本为 v0.2.5，也是项目的首个 GitHub Release。

[下载 WaveYourYarn v0.2.5](https://github.com/gitbagHero/WaveYourYarn/releases/tag/v0.2.5)

## 当前能力

- Electron 内置网页登录与手动 Cookie 登录兜底；
- 同步“我喜欢的音乐”、创建的歌单和收藏的歌单；
- 查看、搜索、排序并单独刷新歌单歌曲；
- 按当前筛选范围将歌曲导出为 CSV、JSON 或 Markdown；
- 查看本地音乐统计摘要，为后续 AI 报告提供结构化数据；
- 设置默认导出目录，管理各类本地缓存和导出历史；
- 创建不含登录凭据的版本化数据库备份，并在校验、应急快照和回滚保护下恢复；
- 查看运行时与数据库诊断摘要，主动导出经过全链路脱敏的 JSON 诊断包；
- 在网络不可用时读取当前缓存所属账号的本地数据。

v0.2.5 聚焦发行与质量基础：补齐 Electron 真实运行时 E2E、安全边界、macOS 双架构开发打包、数据库备份恢复和脱敏诊断能力。

## 技术架构

```text
renderer -> preload -> IPC -> service -> repository -> SQLite
                                  -> adapter -> 网易云音乐 API
                                  -> Electron dialog / shell / fs
```

主要技术栈为 Electron、electron-vite、React、TypeScript、Tailwind CSS、Zustand、better-sqlite3 和 Vitest。渲染进程不直接访问 Cookie、Node.js、文件系统或数据库。

## 本地开发

要求 Node.js 22、pnpm 11。

```bash
pnpm install
pnpm run rebuild:native
pnpm run dev
```

`better-sqlite3` 需要针对 Electron ABI 构建。若安装后启动时出现原生模块 ABI 错误，重新运行 `pnpm run rebuild:native`。

常用校验命令：

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
pnpm run check
pnpm run test:e2e
pnpm run package:dir
pnpm run package:mac
pnpm run icons:build
```

`pnpm run check` 会依次完成类型检查、lint、测试和生产构建。`pnpm run test:e2e` 会启动真实 Electron 生产构建，验证 preload、IPC ping、主路由、备份和诊断。`pnpm run package:dir` 会在 `release/` 生成当前架构的未签名开发包，`pnpm run test:e2e:packaged` 验证打包态应用。`pnpm run package:mac` 生成 arm64/x64 DMG 与 ZIP；正式标签工作流会在两种原生 runner 上分别构建，避免原生 SQLite 交叉编译风险。数据库会在应用启动时自动初始化和迁移，不需要手工执行 SQL。

### Preload 与 IPC 排查

主窗口保持 `sandbox: true`、`contextIsolation: true` 和 `nodeIntegration: false`。为兼容 Electron sandbox，preload 必须构建为单文件 CommonJS `out/preload/index.cjs`；`pnpm run build` 会自动执行 `verify:preload`，确认该文件存在、没有 ESM import，并正确暴露 `window.waveYourYarn`。

如果界面统一显示 `Electron preload API is unavailable`：

1. 确认应用是通过 `pnpm run dev` 或 Electron 构建产物启动，而不是直接在普通浏览器打开 renderer URL；
2. 运行 `pnpm run build`，确认输出包含 `Verified sandbox-compatible preload bridge`；
3. 查看主进程日志中的 `Preload script failed`，它会包含实际 preload 路径和加载异常；
4. 确认 `src/main/index.ts` 加载的是 `../preload/index.cjs`，不要在 sandboxed preload 中改回 `.mjs`。

项目当前使用 `@neteasecloudmusicapienhanced/api` 4.36.1。升级该依赖前应先核对上游变更是否涉及登录状态、用户歌单、liked 列表、歌曲详情或歌单详情等现有接口，并完成真实账号回归。

## 本地数据与安全

- 登录 Cookie 只允许通过 Electron `safeStorage` 加密后持久化；系统安全存储不可用时，应用拒绝明文保存新凭据。
- 公开设置目前只有 `default_export_directory`，设置 IPC 不会返回 Cookie、账号缓存所有权或同步内部状态。
- 最终导出文件仍由 Electron 保存对话框确认；渲染进程不能指定任意写入路径。
- `.wyybackup` 使用 SQLite 一致性快照、SHA-256、schema 和关系完整性检查；普通备份会移除登录凭据，恢复前另存当前数据库到 `recovery/`。
- 应用日志以 JSONL 保存并滚动，诊断导出会再次脱敏 Cookie、Authorization、Token、API Key、URL query 和用户目录名。
- 切换网易云账号时会清理旧账号可重新同步的缓存与导出历史，但不会删除已经导出的文件。
- 退出后保留当前账号缓存供离线查看；再次登录同一账号不会无故清空缓存。

## 项目文档

- [系统设计](docs/system-design.md)
- [MVP 任务清单](docs/mvp-task-list.md)
- [v0.2.4 → v1.0 项目完整规划](docs/project-roadmap.md)
- [v0.2.5 发行与质量基础开发计划](docs/v0.2.5-plan.md)
- [v0.2.5 发布说明](docs/v0.2.5-release-notes.md)
- [v0.2.5 发布前人工回归清单](docs/v0.2.5-manual-regression.md)
- [v0.2.4 稳定化计划](docs/v0.2.4-stabilization-plan.md)
- [版本记录](CHANGELOG.md)

v0.2.5 开发完成并通过自动化后，下一阶段进入 v0.3.x 的 LLM 与可解释 AI 音乐报告开发。当前版本不包含真实 LLM 调用、远端写入或 Apple Music 迁移。
