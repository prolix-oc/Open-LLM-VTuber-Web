// src/renderer/src/hooks/utils/use-simple-obs-polyfill.ts
import { useEffect, useRef } from 'react';

/**
 * Simple, non-intrusive OBS polyfill that doesn't modify frozen objects
 * Creates a separate global namespace for OBS functionality
 */
export const useSimpleOBSPolyfill = () => {
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;

    console.log('🔌 Initializing simple OBS polyfill');

    // Create OBS polyfill in a separate global namespace
    (window as any).obsPolyfill = {
      obs: {
        getSettings: async () => {
          console.log('📄 OBS Polyfill: getSettings');
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
          console.log('💾 OBS Polyfill: updateSettings', settings);
          return settings;
        },

        startServer: async () => {
          console.log('🚀 OBS Polyfill: startServer');
          return { 
            success: false, 
            error: 'OBS backend not implemented - UI preview mode' 
          };
        },

        stopServer: async () => {
          console.log('🛑 OBS Polyfill: stopServer');
          return { success: true };
        },

        getStatus: async () => {
          console.log('📊 OBS Polyfill: getStatus');
          return {
            serverRunning: false,
            serverUrl: null,
            browserSourceUrl: 'http://localhost:8080/obs?width=800&height=600&transparent=true',
            connectedClients: { totalClients: 0, obsClients: 0, browserClients: 0 }
          };
        },

        openWindow: async () => {
          console.log('🪟 OBS Polyfill: openWindow');
          return { success: false, error: 'Requires backend implementation' };
        },

        closeWindow: async () => {
          console.log('🚪 OBS Polyfill: closeWindow');
          return { success: true };
        },

        getBrowserSourceUrl: async (width = 800, height = 600, transparent = true) => {
          console.log('🔗 OBS Polyfill: getBrowserSourceUrl', { width, height, transparent });
          return `http://localhost:8080/obs?width=${width}&height=${height}&transparent=${transparent}`;
        }
      },

      setWindowMode: async (mode: 'window' | 'pet') => {
        console.log(`🔄 OBS Polyfill: setWindowMode(${mode})`);
        
        // Method 1: Try direct App.tsx mode manipulation
        try {
          const modeChangeEvent = new CustomEvent('obs-mode-change', { 
            detail: { mode, timestamp: Date.now() } 
          });
          document.dispatchEvent(modeChangeEvent);
          console.log(`✅ Dispatched obs-mode-change event for ${mode}`);
        } catch (error) {
          console.warn('⚠️ Failed to dispatch mode change event:', error);
        }

        // Method 2: Try the Electron IPC flow (if available)
        if (window.electron?.ipcRenderer) {
          try {
            console.log(`📡 Attempting Electron IPC mode change to ${mode}`);
            
            // Simulate the proper IPC flow that App.tsx expects
            setTimeout(() => {
              // Trigger pre-mode-changed (this should start the flow)
              window.electron.ipcRenderer.emit('pre-mode-changed', {}, mode);
              
              // After a delay, trigger mode-changed
              setTimeout(() => {
                window.electron.ipcRenderer.emit('mode-changed', {}, mode);
              }, 200);
            }, 100);
            
            console.log(`✅ Triggered IPC flow for ${mode} mode`);
          } catch (error) {
            console.warn('⚠️ Electron IPC failed:', error);
          }
        }

        // Method 3: Direct DOM manipulation for immediate visual feedback
        if (mode === 'pet') {
          console.log('🐕 Applying pet mode styling...');
          document.body.classList.add('obs-pet-mode');
          
          // Try to hide UI elements that shouldn't be in pet mode
          const elementsToHide = [
            'header',
            'footer', 
            '[data-testid="title-bar"]',
            '[data-testid="footer"]',
            '.obs-floating-button' // Hide the OBS button itself in pet mode
          ];
          
          elementsToHide.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              (el as HTMLElement).style.display = 'none';
            });
          });
          
        } else {
          console.log('🪟 Restoring window mode styling...');
          document.body.classList.remove('obs-pet-mode');
          
          // Restore hidden elements
          const hiddenElements = document.querySelectorAll('[style*="display: none"]');
          hiddenElements.forEach(el => {
            (el as HTMLElement).style.display = '';
          });
        }
        
        return true;
      },

      sendOBSCanvasStream: async (stream: MediaStream) => {
        console.log('📺 OBS Polyfill: sendOBSCanvasStream', stream);
        return true;
      }
    };

    // Create helper function to get OBS API from either location
    (window as any).getOBSAPI = () => {
      return window.api?.obs || (window as any).obsPolyfill?.obs;
    };

    // Create helper function to get setWindowMode from either location
    (window as any).getSetWindowMode = () => {
      return window.api?.setWindowMode || (window as any).obsPolyfill?.setWindowMode;
    };

    // Add CSS for pet mode simulation
    const style = document.createElement('style');
    style.textContent = `
      .obs-pet-mode {
        overflow: hidden;
      }
      .obs-pet-mode [data-testid="title-bar"],
      .obs-pet-mode [data-testid="footer"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    isInitializedRef.current = true;
    console.log('✅ Simple OBS polyfill initialized at window.obsPolyfill');

    return () => {
      // Cleanup
      if ((window as any).obsPolyfill) {
        delete (window as any).obsPolyfill;
      }
      if ((window as any).getOBSAPI) {
        delete (window as any).getOBSAPI;
      }
      if ((window as any).getSetWindowMode) {
        delete (window as any).getSetWindowMode;
      }
    };
  }, []);

  return {
    hasAPI: !!((window as any).getOBSAPI?.() || window.api?.obs),
    hasSetWindowMode: !!((window as any).getSetWindowMode?.() || window.api?.setWindowMode),
    isReady: isInitializedRef.current
  };
};