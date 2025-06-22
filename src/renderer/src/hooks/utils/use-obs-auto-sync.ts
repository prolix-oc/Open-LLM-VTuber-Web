// src/renderer/src/hooks/utils/use-obs-auto-sync.ts
import { useEffect, useRef } from 'react';
import { useSimpleOBS } from './use-simple-obs';

/**
 * Hook that automatically syncs Live2D model state to OBS
 * This hook should be added to a component that has access to model context
 * but doesn't require direct imports to avoid circular dependencies
 */
export const useOBSAutoSync = () => {
  const { syncModelToOBS, syncExpressionToOBS, syncMotionToOBS, syncAudioToOBS } = useSimpleOBS();
  const lastSyncTimeRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);

  // Set up global window functions for OBS sync that can be called from anywhere
  useEffect(() => {
    if (!isInitializedRef.current) {
      // Create global sync functions that other components can call
      (window as any).obsSync = {
        model: syncModelToOBS,
        expression: syncExpressionToOBS,
        motion: syncMotionToOBS,
        audio: syncAudioToOBS
      };

      isInitializedRef.current = true;
      console.log('🎥 OBS Auto-sync initialized');
    }

    return () => {
      // Cleanup on unmount
      if ((window as any).obsSync) {
        delete (window as any).obsSync;
      }
    };
  }, [syncModelToOBS, syncExpressionToOBS, syncMotionToOBS, syncAudioToOBS]);

  // Hook into window.live2d API changes if available
  useEffect(() => {
    const originalSetExpression = (window as any).live2d?.setExpression;
    const originalExpression = (window as any).live2d?.expression;
    const originalSetRandomExpression = (window as any).live2d?.setRandomExpression;

    if (originalSetExpression) {
      (window as any).live2d.setExpression = function(expression: string | number) {
        const result = originalSetExpression.call(this, expression);
        // Sync to OBS with throttling
        const now = Date.now();
        if (now - lastSyncTimeRef.current > 100) { // Throttle to 10fps
          syncExpressionToOBS(expression);
          lastSyncTimeRef.current = now;
        }
        return result;
      };
    }

    if (originalExpression) {
      (window as any).live2d.expression = function(expression: string | number) {
        const result = originalExpression.call(this, expression);
        // Sync to OBS with throttling
        const now = Date.now();
        if (now - lastSyncTimeRef.current > 100) { // Throttle to 10fps
          if (expression !== undefined) {
            syncExpressionToOBS(expression);
          }
          lastSyncTimeRef.current = now;
        }
        return result;
      };
    }

    if (originalSetRandomExpression) {
      (window as any).live2d.setRandomExpression = function() {
        const result = originalSetRandomExpression.call(this);
        // Note: We don't sync random expressions as we don't know which one was selected
        return result;
      };
    }

    return () => {
      // Restore original functions
      if ((window as any).live2d) {
        if (originalSetExpression) {
          (window as any).live2d.setExpression = originalSetExpression;
        }
        if (originalExpression) {
          (window as any).live2d.expression = originalExpression;
        }
        if (originalSetRandomExpression) {
          (window as any).live2d.setRandomExpression = originalSetRandomExpression;
        }
      }
    };
  }, [syncExpressionToOBS]);

  // Provide manual sync functions for other components to use
  return {
    syncModel: syncModelToOBS,
    syncExpression: syncExpressionToOBS,
    syncMotion: syncMotionToOBS,
    syncAudio: syncAudioToOBS,
    isInitialized: isInitializedRef.current
  };
};

/**
 * Helper function to manually trigger model sync from anywhere in the app
 * This can be called from components that have access to model info
 */
export const triggerOBSModelSync = (modelInfo: any) => {
  if ((window as any).obsSync?.model) {
    (window as any).obsSync.model(modelInfo);
  }
};

/**
 * Helper function to manually trigger expression sync from anywhere in the app
 */
export const triggerOBSExpressionSync = (expression: string | number) => {
  if ((window as any).obsSync?.expression) {
    (window as any).obsSync.expression(expression);
  }
};

/**
 * Helper function to manually trigger motion sync from anywhere in the app
 */
export const triggerOBSMotionSync = (group: string, index?: number, priority?: number) => {
  if ((window as any).obsSync?.motion) {
    (window as any).obsSync.motion(group, index, priority);
  }
};

/**
 * Helper function to manually trigger audio sync from anywhere in the app
 */
export const triggerOBSAudioSync = (volume: number, frequency?: number) => {
  if ((window as any).obsSync?.audio) {
    (window as any).obsSync.audio(volume, frequency);
  }
};