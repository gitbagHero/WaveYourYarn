import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'

const DEVELOPMENT_LLM_ENV_PREFIX = 'WYY_DEV_LLM_'

export default defineConfig(({ command, mode }) => {
  // Provider-specific development credentials must never be loaded by build or release commands.
  if (command === 'serve' && mode === 'development') {
    const developmentEnvironment = loadEnv(mode, process.cwd(), DEVELOPMENT_LLM_ENV_PREFIX)

    for (const [key, value] of Object.entries(developmentEnvironment)) {
      // Explicit shell variables take precedence over the local .env file.
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  }

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      resolve: {
        alias: {
          '@main': resolve('src/main')
        }
      }
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          output: {
            format: 'cjs',
            entryFileNames: '[name].cjs'
          }
        }
      }
    },
    renderer: {
      root: resolve('src/renderer'),
      plugins: [react()],
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src')
        }
      }
    }
  }
})
