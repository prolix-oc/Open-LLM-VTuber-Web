import { useVAD } from '@/context/vad-context';
import { useAiState } from '@/context/ai-state-context';

export function useMicToggle() {
  const { setMicOn, micOn } = useVAD();
  const { aiState, setAiState } = useAiState();

  const handleMicToggle = async (): Promise<void> => {
    console.log('🎤 Mic toggle requested:', { currentState: micOn, newState: !micOn });
    
    if (micOn) {
      // Turning mic off
      console.log('🔇 Disabling always-listening speech detection');
      setMicOn(false);
      
      // If we're currently listening, return to idle
      if (aiState === 'listening') {
        setAiState('idle');
      }
    } else {
      // Turning mic on
      console.log('🔊 Enabling always-listening speech detection');
      setMicOn(true);
      // VAD context handles the actual startup - no need to manage state here
    }
  };

  return {
    handleMicToggle,
    micOn,
  };
}