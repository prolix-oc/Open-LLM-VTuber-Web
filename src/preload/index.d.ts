// src/preload/index.d.ts - Updated type definitions with VAD support
import { ElectronAPI } from '@electron-toolkit/preload'

interface WhisperAPI {
  getAvailableWhisperModels: () => Promise<any[]>
  checkWhisperModel: (modelName: string) => Promise<boolean>
  transcribeWithWhisper: (options: any) => Promise<any>
  openWhisperModelsDirectory: () => Promise<boolean>
  getModelsPath: () => Promise<string | null>
}

interface OBSSettings {
  enabled: boolean
  port: number
  enableBrowserSource: boolean
  enableWindowCapture: boolean
  windowWidth: number
  windowHeight: number
  transparentBackground: boolean
  autoStart: boolean
}

interface OBSAPI {
  // Settings management
  getSettings: () => Promise<OBSSettings>
  updateSettings: (settings: Partial<OBSSettings>) => Promise<OBSSettings>
  
  // Server control
  startServer: () => Promise<{ success: boolean; error?: string; url?: string }>
  stopServer: () => Promise<{ success: boolean; error?: string }>
  getStatus: () => Promise<{
    serverRunning: boolean
    serverUrl: string | null
    browserSourceUrl: string | null
    connectedClients: any
    vad?: {
      micOn: boolean
      micEnabled: boolean
    }
  }>
  
  // Window control
  openWindow: () => Promise<{ success: boolean; error?: string }>
  closeWindow: () => Promise<{ success: boolean }>
  
  // URL generation
  getBrowserSourceUrl: (width?: number, height?: number, transparent?: boolean) => Promise<string>
}

// NEW: VAD API interface
interface VADAPI {
  // State management
  getState: () => Promise<{ micOn: boolean; micEnabled: boolean }>
  updateState: (vadState: { micOn: boolean; micEnabled: boolean }) => void
  toggleMicEnabled: () => Promise<{ success: boolean; micEnabled: boolean; status: 'ON' | 'OFF' }>
  
  // Event listeners
  onMicToggle: (callback: () => void) => () => void
}

interface CustomAPI {
  // Platform detection
  getPlatform: () => Promise<string>

  // Window control
  setIgnoreMouseEvents: (ignore: boolean) => void
  
  // Component hover handlers (for pet mode)
  updateComponentHover: (componentId: string, isHovering: boolean) => void
  showContextMenu: () => void

  // Mode change handlers
  sendRendererReadyForModeChange: (mode: string) => void
  sendModeChangeRendered: () => void
  sendToggleForceIgnoreMouse: () => void

  // Window state control
  sendWindowUnfullscreen: () => void
  windowMinimize: () => void
  windowMaximize: () => void
  windowClose: () => void

  // Models directory operations
  getModelsDirectory: () => Promise<string>
  getBackgroundsDirectory: () => Promise<string>
  scanModels: () => Promise<any[]>
  scanBackgrounds: () => Promise<string[]>
  openModelsDirectory: () => Promise<void>
  openBackgroundsDirectory: () => Promise<void>
  getModelFileUrl: (modelFile: string) => Promise<string>
  getBackgroundBlob: (filename: string) => Promise<string>

  // Legacy file operations
  selectBackgroundImage: () => Promise<string | null>
  createFileBlob: (filePath: string) => Promise<string>

  // Whisper service methods (direct access)
  whisperGetAvailableModels: () => Promise<string[]>
  whisperCheckModel: (modelName: string) => Promise<boolean>
  whisperTranscribe: (options: any) => Promise<any>
  whisperOpenModelsDirectory: () => Promise<boolean>
  whisperGetModelsPath: () => Promise<string | null>

  // NEW: VAD service methods (direct access)
  vadGetState: () => Promise<{ micOn: boolean; micEnabled: boolean }>
  vadUpdateState: (vadState: { micOn: boolean; micEnabled: boolean }) => void
  vadToggleMicEnabled: () => Promise<{ success: boolean; micEnabled: boolean; status: 'ON' | 'OFF' }>

  // OBS Integration methods (direct access)
  obsGetSettings: () => Promise<OBSSettings>
  obsUpdateSettings: (settings: Partial<OBSSettings>) => Promise<OBSSettings>
  obsGetStatus: () => Promise<{
    serverRunning: boolean
    serverUrl: string | null
    browserSourceUrl: string | null
    connectedClients: any
    vad?: { micOn: boolean; micEnabled: boolean }
  }>
  obsStartServer: () => Promise<{ success: boolean; error?: string; url?: string }>
  obsStopServer: () => Promise<{ success: boolean; error?: string }>
  obsOpenWindow: () => Promise<{ success: boolean; error?: string }>
  obsCloseWindow: () => Promise<{ success: boolean }>
  obsGetBrowserSourceUrl: (width?: number, height?: number, transparent?: boolean) => Promise<string>

  // OBS Sync functions for Live2D
  obsSyncModel: (modelInfo: any) => Promise<void>
  obsSyncMotion: (group: string, index?: number, priority?: number) => Promise<void>
  obsSyncExpression: (expression: string | number) => Promise<void>
  obsSyncAudio: (volume: number, frequency?: number) => Promise<void>

  // Event listeners
  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
  onWindowFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void
  onForceIgnoreMouseChanged: (callback: (forceIgnore: boolean) => void) => () => void
  onPreModeChanged: (callback: (mode: string) => void) => () => void
  onModeChanged: (callback: (mode: string) => void) => () => void
  
  // NEW: VAD event listeners
  onVADMicToggle: (callback: () => void) => () => void

  // OBS event listeners
  onOBSServerStatusChanged: (callback: (status: any) => void) => () => void
  onOBSClientConnected: (callback: (clientInfo: any) => void) => () => void
  onOBSClientDisconnected: (callback: (clientInfo: any) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
    
    // Separate API objects for easy access
    whisperAPI: WhisperAPI
    vadAPI: VADAPI
  }
}