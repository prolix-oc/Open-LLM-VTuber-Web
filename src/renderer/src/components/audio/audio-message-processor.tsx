// src/renderer/src/components/audio/audio-message-processor.tsx
import { useEffect, useRef } from 'react';
import { wsService } from '@/services/websocket-service';
import type { WebSocketMessage } from '@/services/websocket-service';

interface AudioMessageProcessorProps {
  debugMode?: boolean;
}

/**
 * Centralized audio message processor that handles WebSocket messages
 * and routes them to the appropriate audio handlers.
 * 
 * This component should be placed once at the application level to avoid
 * multiple WebSocket subscriptions.
 */
export const AudioMessageProcessor: React.FC<AudioMessageProcessorProps> = ({
  debugMode = false,
}) => {
  
  // Track subscription to prevent multiple subscriptions
  const subscriptionRef = useRef<any>(null);
  const processedMessageIds = useRef<Set<string>>(new Set());
  
  const debug = (...args: any[]) => {
    if (debugMode) {
      console.log('[AudioMessageProcessor]', ...args);
    }
  };

  // Single WebSocket message subscription for the entire application
  useEffect(() => {
    // Prevent multiple subscriptions
    if (subscriptionRef.current) {
      debug('WebSocket subscription already exists, skipping');
      return;
    }

    debug('Setting up centralized WebSocket message subscription');
    
    subscriptionRef.current = wsService.onMessage().subscribe((message: WebSocketMessage) => {
      // Prevent duplicate processing
      const messageId = message.request_id || `${message.type}_${Date.now()}`;
      if (processedMessageIds.current.has(messageId)) {
        debug('Skipping duplicate message:', messageId);
        return;
      }
      
      processedMessageIds.current.add(messageId);
      
      // Clean up old message IDs to prevent memory leaks
      if (processedMessageIds.current.size > 100) {
        const messageIds = Array.from(processedMessageIds.current);
        const toRemove = messageIds.slice(0, 50);
        toRemove.forEach(id => processedMessageIds.current.delete(id));
      }
      
      // Route audio messages to the streamlined handler
      if (message.type === 'audio-url' || message.type === 'audio' || message.type === 'interrupt') {
        debug('Processing audio message:', message.type, messageId);
        
        // Check if streamlined audio handler is available
        const handler = (window as any).streamlinedAudioHandler;
        if (handler && handler.messageHandlers) {
          const messageHandler = handler.messageHandlers[message.type];
          if (messageHandler && typeof messageHandler === 'function') {
            try {
              messageHandler(message);
              debug('Message handled successfully:', message.type);
            } catch (error) {
              console.error('Error handling audio message:', error);
            }
          } else {
            debug('No handler found for message type:', message.type);
          }
        } else {
          debug('Streamlined audio handler not available, queuing message for later');
          
          // Queue message for when handler becomes available
          setTimeout(() => {
            const retryHandler = (window as any).streamlinedAudioHandler;
            if (retryHandler && retryHandler.messageHandlers) {
              const retryMessageHandler = retryHandler.messageHandlers[message.type];
              if (retryMessageHandler && typeof retryMessageHandler === 'function') {
                try {
                  retryMessageHandler(message);
                  debug('Queued message handled successfully:', message.type);
                } catch (error) {
                  console.error('Error handling queued audio message:', error);
                }
              }
            }
          }, 1000);
        }
      } else {
        // Log non-audio messages for debugging
        debug('Non-audio message received:', message.type);
      }
    });

    debug('WebSocket message subscription established');

    // Cleanup function
    return () => {
      debug('Cleaning up WebSocket message subscription');
      
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      
      processedMessageIds.current.clear();
    };
  }, []); // Empty dependency array - this should only run once

  // Monitor handler availability
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const handler = (window as any).streamlinedAudioHandler;
      if (handler) {
        debug('Streamlined audio handler is available:', {
          hasMessageHandlers: !!handler.messageHandlers,
          isPlaying: handler.isPlaying,
          queueSize: handler.queueSize,
        });
      }
    }, 5000);

    return () => clearInterval(checkInterval);
  }, []);

  // Expose processor status for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).audioMessageProcessor = {
        hasSubscription: !!subscriptionRef.current,
        processedMessageCount: processedMessageIds.current.size,
        debug: debug,
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).audioMessageProcessor;
      }
    };
  }, []);

  return null; // This is a headless component
};

export default AudioMessageProcessor;