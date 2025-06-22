import { useState, useCallback } from 'react';
import { useSendText } from '@/hooks/utils/use-send-text';
import { useAiState } from '@/context/ai-state-context';

export function useTextInput() {
  const [inputValue, setInputValue] = useState('');
  const { sendManualInput, getConnectionStatus } = useSendText();
  const { setAiState } = useAiState();

  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim()) return;

    const { canSend } = getConnectionStatus();
    if (!canSend) {
      console.warn('Cannot send message: not connected or authenticated');
      return;
    }

    try {
      setAiState('thinking-speaking'); // Set state to thinking while waiting for response
      const success = await sendManualInput(inputValue);
      
      if (success) {
        setInputValue(''); // Clear input on successful send
      } else {
        setAiState('idle'); // Reset state if send failed
      }
    } catch (error) {
      console.error('Error sending text input:', error);
      setAiState('idle');
    }
  }, [inputValue, sendManualInput, getConnectionStatus, setAiState]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return {
    inputValue,
    setInputValue,
    handleSubmit,
    handleKeyPress,
    canSend: getConnectionStatus().canSend,
  };
}
