import { useEffect } from 'react';
import { useConfig } from '@/context/character-config-context';
import { useLive2DConfig } from '@/context/live2d-config-context';
import { useBgUrl } from '@/context/bgurl-context';
import { useWebSocket } from '@/context/websocket-context';

/**
 * Debug hook to help troubleshoot startup issues
 * This can be temporarily added to App.tsx to debug restoration problems
 */
export const useDebugStartup = () => {
  const { confName, confUid, configFiles } = useConfig();
  const { selectedModelName, modelInfo, availableModels, forceModelRefresh } = useLive2DConfig();
  const { backgroundUrl, localBackgroundPath, selectedManagedBackground, managedBackgrounds } = useBgUrl();
  const { isConnected } = useWebSocket();

  // Debug character config state
  useEffect(() => {
    console.log('🔍 DEBUG - Character Config State:', {
      confName,
      confUid,
      configFilesCount: configFiles.length,
      configFiles: configFiles.map(f => f.name)
    });
  }, [confName, confUid, configFiles]);

  // Debug model state
  useEffect(() => {
    console.log('🔍 DEBUG - Model State:', {
      selectedModelName,
      modelInfoName: modelInfo?.name,
      modelInfoUrl: modelInfo?.url ? 'SET' : 'NOT SET',
      availableModelsCount: availableModels.length,
      availableModels: availableModels.map(m => m.name)
    });
  }, [selectedModelName, modelInfo, availableModels]);

  // Debug background state
  useEffect(() => {
    console.log('🔍 DEBUG - Background State:', {
      backgroundUrl: backgroundUrl ? (backgroundUrl.length > 50 ? backgroundUrl.substring(0, 50) + '...' : backgroundUrl) : 'NOT SET',
      localBackgroundPath,
      selectedManagedBackground,
      managedBackgroundsCount: managedBackgrounds.length,
      managedBackgrounds
    });
  }, [backgroundUrl, localBackgroundPath, selectedManagedBackground, managedBackgrounds]);

  // Debug WebSocket state
  useEffect(() => {
    console.log('🔍 DEBUG - WebSocket State:', {
      isConnected
    });
  }, [isConnected]);

  // Debug localStorage state
  useEffect(() => {
    console.log('🔍 DEBUG - LocalStorage State:', {
      selectedModelName: localStorage.getItem('selectedModelName'),
      confName: localStorage.getItem('confName'),
      confUid: localStorage.getItem('confUid'),
      backgroundUrl: localStorage.getItem('backgroundUrl'),
      localBackgroundPath: localStorage.getItem('localBackgroundPath'),
      selectedManagedBackground: localStorage.getItem('selectedManagedBackground'),
      useCameraBackground: localStorage.getItem('useCameraBackground'),
      scaleMemory: localStorage.getItem('scale_memory'),
    });
  }, []);

  // Add a global debug function for manual testing
  useEffect(() => {
    // @ts-ignore
    window.debugStartup = {
      forceModelRefresh,
      logCurrentState: () => {
        console.log('📊 Current Startup Debug State:', {
          character: { confName, confUid, configFilesCount: configFiles.length },
          model: { selectedModelName, hasModelInfo: !!modelInfo, availableModelsCount: availableModels.length },
          background: { backgroundUrl: backgroundUrl?.substring(0, 50) + '...', localBackgroundPath, selectedManagedBackground },
          websocket: { isConnected }
        });
      }
    };
    
    return () => {
      // @ts-ignore
      delete window.debugStartup;
    };
  }, [forceModelRefresh, confName, confUid, configFiles.length, selectedModelName, modelInfo, availableModels.length, backgroundUrl, localBackgroundPath, selectedManagedBackground, isConnected]);
};