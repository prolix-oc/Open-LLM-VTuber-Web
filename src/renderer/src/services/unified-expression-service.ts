// src/renderer/src/services/unified-expression-service.ts
import { Live2DModel } from "pixi-live2d-display-lipsyncpatch";
import { customExpressionManager } from "./custom-expression-manager";
import { EnhancedExpressionManager, ExpressionBlendMode } from "./enhanced-expression-manager";

/**
 * Unified expression information that combines model and custom expressions
 */
export interface UnifiedExpressionInfo {
  /** Expression name */
  name: string;
  /** Display name (includes [Custom] prefix if custom) */
  displayName: string;
  /** Expression index (for model expressions) */
  index: number;
  /** Whether this is a custom expression */
  isCustom: boolean;
  /** Whether this expression uses numeric indexing */
  isNumeric: boolean;
  /** Custom expression ID (if custom) */
  customExpressionId?: string;
  /** Whether this expression is enabled */
  enabled: boolean;
  /** Expression description */
  description?: string;
  /** Parameter count (for custom expressions) */
  parameterCount?: number;
}

/**
 * Statistics about available expressions
 */
export interface UnifiedExpressionStatistics {
  /** Total number of expressions */
  total: number;
  /** Number of model expressions */
  model: number;
  /** Number of custom expressions */
  custom: number;
  /** Number of enabled custom expressions */
  customEnabled: number;
  /** Whether any custom expressions exist */
  hasCustom: boolean;
  /** Whether any model expressions exist */
  hasModel: boolean;
  /** Whether enhanced expression manager is available */
  hasEnhanced: boolean;
}

/**
 * Options for expression application
 */
export interface ExpressionApplicationOptions {
  /** Expression intensity (0.0 to 1.0) */
  intensity?: number;
  /** Transition duration in milliseconds */
  transitionDuration?: number;
  /** Blend mode for enhanced expressions */
  blendMode?: ExpressionBlendMode;
  /** Whether to show notifications */
  showNotifications?: boolean;
  /** Debug mode */
  debugMode?: boolean;
}

/**
 * Unified Expression Service
 * Provides a single interface for working with both model and custom expressions
 */
export class UnifiedExpressionService {
  private static instance: UnifiedExpressionService;
  private model: Live2DModel | null = null;
  private enhancedManager: EnhancedExpressionManager | null = null;
  private modelName: string | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): UnifiedExpressionService {
    if (!UnifiedExpressionService.instance) {
      UnifiedExpressionService.instance = new UnifiedExpressionService();
    }
    return UnifiedExpressionService.instance;
  }

  /**
   * Initialize the service with a Live2D model
   */
  async initialize(model: Live2DModel, modelName: string, modelPath?: string): Promise<void> {
    try {
      console.log(`🎭 Initializing unified expression service for: ${modelName}`);
      
      this.model = model;
      this.modelName = modelName;

      // Initialize enhanced expression manager if available
      if (this.hasEnhancedManager()) {
        this.enhancedManager = new EnhancedExpressionManager(model);
      }

      // Ensure custom expression manager is initialized
      if (!customExpressionManager.isReady()) {
        await customExpressionManager.initialize(model, modelName, modelPath);
      }

      this.isInitialized = true;
      console.log(`✅ Unified expression service initialized for ${modelName}`);
    } catch (error) {
      console.error('Failed to initialize unified expression service:', error);
      throw error;
    }
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.model !== null && this.modelName !== null;
  }

  /**
   * Check if enhanced expression manager is available
   */
  hasEnhancedManager(): boolean {
    return !!(window as any).live2d?.enhancedExpression;
  }

  /**
   * Discover all available model expressions
   */
  private async discoverModelExpressions(): Promise<UnifiedExpressionInfo[]> {
    if (!this.model) return [];

    const modelExpressions: UnifiedExpressionInfo[] = [];

    try {
      // Try enhanced expression manager first
      if (this.enhancedManager) {
        const enhancedExprs = this.enhancedManager.getExpressions();
        enhancedExprs.forEach((expr) => {
          modelExpressions.push({
            name: expr.name,
            displayName: expr.name,
            index: expr.index,
            isCustom: false,
            isNumeric: false,
            enabled: true,
            description: `Model expression with ${expr.parameters.length} parameters`,
            parameterCount: expr.parameters.length
          });
        });
        return modelExpressions;
      }

      // Fallback to global API
      const expressions = (window as any).live2d?.getExpressions?.();
      if (expressions && Array.isArray(expressions)) {
        expressions.forEach((name: string, index: number) => {
          modelExpressions.push({
            name,
            displayName: name,
            index,
            isCustom: false,
            isNumeric: false,
            enabled: true
          });
        });
        return modelExpressions;
      }

      // Try to access expressions directly from model
      const expressionManager = this.model.internalModel?.motionManager?.expressionManager;
      if (expressionManager?.definitions) {
        expressionManager.definitions.forEach((def: any, index: number) => {
          const name = def.name || `Expression ${index}`;
          modelExpressions.push({
            name,
            displayName: name,
            index,
            isCustom: false,
            isNumeric: false,
            enabled: true
          });
        });
        return modelExpressions;
      }

      // Last resort: numeric expressions
      for (let i = 0; i < 10; i++) {
        modelExpressions.push({
          name: `Expression ${i}`,
          displayName: `Expression ${i}`,
          index: i,
          isCustom: false,
          isNumeric: true,
          enabled: true
        });
      }

      return modelExpressions;
    } catch (error) {
      console.warn('Failed to discover model expressions:', error);
      return [];
    }
  }

  /**
   * Discover all available custom expressions
   */
  private discoverCustomExpressions(): UnifiedExpressionInfo[] {
    if (!customExpressionManager.isReady()) {
      return [];
    }

    const customExprs = customExpressionManager.getCustomExpressions();
    return customExprs.map((expr) => ({
      name: expr.name,
      displayName: `[Custom] ${expr.name}`,
      index: -1, // Custom expressions don't have model indices
      isCustom: true,
      isNumeric: false,
      customExpressionId: expr.id,
      enabled: expr.enabled,
      description: expr.description,
      parameterCount: expr.parameters.length
    }));
  }

  /**
   * Get all available expressions (both model and custom)
   */
  async getAllExpressions(includeDisabled: boolean = false): Promise<UnifiedExpressionInfo[]> {
    if (!this.isReady()) {
      throw new Error('Unified expression service not initialized');
    }

    const modelExprs = await this.discoverModelExpressions();
    const customExprs = this.discoverCustomExpressions();

    // Filter disabled expressions if requested
    const filteredCustomExprs = includeDisabled 
      ? customExprs 
      : customExprs.filter(expr => expr.enabled);

    return [...modelExprs, ...filteredCustomExprs];
  }

  /**
   * Get expression statistics
   */
  async getStatistics(): Promise<UnifiedExpressionStatistics> {
    const allExpressions = await this.getAllExpressions(true); // Include disabled for accurate count
    const enabledCustom = allExpressions.filter(expr => expr.isCustom && expr.enabled);
    
    return {
      total: allExpressions.filter(expr => !expr.isCustom || expr.enabled).length,
      model: allExpressions.filter(expr => !expr.isCustom).length,
      custom: allExpressions.filter(expr => expr.isCustom).length,
      customEnabled: enabledCustom.length,
      hasCustom: allExpressions.some(expr => expr.isCustom),
      hasModel: allExpressions.some(expr => !expr.isCustom),
      hasEnhanced: this.hasEnhancedManager()
    };
  }

  /**
   * Apply an expression by name or index
   */
  async applyExpression(
    expressionIdentifier: string | number,
    options: ExpressionApplicationOptions = {}
  ): Promise<boolean> {
    if (!this.isReady()) {
      throw new Error('Unified expression service not initialized');
    }

    const {
      intensity = 1.0,
      transitionDuration = 0,
      blendMode = ExpressionBlendMode.OVERWRITE,
      debugMode = false
    } = options;

    try {
      // Find the expression
      const allExpressions = await this.getAllExpressions();
      let targetExpression: UnifiedExpressionInfo | undefined;

      if (typeof expressionIdentifier === 'string') {
        // Look for exact name match first, then display name match
        targetExpression = allExpressions.find(expr => 
          expr.name === expressionIdentifier || expr.displayName === expressionIdentifier
        );
      } else {
        // Apply by index in the unified list
        targetExpression = allExpressions[expressionIdentifier];
      }

      if (!targetExpression) {
        console.warn(`Expression not found: ${expressionIdentifier}`);
        return false;
      }

      if (debugMode) {
        console.log(`🎭 Applying unified expression: ${targetExpression.displayName}`, {
          isCustom: targetExpression.isCustom,
          intensity,
          transitionDuration
        });
      }

      // Apply the expression based on its type
      if (targetExpression.isCustom && targetExpression.customExpressionId) {
        return await customExpressionManager.applyCustomExpression(
          targetExpression.name,
          intensity,
          transitionDuration
        );
      } else {
        // Apply model expression
        return await this.applyModelExpression(
          targetExpression.isNumeric ? targetExpression.index : targetExpression.name,
          intensity,
          transitionDuration,
          blendMode
        );
      }
    } catch (error) {
      console.error('Failed to apply expression:', error);
      return false;
    }
  }

  /**
   * Apply a model expression
   */
  private async applyModelExpression(
    expression: string | number,
    intensity: number,
    transitionDuration: number,
    blendMode: ExpressionBlendMode
  ): Promise<boolean> {
    if (!this.model) return false;

    try {
      // Try enhanced manager first
      if (this.enhancedManager && typeof expression === 'string') {
        await this.enhancedManager.setExpression(
          expression,
          intensity,
          transitionDuration,
          blendMode
        );
        return true;
      }

      // Try global API
      if ((window as any).live2d?.setExpression) {
        (window as any).live2d.setExpression(expression);
        return true;
      }

      // Try model API
      if (this.model.expression) {
        await this.model.expression(expression);
        return true;
      }

      // Direct expression manager access
      const expressionManager = this.model.internalModel?.motionManager?.expressionManager;
      if (expressionManager?.setExpression) {
        expressionManager.setExpression(expression);
        return true;
      }

      console.warn('No expression API available');
      return false;
    } catch (error) {
      console.error('Failed to apply model expression:', error);
      return false;
    }
  }

  /**
   * Reset all expressions to default
   */
  async resetToDefault(): Promise<void> {
    if (!this.isReady()) return;

    try {
      // Reset enhanced manager if available
      if (this.enhancedManager) {
        this.enhancedManager.resetExpression();
      }

      // Reset custom expressions
      if (customExpressionManager.isReady()) {
        await customExpressionManager.resetToDefault();
      }

      console.log('🔄 Reset all expressions to default');
    } catch (error) {
      console.error('Failed to reset expressions:', error);
    }
  }

  /**
   * Get expression by name
   */
  async getExpressionByName(name: string): Promise<UnifiedExpressionInfo | null> {
    const allExpressions = await this.getAllExpressions();
    return allExpressions.find(expr => 
      expr.name === name || expr.displayName === name
    ) || null;
  }

  /**
   * Get expression by index in unified list
   */
  async getExpressionByIndex(index: number): Promise<UnifiedExpressionInfo | null> {
    const allExpressions = await this.getAllExpressions();
    return allExpressions[index] || null;
  }

  /**
   * Search expressions by name or description
   */
  async searchExpressions(query: string): Promise<UnifiedExpressionInfo[]> {
    const allExpressions = await this.getAllExpressions();
    const lowerQuery = query.toLowerCase();

    return allExpressions.filter(expr => 
      expr.name.toLowerCase().includes(lowerQuery) ||
      expr.displayName.toLowerCase().includes(lowerQuery) ||
      (expr.description && expr.description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get expressions by type
   */
  async getExpressionsByType(type: 'model' | 'custom' | 'all' = 'all'): Promise<UnifiedExpressionInfo[]> {
    const allExpressions = await this.getAllExpressions();

    switch (type) {
      case 'model':
        return allExpressions.filter(expr => !expr.isCustom);
      case 'custom':
        return allExpressions.filter(expr => expr.isCustom);
      case 'all':
      default:
        return allExpressions;
    }
  }

  /**
   * Refresh expression lists
   */
  async refresh(): Promise<void> {
    if (!this.isReady()) return;

    try {
      // Refresh custom expressions
      if (customExpressionManager.isReady()) {
        // Custom expressions are automatically refreshed when accessed
      }

      // Refresh enhanced manager
      if (this.enhancedManager) {
        this.enhancedManager.setModel(this.model!);
      }

      console.log('🔄 Refreshed unified expression service');
    } catch (error) {
      console.error('Failed to refresh expressions:', error);
    }
  }

  /**
   * Export configuration for the current model
   */
  exportConfiguration(): string | null {
    if (!this.isReady() || !this.modelName) return null;

    try {
      const customConfig = customExpressionManager.isReady() 
        ? customExpressionManager.getCurrentConfig()
        : null;

      const exportData = {
        modelName: this.modelName,
        exportedAt: new Date().toISOString(),
        customExpressions: customConfig,
        hasEnhancedManager: this.hasEnhancedManager(),
        version: '1.0'
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export configuration:', error);
      return null;
    }
  }

  /**
   * Import configuration
   */
  async importConfiguration(jsonData: string, merge: boolean = false): Promise<boolean> {
    if (!this.isReady()) return false;

    try {
      const importData = JSON.parse(jsonData);
      
      if (importData.customExpressions && customExpressionManager.isReady()) {
        const customExpressionsJson = JSON.stringify(importData.customExpressions);
        return await customExpressionManager.importCustomExpressions(customExpressionsJson, merge);
      }

      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.model = null;
    this.enhancedManager = null;
    this.modelName = null;
    this.isInitialized = false;
    console.log('🧹 Unified expression service cleaned up');
  }
}

// Export singleton instance
export const unifiedExpressionService = UnifiedExpressionService.getInstance();