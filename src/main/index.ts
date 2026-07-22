import { app, BrowserWindow, dialog, session } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { initializeDatabase } from './db/database'
import { ensureAppDirectories, getLogsDir } from './utils/paths'
import { configureFileLogging, logger } from './utils/logger'
import { denyAllSessionPermissions, hardenMainWindow } from './security/electronSecurity'
import { JobManager } from './services/JobManager'

let mainWindow: BrowserWindow | null = null

if (process.env.WYY_E2E_USER_DATA_DIR) {
  app.setPath('userData', process.env.WYY_E2E_USER_DATA_DIR)
}

function createWindow(): void {
  const rendererFilePath = join(__dirname, '../renderer/index.html')

  mainWindow = new BrowserWindow({
    title: 'WaveYourYarn',
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    logger.error(`Preload script failed: ${preloadPath}`, error)
  })

  hardenMainWindow(mainWindow, {
    devServerUrl: process.env.ELECTRON_RENDERER_URL,
    rendererFilePath
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(rendererFilePath)
  }
}

app.whenReady().then(async () => {
  try {
    denyAllSessionPermissions(session.defaultSession, 'default')
    ensureAppDirectories()
    await configureFileLogging(getLogsDir())
    initializeDatabase()
    const interruptedJobCount = new JobManager().recoverInterruptedJobs()
    if (interruptedJobCount > 0) {
      logger.info(`Marked ${interruptedJobCount} unfinished AI job(s) as interrupted`)
    }
    registerIpcHandlers()
  } catch (error) {
    logger.error('Application initialization failed', error)
    dialog.showErrorBox(
      'WaveYourYarn 启动失败',
      '本地数据库初始化或升级失败。为保护已有数据，应用已停止启动。请查看日志后重试。'
    )
    app.quit()
    return
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in main process', error)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection in main process', reason)
})
