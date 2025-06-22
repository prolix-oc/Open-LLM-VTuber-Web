// src/renderer/src/services/websocket-service.tsx
import { Subject, BehaviorSubject } from 'rxjs';
import { toaster } from '@/components/ui/toaster';

// Message interfaces
export interface DisplayText {
  text: string;
  name: string;
  avatar: string;
}

export interface Actions {
  expressions?: string[] | number[];
  pictures?: string[];
  sounds?: string[];
}

export interface WebSocketMessage {
  type: 'text-input' | 'model-info' | 'audio' | 'audio-url' | 'full-text' | 'error' | 
        'response-queued' | 'synthesis-started' | 'synthesis-complete' | 
        'interrupt' | 'auth-required' | 'auth-success' | 'auth-failed' | 
        'connection-established' | 'connection-test' | 'connection-test-response' |
        'model-info-received' | 'ping' | 'pong';
  
  auth_token?: string;
  text?: string;
  model_info?: {
    name: string;
    url: string;
    expressions: string[] | number[];
    scale?: number;
    width?: number;
    height?: number;
  };
  
  // Legacy audio format (base64)
  audio?: string;
  
  // NEW: Audio URL format
  audio_url?: string;
  audio_format?: 'wav' | 'mp3' | 'ogg' | 'm4a';
  sample_rate?: number;
  bit_depth?: number;
  
  display_text?: DisplayText;
  actions?: Actions;
  response_id?: string;
  client_id?: string;
  user_id?: string;
  timestamp?: string;
  request_id?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  message?: string;
  server_time?: string;
  error_details?: string;
}

export interface WebSocketConfig {
  url: string;
  authToken?: string;
  maxReconnectAttempts: number;
  reconnectInterval: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  enableCompression?: boolean;
}

export interface ConnectionStats {
  connected: boolean;
  lastConnected?: Date;
  reconnectCount: number;
  messagesReceived: number;
  messagesSent: number;
  latency?: number;
  lastConnectionAttempt?: Date;
  connectionSeries: number;
  serverClientId?: string;
  serverUserId?: string;
}

type WebSocketState = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED' | 'RECONNECTING' | 'FAILED' | 'MANUAL_RETRY_REQUIRED';

class StableWebSocketService {
  private static instance: StableWebSocketService;
  
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private currentState: WebSocketState = 'CLOSED';
  
  // Connection state tracking
  private currentReconnectAttempts = 0;
  private connectionSeriesCount = 0;
  private isReconnecting = false;
  private reconnectTimer?: NodeJS.Timeout;
  private connectionInProgress = false;
  private isDestroying = false;
  
  // Timers
  private heartbeatTimer?: NodeJS.Timeout;
  private connectionTimer?: NodeJS.Timeout;
  private lastPingTime?: number;
  
  // Server identifiers
  private serverClientId?: string;
  private serverUserId?: string;
  
  // Authentication state
  private isAuthenticated = false;
  private authenticationPending = false;
  private authenticationTimer?: NodeJS.Timeout;
  private pendingAuthToken?: string;
  private authenticationStartTime?: number;
  private authenticationAttempts = 0;
  private readonly MAX_AUTH_ATTEMPTS = 3;
  
  // Observables
  private messageSubject = new Subject<WebSocketMessage>();
  private stateSubject = new BehaviorSubject<WebSocketState>('CLOSED');
  private statsSubject = new BehaviorSubject<ConnectionStats>({
    connected: false,
    reconnectCount: 0,
    messagesReceived: 0,
    messagesSent: 0,
    connectionSeries: 0,
  });
  
  // Message queue
  private messageQueue: { message: WebSocketMessage; priority: number; id: string }[] = [];
  private readonly MAX_QUEUE_SIZE = 20;
  private pendingMessageIds = new Set<string>();
  
  private constructor() {
    this.config = {
      url: '',
      maxReconnectAttempts: 5,
      reconnectInterval: 3000,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
      enableCompression: true,
    };
  }

  static getInstance(): StableWebSocketService {
    if (!StableWebSocketService.instance) {
      StableWebSocketService.instance = new StableWebSocketService();
    }
    return StableWebSocketService.instance;
  }

  async connect(config: Partial<WebSocketConfig>): Promise<void> {
    // Update configuration
    this.config = { ...this.config, ...config };
    
    if (!this.config.url) {
      throw new Error('WebSocket URL is required');
    }

    console.log('StableWebSocket: Starting connection process...', {
      url: this.config.url,
      hasAuthToken: !!this.config.authToken,
      authTokenLength: this.config.authToken?.length || 0,
      currentState: this.currentState,
      connectionInProgress: this.connectionInProgress,
    });

    if (this.connectionInProgress) {
      console.log('Connection already in progress, waiting for completion...');
      
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (!this.connectionInProgress) {
            clearInterval(checkInterval);
            if (this.currentState === 'OPEN') {
              resolve();
            } else {
              reject(new Error('Connection failed'));
            }
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Connection timeout waiting for existing attempt'));
        }, 15000);
      });
    }

    if (this.currentState === 'CLOSED' || this.currentState === 'FAILED' || this.currentState === 'MANUAL_RETRY_REQUIRED') {
      await this.fullReset();
    }
    
    this.pendingAuthToken = this.config.authToken;
    
    if (this.currentState === 'CLOSED') {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return this.createConnection();
  }

  async disconnect(): Promise<void> {
    console.log('Manual disconnect requested');
    return this.fullReset();
  }

  private async fullReset(): Promise<void> {
    console.log('Performing full WebSocket reset...');
    
    this.stopReconnectionProcess();
    this.clearAllTimers();
    this.connectionInProgress = false;
    this.resetAuthenticationState();
    
    if (this.ws) {
      const currentWs = this.ws;
      this.ws = null;
      
      this.updateState('CLOSING');
      
      try {
        if (currentWs.readyState !== WebSocket.CLOSED && currentWs.readyState !== WebSocket.CLOSING) {
          currentWs.close(1000, 'Reset connection');
        }
      } catch (error) {
        console.error('Error closing WebSocket during reset:', error);
      }
    }
    
    this.currentReconnectAttempts = 0;
    this.connectionSeriesCount = 0;
    this.messageQueue = [];
    this.pendingMessageIds.clear();
    
    this.updateState('CLOSED');
    this.clearServerIdentifiers();
    this.updateStats({ connected: false });
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  async manualReconnect(): Promise<void> {
    console.log('Manual reconnect requested');
    
    await this.fullReset();
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return this.connect({
      url: this.config.url,
      authToken: this.pendingAuthToken,
    });
  }

  private async createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.connectionInProgress) {
          resolve();
          return;
        }

        if (this.currentState === 'CONNECTING' || this.currentState === 'OPEN') {
          resolve();
          return;
        }

        console.log(`Creating WebSocket connection attempt ${this.currentReconnectAttempts + 1}/${this.config.maxReconnectAttempts}`);
        
        this.connectionInProgress = true;
        this.updateState('CONNECTING');
        this.updateStats({ 
          lastConnectionAttempt: new Date(),
          connectionSeries: this.connectionSeriesCount,
        });
        
        this.connectionTimer = setTimeout(() => {
          if (this.connectionInProgress) {
            console.log('Connection timeout');
            this.connectionInProgress = false;
            if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
              this.ws.close();
            }
            reject(new Error('Connection timeout'));
          }
        }, this.config.connectionTimeout);

        try {
          new URL(this.config.url);
        } catch (urlError) {
          this.connectionInProgress = false;
          reject(new Error(`Invalid WebSocket URL: ${this.config.url}`));
          return;
        }

        console.log('Creating WebSocket to:', this.config.url);
        
        try {
          this.ws = new WebSocket(this.config.url);
        } catch (wsError) {
          console.error('Failed to create WebSocket:', wsError);
          this.connectionInProgress = false;
          reject(wsError);
          return;
        }

        if (!this.ws) {
          this.connectionInProgress = false;
          reject(new Error('Failed to create WebSocket object'));
          return;
        }

        this.ws.onopen = (event) => {
          console.log('WebSocket opened successfully');
          this.clearAllTimers();
          this.connectionInProgress = false;
          this.stopReconnectionProcess();
          this.updateState('OPEN');
          this.startHeartbeat();
          
          this.updateStats({ 
            connected: true, 
            lastConnected: new Date(),
            reconnectCount: this.currentReconnectAttempts,
          });
          
          console.log('WebSocket connection established, waiting for server messages...');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.connectionInProgress = false;
          this.handleClose(event);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.connectionInProgress = false;
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        this.connectionInProgress = false;
        this.updateState('FAILED');
        reject(error);
      }
    });
  }

  private startAuthenticationProcess(): void {
    if (!this.pendingAuthToken) {
      console.log('No auth token available for authentication');
      this.authenticationPending = false;
      return;
    }

    if (this.authenticationPending) {
      console.log('Authentication already in progress');
      return;
    }

    if (this.authenticationAttempts >= this.MAX_AUTH_ATTEMPTS) {
      console.error('Max authentication attempts reached, giving up');
      this.authenticationPending = false;
      return;
    }

    console.log(`Starting authentication process (attempt ${this.authenticationAttempts + 1}/${this.MAX_AUTH_ATTEMPTS})...`);
    this.authenticationPending = true;
    this.authenticationStartTime = Date.now();
    this.authenticationAttempts++;

    if (this.authenticationTimer) {
      clearTimeout(this.authenticationTimer);
    }

    this.authenticationTimer = setTimeout(() => {
      if (this.authenticationPending) {
        console.warn('Authentication timeout - resetting auth state');
        this.authenticationPending = false;
        
        if (this.authenticationAttempts < this.MAX_AUTH_ATTEMPTS) {
          setTimeout(() => this.startAuthenticationProcess(), 2000);
        }
      }
    }, 10000);

    this.sendMessage({
      type: 'connection-test',
      text: 'initial_auth_check',
    }, 'critical').catch(error => {
      console.error('Failed to send authentication message:', error);
      this.authenticationPending = false;
    });
  }

  async sendMessage(message: Partial<WebSocketMessage>, priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'): Promise<void> {
    const messageId = this.generateRequestId();
    
    const enhancedMessage: WebSocketMessage = {
      ...message,
      type: message.type || 'text-input',
      timestamp: new Date().toISOString(),
      request_id: messageId,
      priority,
    };

    if (this.pendingAuthToken && this.shouldIncludeAuth(enhancedMessage.type)) {
      enhancedMessage.auth_token = this.pendingAuthToken;
      console.log('Including auth token in message:', {
        type: enhancedMessage.type,
        hasToken: !!enhancedMessage.auth_token,
        tokenLength: enhancedMessage.auth_token?.length || 0
      });
    }

    if (this.pendingMessageIds.has(messageId)) {
      console.warn('Duplicate message detected, skipping:', messageId);
      return;
    }

    if (this.isConnected() && !this.connectionInProgress) {
      this.pendingMessageIds.add(messageId);
      try {
        await this.sendMessageNow(enhancedMessage);
        setTimeout(() => this.processMessageQueue(), 100);
      } finally {
        setTimeout(() => this.pendingMessageIds.delete(messageId), 1000);
      }
    } else {
      console.log(`WebSocket not ready, queueing message: ${enhancedMessage.type}`);
      this.queueMessage(enhancedMessage, messageId);
    }
  }

  async sendTextInput(text: string): Promise<void> {
    return this.sendMessage({
      type: 'text-input',
      text: text.trim(),
    }, 'high');
  }

  async sendModelInfo(modelInfo: {
    name: string;
    url: string;
    expressions: string[] | number[];
    scale?: number;
    width?: number;
    height?: number;
  }): Promise<void> {
    return this.sendMessage({
      type: 'model-info',
      model_info: modelInfo,
    }, 'normal');
  }

  async sendInterrupt(): Promise<void> {
    return this.sendMessage({
      type: 'interrupt',
    }, 'critical');
  }

  onMessage() {
    return this.messageSubject.asObservable();
  }

  onStateChange() {
    return this.stateSubject.asObservable();
  }

  onStats() {
    return this.statsSubject.asObservable();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && !this.connectionInProgress;
  }

  getIsAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  getCurrentState(): WebSocketState {
    return this.currentState;
  }

  getStats(): ConnectionStats {
    return this.statsSubject.value;
  }

  getConnectionInfo() {
    return {
      state: this.currentState,
      attempts: this.currentReconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      series: this.connectionSeriesCount,
      canAutoReconnect: this.currentReconnectAttempts < this.config.maxReconnectAttempts && !this.isReconnecting,
      connectionInProgress: this.connectionInProgress,
      serverClientId: this.serverClientId,
      serverUserId: this.serverUserId,
      isAuthenticated: this.isAuthenticated,
      authenticationPending: this.authenticationPending,
      authenticationAttempts: this.authenticationAttempts,
      maxAuthAttempts: this.MAX_AUTH_ATTEMPTS,
    };
  }

  private startReconnectionProcess(): void {
    if (this.isReconnecting || this.connectionInProgress || this.isDestroying) {
      console.log('Reconnection blocked:', { isReconnecting: this.isReconnecting, connectionInProgress: this.connectionInProgress, isDestroying: this.isDestroying });
      return;
    }

    if (this.currentReconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log(`Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`);
      this.updateState('MANUAL_RETRY_REQUIRED');
      toaster.create({
        title: 'Connection failed',
        description: `Failed to connect after ${this.config.maxReconnectAttempts} attempts. Please check your connection and try again.`,
        type: 'error',
        duration: 8000,
      });
      return;
    }

    this.isReconnecting = true;
    this.currentReconnectAttempts++;
    this.updateState('RECONNECTING');

    const delay = Math.min(this.config.reconnectInterval * Math.pow(1.5, this.currentReconnectAttempts - 1), 30000);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.currentReconnectAttempts}/${this.config.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      if (this.isDestroying) {
        return;
      }

      try {
        await this.createConnection();
        this.isReconnecting = false;
      } catch (error) {
        console.error(`Reconnection attempt ${this.currentReconnectAttempts} failed:`, error);
        this.isReconnecting = false;
        
        if (this.currentReconnectAttempts < this.config.maxReconnectAttempts && !this.isDestroying) {
          this.startReconnectionProcess();
        } else {
          this.updateState('MANUAL_RETRY_REQUIRED');
        }
      }
    }, delay);
  }

  private stopReconnectionProcess(): void {
    this.isReconnecting = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      console.log('Received message:', {
        type: message.type,
        hasClientId: !!message.client_id,
        hasUserId: !!message.user_id,
        authPending: this.authenticationPending,
        isAuthenticated: this.isAuthenticated,
      });
      
      switch (message.type) {
        case 'connection-established':
          if (message.client_id) {
            this.serverClientId = message.client_id;
            this.updateStats({ serverClientId: message.client_id });
          }
          console.log('Connection established with server, client ID:', message.client_id);
          break;

        case 'auth-required':
          console.log('Authentication required by server');
          this.resetAuthenticationState();
          setTimeout(() => this.startAuthenticationProcess(), 500);
          break;

        case 'auth-success':
          console.log('Authentication successful!', {
            user_id: message.user_id,
            duration: this.authenticationStartTime ? Date.now() - this.authenticationStartTime : 'unknown'
          });
          
          this.isAuthenticated = true;
          this.authenticationPending = false;
          this.authenticationAttempts = 0;
          
          if (this.authenticationTimer) {
            clearTimeout(this.authenticationTimer);
            this.authenticationTimer = undefined;
          }
          
          if (message.user_id) {
            this.serverUserId = message.user_id;
            this.updateStats({ serverUserId: message.user_id });
          }
          
          console.log('Authentication completed successfully for user:', message.user_id);
          setTimeout(() => this.processMessageQueue(), 200);
          break;

        case 'auth-failed':
          console.error('Authentication failed:', message.message);
          this.isAuthenticated = false;
          this.authenticationPending = false;
          
          if (this.authenticationTimer) {
            clearTimeout(this.authenticationTimer);
            this.authenticationTimer = undefined;
          }
          
          if (this.authenticationAttempts < this.MAX_AUTH_ATTEMPTS) {
            console.log('Retrying authentication in 3 seconds...');
            setTimeout(() => this.startAuthenticationProcess(), 3000);
          } else {
            console.error('Max authentication attempts reached');
            toaster.create({
              title: 'Authentication failed',
              description: 'Invalid API key. Please check your settings.',
              type: 'error',
              duration: 5000,
            });
          }
          break;

        case 'pong':
          if (this.lastPingTime) {
            const latency = Date.now() - this.lastPingTime;
            this.updateStats({ latency });
          }
          break;

        case 'ping':
          this.sendMessage({ type: 'pong' }, 'low').catch(console.error);
          break;

        case 'connection-test-response':
          console.log('Connection test response received:', message.message);
          break;

        // NEW: Handle audio URL messages
        case 'audio-url':
          console.log('Received audio URL message:', {
            hasUrl: !!message.audio_url,
            format: message.audio_format,
            sampleRate: message.sample_rate,
            hasDisplayText: !!message.display_text,
            hasActions: !!message.actions,
          });
          break;

        case 'audio':
          // Legacy base64 audio handling
          console.log('Received legacy base64 audio message');
          break;
      }

      this.updateStats({ messagesReceived: this.getStats().messagesReceived + 1 });
      this.messageSubject.next(message);
      
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log('Handling WebSocket close:', event.code, event.reason);
    
    this.clearAllTimers();
    this.updateStats({ connected: false });
    this.clearServerIdentifiers();
    this.resetAuthenticationState();
    
    if (event.code === 1000) {
      this.updateState('CLOSED');
    } else if (this.currentState !== 'CLOSING' && !this.isDestroying) {
      console.log('Unexpected close, attempting reconnection');
      this.connectionSeriesCount++;
      this.startReconnectionProcess();
    } else {
      this.updateState('CLOSED');
    }
  }

  private async sendMessageNow(message: WebSocketMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    try {
      const messageToSend = JSON.stringify(message);
      this.ws.send(messageToSend);
      this.updateStats({ messagesSent: this.getStats().messagesSent + 1 });
      console.log('Message sent successfully:', message.type);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  private queueMessage(message: WebSocketMessage, messageId: string): void {
    const priorityMap = { critical: 0, high: 1, normal: 2, low: 3 };
    const priority = priorityMap[message.priority || 'normal'];
    
    const existingIndex = this.messageQueue.findIndex(item => item.id === messageId);
    if (existingIndex !== -1) {
      console.warn('Message already in queue:', messageId);
      return;
    }
    
    if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
      this.messageQueue = this.messageQueue
        .sort((a, b) => a.priority - b.priority)
        .slice(0, this.MAX_QUEUE_SIZE - 1);
    }
    
    this.messageQueue.push({ message, priority, id: messageId });
    console.log(`Message queued: ${message.type} (queue size: ${this.messageQueue.length})`);
  }

  private async processMessageQueue(): Promise<void> {
    if (!this.isConnected() || this.messageQueue.length === 0) {
      return;
    }

    console.log(`Processing ${this.messageQueue.length} queued messages`);
    this.messageQueue.sort((a, b) => a.priority - b.priority);
    
    const messages = this.messageQueue.splice(0);
    
    for (const { message, id } of messages) {
      try {
        this.pendingMessageIds.add(id);
        await this.sendMessageNow(message);
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error('Failed to send queued message:', error);
        if (message.priority === 'critical' || message.priority === 'high') {
          this.queueMessage(message, id);
        }
      } finally {
        setTimeout(() => this.pendingMessageIds.delete(id), 1000);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected() && !this.isDestroying) {
        this.lastPingTime = Date.now();
        this.sendMessage({ type: 'ping' }, 'low').catch(console.error);
      }
    }, this.config.heartbeatInterval);
  }

  private clearAllTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = undefined;
    }

    if (this.authenticationTimer) {
      clearTimeout(this.authenticationTimer);
      this.authenticationTimer = undefined;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private updateState(newState: WebSocketState): void {
    if (this.currentState !== newState) {
      const previousState = this.currentState;
      this.currentState = newState;
      this.stateSubject.next(newState);
      console.log(`WebSocket state: ${previousState} → ${newState}`);
    }
  }

  private updateStats(updates: Partial<ConnectionStats>): void {
    const currentStats = this.statsSubject.value;
    this.statsSubject.next({ ...currentStats, ...updates });
  }

  private resetAuthenticationState(): void {
    this.isAuthenticated = false;
    this.authenticationPending = false;
    this.authenticationStartTime = undefined;
    
    if (this.authenticationTimer) {
      clearTimeout(this.authenticationTimer);
      this.authenticationTimer = undefined;
    }
  }

  private clearServerIdentifiers(): void {
    this.serverClientId = undefined;
    this.serverUserId = undefined;
  }

  private shouldIncludeAuth(messageType: string): boolean {
    const systemMessages = ['ping', 'pong'];
    return !systemMessages.includes(messageType);
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    console.log('Destroying WebSocket service');
    this.isDestroying = true;
    
    this.stopReconnectionProcess();
    this.fullReset();
    this.messageSubject.complete();
    this.stateSubject.complete();
    this.statsSubject.complete();
  }
}

// Export singleton
export const stableWsService = StableWebSocketService.getInstance();
export const fixedWsService = stableWsService;
export const enhancedWsService = stableWsService;
export const wsService = stableWsService;