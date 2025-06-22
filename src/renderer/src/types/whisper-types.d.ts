import { ElectronAPI } from "@electron-toolkit/preload";

interface ModelInfo {
  name: string;
  directory: string;
  modelFile: string;
  hasTextures: boolean;
  hasMotions: boolean;
}

// Define Whisper-related types locally to avoid import issues
interface WhisperModel {
  name: string;
  path: string;
  size: string;
  supported: boolean;
}

interface TranscriptionOptions {
  audioData: number[];
  modelName: string;
  language: string;
  task: 'transcribe' | 'translate';
  temperature: number;
}

interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
}

interface WhisperAPI {
  getAvailableWhisperModels: () => Promise<WhisperModel[]>;
  checkWhisperModel: (modelName: string) => Promise<boolean>;
  transcribeWithWhisper: (options: TranscriptionOptions) => Promise<TranscriptionResult>;
  openWhisperModelsDirectory: () => Promise<boolean>;
  getWhisperModelsPath: () => Promise<string | null>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    whisperAPI: WhisperAPI;
    api: {
      setIgnoreMouseEvents: (ignore: boolean) => void;
      toggleForceIgnoreMouse: () => void;
      onForceIgnoreMouseChanged: (
        callback: (isForced: boolean) => void
      ) => void;
      onModeChanged: (callback: (mode: "pet" | "window") => void) => void;
      showContextMenu: (x: number, y: number) => void;
      onMicToggle: (callback: () => void) => void;
      onInterrupt: (callback: () => void) => void;
      updateComponentHover: (componentId: string, isHovering: boolean) => void;
      onToggleInputSubtitle: (callback: () => void) => void;
      onToggleScrollToResize: (callback: () => void) => void;
      onSwitchCharacter: (callback: (filename: string) => void) => void;
      getConfigFiles: () => Promise<any[]>;
      updateConfigFiles: (files: any[]) => void;
      
      // Models directory management
      getModelsDirectory: () => Promise<string>;
      getBackgroundsDirectory: () => Promise<string>;
      scanModels: () => Promise<ModelInfo[]>;
      scanBackgrounds: () => Promise<string[]>;
      openModelsDirectory: () => Promise<void>;
      openBackgroundsDirectory: () => Promise<void>;
      getModelFileUrl: (modelFile: string) => Promise<string>;
      getBackgroundBlob: (filename: string) => Promise<string>;
      
      // Legacy operations
      selectBackgroundImage: () => Promise<string | null>;
      createFileBlob: (filePath: string) => Promise<string>;
    };
  }
}

interface IpcRenderer {
  on(
    channel: "mode-changed",
    func: (_event: any, mode: "pet" | "window") => void
  ): void;
  send(channel: string, ...args: any[]): void;
}