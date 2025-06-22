// src/renderer/src/hooks/utils/use-obs-integration.ts
import { useEffect, useRef, useCallback } from 'react';
import { useLive2DConfig } from '@/context/live2d-config-context';
import { useLive2DModel } from '@/context/live2d-model-context';
import { useAiState } from '@/context/ai-state-context';

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

/**
 * Hook for managing OBS integration and synchronizing Live2D model state
 * Automatically syncs model changes, motions, expressions, and audio data to OBS clients
 */
export const useOBSIntegration = () => {
  const { modelInfo } = useLive2DConfig();
  const { currentModel } = useLive2DModel();
  const { aiState } = useAiState();
  
  // Track the last synced state to avoid unnecessary updates
  const lastSyncedModelRef = useRef<string | null>(null);
  const lastSyncedExpressionRef = useRef<string | number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  /**
   * Sync current model information to OBS clients
   */
  const syncModelToOBS = useCallback(async () => {
    if (!modelInfo?.url) return;

    const modelKey = `${modelInfo.url}_${modelInfo.name}_${modelInfo.kScale}`;
    
    // Only sync if model has actually changed
    if (lastSyncedModelRef.current === modelKey) return;

    try {
      await window.api.obsSyncModel({
        url: modelInfo.url,
        name: modelInfo.name,
        isLocal: modelInfo.isLocal,
        kScale: modelInfo.kScale,
        idleMotionGroupName: modelInfo.idleMotionGroupName,
        initialXshift: modelInfo.initialXshift,
        initialYshift: modelInfo.initialYshift
      });

      lastSyncedModelRef.current = modelKey;
      console.log('📺 Synced model to OBS clients:', modelInfo.name);
    } catch (error) {
      console.error('Failed to sync model to OBS:', error);
    }
  }, [modelInfo]);

  /**
   * Sync expression changes to OBS clients
   */
  const syncExpressionToOBS = useCallback(async (expression: string | number) => {
    if (lastSyncedExpressionRef.current === expression) return;

    try {
      await window.api.obsSyncExpression(expression);
      lastSyncedExpressionRef.current = expression;
      console.log('😊 Synced expression to OBS clients:', expression);
    } catch (error) {
      console.error('Failed to sync expression to OBS:', error);
    }
  }, []);

  /**
   * Sync motion to OBS clients
   */
  const syncMotionToOBS = useCallback(async (group: string, index?: number, priority?: number) => {
    try {
      await window.api.obsSyncMotion(group, index, priority);
      console.log('🎭 Synced motion to OBS clients:', { group, index, priority });
    } catch (error) {
      console.error('Failed to sync motion to OBS:', error);
    }
  }, []);

  /**
   * Sync audio data for lip sync to OBS clients
   */
  const syncAudioToOBS = useCallback(async (volume: number, frequency?: number) => {
    try {
      await window.api.obsSyncAudio(volume, frequency);
    } catch (error) {
      console.error('Failed to sync audio to OBS:', error);
    }
  }, []);

  /**
   * Initialize audio analysis for lip sync
   */
  const initializeAudioAnalysis = useCallback(() => {
    if (audioContextRef.current) return; // Already initialized

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;

      console.log('🎤 Initialized audio analysis for OBS sync');
    } catch (error) {
      console.error('Failed to initialize audio analysis:', error);
    }
  }, []);

  /**
   * Analyze audio and sync volume data to OBS
   */
  const analyzeAndSyncAudio = useCallback((audioElement: HTMLAudioElement) => {
    if (!audioContextRef.current || !analyserRef.current) {
      initializeAudioAnalysis();
      if (!audioContextRef.current || !analyserRef.current) return;
    }

    try {
      const source = audioContextRef.current.createMediaElementSource(audioElement);
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const analyzeFrame = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const volume = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length / 255;
        
        // Find dominant frequency
        let maxIndex = 0;
        let maxValue = 0;
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > maxValue) {
            maxValue = dataArray[i];
            maxIndex = i;
          }
        }
        
        const frequency = (maxIndex * audioContextRef.current!.sampleRate) / (analyserRef.current.fftSize * 2);
        
        // Sync to OBS (throttled to ~30fps)
        syncAudioToOBS(volume, frequency);
        
        if (!audioElement.paused && !audioElement.ended) {
          requestAnimationFrame(analyzeFrame);
        }
      };

      analyzeFrame();
    } catch (error) {
      console.error('Failed to analyze audio for OBS sync:', error);
    }
  }, [initializeAudioAnalysis, syncAudioToOBS]);

  /**
   * Hook into Live2D model events to sync with OBS
   */
  useEffect(() => {
    if (!currentModel) return;

    // Listen for motion events
    const handleMotion = (group: string, index?: number) => {
      syncMotionToOBS(group, index, 3); // Use normal priority
    };

    // Listen for expression changes
    const handleExpression = (expression: string | number) => {
      syncExpressionToOBS(expression);
    };

    // Set up event listeners if the model supports them
    if (currentModel.on && typeof currentModel.on === 'function') {
      currentModel.on('motion', handleMotion);
      currentModel.on('expression', handleExpression);
    }

    // Sync current model state
    syncModelToOBS();

    return () => {
      // Clean up event listeners
      if (currentModel.off && typeof currentModel.off === 'function') {
        currentModel.off('motion', handleMotion);
        currentModel.off('expression', handleExpression);
      }
    };
  }, [currentModel, syncModelToOBS, syncMotionToOBS, syncExpressionToOBS]);

  /**
   * Sync model info when it changes
   */
  useEffect(() => {
    if (modelInfo?.url) {
      syncModelToOBS();
    }
  }, [modelInfo?.url, modelInfo?.name, modelInfo?.kScale, syncModelToOBS]);

  /**
   * Handle AI state changes for expressions
   */
  useEffect(() => {
    // Map AI states to expressions if needed
    // This could be configured in model settings
    const stateExpressionMap: Record<string, string> = {
      THINKING: 'thinking',
      SPEAKING: 'happy',
      LISTENING: 'surprised',
      IDLE: 'default'
    };

    const expression = stateExpressionMap[aiState];
    if (expression && modelInfo?.defaultEmotion !== expression) {
      syncExpressionToOBS(expression);
    }
  }, [aiState, modelInfo?.defaultEmotion, syncExpressionToOBS]);

  /**
   * Get OBS settings
   */
  const getOBSSettings = useCallback(async (): Promise<OBSSettings> => {
    try {
      return await window.api.obsGetSettings();
    } catch (error) {
      console.error('Failed to get OBS settings:', error);
      throw error;
    }
  }, []);

  /**
   * Update OBS settings
   */
  const updateOBSSettings = useCallback(async (newSettings: Partial<OBSSettings>): Promise<OBSSettings> => {
    try {
      return await window.api.obsUpdateSettings(newSettings);
    } catch (error) {
      console.error('Failed to update OBS settings:', error);
      throw error;
    }
  }, []);

  /**
   * Get OBS server status
   */
  const getOBSStatus = useCallback(async (): Promise<OBSStatus> => {
    try {
      return await window.api.obsGetStatus();
    } catch (error) {
      console.error('Failed to get OBS status:', error);
      throw error;
    }
  }, []);

  /**
   * Start OBS server
   */
  const startOBSServer = useCallback(async (): Promise<{ success: boolean; error?: string; url?: string }> => {
    try {
      return await window.api.obsStartServer();
    } catch (error) {
      console.error('Failed to start OBS server:', error);
      return { success: false, error: error.message };
    }
  }, []);

  /**
   * Stop OBS server
   */
  const stopOBSServer = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      return await window.api.obsStopServer();
    } catch (error) {
      console.error('Failed to stop OBS server:', error);
      return { success: false, error: error.message };
    }
  }, []);

  /**
   * Open OBS capture window
   */
  const openOBSWindow = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      return await window.api.obsOpenWindow();
    } catch (error) {
      console.error('Failed to open OBS window:', error);
      return { success: false, error: error.message };
    }
  }, []);

  /**
   * Close OBS capture window
   */
  const closeOBSWindow = useCallback(async (): Promise<{ success: boolean }> => {
    try {
      return await window.api.obsCloseWindow();
    } catch (error) {
      console.error('Failed to close OBS window:', error);
      return { success: false };
    }
  }, []);

  /**
   * Get browser source URL with custom dimensions
   */
  const getBrowserSourceUrl = useCallback(async (width?: number, height?: number, transparent?: boolean): Promise<string> => {
    try {
      return await window.api.obsGetBrowserSourceUrl(width, height, transparent);
    } catch (error) {
      console.error('Failed to get browser source URL:', error);
      throw error;
    }
  }, []);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
        analyserRef.current = null;
      }
    };
  }, []);

  return {
    // Settings management
    getOBSSettings,
    updateOBSSettings,
    
    // Server control
    getOBSStatus,
    startOBSServer,
    stopOBSServer,
    
    // Window management
    openOBSWindow,
    closeOBSWindow,
    getBrowserSourceUrl,
    
    // Sync functions (for manual control)
    syncModelToOBS,
    syncMotionToOBS,
    syncExpressionToOBS,
    syncAudioToOBS,
    analyzeAndSyncAudio,
    
    // Audio analysis
    initializeAudioAnalysis
  };
};