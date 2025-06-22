// src/renderer/src/types/custom-expression-types.ts

/**
 * Interface for a discovered Live2D model parameter
 */
export interface ModelParameter {
  /** Parameter name/ID */
  id: string;
  /** Human-readable parameter name */
  name: string;
  /** Parameter index in the model */
  index: number;
  /** Current value */
  value: number;
  /** Default value */
  defaultValue: number;
  /** Minimum value */
  minValue: number;
  /** Maximum value */
  maxValue: number;
  /** Whether this parameter is typically used for expressions */
  isExpressionParameter?: boolean;
}

/**
 * Interface for a custom expression mapping
 */
export interface CustomExpressionMapping {
  /** Unique ID for this mapping */
  id: string;
  /** User-defined expression name */
  name: string;
  /** Description of the expression */
  description?: string;
  /** Parameter configurations for this expression */
  parameters: CustomExpressionParameter[];
  /** Whether this expression is enabled */
  enabled: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  modifiedAt: Date;
}

/**
 * Interface for parameter configuration within a custom expression
 */
export interface CustomExpressionParameter {
  /** Parameter ID to control */
  parameterId: string;
  /** Parameter name for display */
  parameterName: string;
  /** Target value for this parameter (0.0-1.0 typically) */
  targetValue: number;
  /** Weight/intensity of this parameter (0.0-1.0) */
  weight: number;
  /** Blend mode for this parameter */
  blendMode: 'overwrite' | 'add' | 'multiply';
}

/**
 * Interface for custom expression configuration
 */
export interface CustomExpressionConfig {
  /** List of custom expression mappings */
  expressions: CustomExpressionMapping[];
  /** Whether custom expressions are enabled for this model */
  enabled: boolean;
  /** Version of the configuration format */
  version: number;
}

/**
 * Interface for parameter discovery result
 */
export interface ParameterDiscoveryResult {
  /** All discovered parameters */
  parameters: ModelParameter[];
  /** Parameters that appear to be expression-related */
  expressionParameters: ModelParameter[];
  /** Total parameter count */
  totalCount: number;
  /** Discovery timestamp */
  discoveredAt: Date;
}

/**
 * Type for expression mapping validation result
 */
export interface ExpressionMappingValidation {
  /** Whether the mapping is valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Utility type for expression mapping creation
 */
export interface CreateCustomExpressionRequest {
  /** Expression name */
  name: string;
  /** Expression description */
  description?: string;
  /** Parameter configurations */
  parameters: Omit<CustomExpressionParameter, 'parameterName'>[];
}

/**
 * Default values for custom expression configuration
 */
export const DEFAULT_CUSTOM_EXPRESSION_CONFIG: CustomExpressionConfig = {
  expressions: [],
  enabled: true,
  version: 1,
};

/**
 * Common expression parameter naming patterns to help identify expression-related parameters
 */
export const EXPRESSION_PARAMETER_PATTERNS = [
  // Facial expressions
  /smile/i,
  /happy/i,
  /sad/i,
  /angry/i,
  /surprised/i,
  /fear/i,
  /disgust/i,
  
  // Eye expressions
  /eye.*open/i,
  /eye.*close/i,
  /wink/i,
  /blink/i,
  /love.*eye/i,
  /heart.*eye/i,
  
  // Mouth expressions
  /mouth/i,
  /lips/i,
  /kiss/i,
  /pout/i,
  
  // Emotional states
  /blush/i,
  /shy/i,
  /embarrass/i,
  /confident/i,
  /tired/i,
  /sleepy/i,
  /excited/i,
  /nervous/i,
  
  // Special expressions
  /special/i,
  /unique/i,
  /custom/i,
  
  // Common Live2D parameter patterns
  /param.*expression/i,
  /param.*emotion/i,
  /param.*face/i,
];

/**
 * Utility function to check if a parameter name suggests it's expression-related
 */
export function isLikelyExpressionParameter(parameterName: string): boolean {
  return EXPRESSION_PARAMETER_PATTERNS.some(pattern => pattern.test(parameterName));
}

/**
 * Utility function to generate a unique ID for custom expressions
 */
export function generateCustomExpressionId(): string {
  return `custom_expr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Utility function to validate a custom expression mapping
 */
export function validateCustomExpressionMapping(mapping: CustomExpressionMapping): ExpressionMappingValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate basic properties
  if (!mapping.name || mapping.name.trim().length === 0) {
    errors.push('Expression name is required');
  }

  if (mapping.name && mapping.name.length > 50) {
    warnings.push('Expression name is quite long (over 50 characters)');
  }

  if (!mapping.parameters || mapping.parameters.length === 0) {
    errors.push('At least one parameter must be configured');
  }

  // Validate parameters
  mapping.parameters.forEach((param, index) => {
    if (!param.parameterId || param.parameterId.trim().length === 0) {
      errors.push(`Parameter ${index + 1}: Parameter ID is required`);
    }

    if (param.targetValue < 0 || param.targetValue > 1) {
      warnings.push(`Parameter ${index + 1}: Target value ${param.targetValue} is outside normal range (0.0-1.0)`);
    }

    if (param.weight < 0 || param.weight > 1) {
      errors.push(`Parameter ${index + 1}: Weight must be between 0.0 and 1.0`);
    }

    if (!['overwrite', 'add', 'multiply'].includes(param.blendMode)) {
      errors.push(`Parameter ${index + 1}: Invalid blend mode "${param.blendMode}"`);
    }
  });

  // Check for duplicate parameter IDs within the same expression
  const parameterIds = mapping.parameters.map(p => p.parameterId);
  const duplicateIds = parameterIds.filter((id, index) => parameterIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    errors.push(`Duplicate parameter IDs found: ${duplicateIds.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}