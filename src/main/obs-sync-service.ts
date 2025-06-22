// src/main/obs-sync-service.ts
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { EventEmitter } from 'events';

export interface OBSModelUpdate {
  type: 'modelUpdate';
  modelInfo: {
    url: string;
    name: string;
    isLocal: boolean;
    kScale?: string | number;
    idleMotionGroupName?: string;
    initialXshift?: number;
    initialYshift?: number;
  };
}

export interface OBSMotionUpdate {
  type: 'motionUpdate';
  motionData: {
    group: string;
    index?: number;
    priority?: number;
  };
}

export interface OBSExpressionUpdate {
  type: 'expressionUpdate';
  expression: string | number;
}

export interface OBSAudioUpdate {
  type: 'audioData';
  audioData: {
    volume: number;
    frequency?: number;
    timestamp: number;
  };
}

export interface OBSSyncRequest {
  type: 'requestSync';
  source: string;
}

export type OBSMessage = OBSModelUpdate | OBSMotionUpdate | OBSExpressionUpdate | OBSAudioUpdate | OBSSyncRequest;

export interface OBSClient {
  id: string;
  ws: WebSocket;
  source: string;
  connected: boolean;
  lastPing: number;
}

export class OBSSyncService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, OBSClient> = new Map();
  private currentModelInfo: any = null;
  private currentExpression: string | number | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    super();
    this.setupHeartbeat();
  }

  /**
   * Start the WebSocket server on the given HTTP server
   */
  start(server: Server): void {
    if (this.isRunning) {
      console.log('OBS Sync Service is already running');
      return;
    }

    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws-obs-sync',
      perMessageDeflate: false 
    });

    this.wss.on('connection', (ws: WebSocket, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      console.error('OBS Sync WebSocket Server error:', error);
      this.emit('error', error);
    });

    this.isRunning = true;
    console.log('🔄 OBS Sync Service started');
  }

  /**
   * Stop the WebSocket server and clean up
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1000, 'Server shutting down');
      }
    }
    this.clients.clear();

    // Close the WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          this.wss = null;
          resolve();
        });
      });
    }

    this.isRunning = false;
    console.log('🛑 OBS Sync Service stopped');
  }

  /**
   * Handle new WebSocket connections
   */
  private handleConnection(ws: WebSocket, request: any): void {
    const clientId = this.generateClientId();
    const userAgent = request.headers['user-agent'] || 'unknown';
    
    const client: OBSClient = {
      id: clientId,
      ws,
      source: userAgent.includes('OBS') ? 'obs' : 'browser',
      connected: true,
      lastPing: Date.now()
    };

    this.clients.set(clientId, client);
    console.log(`📱 OBS client connected: ${clientId} (${client.source})`);
    this.emit('clientConnected', client);

    // Send current state to new client
    this.sendCurrentState(client);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as OBSMessage;
        this.handleMessage(client, message);
      } catch (error) {
        console.error('Failed to parse OBS message:', error);
      }
    });

    ws.on('close', (code, reason) => {
      client.connected = false;
      this.clients.delete(clientId);
      console.log(`📱 OBS client disconnected: ${clientId} (${code}: ${reason})`);
      this.emit('clientDisconnected', client);
    });

    ws.on('error', (error) => {
      console.error(`OBS client error (${clientId}):`, error);
      client.connected = false;
      this.clients.delete(clientId);
    });

    ws.on('pong', () => {
      client.lastPing = Date.now();
    });
  }

  /**
   * Handle incoming messages from OBS clients
   */
  private handleMessage(client: OBSClient, message: OBSMessage): void {
    switch (message.type) {
      case 'requestSync':
        console.log(`🔄 Sync requested by client ${client.id}`);
        this.sendCurrentState(client);
        break;
      default:
        console.log(`📨 Received message from ${client.id}:`, message.type);
    }
  }

  /**
   * Send current application state to a specific client
   */
  private sendCurrentState(client: OBSClient): void {
    try {
      if (this.currentModelInfo) {
        this.sendToClient(client, {
          type: 'modelUpdate',
          modelInfo: this.currentModelInfo
        });
      }

      if (this.currentExpression) {
        this.sendToClient(client, {
          type: 'expressionUpdate',
          expression: this.currentExpression
        });
      }
    } catch (error) {
      console.error('Failed to send current state:', error);
    }
  }

  /**
   * Send a message to a specific client
   */
  private sendToClient(client: OBSClient, message: OBSMessage): void {
    if (client.connected && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to client ${client.id}:`, error);
        client.connected = false;
        this.clients.delete(client.id);
      }
    }
  }

  /**
   * Broadcast a message to all connected clients
   */
  private broadcast(message: OBSMessage): void {
    const clientsToRemove: string[] = [];

    for (const [clientId, client] of this.clients) {
      if (client.connected && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Failed to broadcast to client ${clientId}:`, error);
          clientsToRemove.push(clientId);
        }
      } else {
        clientsToRemove.push(clientId);
      }
    }

    // Clean up disconnected clients
    for (const clientId of clientsToRemove) {
      this.clients.delete(clientId);
    }
  }

  /**
   * Update the Live2D model information and broadcast to clients
   */
  updateModel(modelInfo: any): void {
    this.currentModelInfo = modelInfo;
    
    if (this.isRunning) {
      this.broadcast({
        type: 'modelUpdate',
        modelInfo
      });
    }
  }

  /**
   * Update motion and broadcast to clients
   */
  updateMotion(group: string, index?: number, priority?: number): void {
    if (this.isRunning) {
      this.broadcast({
        type: 'motionUpdate',
        motionData: { group, index, priority }
      });
    }
  }

  /**
   * Update expression and broadcast to clients
   */
  updateExpression(expression: string | number): void {
    this.currentExpression = expression;
    
    if (this.isRunning) {
      this.broadcast({
        type: 'expressionUpdate',
        expression
      });
    }
  }

  /**
   * Update audio data for lip sync and broadcast to clients
   */
  updateAudio(volume: number, frequency?: number): void {
    if (this.isRunning) {
      this.broadcast({
        type: 'audioData',
        audioData: {
          volume,
          frequency,
          timestamp: Date.now()
        }
      });
    }
  }

  /**
   * Get connected clients information
   */
  getConnectedClients(): OBSClient[] {
    return Array.from(this.clients.values()).filter(client => client.connected);
  }

  /**
   * Get connection statistics
   */
  getStats(): { totalClients: number; obsClients: number; browserClients: number } {
    const clients = this.getConnectedClients();
    return {
      totalClients: clients.length,
      obsClients: clients.filter(c => c.source === 'obs').length,
      browserClients: clients.filter(c => c.source === 'browser').length
    };
  }

  /**
   * Check if the service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Setup heartbeat to detect disconnected clients
   */
  private setupHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const clientsToRemove: string[] = [];

      for (const [clientId, client] of this.clients) {
        if (client.connected && client.ws.readyState === WebSocket.OPEN) {
          // Check if client hasn't responded to ping in 30 seconds
          if (now - client.lastPing > 30000) {
            console.log(`⏰ Client ${clientId} timed out`);
            clientsToRemove.push(clientId);
            client.ws.close(1000, 'Ping timeout');
          } else {
            // Send ping
            try {
              client.ws.ping();
            } catch (error) {
              console.error(`Failed to ping client ${clientId}:`, error);
              clientsToRemove.push(clientId);
            }
          }
        } else {
          clientsToRemove.push(clientId);
        }
      }

      // Remove disconnected clients
      for (const clientId of clientsToRemove) {
        this.clients.delete(clientId);
      }
    }, 15000); // Check every 15 seconds
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let obsSyncService: OBSSyncService | null = null;

export function getOBSSyncService(): OBSSyncService {
  if (!obsSyncService) {
    obsSyncService = new OBSSyncService();
  }
  return obsSyncService;
}

export function destroyOBSSyncService(): void {
  if (obsSyncService) {
    obsSyncService.stop();
    obsSyncService = null;
  }
}