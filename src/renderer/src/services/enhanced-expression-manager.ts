// src/renderer/src/services/enhanced-expression-manager.ts
import { Live2DModel } from "pixi-live2d-display-lipsyncpatch";

/**
 * Global type definitions for enhanced Live2D API
 */
declare global {
  interface Window {
    live2d: {
      expression: (name?: string | number) => void;
      setExpression: (name?: string | number) => void;
      setRandomExpression: () => void;
      getExpressions: () => string[];
      // Enhanced API methods
      enhancedExpression: {
        setExpression: (name: string, intensity?: number, transitionDuration?: number, blendMode?: ExpressionBlendMode) => Promise<void>;
        setParameterValue: (parameterId: string, value: number, weight?: number, blendMode?: ExpressionBlendMode) => void;
        getParameterValue: (parameterId: string) => number;
        blendExpressions: (expr1: string, expr2: string, blendFactor: number, blendMode?: ExpressionBlendMode) => void;
        resetExpression: () => void;
        getExpressions: () => ExpressionDefinition[];
        getParameters: () => ExpressionParameter[];
        getState: () => ExpressionState;
        captureCurrentExpression: (name: string) => ExpressionDefinition;
        exportExpression: (name: string) => string | null;
        importExpression: (json: string) => boolean;
        setDefaultFadeDuration: (duration: number) => void;
        // New pixi-live2d-display-lipsyncpatch integration methods
        playMotionWithExpression: (motion: string, expression?: string | number, options?: any) => void;
        speakWithExpression: (audioUrl?: string, expression?: string | number, options?: any) => void;
      };
    };
  }
}

/**
 * Expression blending modes based on Live2D Cubism specification
 */
export enum ExpressionBlendMode {
  ADD = "Add",
  MULTIPLY = "Multiply", 
  OVERWRITE = "Overwrite"
}

/**
 * Interface for expression parameter mapping
 */
export interface ExpressionParameter {
  /** Parameter ID/name in the Live2D model */
  id: string;
  /** Current value of the parameter (0.0 to 1.0 typically) */
  value: number;
  /** Default/base value of the parameter */
  defaultValue: number;
  /** Minimum allowed value */
  minValue: number;
  /** Maximum allowed value */
  maxValue: number;
  /** Blend mode for this parameter */
  blendMode: ExpressionBlendMode;
  /** Index in the model's parameter array */
  index: number;
}

/**
 * Interface for expression definitions
 */
export interface ExpressionDefinition {
  /** Expression name/ID */
  name: string;
  /** Index in the expression array */
  index: number;
  /** Parameters affected by this expression */
  parameters: ExpressionParameter[];
  /** Fade duration for this expression */
  fadeDuration?: number;
}

/**
 * Interface for expression state tracking
 */
export interface ExpressionState {
  /** Currently active expression */
  currentExpression: string | null;
  /** Target expression being transitioned to */
  targetExpression: string | null;
  /** Transition progress (0.0 to 1.0) */
  transitionProgress: number;
  /** Expression intensity (0.0 to 1.0) */
  intensity: number;
  /** Whether expression is transitioning */
  isTransitioning: boolean;
}

/**
 * Enhanced Expression Manager for Live2D models with pixi-live2d-display-lipsyncpatch integration
 * Provides fine-grained control over expression parameters with proper lipsync patch support
 */
export class EnhancedExpressionManager {
  private model: Live2DModel | null = null;
  private modelName: string = '';
  private expressions: Map<string, ExpressionDefinition> = new Map();
  private parameters: Map<string, ExpressionParameter> = new Map();
  private state: ExpressionState = {
    currentExpression: null,
    targetExpression: null,
    transitionProgress: 0,
    intensity: 1.0,
    isTransitioning: false
  };
  private transitionStartTime: number = 0;
  private defaultFadeDuration: number = 500; // milliseconds
  
  constructor(model?: Live2DModel, modelName?: string) {
    if (model && modelName) {
      this.setModel(model, modelName);
    }
  }

  /**
   * Set the Live2D model to manage expressions for
   */
  async setModel(model: Live2DModel, modelName: string): Promise<void> {
    this.model = model;
    this.modelName = modelName;
    
    console.log(`🎨 Setting up Enhanced Expression Manager for ${modelName}`);
    
    await this.discoverExpressions();
    await this.discoverParameters();
    
    console.log(`✅ Enhanced Expression Manager ready with ${this.expressions.size} expressions and ${this.parameters.size} parameters`);
  }

  /**
   * Discover available expressions from the model with lipsync patch integration
   */
  private async discoverExpressions(): Promise<void> {
    if (!this.model) return;

    this.expressions.clear();

    try {
      console.log('🔍 Discovering expressions via enhanced methods...');

      // Method 1: Try to get expressions via expression manager
      const expressionManager = this.model.internalModel?.motionManager?.expressionManager;
      
      if (expressionManager?.definitions) {
        console.log(`📋 Found ${expressionManager.definitions.length} expressions via expression manager`);
        
        expressionManager.definitions.forEach((definition: any, index: number) => {
          const expressionDef: ExpressionDefinition = {
            name: definition.name || `Expression ${index}`,
            index,
            parameters: [],
            fadeDuration: definition.fadeDuration || this.defaultFadeDuration
          };

          // Extract parameters from expression definition
          if (definition.parameters) {
            definition.parameters.forEach((param: any) => {
              const expressionParam: ExpressionParameter = {
                id: param.id || param.Id,
                value: param.value || param.Value || 0,
                defaultValue: param.defaultValue || param.DefaultValue || 0,
                minValue: param.minValue || param.MinValue || 0,
                maxValue: param.maxValue || param.MaxValue || 1,
                blendMode: this.parseBlendMode(param.blendMode || param.Blend),
                index: this.getParameterIndex(param.id || param.Id)
              };
              expressionDef.parameters.push(expressionParam);
            });
          }

          this.expressions.set(expressionDef.name, expressionDef);
        });
      }

      // Method 2: Try global API fallback
      if (this.expressions.size === 0) {
        console.log('🔍 Trying global API fallback...');
        const globalExpressions = (window as any).live2d?.getExpressions?.();
        if (globalExpressions && Array.isArray(globalExpressions)) {
          globalExpressions.forEach((name: string, index: number) => {
            this.expressions.set(name, {
              name,
              index,
              parameters: [],
              fadeDuration: this.defaultFadeDuration
            });
          });
          console.log(`📋 Found ${globalExpressions.length} expressions via global API`);
        }
      }

      // Method 3: Try pixi-live2d-display-lipsyncpatch specific discovery
      if (this.expressions.size === 0 && this.model) {
        console.log('🔍 Trying lipsync patch specific discovery...');
        await this.discoverLipsyncPatchExpressions();
      }

      console.log(`🎭 Discovered ${this.expressions.size} expressions total`);
    } catch (error) {
      console.warn("Failed to discover expressions:", error);
    }
  }

  /**
   * Discover expressions specific to pixi-live2d-display-lipsyncpatch
   */
  private async discoverLipsyncPatchExpressions(): Promise<void> {
    if (!this.model) return;

    try {
      // Check if the model has lipsync patch specific properties
      const model = this.model as any;
      
      // Try to access motion groups which might contain expression info
      if (model.internalModel?.settings?.motions) {
        const motions = model.internalModel.settings.motions;
        Object.keys(motions).forEach((groupName, index) => {
          // Create a default expression for each motion group
          this.expressions.set(groupName, {
            name: groupName,
            index: index + 100, // Offset to avoid conflicts
            parameters: [],
            fadeDuration: this.defaultFadeDuration
          });
        });
        console.log(`📋 Added ${Object.keys(motions).length} motion groups as expressions`);
      }

      // Try to discover expressions through the model's internal structure
      if (model.internalModel?._model) {
        const internalModel = model.internalModel._model;
        
        // Look for expression-related parameters
        if (typeof internalModel.getParameterCount === 'function') {
          const paramCount = internalModel.getParameterCount();
          const expressionParams: string[] = [];
          
          for (let i = 0; i < paramCount; i++) {
            if (typeof internalModel.getParameterId === 'function') {
              const paramId = internalModel.getParameterId(i);
              
              // Check if this parameter looks like an expression parameter
              if (this.isExpressionParameter(paramId)) {
                expressionParams.push(paramId);
              }
            }
          }
          
          if (expressionParams.length > 0) {
            // Create a generic expression based on expression parameters
            this.expressions.set('Custom', {
              name: 'Custom',
              index: 999,
              parameters: expressionParams.map(paramId => ({
                id: paramId,
                value: 0,
                defaultValue: 0,
                minValue: 0,
                maxValue: 1,
                blendMode: ExpressionBlendMode.ADD,
                index: this.getParameterIndex(paramId)
              })),
              fadeDuration: this.defaultFadeDuration
            });
            console.log(`📋 Created custom expression with ${expressionParams.length} parameters`);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to discover lipsync patch expressions:', error);
    }
  }

  /**
   * Check if a parameter ID indicates it's an expression parameter
   */
  private isExpressionParameter(paramId: string): boolean {
    const expressionIndicators = [
      'Expr', 'Expression', 'Face', 'Mood', 'Emotion',
      'Eye', 'Mouth', 'Brow', 'Cheek'
    ];
    
    return expressionIndicators.some(indicator => 
      paramId.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Parse blend mode from various formats
   */
  private parseBlendMode(blendMode: any): ExpressionBlendMode {
    if (typeof blendMode === 'string') {
      switch (blendMode.toLowerCase()) {
        case 'add':
        case 'additive':
          return ExpressionBlendMode.ADD;
        case 'multiply':
        case 'multiplicative':
          return ExpressionBlendMode.MULTIPLY;
        case 'overwrite':
        case 'override':
        case 'replace':
          return ExpressionBlendMode.OVERWRITE;
        default:
          return ExpressionBlendMode.ADD;
      }
    }
    
    // Handle numeric blend modes
    if (typeof blendMode === 'number') {
      switch (blendMode) {
        case 0: return ExpressionBlendMode.OVERWRITE;
        case 1: return ExpressionBlendMode.ADD;
        case 2: return ExpressionBlendMode.MULTIPLY;
        default: return ExpressionBlendMode.ADD;
      }
    }
    
    return ExpressionBlendMode.ADD;
  }

  /**
   * Discover available parameters from the model
   */
  private async discoverParameters(): Promise<void> {
    if (!this.model) return;

    this.parameters.clear();

    try {
      const internalModel = this.model.internalModel;
      if (internalModel && internalModel._model) {
        const model = internalModel._model;
        
        if (typeof model.getParameterCount === 'function') {
          const parameterCount = model.getParameterCount();

          for (let i = 0; i < parameterCount; i++) {
            try {
              const paramId = model.getParameterId?.(i) || `param_${i}`;
              const parameter: ExpressionParameter = {
                id: paramId,
                value: model.getParameterValue?.(i) || 0,
                defaultValue: model.getParameterDefaultValue?.(i) || 0,
                minValue: model.getParameterMinimumValue?.(i) || 0,
                maxValue: model.getParameterMaximumValue?.(i) || 1,
                blendMode: ExpressionBlendMode.ADD,
                index: i
              };
              this.parameters.set(paramId, parameter);
            } catch (error) {
              console.warn(`Failed to get parameter ${i}:`, error);
            }
          }
        }
      }

      console.log(`📊 Discovered ${this.parameters.size} parameters`);
    } catch (error) {
      console.warn("Failed to discover parameters:", error);
    }
  }

  /**
   * Get parameter index by ID with enhanced fallback
   */
  private getParameterIndex(parameterId: string): number {
    if (!this.model?.internalModel?._model) return -1;
    
    try {
      const model = this.model.internalModel._model;
      
      // Try direct lookup
      if (typeof model.getParameterIndex === 'function') {
        const index = model.getParameterIndex(parameterId);
        if (index >= 0) return index;
      }
      
      // Fallback: search through all parameters
      if (typeof model.getParameterCount === 'function') {
        const paramCount = model.getParameterCount();
        for (let i = 0; i < paramCount; i++) {
          if (typeof model.getParameterId === 'function') {
            const id = model.getParameterId(i);
            if (id === parameterId) return i;
          }
        }
      }
      
      return -1;
    } catch {
      return -1;
    }
  }

  /**
   * Get all available expressions
   */
  getExpressions(): ExpressionDefinition[] {
    return Array.from(this.expressions.values());
  }

  /**
   * Get all available parameters
   */
  getParameters(): ExpressionParameter[] {
    return Array.from(this.parameters.values());
  }

  /**
   * Get current expression state
   */
  getState(): ExpressionState {
    return { ...this.state };
  }

  /**
   * Set expression using pixi-live2d-display-lipsyncpatch enhanced methods
   */
  async setExpression(
    expressionName: string, 
    intensity: number = 1.0, 
    transitionDuration?: number,
    blendMode: ExpressionBlendMode = ExpressionBlendMode.OVERWRITE
  ): Promise<void> {
    if (!this.model) {
      console.warn('No model available for expression setting');
      return;
    }

    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    console.log(`🎭 Setting expression: ${expressionName} (intensity: ${clampedIntensity})`);

    // Set up transition state
    this.state.targetExpression = expressionName;
    this.state.intensity = clampedIntensity;
    this.state.isTransitioning = (transitionDuration || 0) > 0;
    this.state.transitionProgress = 0;
    this.transitionStartTime = Date.now();

    try {
      // Method 1: Try using lipsync patch's enhanced motion system
      if (await this.setExpressionViaLipsyncPatch(expressionName, clampedIntensity, transitionDuration)) {
        this.state.currentExpression = expressionName;
        this.state.isTransitioning = false;
        this.state.transitionProgress = 1;
        console.log(`✅ Set expression via lipsync patch: ${expressionName}`);
        return;
      }

      // Method 2: Try using traditional expression manager
      if (await this.setExpressionViaTraditional(expressionName, clampedIntensity, transitionDuration)) {
        this.state.currentExpression = expressionName;
        this.state.isTransitioning = false;
        this.state.transitionProgress = 1;
        console.log(`✅ Set expression via traditional method: ${expressionName}`);
        return;
      }

      // Method 3: Try manual parameter manipulation
      if (await this.setExpressionViaParameters(expressionName, clampedIntensity, transitionDuration, blendMode)) {
        this.state.currentExpression = expressionName;
        this.state.isTransitioning = false;
        this.state.transitionProgress = 1;
        console.log(`✅ Set expression via parameter manipulation: ${expressionName}`);
        return;
      }

      console.warn(`⚠️ Failed to set expression "${expressionName}" via any method`);

    } catch (error) {
      console.error(`Failed to set expression "${expressionName}":`, error);
    }
  }

  /**
   * Set expression using pixi-live2d-display-lipsyncpatch methods
   */
  private async setExpressionViaLipsyncPatch(
    expressionName: string, 
    intensity: number, 
    transitionDuration?: number
  ): Promise<boolean> {
    if (!this.model) return false;

    try {
      const model = this.model as any;

      // Method 1A: Try using the enhanced motion method with expression
      if (typeof model.motion === 'function') {
        // Use the lipsync patch's motion method with expression parameter
        model.motion(
          "idle",           // Motion group
          null,             // Random animation index
          3,                // Force priority
          null,             // No audio
          intensity,        // Volume/intensity
          expressionName,   // Expression
          false             // Don't reset expression
        );
        return true;
      }

      // Method 1B: Try using the speak method with expression
      if (typeof model.speak === 'function') {
        model.speak(null, {
          expression: expressionName,
          resetExpression: false,
          volume: 0.0,
          intensity: intensity
        });
        return true;
      }

      return false;
    } catch (error) {
      console.warn('Failed to set expression via lipsync patch:', error);
      return false;
    }
  }

  /**
   * Set expression using traditional expression manager
   */
  private async setExpressionViaTraditional(
    expressionName: string, 
    intensity: number, 
    transitionDuration?: number
  ): Promise<boolean> {
    if (!this.model) return false;

    try {
      const expressionManager = this.model.internalModel?.motionManager?.expressionManager;
      if (!expressionManager) return false;

      const expression = this.expressions.get(expressionName);
      if (!expression) return false;

      // Try setting the expression by index or name
      if (typeof expressionManager.setExpression === 'function') {
        expressionManager.setExpression(expression.index);
        return true;
      }

      return false;
    } catch (error) {
      console.warn('Failed to set expression via traditional method:', error);
      return false;
    }
  }

  /**
   * Set expression using manual parameter manipulation
   */
  private async setExpressionViaParameters(
    expressionName: string, 
    intensity: number, 
    transitionDuration?: number,
    blendMode: ExpressionBlendMode = ExpressionBlendMode.OVERWRITE
  ): Promise<boolean> {
    if (!this.model) return false;

    try {
      const expression = this.expressions.get(expressionName);
      if (!expression || expression.parameters.length === 0) return false;

      const duration = transitionDuration || expression.fadeDuration || 0;

      if (duration > 0) {
        // Animate transition
        await this.animateParameterTransition(expression, intensity, duration, blendMode);
      } else {
        // Apply immediately
        this.applyExpressionParameters(expression, intensity, blendMode);
      }

      return true;
    } catch (error) {
      console.warn('Failed to set expression via parameters:', error);
      return false;
    }
  }

  /**
   * Apply expression parameters to the model
   */
  private applyExpressionParameters(
    expression: ExpressionDefinition, 
    intensity: number, 
    blendMode: ExpressionBlendMode
  ): void {
    if (!this.model?.internalModel?._model) return;

    const model = this.model.internalModel._model;

    expression.parameters.forEach(param => {
      try {
        const paramIndex = param.index >= 0 ? param.index : this.getParameterIndex(param.id);
        if (paramIndex < 0) return;

        const targetValue = param.value * intensity;

        switch (blendMode) {
          case ExpressionBlendMode.OVERWRITE:
            if (typeof model.setParameterValue === 'function') {
              model.setParameterValue(paramIndex, targetValue);
            }
            break;
          case ExpressionBlendMode.ADD:
            if (typeof model.addParameterValue === 'function') {
              model.addParameterValue(paramIndex, targetValue);
            } else if (typeof model.setParameterValue === 'function') {
              const currentValue = model.getParameterValue?.(paramIndex) || 0;
              model.setParameterValue(paramIndex, currentValue + targetValue);
            }
            break;
          case ExpressionBlendMode.MULTIPLY:
            if (typeof model.multiplyParameterValue === 'function') {
              model.multiplyParameterValue(paramIndex, targetValue);
            } else if (typeof model.setParameterValue === 'function') {
              const currentValue = model.getParameterValue?.(paramIndex) || 0;
              model.setParameterValue(paramIndex, currentValue * targetValue);
            }
            break;
        }

        // Update cached value
        if (typeof model.getParameterValue === 'function') {
          param.value = model.getParameterValue(paramIndex);
        }
      } catch (error) {
        console.warn(`Failed to apply parameter ${param.id}:`, error);
      }
    });
  }

  /**
   * Animate parameter transition
   */
  private async animateParameterTransition(
    expression: ExpressionDefinition, 
    intensity: number, 
    duration: number,
    blendMode: ExpressionBlendMode
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const startTime = Date.now();
      const startValues: Map<string, number> = new Map();

      // Store starting values
      expression.parameters.forEach(param => {
        if (this.model?.internalModel?._model) {
          try {
            const paramIndex = param.index >= 0 ? param.index : this.getParameterIndex(param.id);
            if (paramIndex >= 0) {
              const currentValue = this.model.internalModel._model.getParameterValue?.(paramIndex) || 0;
              startValues.set(param.id, currentValue);
            }
          } catch (error) {
            startValues.set(param.id, param.defaultValue);
          }
        }
      });

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easing function for smoother transitions
        const easedProgress = this.easeInOutCubic(progress);
        
        // Update transition state
        this.state.transitionProgress = progress;

        // Apply interpolated values
        expression.parameters.forEach(param => {
          const startValue = startValues.get(param.id) || param.defaultValue;
          const targetValue = param.value * intensity;
          const currentValue = startValue + (targetValue - startValue) * easedProgress;
          
          this.setParameterValue(param.id, currentValue, 1.0, blendMode);
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.state.isTransitioning = false;
          this.state.transitionProgress = 1;
          resolve();
        }
      };

      animate();
    });
  }

  /**
   * Easing function for smooth transitions
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Set parameter value directly
   */
  setParameterValue(
    parameterId: string, 
    value: number, 
    weight: number = 1.0, 
    blendMode: ExpressionBlendMode = ExpressionBlendMode.OVERWRITE
  ): void {
    if (!this.model?.internalModel?._model) return;

    const parameter = this.parameters.get(parameterId);
    if (!parameter) {
      console.warn(`Parameter "${parameterId}" not found`);
      return;
    }

    const clampedValue = Math.max(parameter.minValue, Math.min(parameter.maxValue, value));
    const weightedValue = clampedValue * weight;

    try {
      const model = this.model.internalModel._model;
      const paramIndex = parameter.index >= 0 ? parameter.index : this.getParameterIndex(parameterId);
      
      if (paramIndex < 0) return;
      
      switch (blendMode) {
        case ExpressionBlendMode.OVERWRITE:
          if (typeof model.setParameterValue === 'function') {
            model.setParameterValue(paramIndex, weightedValue);
          }
          break;
        case ExpressionBlendMode.ADD:
          if (typeof model.addParameterValue === 'function') {
            model.addParameterValue(paramIndex, weightedValue);
          } else if (typeof model.setParameterValue === 'function') {
            const currentValue = model.getParameterValue?.(paramIndex) || 0;
            model.setParameterValue(paramIndex, currentValue + weightedValue);
          }
          break;
        case ExpressionBlendMode.MULTIPLY:
          if (typeof model.multiplyParameterValue === 'function') {
            model.multiplyParameterValue(paramIndex, weightedValue);
          } else if (typeof model.setParameterValue === 'function') {
            const currentValue = model.getParameterValue?.(paramIndex) || 0;
            model.setParameterValue(paramIndex, currentValue * weightedValue);
          }
          break;
      }

      // Update cached value
      if (typeof model.getParameterValue === 'function') {
        parameter.value = model.getParameterValue(paramIndex);
      }
    } catch (error) {
      console.error(`Failed to set parameter "${parameterId}":`, error);
    }
  }

  /**
   * Get parameter value
   */
  getParameterValue(parameterId: string): number {
    const parameter = this.parameters.get(parameterId);
    if (!parameter || !this.model?.internalModel?._model) return 0;

    try {
      const model = this.model.internalModel._model;
      const paramIndex = parameter.index >= 0 ? parameter.index : this.getParameterIndex(parameterId);
      
      if (paramIndex >= 0 && typeof model.getParameterValue === 'function') {
        const currentValue = model.getParameterValue(paramIndex);
        parameter.value = currentValue;
        return currentValue;
      }
      
      return parameter.value;
    } catch {
      return parameter.value;
    }
  }

  /**
   * Reset expression to default state using multiple methods
   */
  resetExpression(): void {
    try {
      // Method 1: Try lipsync patch reset
      if (this.resetExpressionViaLipsyncPatch()) {
        console.log('✅ Reset expression via lipsync patch');
        return;
      }

      // Method 2: Try traditional expression manager reset
      if (this.resetExpressionViaTraditional()) {
        console.log('✅ Reset expression via traditional method');
        return;
      }

      // Method 3: Try parameter reset
      if (this.resetExpressionViaParameters()) {
        console.log('✅ Reset expression via parameter reset');
        return;
      }

      console.warn('⚠️ Failed to reset expression via any method');
    } catch (error) {
      console.error('Failed to reset expression:', error);
    }

    // Reset state
    this.state.currentExpression = null;
    this.state.targetExpression = null;
    this.state.isTransitioning = false;
    this.state.transitionProgress = 0;
    this.state.intensity = 0;
  }

  /**
   * Reset expression using lipsync patch methods
   */
  private resetExpressionViaLipsyncPatch(): boolean {
    if (!this.model) return false;

    try {
      const model = this.model as any;

      // Try using motion with null expression
      if (typeof model.motion === 'function') {
        model.motion("idle", null, 3, null, 1.0, null, true);
        return true;
      }

      // Try using speak with reset
      if (typeof model.speak === 'function') {
        model.speak(null, {
          resetExpression: true,
          volume: 0.0
        });
        return true;
      }

      return false;
    } catch (error) {
      console.warn('Failed to reset expression via lipsync patch:', error);
      return false;
    }
  }

  /**
   * Reset expression using traditional expression manager
   */
  private resetExpressionViaTraditional(): boolean {
    if (!this.model) return false;

    try {
      const expressionManager = this.model.internalModel?.motionManager?.expressionManager;
      if (expressionManager && typeof expressionManager.resetExpression === 'function') {
        expressionManager.resetExpression();
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Failed to reset expression via traditional method:', error);
      return false;
    }
  }

  /**
   * Reset expression by resetting all parameters to default
   */
  private resetExpressionViaParameters(): boolean {
    if (!this.model?.internalModel?._model) return false;

    try {
      const model = this.model.internalModel._model;

      this.parameters.forEach(param => {
        try {
          const paramIndex = param.index >= 0 ? param.index : this.getParameterIndex(param.id);
          if (paramIndex >= 0 && typeof model.setParameterValue === 'function') {
            model.setParameterValue(paramIndex, param.defaultValue);
            param.value = param.defaultValue;
          }
        } catch (error) {
          console.warn(`Failed to reset parameter ${param.id}:`, error);
        }
      });

      return true;
    } catch (error) {
      console.warn('Failed to reset expression via parameters:', error);
      return false;
    }
  }

  /**
   * Blend between two expressions
   */
  blendExpressions(
    expression1: string, 
    expression2: string, 
    blendFactor: number,
    blendMode: ExpressionBlendMode = ExpressionBlendMode.ADD
  ): void {
    const expr1 = this.expressions.get(expression1);
    const expr2 = this.expressions.get(expression2);
    
    if (!expr1 || !expr2) {
      console.warn("One or both expressions not found for blending");
      return;
    }

    const factor = Math.max(0, Math.min(1, blendFactor));

    // Apply first expression with inverted factor
    this.applyExpressionParameters(expr1, 1 - factor, blendMode);
    
    // Apply second expression with factor
    this.applyExpressionParameters(expr2, factor, ExpressionBlendMode.ADD);
  }

  /**
   * Play motion with expression using lipsync patch
   */
  playMotionWithExpression(motion: string, expression?: string | number, options: any = {}): void {
    if (!this.model) return;

    try {
      const model = this.model as any;
      
      if (typeof model.motion === 'function') {
        model.motion(
          motion,
          options.index || null,
          options.priority || 3,
          options.audio || null,
          options.volume || 1.0,
          expression,
          options.resetExpression !== false
        );
        
        if (expression) {
          this.state.currentExpression = expression.toString();
        }
      }
    } catch (error) {
      console.error('Failed to play motion with expression:', error);
    }
  }

  /**
   * Speak with expression using lipsync patch
   */
  speakWithExpression(audioUrl?: string, expression?: string | number, options: any = {}): void {
    if (!this.model) return;

    try {
      const model = this.model as any;
      
      if (typeof model.speak === 'function') {
        model.speak(audioUrl, {
          expression: expression,
          resetExpression: options.resetExpression !== false,
          volume: options.volume || 1.0,
          crossOrigin: options.crossOrigin || "anonymous",
          ...options
        });
        
        if (expression) {
          this.state.currentExpression = expression.toString();
        }
      }
    } catch (error) {
      console.error('Failed to speak with expression:', error);
    }
  }

  /**
   * Create expression from current parameter values
   */
  captureCurrentExpression(name: string): ExpressionDefinition {
    const parameters: ExpressionParameter[] = [];
    
    this.parameters.forEach(param => {
      if (Math.abs(param.value - param.defaultValue) > 0.001) {
        parameters.push({
          ...param,
          value: param.value - param.defaultValue // Store as difference
        });
      }
    });

    const expression: ExpressionDefinition = {
      name,
      index: this.expressions.size,
      parameters,
      fadeDuration: this.defaultFadeDuration
    };

    this.expressions.set(name, expression);
    return expression;
  }

  /**
   * Save expression as JSON
   */
  exportExpression(expressionName: string): string | null {
    const expression = this.expressions.get(expressionName);
    if (!expression) return null;

    return JSON.stringify(expression, null, 2);
  }

  /**
   * Load expression from JSON
   */
  importExpression(expressionJson: string): boolean {
    try {
      const expression: ExpressionDefinition = JSON.parse(expressionJson);
      this.expressions.set(expression.name, expression);
      return true;
    } catch (error) {
      console.error("Failed to import expression:", error);
      return false;
    }
  }

  /**
   * Set default fade duration for expressions
   */
  setDefaultFadeDuration(duration: number): void {
    this.defaultFadeDuration = Math.max(0, duration);
  }

  /**
   * Update method to be called every frame for smooth transitions
   */
  update(deltaTime: number): void {
    if (this.state.isTransitioning) {
      // Transition updates are handled by animateParameterTransition
      return;
    }

    // Handle any ongoing parameter updates or effects here
    // This method can be extended for future real-time updates
  }
}