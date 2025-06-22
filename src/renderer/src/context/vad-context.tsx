import {
  createContext, useContext, useRef, useCallback, useEffect, useReducer, useMemo,
} from 'react';
import { MicVAD } from '@ricky0123/vad-web';
import { audioTaskQueue } from '@/utils/task-queue';
import { useAiState } from '@/context/ai-state-context';
import { useSTT } from '@/context/stt-context';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { useWebSocket } from '@/context/websocket-context';
import { toaster } from '@/components/ui/toaster';

export interface VADSettings {
  positiveSpeechThreshold: number;
  negativeSpeechThreshold: number;
  redemptionFrames: number;
}

interface VADState {
  micOn: boolean;
  micEnabled: boolean; // New: separate processing toggle
  setMicOn: (value: boolean) => void;
  setMicEnabled: (value: boolean) => void;
  toggleMicEnabled: () => void; // New: for remote toggle
  startMic: () => Promise<void>;
  stopMic: () => void;
  previousTriggeredProbability: number;
  setPreviousTriggeredProbability: (value: number) => void;
  settings: VADSettings;
  updateSettings: (newSettings: VADSettings) => void;
  isTranscribing: boolean;
  transcriptionStatus: 'idle' | 'processing' | 'complete' | 'error';
  lastTranscription: string;
  autoStartOnInit: boolean;
  setAutoStartOnInit: (value: boolean) => void;
}

const DEFAULT_VAD_SETTINGS: VADSettings = {
  positiveSpeechThreshold: 50,
  negativeSpeechThreshold: 35,
  redemptionFrames: 35,
};

export const VADContext = createContext<VADState | null>(null);

export function VADProvider({ children }: { children: React.ReactNode }) {
  const vadRef = useRef<MicVAD | null>(null);
  const previousTriggeredProbabilityRef = useRef(0);
  const isProcessingRef = useRef(false);
  
  // Simple session management
  const activeSessionRef = useRef<{
    startTime: number;
    timeout: NodeJS.Timeout | null;
  } | null>(null);
  
  // Simple initialization tracking
  const initializationAttemptedRef = useRef(false);

  // SIMPLIFIED: Two separate states
  const [micOn, setMicOnState] = useLocalStorage('micOn', false); // VAD is running
  const [micEnabled, setMicEnabledState] = useLocalStorage('micEnabled', true); // Processing enabled
  const [settings, setSettings] = useLocalStorage<VADSettings>('vadSettings', DEFAULT_VAD_SETTINGS);
  const [autoStartOnInit, setAutoStartOnInitState] = useLocalStorage('autoStartOnInit', true);
  
  // Transcription state
  const [transcriptionStatus, setTranscriptionStatus] = useLocalStorage<'idle' | 'processing' | 'complete' | 'error'>('transcriptionStatus', 'idle');
  const [lastTranscription, setLastTranscription] = useLocalStorage('lastTranscription', '');

  // Force update mechanism
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // Context dependencies
  const { 
    sendMessage, 
    isAuthenticated, 
    wsState, 
    apiKey, 
    getConnectionInfo 
  } = useWebSocket();
  
  const { aiState, setAiState } = useAiState();
  const sttContext = useSTT();

  // Readiness check
  const isReadyForVAD = useCallback(() => {
    const connectionInfo = getConnectionInfo();
    const hasApiKey = !!(apiKey && apiKey.trim());
    const isConnected = wsState === 'OPEN';
    const isFullyAuthenticated = isAuthenticated && !connectionInfo.authenticationPending;
    const sttReady = sttContext.isInitialized;
    
    return hasApiKey && isConnected && isFullyAuthenticated && sttReady;
  }, [apiKey, wsState, isAuthenticated, getConnectionInfo, sttContext.isInitialized]);

  // Simple mic state setter (starts/stops VAD)
  const setMicOn = useCallback((value: boolean) => {
    console.log('🎤 Mic toggle (VAD):', { from: micOn, to: value });
    setMicOnState(value);
    
    if (value) {
      startMic();
    } else {
      stopMic();
    }
  }, [micOn, setMicOnState]);

  // NEW: Mic enabled setter (enables/disables processing)
  const setMicEnabled = useCallback((value: boolean) => {
    console.log('🎤 Mic enabled toggle (Processing):', { from: micEnabled, to: value });
    setMicEnabledState(value);
    
    // Show user feedback
    toaster.create({
      title: value ? '🎤 Mic Processing Enabled' : '🎤 Mic Processing Disabled',
      description: value 
        ? 'Speech detection will now process audio input' 
        : 'Speech detection is muted (VAD still running)',
      type: value ? 'success' : 'info',
      duration: 2000,
    });
  }, [micEnabled, setMicEnabledState]);

  // NEW: Toggle for remote control
  const toggleMicEnabled = useCallback(() => {
    setMicEnabled(!micEnabled);
  }, [micEnabled, setMicEnabled]);

  // Transcription sender
  const sendTranscriptionResult = useCallback(async (transcribedText: string): Promise<boolean> => {
    try {
      if (!transcribedText || !transcribedText.trim()) {
        console.warn('Empty transcription text, not sending');
        return false;
      }

      if (!isReadyForVAD()) {
        console.error('❌ Cannot send transcription - connection not ready');
        return false;
      }

      console.log('📤 Sending transcription to server:', transcribedText);
      
      await sendMessage({
        type: 'text-input',
        text: transcribedText.trim(),
      }, 'high');
      
      console.log('✅ Transcription sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to send transcription:', error);
      return false;
    }
  }, [sendMessage, isReadyForVAD]);

  // VAD creation function
  const createVAD = useCallback(async (): Promise<MicVAD> => {
    console.log('🔧 Creating VAD instance with settings:', settings);
    
    const newVAD = await MicVAD.new({
      model: "v5",
      preSpeechPadFrames: 20,
      positiveSpeechThreshold: settings.positiveSpeechThreshold / 100,
      negativeSpeechThreshold: settings.negativeSpeechThreshold / 100,
      redemptionFrames: settings.redemptionFrames,
      baseAssetPath: '/libs/',
      onnxWASMBasePath: '/libs/',
      
      onSpeechStart: () => {
        // SIMPLIFIED: Only process if enabled
        if (!micEnabled) {
          console.log('🔇 Speech detected but processing disabled');
          return;
        }

        console.log('🗣️ Speech detected and processing enabled');
        
        // Interrupt AI if currently speaking
        if (aiState === 'thinking-speaking') {
          console.log('Interrupting current AI response');
          setAiState('interrupted');
          audioTaskQueue.clearQueue();
        }
        
        // Create session with timeout
        activeSessionRef.current = {
          startTime: Date.now(),
          timeout: setTimeout(() => {
            console.log('⏰ Session timeout - forcing cleanup');
            if (activeSessionRef.current) {
              activeSessionRef.current = null;
              isProcessingRef.current = false;
              if (aiState === 'listening') {
                setAiState('idle');
              }
            }
          }, 30000), // 30 second max session
        };
        
        isProcessingRef.current = true;
        setAiState('listening');
        setTranscriptionStatus('idle');
      },
      
      onFrameProcessed: (probs: { isSpeech: number }) => {
        if (probs.isSpeech > previousTriggeredProbabilityRef.current) {
          previousTriggeredProbabilityRef.current = probs.isSpeech;
          forceUpdate();
        }
      },
      
      onSpeechEnd: async (audio: Float32Array) => {
        // SIMPLIFIED: Only process if enabled and we have an active session
        if (!micEnabled || !isProcessingRef.current || !activeSessionRef.current) {
          console.log('🔇 Speech ended but processing disabled or no session');
          return;
        }
        
        console.log('🔇 Speech ended - processing transcription');
        
        // Clean up session
        if (activeSessionRef.current.timeout) {
          clearTimeout(activeSessionRef.current.timeout);
        }
        
        const sessionDuration = Date.now() - activeSessionRef.current.startTime;
        console.log(`Speech session duration: ${sessionDuration}ms`);
        
        activeSessionRef.current = null;
        isProcessingRef.current = false;
        previousTriggeredProbabilityRef.current = 0;
        
        // Clear audio queue
        audioTaskQueue.clearQueue();

        // SIMPLIFIED: VAD keeps running, just process transcription
        console.log('🎤 VAD continues listening for next input');

        // Process transcription
        try {
          setTranscriptionStatus('processing');
          const transcribedText = await sttContext.transcribeAudio(audio);
          
          if (transcribedText && transcribedText.trim()) {
            setLastTranscription(transcribedText);
            setTranscriptionStatus('complete');
            
            const success = await sendTranscriptionResult(transcribedText);
            
            if (success) {
              console.log('✅ Transcription sent, waiting for AI response');
              setAiState('thinking-speaking');
            } else {
              console.error('❌ Failed to send transcription');
              setAiState('idle');
            }
          } else {
            console.log('No transcription result, returning to idle');
            setTranscriptionStatus('idle');
            setAiState('idle');
          }
        } catch (error) {
          console.error('❌ Failed to process speech:', error);
          setTranscriptionStatus('error');
          setAiState('idle');
          
          toaster.create({
            title: 'Transcription failed',
            description: error instanceof Error ? error.message : 'Unknown error',
            type: 'error',
            duration: 3000,
          });
        }
      },
      
      onVADMisfire: () => {
        console.log('🚫 VAD misfire detected - cleaning up session');
        
        if (activeSessionRef.current?.timeout) {
          clearTimeout(activeSessionRef.current.timeout);
        }
        
        activeSessionRef.current = null;
        isProcessingRef.current = false;
        previousTriggeredProbabilityRef.current = 0;

        if (aiState === 'interrupted' || aiState === 'listening') {
          setAiState('idle');
        }
        
        setTranscriptionStatus('idle');
        // VAD continues running - no need to restart
      },
    });

    return newVAD;
  }, [settings, micEnabled, aiState, setAiState, sttContext, sendTranscriptionResult]);

  // Start microphone function (creates VAD)
  const startMic = useCallback(async () => {
    try {
      console.log('🎤 Starting microphone...');
      
      if (!isReadyForVAD()) {
        const connectionInfo = getConnectionInfo();
        console.error('❌ Cannot start microphone - requirements not met:', {
          hasApiKey: !!(apiKey && apiKey.trim()),
          isConnected: wsState === 'OPEN',
          isAuthenticated,
          authenticationPending: connectionInfo.authenticationPending,
          sttInitialized: sttContext.isInitialized,
        });
        
        toaster.create({
          title: 'Cannot start microphone',
          description: 'Please ensure you are connected and authenticated.',
          type: 'error',
          duration: 4000,
        });
        return;
      }

      // If VAD already exists and is paused, just resume it
      if (vadRef.current) {
        console.log('▶️ Resuming existing VAD...');
        vadRef.current.start();
        console.log('✅ VAD resumed successfully');
        
        toaster.create({
          title: '🎤 VAD Resumed',
          description: micEnabled 
            ? 'Speech detection active and processing enabled'
            : 'Speech detection active but processing disabled',
          type: 'success',
          duration: 2000,
        });
        return;
      }

      // Create new VAD instance
      console.log('🔧 Creating new VAD instance...');
      const newVAD = await createVAD();
      vadRef.current = newVAD;
      
      newVAD.start();
      
      console.log('✅ VAD created and started successfully');
      
      toaster.create({
        title: '🎤 Always Listening Active',
        description: micEnabled 
          ? 'Speech detection running and processing enabled!'
          : 'Speech detection running but processing disabled',
        type: 'success',
        duration: 3000,
      });
      
    } catch (error) {
      console.error('❌ Failed to start VAD:', error);
      
      toaster.create({
        title: 'Failed to start microphone',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        type: 'error',
        duration: 5000,
      });
    }
  }, [isReadyForVAD, getConnectionInfo, apiKey, wsState, isAuthenticated, sttContext.isInitialized, createVAD, micEnabled]);

  // Stop microphone function (destroys VAD)
  const stopMic = useCallback(() => {
    console.log('🛑 Stopping VAD');
    
    // Clean up active session
    if (activeSessionRef.current?.timeout) {
      clearTimeout(activeSessionRef.current.timeout);
    }
    activeSessionRef.current = null;
    isProcessingRef.current = false;
    
    // Stop and destroy VAD
    if (vadRef.current) {
      vadRef.current.pause();
      vadRef.current.destroy();
      vadRef.current = null;
      console.log('VAD stopped and destroyed');
    }
    
    // Reset state
    previousTriggeredProbabilityRef.current = 0;
    setTranscriptionStatus('idle');
    
    toaster.create({
      title: '🎤 VAD Stopped',
      description: 'Speech detection completely stopped.',
      type: 'info',
      duration: 2000,
    });
  }, []);

  // Auto-start on initialization (simplified)
  useEffect(() => {
    if (!autoStartOnInit || initializationAttemptedRef.current) {
      return;
    }
    
    if (!isReadyForVAD()) {
      console.log('⏳ Auto-start conditions not yet met');
      return;
    }
    
    console.log('🚀 Attempting initial auto-start...');
    initializationAttemptedRef.current = true;
    
    const autoStartTimeout = setTimeout(async () => {
      if (!micOn && isReadyForVAD()) {
        try {
          setMicOnState(true); // This will trigger startMic via setMicOn
          console.log('✅ Initial auto-start successful');
        } catch (error) {
          console.error('❌ Initial auto-start failed:', error);
        }
      }
    }, 1500);
    
    return () => clearTimeout(autoStartTimeout);
  }, [isReadyForVAD, micOn, autoStartOnInit, setMicOnState]);

  // STT provider change handling
  useEffect(() => {
    if (vadRef.current && micOn && sttContext.hasSettingsChanged) {
      console.log('🔄 STT provider changed - restarting VAD');
      stopMic();
      setTimeout(() => {
        startMic();
      }, 500);
    }
  }, [sttContext.hasSettingsChanged, micOn, startMic, stopMic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeSessionRef.current?.timeout) {
        clearTimeout(activeSessionRef.current.timeout);
      }
      stopMic();
    };
  }, [stopMic]);

  // Settings update function
  const updateSettings = useCallback((newSettings: VADSettings) => {
    console.log('⚙️ Updating VAD settings:', newSettings);
    setSettings(newSettings);
    
    // Restart VAD if running with new settings
    if (vadRef.current && micOn) {
      stopMic();
      setTimeout(() => {
        startMic();
      }, 500);
    }
  }, [startMic, stopMic, setSettings, micOn]);

  // IMPORTANT: Expose VAD state to main process for HTTP endpoint
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Expose VAD debug info
      (window as any).vadDebug = {
        micOn,
        micEnabled,
        aiState,
        isReady: isReadyForVAD(),
        vadRef: vadRef.current,
        isProcessing: isProcessingRef.current,
        activeSession: activeSessionRef.current,
      };

      // IMPORTANT: Expose VAD state for IPC communication
      (window as any).vadState = {
        micOn,
        micEnabled,
        toggleMicEnabled,
        setMicEnabled,
      };

      // Register IPC listener for remote mic toggle
      if ((window as any).electronAPI?.onMicToggle) {
        (window as any).electronAPI.onMicToggle(() => {
          console.log('📡 Remote mic toggle requested');
          toggleMicEnabled();
        });
      }
    }
  }, [micOn, micEnabled, toggleMicEnabled, setMicEnabled, isReadyForVAD, aiState]);

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      micOn,
      micEnabled,
      setMicOn,
      setMicEnabled,
      toggleMicEnabled,
      startMic,
      stopMic,
      previousTriggeredProbability: previousTriggeredProbabilityRef.current,
      setPreviousTriggeredProbability: (value: number) => {
        previousTriggeredProbabilityRef.current = value;
        forceUpdate();
      },
      settings,
      updateSettings,
      autoStartOnInit,
      setAutoStartOnInit: setAutoStartOnInitState,
      isTranscribing: sttContext.isRecognizing,
      transcriptionStatus,
      lastTranscription,
    }),
    [
      micOn,
      micEnabled,
      setMicOn,
      setMicEnabled,
      toggleMicEnabled,
      startMic,
      stopMic,
      settings,
      updateSettings,
      autoStartOnInit,
      setAutoStartOnInitState,
      sttContext.isRecognizing,
      transcriptionStatus,
      lastTranscription,
    ],
  );

  return (
    <VADContext.Provider value={contextValue}>
      {children}
    </VADContext.Provider>
  );
}

export function useVAD() {
  const context = useContext(VADContext);

  if (!context) {
    throw new Error('useVAD must be used within a VADProvider');
  }

  return context;
}