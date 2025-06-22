import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// Custom APIs for renderer
const api = {
  // Platform detection
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Window control
  setIgnoreMouseEvents: (ignore: boolean) => 
    ipcRenderer.send('set-ignore-mouse-events', ignore),
  
  // Component hover handlers (for pet mode)
  updateComponentHover: (componentId: string, isHovering: boolean) =>
    ipcRenderer.send('update-component-hover', componentId, isHovering),
  
  showContextMenu: () => ipcRenderer.send('show-context-menu'),

  // Mode change handlers
  rendererReadyForModeChange: (mode: string) =>
    ipcRenderer.send('renderer-ready-for-mode-change', mode),
  
  modeChangeRendered: () => ipcRenderer.send('mode-change-rendered'),
  
  toggleForceIgnoreMouse: () => ipcRenderer.send('toggle-force-ignore-mouse'),

  // Window state control
  windowUnfullscreen: () => ipcRenderer.send('window-unfullscreen'),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

  // Models directory operations
  getModelsDirectory: () => ipcRenderer.invoke('get-models-directory'),
  getBackgroundsDirectory: () => ipcRenderer.invoke('get-backgrounds-directory'),
  scanModels: () => ipcRenderer.invoke('scan-models'),
  scanBackgrounds: () => ipcRenderer.invoke('scan-backgrounds'),
  openModelsDirectory: () => ipcRenderer.invoke('open-models-directory'),
  openBackgroundsDirectory: () => ipcRenderer.invoke('open-backgrounds-directory'),
  getModelFileUrl: (modelFile: string) => ipcRenderer.invoke('get-model-file-url', modelFile),
  getBackgroundBlob: (filename: string) => ipcRenderer.invoke('get-background-blob', filename),

  // Legacy file operations
  selectBackgroundImage: () => ipcRenderer.invoke('select-background-image'),
  createFileBlob: (filePath: string) => ipcRenderer.invoke('create-file-blob', filePath),

  // Whisper service
  whisper: {
    getAvailableModels: () => ipcRenderer.invoke('whisper:get-available-models'),
    checkModel: (modelName: string) => ipcRenderer.invoke('whisper:check-model', modelName),
    transcribe: (options: any) => ipcRenderer.invoke('whisper:transcribe', options),
    openModelsDirectory: () => ipcRenderer.invoke('whisper:open-models-directory'),
    getModelsPath: () => ipcRenderer.invoke('whisper:get-models-path'),
  },

  vad: {
    updateVADState: (vadState: { micOn: boolean; micEnabled: boolean }) => void;
    getVADState: () => Promise<{ micOn: boolean; micEnabled: boolean }>;
    toggleMicEnabled: () => Promise<{ success: boolean; micEnabled: boolean; status: string }>;
    onMicToggle: (callback: () => void) => () => void;
    removeMicToggleListener: (callback: () => void) => void;
  },

  // NEW: OBS Integration API
  obs: {
    // Settings management
    getSettings: () => ipcRenderer.invoke('obs:get-settings'),
    updateSettings: (settings: any) => ipcRenderer.invoke('obs:update-settings', settings),
    
    // Server control
    startServer: () => ipcRenderer.invoke('obs:start-server'),
    stopServer: () => ipcRenderer.invoke('obs:stop-server'),
    getStatus: () => ipcRenderer.invoke('obs:get-status'),
    
    // Window control
    openWindow: () => ipcRenderer.invoke('obs:open-window'),
    closeWindow: () => ipcRenderer.invoke('obs:close-window'),
    
    // URL generation
    getBrowserSourceUrl: (width?: number, height?: number, transparent?: boolean) =>
      ipcRenderer.invoke('obs:get-browser-source-url', width, height, transparent),
  },

  // NEW: OBS Sync functions for Live2D
  sendOBSModelUpdate: (modelInfo: any) => {
    console.log('📡 Preload: Sending OBS model update via IPC');
    ipcRenderer.send('obs:sync-model', modelInfo);
  },

  sendOBSMotionUpdate: (group: string, index?: number, priority?: number) => {
    console.log('📡 Preload: Sending OBS motion update via IPC');
    ipcRenderer.send('obs:sync-motion', group, index, priority);
  },

  sendOBSExpressionUpdate: (expression: string | number) => {
    console.log('📡 Preload: Sending OBS expression update via IPC');
    ipcRenderer.send('obs:sync-expression', expression);
  },

  sendOBSAudioUpdate: (volume: number, frequency?: number) => {
    console.log('📡 Preload: Sending OBS audio update via IPC');
    ipcRenderer.send('obs:sync-audio', volume, frequency);
  },

  // Event listeners
  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: any, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window-maximized-change', listener);
    return () => ipcRenderer.removeListener('window-maximized-change', listener);
  },

  onWindowFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
    const listener = (_event: any, isFullscreen: boolean) => callback(isFullscreen);
    ipcRenderer.on('window-fullscreen-change', listener);
    return () => ipcRenderer.removeListener('window-fullscreen-change', listener);
  },

  onForceIgnoreMouseChanged: (callback: (forceIgnore: boolean) => void) => {
    const listener = (_event: any, forceIgnore: boolean) => callback(forceIgnore);
    ipcRenderer.on('force-ignore-mouse-changed', listener);
    return () => ipcRenderer.removeListener('force-ignore-mouse-changed', listener);
  },

  onPreModeChanged: (callback: (mode: string) => void) => {
    const listener = (_event: any, mode: string) => callback(mode);
    ipcRenderer.on('pre-mode-changed', listener);
    return () => ipcRenderer.removeListener('pre-mode-changed', listener);
  },

  onModeChanged: (callback: (mode: string) => void) => {
    const listener = (_event: any, mode: string) => callback(mode);
    ipcRenderer.on('mode-changed', listener);
    return () => ipcRenderer.removeListener('mode-changed', listener);
  },

  onMicToggle: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('mic-toggle', listener);
    return () => ipcRenderer.removeListener('mic-toggle', listener);
  },

  onInterrupt: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('interrupt', listener);
    return () => ipcRenderer.removeListener('interrupt', listener);
  },

  onToggleForceIgnoreMouse: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('toggle-force-ignore-mouse', listener);
    return () => ipcRenderer.removeListener('toggle-force-ignore-mouse', listener);
  },

  onToggleScrollToResize: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('toggle-scroll-to-resize', listener);
    return () => ipcRenderer.removeListener('toggle-scroll-to-resize', listener);
  },

  onToggleInputSubtitle: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('toggle-input-subtitle', listener);
    return () => ipcRenderer.removeListener('toggle-input-subtitle', listener);
  },

  onSwitchCharacter: (callback: (filename: string) => void) => {
    const listener = (_event: any, filename: string) => callback(filename);
    ipcRenderer.on('switch-character', listener);
    return () => ipcRenderer.removeListener('switch-character', listener);
  },

  // Whisper events
  onWhisperModelsChanged: (callback: (models: any[]) => void) => {
    const listener = (_event: any, models: any[]) => callback(models);
    ipcRenderer.on('whisper-models-changed', listener);
    return () => ipcRenderer.removeListener('whisper-models-changed', listener);
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}