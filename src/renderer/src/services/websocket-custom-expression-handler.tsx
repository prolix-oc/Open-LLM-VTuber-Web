// src/renderer/src/services/websocket-custom-expression-handler.tsx
import { customExpressionManager } from './custom-expression-manager';

/**
 * Custom Expression WebSocket Message Types
 */
export interface CustomExpressionMessage {
  type: 'custom_expression';
  name: string;
  intensity?: number;
  transition_duration?: number;
}

export interface ExpressionListMessage {
  type: 'expression_list_request';
}

export interface ExpressionListResponse {
  type: 'expression_list_response';
  expressions: string[];
  model_name?: string;
  cdi3_enhanced?: boolean;
}

export interface ExpressionCapabilitiesMessage {
  type: 'expression_capabilities_request';
}

export interface ExpressionCapabilitiesResponse {
  type: 'expression_capabilities_response';
  capabilities: {
    custom_expressions: boolean;
    cdi3_enhanced: boolean;
    total_parameters: number;
    expression_parameters: number;
    available_expressions: string[];
    model_name?: string;
  };
}

/**
 * Enhanced WebSocket Service with Custom Expression Support
 */
export class CustomExpressionWebSocketHandler {
  private static instance: CustomExpressionWebSocketHandler;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  private constructor() {
    this.setupMessageHandlers();
  }

  static getInstance(): CustomExpressionWebSocketHandler {
    if (!CustomExpressionWebSocketHandler.instance) {
      CustomExpressionWebSocketHandler.instance = new CustomExpressionWebSocketHandler();
    }
    return CustomExpressionWebSocketHandler.instance;
  }

  /**
   * Set up default message handlers for custom expressions
   */
  private setupMessageHandlers(): void {
    // Handle custom expression application
    this.messageHandlers.set('custom_expression', async (data: CustomExpressionMessage) => {
      try {
        const { name, intensity = 1.0, transition_duration = 1000 } = data;
        
        console.log(`🎭 Received custom expression command: ${name} (intensity: ${intensity})`);
        
        if (!customExpressionManager.isReady()) {
          console.warn('⚠️ Custom expression manager not ready');
          return;
        }

        const success = await customExpressionManager.applyCustomExpression(
          name, 
          intensity, 
          transition_duration
        );

        if (success) {
          console.log(`✅ Applied custom expression: ${name}`);
          this.sendResponse({
            type: 'custom_expression_response',
            success: true,
            expression: name,
            intensity,
            transition_duration,
          });
        } else {
          console.warn(`❌ Failed to apply custom expression: ${name}`);
          this.sendResponse({
            type: 'custom_expression_response',
            success: false,
            expression: name,
            error: 'Expression not found or failed to apply',
          });
        }
      } catch (error) {
        console.error('Failed to handle custom expression:', error);
        this.sendResponse({
          type: 'custom_expression_response',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Handle expression list requests
    this.messageHandlers.set('expression_list_request', async () => {
      try {
        console.log('📋 Received expression list request');
        
        if (!customExpressionManager.isReady()) {
          console.warn('⚠️ Custom expression manager not ready');
          this.sendResponse({
            type: 'expression_list_response',
            expressions: [],
            error: 'Custom expression manager not ready',
          });
          return;
        }

        const expressions = customExpressionManager.getEnabledExpressionNames();
        const stats = customExpressionManager.getParameterStatistics();
        
        const response: ExpressionListResponse = {
          type: 'expression_list_response',
          expressions,
          model_name: stats.total > 0 ? 'current_model' : undefined,
          cdi3_enhanced: stats.cdi3Enhanced,
        };

        console.log(`📋 Sending ${expressions.length} available expressions`);
        this.sendResponse(response);
      } catch (error) {
        console.error('Failed to handle expression list request:', error);
        this.sendResponse({
          type: 'expression_list_response',
          expressions: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Handle expression capabilities requests
    this.messageHandlers.set('expression_capabilities_request', async () => {
      try {
        console.log('🔍 Received expression capabilities request');
        
        if (!customExpressionManager.isReady()) {
          console.warn('⚠️ Custom expression manager not ready');
          this.sendResponse({
            type: 'expression_capabilities_response',
            capabilities: {
              custom_expressions: false,
              cdi3_enhanced: false,
              total_parameters: 0,
              expression_parameters: 0,
              available_expressions: [],
            },
          });
          return;
        }

        const stats = customExpressionManager.getParameterStatistics();
        const expressions = customExpressionManager.getEnabledExpressionNames();
        
        const response: ExpressionCapabilitiesResponse = {
          type: 'expression_capabilities_response',
          capabilities: {
            custom_expressions: true,
            cdi3_enhanced: stats.cdi3Enhanced,
            total_parameters: stats.total,
            expression_parameters: stats.expressionRelated,
            available_expressions: expressions,
            model_name: stats.total > 0 ? 'current_model' : undefined,
          },
        };

        console.log('🔍 Sending expression capabilities:', response.capabilities);
        this.sendResponse(response);
      } catch (error) {
        console.error('Failed to handle expression capabilities request:', error);
        this.sendResponse({
          type: 'expression_capabilities_response',
          capabilities: {
            custom_expressions: false,
            cdi3_enhanced: false,
            total_parameters: 0,
            expression_parameters: 0,
            available_expressions: [],
          },
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Handle reset to default expression
    this.messageHandlers.set('reset_expression', async () => {
      try {
        console.log('🔄 Received reset expression command');
        
        if (!customExpressionManager.isReady()) {
          console.warn('⚠️ Custom expression manager not ready');
          return;
        }

        await customExpressionManager.resetToDefault();
        
        console.log('✅ Reset to default expression');
        this.sendResponse({
          type: 'reset_expression_response',
          success: true,
        });
      } catch (error) {
        console.error('Failed to reset expression:', error);
        this.sendResponse({
          type: 'reset_expression_response',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  /**
   * Set WebSocket instance
   */
  setWebSocket(ws: WebSocket | null): void {
    this.ws = ws;
    this.isConnected = ws !== null && ws.readyState === WebSocket.OPEN;
    
    if (ws) {
      console.log('🔌 Custom expression WebSocket handler connected');
      
      // Send initial capabilities when connected
      setTimeout(() => {
        this.notifyCapabilities();
      }, 1000);
    } else {
      console.log('🔌 Custom expression WebSocket handler disconnected');
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(data: any): boolean {
    if (!data || typeof data !== 'object' || !data.type) {
      return false;
    }

    const handler = this.messageHandlers.get(data.type);
    if (handler) {
      console.log(`📨 Handling custom expression message: ${data.type}`);
      handler(data);
      return true;
    }

    return false;
  }

  /**
   * Send response message
   */
  private sendResponse(data: any): void {
    if (!this.ws || !this.isConnected) {
      console.warn('⚠️ Cannot send response: WebSocket not connected');
      return;
    }

    try {
      this.ws.send(JSON.stringify(data));
      console.log(`📤 Sent response: ${data.type}`);
    } catch (error) {
      console.error('Failed to send WebSocket response:', error);
    }
  }

  /**
   * Notify backend of current expression capabilities
   */
  notifyCapabilities(): void {
    if (!this.isConnected) {
      return;
    }

    // Trigger capabilities request to send current state
    this.messageHandlers.get('expression_capabilities_request')?.();
  }

  /**
   * Notify backend when expressions change
   */
  notifyExpressionsChanged(): void {
    if (!this.isConnected) {
      return;
    }

    try {
      const expressions = customExpressionManager.getEnabledExpressionNames();
      const stats = customExpressionManager.getParameterStatistics();
      
      this.sendResponse({
        type: 'expressions_changed',
        expressions,
        count: expressions.length,
        cdi3_enhanced: stats.cdi3Enhanced,
        timestamp: Date.now(),
      });
      
      console.log('📢 Notified backend of expression changes');
    } catch (error) {
      console.error('Failed to notify expression changes:', error);
    }
  }

  /**
   * Send expression test notification
   */
  notifyExpressionTest(expressionName: string, intensity: number): void {
    if (!this.isConnected) {
      return;
    }

    this.sendResponse({
      type: 'expression_test',
      expression: expressionName,
      intensity,
      timestamp: Date.now(),
    });
  }

  /**
   * Send model change notification
   */
  notifyModelChanged(modelName: string, hasCDI3: boolean): void {
    if (!this.isConnected) {
      return;
    }

    this.sendResponse({
      type: 'model_changed',
      model_name: modelName,
      cdi3_enhanced: hasCDI3,
      timestamp: Date.now(),
    });
    
    console.log(`📢 Notified backend of model change: ${modelName}${hasCDI3 ? ' (CDI3)' : ''}`);
    
    // Send updated capabilities after model change
    setTimeout(() => {
      this.notifyCapabilities();
    }, 500);
  }

  /**
   * Get connection status
   */
  isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Register custom message handler
   */
  registerHandler(messageType: string, handler: (data: any) => void): void {
    this.messageHandlers.set(messageType, handler);
    console.log(`📋 Registered custom expression handler: ${messageType}`);
  }

  /**
   * Unregister message handler
   */
  unregisterHandler(messageType: string): void {
    this.messageHandlers.delete(messageType);
    console.log(`📋 Unregistered custom expression handler: ${messageType}`);
  }
}

// Export singleton instance
export const customExpressionWebSocketHandler = CustomExpressionWebSocketHandler.getInstance();

/**
 * Integration with existing WebSocket service
 * This should be added to your existing WebSocket service
 */
export const integrateWithWebSocketService = (existingWebSocketService: any) => {
  const originalHandleMessage = existingWebSocketService.handleMessage?.bind(existingWebSocketService);
  const originalSetWebSocket = existingWebSocketService.setWebSocket?.bind(existingWebSocketService);
  
  // Enhance handleMessage to support custom expressions
  existingWebSocketService.handleMessage = (data: any) => {
    // Try custom expression handler first
    const handled = customExpressionWebSocketHandler.handleMessage(data);
    
    if (!handled && originalHandleMessage) {
      // Fall back to original handler
      return originalHandleMessage(data);
    }
    
    return handled;
  };
  
  // Enhance setWebSocket to notify custom expression handler
  existingWebSocketService.setWebSocket = (ws: WebSocket | null) => {
    if (originalSetWebSocket) {
      originalSetWebSocket(ws);
    }
    
    // Notify custom expression handler
    customExpressionWebSocketHandler.setWebSocket(ws);
  };
  
  console.log('🔗 Integrated custom expression WebSocket handler with existing service');
};

/**
 * Example usage in existing WebSocket service:
 * 
 * import { customExpressionWebSocketHandler, integrateWithWebSocketService } from './websocket-custom-expression-handler';
 * 
 * // In your WebSocket service initialization:
 * integrateWithWebSocketService(yourExistingWebSocketService);
 * 
 * // Or manually integrate:
 * const handleIncomingMessage = (data: any) => {
 *   // Try custom expression handler first
 *   const handled = customExpressionWebSocketHandler.handleMessage(data);
 *   
 *   if (!handled) {
 *     // Handle other message types
 *     switch (data.type) {
 *       // ... your existing handlers
 *     }
 *   }
 * };
 */