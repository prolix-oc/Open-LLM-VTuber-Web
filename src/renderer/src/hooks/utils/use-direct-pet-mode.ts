// src/renderer/src/hooks/utils/use-direct-pet-mode.ts
import { useState, useCallback } from 'react';

/**
 * Direct pet mode testing hook that bypasses IPC and tests React mode switching
 * This helps us verify that the pet mode rendering works before dealing with window management
 */
export const useDirectPetMode = () => {
  const [testMode, setTestMode] = useState<'window' | 'pet'>('window');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = useCallback((info: string) => {
    setDebugInfo(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${info}`]);
    console.log(`🧪 Pet Mode Test: ${info}`);
  }, []);

  const triggerReactModeChange = useCallback((mode: 'window' | 'pet') => {
    addDebugInfo(`Attempting to trigger React mode change to: ${mode}`);
    
    try {
      // Method 1: Try to find and call the mode setter directly
      // This is hacky but good for testing
      const appElement = document.querySelector('[data-app-internal]');
      if (appElement) {
        addDebugInfo('Found app element, trying to trigger mode change...');
        
        // Dispatch a custom event that we can listen for in App.tsx
        const modeChangeEvent = new CustomEvent('direct-mode-change', { 
          detail: { mode, source: 'obs-test' } 
        });
        appElement.dispatchEvent(modeChangeEvent);
        addDebugInfo(`Dispatched direct-mode-change event with mode: ${mode}`);
      }

      // Method 2: Try to simulate the Electron IPC flow manually
      if (window.electron?.ipcRenderer) {
        addDebugInfo('Attempting to simulate Electron IPC flow...');
        
        // Instead of sending TO main process, let's simulate the events FROM main process
        setTimeout(() => {
          addDebugInfo('Simulating pre-mode-changed event from main process');
          // This should trigger the listener in App.tsx
          window.electron.ipcRenderer.emit('pre-mode-changed', null, mode);
          
          // Give React time to respond, then simulate the mode-changed event
          setTimeout(() => {
            addDebugInfo('Simulating mode-changed event from main process');
            window.electron.ipcRenderer.emit('mode-changed', null, mode);
          }, 200);
        }, 100);
      }

      // Method 3: DOM manipulation for immediate visual feedback
      if (mode === 'pet') {
        addDebugInfo('Applying pet mode CSS classes and DOM changes...');
        document.body.classList.add('pet-mode-test');
        document.body.style.overflow = 'hidden';
        
        // Try to hide header/footer elements
        const selectors = [
          '[data-testid="title-bar"]',
          '[data-testid="footer"]', 
          '.chakra-flex:has([data-testid="footer"])',
          'header',
          'footer'
        ];
        
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            (el as HTMLElement).style.display = 'none';
            addDebugInfo(`Hidden element: ${selector}`);
          });
        });
        
      } else {
        addDebugInfo('Restoring window mode CSS and DOM...');
        document.body.classList.remove('pet-mode-test');
        document.body.style.overflow = '';
        
        // Restore hidden elements
        const hiddenElements = document.querySelectorAll('[style*="display: none"]');
        hiddenElements.forEach(el => {
          (el as HTMLElement).style.display = '';
        });
        addDebugInfo('Restored hidden elements');
      }

      setTestMode(mode);
      addDebugInfo(`Test mode set to: ${mode}`);
      
    } catch (error) {
      addDebugInfo(`Error during mode change: ${error.message}`);
      console.error('Pet mode test error:', error);
    }
  }, [addDebugInfo]);

  const checkLive2DVisibility = useCallback(() => {
    const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
    const live2dContainer = document.querySelector('[data-live2d]') || canvas?.parentElement;
    
    const info = {
      canvasFound: !!canvas,
      canvasVisible: canvas ? canvas.offsetWidth > 0 && canvas.offsetHeight > 0 : false,
      canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'N/A',
      containerFound: !!live2dContainer,
      containerVisible: live2dContainer ? (live2dContainer as HTMLElement).offsetWidth > 0 : false,
      bodyClasses: Array.from(document.body.classList).join(', '),
      windowSize: `${window.innerWidth}x${window.innerHeight}`
    };
    
    addDebugInfo(`Live2D visibility check: ${JSON.stringify(info)}`);
    return info;
  }, [addDebugInfo]);

  const performFullTest = useCallback(async () => {
    addDebugInfo('=== Starting Full Pet Mode Test ===');
    
    // Initial state check
    addDebugInfo('Checking initial state...');
    checkLive2DVisibility();
    
    // Test pet mode
    addDebugInfo('Testing pet mode switch...');
    triggerReactModeChange('pet');
    
    // Wait and check
    setTimeout(() => {
      addDebugInfo('Checking pet mode state...');
      checkLive2DVisibility();
    }, 1000);
    
    // Test return to window mode
    setTimeout(() => {
      addDebugInfo('Testing return to window mode...');
      triggerReactModeChange('window');
      
      setTimeout(() => {
        addDebugInfo('Final state check...');
        checkLive2DVisibility();
        addDebugInfo('=== Pet Mode Test Complete ===');
      }, 1000);
    }, 3000);
    
  }, [addDebugInfo, triggerReactModeChange, checkLive2DVisibility]);

  return {
    testMode,
    debugInfo,
    triggerReactModeChange,
    checkLive2DVisibility,
    performFullTest,
    clearDebugInfo: () => setDebugInfo([])
  };
};