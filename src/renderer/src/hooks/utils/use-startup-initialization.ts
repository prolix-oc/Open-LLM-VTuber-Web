import { useEffect, useCallback, useState } from 'react';
import { useConfig } from '@/context/character-config-context';
import { useLive2DConfig } from '@/context/live2d-config-context';
import { useBgUrl } from '@/context/bgurl-context';
import { useWebSocket } from '@/context/websocket-context';

/**
 * Startup initialization phases
 */
enum InitializationPhase {
  NOT_STARTED = 'not_started',
  CHARACTER_CONFIGS_LOADING = 'character_configs_loading',
  CHARACTER_RESTORATION = 'character_restoration',
  MODEL_RESTORATION = 'model_restoration',
  BACKGROUND_RESTORATION = 'background_restoration',
  COMPLETE = 'complete',
}

/**
 * Simplified startup initialization hook that focuses on core app initialization
 * VAD auto-start is now handled entirely by VAD context itself
 */
export const useStartupInitialization = () => {
  const [initPhase, setInitPhase] = useState<InitializationPhase>(InitializationPhase.NOT_STARTED);
  const [hasCompletedInit, setHasCompletedInit] = useState(false);
  
  const { confName, confUid, configFiles, restoreCharacterSettings } = useConfig();
  const { restoreModelSettings, availableModels } = useLive2DConfig();
  const { restoreBackgroundSettings, managedBackgrounds } = useBgUrl();
  const { isConnected } = useWebSocket();

  /**
   * Phase 1: Wait for character config files to be loaded
   */
  useEffect(() => {
    if (initPhase === InitializationPhase.NOT_STARTED && configFiles.length > 0) {
      console.log('📁 Phase 1: Character config files loaded, starting restoration...');
      setInitPhase(InitializationPhase.CHARACTER_CONFIGS_LOADING);
    }
  }, [initPhase, configFiles.length]);

  /**
   * Phase 2: Restore character settings if they exist
   */
  useEffect(() => {
    if (initPhase === InitializationPhase.CHARACTER_CONFIGS_LOADING && isConnected) {
      console.log('🔗 Phase 2: WebSocket connected, restoring character settings...');
      setInitPhase(InitializationPhase.CHARACTER_RESTORATION);
      
      // Delay character restoration to ensure WebSocket is fully ready
      const timer = setTimeout(async () => {
        if (confName || confUid) {
          await restoreCharacterSettings();
          console.log('👤 Character settings restoration attempted');
        } else {
          console.log('👤 No character settings to restore');
        }
        setInitPhase(InitializationPhase.MODEL_RESTORATION);
      }, 1500); // Give WebSocket time to stabilize

      return () => clearTimeout(timer);
    }
  }, [initPhase, isConnected, confName, confUid, restoreCharacterSettings]);

  /**
   * Phase 3: Restore model settings
   */
  useEffect(() => {
    if (initPhase === InitializationPhase.MODEL_RESTORATION && availableModels.length >= 0) {
      console.log('🎭 Phase 3: Restoring model settings...');
      
      const timer = setTimeout(async () => {
        await restoreModelSettings();
        console.log('🎭 Model settings restoration attempted');
        setInitPhase(InitializationPhase.BACKGROUND_RESTORATION);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [initPhase, availableModels.length, restoreModelSettings]);

  /**
   * Phase 4: Restore background settings and complete initialization
   */
  useEffect(() => {
    if (initPhase === InitializationPhase.BACKGROUND_RESTORATION && managedBackgrounds.length >= 0) {
      console.log('🖼️ Phase 4: Restoring background settings...');
      
      const timer = setTimeout(async () => {
        await restoreBackgroundSettings();
        console.log('🖼️ Background settings restoration attempted');
        
        // Mark initialization as complete
        setInitPhase(InitializationPhase.COMPLETE);
        setHasCompletedInit(true);
        
        console.log('🎉 Core app initialization complete!');
        console.log('🎤 VAD auto-start is managed by VAD context independently');
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [initPhase, managedBackgrounds.length, restoreBackgroundSettings]);

  /**
   * Manual trigger for re-initialization (useful for debugging or forced refresh)
   */
  const reinitialize = useCallback(() => {
    console.log('🔄 Manually triggering re-initialization...');
    setInitPhase(InitializationPhase.NOT_STARTED);
    setHasCompletedInit(false);
  }, []);

  /**
   * Simplified initialization status
   */
  const getInitializationStatus = useCallback(() => {
    return {
      phase: initPhase,
      isComplete: hasCompletedInit,
      progress: {
        configsLoaded: configFiles.length > 0,
        websocketConnected: isConnected,
        characterRestored: initPhase >= InitializationPhase.MODEL_RESTORATION,
        modelRestored: initPhase >= InitializationPhase.BACKGROUND_RESTORATION,
        backgroundRestored: initPhase >= InitializationPhase.COMPLETE,
      },
    };
  }, [initPhase, hasCompletedInit, configFiles.length, isConnected]);

  return {
    initPhase,
    hasCompletedInit,
    reinitialize,
    getInitializationStatus,
  };
};