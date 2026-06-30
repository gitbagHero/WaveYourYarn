import type { WaveYourYarnApi } from '../../../preload/types'

declare global {
  interface Window {
    waveYourYarn: WaveYourYarnApi
  }
}

export {}
