// src/renderer/src/services/expression-debug-tool.ts
import { Live2DModel } from "pixi-live2d-display-lipsyncpatch";

/**
 * Debug tool to diagnose Live2D expression parameter issues
 * This helps identify why custom expressions aren't visually changing the model
 */
export class ExpressionDebugTool {
  private static instance: ExpressionDebugTool;
  
  private constructor() {}

  static getInstance(): ExpressionDebugTool {
    if (!ExpressionDebugTool.instance) {
      ExpressionDebugTool.instance = new ExpressionDebugTool();
    }
    return ExpressionDebugTool.instance;
  }

  /**
   * Comprehensive model diagnosis
   */
  async diagnoseModel(model: Live2DModel, modelName: string): Promise<void> {
    console.log(`🔍 DIAGNOSING MODEL: ${modelName}`);
    console.log('==========================================');

    // Step 1: Check model access
    await this.checkModelAccess(model);
    
    // Step 2: List all parameters with current values
    await this.listAllParameters(model);
    
    // Step 3: Test expression-related parameters
    await this.testExpressionParameters(model);
    
    // Step 4: Test manual parameter changes
    await this.testManualParameterChanges(model);
    
    // Step 5: Check built-in expressions
    await this.checkBuiltInExpressions(model);

    console.log('==========================================');
    console.log('🔍 DIAGNOSIS COMPLETE');
  }

  /**
   * Check basic model access and determine version
   */
  private async checkModelAccess(model: Live2DModel): Promise<void> {
    console.log('\n📋 STEP 1: Model Access Check');
    console.log('------------------------------');

    try {
      // Check basic model structure
      console.log('Model structure:', {
        hasInternalModel: !!model.internalModel,
        hasMotionManager: !!model.internalModel?.motionManager,
        hasExpressionManager: !!model.internalModel?.motionManager?.expressionManager,
        hasCoreModel: !!model.internalModel?.coreModel,
      });

      const coreModel = model.internalModel?.coreModel;
      if (!coreModel) {
        console.error('❌ Cannot access core model - this is the main problem!');
        return;
      }

      // Determine Cubism version
      const isCubism4 = typeof coreModel.setParameterValueById === 'function';
      console.log(`✅ Core model accessed successfully`);
      console.log(`📊 Model type: ${isCubism4 ? 'Cubism 4' : 'Cubism 2'}`);

      // Check available methods
      if (isCubism4) {
        console.log('🔧 Cubism 4 methods available:', {
          setParameterValueById: typeof coreModel.setParameterValueById === 'function',
          getParameterValueById: typeof coreModel.getParameterValueById === 'function',
          getParameterIds: typeof coreModel.getParameterIds === 'function',
        });
      } else {
        console.log('🔧 Cubism 2 methods available:', {
          setParamFloat: typeof coreModel.setParamFloat === 'function',
          getParamFloat: typeof coreModel.getParamFloat === 'function',
          getParamIndex: typeof coreModel.getParamIndex === 'function',
          getParamCount: typeof coreModel.getParameterCount === 'function',
        });
      }

    } catch (error) {
      console.error('❌ Model access check failed:', error);
    }
  }

  /**
   * List all parameters with their current values
   */
  private async listAllParameters(model: Live2DModel): Promise<void> {
    console.log('\n📋 STEP 2: All Parameters Listing');
    console.log('----------------------------------');

    try {
      const coreModel = model.internalModel?.coreModel;
      if (!coreModel) return;

      const isCubism4 = typeof coreModel.setParameterValueById === 'function';
      const parameters: Array<{id: string, value: number, range?: {min: number, max: number}}> = [];

      if (isCubism4) {
        // Cubism 4: Get parameter IDs and values
        if (typeof coreModel.getParameterIds === 'function') {
          const paramIds = coreModel.getParameterIds();
          console.log(`📊 Found ${paramIds.length} parameters in Cubism 4 model`);
          
          for (const paramId of paramIds) {
            try {
              const value = coreModel.getParameterValueById(paramId);
              parameters.push({ id: paramId, value });
            } catch (error) {
              console.warn(`Failed to get value for parameter: ${paramId}`);
            }
          }
        }
      } else {
        // Cubism 2: Iterate through parameter indices
        const paramCount = coreModel.getParameterCount ? coreModel.getParameterCount() : 0;
        console.log(`📊 Found ${paramCount} parameters in Cubism 2 model`);
        
        for (let i = 0; i < paramCount; i++) {
          try {
            const paramId = coreModel.getParameterId ? coreModel.getParameterId(i) : `param_${i}`;
            const value = coreModel.getParamFloat ? coreModel.getParamFloat(i) : 0;
            parameters.push({ id: paramId, value });
          } catch (error) {
            console.warn(`Failed to get parameter at index ${i}`);
          }
        }
      }

      // Log first 20 parameters
      console.log('📋 First 20 parameters (ID: current value):');
      parameters.slice(0, 20).forEach((param, index) => {
        console.log(`  ${index + 1}. ${param.id}: ${param.value.toFixed(3)}`);
      });

      if (parameters.length > 20) {
        console.log(`  ... and ${parameters.length - 20} more parameters`);
      }

      // Look for common expression parameters
      const expressionParams = parameters.filter(p => 
        p.id.toLowerCase().includes('eye') ||
        p.id.toLowerCase().includes('mouth') ||
        p.id.toLowerCase().includes('brow') ||
        p.id.toLowerCase().includes('expr') ||
        p.id.toLowerCase().includes('face') ||
        p.id.toLowerCase().includes('smile') ||
        p.id.toLowerCase().includes('angry') ||
        p.id.toLowerCase().includes('sad')
      );

      console.log(`\n🎭 Potential expression parameters (${expressionParams.length} found):`);
      expressionParams.forEach((param, index) => {
        console.log(`  ${index + 1}. ${param.id}: ${param.value.toFixed(3)}`);
      });

    } catch (error) {
      console.error('❌ Parameter listing failed:', error);
    }
  }

  /**
   * Test expression-related parameters
   */
  private async testExpressionParameters(model: Live2DModel): Promise<void> {
    console.log('\n📋 STEP 3: Expression Parameter Testing');
    console.log('---------------------------------------');

    try {
      const coreModel = model.internalModel?.coreModel;
      if (!coreModel) return;

      const isCubism4 = typeof coreModel.setParameterValueById === 'function';
      
      // Common parameter names to test
      const testParams = [
        'ParamEyeLOpen', 'ParamEyeROpen', // Cubism 4 style
        'ParamMouthOpenY', 'ParamMouthForm',
        'ParamBrowLY', 'ParamBrowRY',
        'PARAM_EYE_L_OPEN', 'PARAM_EYE_R_OPEN', // Cubism 2 style
        'PARAM_MOUTH_OPEN_Y', 'PARAM_MOUTH_FORM',
        'PARAM_BROW_L_Y', 'PARAM_BROW_R_Y',
        'ParamAngleX', 'ParamAngleY', 'ParamAngleZ', // Head rotation
        'PARAM_ANGLE_X', 'PARAM_ANGLE_Y', 'PARAM_ANGLE_Z'
      ];

      console.log('🧪 Testing common expression parameters...');
      
      for (const paramName of testParams) {
        try {
          let currentValue = 0;
          let canAccess = false;

          if (isCubism4) {
            try {
              currentValue = coreModel.getParameterValueById(paramName) || 0;
              canAccess = true;
            } catch (error) {
              // Parameter doesn't exist
            }
          } else {
            try {
              const paramIndex = coreModel.getParamIndex(paramName);
              if (paramIndex >= 0) {
                currentValue = coreModel.getParamFloat(paramIndex) || 0;
                canAccess = true;
              }
            } catch (error) {
              // Parameter doesn't exist
            }
          }

          if (canAccess) {
            console.log(`  ✅ ${paramName}: ${currentValue.toFixed(3)} (accessible)`);
          }
        } catch (error) {
          // Skip this parameter
        }
      }

    } catch (error) {
      console.error('❌ Expression parameter testing failed:', error);
    }
  }

  /**
   * Test manual parameter changes to see if they work
   */
  private async testManualParameterChanges(model: Live2DModel): Promise<void> {
    console.log('\n📋 STEP 4: Manual Parameter Change Test');
    console.log('--------------------------------------');

    try {
      const coreModel = model.internalModel?.coreModel;
      if (!coreModel) return;

      const isCubism4 = typeof coreModel.setParameterValueById === 'function';
      
      // Test with a few different parameter names
      const testCases = [
        { name: 'ParamEyeLOpen', testValue: 0.2 }, // Cubism 4
        { name: 'PARAM_EYE_L_OPEN', testValue: 0.2 }, // Cubism 2
        { name: 'ParamMouthOpenY', testValue: 0.8 },
        { name: 'PARAM_MOUTH_OPEN_Y', testValue: 0.8 },
        { name: 'ParamAngleX', testValue: 10 },
        { name: 'PARAM_ANGLE_X', testValue: 10 }
      ];

      console.log('🧪 Testing manual parameter changes (will revert after 2 seconds)...');

      for (const testCase of testCases) {
        try {
          let originalValue = 0;
          let canModify = false;

          // Get original value and test if we can modify it
          if (isCubism4) {
            try {
              originalValue = coreModel.getParameterValueById(testCase.name) || 0;
              coreModel.setParameterValueById(testCase.name, testCase.testValue);
              canModify = true;
            } catch (error) {
              // Parameter doesn't exist or can't be modified
            }
          } else {
            try {
              const paramIndex = coreModel.getParamIndex(testCase.name);
              if (paramIndex >= 0) {
                originalValue = coreModel.getParamFloat(paramIndex) || 0;
                coreModel.setParamFloat(paramIndex, testCase.testValue);
                canModify = true;
              }
            } catch (error) {
              // Parameter doesn't exist or can't be modified
            }
          }

          if (canModify) {
            console.log(`  ✅ Successfully modified ${testCase.name}: ${originalValue.toFixed(3)} → ${testCase.testValue}`);
            console.log(`     👀 LOOK AT THE MODEL NOW - do you see a change?`);
            
            // Revert after 2 seconds
            setTimeout(() => {
              try {
                if (isCubism4) {
                  coreModel.setParameterValueById(testCase.name, originalValue);
                } else {
                  const paramIndex = coreModel.getParamIndex(testCase.name);
                  if (paramIndex >= 0) {
                    coreModel.setParamFloat(paramIndex, originalValue);
                  }
                }
                console.log(`  🔄 Reverted ${testCase.name} back to ${originalValue.toFixed(3)}`);
              } catch (error) {
                console.warn(`Failed to revert ${testCase.name}:`, error);
              }
            }, 2000);

            // Only test one parameter at a time to see clear results
            break;
          }
        } catch (error) {
          // Skip this test case
        }
      }

    } catch (error) {
      console.error('❌ Manual parameter change test failed:', error);
    }
  }

  /**
   * Check built-in expressions
   */
  private async checkBuiltInExpressions(model: Live2DModel): Promise<void> {
    console.log('\n📋 STEP 5: Built-in Expression Check');
    console.log('------------------------------------');

    try {
      const expressionManager = model.internalModel?.motionManager?.expressionManager;
      
      if (expressionManager) {
        console.log('✅ Expression manager found');
        
        if (expressionManager.definitions) {
          console.log(`📊 Built-in expressions: ${expressionManager.definitions.length}`);
          
          expressionManager.definitions.slice(0, 10).forEach((expr: any, index: number) => {
            console.log(`  ${index + 1}. ${expr.name || expr.Name || `Expression ${index}`}`);
          });

          // Test built-in expression
          if (expressionManager.definitions.length > 0) {
            console.log('\n🧪 Testing first built-in expression...');
            try {
              expressionManager.setExpression(0);
              console.log('  ✅ Built-in expression applied - check if model face changed!');
              
              setTimeout(() => {
                try {
                  expressionManager.resetExpression();
                  console.log('  🔄 Built-in expression reset');
                } catch (error) {
                  console.warn('Failed to reset built-in expression:', error);
                }
              }, 3000);
            } catch (error) {
              console.error('  ❌ Failed to apply built-in expression:', error);
            }
          }
        } else {
          console.log('⚠️ No expression definitions found');
        }
      } else {
        console.log('❌ No expression manager found');
      }

    } catch (error) {
      console.error('❌ Built-in expression check failed:', error);
    }
  }

  /**
   * Quick parameter discovery for custom expressions
   */
  discoverExpressionParameters(model: Live2DModel): string[] {
    try {
      const coreModel = model.internalModel?.coreModel;
      if (!coreModel) return [];

      const isCubism4 = typeof coreModel.setParameterValueById === 'function';
      const expressionParams: string[] = [];

      if (isCubism4) {
        if (typeof coreModel.getParameterIds === 'function') {
          const paramIds = coreModel.getParameterIds();
          for (const paramId of paramIds) {
            if (this.isLikelyExpressionParameter(paramId)) {
              expressionParams.push(paramId);
            }
          }
        }
      } else {
        const paramCount = coreModel.getParameterCount ? coreModel.getParameterCount() : 0;
        for (let i = 0; i < paramCount; i++) {
          try {
            const paramId = coreModel.getParameterId ? coreModel.getParameterId(i) : `param_${i}`;
            if (this.isLikelyExpressionParameter(paramId)) {
              expressionParams.push(paramId);
            }
          } catch (error) {
            // Skip failed parameters
          }
        }
      }

      return expressionParams;
    } catch (error) {
      console.error('Failed to discover expression parameters:', error);
      return [];
    }
  }

  /**
   * Check if a parameter name suggests it controls facial expressions
   */
  private isLikelyExpressionParameter(paramId: string): boolean {
    const lowerParamId = paramId.toLowerCase();
    const expressionKeywords = [
      'eye', 'mouth', 'brow', 'cheek', 'smile', 'angry', 'sad', 'happy',
      'expr', 'face', 'emotion', 'mood', 'lip', 'jaw', 'nose'
    ];
    
    return expressionKeywords.some(keyword => lowerParamId.includes(keyword));
  }

  /**
   * Test a specific parameter change with visual feedback
   */
  async testParameterChange(
    model: Live2DModel, 
    parameterId: string, 
    value: number, 
    duration: number = 2000
  ): Promise<boolean> {
    try {
      const coreModel = model.internalModel?.coreModel;
      if (!coreModel) return false;

      const isCubism4 = typeof coreModel.setParameterValueById === 'function';
      let originalValue = 0;
      let success = false;

      console.log(`🧪 Testing parameter: ${parameterId} = ${value}`);

      if (isCubism4) {
        try {
          originalValue = coreModel.getParameterValueById(parameterId) || 0;
          coreModel.setParameterValueById(parameterId, value);
          success = true;
        } catch (error) {
          console.error(`Failed to set Cubism 4 parameter ${parameterId}:`, error);
        }
      } else {
        try {
          const paramIndex = coreModel.getParamIndex(parameterId);
          if (paramIndex >= 0) {
            originalValue = coreModel.getParamFloat(paramIndex) || 0;
            coreModel.setParamFloat(paramIndex, value);
            success = true;
          }
        } catch (error) {
          console.error(`Failed to set Cubism 2 parameter ${parameterId}:`, error);
        }
      }

      if (success) {
        console.log(`✅ Parameter ${parameterId} changed: ${originalValue.toFixed(3)} → ${value}`);
        console.log('👀 CHECK THE MODEL - do you see a visual change?');

        // Revert after specified duration
        setTimeout(() => {
          try {
            if (isCubism4) {
              coreModel.setParameterValueById(parameterId, originalValue);
            } else {
              const paramIndex = coreModel.getParamIndex(parameterId);
              if (paramIndex >= 0) {
                coreModel.setParamFloat(paramIndex, originalValue);
              }
            }
            console.log(`🔄 Reverted ${parameterId} to ${originalValue.toFixed(3)}`);
          } catch (error) {
            console.warn(`Failed to revert ${parameterId}:`, error);
          }
        }, duration);
      }

      return success;
    } catch (error) {
      console.error(`Parameter test failed for ${parameterId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const expressionDebugTool = ExpressionDebugTool.getInstance();