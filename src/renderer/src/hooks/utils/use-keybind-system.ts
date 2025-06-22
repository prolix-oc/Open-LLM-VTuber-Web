// src/renderer/src/hooks/utils/use-keybind-system.ts - UNIFIED FIX
import { useEffect, useCallback, useRef } from 'react';

export interface KeybindConfig {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description: string;
  category: string;
  handler: (event: KeyboardEvent) => void | Promise<void>;
  preventDefault?: boolean;
  enabled?: boolean;
}

interface UseKeybindSystemOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  debugMode?: boolean;
}

/**
 * UNIFIED: Enhanced model availability checker using global Live2D API
 */
const checkModelAvailability = (): boolean => {
  try {
    // Check unified global Live2D API
    const hasEnhancedAPI = !!(
      (window as any).live2d?.enhancedExpression?.setExpression &&
      (window as any).live2d?.enhancedExpression?.getExpressions
    );
    
    const hasBasicAPI = !!(
      (window as any).live2d?.setExpression &&
      (window as any).live2d?.getExpressions
    );

    return hasEnhancedAPI || hasBasicAPI;
  } catch (error) {
    return false;
  }
};

/**
 * UNIFIED: Enhanced expression availability checker using global Live2D API
 */
const checkExpressionAvailability = (): { hasExpressions: boolean; count: number; types: string[] } => {
  const result = {
    hasExpressions: false,
    count: 0,
    types: [] as string[]
  };

  try {
    // Check enhanced expressions first via global API
    if ((window as any).live2d?.enhancedExpression?.getExpressions) {
      const enhancedExpressions = (window as any).live2d.enhancedExpression.getExpressions();
      if (Array.isArray(enhancedExpressions) && enhancedExpressions.length > 0) {
        result.hasExpressions = true;
        result.count += enhancedExpressions.length;
        result.types.push('enhanced');
      }
    }

    // Check legacy expressions via global API
    if ((window as any).live2d?.getExpressions) {
      const legacyExpressions = (window as any).live2d.getExpressions();
      if (Array.isArray(legacyExpressions) && legacyExpressions.length > 0) {
        result.hasExpressions = true;
        // Don't double count if we already found enhanced expressions
        if (!result.types.includes('enhanced')) {
          result.count += legacyExpressions.length;
        }
        result.types.push('legacy');
      }
    }

    // Check for custom expressions via global custom expression manager
    const customExpressionManager = (window as any).customExpressionManager || 
                                   (window as any).live2d?.customExpressions;
    if (customExpressionManager?.getCustomExpressions) {
      const customExpressions = customExpressionManager.getCustomExpressions();
      if (Array.isArray(customExpressions) && customExpressions.length > 0) {
        result.hasExpressions = true;
        result.count += customExpressions.filter((expr: any) => expr.enabled).length;
        result.types.push('custom');
      }
    }
  } catch (error) {
    console.warn('Error checking expression availability:', error);
  }

  return result;
};

/**
 * UNIFIED: Global keybind system hook for managing application-wide keyboard shortcuts
 * Uses unified global Live2D API for model availability checking
 */
export const useKeybindSystem = (options: UseKeybindSystemOptions = {}) => {
  const {
    enabled = true,
    preventDefault = true,
    debugMode = false
  } = options;

  const keybindsRef = useRef<Map<string, KeybindConfig>>(new Map());
  const activeKeysRef = useRef<Set<string>>(new Set());
  const modelCheckIntervalRef = useRef<number | null>(null);
  const lastModelStatusRef = useRef<boolean>(false);

  /**
   * UNIFIED: Enhanced model availability monitoring using global API
   */
  const monitorModelAvailability = useCallback(() => {
    const hasModel = checkModelAvailability();
    const expressionInfo = checkExpressionAvailability();
    
    if (hasModel !== lastModelStatusRef.current) {
      lastModelStatusRef.current = hasModel;
      
      if (debugMode) {
        console.log('🎭 Unified model availability changed:', {
          hasModel,
          expressionInfo,
          globalAPI: {
            hasLive2D: !!(window as any).live2d,
            hasEnhanced: !!(window as any).live2d?.enhancedExpression,
            hasBasic: !!(window as any).live2d?.setExpression,
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Dispatch a custom event for other hooks to react to model changes
      window.dispatchEvent(new CustomEvent('live2d-model-availability-changed', {
        detail: { 
          available: hasModel, 
          enhanced: !!(window as any).live2d?.enhancedExpression,
          expressionInfo 
        }
      }));
    }
  }, [debugMode]);

  /**
   * UNIFIED: Get current model and expression status for debugging
   */
  const getModelStatus = useCallback(() => {
    const hasModel = checkModelAvailability();
    const expressionInfo = checkExpressionAvailability();
    
    const status = {
      hasModel,
      expressionInfo,
      globalAPI: {
        live2d: !!(window as any).live2d,
        enhancedExpression: !!(window as any).live2d?.enhancedExpression,
        getExpressions: typeof (window as any).live2d?.getExpressions === 'function',
        setExpression: typeof (window as any).live2d?.setExpression === 'function',
        enhancedGetExpressions: typeof (window as any).live2d?.enhancedExpression?.getExpressions === 'function',
        enhancedSetExpression: typeof (window as any).live2d?.enhancedExpression?.setExpression === 'function',
      },
      canvas: {
        exists: !!document.querySelector('#canvas'),
        visible: !!(document.querySelector('#canvas') as HTMLElement)?.offsetParent,
      },
      customExpressions: {
        hasManager: !!(window as any).customExpressionManager,
        hasGlobalManager: !!(window as any).live2d?.customExpressions,
        isReady: typeof (window as any).customExpressionManager?.isReady === 'function' 
                   ? (window as any).customExpressionManager.isReady() 
                   : false,
      }
    };
    
    return status;
  }, []);

  /**
   * Generate a unique key identifier for a keybind configuration
   */
  const generateKeybindId = useCallback((config: Omit<KeybindConfig, 'handler' | 'description' | 'category'>) => {
    const modifiers = [];
    if (config.ctrlKey) modifiers.push('ctrl');
    if (config.altKey) modifiers.push('alt');
    if (config.shiftKey) modifiers.push('shift');
    if (config.metaKey) modifiers.push('meta');
    
    return `${modifiers.join('+')}${modifiers.length > 0 ? '+' : ''}${config.key.toLowerCase()}`;
  }, []);

  /**
   * Register a new keybind
   */
  const registerKeybind = useCallback((config: KeybindConfig) => {
    const id = generateKeybindId(config);
    keybindsRef.current.set(id, { ...config, enabled: config.enabled ?? true });
    
    if (debugMode) {
      console.log(`🎹 Registered keybind: ${id} - ${config.description}`);
    }
    
    return id;
  }, [generateKeybindId, debugMode]);

  /**
   * Unregister a keybind by ID
   */
  const unregisterKeybind = useCallback((id: string) => {
    const removed = keybindsRef.current.delete(id);
    
    if (debugMode && removed) {
      console.log(`🗑️ Unregistered keybind: ${id}`);
    }
    
    return removed;
  }, [debugMode]);

  /**
   * Enable or disable a specific keybind
   */
  const toggleKeybind = useCallback((id: string, enabled?: boolean) => {
    const keybind = keybindsRef.current.get(id);
    if (keybind) {
      keybind.enabled = enabled ?? !keybind.enabled;
      if (debugMode) {
        console.log(`🔄 Toggled keybind ${id}: ${keybind.enabled ? 'enabled' : 'disabled'}`);
      }
      return keybind.enabled;
    }
    return false;
  }, [debugMode]);

  /**
   * Get all registered keybinds grouped by category
   */
  const getKeybindsByCategory = useCallback(() => {
    const categories: Record<string, KeybindConfig[]> = {};
    
    keybindsRef.current.forEach(keybind => {
      if (!categories[keybind.category]) {
        categories[keybind.category] = [];
      }
      categories[keybind.category].push(keybind);
    });
    
    return categories;
  }, []);

  /**
   * UNIFIED: Enhanced keybind handler with better error handling and model checking
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Skip if user is typing in an input field
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const key = event.key.toLowerCase();
    activeKeysRef.current.add(key);

    // Generate the keybind ID for this event
    const keybindId = generateKeybindId({
      key,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
    });

    const keybind = keybindsRef.current.get(keybindId);
    
    if (keybind && keybind.enabled) {
      if (debugMode) {
        console.log(`🎯 Triggered keybind: ${keybindId} - ${keybind.description}`);
        
        // Log unified model status for expression-related keybinds
        if (keybind.category.toLowerCase().includes('expression')) {
          const modelStatus = getModelStatus();
          console.log('🎭 Unified model status for expression keybind:', modelStatus);
        }
      }

      // Prevent default if configured
      if (keybind.preventDefault ?? preventDefault) {
        event.preventDefault();
      }

      // Execute the handler with enhanced error handling
      try {
        const result = keybind.handler(event);
        
        // Handle async handlers
        if (result && typeof result.catch === 'function') {
          result.catch((error: Error) => {
            console.error(`❌ Async error in keybind handler for ${keybindId}:`, error);
            
            // Log additional debug info for expression-related errors
            if (keybind.category.toLowerCase().includes('expression')) {
              console.error('🎭 Expression keybind error context (unified):', {
                keybindId,
                description: keybind.description,
                modelStatus: getModelStatus(),
                error: error.message
              });
            }
          });
        }
      } catch (error) {
        console.error(`❌ Error executing keybind handler for ${keybindId}:`, error);
        
        // Enhanced error logging for expression-related keybinds
        if (keybind.category.toLowerCase().includes('expression')) {
          console.error('🎭 Expression keybind error details (unified):', {
            keybindId,
            description: keybind.description,
            modelStatus: getModelStatus(),
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  }, [enabled, preventDefault, debugMode, generateKeybindId, getModelStatus]);

  /**
   * Handle keyup events to track released keys
   */
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    activeKeysRef.current.delete(key);
  }, []);

  /**
   * Clear active keys on window blur (prevents stuck keys)
   */
  const handleWindowBlur = useCallback(() => {
    activeKeysRef.current.clear();
  }, []);

  // Set up global event listeners
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [enabled, handleKeyDown, handleKeyUp, handleWindowBlur]);

  // UNIFIED: Set up model availability monitoring
  useEffect(() => {
    if (!enabled) return;

    // Initial check
    monitorModelAvailability();

    // Set up periodic monitoring
    modelCheckIntervalRef.current = window.setInterval(monitorModelAvailability, 2000);

    return () => {
      if (modelCheckIntervalRef.current) {
        clearInterval(modelCheckIntervalRef.current);
        modelCheckIntervalRef.current = null;
      }
    };
  }, [enabled, monitorModelAvailability]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      keybindsRef.current.clear();
      activeKeysRef.current.clear();
      
      if (modelCheckIntervalRef.current) {
        clearInterval(modelCheckIntervalRef.current);
        modelCheckIntervalRef.current = null;
      }
    };
  }, []);

  return {
    registerKeybind,
    unregisterKeybind,
    toggleKeybind,
    getKeybindsByCategory,
    getModelStatus,
    checkModelAvailability: () => checkModelAvailability(),
    checkExpressionAvailability: () => checkExpressionAvailability(),
    isEnabled: enabled,
    activeKeys: Array.from(activeKeysRef.current),
  };
};