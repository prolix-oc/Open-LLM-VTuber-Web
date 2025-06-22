// src/preload/index.d.ts - Updated type definitions with CDI3 and cross-platform support
import { ElectronAPI } from '@electron-toolkit/preload'

interface WhisperAPI {
  getAvailableWhisperModels: () => Promise<any[]>
  checkWhisperModel: (modelName: string) => Promise<boolean>
  transcribeWithWhisper: (options: any) => Promise<any>
  openWhisperModelsDirectory: () => Promise<boolean>
  getModelsPath: () => Promise<string | null>
  setActiveStatus: (active: boolean) => Promise<void>
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

interface OBSStatus {
  serverRunning: boolean
  serverUrl: string | null
  browserSourceUrl: string | null
  connectedClients: {
    totalClients: number
    obsClients: number
    browserClients: number
  }
  vad?: {
    micOn: boolean
    micEnabled: boolean
  }
}

interface OBSAPI {
  // Settings management
  getSettings: () => Promise<OBSSettings>
  updateSettings: (settings: Partial<OBSSettings>) => Promise<OBSSettings>
  ensureInitialized: () => Promise<{ success: boolean; error?: string }>
  
  // Server control
  startServer: () => Promise<{ success: boolean; error?: string; url?: string }>
  stopServer: () => Promise<{ success: boolean; error?: string }>
  getStatus: () => Promise<OBSStatus>
  
  // Window control
  openWindow: () => Promise<{ success: boolean; error?: string }>
  closeWindow: () => Promise<{ success: boolean }>
  
  // URL generation
  getBrowserSourceUrl: (width?: number, height?: number, transparent?: boolean) => Promise<string>
  notifyCanvasReady: () => Promise<void>
  
  // Synchronization
  syncModel: (modelInfo: any) => Promise<void>
  syncMotion: (group: string, index?: number, priority?: number) => Promise<void>
  syncExpression: (expression: string | number) => Promise<void>
  syncAudio: (volume: number, frequency?: number) => Promise<void>
  
  // Event listeners
  onServerStatusChanged: (callback: (status: OBSStatus) => void) => () => void
  onClientConnected: (callback: (clientInfo: any) => void) => () => void
  onClientDisconnected: (callback: (clientInfo: any) => void) => () => void
}

// VAD API interface
interface VADAPI {
  // State management
  getState: () => Promise<{ micOn: boolean; micEnabled: boolean }>
  updateState: (vadState: { micOn: boolean; micEnabled: boolean }) => void
  toggleMicEnabled: () => Promise<{ success: boolean; micEnabled: boolean; status: 'ON' | 'OFF' }>
  
  // Event listeners
  onMicToggle: (callback: () => void) => () => void
}

// 🎤 Microphone Service API interface
interface MicrophoneServiceSettings {
  enabled: boolean
  port: number
  enableCORS: boolean
  autoStart: boolean
}

interface MicrophoneServiceStatus {
  serviceRunning: boolean
  serviceUrl: string | null
  micToggleUrl: string | null
  micStatusUrl: string | null
  vadState: {
    micOn: boolean
    micEnabled: boolean
  }
}

interface MicrophoneServiceAPI {
  // Settings management
  getSettings: () => Promise<MicrophoneServiceSettings>
  updateSettings: (settings: Partial<MicrophoneServiceSettings>) => Promise<MicrophoneServiceSettings>
  
  // Service control
  start: () => Promise<{ success: boolean; error?: string; url?: string }>
  stop: () => Promise<{ success: boolean; error?: string }>
  getStatus: () => Promise<MicrophoneServiceStatus>
  getToggleUrl: () => Promise<string>
  getStatusUrl: () => Promise<string>
  ensureInitialized: () => Promise<{ success: boolean; error?: string }>
}

// 🎨 CDI3 API interface
interface CDI3FileInfo {
  name: string
  version: string
  parameterCount: number
  fileSize: number
  platform: string
}

interface EnhancedModelInfo {
  name: string
  directory: string
  modelFile: string
  hasTextures: boolean
  hasMotions: boolean
  hasCDI3?: boolean
  cdi3File?: string
  cdi3Info?: CDI3FileInfo
  platform?: string
}

interface CDI3API {
  // CDI3 file discovery
  findCDI3ForModel: (modelPath: string) => Promise<string | null>
  findFiles: (pattern: string) => Promise<string[]>
  readFile: (filePath: string) => Promise<any | null>
  getInfo: (filePath: string) => Promise<CDI3FileInfo | null>
  scanModelsWithCDI3: (modelsDir: string) => Promise<EnhancedModelInfo[]>
  
  // Generic file system operations
  filesFind: (pattern: string) => Promise<string[]>
  fsReadFile: (filePath: string, options?: { encoding?: string }) => Promise<string | Buffer>
  fsExists: (filePath: string) => Promise<boolean>
  fsStat: (filePath: string) => Promise<any>
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

  // Models directory operations with enhanced CDI3 support
  getModelsDirectory: () => Promise<string>
  getBackgroundsDirectory: () => Promise<string>
  scanModels: () => Promise<EnhancedModelInfo[]>
  scanBackgrounds: () => Promise<string[]>
  openModelsDirectory: () => Promise<void>
  openBackgroundsDirectory: () => Promise<void>
  getModelFileUrl: (modelFile: string) => Promise<string>
  getBackgroundBlob: (filename: string) => Promise<string>

  // 🎨 CDI3 functionality (direct access)
  findCDI3ForModel: (modelPath: string) => Promise<string | null>
  cdi3FindFiles: (pattern: string) => Promise<string[]>
  cdi3ReadFile: (filePath: string) => Promise<any | null>
  cdi3GetInfo: (filePath: string) => Promise<CDI3FileInfo | null>
  modelscanWithCDI3: (modelsDir: string) => Promise<EnhancedModelInfo[]>

  // Generic file system operations
  filesFind: (pattern: string) => Promise<string[]>
  fsReadFile: (filePath: string, options?: { encoding?: string }) => Promise<string | Buffer>
  fsExists: (filePath: string) => Promise<boolean>
  fsStat: (filePath: string) => Promise<any>

  // Legacy file operations
  selectBackgroundImage: () => Promise<string | null>
  createFileBlob: (filePath: string) => Promise<string>

  // Whisper service methods (direct access)
  whisperGetAvailableModels: () => Promise<string[]>
  whisperCheckModel: (modelName: string) => Promise<boolean>
  whisperTranscribe: (options: any) => Promise<any>
  whisperOpenModelsDirectory: () => Promise<boolean>
  whisperGetModelsPath: () => Promise<string | null>
  whisperSetActiveStatus: (active: boolean) => Promise<void>

  // VAD service methods (direct access)
  vadGetState: () => Promise<{ micOn: boolean; micEnabled: boolean }>
  vadUpdateState: (vadState: { micOn: boolean; micEnabled: boolean }) => void
  vadToggleMicEnabled: () => Promise<{ success: boolean; micEnabled: boolean; status: 'ON' | 'OFF' }>

  // 🎤 Microphone Service methods (direct access)
  micServiceGetSettings: () => Promise<MicrophoneServiceSettings>
  micServiceUpdateSettings: (settings: Partial<MicrophoneServiceSettings>) => Promise<MicrophoneServiceSettings>
  micServiceStart: () => Promise<{ success: boolean; error?: string; url?: string }>
  micServiceStop: () => Promise<{ success: boolean; error?: string }>
  micServiceGetStatus: () => Promise<MicrophoneServiceStatus>
  micServiceGetToggleUrl: () => Promise<string>
  micServiceGetStatusUrl: () => Promise<string>
  micServiceEnsureInitialized: () => Promise<{ success: boolean; error?: string }>

  // OBS Integration methods (direct access)
  obsGetSettings: () => Promise<OBSSettings>
  obsUpdateSettings: (settings: Partial<OBSSettings>) => Promise<OBSSettings>
  obsEnsureInitialized: () => Promise<{ success: boolean; error?: string }>
  obsGetStatus: () => Promise<OBSStatus>
  obsStartServer: () => Promise<{ success: boolean; error?: string; url?: string }>
  obsStopServer: () => Promise<{ success: boolean; error?: string }>
  obsOpenWindow: () => Promise<{ success: boolean; error?: string }>
  obsCloseWindow: () => Promise<{ success: boolean }>
  obsGetBrowserSourceUrl: (width?: number, height?: number, transparent?: boolean) => Promise<string>
  obsNotifyCanvasReady: () => Promise<void>

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
  
  // VAD event listeners
  onVADMicToggle: (callback: () => void) => () => void

  // OBS event listeners
  onOBSServerStatusChanged: (callback: (status: OBSStatus) => void) => () => void
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
    micServiceAPI: MicrophoneServiceAPI
    cdi3API: CDI3API
    obsAPI: OBSAPI
  }
}