// src/renderer/src/types/obs-types.ts
export interface OBSSettings {
  enabled: boolean;
  port: number;
  enableBrowserSource: boolean;
  enableWindowCapture: boolean;
  windowWidth: number;
  windowHeight: number;
  transparentBackground: boolean;
  autoStart: boolean;
}

export interface OBSStatus {
  serverRunning: boolean;
  serverUrl: string | null;
  browserSourceUrl: string | null;
  connectedClients: {
    totalClients: number;
    obsClients: number;
    browserClients: number;
  };
}

export interface OBSModelInfo {
  url: string;
  name: string;
  isLocal: boolean;
  kScale?: string | number;
  idleMotionGroupName?: string;
  initialXshift?: number;
  initialYshift?: number;
}

// Extend the existing window.api interface
declare global {
  interface Window {
    api: {
      // ... existing API methods ...
      
      // OBS Integration methods (optional to avoid breaking existing code)
      obsGetSettings?: () => Promise<OBSSettings>;
      obsUpdateSettings?: (settings: Partial<OBSSettings>) => Promise<OBSSettings>;
      obsGetStatus?: () => Promise<OBSStatus>;
      obsStartServer?: () => Promise<{ success: boolean; error?: string; url?: string }>;
      obsStopServer?: () => Promise<{ success: boolean; error?: string }>;
      obsOpenWindow?: () => Promise<{ success: boolean; error?: string }>;
      obsCloseWindow?: () => Promise<{ success: boolean }>;
      obsGetBrowserSourceUrl?: (width?: number, height?: number, transparent?: boolean) => Promise<string>;
      obsSyncModel?: (modelInfo: OBSModelInfo) => Promise<void>;
      obsSyncMotion?: (group: string, index?: number, priority?: number) => Promise<void>;
      obsSyncExpression?: (expression: string | number) => Promise<void>;
      obsSyncAudio?: (volume: number, frequency?: number) => Promise<void>;
    };
  }
}