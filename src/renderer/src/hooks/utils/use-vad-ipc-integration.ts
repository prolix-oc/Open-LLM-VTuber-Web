// src/renderer/src/hooks/utils/use-vad-ipc-integration.ts
import { useEffect, useRef } from 'react';
import { useVAD } from '@/context/vad-context';

/**
 * Hook to integrate VAD context with IPC for remote control
 * This enables the HTTP /mictoggle endpoint to work with the VAD context
 */
export function useVADIPCIntegration() {
  const { micOn, micEnabled, toggleMicEnabled } = useVAD();
  const lastSentStateRef = useRef({ micOn: false, micEnabled: true });
  const ipcListenerRef = useRef<(() => void) | null>(null);

  // Send VAD state updates to main process when state changes
  useEffect(() => {
    const currentState = { micOn, micEnabled };
    
    // Only send if state actually changed
    if (
      lastSentStateRef.current.micOn !== currentState.micOn ||
      lastSentStateRef.current.micEnabled !== currentState.micEnabled
    ) {
      console.log('🔌 VAD IPC: Sending state update to main process:', currentState);
      
      // Send to main process for HTTP endpoint
      if ((window as any).vadAPI?.updateState) {
        (window as any).vadAPI.updateState(currentState);
      } else if ((window as any).api?.vadUpdateState) {
        (window as any).api.vadUpdateState(currentState);
      } else {
        console.warn('⚠️ VAD IPC: No VAD updateState methods available');
      }
      
      lastSentStateRef.current = currentState;
    }
  }, [micOn, micEnabled]);

  // Set up IPC listener for remote toggle requests
  useEffect(() => {
    console.log('🔌 VAD IPC: Setting up remote toggle listener...');
    
    // Remove existing listener if any
    if (ipcListenerRef.current) {
      ipcListenerRef.current();
      ipcListenerRef.current = null;
    }
    
    // Set up new listener
    const setupListener = () => {
      if ((window as any).vadAPI?.onMicToggle) {
        console.log('🔌 VAD IPC: Using vadAPI.onMicToggle');
        ipcListenerRef.current = (window as any).vadAPI.onMicToggle(() => {
          console.log('📡 VAD IPC: Remote toggle received via vadAPI');
          toggleMicEnabled();
        });
      } else if ((window as any).api?.onVADMicToggle) {
        console.log('🔌 VAD IPC: Using api.onVADMicToggle');
        ipcListenerRef.current = (window as any).api.onVADMicToggle(() => {
          console.log('📡 VAD IPC: Remote toggle received via api');
          toggleMicEnabled();
        });
      } else {
        console.warn('⚠️ VAD IPC: No IPC toggle methods available, retrying...');
        // Retry after a short delay
        setTimeout(setupListener, 1000);
        return;
      }
      
      console.log('✅ VAD IPC: Remote toggle listener setup complete');
    };
    
    // Initial setup
    setupListener();
    
    // Cleanup function
    return () => {
      console.log('🧹 VAD IPC: Cleaning up remote toggle listener');
      if (ipcListenerRef.current) {
        ipcListenerRef.current();
        ipcListenerRef.current = null;
      }
    };
  }, [toggleMicEnabled]);

  // Sync initial state on mount
  useEffect(() => {
    const syncInitialState = async () => {
      try {
        console.log('🔄 VAD IPC: Syncing initial state with main process...');
        
        // Get current state from main process
        let mainState = null;
        if ((window as any).vadAPI?.getState) {
          mainState = await (window as any).vadAPI.getState();
        } else if ((window as any).api?.vadGetState) {
          mainState = await (window as any).api.vadGetState();
        }
        
        if (mainState) {
          console.log('📥 VAD IPC: Received initial state from main:', mainState);
          // Note: We don't update local state based on main state
          // The main process should reflect the renderer state, not vice versa
        }
        
        // Send current renderer state to main
        const currentState = { micOn, micEnabled };
        console.log('📤 VAD IPC: Sending current renderer state to main:', currentState);
        
        if ((window as any).vadAPI?.updateState) {
          (window as any).vadAPI.updateState(currentState);
        } else if ((window as any).api?.vadUpdateState) {
          (window as any).api.vadUpdateState(currentState);
        }
        
        lastSentStateRef.current = currentState;
        
      } catch (error) {
        console.error('❌ VAD IPC: Failed to sync initial state:', error);
      }
    };
    
    // Delay initial sync to ensure IPC is ready
    const timer = setTimeout(syncInitialState, 500);
    
    return () => clearTimeout(timer);
  }, []); // Only run on mount

  // Debug exposure
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).vadIPCDebug = {
        micOn,
        micEnabled,
        lastSentState: lastSentStateRef.current,
        hasListener: !!ipcListenerRef.current,
        availableMethods: {
          vadAPI: !!(window as any).vadAPI,
          vadAPI_updateState: !!(window as any).vadAPI?.updateState,
          vadAPI_getState: !!(window as any).vadAPI?.getState,
          vadAPI_onMicToggle: !!(window as any).vadAPI?.onMicToggle,
          api_vadUpdateState: !!(window as any).api?.vadUpdateState,
          api_vadGetState: !!(window as any).api?.vadGetState,
          api_onVADMicToggle: !!(window as any).api?.onVADMicToggle,
        },
      };
    }
  });

  return {
    // Return current state for debugging
    micOn,
    micEnabled,
    isIPCConnected: !!ipcListenerRef.current,
    lastSentState: lastSentStateRef.current,
  };
}

// Simple component to integrate VAD with IPC - use this in your App component
export function VADIPCIntegration() {
  useVADIPCIntegration();
  return null; // This component doesn't render anything
}