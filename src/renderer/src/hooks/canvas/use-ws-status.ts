import { useMemo, useCallback, useState, useEffect } from 'react';
import { useEnhancedWebSocket } from '@/context/websocket-context';

interface FixedWSStatusInfo {
  color: string;
  text: string;
  detailedText: string;
  isDisconnected: boolean;
  isConnecting: boolean;
  isAuthenticated: boolean;
  requiresManualAction: boolean;
  canClick: boolean; // FIXED: Indicates whether clicking will do something
  handleClick: () => void;
  connectionInfo: {
    attempts: number;
    maxAttempts: number;
    series: number;
    canAutoReconnect: boolean;
    connectionInProgress: boolean;
    nextAttemptIn?: number;
  };
  connectionStats: {
    connected: boolean;
    reconnectCount: number;
    messagesReceived: number;
    messagesSent: number;
    latency?: number;
    lastConnected?: Date;
  };
  healthScore: number; // 0-100 score based on connection quality
}

interface ConnectionHealth {
  score: number;
  issues: string[];
  recommendations: string[];
}

export const useFixedWSStatus = () => {
  const { 
    wsState, 
    reconnect,
    manualReconnect, // FIXED: Use manual reconnect for user actions
    disconnect,
    connectionStats, 
    isAuthenticated,
    authToken,
    getConnectionInfo,
  } = useEnhancedWebSocket();
  
  const [lastHealthCheck, setLastHealthCheck] = useState<Date>(new Date());
  const [nextAttemptCountdown, setNextAttemptCountdown] = useState<number>(0);
  const [isUserActionInProgress, setIsUserActionInProgress] = useState(false);

  // Get connection attempt information
  const connectionInfo = useMemo(() => {
    return getConnectionInfo ? getConnectionInfo() : {
      attempts: 0,
      maxAttempts: 5,
      series: 0,
      canAutoReconnect: true,
      connectionInProgress: false,
    };
  }, [getConnectionInfo, wsState]);

  // Countdown timer for next reconnection attempt
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (wsState === 'RECONNECTING' && connectionInfo.nextAttemptIn) {
      setNextAttemptCountdown(Math.ceil(connectionInfo.nextAttemptIn / 1000));
      
      interval = setInterval(() => {
        setNextAttemptCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setNextAttemptCountdown(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [wsState, connectionInfo.nextAttemptIn]);

  // Calculate connection health score
  const calculateHealth = useCallback((): ConnectionHealth => {
    let score = 0;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Base score for connection state
    if (wsState === 'OPEN') {
      score += 40;
    } else if (wsState === 'CONNECTING') {
      score += 20;
    } else if (wsState === 'RECONNECTING') {
      score += 10;
    } else if (wsState === 'MANUAL_RETRY_REQUIRED') {
      issues.push('Manual intervention required');
      recommendations.push('Click to retry connection');
    }

    // Authentication score
    if (isAuthenticated) {
      score += 30;
    } else if (authToken) {
      issues.push('Authentication pending');
      recommendations.push('Check auth token validity');
      score += 10;
    } else {
      issues.push('No authentication token');
      recommendations.push('Set authentication token');
    }

    // Latency score
    if (connectionStats.latency !== undefined) {
      if (connectionStats.latency < 100) {
        score += 20; // Excellent latency
      } else if (connectionStats.latency < 300) {
        score += 15; // Good latency
      } else if (connectionStats.latency < 1000) {
        score += 10; // Fair latency
        issues.push('High latency detected');
        recommendations.push('Check network connection');
      } else {
        score += 5; // Poor latency
        issues.push('Very high latency detected');
        recommendations.push('Check network connection and server status');
      }
    } else if (wsState === 'OPEN') {
      score += 10;
    }

    // Connection stability score
    if (connectionInfo.attempts === 0) {
      score += 10; // No reconnection attempts
    } else if (connectionInfo.attempts < 3) {
      score += 5;
      issues.push('Some connection instability');
    } else {
      issues.push('Frequent disconnections detected');
      recommendations.push('Check network stability and server status');
    }

    // Penalty for multiple connection series
    if (connectionInfo.series > 2) {
      score = Math.max(0, score - 10);
      issues.push('Multiple connection series attempted');
      recommendations.push('Consider checking server status or network');
    }

    // Cap score at 100
    score = Math.min(100, score);

    return { score, issues, recommendations };
  }, [wsState, isAuthenticated, authToken, connectionStats, connectionInfo]);

  // Update health check periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setLastHealthCheck(new Date());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // FIXED: Enhanced click handler with proper action detection
  const handleClick = useCallback(async () => {
    // Prevent multiple rapid clicks
    if (isUserActionInProgress) {
      console.log('User action already in progress, ignoring click');
      return;
    }

    setIsUserActionInProgress(true);

    try {
      if (wsState === 'OPEN') {
        // If connected, allow manual disconnect for testing
        console.log('Disconnecting WebSocket via user action');
        await disconnect();
      } else if (wsState === 'MANUAL_RETRY_REQUIRED') {
        // Manual reconnection required - this is the main use case
        console.log('Initiating manual reconnection via user click');
        await manualReconnect();
      } else if (wsState === 'CLOSED' || wsState === 'FAILED') {
        // If disconnected, attempt reconnection
        console.log('Attempting reconnection via user click');
        await reconnect();
      }
      // Don't allow clicking during CONNECTING or RECONNECTING states
    } catch (error) {
      console.error('Failed to handle WebSocket action:', error);
    } finally {
      // Reset the flag after a delay to prevent rapid clicking
      setTimeout(() => {
        setIsUserActionInProgress(false);
      }, 1000);
    }
  }, [wsState, reconnect, manualReconnect, disconnect, isUserActionInProgress]);

  const statusInfo = useMemo((): FixedWSStatusInfo => {
    const health = calculateHealth();
    
    // Determine color based on state and health
    let color: string;
    let text: string;
    let detailedText: string;
    let requiresManualAction = false;
    let canClick = false;

    switch (wsState) {
      case 'OPEN':
        if (isAuthenticated) {
          color = health.score >= 80 ? 'green.500' : health.score >= 60 ? 'yellow.500' : 'orange.500';
          text = 'Connected & Authenticated';
          detailedText = `Connected (Health: ${health.score}%)`;
        } else {
          color = 'yellow.500';
          text = 'Connected (Auth Pending)';
          detailedText = 'Connected but not authenticated';
        }
        canClick = true; // Allow disconnect
        break;
        
      case 'CONNECTING':
        color = 'blue.500';
        text = 'Connecting...';
        detailedText = `Connecting (attempt ${connectionInfo.attempts + 1}/${connectionInfo.maxAttempts})`;
        canClick = false; // Don't allow clicking during connection
        break;
        
      case 'RECONNECTING':
        color = 'orange.500';
        text = nextAttemptCountdown > 0 
          ? `Reconnecting in ${nextAttemptCountdown}s...` 
          : 'Reconnecting...';
        detailedText = `Reconnect attempt ${connectionInfo.attempts}/${connectionInfo.maxAttempts}`;
        canClick = false; // Don't allow clicking during reconnection
        break;
        
      case 'CLOSING':
        color = 'yellow.500';
        text = 'Disconnecting...';
        detailedText = 'Closing connection';
        canClick = false;
        break;

      case 'MANUAL_RETRY_REQUIRED':
        color = 'red.600';
        text = isUserActionInProgress ? 'Retrying...' : 'Click to Retry';
        detailedText = `Failed after ${connectionInfo.maxAttempts} attempts - manual retry required`;
        requiresManualAction = true;
        canClick = !isUserActionInProgress;
        break;
        
      case 'FAILED':
        color = 'red.500';
        text = isUserActionInProgress ? 'Connecting...' : 'Click to Connect';
        detailedText = 'Authentication or connection failed';
        requiresManualAction = true;
        canClick = !isUserActionInProgress;
        break;
        
      default: // CLOSED
        color = 'gray.500';
        text = isUserActionInProgress ? 'Connecting...' : 'Click to Connect';
        detailedText = 'Disconnected';
        canClick = !isUserActionInProgress;
    }

    // Add connection in progress indicator
    if (connectionInfo.connectionInProgress && !isUserActionInProgress) {
      text = 'Connecting...';
      color = 'blue.500';
      canClick = false;
    }

    // Add latency info if available
    if (connectionStats.latency !== undefined && wsState === 'OPEN') {
      detailedText += ` (${connectionStats.latency}ms)`;
    }

    // Add message count info for connected state
    if (wsState === 'OPEN' && (connectionStats.messagesReceived > 0 || connectionStats.messagesSent > 0)) {
      detailedText += ` | ↓${connectionStats.messagesReceived} ↑${connectionStats.messagesSent}`;
    }

    // Add connection series info if multiple attempts
    if (connectionInfo.series > 0) {
      detailedText += ` | Series: ${connectionInfo.series}`;
    }

    return {
      color,
      text,
      detailedText,
      isDisconnected: wsState === 'CLOSED' || wsState === 'FAILED' || wsState === 'MANUAL_RETRY_REQUIRED',
      isConnecting: wsState === 'CONNECTING' || wsState === 'RECONNECTING' || connectionInfo.connectionInProgress,
      isAuthenticated,
      requiresManualAction,
      canClick,
      handleClick,
      connectionInfo,
      connectionStats: {
        ...connectionStats,
        lastConnected: connectionStats.lastConnected,
      },
      healthScore: health.score,
    };
  }, [
    wsState, 
    isAuthenticated, 
    connectionStats, 
    connectionInfo, 
    handleClick, 
    calculateHealth, 
    nextAttemptCountdown,
    isUserActionInProgress
  ]);

  // Additional utility functions
  const getConnectionDuration = useCallback((): string | null => {
    if (!connectionStats.lastConnected || wsState !== 'OPEN') {
      return null;
    }
    
    const duration = Date.now() - connectionStats.lastConnected.getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }, [connectionStats.lastConnected, wsState]);

  const getHealthDetails = useCallback(() => {
    return calculateHealth();
  }, [calculateHealth]);

  const isHealthy = useMemo(() => {
    return statusInfo.healthScore >= 70 && wsState === 'OPEN';
  }, [statusInfo.healthScore, wsState]);

  const needsAttention = useMemo(() => {
    return (
      statusInfo.requiresManualAction || 
      statusInfo.healthScore < 50 || 
      connectionInfo.attempts >= connectionInfo.maxAttempts ||
      connectionInfo.series > 2
    );
  }, [statusInfo.requiresManualAction, statusInfo.healthScore, connectionInfo]);

  // FIXED: Enhanced status message with better guidance
  const getStatusMessage = useCallback((): string => {
    if (wsState === 'MANUAL_RETRY_REQUIRED') {
      return `Connection failed after ${connectionInfo.maxAttempts} attempts. Click the status indicator to retry manually.`;
    }
    
    if (wsState === 'RECONNECTING') {
      const remaining = connectionInfo.maxAttempts - connectionInfo.attempts;
      return `Attempting to reconnect automatically... ${remaining} attempts remaining.`;
    }
    
    if (wsState === 'FAILED') {
      return 'Connection failed. Click the status indicator to try connecting again.';
    }
    
    if (wsState === 'OPEN' && !isAuthenticated) {
      return 'Connected but authentication is pending or failed. Check your auth token.';
    }
    
    if (wsState === 'OPEN' && isAuthenticated) {
      const duration = getConnectionDuration();
      return duration ? `Connected and authenticated for ${duration}` : 'Connected and ready';
    }
    
    if (wsState === 'CLOSED') {
      return 'Disconnected. Click the status indicator to connect.';
    }
    
    return statusInfo.detailedText;
  }, [wsState, connectionInfo, isAuthenticated, getConnectionDuration, statusInfo.detailedText]);

  return {
    ...statusInfo,
    getConnectionDuration,
    getHealthDetails,
    getStatusMessage,
    isHealthy,
    needsAttention,
    lastHealthCheck,
    nextAttemptCountdown,
    isUserActionInProgress, // FIXED: Expose user action state
  };
};

// Export for backward compatibility
export const useWSStatus = useFixedWSStatus;