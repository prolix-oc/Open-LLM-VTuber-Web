import {
  createContext, useContext, useState, useMemo, useEffect, useCallback, useRef,
} from 'react';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { useConfig } from '@/context/character-config-context';
import { toaster } from '@/components/ui/toaster';
import { CustomExpressionConfig, DEFAULT_CUSTOM_EXPRESSION_CONFIG } from '@/types/custom-expression-types';

/**
 * Model emotion mapping interface
 * @interface EmotionMap
 */
interface EmotionMap {
  [key: string]: number | string;
}

/**
 * Motion weight mapping interface
 * @interface MotionWeightMap
 */
export interface MotionWeightMap {
  [key: string]: number;
}

/**
 * Tap motion mapping interface
 * @interface TapMotionMap
 */
export interface TapMotionMap {
  [key: string]: MotionWeightMap;
}

/**
 * Live2D model information interface
 * @interface ModelInfo
 */
export interface ModelInfo {
  /** Model name */
  name?: string;

  /** Model description */
  description?: string;

  /** Model URL */
  url: string;

  /** Scale factor */
  kScale: number;

  /** Initial X position shift */
  initialXshift: number;

  /** Initial Y position shift */
  initialYshift: number;

  /** Idle motion group name */
  idleMotionGroupName?: string;

  /** Default emotion */
  defaultEmotion?: number | string;

  /** Emotion mapping configuration */
  emotionMap: EmotionMap;

  /** Enable pointer interactivity */
  pointerInteractive?: boolean;

  /** Tap motion mapping configuration */
  tapMotions?: TapMotionMap;

  /** Enable scroll to resize */
  scrollToResize?: boolean;

  // Local model properties
  /** Flag indicating if this is a local model */
  isLocal?: boolean;

  /** Local directory path containing the model files */
  localDirectoryPath?: string;

  /** Local model file path (model3.json or similar) */
  localModelPath?: string;

  // Custom expression support
  /** Custom expression configuration */
  customExpressions?: CustomExpressionConfig;

  /** Whether CDI3 enhancement is available */
  hasCDI3?: boolean;

  /** CDI3 file path if available */
  cdi3FilePath?: string;
}

/**
 * Available model from the models directory
 */
export interface AvailableModel {
  name: string;
  directory: string;
  modelFile: string;
  hasTextures: boolean;
  hasMotions: boolean;
  hasCDI3?: boolean;
  cdi3File?: string;
}

/**
 * Live2D configuration context state interface
 * @interface Live2DConfigState
 */
interface Live2DConfigState {
  modelInfo?: ModelInfo;
  setModelInfo: (info: ModelInfo | undefined) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  updateModelScale: (newScale: number) => void;
  updateCustomExpressions: (config: CustomExpressionConfig) => void;
  
  // Models directory management
  availableModels: AvailableModel[];
  selectedModelName: string | null;
  setSelectedModelName: (name: string | null) => void;
  refreshModels: () => Promise<void>;
  openModelsDirectory: () => Promise<void>;
  isLocalModel: boolean;
  
  // Startup restoration
  restoreModelSettings: () => Promise<void>;
}

/**
 * Default values and constants - Updated default scale to 0.5
 */
const DEFAULT_CONFIG = {
  modelInfo: {
    scrollToResize: true,
  } as ModelInfo | undefined,
  isLoading: false,
  defaultScale: 0.5, // Changed from 0.001 to 0.5 for better visibility
};

/**
 * Create the Live2D configuration context
 */
export const Live2DConfigContext = createContext<Live2DConfigState | null>(null);

/**
 * Live2D Configuration Provider Component
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Child components
 */
export function Live2DConfigProvider({ children }: { children: React.ReactNode }) {
  const { confUid, confName } = useConfig();

  const [isPet, setIsPet] = useState(false);
  const [isLoading, setIsLoading] = useState(DEFAULT_CONFIG.isLoading);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  
  // Use refs to prevent multiple restoration calls
  const hasAttemptedModelRestore = useRef(false);
  const isRestoringModel = useRef(false);
  const modelsScanned = useRef(false);
  
  // Store selected model name in local storage
  const [selectedModelName, setSelectedModelName] = useLocalStorage<string | null>(
    'selectedModelName',
    null,
  );

  useEffect(() => {
    const unsubscribe = (window.api as any)?.onModeChanged((mode: string) => {
      setIsPet(mode === "pet");
    });
    return () => unsubscribe?.();
  }, []);

  const getStorageKey = (uid: string, isPetMode: boolean) => `${uid}_${isPetMode ? "pet" : "window"}`;

  const [modelInfo, setModelInfoState] = useLocalStorage<ModelInfo | undefined>(
    "modelInfo",
    DEFAULT_CONFIG.modelInfo,
    {
      filter: (value) => (value ? { ...value, url: "" } : value),
    },
  );

  const [scaleMemory, setScaleMemory] = useLocalStorage<Record<string, number>>(
    "scale_memory",
    {},
  );

  // Check if current model is local
  const isLocalModel = useMemo(
    () => Boolean(selectedModelName && modelInfo?.isLocal),
    [selectedModelName, modelInfo?.isLocal],
  );

  // Enhanced model scanning with CDI3 detection
  const scanModelWithCDI3 = useCallback(async (model: AvailableModel): Promise<AvailableModel> => {
    try {
      // Try to find CDI3 file for this model
      const cdi3File = await (window.api as any)?.findCDI3ForModel?.(model.modelFile);
      
      if (cdi3File) {
        console.log(`📁 Found CDI3 file for ${model.name}: ${cdi3File}`);
        return {
          ...model,
          hasCDI3: true,
          cdi3File: cdi3File,
        };
      }
    } catch (error) {
      console.warn(`Failed to check CDI3 for model ${model.name}:`, error);
    }
    
    return model;
  }, []);

  // Refresh available models from the models directory with CDI3 detection
  const refreshModels = useCallback(async () => {
    try {
      const models = await (window.api as any)?.scanModels?.();
      
      if (models) {
        // Enhanced scanning with CDI3 detection
        const enhancedModels = await Promise.all(
          models.map((model: AvailableModel) => scanModelWithCDI3(model))
        );
        
        setAvailableModels(enhancedModels);
        modelsScanned.current = true;
        
        // Log CDI3 enhanced models
        const cdi3Models = enhancedModels.filter(m => m.hasCDI3);
        if (cdi3Models.length > 0) {
          console.log(`🎨 Found ${cdi3Models.length} models with CDI3 enhancement`);
        }
        
        // If the currently selected model is no longer available, clear selection
        if (selectedModelName && !enhancedModels.some((m: AvailableModel) => m.name === selectedModelName)) {
          console.warn(`🚫 Selected model ${selectedModelName} no longer available, clearing selection`);
          setSelectedModelName(null);
          setModelInfo(undefined);
        }
      } else {
        setAvailableModels([]);
      }
    } catch (error) {
      console.error('❌ Failed to refresh models:', error);
      toaster.create({
        title: "Failed to Scan Models",
        description: "Could not scan the models directory. Please check the folder exists.",
        type: "error",
        duration: 3000,
      });
    }
  }, [selectedModelName, setSelectedModelName, scanModelWithCDI3]);

  // Open the models directory in the file manager
  const openModelsDirectory = useCallback(async () => {
    try {
      await (window.api as any)?.openModelsDirectory?.();
    } catch (error) {
      console.error('Failed to open models directory:', error);
      toaster.create({
        title: "Failed to Open Directory",
        description: "Could not open the models directory.",
        type: "error",
        duration: 3000,
      });
    }
  }, []);

  // Load a model by name from the available models with CDI3 enhancement
  const loadModelByName = useCallback(async (modelName: string) => {
    const model = availableModels.find(m => m.name === modelName);
    if (!model) {
      console.warn(`🚫 Model not found: ${modelName}`);
      toaster.create({
        title: "Model Not Found",
        description: `Could not find model: ${modelName}`,
        type: "error",
        duration: 3000,
      });
      return false;
    }

    try {
      console.log(`🎭 Loading model: ${modelName}${model.hasCDI3 ? ' (CDI3 enhanced)' : ''}`);
      
      // Get the file:// URL for the model
      const modelUrl = await (window.api as any)?.getModelFileUrl?.(model.modelFile);
      
      if (!modelUrl) {
        throw new Error('Failed to get model URL');
      }
      
      // Load custom expression config for this model
      let customExpressionConfig = { ...DEFAULT_CUSTOM_EXPRESSION_CONFIG };
      try {
        const stored = localStorage.getItem(`custom_expressions_${modelName}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.version === DEFAULT_CUSTOM_EXPRESSION_CONFIG.version) {
            customExpressionConfig = parsed;
          }
        }
      } catch (error) {
        console.warn('Failed to load custom expression config:', error);
      }
      
      // Create model info for the selected model with CDI3 enhancement
      const localModelInfo: ModelInfo = {
        name: model.name,
        url: modelUrl,
        kScale: DEFAULT_CONFIG.defaultScale,
        initialXshift: 0,
        initialYshift: 0,
        emotionMap: {},
        isLocal: true,
        localDirectoryPath: model.directory,
        localModelPath: model.modelFile,
        pointerInteractive: true,
        scrollToResize: true,
        customExpressions: customExpressionConfig,
        hasCDI3: model.hasCDI3,
        cdi3FilePath: model.cdi3File,
      };

      setModelInfo(localModelInfo);

      console.log(`✅ Successfully loaded model: ${modelName}${model.hasCDI3 ? ' with CDI3 enhancement' : ''}`);
      
      const toastMessage = model.hasCDI3 
        ? `Successfully loaded ${model.name} with CDI3 enhancement`
        : `Successfully loaded ${model.name}`;
      
      toaster.create({
        title: "Model Loaded",
        description: toastMessage,
        type: "success",
        duration: 2000,
      });
      
      return true;
    } catch (error) {
      console.error('❌ Failed to load model:', error);
      toaster.create({
        title: "Model Loading Failed",
        description: `Failed to load ${modelName}: ${error}`,
        type: "error",
        duration: 4000,
      });
      return false;
    }
  }, [availableModels]);

  // Restore model settings on startup - ONLY called once
  const restoreModelSettings = useCallback(async () => {
    if (hasAttemptedModelRestore.current || isRestoringModel.current) {
      return;
    }
    
    isRestoringModel.current = true;
    
    try {
      console.log('🎭 Attempting to restore model settings...', {
        selectedModelName,
        hasConfUid: !!confUid,
        hasConfName: !!confName,
        availableModelsCount: availableModels.length,
        modelsScanned: modelsScanned.current
      });

      // For local models, attempt to restore if we have a selected model name
      if (selectedModelName && modelsScanned.current) {
        const model = availableModels.find(m => m.name === selectedModelName);
        if (model) {
          // Check if model is already loaded
          if (!modelInfo || modelInfo.name !== selectedModelName) {
            console.log(`🔄 Restoring local model: ${selectedModelName}`);
            const success = await loadModelByName(selectedModelName);
            if (success) {
              console.log(`✅ Successfully restored model: ${selectedModelName}`);
            }
          } else {
            console.log(`✅ Local model ${selectedModelName} already loaded`);
          }
        } else {
          console.warn(`🚫 Selected model ${selectedModelName} not found in available models`);
          setSelectedModelName(null);
          setModelInfo(undefined);
        }
      } else if (selectedModelName && !modelsScanned.current) {
        console.log('⏳ Models not yet scanned, waiting...');
      } else if (!selectedModelName) {
        console.log('ℹ️ No model selected to restore');
      }

      // For remote models that depend on character config, wait for confUid
      // The model will be loaded when the character is restored via WebSocket
      if (!selectedModelName && confUid && confName) {
        console.log('⏳ Waiting for remote model to be loaded via character restoration...');
      }

    } catch (error) {
      console.error('❌ Failed to restore model settings:', error);
    } finally {
      hasAttemptedModelRestore.current = true;
      isRestoringModel.current = false;
    }
  }, [
    selectedModelName,
    availableModels,
    modelInfo,
    confUid,
    confName,
    loadModelByName,
    setSelectedModelName
  ]);

  // Scan models on startup - ONLY once
  useEffect(() => {
    if (!modelsScanned.current) {
      refreshModels();
    }
  }, [refreshModels]);

  // Auto-restore model when models are scanned and we have a selection - ONLY once
  useEffect(() => {
    if (modelsScanned.current && !hasAttemptedModelRestore.current && selectedModelName) {
      const timer = setTimeout(() => {
        restoreModelSettings();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [modelsScanned.current, selectedModelName, restoreModelSettings]);

  // Handle runtime model selection (after startup restoration is complete)
  const handleModelSelection = useCallback(async (name: string | null) => {
    console.log(`🔄 Runtime model selection: ${name}`);
    setSelectedModelName(name);
    
    if (name && modelsScanned.current) {
      await loadModelByName(name);
    } else if (!name) {
      setModelInfo(undefined);
    }
  }, [setSelectedModelName, loadModelByName, modelsScanned.current]);

  /**
   * Updates the Live2D model information and manages model scale persistence
   * @param info - The new model information to be set
   * @returns void
   */
  const setModelInfo = (info: ModelInfo | undefined) => {
    // Skip if no model URL is provided (avoid localStorage modelInfo remaining)
    if (!info?.url) {
      setModelInfoState(undefined);
      return;
    }

    // Validate configuration UID exists for non-local models
    if (!info.isLocal && !confUid) {
      console.warn("⚠️ Attempting to set model info without confUid for remote model");
      toaster.create({
        title: "Configuration Required",
        description: "Character configuration required for remote models",
        type: "warning",
        duration: 3000,
      });
      return;
    }

    // Prevent unnecessary updates if model info hasn't changed
    if (JSON.stringify(info) === JSON.stringify(modelInfo)) {
      return;
    }

    if (info) {
      // Generate storage key based on confUid and mode (use model name for local models)
      const storageKey = info.isLocal 
        ? `local_${info.name}_${isPet ? "pet" : "window"}`
        : getStorageKey(confUid, isPet);
      let finalScale: number;

      // Retrieve stored scale
      const storedScale = scaleMemory[storageKey];
      if (storedScale !== undefined) {
        finalScale = storedScale;
        console.log(`📏 Restored scale for ${storageKey}: ${finalScale}`);
      } else {
        // Use the new default scale of 0.5 instead of the provided scale or 0.001
        finalScale = Number(info.kScale || DEFAULT_CONFIG.defaultScale);
        // If no stored scale, store the initial scale in memory
        setScaleMemory((prev) => ({
          ...prev,
          [storageKey]: finalScale,
        }));
        console.log(`📏 Set initial scale for ${storageKey}: ${finalScale}`);
      }

      setModelInfoState({
        ...info,
        kScale: finalScale,
        // use new settings to update the local storage, or still use the stored settings
        pointerInteractive:
          "pointerInteractive" in info
            ? info.pointerInteractive
            : (modelInfo?.pointerInteractive ?? false),
        scrollToResize:
          "scrollToResize" in info
            ? info.scrollToResize
            : (modelInfo?.scrollToResize ?? true),
        // Preserve custom expressions if not provided
        customExpressions: info.customExpressions || modelInfo?.customExpressions || DEFAULT_CUSTOM_EXPRESSION_CONFIG,
      });
    } else {
      // Reset model info state when clearing (like switching character)
      setModelInfoState(undefined);
    }
  };

  const updateModelScale = useCallback(
    // Updates the Live2D model scale and persists it to local storage when scrolling in useLive2DResize
    (newScale: number) => {
      if (modelInfo) {
        const storageKey = modelInfo.isLocal 
          ? `local_${modelInfo.name}_${isPet ? "pet" : "window"}`
          : getStorageKey(confUid, isPet);
        const fixedScale = Number(newScale.toFixed(8));
        setScaleMemory((prev) => ({
          ...prev,
          [storageKey]: fixedScale,
        })); // Update the scale in local storage

        setModelInfoState({
          ...modelInfo,
          kScale: fixedScale,
        }); // Update the modelInfo state
      }
    },
    [modelInfo, confUid, isPet, setScaleMemory, setModelInfoState],
  );

  /**
   * Update custom expressions configuration
   */
  const updateCustomExpressions = useCallback((config: CustomExpressionConfig) => {
    if (modelInfo) {
      setModelInfoState({
        ...modelInfo,
        customExpressions: config,
      });
      
      // Persist to localStorage
      if (modelInfo.name) {
        try {
          localStorage.setItem(`custom_expressions_${modelInfo.name}`, JSON.stringify(config));
        } catch (error) {
          console.error('Failed to save custom expressions:', error);
        }
      }
    }
  }, [modelInfo, setModelInfoState]);

  useEffect(() => {
    // If modelInfo is updated, we need to use local storage to update some persistent user settings, like the scale.
    if (modelInfo) {
      const storageKey = modelInfo.isLocal 
        ? `local_${modelInfo.name}_${isPet ? "pet" : "window"}`
        : getStorageKey(confUid, isPet);
      const memorizedScale = scaleMemory[storageKey];
      if (
        memorizedScale !== undefined &&
        memorizedScale !== Number(modelInfo.kScale)
      ) {
        setModelInfo({
          ...modelInfo,
          kScale: memorizedScale,
        });
      }
    }
  }, [isPet, modelInfo]);
  // Don't set confUid in the dependency because it will use old modelInfo to update.

  // Context value
  const contextValue = useMemo(
    () => ({
      modelInfo,
      setModelInfo,
      isLoading,
      setIsLoading,
      updateModelScale,
      updateCustomExpressions,
      availableModels,
      selectedModelName,
      setSelectedModelName: handleModelSelection,
      refreshModels,
      openModelsDirectory,
      isLocalModel,
      restoreModelSettings,
    }),
    [
      modelInfo, 
      isLoading, 
      updateModelScale, 
      updateCustomExpressions,
      availableModels,
      selectedModelName,
      handleModelSelection,
      refreshModels,
      openModelsDirectory,
      isLocalModel,
      restoreModelSettings,
    ],
  );

  return (
    <Live2DConfigContext.Provider value={contextValue}>
      {children}
    </Live2DConfigContext.Provider>
  );
}

/**
 * Custom hook to use the Live2D configuration context
 * @throws {Error} If used outside of Live2DConfigProvider
 */
export function useLive2DConfig() {
  const context = useContext(Live2DConfigContext);

  if (!context) {
    throw new Error('useLive2DConfig must be used within a Live2DConfigProvider');
  }

  return context;
}

// Export the provider as default
export default Live2DConfigProvider;