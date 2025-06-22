// src/renderer/src/utils/test-custom-expressions.ts
// Test script to verify custom expressions are working properly

import { customExpressionManager } from '@/services/custom-expression-manager';
import { persistentParameterService } from '@/services/persistent-parameter-service';

/**
 * Test utility for verifying custom expression parameter application
 */
export class CustomExpressionTester {
  /**
   * Run a comprehensive test of custom expressions
   */
  static async runTest(): Promise<void> {
    console.log('🧪 Starting Custom Expression Test...');
    
    // Check if manager is ready
    if (!customExpressionManager.isReady()) {
      console.error('❌ Custom expression manager not ready. Please load a model first.');
      return;
    }

    // Get available custom expressions
    const expressions = customExpressionManager.getCustomExpressions();
    const enabledExpressions = expressions.filter(expr => expr.enabled);
    
    console.log(`📋 Found ${expressions.length} custom expressions (${enabledExpressions.length} enabled)`);
    
    if (enabledExpressions.length === 0) {
      console.warn('⚠️ No enabled custom expressions found. Please create some in the settings.');
      return;
    }

    // Test each enabled expression
    for (const expression of enabledExpressions) {
      console.log(`\n🎭 Testing expression: ${expression.name}`);
      console.log(`  Parameters: ${expression.parameters.length}`);
      
      // Apply the expression
      const success = await customExpressionManager.applyCustomExpression(
        expression.name,
        1.0,  // Full intensity
        1000  // 1 second transition
      );
      
      if (success) {
        console.log(`  ✅ Expression applied successfully`);
        
        // Log parameter details
        expression.parameters.forEach(param => {
          console.log(`    - ${param.parameterId}: ${param.targetValue} (${param.blendMode})`);
        });
        
        // Wait to see the effect
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.error(`  ❌ Failed to apply expression`);
      }
    }
    
    // Reset to default
    console.log('\n🔄 Resetting to default expression...');
    await customExpressionManager.resetToDefault();
    
    console.log('\n✅ Custom Expression Test Complete!');
  }

  /**
   * Debug current parameter state
   */
  static debugParameterState(): void {
    console.log('\n🔍 Current Parameter State:');
    
    // Check if we have a model
    const model = (window as any).currentLive2DModel;
    if (!model) {
      console.error('❌ No Live2D model found');
      return;
    }

    // Get persistent parameter service stats
    const stats = persistentParameterService.getStatistics();
    console.log('📊 Persistent Parameter Service Stats:', stats);
    
    // Debug parameter overrides for the current model
    persistentParameterService.debugParameterOverrides(model);
    
    // Check active expression
    const activeExpression = customExpressionManager.getActiveExpression();
    if (activeExpression) {
      console.log(`🎭 Active Expression: ${activeExpression.name} (intensity: ${activeExpression.intensity})`);
    } else {
      console.log('😐 No active custom expression');
    }
  }

  /**
   * Test a specific custom expression by name
   */
  static async testExpression(name: string, intensity: number = 1.0): Promise<void> {
    console.log(`🎭 Testing expression: ${name} at intensity ${intensity}`);
    
    const success = await customExpressionManager.applyCustomExpression(name, intensity);
    
    if (success) {
      console.log('✅ Expression applied successfully');
      this.debugParameterState();
    } else {
      console.error('❌ Failed to apply expression');
    }
  }

  /**
   * List all available expressions
   */
  static listExpressions(): void {
    const expressions = customExpressionManager.getCustomExpressions();
    
    console.log('\n📋 Available Custom Expressions:');
    expressions.forEach((expr, index) => {
      const status = expr.enabled ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${expr.name} - ${expr.parameters.length} parameters`);
    });
  }

  /**
   * Quick parameter check - verifies if parameters are being applied
   */
  static quickParameterCheck(): void {
    const model = (window as any).currentLive2DModel;
    if (!model || !model.internalModel?.coreModel) {
      console.error('❌ No Live2D model available');
      return;
    }

    const coreModel = model.internalModel.coreModel;
    const isCubism4 = typeof coreModel.setParameterValueById === 'function';
    
    console.log(`\n🔍 Quick Parameter Check (${isCubism4 ? 'Cubism 4' : 'Cubism 2'} model):`);
    
    // Common expression parameters to check
    const testParams = [
      'ParamEyeLOpen', 'ParamEyeROpen', 'ParamMouthOpenY',
      'PARAM_EYE_L_OPEN', 'PARAM_EYE_R_OPEN', 'PARAM_MOUTH_OPEN_Y'
    ];
    
    testParams.forEach(paramId => {
      try {
        let value;
        if (isCubism4) {
          value = coreModel.getParameterValueById(paramId);
        } else {
          const index = coreModel.getParamIndex(paramId);
          if (index >= 0) {
            value = coreModel.getParamFloat(index);
          }
        }
        
        if (value !== undefined) {
          console.log(`  ${paramId}: ${value.toFixed(3)}`);
        }
      } catch (e) {
        // Parameter doesn't exist
      }
    });
  }
}

// Make available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).CustomExpressionTester = CustomExpressionTester;
  
  console.log('🧪 Custom Expression Tester loaded! Available commands:');
  console.log('  CustomExpressionTester.runTest() - Run comprehensive test');
  console.log('  CustomExpressionTester.listExpressions() - List all expressions');
  console.log('  CustomExpressionTester.testExpression("name") - Test specific expression');
  console.log('  CustomExpressionTester.debugParameterState() - Debug current state');
  console.log('  CustomExpressionTester.quickParameterCheck() - Check parameter values');
}