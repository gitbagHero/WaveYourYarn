import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { initializeDatabase } from './db/database'
import { ensureAppDirectories } from './utils/paths'
import { logger } from './utils/logger'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  try {
    ensureAppDirectories()
    initializeDatabase()
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
