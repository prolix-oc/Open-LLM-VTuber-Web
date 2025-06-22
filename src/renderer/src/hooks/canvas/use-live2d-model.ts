/* eslint-disable no-use-before-define */
/* eslint-disable no-param-reassign */
import { useEffect, useRef, useCallback, useState } from "react";
import { expressionDebugTool } from "@/services/expression-debug-tool";
import * as PIXI from "pixi.js";
import {
  Live2DModel,
  MotionPreloadStrategy,
  MotionPriority,
} from "pixi-live2d-display-lipsyncpatch";
import {
  ModelInfo,
  useLive2DConfig,
  MotionWeightMap,
  TapMotionMap,
} from "@/context/live2d-config-context";
import { useLive2DModel as useModelContext } from "@/context/live2d-model-context";
import { setModelSize, resetModelPosition } from "./use-live2d-resize";
import { audioTaskQueue } from "@/utils/task-queue";
import { AiStateEnum, useAiState } from "@/context/ai-state-context";
import { toaster } from "@/components/ui/toaster";
import { useForceIgnoreMouse } from "../utils/use-force-ignore-mouse";
import { getCanvasCaptureService } from "@/services/canvas-capture-service";
import {
  EnhancedExpressionManager,
  ExpressionBlendMode,
  type ExpressionDefinition,
  type ExpressionParameter,
  type ExpressionState,
} from "@/services/enhanced-expression-manager";

interface UseLive2DModelProps {
  isPet: boolean; // Whether the model is in pet mode
  modelInfo: ModelInfo | undefined; // Live2D model configuration information
}

export const useLive2DModel = ({ isPet, modelInfo }: UseLive2DModelProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const kScaleRef = useRef<string | number | undefined>(undefined);
  const { setCurrentModel } = useModelContext();
  const { setIsLoading } = useLive2DConfig();
  const loadingRef = useRef(false);
  const { setAiState, aiState } = useAiState();
  const [isModelReady, setIsModelReady] = useState(false);
  const { forceIgnoreMouse } = useForceIgnoreMouse();

  // Enhanced Expression Manager
  const expressionManagerRef = useRef<EnhancedExpressionManager | null>(null);

  // Track the last loaded model info to detect changes
  const lastLoadedModelRef = useRef<string | null>(null);

  // 🧠 MEMORY OPTIMIZATION: OBS and Canvas Capture State Management
  const [obsEnabled, setObsEnabled] = useState(false);
  const [obsInitialized, setObsInitialized] = useState(false);
  const captureService = getCanvasCaptureService();

  // Track API readiness
  const [isGlobalAPIReady, setIsGlobalAPIReady] = useState(false);

  // 🧠 MEMORY OPTIMIZATION: Function to check if OBS should be enabled
  const checkOBSEnabled = useCallback(async () => {
    try {
      // First ensure OBS integration is available
      if (!window.api?.obs) {
        console.log('🚫 OBS API not available, canvas capture disabled');
        return false;
      }

      // Initialize OBS integration lazily
      const initResult = await window.api.obs.ensureInitialized();
      if (!initResult.success) {
        console.warn('⚠️ OBS initialization failed:', initResult.error);
        return false;
      }

      // Check if OBS is enabled in settings
      const settings = await window.api.obs.getSettings();
      console.log('🎥 OBS settings check:', { enabled: settings.enabled });
      return settings.enabled;
    } catch (error) {
      console.error('Failed to check OBS settings:', error);
      return false;
    }
  }, []);

  // 🧠 MEMORY OPTIMIZATION: Listen for OBS settings changes
  useEffect(() => {
    const handleOBSSettingsChange = (event: CustomEvent) => {
      const { enabled } = event.detail;
      console.log('🔄 OBS settings changed:', { enabled });
      setObsEnabled(enabled);
      
      if (!enabled && obsInitialized) {
        // Disable OBS capture
        console.log('🚫 Disabling OBS canvas capture');
        captureService.cleanup();
        setObsInitialized(false);
      } else if (enabled && !obsInitialized && canvasRef.current) {
        // Enable OBS capture
        console.log('🎥 Enabling OBS canvas capture');
        initializeCanvasCapture();
      }
    };

    window.addEventListener('obs-settings-changed', handleOBSSettingsChange as EventListener);
    
    return () => {
      window.removeEventListener('obs-settings-changed', handleOBSSettingsChange as EventListener);
    };
  }, [obsInitialized, captureService]);

  // 🧠 MEMORY OPTIMIZATION: Initialize canvas capture conditionally
  const initializeCanvasCapture = useCallback(async () => {
    if (!canvasRef.current) {
      console.log('📹 Canvas not ready for capture initialization');
      return;
    }

    try {
      console.log('🎥 Initializing canvas capture service...');
      const initialized = await captureService.initialize(canvasRef.current, {
        frameRate: 30,
        quality: 0.9,
      });

      if (initialized) {
        setObsInitialized(true);
        console.log('✅ Canvas capture service initialized');
      } else {
        console.log('⏸️ Canvas capture service not initialized (OBS disabled)');
      }
    } catch (error) {
      console.error('❌ Failed to initialize canvas capture:', error);
    }
  }, [captureService]);

  // 🧠 MEMORY OPTIMIZATION: Check OBS status on component mount
  useEffect(() => {
    const checkOBSStatus = async () => {
      const enabled = await checkOBSEnabled();
      setObsEnabled(enabled);
      
      if (enabled && canvasRef.current) {
        await initializeCanvasCapture();
      }
    };

    checkOBSStatus();
  }, [checkOBSEnabled, initializeCanvasCapture]);

  // Cleanup function for Live2D model
  const cleanupModel = useCallback(() => {
    if (modelRef.current) {
      console.log("🧹 Cleaning up Live2D model");
      modelRef.current.removeAllListeners();
      setCurrentModel(null);

      // PARAMETER FIX: Clean up global model references
      (window as any).currentLive2DModel = null;
      (window as any).live2dModel = null;

      if (appRef.current) {
        appRef.current.stage.removeChild(modelRef.current);
        modelRef.current.destroy({
          children: true,
          texture: true,
          baseTexture: true,
        });
        PIXI.utils.clearTextureCache();
        modelRef.current = null;
      }
    }

    // Clean up expression manager
    expressionManagerRef.current = null;

    // 🧠 MEMORY OPTIMIZATION: Conditionally cleanup canvas capture
    if (obsInitialized) {
      console.log('🧹 Cleaning up canvas capture service');
      captureService.cleanup();
      setObsInitialized(false);
    }

    setIsModelReady(false);
    setIsGlobalAPIReady(false);
    lastLoadedModelRef.current = null;
  }, [setCurrentModel, captureService, obsInitialized]);

  // Cleanup function for PIXI application
  const cleanupApp = useCallback(() => {
    if (appRef.current) {
      console.log("🧹 Cleaning up PIXI application");
      if (modelRef.current) {
        cleanupModel();
      }
      appRef.current.stage.removeChildren();
      PIXI.utils.clearTextureCache();
      appRef.current.renderer.clear();
      appRef.current.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true,
      });
      PIXI.utils.destroyTextureCache();
      appRef.current = null;
    }
  }, [cleanupModel]);

  // Initialize PIXI application with canvas (only once)
  useEffect(() => {
    if (!appRef.current && canvasRef.current) {
      console.log("🎨 Initializing PIXI application");
      const app = new PIXI.Application({
        view: canvasRef.current, // canvas element to render on
        autoStart: true,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 0, // transparent background
        antialias: true, // antialiasing
        clearBeforeRender: true, // clear before render
        preserveDrawingBuffer: false, // 🧠 MEMORY OPTIMIZATION: Keep false unless OBS needs it
        powerPreference: "high-performance", // high performance, use GPU if available
        resolution: window.devicePixelRatio || 1,
        autoDensity: true, // auto adjust resolution to fit the screen
      });

      // Render on every frame
      app.ticker.add(() => {
        if (app.renderer) {
          app.renderer.render(app.stage);
        }

        // Update expression manager
        if (expressionManagerRef.current) {
          expressionManagerRef.current.update(app.ticker.deltaMS);
        }
      });

      appRef.current = app;

      // 🧠 MEMORY OPTIMIZATION: Only initialize capture if OBS is enabled
      if (obsEnabled) {
        console.log('🎥 PIXI app created, initializing canvas capture (OBS enabled)');
        initializeCanvasCapture();
      } else {
        console.log('🎨 PIXI app created without canvas capture (OBS disabled)');
      }

      console.log("✅ PIXI application initialized");
    }

    return () => {
      cleanupApp();
    };
  }, [cleanupApp, obsEnabled, initializeCanvasCapture]);

  const setupModel = useCallback(
    async (model: Live2DModel) => {
      if (!appRef.current || !modelInfo) return;
      
      if (process.env.NODE_ENV === "development") {
        (window as any).debugLive2D = {
          // Full diagnosis
          diagnose: () =>
            expressionDebugTool.diagnoseModel(model, modelInfo.name),

          // Test a specific parameter
          testParam: (paramId: string, value: number, duration = 2000) =>
            expressionDebugTool.testParameterChange(
              model,
              paramId,
              value,
              duration
            ),

          // Discover expression parameters
          findExpressionParams: () =>
            expressionDebugTool.discoverExpressionParameters(model),

          // Test common eye parameters
          testEyes: () => {
            expressionDebugTool.testParameterChange(
              model,
              "ParamEyeLOpen",
              0.2,
              3000
            );
            setTimeout(
              () =>
                expressionDebugTool.testParameterChange(
                  model,
                  "ParamEyeROpen",
                  0.2,
                  3000
                ),
              1000
            );
            setTimeout(
              () =>
                expressionDebugTool.testParameterChange(
                  model,
                  "PARAM_EYE_L_OPEN",
                  0.2,
                  3000
                ),
              2000
            );
            setTimeout(
              () =>
                expressionDebugTool.testParameterChange(
                  model,
                  "PARAM_EYE_R_OPEN",
                  0.2,
                  3000
                ),
              3000
            );
          },

          // Test mouth parameters
          testMouth: () => {
            expressionDebugTool.testParameterChange(
              model,
              "ParamMouthOpenY",
              0.8,
              3000
            );
            setTimeout(
              () =>
                expressionDebugTool.testParameterChange(
                  model,
                  "PARAM_MOUTH_OPEN_Y",
                  0.8,
                  3000
                ),
              2000
            );
          },

          // Get current model for manual inspection
          getModel: () => model,
          getCoreModel: () => model.internalModel?.coreModel,

          // Quick parameter list
          listParams: () => {
            const coreModel = model.internalModel?.coreModel;
            if (!coreModel) return [];

            const isCubism4 =
              typeof coreModel.setParameterValueById === "function";
            const params: string[] = [];

            if (isCubism4 && typeof coreModel.getParameterIds === "function") {
              return coreModel.getParameterIds();
            } else if (!isCubism4) {
              const count = coreModel.getParameterCount
                ? coreModel.getParameterCount()
                : 0;
              for (let i = 0; i < count; i++) {
                try {
                  const id = coreModel.getParameterId
                    ? coreModel.getParameterId(i)
                    : `param_${i}`;
                  params.push(id);
                } catch (error) {
                  // Skip
                }
              }
            }

            return params;
          },
        };

        console.log("🔧 Debug tools available! Try these in console:");
        console.log("  debugLive2D.diagnose() - Full model diagnosis");
        console.log("  debugLive2D.testEyes() - Test eye parameters");
        console.log("  debugLive2D.testMouth() - Test mouth parameters");
        console.log("  debugLive2D.listParams() - List all parameters");
        console.log(
          '  debugLive2D.testParam("ParamName", 0.5) - Test specific parameter'
        );
      }
      
      if (modelRef.current) {
        console.log("🔄 Replacing existing model");
        modelRef.current.removeAllListeners();
        appRef.current.stage.removeChild(modelRef.current);
        modelRef.current.destroy({
          children: true,
          texture: true,
          baseTexture: true,
        });
        PIXI.utils.clearTextureCache();
      }

      console.log("🎭 Setting up Live2D model in stage");
      modelRef.current = model;
      setCurrentModel(model);

      // PARAMETER FIX: Expose model globally for custom expression manager
      (window as any).currentLive2DModel = model;
      (window as any).live2dModel = model;

      appRef.current.stage.addChild(model);

      model.eventMode = "dynamic";
      model.cursor = "pointer";

      // Initialize Enhanced Expression Manager with model name for proper context
      console.log("🎨 Initializing Enhanced Expression Manager...");
      expressionManagerRef.current = new EnhancedExpressionManager();
      await expressionManagerRef.current.setModel(model, modelInfo.name);
      console.log("✅ Enhanced Expression Manager initialized");

      setIsModelReady(true);

      // 🧠 MEMORY OPTIMIZATION: Conditionally start canvas capture for OBS
      if (obsEnabled && obsInitialized) {
        console.log('📹 Starting canvas capture for OBS (user enabled)');
        const mediaStream = captureService.startCapture();
        if (mediaStream) {
          console.log('📹 Canvas capture started for OBS streaming');

          // Notify main process that we have a media stream ready
          if (window.api?.obs?.notifyCanvasReady) {
            window.api.obs.notifyCanvasReady();
          }
        }
      } else {
        console.log('⏸️ Skipping canvas capture - OBS not enabled or not initialized');
      }

      console.log("🎉 Live2D model setup complete");
    },
    [setCurrentModel, modelInfo, captureService, obsEnabled, obsInitialized]
  );

  const setupModelSizeAndPosition = useCallback(() => {
    if (!modelRef.current) return;

    console.log("📏 Setting up model size and position");
    setModelSize(modelRef.current, kScaleRef.current);

    const { width, height } = isPet
      ? { width: window.innerWidth, height: window.innerHeight }
      : containerRef.current?.getBoundingClientRect() || {
          width: 0,
          height: 0,
        };

    resetModelPosition(
      modelRef.current,
      width,
      height,
      modelInfo?.initialXshift,
      modelInfo?.initialYshift
    );
    console.log("✅ Model size and position set");
  }, [modelInfo?.initialXshift, modelInfo?.initialYshift, isPet]);

  // Load Live2D model with configuration
  const loadModel = useCallback(async () => {
    if (!modelInfo?.url || !appRef.current) {
      console.log("⚠️ Cannot load model: missing URL or PIXI app", {
        hasUrl: !!modelInfo?.url,
        hasApp: !!appRef.current,
      });
      return;
    }

    if (loadingRef.current) {
      console.log("⏳ Model loading already in progress, skipping");
      return;
    }

    const modelKey = `${modelInfo.url}_${modelInfo.name}_${modelInfo.isLocal}`;
    if (lastLoadedModelRef.current === modelKey && modelRef.current) {
      console.log("✅ Model already loaded, skipping reload:", modelKey);
      return;
    }

    console.log("🎭 Starting model load:", {
      url: modelInfo.url,
      name: modelInfo.name,
      isLocal: modelInfo.isLocal,
      modelKey,
    });

    try {
      loadingRef.current = true;
      setIsLoading(true);
      setAiState(AiStateEnum.LOADING);

      // Use the model URL directly - should be a file:// URL for local models
      const modelUrl = modelInfo.url;
      console.log("📁 Final model URL:", modelUrl);

      // Initialize Live2D model with settings for lipsync patch
      const model = await Live2DModel.from(modelUrl, {
        autoHitTest: true,
        autoFocus: modelInfo.pointerInteractive ?? false,
        autoUpdate: true,
        ticker: PIXI.Ticker.shared,
        motionPreload: MotionPreloadStrategy.IDLE,
        idleMotionGroup: modelInfo.idleMotionGroupName,
      });

      console.log("✅ Live2D model loaded from URL, setting up...");
      await setupModel(model);

      // Mark this model as successfully loaded
      lastLoadedModelRef.current = modelKey;

      // Display success message for local models
      if (modelInfo.isLocal) {
        toaster.create({
          title: "Model Loaded Successfully",
          description: `Successfully loaded ${modelInfo.name || "local model"}`,
          type: "success",
          duration: 2000,
        });
      }

      console.log("🎉 Model loading complete!");
    } catch (error) {
      console.error("❌ Failed to load Live2D model:", error);

      let errorMessage = "Failed to load Live2D model";

      if (modelInfo.isLocal) {
        errorMessage = `Failed to load model "${modelInfo.name}". Please ensure the model directory contains valid Live2D files.`;
      } else {
        errorMessage = `Failed to load remote model: ${error}`;
      }

      toaster.create({
        title: "Model Loading Failed",
        description: errorMessage,
        type: "error",
        duration: 4000,
      });

      // Reset the last loaded model on error
      lastLoadedModelRef.current = null;
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setAiState(AiStateEnum.IDLE);
    }
  }, [
    modelInfo?.url,
    modelInfo?.name,
    modelInfo?.isLocal,
    modelInfo?.pointerInteractive,
    modelInfo?.idleMotionGroupName,
    setIsLoading,
    setAiState,
    setupModel,
  ]);

  const setupModelInteractions = useCallback(
    (model: Live2DModel) => {
      if (!model) return;

      console.log("🖱️ Setting up model interactions");

      // Clear all previous listeners
      model.removeAllListeners("pointerenter");
      model.removeAllListeners("pointerleave");
      model.removeAllListeners("rightdown");
      model.removeAllListeners("pointerdown");
      model.removeAllListeners("pointermove");
      model.removeAllListeners("pointerup");
      model.removeAllListeners("pointerupoutside");

      // If force ignore mouse is enabled, disable interaction
      if (forceIgnoreMouse && isPet) {
        model.eventMode = "dynamic";
        model.cursor = "default";
        console.log("🚫 Mouse interactions disabled (force ignore mode)");
        return;
      }

      // Enable interactions
      model.interactive = true;
      model.cursor = "pointer";

      let dragging = false;
      let pointerX = 0;
      let pointerY = 0;
      let isTap = false;
      const dragThreshold = 5;

      if (isPet) {
        model.on("pointerenter", () => {
          (window.api as any)?.updateComponentHover("live2d-model", true);
        });

        model.on("pointerleave", () => {
          if (!dragging) {
            (window.api as any)?.updateComponentHover("live2d-model", false);
          }
        });

        model.on("rightdown", (e: any) => {
          e.data.originalEvent.preventDefault();
          (window.api as any).showContextMenu();
        });
      }

      model.on("pointerdown", (e) => {
        if (e.button === 0) {
          dragging = true;
          isTap = true;
          pointerX = e.global.x - model.x;
          pointerY = e.global.y - model.y;
        }
      });

      model.on("pointermove", (e) => {
        if (dragging) {
          const newX = e.global.x - pointerX;
          const newY = e.global.y - pointerY;
          const dx = newX - model.x;
          const dy = newY - model.y;

          if (Math.hypot(dx, dy) > dragThreshold) {
            isTap = false;
          }

          model.position.x = newX;
          model.position.y = newY;
        }
      });

      model.on("pointerup", (e) => {
        if (dragging) {
          dragging = false;
          if (isTap) {
            handleTapMotion(model, e.global.x, e.global.y);
          }
        }
      });

      model.on("pointerupoutside", () => {
        dragging = false;
      });

      console.log("✅ Model interactions setup complete");
    },
    [isPet, forceIgnoreMouse]
  );

  const handleTapMotion = useCallback(
    (model: Live2DModel, x: number, y: number) => {
      if (!modelInfo?.tapMotions) return;

      console.log("👆 Handling tap motion", modelInfo?.tapMotions);
      // Convert global coordinates to model's local coordinates
      const localPos = model.toLocal(new PIXI.Point(x, y));
      const hitAreas = model.hitTest(localPos.x, localPos.y);

      const foundMotion = hitAreas.find((area) => {
        const motionGroup = modelInfo?.tapMotions?.[area];
        if (motionGroup) {
          console.log(`Found motion group for area ${area}:`, motionGroup);
          playRandomMotion(model, motionGroup);
          return true;
        }
        return false;
      });

      if (!foundMotion && Object.keys(modelInfo.tapMotions).length > 0) {
        const mergedMotions = getMergedMotionGroup(modelInfo.tapMotions);
        playRandomMotion(model, mergedMotions);
      }
    },
    [modelInfo?.tapMotions]
  );

  // Reset expression when AI state changes to IDLE (like finishing a conversation)
  useEffect(() => {
    if (aiState === AiStateEnum.IDLE) {
      console.log(
        "😐 Resetting to default emotion:",
        modelInfo?.defaultEmotion
      );

      if (modelInfo?.defaultEmotion) {
        // Use enhanced expression manager if available
        if (expressionManagerRef.current) {
          console.log(
            "🎨 Using enhanced expression manager for default emotion"
          );
          expressionManagerRef.current.setExpression(
            modelInfo.defaultEmotion.toString(),
            1.0,
            500,
            ExpressionBlendMode.OVERWRITE
          );
        } else {
          // Fallback to original method
          console.log("🔄 Using fallback expression method");
          modelRef.current?.internalModel.motionManager.expressionManager?.setExpression(
            modelInfo.defaultEmotion
          );
        }
      } else {
        // Reset to neutral
        if (expressionManagerRef.current) {
          expressionManagerRef.current.resetExpression();
        } else {
          modelRef.current?.internalModel.motionManager.expressionManager?.resetExpression();
        }
      }
    }
  }, [aiState, modelInfo?.defaultEmotion]);

  // Setup enhanced global API when model and expression manager are ready (one-time setup)
  useEffect(() => {
    let apiSetupTimeout: number | null = null;
    let eventDispatchTimeout: number | null = null;

    if (modelRef.current && expressionManagerRef.current) {
      console.log("🌐 Setting up enhanced window.live2d global API");

      // @ts-ignore
      window.live2d = {
        // PARAMETER FIX: Expose model for direct parameter access
        model: modelRef.current,

        // Original API for backward compatibility
        expression: (name?: string | number) => {
          if (expressionManagerRef.current && name !== undefined) {
            expressionManagerRef.current.setExpression(name.toString(), 1.0, 0);
          } else {
            modelRef.current?.expression(name);
          }
        },

        setExpression: (name?: string | number) => {
          if (name !== undefined) {
            if (expressionManagerRef.current) {
              expressionManagerRef.current.setExpression(
                name.toString(),
                1.0,
                500
              );
            } else {
              modelRef.current?.internalModel.motionManager.expressionManager?.setExpression(
                name
              );
            }
          }
        },

        setRandomExpression: () => {
          if (expressionManagerRef.current) {
            const expressions = expressionManagerRef.current.getExpressions();
            if (expressions.length > 0) {
              const randomExpr =
                expressions[Math.floor(Math.random() * expressions.length)];
              expressionManagerRef.current.setExpression(
                randomExpr.name,
                1.0,
                500
              );
            }
          } else {
            modelRef.current?.internalModel.motionManager.expressionManager?.setRandomExpression();
          }
        },

        getExpressions: () => {
          if (expressionManagerRef.current) {
            return expressionManagerRef.current
              .getExpressions()
              .map((expr) => expr.name);
          }
          return (
            modelRef.current?.internalModel.motionManager.expressionManager?.definitions.map(
              (d) => d.name
            ) || []
          );
        },

        // Enhanced API with full pixi-live2d-display-lipsyncpatch integration
        enhancedExpression: {
          setExpression: async (
            name: string,
            intensity: number = 1.0,
            transitionDuration?: number,
            blendMode: ExpressionBlendMode = ExpressionBlendMode.OVERWRITE
          ) => {
            if (expressionManagerRef.current) {
              return expressionManagerRef.current.setExpression(
                name,
                intensity,
                transitionDuration,
                blendMode
              );
            }
          },

          setParameterValue: (
            parameterId: string,
            value: number,
            weight: number = 1.0,
            blendMode: ExpressionBlendMode = ExpressionBlendMode.OVERWRITE
          ) => {
            if (expressionManagerRef.current) {
              expressionManagerRef.current.setParameterValue(
                parameterId,
                value,
                weight,
                blendMode
              );
            }
          },

          getParameterValue: (parameterId: string) => {
            return (
              expressionManagerRef.current?.getParameterValue(parameterId) || 0
            );
          },

          blendExpressions: (
            expr1: string,
            expr2: string,
            blendFactor: number,
            blendMode: ExpressionBlendMode = ExpressionBlendMode.ADD
          ) => {
            if (expressionManagerRef.current) {
              expressionManagerRef.current.blendExpressions(
                expr1,
                expr2,
                blendFactor,
                blendMode
              );
            }
          },

          resetExpression: () => {
            if (expressionManagerRef.current) {
              expressionManagerRef.current.resetExpression();
            }
          },

          getExpressions: (): ExpressionDefinition[] => {
            return expressionManagerRef.current?.getExpressions() || [];
          },

          getParameters: (): ExpressionParameter[] => {
            return expressionManagerRef.current?.getParameters() || [];
          },

          getState: (): ExpressionState | null => {
            return expressionManagerRef.current?.getState() || null;
          },

          captureCurrentExpression: (
            name: string
          ): ExpressionDefinition | null => {
            return (
              expressionManagerRef.current?.captureCurrentExpression(name) ||
              null
            );
          },

          exportExpression: (name: string): string | null => {
            return expressionManagerRef.current?.exportExpression(name) || null;
          },

          importExpression: (json: string): boolean => {
            return (
              expressionManagerRef.current?.importExpression(json) || false
            );
          },

          setDefaultFadeDuration: (duration: number) => {
            if (expressionManagerRef.current) {
              expressionManagerRef.current.setDefaultFadeDuration(duration);
            }
          },

          // New pixi-live2d-display-lipsyncpatch integration methods
          playMotionWithExpression: (
            motion: string,
            expression?: string | number,
            options: any = {}
          ) => {
            if (expressionManagerRef.current) {
              expressionManagerRef.current.playMotionWithExpression(
                motion,
                expression,
                options
              );
            }
          },

          speakWithExpression: (
            audioUrl?: string,
            expression?: string | number,
            options: any = {}
          ) => {
            if (expressionManagerRef.current) {
              expressionManagerRef.current.speakWithExpression(
                audioUrl,
                expression,
                options
              );
            }
          },
        },
      };

      console.log("✅ Enhanced window.live2d API ready");
      setIsGlobalAPIReady(true);

      // Dispatch events with a single timeout to avoid rapid firing
      eventDispatchTimeout = window.setTimeout(() => {
        console.log("📡 Broadcasting Live2D API availability (one-time)");

        // Dispatch custom event to notify other components
        window.dispatchEvent(
          new CustomEvent("live2d-model-availability-changed", {
            detail: {
              available: true,
              enhanced: true,
              modelName: modelInfo?.name,
              expressionCount:
                expressionManagerRef.current?.getExpressions().length || 0,
              parameterCount:
                expressionManagerRef.current?.getParameters().length || 0,
            },
          })
        );

        // Notify custom expression manager specifically
        window.dispatchEvent(
          new CustomEvent("live2d-api-ready", {
            detail: {
              apiType: "enhanced",
              timestamp: Date.now(),
              modelName: modelInfo?.name,
            },
          })
        );
      }, 300);
    } else {
      // Clear API if no model/manager - only if we had one before
      if (isGlobalAPIReady) {
        console.log("🚫 Clearing window.live2d API");
        // @ts-ignore
        delete window.live2d;

        // PARAMETER FIX: Clean up global model references
        (window as any).currentLive2DModel = null;
        (window as any).live2dModel = null;

        setIsGlobalAPIReady(false);

        // Single event dispatch for cleanup
        window.dispatchEvent(
          new CustomEvent("live2d-model-availability-changed", {
            detail: { available: false, enhanced: false },
          })
        );
      }
    }

    return () => {
      if (apiSetupTimeout) {
        clearTimeout(apiSetupTimeout);
      }
      if (eventDispatchTimeout) {
        clearTimeout(eventDispatchTimeout);
      }
    };
  }, [modelRef.current, expressionManagerRef.current, modelInfo?.name]);

  // Enhanced model loading effect with better change detection
  useEffect(() => {
    console.log("🔍 Model info changed, checking if load needed:", {
      hasUrl: !!modelInfo?.url,
      modelName: modelInfo?.name,
      isLocal: modelInfo?.isLocal,
      currentModel: !!modelRef.current,
      lastLoaded: lastLoadedModelRef.current,
    });

    if (modelInfo?.url) {
      const modelKey = `${modelInfo.url}_${modelInfo.name}_${modelInfo.isLocal}`;

      // Load if we don't have a model or if this is a different model
      if (!modelRef.current || lastLoadedModelRef.current !== modelKey) {
        console.log("🚀 Triggering model load");
        loadModel();
      } else {
        console.log("✅ Model already loaded and current");
      }
    } else {
      console.log("🚫 No model URL provided, cleaning up");
      cleanupModel();
    }
  }, [
    modelInfo?.url,
    modelInfo?.name,
    modelInfo?.isLocal,
    loadModel,
    cleanupModel,
  ]);

  // Update scale reference when it changes
  useEffect(() => {
    kScaleRef.current = modelInfo?.kScale;
    console.log("📏 Scale updated:", modelInfo?.kScale);
  }, [modelInfo?.kScale]);

  // Setup model size and position when ready
  useEffect(() => {
    if (isModelReady) {
      console.log("🎯 Model ready, setting up size and position");
      setupModelSizeAndPosition();
    }
  }, [isModelReady, setupModelSizeAndPosition]);

  // Setup interactions when model is ready
  useEffect(() => {
    if (modelRef.current && isModelReady) {
      console.log("🖱️ Model ready, setting up interactions");
      setupModelInteractions(modelRef.current);
    }
  }, [isModelReady, setupModelInteractions, forceIgnoreMouse]);

  // 🧠 MEMORY OPTIMIZATION: Expose capture service methods conditionally
  const captureApi = {
    startCapture: () => obsInitialized ? captureService.startCapture() : null,
    stopCapture: () => obsInitialized ? captureService.stopCapture() : undefined,
    getMediaStream: () => obsInitialized ? captureService.getMediaStream() : null,
    isCapturing: () => obsInitialized ? captureService.isCurrentlyCapturing() : false,
    captureFrame: () => obsInitialized ? captureService.captureFrame() : null,
    captureFrameAsBlob: (type?: "image/png" | "image/jpeg") =>
      obsInitialized ? captureService.captureFrameAsBlob(type) : Promise.resolve(null),
    getStats: () => obsInitialized ? captureService.getStats() : { isCapturing: false, frameRate: 0, hasStream: false },
    isOBSEnabled: () => obsEnabled,
    isOBSInitialized: () => obsInitialized,
  };

  return {
    canvasRef,
    appRef,
    modelRef,
    containerRef,
    capture: captureApi,
    expressionManager: expressionManagerRef.current,
    isGlobalAPIReady,
  };
};

const playRandomMotion = (model: Live2DModel, motionGroup: MotionWeightMap) => {
  if (!motionGroup || Object.keys(motionGroup).length === 0) return;

  const totalWeight = Object.values(motionGroup).reduce(
    (sum, weight) => sum + weight,
    0
  );
  let random = Math.random() * totalWeight;

  Object.entries(motionGroup).find(([motion, weight]) => {
    random -= weight;
    if (random <= 0) {
      const priority = audioTaskQueue.hasTask()
        ? MotionPriority.NORMAL
        : MotionPriority.FORCE;

      console.log(
        `Playing weighted motion: ${motion} (weight: ${weight}/${totalWeight}, priority: ${priority})`
      );

      // Use the lipsync patch's enhanced motion method
      (model as any).motion(motion, undefined, priority);
      return true;
    }
    return false;
  });
};

const getMergedMotionGroup = (tapMotions: TapMotionMap): MotionWeightMap => {
  const mergedMotions: {
    [key: string]: { total: number; count: number };
  } = {};

  Object.values(tapMotions)
    .flatMap((motionGroup) => Object.entries(motionGroup))
    .reduce((acc, [motion, weight]) => {
      if (!acc[motion]) {
        acc[motion] = { total: 0, count: 0 };
      }
      acc[motion].total += weight;
      acc[motion].count += 1;
      return acc;
    }, mergedMotions);

  return Object.entries(mergedMotions).reduce(
    (acc, [motion, { total, count }]) => ({
      ...acc,
      [motion]: total / count,
    }),
    {} as MotionWeightMap
  );
};