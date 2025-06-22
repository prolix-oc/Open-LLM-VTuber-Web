// src/renderer/src/services/custom-expression-manager.ts - PRODUCTION READY FIXED VERSION
import { Live2DModel } from "pixi-live2d-display-lipsyncpatch";
import {
  CustomExpressionMapping,
  CustomExpressionParameter,
  CreateCustomExpressionRequest,
  ModelParameter,
  CustomExpressionConfig,
  generateCustomExpressionId,
  validateCustomExpressionMapping,
  DEFAULT_CUSTOM_EXPRESSION_CONFIG,
} from "@/types/custom-expression-types";
import { parameterDiscoveryService } from "./parameter-discovery-service";
import { persistentParameterService } from "./persistent-parameter-service";

/**
 * PRODUCTION-READY CUSTOM EXPRESSION MANAGER - FIXED VERSION
 *
 * This version properly integrates with the persistentParameterService to solve
 * the Live2D parameter persistence issue where MotionManager and ExpressionManager
 * overwrite manual parameter changes every frame.
 *
 * Key fixes:
 * 1. Uses persistentParameterService instead of custom frame callbacks
 * 2. Proper integration with the Live2D update cycle
 * 3. Correct parameter application with persistent overrides
 * 4. Better error handling and cleanup
 */
export class CustomExpressionManager {
  private static instance: CustomExpressionManager;
  private currentModel: Live2DModel | null = null;
  private modelName: string | null = null;
  private modelPath: string | null = null;
  private config: CustomExpressionConfig = {
    ...DEFAULT_CUSTOM_EXPRESSION_CONFIG,
  };
  private isInitialized = false;
  private storageKey = "";

  // Active expression state
  private activeExpression: {
    name: string;
    intensity: number;
    appliedAt: number;
  } | null = null;

  private constructor() {}

  static getInstance(): CustomExpressionManager {
    if (!CustomExpressionManager.instance) {
      CustomExpressionManager.instance = new CustomExpressionManager();
    }
    return CustomExpressionManager.instance;
  }

  /**
   * Initialize the manager with model information
   */
  async initialize(
    model: Live2DModel,
    modelName: string,
    modelPath?: string
  ): Promise<void> {
    try {
      console.log(
        `🎭 FIXED: Initializing custom expression manager for: ${modelName}`
      );

      // Cleanup any previous state
      this.cleanup();

      this.currentModel = model;
      this.modelName = modelName;
      this.modelPath = modelPath || null;
      this.storageKey = `custom_expressions_${modelName}`;

      // --- FIX: Register with the persistent parameter service ---
      const registered = persistentParameterService.registerModel(
        model,
        modelName
      );
      if (!registered) {
        throw new Error(
          "Failed to register model with persistent parameter service"
        );
      }

      // Load existing configuration from storage
      await this.loadConfiguration();

      // Discover parameters with CDI3 support
      await parameterDiscoveryService.discoverParameters(
        model,
        modelName,
        modelPath
      );

      this.isInitialized = true;
      console.log(
        `✅ FIXED: Custom expression manager initialized for ${modelName}`
      );

      // Log enhancement status
      const stats = parameterDiscoveryService.getParameterStatistics(modelName);
      if (stats.cdi3Enhanced) {
        console.log(
          `🎨 CDI3 enhanced: ${stats.cdi3Parameters} CDI3 parameters available`
        );
      }

      // Emit initialization event
      this.emitExpressionsChanged("updated");
    } catch (error) {
      console.error(
        "FIXED: Failed to initialize custom expression manager:",
        error
      );
      throw error;
    }
  }

  /**
   * Enhanced readiness check
   */
  isReady(): boolean {
    return this.isInitialized && !!this.currentModel && !!this.modelName;
  }

  /**
   * Apply custom expression using the FIXED persistent parameter approach
   */
  public async applyCustomExpression(
    name: string,
    intensity: number = 1.0,
    transitionDuration: number = 1000 // Transition duration is handled by the service now
  ): Promise<boolean> {
    console.log(
      `🎭 FIXED: Applying custom expression: ${name} (intensity: ${intensity})`
    );

    if (!this.isReady() || !this.currentModel) {
      console.warn("❌ Custom expression manager not ready");
      return false;
    }

    const expression = this.getCustomExpression(name);
    if (!expression || !expression.enabled) {
      console.warn(`❌ Custom expression not found or disabled: ${name}`);
      return false;
    }

    console.log(`Found expression "${name}" with ${expression.parameters.length} parameters`);

    // --- FIX: Transform parameters to the format expected by persistent parameter service ---
    const parameterOverrides = expression.parameters.map(param => ({
      parameterId: param.parameterId,
      value: param.targetValue,
      weight: param.weight,
      blendMode: param.blendMode
    }));

    // --- FIX: Use the persistent parameter service ---
    const success = persistentParameterService.setExpressionOverrides(
      this.currentModel,
      `custom-expression:${name}`, // Unique source name
      parameterOverrides,
      intensity,
      200 // High priority
    );

    if (success) {
      this.activeExpression = {
        name: expression.name,
        intensity,
        appliedAt: Date.now(),
      };
      console.log(
        `✅ FIXED: Applied custom expression "${name}" with persistent parameter service`
      );
    } else {
      console.error(
        `❌ Failed to apply parameter overrides for expression "${name}"`
      );
    }

    return success;
  }

  /**
   * Reset to default expression
   */
  public async resetToDefault(): Promise<void> {
    console.log("🔄 FIXED: Resetting to default expression...");
    if (!this.isReady() || !this.currentModel) {
      console.warn("Custom expression manager not ready");
      return;
    }

    // --- FIX: Clear all custom expression overrides ---
    if (this.activeExpression) {
      persistentParameterService.clearParameterOverrides(
        this.currentModel,
        `custom-expression:${this.activeExpression.name}`
      );
    }

    // As a safeguard, clear any other custom expression overrides as well
    this.config.expressions.forEach((expr) => {
      persistentParameterService.clearParameterOverrides(
        this.currentModel!,
        `custom-expression:${expr.name}`
      );
    });

    this.activeExpression = null;
    console.log("✅ FIXED: Reset expression completed.");
  }

  public stopActiveExpression(): void {
    if (this.activeExpression && this.currentModel) {
      persistentParameterService.clearParameterOverrides(
        this.currentModel,
        `custom-expression:${this.activeExpression.name}`
      );
    }
    this.activeExpression = null;
  }

  /**
   * Get currently active expression info
   */
  getActiveExpression(): { name: string; intensity: number } | null {
    return this.activeExpression
      ? {
          name: this.activeExpression.name,
          intensity: this.activeExpression.intensity,
        }
      : null;
  }

  /**
   * Emit custom event when expressions change
   */
  private emitExpressionsChanged(
    action: "created" | "updated" | "deleted" | "imported",
    expressionName?: string
  ) {
    const event = new CustomEvent("custom-expressions-changed", {
      detail: {
        action,
        expressionName,
        totalExpressions: this.config.expressions.length,
        enabledExpressions: this.config.expressions.filter((e) => e.enabled)
          .length,
        modelName: this.modelName,
        timestamp: new Date().toISOString(),
      },
    });

    window.dispatchEvent(event);

    console.log(
      `🎨 Custom expressions changed: ${action}${expressionName ? ` (${expressionName})` : ""}`
    );
  }

  /**
   * Load configuration from local storage
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);

        if (parsed.version === DEFAULT_CUSTOM_EXPRESSION_CONFIG.version) {
          this.config = parsed;
          console.log(
            `📋 Loaded ${this.config.expressions.length} custom expressions from storage`
          );
        } else {
          console.warn(`⚠️ Version mismatch in stored config, using defaults`);
          this.config = { ...DEFAULT_CUSTOM_EXPRESSION_CONFIG };
        }
      } else {
        this.config = { ...DEFAULT_CUSTOM_EXPRESSION_CONFIG };
      }
    } catch (error) {
      console.error("Failed to load configuration:", error);
      this.config = { ...DEFAULT_CUSTOM_EXPRESSION_CONFIG };
    }
  }

  /**
   * Save configuration to local storage
   */
  private async saveConfiguration(): Promise<void> {
    try {
      const serialized = JSON.stringify(this.config);
      localStorage.setItem(this.storageKey, serialized);
      console.log(`💾 Saved custom expressions configuration`);
    } catch (error) {
      console.error("Failed to save configuration:", error);
      throw error;
    }
  }

  // === PUBLIC API METHODS ===
  // All the existing public methods remain the same for backward compatibility

  /**
   * Get all available parameters
   */
  getAvailableParameters(): ModelParameter[] {
    if (!this.modelName) return [];

    const result = parameterDiscoveryService.getCachedResult(this.modelName);
    return result?.parameters || [];
  }

  /**
   * Get expression-related parameters
   */
  getExpressionParameters(): ModelParameter[] {
    if (!this.modelName) return [];

    const result = parameterDiscoveryService.getCachedResult(this.modelName);
    return result?.expressionParameters || [];
  }

  /**
   * Get parameters grouped by category (CDI3 enhanced)
   */
  getParametersByCategory(): Record<string, ModelParameter[]> {
    if (!this.modelName) return {};

    return parameterDiscoveryService.getParametersByCategory(this.modelName);
  }

  /**
   * Search parameters with CDI3 support
   */
  searchParameters(query: string): ModelParameter[] {
    if (!this.modelName) return [];

    return parameterDiscoveryService.searchParameters(query, this.modelName);
  }

  /**
   * Get parameter by ID with CDI3 metadata
   */
  getParameterById(parameterId: string): ModelParameter | null {
    if (!this.modelName) return null;

    return parameterDiscoveryService.getParameterById(
      parameterId,
      this.modelName
    );
  }

  /**
   * Get all custom expressions
   */
  getCustomExpressions(): CustomExpressionMapping[] {
    return this.config.expressions;
  }

  /**
   * Get a specific custom expression by name
   */
  getCustomExpression(name: string): CustomExpressionMapping | null {
    return this.config.expressions.find((expr) => expr.name === name) || null;
  }

  /**
   * Check if an expression name is already taken
   */
  isExpressionNameTaken(name: string, excludeId?: string): boolean {
    return this.config.expressions.some(
      (expr) => expr.name === name && expr.id !== excludeId
    );
  }

  /**
   * Create a new custom expression
   */
  async createCustomExpression(
    request: CreateCustomExpressionRequest
  ): Promise<CustomExpressionMapping | null> {
    if (!this.isInitialized) {
      throw new Error("Custom expression manager not initialized");
    }

    try {
      // Validate the request
      if (this.isExpressionNameTaken(request.name)) {
        throw new Error(`Expression name "${request.name}" already exists`);
      }

      // Enrich parameters with names and validate
      const enrichedParameters: CustomExpressionParameter[] = [];

      for (const param of request.parameters) {
        const paramInfo = this.getParameterById(param.parameterId);
        if (!paramInfo) {
          console.warn(`Parameter not found: ${param.parameterId}`);
          continue;
        }

        const enrichedParam: CustomExpressionParameter = {
          ...param,
          parameterName: paramInfo.name,
        };

        enrichedParameters.push(enrichedParam);
      }

      if (enrichedParameters.length === 0) {
        throw new Error("No valid parameters specified");
      }

      // Create the expression mapping
      const expression: CustomExpressionMapping = {
        id: generateCustomExpressionId(),
        name: request.name,
        description: request.description || "",
        parameters: enrichedParameters,
        enabled: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      // Validate the expression
      const validation = validateCustomExpressionMapping(expression);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      // Add to configuration
      this.config.expressions.push(expression);
      await this.saveConfiguration();

      // Emit change event
      this.emitExpressionsChanged("created", expression.name);

      console.log(
        `✅ Created custom expression: ${expression.name} with ${enrichedParameters.length} parameters`
      );
      return expression;
    } catch (error) {
      console.error("Failed to create custom expression:", error);
      throw error;
    }
  }

  /**
   * Update an existing custom expression
   */
  async updateCustomExpression(
    id: string,
    updates: Partial<CreateCustomExpressionRequest>
  ): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error("Custom expression manager not initialized");
    }

    try {
      const expressionIndex = this.config.expressions.findIndex(
        (expr) => expr.id === id
      );
      if (expressionIndex === -1) {
        throw new Error(`Expression with ID ${id} not found`);
      }

      const expression = this.config.expressions[expressionIndex];
      const oldName = expression.name;

      // Check name uniqueness if name is being updated
      if (updates.name && updates.name !== expression.name) {
        if (this.isExpressionNameTaken(updates.name, id)) {
          throw new Error(`Expression name "${updates.name}" already exists`);
        }
      }

      // Update fields
      if (updates.name) expression.name = updates.name;
      if (updates.description !== undefined)
        expression.description = updates.description;

      // Update parameters if provided
      if (updates.parameters) {
        const enrichedParameters: CustomExpressionParameter[] = [];

        for (const param of updates.parameters) {
          const paramInfo = this.getParameterById(param.parameterId);
          if (!paramInfo) {
            console.warn(`Parameter not found: ${param.parameterId}`);
            continue;
          }

          const enrichedParam: CustomExpressionParameter = {
            ...param,
            parameterName: paramInfo.name,
          };

          enrichedParameters.push(enrichedParam);
        }

        expression.parameters = enrichedParameters;
      }

      expression.modifiedAt = new Date();

      // Validate the updated expression
      const validation = validateCustomExpressionMapping(expression);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      await this.saveConfiguration();
      this.emitExpressionsChanged("updated", expression.name);

      console.log(
        `✅ Updated custom expression: ${oldName} -> ${expression.name}`
      );
      return true;
    } catch (error) {
      console.error("Failed to update custom expression:", error);
      throw error;
    }
  }

  /**
   * Delete a custom expression
   */
  async deleteCustomExpression(id: string): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error("Custom expression manager not initialized");
    }

    try {
      const expression = this.config.expressions.find((expr) => expr.id === id);
      const expressionName = expression?.name;

      // Stop if this expression is currently active
      if (this.activeExpression?.name === expressionName) {
        this.stopActiveExpression();
      }

      const initialLength = this.config.expressions.length;
      this.config.expressions = this.config.expressions.filter(
        (expr) => expr.id !== id
      );

      if (this.config.expressions.length === initialLength) {
        throw new Error(`Expression with ID ${id} not found`);
      }

      await this.saveConfiguration();
      this.emitExpressionsChanged("deleted", expressionName);

      console.log(
        `✅ Deleted custom expression: ${expressionName} (ID: ${id})`
      );
      return true;
    } catch (error) {
      console.error("Failed to delete custom expression:", error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getCurrentConfig(): CustomExpressionConfig {
    return { ...this.config };
  }

  /**
   * Export custom expressions to JSON
   */
  exportCustomExpressions(): string {
    const exportData = {
      modelName: this.modelName,
      exportedAt: new Date().toISOString(),
      config: this.config,
      modelParameters: this.getAvailableParameters().map((p) => ({
        id: p.id,
        name: p.name,
        isExpressionParameter: p.isExpressionParameter,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import custom expressions from JSON
   */
  async importCustomExpressions(
    jsonData: string,
    merge: boolean = false
  ): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error("Custom expression manager not initialized");
    }

    try {
      const importData = JSON.parse(jsonData);

      if (!importData.config || !importData.config.expressions) {
        throw new Error("Invalid import data format");
      }

      const expressions: CustomExpressionMapping[] =
        importData.config.expressions;

      // Validate expressions
      for (const expr of expressions) {
        const validation = validateCustomExpressionMapping(expr);
        if (!validation.isValid) {
          throw new Error(
            `Invalid expression "${expr.name}": ${validation.errors.join(", ")}`
          );
        }
      }

      let importedCount = 0;

      if (merge) {
        // Merge with existing expressions (avoid duplicates)
        const existingNames = new Set(
          this.config.expressions.map((e) => e.name)
        );
        const newExpressions = expressions.filter(
          (e) => !existingNames.has(e.name)
        );
        this.config.expressions.push(...newExpressions);
        importedCount = newExpressions.length;
        console.log(`✅ Merged ${importedCount} new expressions`);
      } else {
        // Replace all expressions
        this.config.expressions = expressions;
        importedCount = expressions.length;
        console.log(`✅ Imported ${importedCount} expressions`);
      }

      await this.saveConfiguration();
      this.emitExpressionsChanged("imported");

      return true;
    } catch (error) {
      console.error("Failed to import custom expressions:", error);
      throw error;
    }
  }

  /**
   * Get expression names for backend communication
   */
  getEnabledExpressionNames(): string[] {
    return this.config.expressions
      .filter((expr) => expr.enabled)
      .map((expr) => expr.name);
  }

  /**
   * Enable or disable an expression
   */
  async setExpressionEnabled(id: string, enabled: boolean): Promise<boolean> {
    try {
      const expression = this.config.expressions.find((expr) => expr.id === id);
      if (!expression) {
        throw new Error(`Expression with ID ${id} not found`);
      }

      // Stop if this expression is currently active and being disabled
      if (!enabled && this.activeExpression?.name === expression.name) {
        this.stopActiveExpression();
      }

      expression.enabled = enabled;
      expression.modifiedAt = new Date();

      await this.saveConfiguration();
      this.emitExpressionsChanged("updated", expression.name);

      console.log(
        `${enabled ? "✅ Enabled" : "🚫 Disabled"} expression: ${expression.name}`
      );
      return true;
    } catch (error) {
      console.error("Failed to set expression enabled state:", error);
      return false;
    }
  }

  /**
   * Get parameter statistics with CDI3 information
   */
  getParameterStatistics(): {
    total: number;
    expressionRelated: number;
    cdi3Enhanced: boolean;
    customExpressions: number;
    enabledExpressions: number;
  } {
    const stats = parameterDiscoveryService.getParameterStatistics(
      this.modelName!
    );

    return {
      total: stats.total,
      expressionRelated: stats.expressionRelated,
      cdi3Enhanced: stats.cdi3Enhanced,
      customExpressions: this.config.expressions.length,
      enabledExpressions: this.config.expressions.filter((e) => e.enabled)
        .length,
    };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    console.log("🧹 FIXED: Cleaning up custom expression manager");

    // Clear active expression and stop parameter overrides
    if (this.activeExpression && this.currentModel) {
      this.stopActiveExpression();
    }

    // FIXED: Unregister from persistent parameter service
    if (this.currentModel) {
      persistentParameterService.unregisterModel(this.currentModel);
    }

    // Reset state
    this.currentModel = null;
    this.modelName = null;
    this.modelPath = null;
    this.isInitialized = false;
    this.activeExpression = null;

    console.log("✅ FIXED: Custom expression manager cleaned up");
  }
}

// Export singleton instance
export const customExpressionManager = CustomExpressionManager.getInstance();