

# WaveYourYarn 登录方案修复任务

当前 WaveYourYarn 使用 `@neteasecloudmusicapienhanced/api` 的二维码登录方案时，手机网易云音乐 App 扫码后提示“检测到当前设备环境异常，本次操作已拦截”。该问题与第三方 API 生成二维码登录 URL 的方式有关，类似问题在 api-enhanced issue 中出现过，并且后续修复中涉及 `login_qr_create` 的 `platform=web` 和 `chainId` 逻辑。

本次任务目标：调整 WaveYourYarn 的登录模块，不再把第三方 API 二维码登录作为唯一方案，而是实现“网页登录获取 Cookie”为主方案，“手动导入 Cookie”为兜底方案，“api-enhanced 二维码登录”为实验方案。

## 一、先修复并验证 api-enhanced 二维码登录

1. 检查当前 `@neteasecloudmusicapienhanced/api` 版本。
2. 如版本较旧，升级到最新版本。
3. 检查 `login_qr_create` 或对应二维码创建接口是否支持 `platform` 参数。
4. 创建二维码时强制传入：

```ts
{
  key,
  qrimg: true,
  platform: 'web',
  timestamp: Date.now()
}
```

1. 二维码 key 生成、二维码创建、二维码状态轮询都必须附带时间戳，避免缓存。
2. 如果实际包方法名不同，以包真实导出为准，不要猜测。
3. 保留统一状态映射：

```ts
type QrLoginStatus =
  | 'waiting'
  | 'scanned'
  | 'authorized'
  | 'expired'
  | 'failed'
```

1. 如果手机端仍提示“设备环境异常”，不要继续死磕二维码登录，应在 UI 中提示用户改用网页登录。

## 二、新增网页登录获取 Cookie 主方案

新增主进程服务：

```text
src/main/services/WebLoginService.ts
```

职责：

1. 创建一个独立 Electron BrowserWindow。
2. 使用独立持久化 session，例如：

```ts
session.fromPartition('persist:ncm-login')
```

1. 加载网易云网页版：

```text
https://music.163.com
```

1. 用户在网页中自行完成官方登录。
2. 登录窗口中不要注入脚本获取账号密码。
3. 监听页面跳转、cookie 变化或用户点击“我已完成登录”按钮。
4. 从该窗口 session 中读取 `music.163.com` 相关 cookies。
5. 将 cookies 序列化为标准 Cookie 字符串。
6. 调用 `AuthService.verifyCookieLogin(cookie)` 验证是否可用。
7. 验证成功后，将 cookie 存入 `SecureStorageService`。
8. 获取当前用户信息并保存到 UserRepository。
9. 关闭登录窗口并通知 renderer 登录成功。

注意：

- Cookie 只能在 main process 中处理。
- 不得通过 IPC 返回完整 Cookie 给 renderer。
- 不得在日志中输出 Cookie。
- 不要读取用户 Chrome/Safari 系统浏览器 Cookie。
- 只读取 WaveYourYarn 自己创建的登录窗口 session Cookie。

## 三、新增手动导入 Cookie 兜底方案

新增 IPC：

```ts
auth:login-with-cookie
```

preload 暴露：

```ts
window.waveYourYarn.auth.loginWithCookie(cookie: string)
```

AuthService 新增：

```ts
loginWithCookie(cookie: string): Promise<LoginStatusResult>
verifyCookieLogin(cookie: string): Promise<UserProfile>
```

流程：

```text
用户粘贴 Cookie
  ↓
主进程校验 Cookie 格式
  ↓
调用 api-enhanced 登录状态 / 用户信息接口验证
  ↓
验证成功后保存到 SecureStorageService
  ↓
保存用户信息
  ↓
返回登录成功
```

要求：

- renderer 可以传入 Cookie，但不能读取已保存 Cookie。
- 日志中不能输出 Cookie。
- 如果 Cookie 无效，返回友好错误：Cookie 无效或已过期，请重新获取。

## 四、调整登录页 UI

修改 `LoginPage.tsx`。

登录页分成三个 Tab 或三个卡片：

```text
推荐：网页登录
备用：扫码登录
高级：手动导入 Cookie
```

### Web 登录卡片

按钮：

```text
打开网易云网页登录
```

说明：

```text
将在独立窗口中打开网易云官方网页。登录完成后，WaveYourYarn 会在本机读取该窗口的登录 Cookie，用于访问你自己的音乐数据。
```

### 扫码登录卡片

保留原二维码登录逻辑，但标注：

```text
该方式可能受到网易云风控影响。如果手机提示设备环境异常，请使用网页登录。
```

### 手动 Cookie 卡片

提供 textarea，让用户粘贴 Cookie。

说明：

```text
Cookie 相当于登录凭证，请只在本机使用，不要分享给任何人。
```

按钮：

```text
验证并登录
```

## 五、调整 AuthService

AuthService 需要支持三种登录来源：

```ts
type LoginMethod = 'web' | 'qr' | 'manual_cookie'
```

登录成功后统一走：

```text
保存 Cookie
  ↓
获取当前用户信息
  ↓
标准化 UserProfile
  ↓
写入 users 表
  ↓
更新登录状态
```

无论登录来源是什么，Dashboard、Settings、后续歌曲同步都只关心：

```ts
LoginStatusResult {
  isLoggedIn: boolean
  user?: UserProfile
}
```

## 六、安全要求

必须遵守：

1. renderer 不得读取已保存 Cookie。
2. renderer 不得直接调用 api-enhanced。
3. renderer 不得直接访问 Electron session。
4. Cookie 只允许在 main process 和 SecureStorageService 中处理。
5. 日志不得输出 Cookie、MUSIC_U、__csrf 等敏感字段。
6. 手动导入 Cookie 时，仅用于当前用户主动授权访问自己的网易云数据。
7. 退出登录时要清理 SecureStorageService 中的 Cookie，并可选择清理 `persist:ncm-login` session cookies。

## 七、验收标准

完成后需要满足：

1. Web 登录窗口可以打开网易云官网。
2. 用户在 Web 登录窗口完成登录后，应用可以读取该 session 的 Cookie。
3. 应用可以用 Cookie 调用 api-enhanced 获取当前用户信息。
4. Dashboard 能显示用户昵称和头像。
5. Settings 能显示登录状态并支持退出登录。
6. 手动粘贴 Cookie 可以完成登录。
7. 二维码登录如果继续被拦截，页面能提示用户改用网页登录。
8. Cookie 不出现在 renderer 状态、控制台日志和普通错误信息中。
9. `pnpm typecheck` 通过。
10. `pnpm lint` 尽量通过。

```
## 7. 最终建议

我建议你不要再把“第三方 API 二维码登录”作为主线继续开发。更稳的路线是：

```text
主登录方案：Electron 内置网页登录获取 Cookie
备用方案：手动 Cookie 导入
实验方案：api-enhanced 二维码登录，修复 platform=web 后保留
```

这样后续读取“我喜欢的音乐”、导出、AI 分析、自动整理子歌单都可以继续基于 `api-enhanced + cookie` 走，不会因为二维码登录风控卡死整个项目。