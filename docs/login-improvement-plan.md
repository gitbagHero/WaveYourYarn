# WaveYourYarn 登录方案调整说明与 AI 编程提示词

## 1. 当前问题结论

在 WaveYourYarn v0.1.1 登录开发过程中，原计划使用 `@neteasecloudmusicapienhanced/api` 的二维码登录方案。

但实际测试发现：

```text
手机网易云音乐 App 扫描第三方 API 生成的二维码时，会提示：
“检测到当前设备环境异常，本次操作已拦截”
```

继续修改二维码参数后，二维码登录仍不可用。

同时，新的测试结果表明：

```text
在 Electron 内置网页窗口中打开网易云网页并扫码登录后，应用可以自动获取登录信息，不需要用户手动输入 Cookie。
```

因此，当前登录模块应正式调整为：

```text
主登录方案：Electron 内置网页登录获取 Cookie
备用登录方案：手动导入 Cookie，仅作为高级/调试入口
废弃登录方案：api-enhanced 二维码登录，不再作为正式功能开发
```

------

# 2. 登录模块新的产品设计

## 2.1 登录页入口调整

登录页不再默认展示第三方 API 二维码。

推荐登录页只保留一个主入口：

```text
使用网易云网页登录
```

按钮文案：

```text
打开网易云网页登录
```

说明文案：

```text
将在独立窗口中打开网易云音乐官方网页。登录完成后，WaveYourYarn 会在本机读取该窗口的登录状态，用于访问你自己的音乐数据。
```

------

## 2.2 手动 Cookie 入口

手动 Cookie 登录可以保留，但不建议放在主要位置。

可以作为：

```text
高级选项
开发调试入口
折叠区域
```

说明文案：

```text
Cookie 相当于登录凭证，请只在本机使用，不要分享给任何人。普通用户无需使用此功能。
```

------

## 2.3 二维码登录入口

`api-enhanced` 二维码登录不再作为正式入口。

处理方式：

```text
1. 从 LoginPage 主界面移除二维码登录卡片；
2. 保留相关代码也可以，但标记为 experimental / deprecated；
3. 不再把二维码登录纳入 v0.1.1 验收标准；
4. 不再阻塞后续 v0.1.2 读取“我喜欢的音乐”开发。
```

------

# 3. 新登录流程

## 3.1 用户侧流程

```text
用户打开 WaveYourYarn
  ↓
进入登录页
  ↓
点击“打开网易云网页登录”
  ↓
Electron 打开独立登录窗口
  ↓
用户在网易云官方网页扫码或账号登录
  ↓
登录成功后，WaveYourYarn 自动读取该登录窗口的 Cookie
  ↓
主进程使用 Cookie 调用 api-enhanced 验证登录状态
  ↓
获取用户昵称、头像、用户 ID
  ↓
登录窗口关闭
  ↓
Dashboard 显示已连接网易云
```

------

## 3.2 系统内部流程

```text
LoginPage
  ↓
authApi.openWebLogin()
  ↓
preload: window.waveYourYarn.auth.openWebLogin()
  ↓
IPC: auth:open-web-login
  ↓
AuthService.openWebLogin()
  ↓
WebLoginService.openLoginWindow()
  ↓
Electron BrowserWindow + persist:ncm-login session
  ↓
用户完成网页登录
  ↓
读取 music.163.com cookies
  ↓
AuthService.loginWithCookie(cookie)
  ↓
保存 Cookie 到 SecureStorageService
  ↓
调用 api-enhanced 获取当前用户信息
  ↓
保存用户信息到 UserRepository
  ↓
返回 LoginStatusResult
```

------

# 4. 需要新增或调整的模块

## 4.1 新增 WebLoginService

文件位置：

```text
src/main/services/WebLoginService.ts
```

职责：

```text
创建网易云网页登录窗口
管理独立 session
监听登录窗口状态
读取 music.163.com Cookie
序列化 Cookie
触发登录验证
关闭登录窗口
```

建议方法：

```ts
export class WebLoginService {
  openLoginWindow(): Promise<string>
  getNcmCookies(): Promise<string>
  clearNcmLoginSession(): Promise<void>
}
```

其中：

```ts
openLoginWindow(): Promise<string>
```

返回序列化后的 Cookie 字符串，但该 Cookie 只能在 main process 内部继续处理，不得返回给 renderer。

------

## 4.2 调整 AuthService

文件位置：

```text
src/main/services/AuthService.ts
```

需要新增：

```ts
openWebLogin(): Promise<LoginStatusResult>
loginWithCookie(cookie: string): Promise<LoginStatusResult>
verifyCookieAndGetUser(cookie: string): Promise<UserProfile>
```

统一登录成功流程：

```text
获得 Cookie
  ↓
校验 Cookie 是否有效
  ↓
保存 Cookie
  ↓
获取当前用户信息
  ↓
标准化 UserProfile
  ↓
写入 users 表
  ↓
返回 LoginStatusResult
```

------

## 4.3 调整 Auth IPC

文件位置：

```text
src/main/ipc/auth.ipc.ts
```

需要新增或确认：

```ts
auth:open-web-login
auth:login-with-cookie
auth:get-login-status
auth:get-current-user
auth:logout
```

二维码相关 IPC 可以保留，但不再作为主要入口：

```ts
auth:get-login-qr
auth:check-qr-status
```

可标记为：

```ts
// Deprecated: QR login is unstable due to NetEase risk control.
```

------

## 4.4 调整 preload API

文件位置：

```text
src/preload/index.ts
```

需要暴露：

```ts
window.waveYourYarn.auth = {
  openWebLogin: () => Promise<IpcResult<LoginStatusResult>>,
  loginWithCookie: (cookie: string) => Promise<IpcResult<LoginStatusResult>>,
  getLoginStatus: () => Promise<IpcResult<LoginStatusResult>>,
  getCurrentUser: () => Promise<IpcResult<UserProfile | null>>,
  logout: () => Promise<IpcResult<void>>
}
```

注意：

```text
openWebLogin 不应向 renderer 返回 Cookie
loginWithCookie 可以接收用户主动输入的 Cookie
getLoginStatus 只能返回登录状态和用户信息
```

------

## 4.5 调整 LoginPage

文件位置：

```text
src/renderer/src/pages/LoginPage.tsx
```

页面主功能改为：

```text
标题：连接网易云音乐

主按钮：
打开网易云网页登录

状态提示：
正在打开登录窗口
请在弹出的网易云网页中完成登录
正在验证登录状态
登录成功
登录失败，请重试

高级选项：
手动导入 Cookie
```

不再默认展示二维码。

页面状态建议：

```ts
type WebLoginStatus =
  | 'idle'
  | 'opening'
  | 'waiting'
  | 'verifying'
  | 'success'
  | 'failed'
```

------

## 4.6 调整 DashboardPage

Dashboard 只关心最终登录状态，不关心登录来源。

展示逻辑：

```text
未登录：
- 当前未连接网易云音乐
- 按钮：连接网易云

已登录：
- 用户头像
- 用户昵称
- 网易云已连接
- 按钮：同步我喜欢的音乐
```

------

## 4.7 调整 SettingsPage

SettingsPage 需要展示：

```text
当前登录状态
当前网易云用户
退出登录按钮
重新登录按钮
高级选项：清理网页登录 Session
```

退出登录时需要：

```text
清理 SecureStorageService 中保存的 Cookie
清理当前用户状态
可选清理 persist:ncm-login session cookies
更新 authStore
```

------

# 5. Cookie 处理要求

## 5.1 只能在 main process 中处理 Cookie

允许：

```text
WebLoginService
AuthService
SecureStorageService
```

不允许：

```text
renderer 页面
Zustand store
preload 返回值
普通日志
错误提示
```

------

## 5.2 Cookie 序列化

从 Electron session 中读取到 cookies 后，需要序列化为请求头可用格式：

```ts
const cookieString = cookies
  .map((cookie) => `${cookie.name}=${cookie.value}`)
  .join('; ')
```

重点关注域名：

```text
music.163.com
.163.com
. music.163.com 相关域
```

读取时可以尝试：

```ts
ses.cookies.get({ url: 'https://music.163.com' })
```

必要时也可以读取更宽范围后筛选网易云相关 cookies。

------

## 5.3 敏感字段

日志中不能出现以下内容：

```text
MUSIC_U
__csrf
NMTID
MUSIC_A
完整 Cookie 字符串
```

可以记录：

```text
Cookie count
是否包含 MUSIC_U
是否包含 __csrf
登录校验是否成功
用户 ID
用户昵称
```

例如：

```ts
logger.info('NCM cookies collected', {
  count: cookies.length,
  hasMusicU: cookieString.includes('MUSIC_U='),
  hasCsrf: cookieString.includes('__csrf=')
})
```

不要直接记录：

```ts
logger.info(cookieString)
```

------

# 6. AI 编程工具提示词

请继续开发 WaveYourYarn v0.1.1 登录模块。

当前情况：

```text
1. 项目已经完成 Electron + electron-vite + React + TypeScript + Tailwind + Zustand 初始化。
2. 已经接入 @neteasecloudmusicapienhanced/api。
3. 原本计划使用 api-enhanced 二维码登录。
4. 实测发现第三方 API 二维码登录会被网易云 App 拦截，提示“检测到当前设备环境异常，本次操作已拦截”。
5. 继续修改二维码参数后，二维码登录仍不可用。
6. 但通过 Electron 内置网页登录窗口打开网易云网页，用户扫码登录后，应用可以自动读取登录信息，不需要用户手动输入 Cookie。
```

因此，本次任务是：

```text
将登录方案正式调整为“网页登录获取 Cookie”为主方案。
```

请完成以下开发任务。

------

## 6.1 移除二维码登录的主入口

请修改登录页：

```text
src/renderer/src/pages/LoginPage.tsx
```

要求：

```text
1. 不再默认展示 api-enhanced 生成的二维码。
2. 页面主按钮改为“打开网易云网页登录”。
3. 页面说明改为：将在独立窗口中打开网易云音乐官方网页，登录完成后应用会在本机读取登录状态。
4. 二维码登录相关 UI 可以删除，也可以折叠到实验功能，但不应作为主流程。
5. 手动 Cookie 登录可以保留为“高级选项”。
```

------

## 6.2 新增 WebLoginService

请新增：

```text
src/main/services/WebLoginService.ts
```

职责：

```text
1. 创建独立 Electron BrowserWindow。
2. 使用独立持久化 session：persist:ncm-login。
3. 加载 https://music.163.com。
4. 等待用户完成网页登录。
5. 监听 session cookies 变化，或提供“我已完成登录”的确认机制。
6. 从 session 中读取 music.163.com cookies。
7. 序列化为 Cookie 字符串。
8. 返回给 AuthService 内部继续验证。
9. 不得把 Cookie 返回给 renderer。
```

建议实现方式：

```ts
import { BrowserWindow, session } from 'electron'

const partition = 'persist:ncm-login'
const loginSession = session.fromPartition(partition)

const win = new BrowserWindow({
  width: 1100,
  height: 760,
  title: '登录网易云音乐',
  webPreferences: {
    session: loginSession,
    nodeIntegration: false,
    contextIsolation: true
  }
})

await win.loadURL('https://music.163.com')
```

请根据项目现有窗口创建方式和 electron-vite 配置适当调整。

------

## 6.3 登录完成检测

优先实现自动检测。

可以采用以下策略之一，或组合使用：

```text
策略 A：监听 cookies.on('changed')，检测 MUSIC_U 是否出现；
策略 B：定时读取 session cookies，检测 MUSIC_U 是否出现；
策略 C：登录窗口中提供说明，让用户完成登录后回到主窗口点击“我已完成登录”。
```

推荐先实现：

```text
A + B
```

即：

```text
cookies 变化时尝试检测
同时每 2 秒轮询一次 cookies
检测到 MUSIC_U 后认为网页登录已完成
```

检测到 Cookie 后：

```text
关闭登录窗口
返回 cookieString
交给 AuthService 验证
```

需要设置超时或窗口关闭处理：

```text
用户关闭登录窗口：返回取消登录
长时间未登录：允许用户继续等待或重新打开
```

------

## 6.4 AuthService 接入 WebLoginService

修改：

```text
src/main/services/AuthService.ts
```

新增：

```ts
openWebLogin(): Promise<LoginStatusResult>
loginWithCookie(cookie: string): Promise<LoginStatusResult>
verifyCookieAndGetUser(cookie: string): Promise<UserProfile>
```

登录成功统一流程：

```text
WebLoginService 返回 cookieString
  ↓
AuthService 校验 cookieString
  ↓
SecureStorageService 保存 cookieString
  ↓
NCMUserService 获取当前用户信息
  ↓
标准化为 UserProfile
  ↓
UserRepository upsertUser
  ↓
返回 LoginStatusResult
```

请确保：

```text
1. Cookie 不通过 IPC 返回给前端；
2. Cookie 不进入 authStore；
3. Cookie 不写入普通日志；
4. 登录失败时返回友好错误。
```

------

## 6.5 NCM API 使用 Cookie

请检查当前 NCMAdapter / NCMUserService 的实现。

要求：

```text
1. 所有需要登录态的 api-enhanced 调用都要带上当前保存的 Cookie。
2. Cookie 从 SecureStorageService 中读取。
3. 不要让 renderer 传 Cookie。
4. getLoginStatus 和 getCurrentUser 都应该基于保存的 Cookie 验证。
```

建议封装：

```ts
getStoredNcmCookie(): Promise<string | null>
```

并在需要登录态的服务中使用。

------

## 6.6 新增 auth IPC

修改：

```text
src/main/ipc/auth.ipc.ts
```

新增：

```ts
auth:open-web-login
auth:login-with-cookie
```

保留：

```ts
auth:get-login-status
auth:get-current-user
auth:logout
```

二维码相关 IPC 可保留但标注 deprecated：

```ts
auth:get-login-qr
auth:check-qr-status
```

所有 IPC 返回统一：

```ts
export interface IpcResult<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}
```

------

## 6.7 更新 preload API

修改：

```text
src/preload/index.ts
src/preload/types.ts
src/renderer/src/types/preload.d.ts
```

新增：

```ts
auth: {
  openWebLogin: () => Promise<IpcResult<LoginStatusResult>>
  loginWithCookie: (cookie: string) => Promise<IpcResult<LoginStatusResult>>
  getLoginStatus: () => Promise<IpcResult<LoginStatusResult>>
  getCurrentUser: () => Promise<IpcResult<UserProfile | null>>
  logout: () => Promise<IpcResult<void>>
}
```

不要暴露：

```text
getCookie
readCookie
getRawSession
```

------

## 6.8 更新 renderer authApi

修改：

```text
src/renderer/src/api/authApi.ts
```

新增：

```ts
openWebLogin()
loginWithCookie(cookie: string)
getLoginStatus()
getCurrentUser()
logout()
```

------

## 6.9 更新 authStore

修改：

```text
src/renderer/src/stores/authStore.ts
```

状态：

```ts
interface AuthState {
  isLoggedIn: boolean
  user: UserProfile | null
  loading: boolean
  error: string | null

  checkLoginStatus: () => Promise<void>
  openWebLogin: () => Promise<void>
  loginWithCookie: (cookie: string) => Promise<void>
  logout: () => Promise<void>
}
```

注意：

```text
authStore 中不得保存 Cookie。
```

------

## 6.10 更新 LoginPage

修改：

```text
src/renderer/src/pages/LoginPage.tsx
```

页面结构：

```text
标题：连接网易云音乐
说明：使用网易云官方网页登录，WaveYourYarn 会在本机读取登录状态

主卡片：
- 打开网易云网页登录按钮
- 登录状态提示
- 错误提示
- 登录成功后跳转 Dashboard

高级选项：
- 手动导入 Cookie
- textarea
- 验证并登录按钮
- Cookie 安全提示
```

状态流：

```text
idle
  ↓
opening
  ↓
waiting
  ↓
verifying
  ↓
success / failed
```

交互：

```text
点击打开网页登录
  ↓
调用 authStore.openWebLogin()
  ↓
主进程打开登录窗口
  ↓
用户完成网页登录
  ↓
主进程验证并返回用户信息
  ↓
前端展示登录成功
  ↓
跳转 Dashboard
```

------

## 6.11 更新 DashboardPage

修改：

```text
src/renderer/src/pages/DashboardPage.tsx
```

要求：

```text
1. 页面加载时调用 checkLoginStatus。
2. 未登录时展示“当前未连接网易云音乐”。
3. 已登录时展示用户头像、昵称、网易云已连接。
4. “连接网易云”按钮跳转到 /login。
5. “同步我喜欢的音乐”按钮暂时保留占位，不实现歌曲同步。
```

------

## 6.12 更新 SettingsPage

修改：

```text
src/renderer/src/pages/SettingsPage.tsx
```

要求：

```text
1. 展示当前登录状态。
2. 展示当前网易云用户昵称和头像。
3. 支持退出登录。
4. 退出登录后清理本地保存 Cookie。
5. 可选提供“清理网页登录 Session”按钮。
```

------

# 7. 退出登录要求

退出登录时需要：

```text
1. 调用 api-enhanced logout，若失败也不能阻塞本地退出；
2. 删除 SecureStorageService 中保存的 ncm_cookie；
3. 清理 authStore；
4. 清理当前用户登录状态；
5. 可选清理 persist:ncm-login session cookies；
6. Dashboard / Settings 更新为未登录状态。
```

------

# 8. 验收标准

完成后需要满足：

```text
1. pnpm dev 可以正常启动应用。
2. 登录页主入口为“打开网易云网页登录”。
3. 点击后能打开独立网易云网页登录窗口。
4. 用户在该窗口完成登录后，WaveYourYarn 能自动读取登录状态。
5. 不需要手动输入 Cookie。
6. 登录成功后 Dashboard 显示网易云昵称和头像。
7. Settings 显示当前登录状态。
8. 退出登录后 Dashboard 变为未登录。
9. 应用重启后可以识别登录状态。
10. Cookie 不出现在 renderer、Zustand、普通日志、错误提示中。
11. 二维码登录不再是主流程。
12. pnpm typecheck 通过。
13. pnpm lint 尽量通过。
```

------

# 9. 本阶段完成后的下一步

网页登录方案跑通后，v0.1.1 就可以收尾。

下一阶段进入：

```text
v0.1.2 读取“我喜欢的音乐”
```

v0.1.2 的核心任务：

```text
1. 从 SecureStorageService 读取已保存 Cookie；
2. 调用 api-enhanced 获取当前用户 ID；
3. 获取“我喜欢的音乐”歌曲 ID 列表；
4. 批量获取歌曲详情；
5. 标准化 Song 数据结构；
6. 保存到 SQLite；
7. 在 LikedSongsPage 展示歌曲列表；
8. 支持手动同步和刷新。
```

------

# 10. 本次调整总结

从现在开始，WaveYourYarn 的登录能力应以网页登录为主：

```text
Electron 官方网页登录窗口
  ↓
读取本应用 session cookies
  ↓
api-enhanced 使用 Cookie 请求网易云数据
```

这条路线已经通过实际测试验证，比继续修二维码登录更稳定，也更符合桌面端工具的使用体验。