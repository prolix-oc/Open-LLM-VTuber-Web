import { useCallback } from "react";
import { useEnhancedWebSocket } from "@/context/websocket-context";
import { useChatHistory } from "@/context/chat-history-context";
import { toaster } from "@/components/ui/toaster";

// Replaces use-send-audio.tsx since we no longer send audio data
export function useSendText() {
  const { sendMessage, isAuthenticated, wsState, apiKey, authToken, getConnectionInfo } = useEnhancedWebSocket();
  const { appendHumanMessage } = useChatHistory();

  // Use apiKey if available, fall back to authToken for backward compatibility
  const effectiveApiKey = apiKey || authToken || '';

  // Core text sending function
  const sendTextMessage = useCallback(
    async (text: string, options: { 
      addToHistory?: boolean; 
      showError?: boolean;
    } = {}) => {
      const { addToHistory = true, showError = true } = options;
      
      // Validate input
      if (!text || !text.trim()) {
        console.warn('Attempted to send empty text message');
        if (showError) {
          toaster.create({
            title: 'Cannot send empty message',
            type: 'warning',
            duration: 2000,
          });
        }
        return false;
      }

      // Check API key first
      if (!effectiveApiKey || !effectiveApiKey.trim()) {
        console.warn('Cannot send text: No API key configured');
        if (showError) {
          toaster.create({
            title: 'API key required',
            description: 'Please set your Enspira API key in settings',
            type: 'error',
            duration: 5000,
          });
        }
        return false;
      }

      // Check connection state
      if (wsState !== 'OPEN') {
        console.warn('Cannot send text: WebSocket not connected');
        if (showError) {
          toaster.create({
            title: 'Not connected to server',
            description: 'Please check your connection settings',
            type: 'error',
            duration: 3000,
          });
        }
        return false;
      }

      // FIXED: More strict authentication check
      if (!isAuthenticated) {
        console.warn('Cannot send text: Not authenticated with server');
        if (showError) {
          toaster.create({
            title: 'Authentication required',
            description: 'Please wait for authentication to complete',
            type: 'error',
            duration: 3000,
          });
        }
        return false;
      }

      try {
        const trimmedText = text.trim();
        
        console.log('Sending text message to server:', trimmedText);
        
        // Add to chat history if requested (optimistic update)
        if (addToHistory) {
          appendHumanMessage(trimmedText);
        }
        
        // Send to server via WebSocket using the corrected message format
        // The auth_token will be automatically included by the service
        await sendMessage({
          type: 'text-input',
          text: trimmedText,
        }, 'high'); // High priority for user input
        
        console.log('Text message sent successfully');
        return true;
        
      } catch (error) {
        console.error('Failed to send text message:', error);
        
        if (showError) {
          toaster.create({
            title: 'Failed to send message',
            description: error instanceof Error ? error.message : 'Unknown error',
            type: 'error',
            duration: 4000,
          });
        }
        
        return false;
      }
    },
    [sendMessage, isAuthenticated, wsState, effectiveApiKey, appendHumanMessage],
  );

  // Send transcription result from VAD/ASR
  const sendTranscriptionResult = useCallback(
    async (transcribedText: string) => {
      console.log('Sending transcription result:', transcribedText);
      
      return await sendTextMessage(transcribedText, {
        addToHistory: true, // Add user's spoken message to chat history
        showError: true,    // Show errors for transcription failures
      });
    },
    [sendTextMessage],
  );

  // Send manual text input (from text box)
  const sendManualInput = useCallback(
    async (inputText: string) => {
      console.log('Sending manual text input:', inputText);
      
      return await sendTextMessage(inputText, {
        addToHistory: true, // Add user's typed message to chat history
        showError: true,    // Show errors for manual input failures
      });
    },
    [sendTextMessage],
  );

  // Send system message (internal, not added to chat history)
  const sendSystemMessage = useCallback(
    async (systemText: string) => {
      console.log('Sending system message:', systemText);
      
      return await sendTextMessage(systemText, {
        addToHistory: false, // Don't add system messages to chat history
        showError: false,    // Don't show errors for system messages
      });
    },
    [sendTextMessage],
  );

  // FIXED: Enhanced ready-to-send check with full connection info
  const isReadyToSend = useCallback(() => {
    const connectionInfo = getConnectionInfo();
    
    console.debug('Connection readiness check:', {
      wsState,
      isAuthenticated,
      hasApiKey: !!(effectiveApiKey && effectiveApiKey.trim()),
      connectionState: connectionInfo.state,
      authenticationPending: connectionInfo.authenticationPending,
      connectionInProgress: connectionInfo.connectionInProgress,
    });
    
    // Must be fully connected, authenticated, and have API key
    return (
      wsState === 'OPEN' && 
      isAuthenticated && 
      !!(effectiveApiKey && effectiveApiKey.trim()) &&
      !connectionInfo.connectionInProgress &&
      !connectionInfo.authenticationPending
    );
  }, [wsState, isAuthenticated, effectiveApiKey, getConnectionInfo]);

  // FIXED: Enhanced connection status with detailed server-side state
  const getConnectionStatus = useCallback(() => {
    const connectionInfo = getConnectionInfo();
    const connected = wsState === 'OPEN';
    const hasApiKey = !!(effectiveApiKey && effectiveApiKey.trim());
    const authenticated = isAuthenticated && !connectionInfo.authenticationPending;
    const readyToSend = isReadyToSend();
    
    const statusMessage = (() => {
      if (!hasApiKey) {
        return 'API key required';
      }
      if (!connected || connectionInfo.connectionInProgress) {
        return 'Connecting to server...';
      }
      if (connectionInfo.authenticationPending) {
        return 'Authenticating...';
      }
      if (!authenticated) {
        return 'Authentication failed';
      }
      if (!readyToSend) {
        return 'Connection not ready';
      }
      return 'Ready to send';
    })();

    const detailedStatus = {
      connected,
      authenticated,
      hasApiKey,
      canSend: readyToSend,
      statusMessage,
      // Additional debugging info
      debug: {
        wsState,
        isAuthenticated,
        apiKeyLength: effectiveApiKey?.length || 0,
        connectionState: connectionInfo.state,
        authenticationPending: connectionInfo.authenticationPending,
        connectionInProgress: connectionInfo.connectionInProgress,
        serverClientId: connectionInfo.serverClientId,
        serverUserId: connectionInfo.serverUserId,
      }
    };

    console.debug('Detailed connection status:', detailedStatus);
    return detailedStatus;
  }, [wsState, isAuthenticated, effectiveApiKey, isReadyToSend, getConnectionInfo]);

  // FIXED: Wait for authentication helper function
  const waitForAuthentication = useCallback(async (timeoutMs: number = 10000): Promise<boolean> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const connectionInfo = getConnectionInfo();
      
      if (isAuthenticated && !connectionInfo.authenticationPending) {
        console.log('Authentication completed successfully');
        return true;
      }
      
      if (wsState !== 'OPEN') {
        console.warn('Connection lost while waiting for authentication');
        return false;
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.warn('Authentication timeout after', timeoutMs, 'ms');
    return false;
  }, [isAuthenticated, wsState, getConnectionInfo]);

  return {
    sendTextMessage,        // Generic text sending function
    sendTranscriptionResult, // For VAD/ASR results
    sendManualInput,        // For text box input
    sendSystemMessage,      // For internal system messages
    getConnectionStatus,    // Check if we can send messages with detailed info
    isReadyToSend,         // Simple boolean check
    waitForAuthentication, // Wait for auth to complete
  };
}

// Backward compatibility export
export const useSendAudio = useSendText;