// src/renderer/src/hooks/utils/use-simple-obs.ts
import { useEffect, useRef } from 'react';

/**
 * Simple hook for OBS integration that just handles model synchronization
 * This avoids complex imports and focuses on core functionality
 */
export const useSimpleOBS = () => {
  const lastSyncedModelRef = useRef<string | null>(null);

  /**
   * Sync model information to OBS clients
   */
  const syncModelToOBS = async (modelInfo: any) => {
    if (!modelInfo?.url || !window.api?.obsSyncModel) return;

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
  };

  /**
   * Sync expression to OBS clients
   */
  const syncExpressionToOBS = async (expression: string | number) => {
    try {
      if (window.api?.obsSyncExpression) {
        await window.api.obsSyncExpression(expression);
        console.log('😊 Synced expression to OBS clients:', expression);
      }
    } catch (error) {
      console.error('Failed to sync expression to OBS:', error);
    }
  };

  /**
   * Sync motion to OBS clients
   */
  const syncMotionToOBS = async (group: string, index?: number, priority?: number) => {
    try {
      if (window.api?.obsSyncMotion) {
        await window.api.obsSyncMotion(group, index, priority);
        console.log('🎭 Synced motion to OBS clients:', { group, index, priority });
      }
    } catch (error) {
      console.error('Failed to sync motion to OBS:', error);
    }
  };

  /**
   * Sync audio data for lip sync to OBS clients
   */
  const syncAudioToOBS = async (volume: number, frequency?: number) => {
    try {
      if (window.api?.obsSyncAudio) {
        await window.api.obsSyncAudio(volume, frequency);
      }
    } catch (error) {
      console.error('Failed to sync audio to OBS:', error);
    }
  };

  return {
    syncModelToOBS,
    syncExpressionToOBS,
    syncMotionToOBS,
    syncAudioToOBS
  };
};