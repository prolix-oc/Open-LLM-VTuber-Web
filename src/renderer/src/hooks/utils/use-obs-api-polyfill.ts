// src/renderer/src/hooks/utils/use-obs-api-polyfill.ts
import { useEffect } from 'react';

/**
 * Frontend-only OBS API implementation that works without backend changes
 * This provides the necessary API surface for the OBS components to function
 * while gracefully handling the absence of a real backend
 */
export const useOBSAPIPolyfill = () => {
  useEffect(() => {
    // Check if we need to add polyfill
    const needsPolyfill = !window.api?.obs;
    
    if (needsPolyfill) {
      console.log('🔌 Adding OBS API polyfill');

      // Create the OBS API polyfill object
      const obsAPI = {
        // Settings management (mock implementation)
        getSettings: async () => {
          console.log('📄 OBS API Polyfill: getSettings called');
          return {
            enabled: false,
            port: 8080,
            enableBrowserSource: true,
            enableWindowCapture: true,
            windowWidth: 800,
            windowHeight: 600,
            transparentBackground: true,
            autoStart: false
          };
        },

        updateSettings: async (settings: any) => {
          console.log('💾 OBS API Polyfill: updateSettings called with:', settings);
          return settings; // Just return the same settings
        },

        // Server control (mock implementation)
        startServer: async () => {
          console.log('🚀 OBS API Polyfill: startServer called');
          return { 
            success: false, 
            error: 'OBS backend not implemented yet - this is UI preview mode' 
          };
        },

        stopServer: async () => {
          console.log('🛑 OBS API Polyfill: stopServer called');
          return { success: true };
        },

        getStatus: async () => {
          console.log('📊 OBS API Polyfill: getStatus called');
          return {
            serverRunning: false,
            serverUrl: null,
            browserSourceUrl: 'http://localhost:8080/obs?width=800&height=600&transparent=true',
            connectedClients: { totalClients: 0, obsClients: 0, browserClients: 0 }
          };
        },

        // Window control (mock implementation)
        openWindow: async () => {
          console.log('🪟 OBS API Polyfill: openWindow called');
          return { success: false, error: 'Window control requires backend implementation' };
        },

        closeWindow: async () => {
          console.log('🚪 OBS API Polyfill: closeWindow called');
          return { success: true };
        },

        // URL generation (mock implementation)
        getBrowserSourceUrl: async (width = 800, height = 600, transparent = true) => {
          console.log('🔗 OBS API Polyfill: getBrowserSourceUrl called with:', { width, height, transparent });
          return `http://localhost:8080/obs?width=${width}&height=${height}&transparent=${transparent}`;
        }
      };

      // Create mode switching polyfill
      const setWindowModePolyfill = async (mode: 'window' | 'pet') => {
        console.log(`🔄 OBS API Polyfill: setWindowMode called with: ${mode}`);
        
        // Use existing Electron IPC if available
        if (window.electron?.ipcRenderer) {
          try {
            // Try to trigger the existing mode change system
            window.electron.ipcRenderer.send('request-mode-change', mode);
            return true;
          } catch (error) {
            console.warn('⚠️ Could not trigger mode change via Electron IPC:', error);
          }
        }

        // Fallback: simulate mode change for UI testing
        console.log(`📱 Simulating ${mode} mode for UI testing`);
        if (mode === 'pet') {
          // Hide UI elements to simulate pet mode
          document.body.style.overflow = 'hidden';
          const titleBar = document.querySelector('[data-testid="title-bar"]') as HTMLElement;
          const footer = document.querySelector('[data-testid="footer"]') as HTMLElement;
          if (titleBar) titleBar.style.display = 'none';
          if (footer) footer.style.display = 'none';
        } else {
          // Restore UI elements
          document.body.style.overflow = '';
          const titleBar = document.querySelector('[data-testid="title-bar"]') as HTMLElement;
          const footer = document.querySelector('[data-testid="footer"]') as HTMLElement;
          if (titleBar) titleBar.style.display = '';
          if (footer) footer.style.display = '';
        }
        
        return true;
      };

      // Create canvas stream polyfill
      const sendOBSCanvasStreamPolyfill = async (stream: MediaStream) => {
        console.log('📺 OBS API Polyfill: sendOBSCanvasStream called with stream:', stream);
        // In a real implementation, this would send the stream to the backend
        // For now, just log it
        console.log('📺 Stream tracks:', stream.getTracks().map(track => ({
          kind: track.kind,
          label: track.label,
          enabled: track.enabled
        })));
        return true;
      };

      // Try to extend window.api safely without modifying the original object
      try {
        if (window.api) {
          // Create a new polyfilled API object that includes existing API
          const polyfillAPI = {
            ...window.api,
            obs: obsAPI,
            setWindowMode: window.api.setWindowMode || setWindowModePolyfill,
            sendOBSCanvasStream: sendOBSCanvasStreamPolyfill
          };
          
          // Replace window.api with the polyfilled version
          Object.defineProperty(window, 'api', {
            value: polyfillAPI,
            writable: true,
            configurable: true
          });
          
          console.log('✅ OBS API polyfill applied successfully using object replacement');
        } else {
          // window.api doesn't exist, create it from scratch
          (window as any).api = {
            obs: obsAPI,
            setWindowMode: setWindowModePolyfill,
            sendOBSCanvasStream: sendOBSCanvasStreamPolyfill
          };
          
          console.log('✅ OBS API polyfill created new window.api');
        }
      } catch (error) {
        console.error('❌ Failed to apply OBS API polyfill:', error);
        
        // Fallback: Use a separate global namespace
        (window as any).obsPolyfill = {
          obs: obsAPI,
          setWindowMode: setWindowModePolyfill,
          sendOBSCanvasStream: sendOBSCanvasStreamPolyfill
        };
        
        console.log('⚠️ Using fallback polyfill at window.obsPolyfill');
      }
    }


    // Cleanup function
    return () => {
      // Remove polyfill if we added it
      console.log('🧹 OBS API polyfill cleanup (polyfill remains for stability)');
      // Note: We don't actually remove the polyfill to avoid breaking other components
      // The polyfill is designed to be safe to keep around
    };
  }, []);

  // Return current API availability
  return {
    hasAPI: !!window.api,
    hasOBSAPI: !!(window.api?.obs || (window as any).obsPolyfill?.obs),
    hasModeSwitch: !!(window.api?.setWindowMode || (window as any).obsPolyfill?.setWindowMode),
    isPolyfill: true // This hook always provides polyfill
  };
};