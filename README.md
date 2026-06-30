# WaveYourYarn

让你的音乐故事像声波一样荡漾开来。

WaveYourYarn 是一个基于 Electron 的个人音乐数据工具平台，用于导出、分析、整理和迁移用户自己的音乐偏好数据。当前版本聚焦 v0.1.0 工程初始化，为后续网易云登录、“我喜欢的音乐”同步、本地缓存和导出功能打基础。

## Tech Stack

- Electron + electron-vite
- React + TypeScript + Vite
- Tailwind CSS
- Zustand
- SQLite via better-sqlite3
- NeteaseCloudMusicApiEnhanced/api-enhanced adapter placeholder

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
npm run lint
npm run format
npm run db:init
```

## Current Scope

- Electron main/preload/renderer process split
- Secure IPC bridge through preload
- Basic app/version IPC implemented
- MVP IPC channels registered with placeholders
- SQLite migration and repository/service scaffolding
- React routes and initial pages
- Tailwind-enabled desktop layout

Business features such as real Netease Cloud Music login, song synchronization, local caching, and export execution are intentionally left for subsequent MVP milestones.
