// src/renderer/src/env.d.ts
/// <reference types="vite/client" />

declare global {
  interface Window {
    api: {
      // Existing API methods
      scanModels: () => Promise<AvailableModel[]>;
      getModelFileUrl: (modelPath: string) => Promise<string>;
      openModelsDirectory: () => Promise<void>;
      onModeChanged: (callback: (mode: string) => void) => () => void;
      updateComponentHover: (component: string, isHovering: boolean) => void;
      showContextMenu: () => void;
      
      // CDI3 Discovery API
      findFiles: (pattern: string) => Promise<string[]>;
      findCDI3ForModel: (modelPath: string) => Promise<string | null>;
      readCDI3File: (filePath: string) => Promise<any | null>;
      getCDI3Info: (filePath: string) => Promise<{
        name: string;
        version: string;
        parameterCount: number;
        fileSize: number;
      } | null>;
      
      // OBS API (existing)
      obs?: {
        notifyCanvasReady: () => void;
        // ... other OBS methods
      };
      
      // File system API for reading files
      fs?: {
        readFile: (filePath: string, options?: { encoding?: 'utf8' }) => Promise<string | Uint8Array>;
      };
    };
    
    // Enhanced Live2D global API with custom expressions
    live2d?: {
      // Original API for backward compatibility
      expression: (name?: string | number) => void;
      setExpression: (name?: string | number) => void;
      setRandomExpression: () => void;
      getExpressions: () => string[];
      
      // Enhanced API for custom expressions
      enhancedExpression: {
        setExpression: (
          name: string, 
          intensity?: number, 
          transitionDuration?: number, 
          blendMode?: ExpressionBlendMode
        ) => Promise<void>;
        
        setParameterValue: (
          parameterId: string, 
          value: number, 
          weight?: number, 
          blendMode?: ExpressionBlendMode
        ) => void;
        
        getParameterValue: (parameterId: string) => number;
        
        blendExpressions: (
          expr1: string, 
          expr2: string, 
          blendFactor: number, 
          blendMode?: ExpressionBlendMode
        ) => void;
        
        resetExpression: () => void;
        getExpressions: () => ExpressionDefinition[];
        getParameters: () => ExpressionParameter[];
        getState: () => ExpressionState | null;
        
        captureCurrentExpression: (name: string) => ExpressionDefinition | null;
        exportExpression: (name: string) => string | null;
        importExpression: (json: string) => boolean;
        setDefaultFadeDuration: (duration: number) => void;
        
        // Custom expression methods
        applyCustomExpression: (name: string, intensity?: number, duration?: number) => Promise<boolean>;
        getCustomExpressions: () => string[];
        isCustomExpressionAvailable: (name: string) => boolean;
      };
    };
    
    // File system API
    fs: {
      readFile: (
        filePath: string, 
        options?: { encoding?: 'utf8' | 'binary' }
      ) => Promise<string | Uint8Array>;
    };
  }
}

// Model and parameter type definitions
interface AvailableModel {
  name: string;
  directory: string;
  modelFile: string;
  hasTextures: boolean;
  hasMotions: boolean;
  hasCDI3?: boolean;
  cdi3File?: string;
}

// Expression system types
enum ExpressionBlendMode {
  ADD = "Add",
  MULTIPLY = "Multiply", 
  OVERWRITE = "Overwrite"
}

interface ExpressionParameter {
  id: string;
  value: number;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  blendMode: ExpressionBlendMode;
  index: number;
}

interface ExpressionDefinition {
  name: string;
  index: number;
  parameters: ExpressionParameter[];
  fadeDuration?: number;
}

interface ExpressionState {
  currentExpression: string | null;
  targetExpression: string | null;
  transitionProgress: number;
  intensity: number;
  isTransitioning: boolean;
}

export {};

/**
 * Extended API interface for TypeScript development
 */
export interface ExtendedWindowAPI {
  // CDI3 Discovery Methods
  findFiles: (pattern: string) => Promise<string[]>;
  findCDI3ForModel: (modelPath: string) => Promise<string | null>;
  readCDI3File: (filePath: string) => Promise<CDI3FileData | null>;
  getCDI3Info: (filePath: string) => Promise<CDI3FileInfo | null>;
  
  // Model Management
  scanModels: () => Promise<AvailableModelWithCDI3[]>;
  getModelFileUrl: (modelPath: string) => Promise<string>;
  openModelsDirectory: () => Promise<void>;
  
  // Event Handlers
  onModeChanged: (callback: (mode: string) => void) => () => void;
  updateComponentHover: (component: string, isHovering: boolean) => void;
  showContextMenu: () => void;
  
  // Custom Expression Integration
  notifyExpressionsChanged: (expressions: string[]) => void;
  notifyModelChanged: (modelName: string, hasCDI3: boolean) => void;
}

export interface CDI3FileData {
  Version: string;
  Type: string;
  Name: string;
  Parameters: CDI3Parameter[];
  Groups?: any[];
  ParameterGroups?: any[];
}

export interface CDI3Parameter {
  Id: string;
  Name: string;
  DefaultValue: number;
  MinValue: number;
  MaxValue: number;
  Index?: number;
  Description?: string;
  Category?: string;
}

export interface CDI3FileInfo {
  name: string;
  version: string;
  parameterCount: number;
  fileSize: number;
}

export interface AvailableModelWithCDI3 extends AvailableModel {
  hasCDI3: boolean;
  cdi3File?: string;
  cdi3Info?: CDI3FileInfo;
}

/**
 * Custom Expression WebSocket Message Types
 */
export interface CustomExpressionWebSocketMessages {
  // Incoming messages (from backend)
  custom_expression: {
    type: 'custom_expression';
    name: string;
    intensity?: number;
    transition_duration?: number;
  };
  
  expression_list_request: {
    type: 'expression_list_request';
  };
  
  expression_capabilities_request: {
    type: 'expression_capabilities_request';
  };
  
  reset_expression: {
    type: 'reset_expression';
  };
  
  // Outgoing messages (to backend)
  custom_expression_response: {
    type: 'custom_expression_response';
    success: boolean;
    expression?: string;
    intensity?: number;
    transition_duration?: number;
    error?: string;
  };
  
  expression_list_response: {
    type: 'expression_list_response';
    expressions: string[];
    model_name?: string;
    cdi3_enhanced?: boolean;
    error?: string;
  };
  
  expression_capabilities_response: {
    type: 'expression_capabilities_response';
    capabilities: {
      custom_expressions: boolean;
      cdi3_enhanced: boolean;
      total_parameters: number;
      expression_parameters: number;
      available_expressions: string[];
      model_name?: string;
    };
    error?: string;
  };
  
  expressions_changed: {
    type: 'expressions_changed';
    expressions: string[];
    count: number;
    cdi3_enhanced: boolean;
    timestamp: number;
  };
  
  model_changed: {
    type: 'model_changed';
    model_name: string;
    cdi3_enhanced: boolean;
    timestamp: number;
  };
  
  expression_test: {
    type: 'expression_test';
    expression: string;
    intensity: number;
    timestamp: number;
  };
}

/**
 * Type guard for checking if window.api has CDI3 support
 */
export function hasCDI3Support(api: any): api is ExtendedWindowAPI {
  return api && 
         typeof api.findCDI3ForModel === 'function' &&
         typeof api.readCDI3File === 'function' &&
         typeof api.getCDI3Info === 'function';
}

/**
 * Type guard for checking if a model has CDI3 support
 */
export function isModelWithCDI3(model: any): model is AvailableModelWithCDI3 {
  return model && 
         typeof model.hasCDI3 === 'boolean' &&
         (model.hasCDI3 === false || typeof model.cdi3File === 'string');
}

/**
 * Utility type for custom expression event handlers
 */
export type CustomExpressionEventHandler<T = any> = (data: T) => void | Promise<void>;

/**
 * Custom expression integration hooks interface
 */
export interface CustomExpressionHooks {
  onExpressionApplied?: CustomExpressionEventHandler<{ name: string; intensity: number }>;
  onExpressionCreated?: CustomExpressionEventHandler<{ name: string; parameterCount: number }>;
  onExpressionDeleted?: CustomExpressionEventHandler<{ name: string }>;
  onModelChanged?: CustomExpressionEventHandler<{ modelName: string; hasCDI3: boolean }>;
  onCDI3Detected?: CustomExpressionEventHandler<{ modelName: string; parameterCount: number }>;
}