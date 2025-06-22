// src/renderer/src/hooks/utils/use-custom-expressions.ts - FIXED VERSION
import { useState, useCallback, useEffect, useRef } from 'react';
import { useLive2DModel } from '@/context/live2d-model-context';
import { useLive2DConfig } from '@/context/live2d-config-context';
import { toaster } from '@/components/ui/toaster';
import {
  CustomExpressionMapping,
  CreateCustomExpressionRequest,
  ModelParameter,
  CustomExpressionConfig,
} from '@/types/custom-expression-types';
import { customExpressionManager } from '@/services/custom-expression-manager';
import { parameterDiscoveryService } from '@/services/parameter-discovery-service';
import { persistentParameterService } from '@/services/persistent-parameter-service';

interface UseCustomExpressionsOptions {
  /** Whether to show toast notifications */
  showNotifications?: boolean;
  /** Whether to auto-refresh when model changes */
  autoRefresh?: boolean;
  /** Debug mode for detailed logging */
  debugMode?: boolean;
}

interface CustomExpressionStatistics {
  total: number;
  expressionRelated: number;
  cdi3Enhanced: boolean;
  cdi3Parameters: number;
  customExpressions: number;
  enabledExpressions: number;
  byCategory: Record<string, number>;
  // Fixed implementation status
  activeExpression: string | null;
  persistentParametersActive: boolean;
  systemReady: boolean;
}

/**
 * FIXED Custom expressions hook using the corrected persistent parameter implementation
 * 
 * This version properly integrates with the persistentParameterService to solve
 * the Live2D parameter persistence issue.
 */
export const useCustomExpressions = (options: UseCustomExpressionsOptions = {}) => {
  const {
    showNotifications = true,
    autoRefresh = true,
    debugMode = false
  } = options;

  const { currentModel } = useLive2DModel();
  const { modelInfo, updateCustomExpressions } = useLive2DConfig();

  // State
  const [customExpressions, setCustomExpressions] = useState<CustomExpressionMapping[]>([]);
  const [availableParameters, setAvailableParameters] = useState<ModelParameter[]>([]);
  const [categorizedParameters, setCategorizedParameters] = useState<Record<string, ModelParameter[]>>({});
  const [expressionParameters, setExpressionParameters] = useState<ModelParameter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [statistics, setStatistics] = useState<CustomExpressionStatistics | null>(null);

  // Refs to prevent infinite loops and track state
  const initializationRef = useRef<string | null>(null);
  const lastModelNameRef = useRef<string | null>(null);
  const initializationTimeoutRef = useRef<number | null>(null);

  /**
   * Check if the system is ready for expression application
   */
  const isSystemReady = useCallback((): boolean => {
    return !!(
      currentModel &&
      modelInfo?.name &&
      customExpressionManager.isReady()
    );
  }, [currentModel, modelInfo?.name]);

  /**
   * Initialize the custom expression system with FIXED implementation
   */
  const initialize = useCallback(async () => {
    if (!currentModel || !modelInfo?.name) {
      return false;
    }

    // Prevent duplicate initialization for the same model
    if (initializationRef.current === modelInfo.name) {
      return true;
    }

    try {
      setIsLoading(true);
      
      if (debugMode) {
        console.log(`🎭 FIXED: Initializing custom expressions for ${modelInfo.name}`);
      }

      // FIXED: Initialize the custom expression manager (which handles persistent parameter service)
      await customExpressionManager.initialize(
        currentModel, 
        modelInfo.name,
        modelInfo.isLocal ? modelInfo.localModelPath : undefined
      );

      // Load expressions and parameters
      const expressions = customExpressionManager.getCustomExpressions();
      const allParams = customExpressionManager.getAvailableParameters();
      const exprParams = customExpressionManager.getExpressionParameters();
      const categorized = customExpressionManager.getParametersByCategory();
      const stats = customExpressionManager.getParameterStatistics();

      // Get active expression info
      const activeExpr = customExpressionManager.getActiveExpression();
      const persistentInfo = currentModel ? persistentParameterService.getModelInfo(currentModel) : null;

      // Update state
      setCustomExpressions(expressions);
      setAvailableParameters(allParams);
      setExpressionParameters(exprParams);
      setCategorizedParameters(categorized);
      setStatistics({
        ...stats,
        activeExpression: activeExpr?.name || null,
        persistentParametersActive: !!persistentInfo,
        systemReady: true,
        cdi3Parameters: stats.cdi3Enhanced ? allParams.filter(p => p.isExpressionParameter).length : 0,
        byCategory: Object.fromEntries(
          Object.entries(categorized).map(([cat, params]) => [cat, params.length])
        )
      });
      setIsInitialized(true);
      initializationRef.current = modelInfo.name;
      lastModelNameRef.current = modelInfo.name;

      if (debugMode) {
        console.log(`✅ FIXED: Custom expressions initialized: ${expressions.length} expressions, ${allParams.length} parameters`);
        console.log(`🔧 Persistent parameter service: ${persistentInfo ? 'Active' : 'Inactive'}`);
        console.log(`🎯 Active expression: ${activeExpr?.name || 'None'}`);
      }

      // Show enhancement notifications
      if (stats.cdi3Enhanced && showNotifications) {
        toaster.create({
          title: 'CDI3 Enhanced Model',
          description: `Loaded with ${allParams.length} parameters`,
          type: 'info',
          duration: 4000,
        });
      }

      return true;
    } catch (error) {
      console.error('FIXED: Failed to initialize custom expressions:', error);
      if (showNotifications) {
        toaster.create({
          title: 'Initialization Failed',
          description: 'Failed to initialize custom expressions',
          type: 'error',
          duration: 3000,
        });
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentModel, modelInfo?.name, modelInfo?.localModelPath, debugMode, showNotifications]);

  /**
   * Refresh custom expressions and parameters from the manager
   */
  const refresh = useCallback(async () => {
    if (!isInitialized || !modelInfo?.name) {
      return;
    }

    try {
      setIsLoading(true);

      const expressions = customExpressionManager.getCustomExpressions();
      const allParams = customExpressionManager.getAvailableParameters();
      const exprParams = customExpressionManager.getExpressionParameters();
      const categorized = customExpressionManager.getParametersByCategory();
      const stats = customExpressionManager.getParameterStatistics();

      // Get runtime state
      const activeExpr = customExpressionManager.getActiveExpression();
      const persistentInfo = currentModel ? persistentParameterService.getModelInfo(currentModel) : null;

      setCustomExpressions(expressions);
      setAvailableParameters(allParams);
      setExpressionParameters(exprParams);
      setCategorizedParameters(categorized);
      setStatistics({
        ...stats,
        activeExpression: activeExpr?.name || null,
        persistentParametersActive: !!persistentInfo,
        systemReady: customExpressionManager.isReady(),
        cdi3Parameters: stats.cdi3Enhanced ? allParams.filter(p => p.isExpressionParameter).length : 0,
        byCategory: Object.fromEntries(
          Object.entries(categorized).map(([cat, params]) => [cat, params.length])
        )
      });

      if (debugMode) {
        console.log(`🔄 FIXED: Refreshed custom expressions: ${expressions.length} expressions`);
        console.log(`🎯 Active expression: ${activeExpr?.name || 'None'}`);
      }
    } catch (error) {
      console.error('FIXED: Failed to refresh custom expressions:', error);
      if (showNotifications) {
        toaster.create({
          title: 'Refresh Failed',
          description: 'Failed to refresh custom expressions',
          type: 'error',
          duration: 3000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, modelInfo?.name, debugMode, showNotifications, currentModel]);

  /**
   * Test/apply a custom expression using the FIXED persistent system
   */
  const testExpression = useCallback(async (
    name: string, 
    intensity: number = 1.0, 
    transitionDuration: number = 1000
  ): Promise<boolean> => {
    if (!isSystemReady()) {
      console.warn('FIXED: Custom expression system not ready for testing');
      
      if (showNotifications) {
        toaster.create({
          title: 'System Not Ready',
          description: 'Custom expression system is not ready for testing',
          type: 'warning',
          duration: 3000,
        });
      }
      
      return false;
    }

    try {
      if (debugMode) {
        console.log(`🎭 FIXED: Testing expression "${name}" with intensity ${intensity}`);
      }

      const success = await customExpressionManager.applyCustomExpression(name, intensity, transitionDuration);
      
      if (success) {
        // Refresh statistics to show active expression
        await refresh();
        
        if (showNotifications) {
          toaster.create({
            title: 'Expression Applied',
            description: `Testing "${name}" with persistent parameters`,
            type: 'info',
            duration: 2000,
          });
        }

        if (debugMode) {
          const persistentInfo = currentModel ? persistentParameterService.getModelInfo(currentModel) : null;
          console.log(`✅ FIXED: Expression applied successfully. Override count: ${persistentInfo?.overrideCount || 0}`);
        }
      } else {
        if (showNotifications) {
          toaster.create({
            title: 'Expression Failed',
            description: `Failed to apply expression "${name}"`,
            type: 'error',
            duration: 3000,
          });
        }
      }

      return success;
    } catch (error) {
      console.error('FIXED: Failed to test custom expression:', error);
      if (showNotifications) {
        toaster.create({
          title: 'Test Failed',
          description: 'Failed to apply test expression',
          type: 'error',
          duration: 3000,
        });
      }
      return false;
    }
  }, [isSystemReady, showNotifications, debugMode, refresh, currentModel]);

  /**
   * Stop the currently active expression
   */
  const stopActiveExpression = useCallback(async (): Promise<void> => {
    if (!isSystemReady()) return;

    try {
      if (debugMode) {
        console.log('🛑 FIXED: Stopping active expression');
      }

      customExpressionManager.stopActiveExpression();
      await refresh();

      if (showNotifications) {
        toaster.create({
          title: 'Expression Stopped',
          description: 'Active expression has been stopped',
          type: 'info',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('FIXED: Failed to stop active expression:', error);
    }
  }, [isSystemReady, debugMode, refresh, showNotifications]);

  /**
   * Reset all parameters to default
   */
  const resetToDefault = useCallback(async (): Promise<void> => {
    if (!isSystemReady()) return;
    
    try {
      if (debugMode) {
        console.log('🔄 FIXED: Resetting to default with persistent parameter cleanup');
      }

      await customExpressionManager.resetToDefault();
      await refresh();
      
      if (showNotifications) {
        toaster.create({
          title: 'Reset Complete',
          description: 'All parameters reset to default values',
          type: 'info',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('FIXED: Failed to reset:', error);
      if (showNotifications) {
        toaster.create({
          title: 'Reset Failed',
          description: 'Failed to reset parameters',
          type: 'error',
          duration: 3000,
        });
      }
    }
  }, [isSystemReady, debugMode, refresh, showNotifications]);

  /**
   * Create a new custom expression
   */
  const createExpression = useCallback(async (request: CreateCustomExpressionRequest): Promise<CustomExpressionMapping | null> => {
    if (!isInitialized) {
      console.error('FIXED: Custom expressions not initialized');
      return null;
    }

    try {
      const newExpression = await customExpressionManager.createCustomExpression(request);
      
      if (newExpression) {
        await refresh();
        
        const config = customExpressionManager.getCurrentConfig();
        if (config) {
          updateCustomExpressions(config);
        }

        if (showNotifications) {
          toaster.create({
            title: 'Expression Created',
            description: `Custom expression "${request.name}" has been created`,
            type: 'success',
            duration: 2000,
          });
        }
      }

      return newExpression;
    } catch (error) {
      console.error('FIXED: Failed to create custom expression:', error);
      if (showNotifications) {
        toaster.create({
          title: 'Creation Failed',
          description: 'Failed to create custom expression',
          type: 'error',
          duration: 3000,
        });
      }
      return null;
    }
  }, [isInitialized, refresh, updateCustomExpressions, showNotifications]);

  /**
   * Update an existing custom expression
   */
  const updateExpression = useCallback(async (
    id: string, 
    updates: Partial<CreateCustomExpressionRequest>
  ): Promise<boolean> => {
    if (!isInitialized) {
      console.error('FIXED: Custom expressions not initialized');
      return false;
    }

    try {
      const success = await customExpressionManager.updateCustomExpression(id, updates);
      
      if (success) {
        await refresh();
        
        const config = customExpressionManager.getCurrentConfig();
        if (config) {
          updateCustomExpressions(config);
        }

        if (showNotifications) {
          toaster.create({
            title: 'Expression Updated',
            description: `Custom expression has been updated`,
            type: 'success',
            duration: 2000,
          });
        }
      }

      return success;
    } catch (error) {
      console.error('FIXED: Failed to update custom expression:', error);
      if (showNotifications) {
        toaster.create({
          title: 'Update Failed',
          description: 'Failed to update custom expression',
          type: 'error',
          duration: 3000,
        });
      }
      return false;
    }
  }, [isInitialized, refresh, updateCustomExpressions, showNotifications]);

  /**
   * Delete a custom expression
   */
  const deleteExpression = useCallback(async (id: string): Promise<boolean> => {
    if (!isInitialized) {
      console.error('FIXED: Custom expressions not initialized');
      return false;
    }

    try {
      const success = await customExpressionManager.deleteCustomExpression(id);
      
      if (success) {
        await refresh();
        
        const config = customExpressionManager.getCurrentConfig();
        if (config) {
          updateCustomExpressions(config);
        }

        if (showNotifications) {
          toaster.create({
            title: 'Expression Deleted',
            description: 'Custom expression has been deleted',
            type: 'success',
            duration: 2000,
          });
        }
      }

      return success;
    } catch (error) {
      console.error('FIXED: Failed to delete custom expression:', error);
      if (showNotifications) {
        toaster.create({
          title: 'Delete Failed',
          description: 'Failed to delete custom expression',
          type: 'error',
          duration: 3000,
        });
      }
      return false;
    }
  }, [isInitialized, refresh, updateCustomExpressions, showNotifications]);

  /**
   * Get a specific custom expression by name
   */
  const getExpression = useCallback((name: string): CustomExpressionMapping | null => {
    return customExpressions.find(expr => expr.name === name) || null;
  }, [customExpressions]);

  /**
   * Check if an expression name is already taken
   */
  const isNameTaken = useCallback((name: string, excludeId?: string): boolean => {
    return customExpressions.some(expr => expr.name === name && expr.id !== excludeId);
  }, [customExpressions]);

  /**
   * Search parameters with CDI3 support
   */
  const searchParameters = useCallback((query: string): ModelParameter[] => {
    if (!isInitialized) return [];
    return customExpressionManager.searchParameters(query);
  }, [isInitialized]);

  /**
   * Get parameter by ID with CDI3 metadata
   */
  const getParameterById = useCallback((parameterId: string): ModelParameter | null => {
    if (!isInitialized) return null;
    return customExpressionManager.getParameterById(parameterId);
  }, [isInitialized]);

  /**
   * Export custom expressions to JSON
   */
  const exportExpressions = useCallback((): string | null => {
    if (!isInitialized) return null;
    return customExpressionManager.exportCustomExpressions();
  }, [isInitialized]);

  /**
   * Import custom expressions from JSON
   */
  const importExpressions = useCallback(async (jsonData: string, merge: boolean = false): Promise<boolean> => {
    if (!isInitialized) return false;

    try {
      const success = await customExpressionManager.importCustomExpressions(jsonData, merge);
      
      if (success) {
        await refresh();
        
        const config = customExpressionManager.getCurrentConfig();
        if (config) {
          updateCustomExpressions(config);
        }

        if (showNotifications) {
          toaster.create({
            title: 'Import Successful',
            description: 'Custom expressions have been imported',
            type: 'success',
            duration: 2000,
          });
        }
      }

      return success;
    } catch (error) {
      console.error('FIXED: Failed to import custom expressions:', error);
      if (showNotifications) {
        toaster.create({
          title: 'Import Failed',
          description: 'Failed to import custom expressions',
          type: 'error',
          duration: 3000,
        });
      }
      return false;
    }
  }, [isInitialized, refresh, updateCustomExpressions, showNotifications]);

  /**
   * Get expression names for backend communication
   */
  const getExpressionNames = useCallback((): string[] => {
    return customExpressions.filter(expr => expr.enabled).map(expr => expr.name);
  }, [customExpressions]);

  /**
   * Enable or disable an expression
   */
  const setExpressionEnabled = useCallback(async (id: string, enabled: boolean): Promise<boolean> => {
    if (!isInitialized) return false;

    try {
      const success = await customExpressionManager.setExpressionEnabled(id, enabled);
      
      if (success) {
        await refresh();
        
        const config = customExpressionManager.getCurrentConfig();
        if (config) {
          updateCustomExpressions(config);
        }
      }

      return success;
    } catch (error) {
      console.error('FIXED: Failed to set expression enabled state:', error);
      return false;
    }
  }, [isInitialized, refresh, updateCustomExpressions]);

  /**
   * Get parameters grouped by category (CDI3 enhanced)
   */
  const getParametersByCategory = useCallback((): Record<string, ModelParameter[]> => {
    return categorizedParameters;
  }, [categorizedParameters]);

  /**
   * Export enhanced parameter information including CDI3 data
   */
  const exportParameterInfo = useCallback((): string | null => {
    if (!isInitialized || !modelInfo?.name) return null;
    
    return parameterDiscoveryService.exportParametersWithCDI3(modelInfo.name);
  }, [isInitialized, modelInfo?.name]);

  /**
   * Get persistent parameter service statistics
   */
  const getPersistentParameterStats = useCallback(() => {
    return persistentParameterService.getStatistics();
  }, []);

  // Auto-initialize when model changes (with proper guards)
  useEffect(() => {
    // Clear any pending initialization
    if (initializationTimeoutRef.current) {
      clearTimeout(initializationTimeoutRef.current);
      initializationTimeoutRef.current = null;
    }

    if (!autoRefresh || !currentModel || !modelInfo?.name) {
      // Clear state when no model
      if (!modelInfo?.name || lastModelNameRef.current !== modelInfo.name) {
        setIsInitialized(false);
        setCustomExpressions([]);
        setAvailableParameters([]);
        setCategorizedParameters({});
        setExpressionParameters([]);
        setStatistics(null);
        initializationRef.current = null;
        lastModelNameRef.current = null;
      }
      return;
    }

    // Only initialize if model name changed or we're not initialized
    if (lastModelNameRef.current !== modelInfo.name || !isInitialized) {
      // Reset for new model
      if (lastModelNameRef.current !== modelInfo.name) {
        setIsInitialized(false);
        initializationRef.current = null;
      }

      // Set a timeout to initialize - prevents rapid firing
      initializationTimeoutRef.current = window.setTimeout(() => {
        // Double-check conditions before initializing
        if (currentModel && modelInfo?.name && !isInitialized) {
          initialize();
        }
      }, 500);
    }

    return () => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
        initializationTimeoutRef.current = null;
      }
    };
  }, [autoRefresh, currentModel, modelInfo?.name, isInitialized, initialize]);

  return {
    // State
    customExpressions,
    availableParameters,
    categorizedParameters,
    expressionParameters,
    isLoading,
    isInitialized,
    statistics,
    
    // Actions
    initialize,
    refresh,
    createExpression,
    updateExpression,
    deleteExpression,
    testExpression,
    setExpressionEnabled,
    resetToDefault,
    stopActiveExpression,
    
    // Utilities
    getExpression,
    isNameTaken,
    searchParameters,
    getParameterById,
    exportExpressions,
    importExpressions,
    getExpressionNames,
    getParametersByCategory,
    exportParameterInfo,
    getPersistentParameterStats,
    
    // Status properties
    isSystemReady: isSystemReady(),
    hasActiveExpression: !!statistics?.activeExpression,
    activeExpressionName: statistics?.activeExpression,
    isPersistentParametersActive: !!statistics?.persistentParametersActive,
    
    // Computed properties
    hasExpressions: customExpressions.length > 0,
    enabledExpressions: customExpressions.filter(expr => expr.enabled),
    expressionCount: customExpressions.length,
    parameterCount: availableParameters.length,
    expressionParameterCount: expressionParameters.length,
    isCDI3Enhanced: statistics?.cdi3Enhanced || false,
    categories: Object.keys(categorizedParameters),
  };
};