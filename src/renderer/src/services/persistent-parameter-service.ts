// src/renderer/src/services/persistent-parameter-service.ts
import { Live2DModel } from "pixi-live2d-display-lipsyncpatch";
import * as PIXI from "pixi.js";

export interface ParameterOverride {
  parameterId: string;
  value: number;
  weight: number;
  blendMode: 'overwrite' | 'add' | 'multiply';
  priority: number; // Higher numbers take precedence
  source: string; // e.g., 'custom-expression:happy', 'manual-override'
}

class PersistentParameterService {
  private static instance: PersistentParameterService;
  private modelInstances = new Map<Live2DModel, {
    modelName: string;
    isCubism4: boolean;
    coreModel: any;
    overrides: Map<string, ParameterOverride>;
    isActive: boolean;
    frameCallback: () => void;
    updatePriority: number;
  }>();

  private constructor() {}

  public static getInstance(): PersistentParameterService {
    if (!PersistentParameterService.instance) {
      PersistentParameterService.instance = new PersistentParameterService();
    }
    return PersistentParameterService.instance;
  }

  public registerModel(model: Live2DModel, modelName: string): boolean {
    if (this.modelInstances.has(model)) {
      console.log(`Model ${modelName} already registered for persistent parameters.`);
      return true;
    }

    const coreModel = model.internalModel?.coreModel;
    if (!coreModel) {
      console.error(`Cannot access core model for ${modelName} to register for persistent parameters.`);
      return false;
    }

    const isCubism4 = typeof coreModel.setParameterValueById === 'function';
    
    // FIXED: Create a frame callback that ensures parameters are applied AFTER model update
    const frameCallback = () => {
        if (this.modelInstances.has(model)) {
            // The key fix: We need to ensure this runs AFTER the model's internal update
            // Since autoUpdate is true, the model updates itself in the PIXI ticker
            // We need to apply our overrides after that happens
            this.applyParameterOverrides(model);
        }
    };

    const modelData = {
      modelName,
      isCubism4,
      coreModel,
      overrides: new Map<string, ParameterOverride>(),
      isActive: true,
      frameCallback,
      updatePriority: PIXI.UPDATE_PRIORITY.LOW, // Run after normal priority updates
    };

    this.modelInstances.set(model, modelData);
    
    // FIXED: Add with LOW priority to ensure it runs AFTER the model's internal update
    // The Live2D model's internal update typically runs at NORMAL priority
    PIXI.Ticker.shared.add(frameCallback, null, PIXI.UPDATE_PRIORITY.LOW);

    console.log(`✅ Model ${modelName} registered for persistent parameter application (LOW priority for proper timing).`);
    return true;
  }

  public unregisterModel(model: Live2DModel): void {
    const modelData = this.modelInstances.get(model);
    if (!modelData) return;

    PIXI.Ticker.shared.remove(modelData.frameCallback);
    this.modelInstances.delete(model);
    console.log(`🧹 Unregistered model ${modelData.modelName} from persistent parameters.`);
  }

  private applyParameterOverrides(model: Live2DModel): void {
    const modelData = this.modelInstances.get(model);
    if (!modelData || !modelData.isActive || modelData.overrides.size === 0) {
      return;
    }

    // FIXED: Group overrides by source to apply them more efficiently
    const overridesBySource = new Map<string, ParameterOverride[]>();
    
    for (const override of modelData.overrides.values()) {
      if (!overridesBySource.has(override.source)) {
        overridesBySource.set(override.source, []);
      }
      overridesBySource.get(override.source)!.push(override);
    }

    // Apply overrides grouped by source, sorted by priority
    const sortedSources = Array.from(overridesBySource.entries())
      .sort((a, b) => {
        const aPriority = Math.max(...a[1].map(o => o.priority));
        const bPriority = Math.max(...b[1].map(o => o.priority));
        return aPriority - bPriority;
      });

    for (const [source, overrides] of sortedSources) {
      for (const override of overrides) {
        if (modelData.isCubism4) {
          this.applyCubism4Override(modelData.coreModel, override);
        } else {
          this.applyCubism2Override(modelData.coreModel, override);
        }
      }
    }
  }

  private applyCubism4Override(coreModel: any, override: ParameterOverride): void {
    try {
        const finalValue = override.value * override.weight;
        
        // FIXED: For custom expressions, we typically want to overwrite the value completely
        switch (override.blendMode) {
            case 'overwrite':
                // Directly set the parameter value
                coreModel.setParameterValueById(override.parameterId, finalValue);
                break;
            case 'add':
                // Add to the current value
                const currentValue = coreModel.getParameterValueById(override.parameterId) || 0;
                coreModel.setParameterValueById(override.parameterId, currentValue + finalValue);
                break;
            case 'multiply':
                // Multiply with the current value
                const currentVal = coreModel.getParameterValueById(override.parameterId) || 0;
                coreModel.setParameterValueById(override.parameterId, currentVal * finalValue);
                break;
        }
    } catch (e) {
        // Silently ignore if parameter doesn't exist
    }
  }
  
  private applyCubism2Override(coreModel: any, override: ParameterOverride): void {
      try {
          const paramIndex = coreModel.getParamIndex(override.parameterId);
          if (paramIndex === -1 || paramIndex === undefined) return;

          const finalValue = override.value * override.weight;
          
          switch (override.blendMode) {
              case 'overwrite':
                  coreModel.setParamFloat(paramIndex, finalValue);
                  break;
              case 'add':
                  const currentValue = coreModel.getParamFloat(paramIndex) || 0;
                  coreModel.setParamFloat(paramIndex, currentValue + finalValue);
                  break;
              case 'multiply':
                  const currentVal = coreModel.getParamFloat(paramIndex) || 0;
                  coreModel.setParamFloat(paramIndex, currentVal * finalValue);
                  break;
          }
      } catch(e) {
          // Silently ignore if parameter doesn't exist
      }
  }

  public setExpressionOverrides(
    model: Live2DModel,
    source: string,
    parameters: Omit<ParameterOverride, 'priority' | 'source'>[],
    intensity: number = 1.0,
    priority: number = 200
  ): boolean {
    const modelData = this.modelInstances.get(model);
    if (!modelData) {
      console.error(`Model not registered for persistent parameters`);
      return false;
    }

    // Clear previous overrides from this source
    this.clearParameterOverrides(model, source);

    console.log(`Setting ${parameters.length} parameter overrides for source: ${source}`);

    // FIXED: Apply each parameter with proper transformation
    for (const param of parameters) {
      const override: ParameterOverride = {
        parameterId: param.parameterId,
        value: param.value * intensity, // Apply intensity to the value
        weight: param.weight,
        blendMode: param.blendMode,
        priority,
        source,
      };
      
      const key = `${source}_${param.parameterId}`;
      modelData.overrides.set(key, override);
      
      console.log(`  - ${param.parameterId}: ${param.value} * ${intensity} = ${override.value} (${param.blendMode})`);
    }
    
    return true;
  }

  public clearParameterOverrides(model: Live2DModel, source: string): void {
    const modelData = this.modelInstances.get(model);
    if (!modelData) return;

    let clearedCount = 0;
    for (const key of modelData.overrides.keys()) {
      if (key.startsWith(`${source}_`)) {
        modelData.overrides.delete(key);
        clearedCount++;
      }
    }
    
    if (clearedCount > 0) {
      console.log(`Cleared ${clearedCount} parameter overrides for source: ${source}`);
    }
  }

  public clearExpressionOverrides(model: Live2DModel, expressionName: string): void {
    // Alias for backward compatibility
    this.clearParameterOverrides(model, `custom-expression:${expressionName}`);
  }
  
  public getModelInfo(model: Live2DModel) {
    return this.modelInstances.get(model);
  }

  public getStatistics() {
    const stats = { 
      totalModels: this.modelInstances.size, 
      totalOverrides: 0, 
      models: [] as any[] 
    };
    
    this.modelInstances.forEach((data, model) => {
      stats.totalOverrides += data.overrides.size;
      stats.models.push({ 
        name: data.modelName, 
        overrides: data.overrides.size,
        sources: Array.from(new Set(
          Array.from(data.overrides.values()).map(o => o.source)
        ))
      });
    });
    
    return stats;
  }

  // FIXED: Debug method to verify parameter application
  public debugParameterOverrides(model: Live2DModel): void {
    const modelData = this.modelInstances.get(model);
    if (!modelData) {
      console.log("Model not registered for persistent parameters");
      return;
    }

    console.log(`Debug: ${modelData.modelName} parameter overrides:`);
    console.log(`  - Total overrides: ${modelData.overrides.size}`);
    console.log(`  - Is Cubism4: ${modelData.isCubism4}`);
    console.log(`  - Is Active: ${modelData.isActive}`);
    
    modelData.overrides.forEach((override, key) => {
      console.log(`  - ${key}: value=${override.value}, weight=${override.weight}, blend=${override.blendMode}`);
    });
  }
}

export const persistentParameterService = PersistentParameterService.getInstance();