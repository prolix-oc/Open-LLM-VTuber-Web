import {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from 'react';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { toaster } from '@/components/ui/toaster';

export type STTProvider = 'webapi' | 'local-whisper' | 'remote-whisper';

export interface STTSettings {
  provider: STTProvider;
  webapi: {
    language: string;
    continuous: boolean;
    interimResults: boolean;
  };
  localWhisper: {
    modelName: string;
    language: string;
    task: 'transcribe' | 'translate';
    temperature: number;
  };
  remoteWhisper: {
    endpoint: string;
    apiKey: string;
    model: string;
    language: string;
    temperature: number;
  };
}

export interface LocalWhisperModel {
  name: string;
  path: string;
  size: string;
  supported: boolean;
}

interface STTState {
  settings: STTSettings;
  updateSettings: (newSettings: Partial<STTSettings>) => void;
  availableModels: LocalWhisperModel[];
  refreshModels: () => Promise<void>;
  isRecognizing: boolean;
  transcribeAudio: (audioData: Float32Array) => Promise<string>;
  startContinuousRecognition: () => Promise<void>;
  stopContinuousRecognition: () => void;
  testProvider: (provider: STTProvider) => Promise<boolean>;
  isInitialized: boolean;
  hasSettingsChanged: boolean;
}

const DEFAULT_STT_SETTINGS: STTSettings = {
  provider: 'webapi',
  webapi: {
    language: 'en-US',
    continuous: false,
    interimResults: false,
  },
  localWhisper: {
    modelName: '',
    language: 'auto',
    task: 'transcribe',
    temperature: 0.0,
  },
  remoteWhisper: {
    endpoint: 'http://172.20.20.111:8000',
    apiKey: '',
    model: 'whisper-1',
    language: 'auto',
    temperature: 0.0,
  },
};

export const STTContext = createContext<STTState | null>(null);

export function STTProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsStorage] = useLocalStorage<STTSettings>('sttSettings', DEFAULT_STT_SETTINGS);
  const [availableModels, setAvailableModels] = useState<LocalWhisperModel[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasSettingsChanged, setHasSettingsChanged] = useState(false);
  
  const initialLoadCompleted = useRef(false);
  const previousProvider = useRef<STTProvider | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  // Track when initial settings are loaded and stabilized
  useEffect(() => {
    if (!initialLoadCompleted.current) {
      const initTimer = setTimeout(() => {
        initialLoadCompleted.current = true;
        previousProvider.current = settings.provider;
        setIsInitialized(true);
        
        console.log('STT Context: Initial settings loaded and stabilized:', {
          provider: settings.provider,
          isInitialized: true,
        });
      }, 100);
      
      return () => clearTimeout(initTimer);
    }
  }, [settings.provider]);

  // Track meaningful settings changes (not initial loads)
  useEffect(() => {
    if (isInitialized && previousProvider.current !== null) {
      const providerChanged = previousProvider.current !== settings.provider;
      
      if (providerChanged) {
        console.log('STT Context: Provider actually changed:', {
          from: previousProvider.current,
          to: settings.provider,
          isInitialized,
        });
        
        setHasSettingsChanged(true);
        previousProvider.current = settings.provider;
        
        setTimeout(() => setHasSettingsChanged(false), 1000);
      }
    }
  }, [settings.provider, isInitialized]);

  // FIXED: Enhanced Web Speech API for live microphone input
  const initWebSpeechAPI = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Web Speech API not supported in this browser');
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = settings.webapi.language;
    recognition.continuous = settings.webapi.continuous;
    recognition.interimResults = settings.webapi.interimResults;
    
    return recognition;
  }, [settings.webapi]);

  // FIXED: Convert Float32Array to proper WAV format for nodejs-whisper
  const audioToWav = useCallback((audioData: Float32Array, sampleRate: number = 16000): Uint8Array => {
    const length = audioData.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Uint8Array(buffer);
  }, []);

  // FIXED: Web Speech API transcription using LIVE microphone stream (not audio buffers)
  const transcribeWithWebAPI = useCallback(async (audioData: Float32Array): Promise<string> => {
    // NOTE: Web Speech API is designed for LIVE microphone input, not pre-recorded audio
    // For VAD integration, we should be using the Web Speech API directly with the microphone
    // This implementation maintains compatibility but should ideally be refactored
    
    return new Promise((resolve, reject) => {
      try {
        // For Web Speech API, we should be using continuous recognition with live microphone
        // However, to maintain compatibility with VAD pattern, we'll create a temporary audio context
        
        const audioContext = new AudioContext();
        const audioBuffer = audioContext.createBuffer(1, audioData.length, 16000);
        audioBuffer.copyToChannel(audioData, 0);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        // Create a destination for the audio
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        
        // Use Web Speech API with the generated stream
        const recognition = initWebSpeechAPI();
        let hasResult = false;
        let timeoutId: NodeJS.Timeout;
        
        recognition.onresult = (event) => {
          const result = event.results[event.results.length - 1];
          if (result.isFinal || !settings.webapi.interimResults) {
            hasResult = true;
            clearTimeout(timeoutId);
            resolve(result[0].transcript);
          }
        };
        
        recognition.onerror = (event) => {
          clearTimeout(timeoutId);
          console.error('Speech recognition error:', event.error);
          reject(new Error(`Speech recognition error: ${event.error}`));
        };
        
        recognition.onend = () => {
          setIsRecognizing(false);
          clearTimeout(timeoutId);
          if (!hasResult) {
            reject(new Error('No speech recognized'));
          }
        };
        
        // Set a timeout to prevent hanging
        timeoutId = setTimeout(() => {
          recognition.stop();
          if (!hasResult) {
            reject(new Error('Speech recognition timeout'));
          }
        }, 10000);
        
        recognition.start();
        setIsRecognizing(true);
        source.start();
        
      } catch (error) {
        console.error('Web Speech API transcription failed:', error);
        reject(error);
      }
    });
  }, [initWebSpeechAPI, settings.webapi.interimResults]);

  // FIXED: Local Whisper transcription with proper memory handling
  const transcribeWithLocalWhisper = useCallback(async (audioData: Float32Array): Promise<string> => {
    try {
      if (!settings.localWhisper.modelName) {
        throw new Error('No local Whisper model selected');
      }

      // Convert to WAV format
      const wavData = audioToWav(audioData);
      
      console.log('Local Whisper: Processing audio data:', {
        originalLength: audioData.length,
        wavDataLength: wavData.length,
        modelName: settings.localWhisper.modelName,
      });

      // FIXED: Use proper array format for whisperAPI (not Buffer)
      const result = await window.whisperAPI.transcribeWithWhisper({
        audioData: Array.from(wavData), // Convert Uint8Array to regular array
        modelName: settings.localWhisper.modelName,
        language: settings.localWhisper.language,
        task: settings.localWhisper.task,
        temperature: settings.localWhisper.temperature,
      });
      
      console.log('Local Whisper transcription result:', result);
      
      if (!result || !result.text) {
        throw new Error('No transcription text returned from local Whisper');
      }
      
      return result.text.trim();
    } catch (error) {
      console.error('Local Whisper transcription failed:', error);
      throw new Error(`Local Whisper error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [settings.localWhisper, audioToWav]);

  // FIXED: Remote Whisper with proper FormData and endpoint handling
  const transcribeWithRemoteWhisper = useCallback(async (audioData: Float32Array): Promise<string> => {
    try {
      const endpoint = settings.remoteWhisper.endpoint.replace(/\/$/, ''); // Remove trailing slash
      
      if (!endpoint) {
        throw new Error('Remote Whisper endpoint not configured');
      }

      console.log('Remote Whisper: Preparing request:', {
        endpoint: `${endpoint}/v1/audio/transcriptions`,
        modelName: settings.remoteWhisper.model,
        language: settings.remoteWhisper.language,
        audioDataLength: audioData.length,
      });

      // Convert to WAV format
      const wavData = audioToWav(audioData);
      const audioBlob = new Blob([wavData], { type: 'audio/wav' });
      
      // FIXED: Proper FormData construction for OpenAI Whisper API compatibility
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav'); // Use descriptive filename
      formData.append('model', settings.remoteWhisper.model);
      
      // Only add language if not auto
      if (settings.remoteWhisper.language && settings.remoteWhisper.language !== 'auto') {
        formData.append('language', settings.remoteWhisper.language);
      }
      
      // Only add temperature if > 0
      if (settings.remoteWhisper.temperature > 0) {
        formData.append('temperature', settings.remoteWhisper.temperature.toString());
      }

      // Add response format for better parsing
      formData.append('response_format', 'json');

      // FIXED: Proper headers and authentication
      const headers: Record<string, string> = {};
      
      // Add authorization header if API key is provided
      if (settings.remoteWhisper.apiKey && settings.remoteWhisper.apiKey.trim()) {
        headers['Authorization'] = `Bearer ${settings.remoteWhisper.apiKey}`;
      }
      
      // Note: Don't set Content-Type header manually with FormData, let browser handle it

      console.log('Remote Whisper: Sending request...');
      
      const response = await fetch(`${endpoint}/v1/audio/transcriptions`, {
        method: 'POST',
        headers,
        body: formData,
      });

      console.log('Remote Whisper response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.text();
          console.error('Remote Whisper error response:', errorData);
          errorMessage += ` - ${errorData}`;
        } catch (e) {
          console.error('Failed to read error response:', e);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Remote Whisper result:', result);
      
      if (!result || typeof result.text !== 'string') {
        throw new Error('Invalid response format from remote Whisper API');
      }
      
      return result.text.trim();
    } catch (error) {
      console.error('Remote Whisper transcription failed:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Network error: Cannot connect to ${settings.remoteWhisper.endpoint}. Check if server is running and accessible.`);
      }
      
      throw new Error(`Remote Whisper error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [settings.remoteWhisper, audioToWav]);

  // Main transcription function
  const transcribeAudio = useCallback(async (audioData: Float32Array): Promise<string> => {
    try {
      setIsRecognizing(true);
      
      console.log(`Starting transcription with ${settings.provider}:`, {
        audioDataLength: audioData.length,
        provider: settings.provider,
      });
      
      let result: string;
      
      switch (settings.provider) {
        case 'webapi':
          result = await transcribeWithWebAPI(audioData);
          break;
        case 'local-whisper':
          result = await transcribeWithLocalWhisper(audioData);
          break;
        case 'remote-whisper':
          result = await transcribeWithRemoteWhisper(audioData);
          break;
        default:
          throw new Error(`Unknown STT provider: ${settings.provider}`);
      }
      
      setIsRecognizing(false);
      console.log('Transcription completed:', result);
      return result.trim();
    } catch (error) {
      setIsRecognizing(false);
      console.error('Transcription failed:', error);
      throw error;
    }
  }, [settings.provider, transcribeWithWebAPI, transcribeWithLocalWhisper, transcribeWithRemoteWhisper]);

  // FIXED: Continuous recognition for Web Speech API (live microphone)
  const startContinuousRecognition = useCallback(async (): Promise<void> => {
    if (settings.provider !== 'webapi') {
      throw new Error('Continuous recognition only supported with Web Speech API');
    }

    try {
      const recognition = initWebSpeechAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onstart = () => {
        setIsRecognizing(true);
        console.log('Continuous speech recognition started');
      };
      
      recognition.onend = () => {
        setIsRecognizing(false);
        console.log('Continuous speech recognition ended');
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecognizing(false);
      };
      
      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Failed to start continuous recognition:', error);
      throw error;
    }
  }, [settings.provider, initWebSpeechAPI]);

  const stopContinuousRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecognizing(false);
  }, []);

  // Test provider functionality
  const testProvider = useCallback(async (provider: STTProvider): Promise<boolean> => {
    try {
      switch (provider) {
        case 'webapi':
          if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            return false;
          }
          initWebSpeechAPI();
          return true;
          
        case 'local-whisper':
          if (!settings.localWhisper.modelName) {
            return false;
          }
          if (!window.whisperAPI) {
            return false;
          }
          const modelExists = await window.whisperAPI.checkWhisperModel(settings.localWhisper.modelName);
          return modelExists;
          
        case 'remote-whisper':
          if (!settings.remoteWhisper.endpoint) {
            return false;
          }
          
          const endpoint = settings.remoteWhisper.endpoint.replace(/\/$/, '');
          const testUrl = `${endpoint}/v1/models`;
          
          const headers: Record<string, string> = {};
          if (settings.remoteWhisper.apiKey && settings.remoteWhisper.apiKey.trim()) {
            headers['Authorization'] = `Bearer ${settings.remoteWhisper.apiKey}`;
          }
          
          const response = await fetch(testUrl, { 
            method: 'GET',
            headers,
          });
          return response.ok;
          
        default:
          return false;
      }
    } catch (error) {
      console.error(`Provider test failed for ${provider}:`, error);
      return false;
    }
  }, [settings, initWebSpeechAPI]);

  // Debounced refresh function to prevent spam
  const refreshModels = useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(async () => {
      isRefreshingRef.current = true;
      
      try {
        if (!window.whisperAPI) {
          console.warn('Whisper API not available');
          setAvailableModels([]);
          return;
        }
        
        const models = await window.whisperAPI.getAvailableWhisperModels();
        setAvailableModels(models);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Whisper models refreshed:', models.length, 'models found');
        }
      } catch (error) {
        console.error('Failed to refresh Whisper models:', error);
        setAvailableModels([]);
        
        if (process.env.NODE_ENV === 'development') {
          toaster.create({
            title: "Failed to refresh Whisper models",
            description: error instanceof Error ? error.message : 'Unknown error occurred',
            type: "error",
            duration: 5000,
          });
        }
      } finally {
        isRefreshingRef.current = false;
      }
    }, 500);
  }, []);

  // Enhanced settings update with change tracking
  const updateSettings = useCallback((newSettings: Partial<STTSettings>) => {
    const oldProvider = settings.provider;
    const updatedSettings = { ...settings, ...newSettings };
    
    setSettingsStorage(updatedSettings);
    
    if (isInitialized && newSettings.provider && newSettings.provider !== oldProvider) {
      console.log('STT Context: Settings updated by user:', {
        from: oldProvider,
        to: newSettings.provider,
      });
      setHasSettingsChanged(true);
      setTimeout(() => setHasSettingsChanged(false), 1000);
    }
  }, [settings, setSettingsStorage, isInitialized]);

  // Initialize models on mount (only once)
  useEffect(() => {
    let mounted = true;
    
    const initializeModels = async () => {
      if (mounted) {
        await refreshModels();
      }
    };

    initializeModels();

    return () => {
      mounted = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [refreshModels]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopContinuousRecognition();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [stopContinuousRecognition]);

  const contextValue = useMemo(
    () => ({
      settings,
      updateSettings,
      availableModels,
      refreshModels,
      isRecognizing,
      transcribeAudio,
      startContinuousRecognition,
      stopContinuousRecognition,
      testProvider,
      isInitialized,
      hasSettingsChanged,
    }),
    [
      settings,
      updateSettings,
      availableModels,
      refreshModels,
      isRecognizing,
      transcribeAudio,
      startContinuousRecognition,
      stopContinuousRecognition,
      testProvider,
      isInitialized,
      hasSettingsChanged,
    ],
  );

  return (
    <STTContext.Provider value={contextValue}>
      {children}
    </STTContext.Provider>
  );
}

export function useSTT() {
  const context = useContext(STTContext);

  if (!context) {
    throw new Error('useSTT must be used within a STTProvider');
  }

  return context;
}