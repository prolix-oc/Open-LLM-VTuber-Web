// src/renderer/src/hooks/utils/use-obs-pet-mode.ts
import { useState, useCallback, useEffect } from 'react';
import { useOBSCanvasStreaming } from './use-obs-canvas-streaming';
import { useOBSAPI } from './use-obs-api';

export type OBSCaptureMode = 'disabled' | 'pet-window' | 'canvas-stream' | 'browser-source';

interface OBSPetModeOptions {
  width?: number;
  height?: number;
  transparent?: boolean;
  alwaysOnTop?: boolean;
  frameless?: boolean;
}

/**
 * Enhanced hook for managing OBS capture modes using existing pet mode infrastructure
 * This provides multiple efficient capture methods without double-rendering
 */
export const useOBSPetMode = () => {
  const [captureMode, setCaptureMode] = useState<OBSCaptureMode>('disabled');
  const [petModeOptions, setPetModeOptions] = useState<OBSPetModeOptions>({
    width: 800,
    height: 600,
    transparent: true,
    alwaysOnTop: true,
    frameless: true,
  });

  // Use the universal OBS API hook
  const { obs, setWindowMode, isAvailable } = useOBSAPI();

  // Canvas streaming hook for browser source method
  const {
    isStreaming,
    stream,
    startStreaming,
    stopStreaming,
    getStreamUrl,
  } = useOBSCanvasStreaming({
    enabled: captureMode === 'canvas-stream',
    frameRate: 30,
  });

  /**
   * Switch to Pet Window Capture Mode
   * Uses the existing pet mode to create a transparent window that OBS can capture
   */
  const enablePetWindowCapture = useCallback(async (options?: OBSPetModeOptions) => {
    try {
      if (options) {
        setPetModeOptions(prev => ({ ...prev, ...options }));
      }

      // Use existing pet mode infrastructure
      const success = await setWindowMode('pet');
      if (success) {
        setCaptureMode('pet-window');
        console.log('✅ Pet window capture mode enabled');
        return true;
      } else {
        console.error('❌ Pet mode API not available');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to enable pet window capture:', error);
      return false;
    }
  }, [setWindowMode]);

  /**
   * Switch to Canvas Stream Mode
   * Streams the Live2D canvas directly to OBS without creating additional windows
   */
  const enableCanvasStream = useCallback(async () => {
    try {
      setCaptureMode('canvas-stream');
      const stream = await startStreaming();
      
      if (stream) {
        console.log('✅ Canvas stream capture mode enabled');
        return { success: true, stream, streamUrl: getStreamUrl() };
      } else {
        console.error('❌ Failed to create canvas stream');
        setCaptureMode('disabled');
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Failed to enable canvas stream:', error);
      setCaptureMode('disabled');
      return { success: false };
    }
  }, [startStreaming, getStreamUrl]);

  /**
   * Switch to Browser Source Mode
   * Creates a dedicated OBS browser source URL
   */
  const enableBrowserSource = useCallback(async (options?: { width?: number; height?: number }) => {
    try {
      const width = options?.width || petModeOptions.width || 800;
      const height = options?.height || petModeOptions.height || 600;

      // Use existing OBS integration to get browser source URL
      const browserUrl = await obs.getBrowserSourceUrl(width, height, true);
      setCaptureMode('browser-source');
      console.log('✅ Browser source capture mode enabled:', browserUrl);
      return { success: true, url: browserUrl };
    } catch (error) {
      console.error('❌ Failed to enable browser source:', error);
      return { success: false };
    }
  }, [petModeOptions, obs]);

  /**
   * Disable all OBS capture modes
   */
  const disableCapture = useCallback(async () => {
    try {
      // Stop canvas streaming if active
      if (isStreaming) {
        stopStreaming();
      }

      // Return to window mode if in pet mode
      if (captureMode === 'pet-window') {
        await setWindowMode('window');
      }

      setCaptureMode('disabled');
      console.log('✅ OBS capture disabled');
      return true;
    } catch (error) {
      console.error('❌ Failed to disable capture:', error);
      return false;
    }
  }, [captureMode, isStreaming, stopStreaming, setWindowMode]);

  /**
   * Get the appropriate capture instructions for OBS Studio
   */
  const getCaptureInstructions = useCallback(() => {
    switch (captureMode) {
      case 'pet-window':
        return {
          type: 'Window Capture',
          instructions: [
            '1. Add a "Window Capture" source in OBS',
            '2. Select the Enspira VTuber window from the dropdown',
            '3. Enable "Capture Cursor" if desired',
            '4. The transparent background will be automatically handled'
          ],
          tips: 'This method provides the best performance and lowest latency.'
        };

      case 'canvas-stream':
        return {
          type: 'Canvas Stream',
          instructions: [
            '1. Use the provided stream URL in your streaming software',
            '2. The canvas is streamed directly without additional windows',
            '3. Real-time updates are automatically synchronized'
          ],
          tips: 'This method is efficient and works well for custom streaming setups.'
        };

      case 'browser-source':
        return {
          type: 'Browser Source',
          instructions: [
            '1. Add a "Browser Source" in OBS',
            '2. Use the provided URL in the URL field',
            '3. Set width/height to match your requirements',
            '4. Enable "Shutdown source when not visible" for better performance'
          ],
          tips: 'This method works across different OBS setups and provides good compatibility.'
        };

      default:
        return {
          type: 'Disabled',
          instructions: ['No capture mode is currently active'],
          tips: 'Choose a capture mode to get started with OBS integration.'
        };
    }
  }, [captureMode]);

  /**
   * Update pet mode window options
   */
  const updatePetModeOptions = useCallback((options: Partial<OBSPetModeOptions>) => {
    setPetModeOptions(prev => ({ ...prev, ...options }));
  }, []);

  /**
   * Get current status and capabilities
   */
  const getStatus = useCallback(() => {
    const availability = isAvailable();
    
    return {
      captureMode,
      isActive: captureMode !== 'disabled',
      isStreaming: captureMode === 'canvas-stream' && isStreaming,
      currentStream: stream,
      streamUrl: captureMode === 'canvas-stream' ? getStreamUrl() : null,
      petModeOptions,
      capabilities: {
        petWindow: availability.hasSetWindowMode,
        canvasStream: !!HTMLCanvasElement.prototype.captureStream,
        browserSource: availability.hasOBS,
      }
    };
  }, [captureMode, isStreaming, stream, getStreamUrl, petModeOptions, isAvailable]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (captureMode !== 'disabled') {
        disableCapture();
      }
    };
  }, [captureMode, disableCapture]);

  return {
    // Current state
    captureMode,
    isActive: captureMode !== 'disabled',
    petModeOptions,

    // Mode switching
    enablePetWindowCapture,
    enableCanvasStream,
    enableBrowserSource,
    disableCapture,

    // Configuration
    updatePetModeOptions,

    // Information
    getCaptureInstructions,
    getStatus,

    // Canvas streaming specific (when in canvas-stream mode)
    isStreaming,
    stream,
    streamUrl: getStreamUrl(),
  };
};