# WaveYourYarn

让你的音乐故事像声波一样荡漾开来。

WaveYourYarn 是一个基于 Electron 的个人音乐数据工具平台，用于导出、分析、整理和迁移用户自己的音乐偏好数据。当前版本进入 v0.1.1，已经开始接入网易云扫码登录、登录态保存和用户信息读取。

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
- Auth IPC channels for QR login, login status, current user, and logout
- SQLite migration and repository/service scaffolding
- SecureStorageService-backed local login state storage
- Netease Cloud Music QR login adapter through `@neteasecloudmusicapienhanced/api`
- React routes and login-aware initial pages
- Tailwind-enabled desktop layout

Business features such as liked-song synchronization, song-detail caching, and export execution are intentionally left for subsequent MVP milestones.

## Native Dependencies

`better-sqlite3` must be rebuilt against Electron after installation:

```bash
pnpm install
pnpm run rebuild:native
pnpm run dev
```
