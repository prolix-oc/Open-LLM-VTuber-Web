import { useAiState } from '@/context/ai-state-context';
import { useWebSocket } from '@/context/websocket-context';
import { useChatHistory } from '@/context/chat-history-context';
import { audioTaskQueue } from '@/utils/task-queue';
import { useLive2DModel } from '@/context/live2d-model-context';
import { useSubtitle } from '@/context/subtitle-context';

export const useInterrupt = () => {
  const { aiState, setAiState } = useAiState();
  const { sendMessage } = useWebSocket();
  const { messages, clearResponse } = useChatHistory();
  const { currentModel } = useLive2DModel();
  const { subtitleText, setSubtitleText } = useSubtitle();

  const interrupt = (sendSignal = true) => {
    if (aiState !== 'thinking-speaking') return;
    console.log('Interrupting conversation chain');
    
    if (sendSignal) {
      // Get the last AI message content if available
      const lastMessage = messages[messages.length - 1];
      const responseText = lastMessage && lastMessage.role === 'ai' ? lastMessage.content : '';
      
      sendMessage({
        type: 'interrupt-signal',
        text: responseText,
      });
    }
    
    setAiState('interrupted');
    audioTaskQueue.clearQueue();
    
    if (currentModel) {
      currentModel.stopSpeaking();
    } else {
      console.error('Live2D model is not initialized');
    }
    
    clearResponse();
    
    if (subtitleText === 'Thinking...') {
      setSubtitleText('');
    }
    
    console.log('Interrupted!');
  };

  return { interrupt };
};