import { useCallback } from 'react';
import { useWebSocket } from '@/context/websocket-context';
import { useConfig } from '@/context/character-config-context';
import { useInterrupt } from '@/components/canvas/live2d';
import { useVAD } from '@/context/vad-context';
import { useSubtitle } from '@/context/subtitle-context';
import { useAiState } from '@/context/ai-state-context';
import { useLive2DConfig } from '@/context/live2d-config-context';

export function useSwitchCharacter() {
  const { sendMessage } = useWebSocket();
  const { confName, getFilenameByName } = useConfig();
  const { interrupt } = useInterrupt();
  const { stopMic, micOn } = useVAD(); // Track current mic state
  const { setSubtitleText } = useSubtitle();
  const { setAiState } = useAiState();
  const { setModelInfo } = useLive2DConfig();
  
  const switchCharacter = useCallback((fileName: string) => {
    const currentFilename = getFilenameByName(confName);

    if (currentFilename === fileName) {
      console.log('Skipping character switch - same configuration file');
      return;
    }

    // Remember if mic was on before switching
    const micWasOn = micOn;
    
    console.log('🔄 Switching character:', { fileName, micWasOn });

    setSubtitleText('New Character Loading...');
    interrupt();
    
    // Stop microphone during character switch for clean transition
    if (micWasOn) {
      console.log('🎤 Temporarily stopping mic during character switch');
      stopMic();
    }
    
    setAiState('loading');
    setModelInfo(undefined);
    
    sendMessage({
      type: 'switch-config',
      file: fileName,
    });
    
    // Note: User will need to manually re-enable microphone after character loads
    // This gives them control over when to start listening with the new character
    if (micWasOn) {
      console.log('💡 Microphone was disabled during character switch. User can re-enable via mic button.');
    }
    
    console.log('✅ Character switch initiated:', fileName);
  }, [confName, getFilenameByName, sendMessage, interrupt, stopMic, micOn, setSubtitleText, setAiState, setModelInfo]);

  return { switchCharacter };
}