// src/renderer/src/hooks/utils/use-obs-api.ts
import { useCallback } from 'react';

/**
 * Universal hook to access OBS API from either the real implementation or polyfill
 * This provides a consistent interface regardless of backend availability
 */
export const useOBSAPI = () => {
  // Helper to get OBS API from any available source
  const getOBSAPI = useCallback(() => {
    // Try window.api.obs first (real implementation)
    if (window.api?.obs) {
      return window.api.obs;
    }
    
    // Try global helper function
    if ((window as any).getOBSAPI) {
      return (window as any).getOBSAPI();
    }
    
    // Try polyfill directly
    if ((window as any).obsPolyfill?.obs) {
      return (window as any).obsPolyfill.obs;
    }
    
    return null;
  }, []);

  // Helper to get setWindowMode from any available source
  const getSetWindowMode = useCallback(() => {
    // Try window.api.setWindowMode first (real implementation)
    if (window.api?.setWindowMode) {
      return window.api.setWindowMode;
    }
    
    // Try global helper function
    if ((window as any).getSetWindowMode) {
      return (window as any).getSetWindowMode();
    }
    
    // Try polyfill directly
    if ((window as any).obsPolyfill?.setWindowMode) {
      return (window as any).obsPolyfill.setWindowMode;
    }
    
    return null;
  }, []);

  // Helper to get sendOBSCanvasStream from any available source
  const getSendOBSCanvasStream = useCallback(() => {
    // Try window.api first (real implementation)
    if (window.api?.sendOBSCanvasStream) {
      return window.api.sendOBSCanvasStream;
    }
    
    // Try polyfill
    if ((window as any).obsPolyfill?.sendOBSCanvasStream) {
      return (window as any).obsPolyfill.sendOBSCanvasStream;
    }
    
    return null;
  }, []);

  // Wrapper methods that automatically use the available API
  const obsAPI = {
    getSettings: useCallback(async () => {
      const api = getOBSAPI();
      return api?.getSettings?.() || null;
    }, [getOBSAPI]),

    updateSettings: useCallback(async (settings: any) => {
      const api = getOBSAPI();
      return api?.updateSettings?.(settings) || settings;
    }, [getOBSAPI]),

    startServer: useCallback(async () => {
      const api = getOBSAPI();
      return api?.startServer?.() || { success: false, error: 'No OBS API available' };
    }, [getOBSAPI]),

    stopServer: useCallback(async () => {
      const api = getOBSAPI();
      return api?.stopServer?.() || { success: true };
    }, [getOBSAPI]),

    getStatus: useCallback(async () => {
      const api = getOBSAPI();
      return api?.getStatus?.() || {
        serverRunning: false,
        serverUrl: null,
        browserSourceUrl: null,
        connectedClients: { totalClients: 0, obsClients: 0, browserClients: 0 }
      };
    }, [getOBSAPI]),

    openWindow: useCallback(async () => {
      const api = getOBSAPI();
      return api?.openWindow?.() || { success: false, error: 'No OBS API available' };
    }, [getOBSAPI]),

    closeWindow: useCallback(async () => {
      const api = getOBSAPI();
      return api?.closeWindow?.() || { success: true };
    }, [getOBSAPI]),

    getBrowserSourceUrl: useCallback(async (width?: number, height?: number, transparent?: boolean) => {
      const api = getOBSAPI();
      return api?.getBrowserSourceUrl?.(width, height, transparent) || 
        `http://localhost:8080/obs?width=${width || 800}&height=${height || 600}&transparent=${transparent !== false}`;
    }, [getOBSAPI])
  };

  const setWindowMode = useCallback(async (mode: 'window' | 'pet') => {
    const fn = getSetWindowMode();
    return fn?.(mode) || false;
  }, [getSetWindowMode]);

  const sendOBSCanvasStream = useCallback(async (stream: MediaStream) => {
    const fn = getSendOBSCanvasStream();
    return fn?.(stream) || false;
  }, [getSendOBSCanvasStream]);

  // Check availability
  const isAvailable = useCallback(() => {
    return {
      hasOBS: !!getOBSAPI(),
      hasSetWindowMode: !!getSetWindowMode(),
      hasSendStream: !!getSendOBSCanvasStream(),
      source: window.api?.obs ? 'real' : 'polyfill'
    };
  }, [getOBSAPI, getSetWindowMode, getSendOBSCanvasStream]);

  return {
    obs: obsAPI,
    setWindowMode,
    sendOBSCanvasStream,
    isAvailable,
    // Direct access to underlying APIs if needed
    getOBSAPI,
    getSetWindowMode,
    getSendOBSCanvasStream
  };
};