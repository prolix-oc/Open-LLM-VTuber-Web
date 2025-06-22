import React, { useContext, useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { fixedWsService, WebSocketMessage, ConnectionStats } from '@/services/websocket-service';
import { audioAnalysisService, AudioAnalysisResult } from '@/services/audio-analysis-service';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { toaster } from '@/components/ui/toaster';

const DEFAULT_WS_URL = 'wss://enspira.tools/ws-client';
const DEFAULT_BASE_URL = 'https://enspira.tools';

export interface HistoryInfo {
  uid: string;
  latest_message: {
    role: 'human' | 'ai';
    timestamp: string;
    content: string;
  } | null;
  timestamp: string | null;
}

export interface EnhancedAudioPayload {
  audioBase64: string;
  audioUrl?: string;
  lipSyncData: AudioAnalysisResult;
  displayText?: {
    text: string;
    name: string;
    avatar: string;
  };
  expressions?: string[] | number[];
  forwarded?: boolean;
}

interface EnhancedWebSocketContextProps {
  sendMessage: (message: Partial<WebSocketMessage>, priority?: 'low' | 'normal' | 'high' | 'critical') => Promise<void>;
  wsState: string;
  reconnect: () => Promise<void>;
  manualReconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  
  wsUrl: string;
  setWsUrl: (url: string) => void;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  
  apiKey: string;
  setApiKey: (key: string) => void;
  
  authToken: string;
  setAuthToken: (token: string) => void;
  
  connectionStats: ConnectionStats;
  isAuthenticated: boolean;
  
  processAudioResponse: (audioBase64: string, displayText?: any, expressions?: any) => Promise<EnhancedAudioPayload>;
  
  audioConfig: {
    sliceLength: number;
    smoothingFactor: number;
    normalize: boolean;
  };
  setAudioConfig: (config: Partial<typeof audioConfig>) => void;
  
  getConnectionInfo: () => {
    state: string;
    attempts: number;
    maxAttempts: number;
    series: number;
    canAutoReconnect: boolean;
    connectionInProgress: boolean;
    isAuthenticated: boolean;
    authenticationPending: boolean;
    authenticationAttempts: number;
    maxAuthAttempts: number;
    serverClientId?: string;
    serverUserId?: string;
  };
}

const createDefaultContext = (): EnhancedWebSocketContextProps => ({
  sendMessage: async () => console.warn('sendMessage called on default context'),
  wsState: 'CLOSED',
  reconnect: async () => console.warn('reconnect called on default context'),
  manualReconnect: async () => console.warn('manualReconnect called on default context'),
  disconnect: async () => console.warn('disconnect called on default context'),
  wsUrl: DEFAULT_WS_URL,
  setWsUrl: () => console.warn('setWsUrl called on default context'),
  baseUrl: DEFAULT_BASE_URL,
  setBaseUrl: () => console.warn('setBaseUrl called on default context'),
  apiKey: '',
  setApiKey: () => console.warn('setApiKey called on default context'),
  authToken: '',
  setAuthToken: () => console.warn('setAuthToken called on default context'),
  connectionStats: {
    connected: false,
    reconnectCount: 0,
    messagesReceived: 0,
    messagesSent: 0,
    connectionSeries: 0,
  },
  isAuthenticated: false,
  processAudioResponse: async () => ({} as EnhancedAudioPayload),
  audioConfig: {
    sliceLength: 100,
    smoothingFactor: 0.3,
    normalize: true,
  },
  setAudioConfig: () => console.warn('setAudioConfig called on default context'),
  getConnectionInfo: () => ({
    state: 'CLOSED',
    attempts: 0,
    maxAttempts: 5,
    series: 0,
    canAutoReconnect: true,
    connectionInProgress: false,
    isAuthenticated: false,
    authenticationPending: false,
    authenticationAttempts: 0,
    maxAuthAttempts: 3,
  }),
});

export const EnhancedWebSocketContext = React.createContext<EnhancedWebSocketContextProps>(createDefaultContext());

export function useEnhancedWebSocket() {
  const context = useContext(EnhancedWebSocketContext);
  
  if (!context) {
    throw new Error('useEnhancedWebSocket must be used within an EnhancedWebSocketProvider');
  }
  
  if (!context.setApiKey || typeof context.setApiKey !== 'function') {
    throw new Error('setApiKey function is missing from WebSocket context');
  }
  
  if (!context.setAuthToken || typeof context.setAuthToken !== 'function') {
    throw new Error('setAuthToken function is missing from WebSocket context');
  }
  
  return context;
}

export const useWebSocket = useEnhancedWebSocket;

export function EnhancedWebSocketProvider({ children }: { children: React.ReactNode }) {
  // FIXED: Enhanced persistent storage with better debugging
  const [wsUrl, setWsUrl] = useLocalStorage('wsUrl', DEFAULT_WS_URL);
  const [baseUrl, setBaseUrl] = useLocalStorage('baseUrl', DEFAULT_BASE_URL);
  const [apiKey, setApiKeyStorage] = useLocalStorage('enspiraApiKey', '');
  const [audioConfig, setAudioConfig] = useLocalStorage('audioAnalysisConfig', {
    sliceLength: 100,
    smoothingFactor: 0.3,
    normalize: true,
  });
  
  console.log('WebSocket Context - API Key from localStorage:', {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : 'none',
    timestamp: new Date().toISOString(),
  });
  
  // Connection state
  const [wsState, setWsState] = useState<string>('CLOSED');
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    connected: false,
    reconnectCount: 0,
    messagesReceived: 0,
    messagesSent: 0,
    connectionSeries: 0,
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // FIXED: Single initialization flag
  const initialized = useRef(false);
  const initializationStarted = useRef(false);
  
  // FIXED: Stable refs for current values
  const currentApiKey = useRef(apiKey || '');
  const currentWsUrl = useRef(wsUrl || DEFAULT_WS_URL);
  
  // FIXED: Update refs immediately when localStorage values change
  useEffect(() => {
    const newApiKey = apiKey || '';
    const newWsUrl = wsUrl || DEFAULT_WS_URL;
    
    console.log('API Key updated in WebSocket context:', {
      oldKey: currentApiKey.current ? `${currentApiKey.current.substring(0, 8)}...` : 'none',
      newKey: newApiKey ? `${newApiKey.substring(0, 8)}...` : 'none',
      oldLength: currentApiKey.current.length,
      newLength: newApiKey.length,
    });
    
    currentApiKey.current = newApiKey;
    currentWsUrl.current = newWsUrl;
    
    // Reset authentication when API key changes
    if (currentApiKey.current !== newApiKey) {
      setIsAuthenticated(false);
    }
  }, [apiKey, wsUrl]);

  // Debug exposure with enhanced info
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).fixedWsService = fixedWsService;
      (window as any).wsDebugContext = {
        wsUrl,
        apiKey: apiKey ? `${apiKey.length} chars (${apiKey.substring(0, 8)}...)` : 'none',
        wsState,
        isAuthenticated,
        connectionStats,
        initialized: initialized.current,
        initializationStarted: initializationStarted.current,
        currentApiKeyRef: currentApiKey.current ? `${currentApiKey.current.length} chars` : 'none',
        localStorageDirectCheck: window.localStorage.getItem('enspiraApiKey'),
      };
    }
  }, [wsUrl, apiKey, wsState, isAuthenticated, connectionStats]);

  // FIXED: Enhanced API key setter with immediate ref update
  const handleSetApiKey = useCallback((key: string) => {
    const cleanKey = (key || '').trim();
    console.log('Setting API key in WebSocket context:', {
      cleanedLength: cleanKey.length,
      hasKey: !!cleanKey,
      preview: cleanKey ? `${cleanKey.substring(0, 8)}...` : 'none',
    });
    
    setApiKeyStorage(cleanKey);
    currentApiKey.current = cleanKey;
    setIsAuthenticated(false);
    
    // If we have a connection and new key, restart authentication
    if (wsState === 'OPEN' && cleanKey) {
      console.log('API key changed with active connection, will re-authenticate');
    }
  }, [setApiKeyStorage, wsState]);

  const handleSetAuthToken = useCallback((token: string) => {
    console.log('Setting auth token (redirecting to setApiKey)');
    handleSetApiKey(token);
  }, [handleSetApiKey]);

  const handleSetWsUrl = useCallback((url: string) => {
    const cleanUrl = (url || '').trim() || DEFAULT_WS_URL;
    console.log('Setting WebSocket URL:', cleanUrl);
    setWsUrl(cleanUrl);
    currentWsUrl.current = cleanUrl;
  }, [setWsUrl]);

  // FIXED: Core WebSocket functions
  const sendMessage = useCallback(async (
    message: Partial<WebSocketMessage>, 
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ) => {
    try {
      await fixedWsService.sendMessage(message, priority);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, []);

  const reconnect = useCallback(async () => {
    try {
      console.log('Reconnect requested with current API key:', {
        hasKey: !!currentApiKey.current,
        keyLength: currentApiKey.current.length,
      });
      
      await fixedWsService.connect({
        url: currentWsUrl.current,
        authToken: currentApiKey.current || undefined,
        maxReconnectAttempts: 5,
        reconnectInterval: 3000,
        heartbeatInterval: 30000,
        connectionTimeout: 10000,
        enableCompression: true,
      });
    } catch (error) {
      console.error('Failed to reconnect:', error);
      throw error;
    }
  }, []);

  const manualReconnect = useCallback(async () => {
    try {
      console.log('Manual reconnect requested');
      await fixedWsService.manualReconnect();
    } catch (error) {
      console.error('Failed to manually reconnect:', error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      console.log('Disconnect requested');
      await fixedWsService.disconnect();
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Failed to disconnect:', error);
      throw error;
    }
  }, []);

  const processAudioResponse = useCallback(async (
    audioBase64: string,
    displayText?: any,
    expressions?: any
  ): Promise<EnhancedAudioPayload> => {
    try {
      await audioAnalysisService.resumeAudioContext();
      
      const lipSyncData = await audioAnalysisService.analyzeAudioBase64(audioBase64, {
        sliceLength: audioConfig.sliceLength,
        smoothingFactor: audioConfig.smoothingFactor,
        normalize: audioConfig.normalize,
        peakDetection: true,
        frequencyRange: {
          low: 80,
          high: 255,
        },
      });

      return {
        audioBase64,
        lipSyncData,
        displayText,
        expressions,
        forwarded: false,
      };
    } catch (error) {
      console.error('Failed to process audio response:', error);
      
      return {
        audioBase64,
        lipSyncData: {
          volumes: [],
          sliceLength: audioConfig.sliceLength,
          duration: 0,
          sampleRate: 44100,
          peaks: [],
          rms: [],
        },
        displayText,
        expressions,
        forwarded: false,
      };
    }
  }, [audioConfig]);

  const getConnectionInfo = useCallback(() => {
    const serviceInfo = fixedWsService.getConnectionInfo();
    return {
      state: serviceInfo.state,
      attempts: serviceInfo.attempts,
      maxAttempts: serviceInfo.maxAttempts,
      series: serviceInfo.series,
      canAutoReconnect: serviceInfo.canAutoReconnect,
      connectionInProgress: serviceInfo.connectionInProgress,
      isAuthenticated: serviceInfo.isAuthenticated,
      authenticationPending: serviceInfo.authenticationPending,
      authenticationAttempts: serviceInfo.authenticationAttempts,
      maxAuthAttempts: serviceInfo.maxAuthAttempts,
      serverClientId: serviceInfo.serverClientId,
      serverUserId: serviceInfo.serverUserId,
    };
  }, []);

  // FIXED: Enhanced initialization with better API key handling
  useEffect(() => {
    if (initializationStarted.current) {
      console.debug('WebSocket initialization already started, skipping');
      return;
    }

    // Wait for API key to be loaded from localStorage
    if (!apiKey && apiKey !== '') {
      console.log('Waiting for API key to load from localStorage...');
      return;
    }

    const initializeConnection = async () => {
      try {
        console.log('Initializing WebSocket connection...', {
          url: currentWsUrl.current,
          hasApiKey: !!currentApiKey.current,
          apiKeyLength: currentApiKey.current.length,
          apiKeyPreview: currentApiKey.current ? `${currentApiKey.current.substring(0, 8)}...` : 'none',
        });
        
        initializationStarted.current = true;
        
        await fixedWsService.connect({
          url: currentWsUrl.current,
          authToken: currentApiKey.current || undefined,
          maxReconnectAttempts: 5,
          reconnectInterval: 3000,
          heartbeatInterval: 30000,
          connectionTimeout: 10000,
          enableCompression: true,
        });
        
        initialized.current = true;
        console.log('WebSocket connection initialized successfully');
      } catch (error) {
        console.error('Failed to initialize WebSocket connection:', error);
        // Don't reset initialization flags - let manual reconnect handle it
      }
    };

    initializeConnection();

    // Subscribe to state changes
    const stateSubscription = fixedWsService.onStateChange().subscribe(setWsState);
    const statsSubscription = fixedWsService.onStats().subscribe(setConnectionStats);
    
    // Subscribe to messages for authentication status
    const messageSubscription = fixedWsService.onMessage().subscribe((message) => {
      console.log('WebSocket context received message:', message.type);
      
      if (message.type === 'auth-success') {
        setIsAuthenticated(true);
        console.log('Authentication successful in context');
      } else if (message.type === 'auth-failed') {
        setIsAuthenticated(false);
        console.log('Authentication failed in context');
      } else if (message.type === 'auth-required') {
        setIsAuthenticated(false);
        console.log('Authentication required in context');
      }
    });

    // Sync authentication state periodically
    const authStateInterval = setInterval(() => {
      const serviceAuth = fixedWsService.getIsAuthenticated();
      if (serviceAuth !== isAuthenticated) {
        console.log('Syncing authentication state:', { serviceAuth, contextAuth: isAuthenticated });
        setIsAuthenticated(serviceAuth);
      }
    }, 2000);

    return () => {
      console.debug('Cleaning up WebSocket subscriptions');
      stateSubscription.unsubscribe();
      statsSubscription.unsubscribe();
      messageSubscription.unsubscribe();
      clearInterval(authStateInterval);
    };
  }, [apiKey]); // Depend on apiKey to ensure we wait for it to load

  // FIXED: Memoized context value with all required functions
  const contextValue = useMemo(() => {
    const safeWsUrl = wsUrl || DEFAULT_WS_URL;
    const safeBaseUrl = baseUrl || DEFAULT_BASE_URL;
    const safeApiKey = apiKey || '';
    
    console.log('Creating WebSocket context value:', {
      hasApiKey: !!safeApiKey,
      apiKeyLength: safeApiKey.length,
      wsState,
      isAuthenticated,
    });
    
    const context: EnhancedWebSocketContextProps = {
      sendMessage,
      wsState,
      reconnect,
      manualReconnect,
      disconnect,
      
      wsUrl: safeWsUrl,
      setWsUrl: handleSetWsUrl,
      baseUrl: safeBaseUrl,
      setBaseUrl,
      
      apiKey: safeApiKey,
      setApiKey: handleSetApiKey,
      
      authToken: safeApiKey, // Backward compatibility
      setAuthToken: handleSetAuthToken,
      
      connectionStats,
      isAuthenticated,
      
      processAudioResponse,
      audioConfig,
      setAudioConfig,
      
      getConnectionInfo,
    };
    
    // Validate required functions
    const requiredFunctions = ['setApiKey', 'setAuthToken', 'setWsUrl', 'sendMessage', 'reconnect', 'disconnect'];
    const missingFunctions = requiredFunctions.filter(fn => typeof context[fn] !== 'function');
    
    if (missingFunctions.length > 0) {
      console.error('Missing required functions in context:', missingFunctions);
      throw new Error(`WebSocket context is missing required functions: ${missingFunctions.join(', ')}`);
    }
    
    return context;
  }, [
    sendMessage,
    wsState,
    reconnect,
    manualReconnect,
    disconnect,
    wsUrl,
    handleSetWsUrl,
    baseUrl,
    setBaseUrl,
    apiKey,
    handleSetApiKey,
    handleSetAuthToken,
    connectionStats,
    isAuthenticated,
    processAudioResponse,
    audioConfig,
    setAudioConfig,
    getConnectionInfo,
  ]);

  return (
    <EnhancedWebSocketContext.Provider value={contextValue}>
      {children}
    </EnhancedWebSocketContext.Provider>
  );
}

// Maintain backward compatibility
export const WebSocketProvider = EnhancedWebSocketProvider;
export const WebSocketContext = EnhancedWebSocketContext;

// Export types for external use
export type { 
  EnhancedWebSocketContextProps,
  WebSocketMessage,
  ConnectionStats,
};