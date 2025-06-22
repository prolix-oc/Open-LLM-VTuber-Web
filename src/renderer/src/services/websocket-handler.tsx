// src/renderer/src/services/websocket-handler.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { fixedWsService, WebSocketMessage } from "@/services/websocket-service";
import { useEnhancedWebSocket } from "@/context/websocket-context";
import { ModelInfo, useLive2DConfig } from "@/context/live2d-config-context";
import { useSubtitle } from "@/context/subtitle-context";
import { audioTaskQueue } from "@/utils/task-queue";
import { useLive2DModel } from "@/context/live2d-model-context";
import { useChatHistory } from "@/context/chat-history-context";
import { toaster } from "@/components/ui/toaster";
import { AiState, useAiState } from "@/context/ai-state-context";
import { useInterrupt } from "@/hooks/utils/use-interrupt";

// FIXED: Simplified handler that focuses only on message processing
function WebSocketHandler({ children }: { children: React.ReactNode }) {
  // FIXED: Get WebSocket state from context (guaranteed to be available)
  const {
    wsState,
    isAuthenticated,
    processAudioResponse,
    sendMessage: contextSendMessage,
  } = useEnhancedWebSocket();

  // Application state hooks
  const { aiState, setAiState } = useAiState();
  const { modelInfo } = useLive2DConfig();
  const { setSubtitleText } = useSubtitle();
  const { appendHumanMessage } = useChatHistory();
  const { currentModel } = useLive2DModel(); // Get Live2D model from context
  const { interrupt } = useInterrupt();

  // Current response tracking
  const [currentResponseId, setCurrentResponseId] = useState<string | null>(
    null
  );

  // FIXED: Message handling state to prevent duplicate processing
  const messageProcessingRef = useRef(new Set<string>());

  // Refs for stable values
  const modelInfoRef = useRef<ModelInfo | null>(null);
  const lastModelInfoSentRef = useRef<string>("");

  useEffect(() => {
    modelInfoRef.current = modelInfo;
  }, [modelInfo]);

  // FIXED: Enhanced audio task handler using Live2D's built-in speak() method
  const addAudioTask = useCallback(
    async (audioUrl: string, displayText?: any, actions?: any) => {
      console.log('Adding audio task:', { audioUrl, hasDisplayText: !!displayText, hasActions: !!actions });
      
      if (!currentModel) {
        console.warn('Live2D model not available for audio playback');
        return;
      }

      if (!currentModel.speak || typeof currentModel.speak !== 'function') {
        console.warn('Live2D model does not support speak() method');
        // Fallback to old system
        audioTaskQueue.addTask(async () => {
          console.log('Using fallback audio system');
          const audio = new Audio(audioUrl);
          audio.volume = 1.0;
          
          if (displayText?.text) {
            setSubtitleText(displayText.text);
          }
          
          audio.play().catch(console.error);
          
          return new Promise((resolve) => {
            audio.addEventListener('ended', () => {
              if (displayText?.text) {
                setTimeout(() => setSubtitleText(''), 2000);
              }
              setAiState('idle');
              resolve();
            });
            
            audio.addEventListener('error', () => {
              console.error('Audio playback failed');
              setAiState('idle');
              resolve();
            });
          });
        });
        return;
      }

      // Use Live2D's built-in speak() method
      audioTaskQueue.addTask(async () => {
        try {
          console.log('Using Live2D speak() method for:', audioUrl);
          
          const speakOptions: any = {
            volume: 1.0,
            crossOrigin: 'anonymous',
            
            // Handle expressions
            expression: actions?.expressions?.[0],
            resetExpression: true,
            
            // Success callback
            onFinish: () => {
              console.log('Live2D audio playback finished');
              if (displayText?.text) {
                setTimeout(() => setSubtitleText(''), 2000);
              }
              setAiState('idle');
            },
            
            // Error callback
            onError: (error: Error) => {
              console.error('Live2D audio playback error:', error);
              setAiState('idle');
              
              toaster.create({
                title: 'Audio Playback Error',
                description: `Failed to play audio: ${error.message}`,
                type: 'error',
                duration: 5000,
              });
            }
          };

          // Show subtitle
          if (displayText?.text) {
            setSubtitleText(displayText.text);
          }

          // Use Live2D's speak method - this handles audio loading and lip sync automatically
          const success = await currentModel.speak(audioUrl, speakOptions);
          
          if (!success) {
            throw new Error('Live2D speak() method returned false');
          }
          
          console.log('Live2D speak() method called successfully');
          
        } catch (error) {
          console.error('Failed to use Live2D speak() method:', error);
          
          // Fallback to basic audio playback
          console.log('Falling back to basic audio playback');
          const audio = new Audio(audioUrl);
          audio.volume = 1.0;
          
          audio.play().catch((playError) => {
            console.error('Fallback audio playback failed:', playError);
            setAiState('idle');
          });
          
          return new Promise((resolve) => {
            audio.addEventListener('ended', () => {
              if (displayText?.text) {
                setTimeout(() => setSubtitleText(''), 2000);
              }
              setAiState('idle');
              resolve();
            });
            
            audio.addEventListener('error', () => {
              console.error('Fallback audio playback failed');
              setAiState('idle');
              resolve();
            });
          });
        }
      });
    },
    [currentModel, setSubtitleText, setAiState]
  );

  // FIXED: Send text input to server with better error handling
  const sendTextInput = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        console.warn("Attempted to send empty text input");
        return;
      }

      // FIXED: Check connection state before sending
      if (wsState !== "OPEN") {
        console.warn("Cannot send text input - WebSocket not connected");
        toaster.create({
          title: "Connection required",
          description: "Please wait for connection to be established",
          type: "warning",
          duration: 3000,
        });
        return;
      }

      if (!isAuthenticated) {
        console.warn("Cannot send text input - not authenticated");
        toaster.create({
          title: "Authentication required",
          description: "Please check your API key in settings",
          type: "warning",
          duration: 3000,
        });
        return;
      }

      try {
        console.log("Sending text input to server:", text);

        // Add human message to chat history
        appendHumanMessage(text);

        // Set AI state to thinking
        setAiState("thinking-speaking");

        // Send to server via context
        await contextSendMessage(
          {
            type: "text-input",
            text: text.trim(),
          },
          "high"
        );

        console.log("Text input sent successfully");
      } catch (error) {
        console.error("Failed to send text input:", error);
        setAiState("idle"); // Reset AI state on error
        toaster.create({
          title: "Failed to send message",
          description: error instanceof Error ? error.message : "Unknown error",
          type: "error",
          duration: 3000,
        });
      }
    },
    [
      appendHumanMessage,
      contextSendMessage,
      wsState,
      isAuthenticated,
      setAiState,
    ]
  );

  // FIXED: Send model info with deduplication and proper timing
  const sendModelInfo = useCallback(async () => {
    if (!modelInfo || wsState !== "OPEN" || !isAuthenticated) {
      return;
    }

    // FIXED: Create a hash of model info to prevent duplicate sends
    const modelInfoHash = JSON.stringify({
      name: modelInfo.name,
      url: modelInfo.url,
      scale: modelInfo.kScale,
      width: modelInfo.width,
      height: modelInfo.height,
    });

    // Don't send if we already sent this exact model info
    if (lastModelInfoSentRef.current === modelInfoHash) {
      console.log("Model info unchanged, skipping send");
      return;
    }

    try {
      // Extract available expressions from the model
      // This assumes your Live2D model exposes available expressions
      const expressions = (window as any).live2d?.getExpressions?.() || [];

      await contextSendMessage(
        {
          type: "model-info",
          model_info: {
            name: modelInfo.name,
            url: modelInfo.url,
            expressions: expressions,
            scale: modelInfo.kScale,
            width: modelInfo.width,
            height: modelInfo.height,
          },
        },
        "normal"
      );

      // Update the hash to prevent duplicate sends
      lastModelInfoSentRef.current = modelInfoHash;

      console.log("Sent model info to server:", {
        name: modelInfo.name,
        expressionCount: expressions.length,
        expressions: expressions,
      });
    } catch (error) {
      console.error("Failed to send model info:", error);
    }
  }, [modelInfo, wsState, isAuthenticated, contextSendMessage]);

  // FIXED: Send model info when conditions are met
  useEffect(() => {
    // Only send if we have all required conditions
    if (modelInfo && wsState === "OPEN" && isAuthenticated) {
      // Small delay to ensure connection is fully established
      const timer = setTimeout(() => {
        sendModelInfo();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [modelInfo, wsState, isAuthenticated, sendModelInfo]);

  // FIXED: Handle base64 audio (legacy support)
  const handleLegacyAudio = useCallback(
    async (base64Audio: string, displayText?: any, responseId?: string) => {
      try {
        console.log('Processing legacy base64 audio:', { responseId, hasDisplayText: !!displayText });
        
        const cleanBase64 = base64Audio.replace(/^data:audio\/[^;]+;base64,/, '');
        const audioData = atob(cleanBase64);
        const audioArray = new Uint8Array(audioData.length);
        
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        
        const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        console.log('Created audio blob URL:', audioUrl);
        
        await addAudioTask(audioUrl, displayText);
        
        // Clean up blob URL after use
        setTimeout(() => {
          URL.revokeObjectURL(audioUrl);
        }, 120000);
        
      } catch (error) {
        console.error('Failed to process legacy base64 audio:', error);
        toaster.create({
          title: 'Audio Format Error',
          description: 'Failed to process audio data',
          type: 'error',
          duration: 5000,
        });
      }
    },
    [addAudioTask]
  );

  // FIXED: Enhanced message handler with deduplication and proper audio processing
  const handleWebSocketMessage = useCallback(
    async (message: WebSocketMessage) => {
      // FIXED: Prevent duplicate message processing
      const messageId = message.request_id || `${message.type}-${Date.now()}`;

      if (messageProcessingRef.current.has(messageId)) {
        console.log("Duplicate message detected, skipping:", messageId);
        return;
      }

      messageProcessingRef.current.add(messageId);

      // Clean up old message IDs after 30 seconds
      setTimeout(() => {
        messageProcessingRef.current.delete(messageId);
      }, 30000);

      console.log("Processing message from server:", {
        type: message.type,
        responseId: message.response_id,
        messageId: messageId,
      });

      try {
        switch (message.type) {
          case "response-queued":
            console.log("Response queued on server:", message.response_id);
            setCurrentResponseId(message.response_id || null);
            setAiState("thinking-speaking");
            // Clear any previous response content
            audioTaskQueue.clearQueue();
            break;

          case "synthesis-started":
            console.log("TTS synthesis started:", message.response_id);
            setAiState("thinking-speaking");
            break;

          case "synthesis-complete":
            console.log("TTS synthesis complete:", message.response_id);
            // Keep AI state as thinking-speaking until audio arrives
            break;

          case "audio-url":
            console.log("Received audio URL message:", {
              hasUrl: !!message.audio_url,
              format: message.audio_format,
              sampleRate: message.sample_rate,
              hasDisplayText: !!message.display_text,
              hasActions: !!message.actions,
            });

            // FIXED: Handle audio URL directly instead of trying to emit
            if (message.audio_url) {
              await addAudioTask(message.audio_url, message.display_text, message.actions);
            }
            break;

          case "audio":
            // Legacy base64 audio handling (fallback)
            console.log("Received legacy base64 audio message");
            if (message.audio) {
              await handleLegacyAudio(message.audio, message.display_text, message.response_id);
            }
            break;

          case "full-text":
            if (message.text) {
              console.log(
                "Received full text response:",
                message.text.substring(0, 50) + "..."
              );
              setSubtitleText(message.text);
            }
            break;

          case "interrupt":
            console.log("Server requested interruption");
            interrupt(false);
            audioTaskQueue.clearQueue();
            setAiState("idle");
            setCurrentResponseId(null);
            break;

          case "error":
            console.error("Server error:", message.message);
            toaster.create({
              title: "Server Error",
              description: message.message || "An error occurred on the server",
              type: "error",
              duration: 5000,
            });
            setAiState("idle");
            setCurrentResponseId(null);
            break;

          case "auth-success":
            console.log("Authentication successful (handled by context)");
            // Send model info after successful authentication
            setTimeout(() => {
              sendModelInfo();
            }, 1000);
            break;

          case "auth-failed":
            console.log("Authentication failed (handled by context)");
            break;

          case "auth-required":
            console.log("Authentication required (handled by context)");
            break;

          case "connection-established":
            console.log("Connection established with server");
            break;

          case "ping":
            // Respond to server ping (this is handled by the service)
            break;

          case "pong":
            // Server responded to our ping (handled by the service)
            break;

          case "model-info-received":
            console.log("Server confirmed model info received");
            break;

          default:
            console.warn("Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    },
    [
      aiState,
      addAudioTask,
      handleLegacyAudio,
      setAiState,
      setSubtitleText,
      interrupt,
      processAudioResponse,
      sendModelInfo,
    ]
  );

  // FIXED: Subscribe to messages only - no connection management
  useEffect(() => {
    console.log("WebSocketHandler: Subscribing to WebSocket messages...");

    const messageSubscription = fixedWsService
      .onMessage()
      .subscribe(handleWebSocketMessage);

    return () => {
      console.log("WebSocketHandler: Cleaning up message subscription");
      messageSubscription.unsubscribe();
    };
  }, [handleWebSocketMessage]);

  // FIXED: Expose sendTextInput function globally for easy access
  useEffect(() => {
    (window as any).sendTextInput = sendTextInput;

    return () => {
      delete (window as any).sendTextInput;
    };
  }, [sendTextInput]);

  // FIXED: Cleanup processing refs on unmount
  useEffect(() => {
    return () => {
      messageProcessingRef.current.clear();
    };
  }, []);

  // Log Live2D model status
  useEffect(() => {
    if (currentModel) {
      console.log('WebSocketHandler: Live2D model available:', {
        hasSpeak: typeof currentModel.speak === 'function',
        hasStopSpeaking: typeof currentModel.stopSpeaking === 'function',
        modelType: currentModel.constructor.name,
      });
    } else {
      console.log('WebSocketHandler: No Live2D model available');
    }
  }, [currentModel]);

  // FIXED: Just render children - no context provider here
  return <>{children}</>;
}

export default WebSocketHandler;