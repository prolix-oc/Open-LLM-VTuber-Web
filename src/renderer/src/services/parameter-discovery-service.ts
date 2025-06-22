// src/renderer/src/services/parameter-discovery-service.ts
import { Live2DModel } from "pixi-live2d-display-lipsyncpatch";
import {
  ModelParameter,
  ParameterDiscoveryResult,
  isLikelyExpressionParameter,
} from "@/types/custom-expression-types";

/**
 * CDI3 Parameter Interface - Represents parameters from Cubism CDI3 files
 */
export interface CDI3Parameter {
  Id: string;
  GroupId?: string;
  Name: string;
  DefaultValue?: number;
  MinValue?: number;
  MaxValue?: number;
  Index?: number;
  Description?: string;
  Category?: string;
}

/**
 * CDI3 File Structure Interface - Updated to match actual CDI3 format
 */
export interface CDI3FileData {
  Version: number; // Changed from string to number
  Type?: string;
  Name?: string;
  Parameters: CDI3Parameter[];
  Groups?: any[];
  ParameterGroups?: any[];
  Parts?: any[];
  CombinedParameters?: any[];
}

/**
 * Enhanced Service for discovering and analyzing Live2D model parameters with CDI3 support
 */
export class ParameterDiscoveryService {
  private static instance: ParameterDiscoveryService;
  private cachedResults: Map<string, ParameterDiscoveryResult> = new Map();
  private cdi3Cache: Map<string, CDI3FileData> = new Map();

  private constructor() {}

  static getInstance(): ParameterDiscoveryService {
    if (!ParameterDiscoveryService.instance) {
      ParameterDiscoveryService.instance = new ParameterDiscoveryService();
    }
    return ParameterDiscoveryService.instance;
  }

  /**
   * Load and parse a CDI3 file
   */
  async loadCDI3File(filePath: string): Promise<CDI3FileData | null> {
    try {
      // Check cache first
      if (this.cdi3Cache.has(filePath)) {
        console.log(`📁 Using cached CDI3 file: ${filePath}`);
        return this.cdi3Cache.get(filePath)!;
      }

      console.log(`📁 Loading CDI3 file: ${filePath}`);
      
      // Try different approaches to read the file
      let fileContent: string;
      
      try {
        // Try the primary window.fs API approach
        console.log(`🔧 Attempting to read with window.fs.readFile: ${filePath}`);
        fileContent = await window.fs.readFile(filePath, { encoding: 'utf8' }) as string;
        console.log(`✅ Successfully read file with window.fs.readFile, length: ${fileContent.length}`);
      } catch (fsError) {
        console.warn(`❌ Failed to read with window.fs.readFile:`, fsError);
        
        try {
          // Try without encoding option
          console.log(`🔧 Attempting to read with window.fs.readFile (no encoding): ${filePath}`);
          const buffer = await window.fs.readFile(filePath);
          fileContent = new TextDecoder('utf-8').decode(buffer);
          console.log(`✅ Successfully read file without encoding option, length: ${fileContent.length}`);
        } catch (fsError2) {
          console.warn(`❌ Failed to read without encoding option:`, fsError2);
          
          // Fallback to fetch for file:// URLs
          console.log(`🔧 Attempting fallback with fetch: ${filePath}`);
          const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch CDI3 file: ${response.statusText}`);
          }
          fileContent = await response.text();
          console.log(`✅ Successfully read file with fetch, length: ${fileContent.length}`);
        }
      }

      console.log(`📄 File content preview: ${fileContent.substring(0, 200)}...`);

      const cdi3Data: CDI3FileData = JSON.parse(fileContent);
      console.log(`📊 Parsed CDI3 data - Version: ${cdi3Data.Version}, Parameters: ${cdi3Data.Parameters?.length || 0}`);
      
      // Validate CDI3 structure
      if (!cdi3Data.Parameters || !Array.isArray(cdi3Data.Parameters)) {
        throw new Error('Invalid CDI3 file: missing Parameters array');
      }

      // Add index to parameters if missing
      cdi3Data.Parameters.forEach((param, index) => {
        if (param.Index === undefined) {
          param.Index = index;
        }
        // Set default values if missing (CDI3 files may not have value ranges)
        if (param.DefaultValue === undefined) param.DefaultValue = 0;
        if (param.MinValue === undefined) param.MinValue = 0;
        if (param.MaxValue === undefined) param.MaxValue = 1;
      });

      // Cache the result
      this.cdi3Cache.set(filePath, cdi3Data);
      
      console.log(`✅ CDI3 file loaded: ${cdi3Data.Parameters.length} parameters from ${cdi3Data.Name || 'unnamed model'}`);
      return cdi3Data;
    } catch (error) {
      console.error(`❌ Failed to load CDI3 file: ${filePath}`, error);
      return null;
    }
  }

  /**
   * Discover CDI3 file path for a local model using improved pattern matching
   * This method handles both Cubism 2.x (.model.json) and 3.x/4.x (.model3.json) models
   */
  async findCDI3FileForModel(modelPath: string): Promise<string | null> {
    try {
      console.log(`🔍 Looking for CDI3 file for model: ${modelPath}`);
      
      // More explicit approach: Handle specific known patterns
      let primaryCDI3Path: string;
      
      if (modelPath.includes('.model3.json')) {
        primaryCDI3Path = modelPath.replace('.model3.json', '.cdi3.json');
        console.log(`🔧 Cubism 3.x/4.x transformation: ${modelPath} -> ${primaryCDI3Path}`);
      } else if (modelPath.includes('.model.json')) {
        primaryCDI3Path = modelPath.replace('.model.json', '.cdi.json');
        console.log(`🔧 Cubism 2.x transformation: ${modelPath} -> ${primaryCDI3Path}`);
      } else if (modelPath.includes('.model3')) {
        primaryCDI3Path = modelPath.replace('.model3', '.cdi3');
        console.log(`🔧 Cubism 3.x/4.x (no .json) transformation: ${modelPath} -> ${primaryCDI3Path}`);
      } else if (modelPath.includes('.model')) {
        primaryCDI3Path = modelPath.replace('.model', '.cdi');
        console.log(`🔧 Generic .model transformation: ${modelPath} -> ${primaryCDI3Path}`);
      } else {
        console.warn(`⚠️ Unrecognized model file pattern: ${modelPath}`);
        primaryCDI3Path = modelPath; // This will fail the file test and move to fallbacks
      }
      
      // Verify the transformation actually changed the path
      if (primaryCDI3Path === modelPath) {
        console.warn(`⚠️ Primary transformation did not change the path! Original: ${modelPath}, Result: ${primaryCDI3Path}`);
      }
      
      // Try the primary path first
      console.log(`🧪 Testing primary path: ${primaryCDI3Path}`);
      if (await this.testFileExists(primaryCDI3Path)) {
        console.log(`✅ Found CDI3 file using primary pattern: ${primaryCDI3Path}`);
        return primaryCDI3Path;
      }
      console.log(`❌ Primary path not found: ${primaryCDI3Path}`);

      // Secondary approach: Common naming patterns
      const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/'));
      const modelFileName = modelPath.substring(modelPath.lastIndexOf('/') + 1);
      
      console.log(`📂 Model directory: ${modelDir}`);
      console.log(`📄 Model filename: ${modelFileName}`);
      
      // Extract base name without extension for fallback patterns
      const baseName = modelFileName.replace(/\.(model\d*\.json|model\d*|json)$/i, '');
      console.log(`🏷️ Base name extracted: ${baseName}`);
      
      const fallbackPaths = [
        // Direct .cdi3.json variants using the actual model name (not folder name)
        `${modelDir}/${baseName}.cdi3.json`,
        `${modelDir}/${baseName}.cdi.json`,
        // Without .json extension
        `${modelDir}/${baseName}.cdi3`,
        `${modelDir}/${baseName}.cdi`,
        // Common generic names in the directory
        `${modelDir}/model.cdi3.json`,
        `${modelDir}/model.cdi.json`,
        `${modelDir}/parameters.cdi3.json`,
        `${modelDir}/parameters.cdi.json`,
      ];

      console.log(`🔄 Testing ${fallbackPaths.length} fallback paths:`);
      fallbackPaths.forEach((path, index) => {
        console.log(`   ${index + 1}. ${path}`);
      });

      // Test each fallback path
      for (const path of fallbackPaths) {
        console.log(`🧪 Testing fallback path: ${path}`);
        if (await this.testFileExists(path)) {
          console.log(`✅ Found CDI3 file using fallback pattern: ${path}`);
          return path;
        }
        console.log(`❌ Fallback path not found: ${path}`);
      }

      // Try directory scanning if API is available
      if (window.api?.findFiles) {
        console.log(`🔍 Attempting directory scan with window.api.findFiles`);
        try {
          const searchPatterns = [
            `${modelDir}/*.cdi3.json`,
            `${modelDir}/*.cdi.json`,
            `${modelDir}/*.cdi3`,
            `${modelDir}/*.cdi`,
          ];

          for (const pattern of searchPatterns) {
            console.log(`🧪 Scanning with pattern: ${pattern}`);
            const files = await window.api.findFiles(pattern);
            if (files && files.length > 0) {
              console.log(`✅ Found CDI3 file via directory scan: ${files[0]}`);
              return files[0];
            }
            console.log(`❌ No files found with pattern: ${pattern}`);
          }
        } catch (error) {
          console.warn(`Failed to scan directory for CDI3 files:`, error);
        }
      } else {
        console.log(`ℹ️ window.api.findFiles not available, skipping directory scan`);
      }

      console.log(`❌ No CDI3 file found for model: ${modelPath}`);
      return null;
    } catch (error) {
      console.error('Failed to find CDI3 file:', error);
      return null;
    }
  }

  /**
   * Test if a file exists asynchronously with multiple fallback methods
   */
  private async testFileExists(filePath: string): Promise<boolean> {
    try {
      console.log(`🔍 Testing file existence: ${filePath}`);
      
      // Try primary method with window.fs
      try {
        await window.fs.readFile(filePath, { encoding: 'utf8' });
        console.log(`✅ File exists (window.fs with encoding): ${filePath}`);
        return true;
      } catch (fsError) {
        console.log(`❌ File not found with encoding option: ${filePath}`, fsError);
        
        // Try without encoding option
        try {
          await window.fs.readFile(filePath);
          console.log(`✅ File exists (window.fs without encoding): ${filePath}`);
          return true;
        } catch (fsError2) {
          console.log(`❌ File not found without encoding: ${filePath}`, fsError2);
          
          // Try fetch as last resort
          try {
            const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
            const response = await fetch(fileUrl);
            const exists = response.ok;
            console.log(`${exists ? '✅' : '❌'} File existence via fetch: ${filePath} - ${response.status}`);
            return exists;
          } catch (fetchError) {
            console.log(`❌ File not found via fetch: ${filePath}`, fetchError);
            return false;
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error testing file existence: ${filePath}`, error);
      return false;
    }
  }

  /**
   * Convert CDI3 parameters to ModelParameter format
   */
  private convertCDI3ToModelParameters(cdi3Data: CDI3FileData): ModelParameter[] {
    return cdi3Data.Parameters.map((param, index) => {
      const displayName = param.Name || this.createDisplayName(param.Id);
      const isExpressionParam = isLikelyExpressionParameter(param.Id) || 
                              isLikelyExpressionParameter(param.Name || '');

      return {
        id: param.Id,
        name: displayName,
        index: param.Index !== undefined ? param.Index : index,
        value: param.DefaultValue,
        defaultValue: param.DefaultValue,
        minValue: param.MinValue,
        maxValue: param.MaxValue,
        isExpressionParameter: isExpressionParam,
        // Add CDI3-specific metadata
        cdi3Source: true,
        cdi3Description: param.Description,
        cdi3Category: param.Category,
      } as ModelParameter & {
        cdi3Source?: boolean;
        cdi3Description?: string;
        cdi3Category?: string;
      };
    });
  }

  /**
   * Enhanced parameter discovery with CDI3 support
   */
  async discoverParameters(model: Live2DModel, modelName?: string, modelPath?: string): Promise<ParameterDiscoveryResult> {
    const cacheKey = modelName || 'unknown_model';
    
    // Return cached result if available and not CDI3-enhanced
    const cached = this.cachedResults.get(cacheKey);
    if (cached && !modelPath) {
      console.log(`📊 Using cached parameter discovery for ${cacheKey}`);
      return cached;
    }

    console.log(`🔍 Enhanced parameter discovery for model: ${cacheKey}`);

    try {
      const parameters: ModelParameter[] = [];
      let cdi3Data: CDI3FileData | null = null;

      // Try to load CDI3 file for additional parameter information
      if (modelPath) {
        const cdi3Path = await this.findCDI3FileForModel(modelPath);
        if (cdi3Path) {
          cdi3Data = await this.loadCDI3File(cdi3Path);
          if (cdi3Data) {
            console.log(`✨ CDI3 data loaded: ${cdi3Data.Parameters.length} parameters`);
          }
        } else {
          console.log(`📝 No CDI3 file found for model: ${modelPath}`);
        }
      }

      // Get parameters from the Live2D model
      const internalModel = model.internalModel;
      if (internalModel && internalModel._model) {
        const modelInstance = internalModel._model;
        const parameterCount = modelInstance.getParameterCount();

        console.log(`📊 Found ${parameterCount} parameters in Live2D model`);

        for (let i = 0; i < parameterCount; i++) {
          try {
            const parameterId = modelInstance.getParameterId(i);
            const currentValue = modelInstance.getParameterValue(i);
            const defaultValue = modelInstance.getParameterDefaultValue(i);
            const minValue = modelInstance.getParameterMinimumValue(i);
            const maxValue = modelInstance.getParameterMaximumValue(i);

            // Check if we have CDI3 data for this parameter
            const cdi3Param = cdi3Data?.Parameters.find(p => p.Id === parameterId);
            
            let displayName: string;
            let isExpressionParam: boolean;
            
            if (cdi3Param) {
              // Use CDI3 information if available
              displayName = cdi3Param.Name || this.createDisplayName(parameterId);
              isExpressionParam = isLikelyExpressionParameter(parameterId) || 
                                isLikelyExpressionParameter(cdi3Param.Name || '');
            } else {
              // Fallback to automatic detection
              displayName = this.createDisplayName(parameterId);
              isExpressionParam = isLikelyExpressionParameter(parameterId);
            }

            const parameter: ModelParameter & {
              cdi3Source?: boolean;
              cdi3Description?: string;
              cdi3Category?: string;
            } = {
              id: parameterId,
              name: displayName,
              index: i,
              value: currentValue,
              defaultValue: defaultValue,
              minValue: minValue,
              maxValue: maxValue,
              isExpressionParameter: isExpressionParam,
            };

            // Add CDI3 metadata if available
            if (cdi3Param) {
              parameter.cdi3Source = true;
              parameter.cdi3Description = cdi3Param.Description;
              parameter.cdi3Category = cdi3Param.Category;
            }

            parameters.push(parameter);

            if (isExpressionParam) {
              console.log(`🎭 Found expression parameter: ${parameterId} (${displayName})`);
            }
          } catch (error) {
            console.warn(`Failed to get parameter info for index ${i}:`, error);
          }
        }
      }

      // Add any CDI3-only parameters that weren't found in the model
      if (cdi3Data) {
        const modelParameterIds = new Set(parameters.map(p => p.id));
        const cdi3OnlyParams = cdi3Data.Parameters.filter(p => !modelParameterIds.has(p.Id));
        
        if (cdi3OnlyParams.length > 0) {
          console.log(`📋 Found ${cdi3OnlyParams.length} CDI3-only parameters`);
          const convertedParams = this.convertCDI3ToModelParameters({ ...cdi3Data, Parameters: cdi3OnlyParams });
          parameters.push(...convertedParams);
        }
      }

      // Filter expression parameters
      const expressionParameters = parameters.filter(p => p.isExpressionParameter);

      const result: ParameterDiscoveryResult = {
        parameters,
        expressionParameters,
        totalCount: parameters.length,
        discoveredAt: new Date(),
        cdi3Enhanced: !!cdi3Data,
        cdi3ModelName: cdi3Data?.Name,
      } as ParameterDiscoveryResult & {
        cdi3Enhanced?: boolean;
        cdi3ModelName?: string;
      };

      // Cache the result
      this.cachedResults.set(cacheKey, result);

      console.log(`✅ Enhanced parameter discovery complete: ${parameters.length} total, ${expressionParameters.length} expression-related${cdi3Data ? ' (CDI3 enhanced)' : ''}`);

      return result;
    } catch (error) {
      console.error('Failed to discover parameters:', error);
      
      // Return empty result on error
      const errorResult: ParameterDiscoveryResult = {
        parameters: [],
        expressionParameters: [],
        totalCount: 0,
        discoveredAt: new Date(),
      };

      return errorResult;
    }
  }

  /**
   * Get parameters grouped by CDI3 category
   */
  getParametersByCategory(modelName?: string): Record<string, ModelParameter[]> {
    const cacheKey = modelName || 'unknown_model';
    const cachedResult = this.cachedResults.get(cacheKey);
    
    if (!cachedResult) {
      return {};
    }

    const categorized: Record<string, ModelParameter[]> = {
      'Expression': [],
      'Pose': [],
      'Movement': [],
      'Other': []
    };

    cachedResult.parameters.forEach(param => {
      const paramWithMeta = param as ModelParameter & {
        cdi3Category?: string;
      };
      
      if (param.isExpressionParameter) {
        categorized['Expression'].push(param);
      } else if (paramWithMeta.cdi3Category) {
        const category = paramWithMeta.cdi3Category;
        if (!categorized[category]) {
          categorized[category] = [];
        }
        categorized[category].push(param);
      } else {
        // Auto-categorize based on parameter name patterns
        const name = param.name.toLowerCase();
        if (name.includes('angle') || name.includes('rotation') || name.includes('turn')) {
          categorized['Movement'].push(param);
        } else if (name.includes('body') || name.includes('pose') || name.includes('position')) {
          categorized['Pose'].push(param);
        } else {
          categorized['Other'].push(param);
        }
      }
    });

    // Remove empty categories
    Object.keys(categorized).forEach(key => {
      if (categorized[key].length === 0) {
        delete categorized[key];
      }
    });

    return categorized;
  }

  /**
   * Search parameters with CDI3 enhancement
   */
  searchParameters(query: string, modelName?: string): ModelParameter[] {
    const cacheKey = modelName || 'unknown_model';
    const cachedResult = this.cachedResults.get(cacheKey);
    
    if (!cachedResult) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    return cachedResult.parameters.filter(p => {
      const paramWithMeta = p as ModelParameter & {
        cdi3Description?: string;
        cdi3Category?: string;
      };
      
      return (
        p.id.toLowerCase().includes(lowerQuery) || 
        p.name.toLowerCase().includes(lowerQuery) ||
        (paramWithMeta.cdi3Description && paramWithMeta.cdi3Description.toLowerCase().includes(lowerQuery)) ||
        (paramWithMeta.cdi3Category && paramWithMeta.cdi3Category.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * Get parameter with CDI3 metadata by ID
   */
  getParameterById(parameterId: string, modelName?: string): (ModelParameter & {
    cdi3Source?: boolean;
    cdi3Description?: string;
    cdi3Category?: string;
  }) | null {
    const cacheKey = modelName || 'unknown_model';
    const cachedResult = this.cachedResults.get(cacheKey);
    
    if (!cachedResult) {
      return null;
    }

    return cachedResult.parameters.find(p => p.id === parameterId) as any || null;
  }

  /**
   * Export parameters with CDI3 information
   */
  exportParametersWithCDI3(modelName?: string): string | null {
    const cacheKey = modelName || 'unknown_model';
    const cachedResult = this.cachedResults.get(cacheKey);
    
    if (!cachedResult) {
      return null;
    }

    const resultWithMeta = cachedResult as ParameterDiscoveryResult & {
      cdi3Enhanced?: boolean;
      cdi3ModelName?: string;
    };

    const exportData = {
      modelName: cacheKey,
      discoveredAt: cachedResult.discoveredAt.toISOString(),
      totalParameters: cachedResult.totalCount,
      expressionParameters: cachedResult.expressionParameters.length,
      cdi3Enhanced: resultWithMeta.cdi3Enhanced || false,
      cdi3ModelName: resultWithMeta.cdi3ModelName,
      categorizedParameters: this.getParametersByCategory(modelName),
      parameters: cachedResult.parameters.map(p => {
        const paramWithMeta = p as ModelParameter & {
          cdi3Source?: boolean;
          cdi3Description?: string;
          cdi3Category?: string;
        };
        
        return {
          id: p.id,
          name: p.name,
          index: p.index,
          defaultValue: p.defaultValue,
          minValue: p.minValue,
          maxValue: p.maxValue,
          isExpressionParameter: p.isExpressionParameter,
          cdi3Source: paramWithMeta.cdi3Source,
          cdi3Description: paramWithMeta.cdi3Description,
          cdi3Category: paramWithMeta.cdi3Category,
        };
      }),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Clear CDI3 cache
   */
  clearCDI3Cache(): void {
    this.cdi3Cache.clear();
    console.log('🧹 CDI3 cache cleared');
  }

  /**
   * Get all expression-related parameters
   */
  getExpressionParameters(modelName?: string): ModelParameter[] {
    const cacheKey = modelName || 'unknown_model';
    const cachedResult = this.cachedResults.get(cacheKey);
    
    if (!cachedResult) {
      return [];
    }

    return cachedResult.expressionParameters;
  }

  /**
   * Create a human-readable display name from a parameter ID
   */
  private createDisplayName(parameterId: string): string {
    // Remove common prefixes
    let name = parameterId.replace(/^(Param|Parameter|param_|parameter_)/i, '');
    
    // Handle camelCase and PascalCase
    name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Handle snake_case and kebab-case
    name = name.replace(/[_-]/g, ' ');
    
    // Capitalize first letter of each word
    name = name.replace(/\b\w/g, letter => letter.toUpperCase());
    
    // Handle common abbreviations
    name = name.replace(/\bL\b/g, 'Left');
    name = name.replace(/\bR\b/g, 'Right');
    name = name.replace(/\bX\b/g, 'X-Axis');
    name = name.replace(/\bY\b/g, 'Y-Axis');
    name = name.replace(/\bZ\b/g, 'Z-Axis');
    
    // Clean up extra spaces
    name = name.replace(/\s+/g, ' ').trim();
    
    // If the name is empty or too generic, use the original ID
    if (!name || name.length < 2) {
      return parameterId;
    }
    
    return name;
  }

  /**
   * Update parameter value in the cache
   */
  updateParameterValue(parameterId: string, newValue: number, modelName?: string): void {
    const cacheKey = modelName || 'unknown_model';
    const cachedResult = this.cachedResults.get(cacheKey);
    
    if (!cachedResult) {
      return;
    }

    const parameter = cachedResult.parameters.find(p => p.id === parameterId);
    if (parameter) {
      parameter.value = newValue;
    }
  }

  /**
   * Clear cached results for a model
   */
  clearCache(modelName?: string): void {
    if (modelName) {
      this.cachedResults.delete(modelName);
    } else {
      this.cachedResults.clear();
    }
  }

  /**
   * Get cached parameter discovery result
   */
  getCachedResult(modelName?: string): ParameterDiscoveryResult | null {
    const cacheKey = modelName || 'unknown_model';
    return this.cachedResults.get(cacheKey) || null;
  }

  /**
   * Force refresh parameters from model with CDI3 support
   */
  async refreshParameters(model: Live2DModel, modelName?: string, modelPath?: string): Promise<ParameterDiscoveryResult> {
    const cacheKey = modelName || 'unknown_model';
    
    // Clear cache for this model
    this.cachedResults.delete(cacheKey);
    
    // Rediscover parameters with CDI3 support
    return this.discoverParameters(model, modelName, modelPath);
  }

  /**
   * Get parameter statistics with CDI3 information
   */
  getParameterStatistics(modelName?: string): {
    total: number;
    expressionRelated: number;
    cdi3Enhanced: boolean;
    cdi3Parameters: number;
    byRange: { zeroToOne: number; negativeToPositive: number; other: number };
    byType: { continuous: number; discrete: number };
    byCategory: Record<string, number>;
  } {
    const cacheKey = modelName || 'unknown_model';
    const cachedResult = this.cachedResults.get(cacheKey);
    
    if (!cachedResult) {
      return {
        total: 0,
        expressionRelated: 0,
        cdi3Enhanced: false,
        cdi3Parameters: 0,
        byRange: { zeroToOne: 0, negativeToPositive: 0, other: 0 },
        byType: { continuous: 0, discrete: 0 },
        byCategory: {},
      };
    }

    const resultWithMeta = cachedResult as ParameterDiscoveryResult & {
      cdi3Enhanced?: boolean;
    };

    const params = cachedResult.parameters;
    const expressionParams = params.filter(p => p.isExpressionParameter);
    const cdi3Params = params.filter(p => (p as any).cdi3Source);
    
    // Analyze parameter ranges
    const zeroToOne = params.filter(p => p.minValue === 0 && p.maxValue === 1).length;
    const negativeToPositive = params.filter(p => p.minValue < 0 && p.maxValue > 0).length;
    const other = params.length - zeroToOne - negativeToPositive;
    
    // Analyze parameter types (simple heuristic)
    const continuous = params.filter(p => Math.abs(p.maxValue - p.minValue) > 2).length;
    const discrete = params.length - continuous;

    // Category statistics
    const categorized = this.getParametersByCategory(modelName);
    const byCategory: Record<string, number> = {};
    Object.keys(categorized).forEach(category => {
      byCategory[category] = categorized[category].length;
    });

    return {
      total: params.length,
      expressionRelated: expressionParams.length,
      cdi3Enhanced: resultWithMeta.cdi3Enhanced || false,
      cdi3Parameters: cdi3Params.length,
      byRange: { zeroToOne, negativeToPositive, other },
      byType: { continuous, discrete },
      byCategory,
    };
  }
}

// Export singleton instance
export const parameterDiscoveryService = ParameterDiscoveryService.getInstance();