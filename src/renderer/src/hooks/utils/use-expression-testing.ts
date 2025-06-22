// src/renderer/src/hooks/utils/use-expression-testing.ts - COORDINATION FIX
import { useState, useCallback, useEffect, useRef } from "react";
import { useCustomExpressions } from "./use-custom-expressions";
import { toaster } from "@/components/ui/toaster";
import { customExpressionManager } from "@/services/custom-expression-manager";
import { useAppKeybinds } from "./use-app-keybinds"; // It's okay to have this dependency now

interface ExpressionInfo {
  name: string;
  index: number;
  isNumeric: boolean;
  isCustom: boolean;
  customExpressionId?: string;
}

interface UseExpressionTestingOptions {
  /** Duration to hold each expression (ms) */
  expressionDuration?: number;
  /** Whether to show toast notifications for expressions */
  showNotifications?: boolean;
  /** Whether to reset to default expression after testing */
  resetToDefault?: boolean;
  /** Default expression to reset to */
  defaultExpression?: string | number;
  /** Debug mode for detailed logging */
  debugMode?: boolean;
  /** Use enhanced expression manager when available */
  useEnhancedManager?: boolean;
  /** Include custom expressions in testing cycle */
  includeCustomExpressions?: boolean;
  /** Custom expression intensity when testing */
  customExpressionIntensity?: number;
  /** Custom expression transition duration */
  customExpressionTransition?: number;
}

/**
 * COORDINATION FIX: Enhanced hook for testing and cycling through Live2D model expressions
 * Fixed coordination between custom expressions and global Live2D API
 */
export const useExpressionTesting = (
  options: UseExpressionTestingOptions = {}
) => {
  const {
    expressionDuration = 3000,
    showNotifications = true,
    resetToDefault = true,
    defaultExpression = 0,
    debugMode = false,
    useEnhancedManager = true,
    includeCustomExpressions = true,
    customExpressionIntensity = 1.0,
    customExpressionTransition = 1000,
  } = options;

  // COORDINATION: Hook into unified custom expressions system
  const customExpressions = useCustomExpressions({
    showNotifications: false, // Avoid duplicate notifications
    autoRefresh: true,
    debugMode,
  });

  // State for expression testing - use refs for immediate access
  const [availableExpressions, setAvailableExpressionsState] = useState<
    ExpressionInfo[]
  >([]);
  const [currentExpressionIndex, setCurrentExpressionIndexState] = useState(0);
  const [isTestingInProgress, setIsTestingInProgressState] = useState(false);
  const [testingMode, setTestingModeState] = useState<
    "manual" | "auto" | "none"
  >("none");

  // Use refs to track current state for immediate access in callbacks
  const availableExpressionsRef = useRef<ExpressionInfo[]>([]);
  const currentExpressionIndexRef = useRef(0);
  const isTestingInProgressRef = useRef(false);
  const testingModeRef = useRef<"manual" | "auto" | "none">("none");

  // Update refs when state changes
  useEffect(() => {
    availableExpressionsRef.current = availableExpressions;
  }, [availableExpressions]);

  useEffect(() => {
    currentExpressionIndexRef.current = currentExpressionIndex;
  }, [currentExpressionIndex]);

  useEffect(() => {
    isTestingInProgressRef.current = isTestingInProgress;
  }, [isTestingInProgress]);

  useEffect(() => {
    testingModeRef.current = testingMode;
  }, [testingMode]);

  // State setters that update both state and refs
  const setAvailableExpressions = useCallback(
    (expressions: ExpressionInfo[]) => {
      setAvailableExpressionsState(expressions);
      availableExpressionsRef.current = expressions;
    },
    []
  );

  const setCurrentExpressionIndex = useCallback((index: number) => {
    setCurrentExpressionIndexState(index);
    currentExpressionIndexRef.current = index;
  }, []);

  const setIsTestingInProgress = useCallback((testing: boolean) => {
    setIsTestingInProgressState(testing);
    isTestingInProgressRef.current = testing;
  }, []);

  const setTestingMode = useCallback((mode: "manual" | "auto" | "none") => {
    setTestingModeState(mode);
    testingModeRef.current = mode;
  }, []);

  // Refs for auto-testing and discovery control
  const autoTestingIntervalRef = useRef<number | null>(null);
  const expressionTimeoutRef = useRef<number | null>(null);
  const isDiscoveringRef = useRef(false);

  /**
   * COORDINATION: Check if global Live2D API is available
   */
  const isGlobalAPIReady = useCallback((): boolean => {
    try {
      const hasEnhancedAPI = !!(
        (window as any).live2d?.enhancedExpression?.setExpression &&
        (window as any).live2d?.enhancedExpression?.getExpressions
      );

      const hasBasicAPI = !!(
        (window as any).live2d?.setExpression &&
        (window as any).live2d?.getExpressions
      );

      return hasEnhancedAPI || hasBasicAPI;
    } catch (error) {
      return false;
    }
  }, []);
  const canPerformExpressionOperations = useCallback((): boolean => {
    return isGlobalAPIReady() && availableExpressionsRef.current.length > 0;
  }, [isGlobalAPIReady]);
  /**
   * Check if enhanced expression manager is available
   */
  const hasEnhancedManager = useCallback(() => {
    return useEnhancedManager && (window as any).live2d?.enhancedExpression;
  }, [useEnhancedManager]);

  /**
   * COORDINATION: Discover model expressions using global Live2D API
   */
  const discoverModelExpressions = useCallback(async (): Promise<
    ExpressionInfo[]
  > => {
    if (!isGlobalAPIReady()) {
      if (debugMode) {
        console.log(
          "⚠️ Cannot discover model expressions: global Live2D API not ready"
        );
      }
      return [];
    }

    const modelExpressions: ExpressionInfo[] = [];

    try {
      // Try enhanced expression manager first
      if (hasEnhancedManager()) {
        const enhancedExprs = (
          window as any
        ).live2d.enhancedExpression.getExpressions();

        enhancedExprs.forEach((expr: any) => {
          modelExpressions.push({
            name: expr.name,
            index: expr.index,
            isNumeric: false,
            isCustom: false,
          });
        });

        if (debugMode) {
          console.log(
            "😊 Discovered model expressions via enhanced manager:",
            modelExpressions
          );
        }

        return modelExpressions;
      }

      // Fallback to legacy discovery methods
      const expressions = (window as any).live2d?.getExpressions?.();

      if (expressions && Array.isArray(expressions)) {
        expressions.forEach((name: string, index: number) => {
          modelExpressions.push({
            name,
            index,
            isNumeric: false,
            isCustom: false,
          });
        });

        if (debugMode) {
          console.log(
            "😊 Discovered model expressions via global API:",
            modelExpressions
          );
        }

        return modelExpressions;
      }

      // Last resort: Try numeric expressions (0-9)
      for (let i = 0; i < 10; i++) {
        modelExpressions.push({
          name: `Expression ${i}`,
          index: i,
          isNumeric: true,
          isCustom: false,
        });
      }

      if (debugMode) {
        console.log("😊 Using numeric expressions fallback:", modelExpressions);
      }

      return modelExpressions;
    } catch (error) {
      console.warn("Failed to discover model expressions:", error);
      return [];
    }
  }, [isGlobalAPIReady, debugMode, hasEnhancedManager]);

  /**
   * COORDINATION FIX: Discover custom expressions with better coordination
   */
  const discoverCustomExpressions = useCallback((): ExpressionInfo[] => {
    if (!includeCustomExpressions) {
      if (debugMode) {
        console.log("🎨 Custom expressions disabled via options");
      }
      return [];
    }

    try {
      // Method 1: Try via unified custom expressions hook (preferred)
      if (
        customExpressions.isInitialized &&
        customExpressions.enabledExpressions.length > 0
      ) {
        const hookExpressions = customExpressions.enabledExpressions.map(
          (expr, index) => ({
            name: `[Custom] ${expr.name}`,
            index: -1,
            isNumeric: false,
            isCustom: true,
            customExpressionId: expr.id,
          })
        );

        if (debugMode) {
          console.log(
            "🎨 Discovered custom expressions via hook:",
            hookExpressions
          );
        }

        return hookExpressions;
      }

      // Method 2: Try direct custom expression manager access (fallback)
      if (customExpressionManager.isReady()) {
        const managerExpressions = customExpressionManager
          .getCustomExpressions()
          .filter((expr) => expr.enabled)
          .map((expr, index) => ({
            name: `[Custom] ${expr.name}`,
            index: -1,
            isNumeric: false,
            isCustom: true,
            customExpressionId: expr.id,
          }));

        if (debugMode) {
          console.log(
            "🎨 Discovered custom expressions via direct manager:",
            managerExpressions
          );
        }

        return managerExpressions;
      }

      // Method 3: Check if custom expressions are stored globally
      const globalCustomExpressions = (window as any).customExpressions;
      if (
        Array.isArray(globalCustomExpressions) &&
        globalCustomExpressions.length > 0
      ) {
        const globalExpressions = globalCustomExpressions
          .filter((expr: any) => expr.enabled)
          .map((expr: any, index: number) => ({
            name: `[Custom] ${expr.name}`,
            index: -1,
            isNumeric: false,
            isCustom: true,
            customExpressionId: expr.id,
          }));

        if (debugMode) {
          console.log(
            "🎨 Discovered custom expressions via global storage:",
            globalExpressions
          );
        }

        return globalExpressions;
      }

      if (debugMode) {
        console.log("🎨 No custom expressions found. Status check:", {
          hookInitialized: customExpressions.isInitialized,
          hookExpressionsCount: customExpressions.enabledExpressions.length,
          managerReady: customExpressionManager.isReady(),
          managerExpressionsCount: customExpressionManager.isReady()
            ? customExpressionManager.getCustomExpressions().length
            : "N/A",
          globalExpressionsCount: Array.isArray(
            (window as any).customExpressions
          )
            ? (window as any).customExpressions.length
            : "N/A",
        });
      }

      return [];
    } catch (error) {
      console.warn("Failed to discover custom expressions:", error);
      return [];
    }
  }, [
    includeCustomExpressions,
    customExpressions.isInitialized,
    customExpressions.enabledExpressions.length,
    debugMode,
  ]);

  /**
   * COORDINATION: Unified discovery method that combines model and custom expressions
   */
  const discoverExpressions = useCallback(async () => {
    if (!isGlobalAPIReady() || isDiscoveringRef.current) {
      if (debugMode) {
        console.log(
          "⚠️ Cannot discover expressions: API not ready or discovery in progress",
          {
            apiReady: isGlobalAPIReady(),
            discovering: isDiscoveringRef.current,
          }
        );
      }
      return;
    }

    // Set discovery flag to prevent re-entry
    isDiscoveringRef.current = true;

    try {
      setAvailableExpressions([]);

      if (debugMode) {
        console.log("🔍 Starting coordinated expression discovery...");
      }

      // Discover model expressions
      const modelExprs = await discoverModelExpressions();

      // COORDINATION FIX: Add small delay to ensure custom expressions are ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Discover custom expressions
      const customExprs = discoverCustomExpressions();

      // Combine both types
      const allExpressions = [...modelExprs, ...customExprs];

      setAvailableExpressions(allExpressions);
      setCurrentExpressionIndex(0);

      if (debugMode) {
        console.log("🔄 Coordinated expression discovery completed:", {
          modelExpressions: modelExprs.length,
          customExpressions: customExprs.length,
          totalExpressions: allExpressions.length,
          customExpressionsDetails: customExprs.map((ce) => ce.name),
          timestamp: new Date().toISOString(),
        });
      }

      // Show discovery results in notifications if significant
      if (showNotifications && allExpressions.length > 0) {
        toaster.create({
          title: "Expressions Discovered",
          description: `Found ${allExpressions.length} expressions (${modelExprs.length} model, ${customExprs.length} custom)`,
          type: "info",
          duration: 2000,
        });
      }
    } catch (error) {
      console.warn("Failed to discover expressions:", error);
      setAvailableExpressions([]);
    } finally {
      // Always clear the discovery flag
      isDiscoveringRef.current = false;
    }
  }, [
    isGlobalAPIReady,
    debugMode,
    discoverModelExpressions,
    discoverCustomExpressions,
    setAvailableExpressions,
    setCurrentExpressionIndex,
    showNotifications,
  ]);

  /**
   * COORDINATION: Apply an expression to the model using global Live2D API
   */
  const applyExpressionSafe = useCallback(
    async (expression: string | number) => {
      if (!isGlobalAPIReady()) {
        console.warn("No model available for expression testing");
        return false;
      }

      try {
        // Method 1: Try enhanced expression manager first (most stable)
        if ((window as any).live2d?.enhancedExpression?.setExpression) {
          try {
            await (window as any).live2d.enhancedExpression.setExpression(
              expression.toString(),
              1.0,
              500
            );

            if (debugMode) {
              console.log(
                `😊 Applied expression via enhanced API: ${expression}`
              );
            }

            return true;
          } catch (enhancedError) {
            console.debug("Enhanced API failed:", enhancedError);
          }
        }

        // Method 2: Try basic global API
        if ((window as any).live2d?.setExpression) {
          try {
            (window as any).live2d.setExpression(expression);

            if (debugMode) {
              console.log(
                `😊 Applied expression via global API: ${expression}`
              );
            }

            return true;
          } catch (globalError) {
            console.debug("Global API failed:", globalError);
          }
        }

        // Method 3: Try legacy expression method
        if ((window as any).live2d?.expression) {
          try {
            (window as any).live2d.expression(expression);

            if (debugMode) {
              console.log(
                `😊 Applied expression via legacy API: ${expression}`
              );
            }

            return true;
          } catch (legacyError) {
            console.debug("Legacy API failed:", legacyError);
          }
        }

        console.warn("No expression API available in global Live2D");
        return false;
      } catch (error) {
        console.error("Failed to apply expression:", error);
        return false;
      }
    },
    [isGlobalAPIReady, debugMode]
  );

  /**
   * COORDINATION FIX: Apply custom expression with multiple fallback methods
   */
  const applyCustomExpression = useCallback(
    async (
      customExpressionId: string,
      intensity: number = customExpressionIntensity,
      transitionDuration: number = customExpressionTransition
    ) => {
      try {
        // Method 1: Try via unified custom expressions hook (preferred)
        if (customExpressions.isInitialized) {
          const expression = customExpressions.customExpressions.find(
            (expr) => expr.id === customExpressionId
          );
          if (expression) {
            const success = await customExpressions.testExpression(
              expression.name,
              intensity,
              transitionDuration
            );

            if (debugMode) {
              console.log(
                `🎨 Applied custom expression via hook: ${expression.name} (success: ${success})`
              );
            }

            return success;
          }
        }

        // Method 2: Try direct custom expression manager (fallback)
        if (customExpressionManager.isReady()) {
          const expressions = customExpressionManager.getCustomExpressions();
          const expression = expressions.find(
            (expr) => expr.id === customExpressionId
          );

          if (expression) {
            const success = await customExpressionManager.applyCustomExpression(
              expression.name,
              intensity,
              transitionDuration
            );

            if (debugMode) {
              console.log(
                `🎨 Applied custom expression via direct manager: ${expression.name} (success: ${success})`
              );
            }

            return success;
          }
        }

        console.warn(`Custom expression not found: ${customExpressionId}`);
        return false;
      } catch (error) {
        console.error("Failed to apply custom expression:", error);
        return false;
      }
    },
    [
      customExpressions.isInitialized,
      customExpressions.customExpressions,
      customExpressions.testExpression,
      customExpressionIntensity,
      customExpressionTransition,
      debugMode,
    ]
  );

  /**
   * COORDINATION: Enhanced test expression method that handles both types safely
   */
  const testExpression = useCallback(
    async (
      index: number,
      intensity: number = 1.0,
      transitionDuration: number = 0
    ) => {
      if (index < 0 || index >= availableExpressionsRef.current.length) {
        console.warn(`Invalid expression index: ${index}`);
        return;
      }

      const expression = availableExpressionsRef.current[index];

      setIsTestingInProgress(true);
      setCurrentExpressionIndex(index);

      let success = false;

      try {
        if (expression.isCustom && expression.customExpressionId) {
          // Apply custom expression
          success = await applyCustomExpression(
            expression.customExpressionId,
            intensity,
            transitionDuration
          );
        } else {
          // Apply model expression using unified safe method
          const expressionValue = expression.isNumeric
            ? expression.index
            : expression.name;
          success = await applyExpressionSafe(expressionValue);
        }

        if (success) {
          if (showNotifications) {
            toaster.create({
              title: "Expression Test",
              description: `Testing: ${expression.name} (intensity: ${intensity})${expression.isCustom ? " [Custom]" : ""}`,
              type: "info",
              duration: 2000,
            });
          }

          console.log(
            `🎭 Testing expression ${index + 1}/${availableExpressionsRef.current.length}: ${expression.name}${expression.isCustom ? " [Custom]" : ""}`
          );
        } else {
          if (showNotifications) {
            toaster.create({
              title: "Expression Test Failed",
              description: `Failed to apply: ${expression.name}`,
              type: "error",
              duration: 3000,
            });
          }
        }

        // Reset after duration if configured
        if (resetToDefault && expressionDuration > 0) {
          expressionTimeoutRef.current = window.setTimeout(async () => {
            if (expression.isCustom) {
              // Reset custom expressions to default
              await customExpressions.resetToDefault();
            } else {
              await applyExpressionSafe(defaultExpression);
            }
            setIsTestingInProgress(false);
          }, expressionDuration);
        } else {
          setIsTestingInProgress(false);
        }
      } catch (error) {
        console.error(`Failed to test expression ${expression.name}:`, error);
        setIsTestingInProgress(false);

        if (showNotifications) {
          toaster.create({
            title: "Expression Test Error",
            description: `Error testing: ${expression.name}`,
            type: "error",
            duration: 3000,
          });
        }
      }
    },
    [
      applyCustomExpression,
      applyExpressionSafe,
      customExpressions.resetToDefault,
      showNotifications,
      resetToDefault,
      expressionDuration,
      defaultExpression,
      setIsTestingInProgress,
      setCurrentExpressionIndex,
    ]
  );

  /**
   * Cycle to the next expression
   */
  const nextExpression = useCallback(
    async (intensity: number = 1.0, transitionDuration: number = 0) => {
      if (availableExpressionsRef.current.length === 0) return;

      const nextIndex =
        (currentExpressionIndexRef.current + 1) %
        availableExpressionsRef.current.length;
      await testExpression(nextIndex, intensity, transitionDuration);
    },
    [testExpression]
  );

  /**
   * Cycle to the previous expression
   */
  const previousExpression = useCallback(
    async (intensity: number = 1.0, transitionDuration: number = 0) => {
      if (availableExpressionsRef.current.length === 0) return;

      const prevIndex =
        currentExpressionIndexRef.current === 0
          ? availableExpressionsRef.current.length - 1
          : currentExpressionIndexRef.current - 1;
      await testExpression(prevIndex, intensity, transitionDuration);
    },
    [testExpression]
  );

  /**
   * Start automatic cycling through all expressions
   */
  const startAutoTesting = useCallback(
    (intensity: number = 1.0, transitionDuration: number = 500) => {
      if (availableExpressions.length === 0 || testingMode === "auto") return;

      setTestingMode("auto");
      setCurrentExpressionIndex(0);

      const runAutoTest = async () => {
        if (testingMode !== "auto") return;

        for (let i = 0; i < availableExpressions.length; i++) {
          if (testingMode !== "auto") break;

          await testExpression(i, intensity, transitionDuration);

          // Wait for expression duration plus a small buffer
          await new Promise((resolve) => {
            autoTestingIntervalRef.current = window.setTimeout(
              resolve,
              expressionDuration + 500
            );
          });
        }

        // Reset to default and finish
        if (testingMode === "auto") {
          await applyExpressionSafe(defaultExpression);
          setTestingMode("none");
          setIsTestingInProgress(false);

          if (showNotifications) {
            toaster.create({
              title: "Expression Testing Complete",
              description: `Tested ${availableExpressions.length} expressions (${availableExpressions.filter((e) => e.isCustom).length} custom)`,
              type: "success",
              duration: 3000,
            });
          }
        }
      };

      runAutoTest();
      console.log(
        `🔄 Started auto testing ${availableExpressions.length} expressions (${availableExpressions.filter((e) => e.isCustom).length} custom)`
      );
    },
    [
      availableExpressions,
      testingMode,
      expressionDuration,
      testExpression,
      applyExpressionSafe,
      defaultExpression,
      showNotifications,
      setTestingMode,
      setCurrentExpressionIndex,
      setIsTestingInProgress,
    ]
  );

  /**
   * Stop automatic testing
   */
  const stopAutoTesting = useCallback(async () => {
    if (testingMode !== "auto") return;

    setTestingMode("none");
    setIsTestingInProgress(false);

    // Clear any pending timeouts
    if (autoTestingIntervalRef.current) {
      clearTimeout(autoTestingIntervalRef.current);
      autoTestingIntervalRef.current = null;
    }

    if (expressionTimeoutRef.current) {
      clearTimeout(expressionTimeoutRef.current);
      expressionTimeoutRef.current = null;
    }

    // Reset to default expression
    await applyExpressionSafe(defaultExpression);

    console.log("⏹️ Stopped auto testing");
  }, [
    testingMode,
    applyExpressionSafe,
    defaultExpression,
    setTestingMode,
    setIsTestingInProgress,
  ]);

  /**
   * COORDINATION: Reset to default expression using global API
   */
  const resetToDefaultExpression = useCallback(async () => {
    setIsTestingInProgress(false);
    setTestingMode("none");

    // Clear any pending timeouts
    if (expressionTimeoutRef.current) {
      clearTimeout(expressionTimeoutRef.current);
      expressionTimeoutRef.current = null;
    }

    // Use unified safe expression application for reset
    await applyExpressionSafe(defaultExpression);

    // Also reset custom expressions via unified manager
    if (customExpressions.isInitialized) {
      await customExpressions.resetToDefault();
    }

    console.log("🔄 Reset to default expression");
  }, [
    applyExpressionSafe,
    defaultExpression,
    customExpressions.isInitialized,
    customExpressions.resetToDefault,
    setIsTestingInProgress,
    setTestingMode,
  ]);

  /**
   * Get current expression info
   */
  const getCurrentExpressionInfo = useCallback(() => {
    if (
      currentExpressionIndex >= 0 &&
      currentExpressionIndex < availableExpressions.length
    ) {
      return availableExpressions[currentExpressionIndex];
    }
    return null;
  }, [currentExpressionIndex, availableExpressions]);

  /**
   * Get statistics about available expressions (memoized)
   */
  const getExpressionStatistics = useCallback(() => {
    const modelExprs = availableExpressions.filter((e) => !e.isCustom);
    const customExprs = availableExpressions.filter((e) => e.isCustom);

    return {
      total: availableExpressions.length,
      model: modelExprs.length,
      custom: customExprs.length,
      hasCustom: customExprs.length > 0,
      hasModel: modelExprs.length > 0,
      customEnabled: customExpressions.enabledExpressions.length,
      customTotal: customExpressions.customExpressions.length,
    };
  }, [
    availableExpressions,
    customExpressions.enabledExpressions.length,
    customExpressions.customExpressions.length,
  ]);

  // COORDINATION: Discover expressions when global API becomes ready
  useEffect(() => {
    if (isGlobalAPIReady()) {
      // Small delay to ensure API is fully loaded
      const timer = setTimeout(() => {
        discoverExpressions();
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      // Clear state when API not ready
      setAvailableExpressions([]);
    }
  }, [isGlobalAPIReady, discoverExpressions, setAvailableExpressions]);

  // COORDINATION FIX: Re-discover expressions when custom expressions change (with better timing)
  useEffect(() => {
    if (isGlobalAPIReady()) {
      // Use a longer timeout to ensure custom expressions are fully loaded
      const timer = setTimeout(() => {
        if (debugMode) {
          console.log("🎨 Custom expressions changed, rediscovering...", {
            hookInitialized: customExpressions.isInitialized,
            enabledCount: customExpressions.enabledExpressions.length,
            totalCount: customExpressions.customExpressions.length,
          });
        }
        discoverExpressions();
      }, 1500); // Longer delay for custom expressions

      return () => clearTimeout(timer);
    }
  }, [
    isGlobalAPIReady,
    customExpressions.isInitialized,
    customExpressions.enabledExpressions.length,
    discoverExpressions,
    debugMode,
  ]);

  // COORDINATION: Listen for custom expressions changes
  useEffect(() => {
    const handleCustomExpressionsChanged = (event: CustomEvent) => {
      const { action, expressionName, totalExpressions, enabledExpressions } =
        event.detail;

      if (debugMode) {
        console.log(`🎨 Custom expressions changed: ${action}`, {
          expressionName,
          totalExpressions,
          enabledExpressions,
          timestamp: event.detail.timestamp,
        });
      }

      // Rediscover expressions when custom expressions change
      if (isGlobalAPIReady()) {
        setTimeout(() => {
          discoverExpressions();
        }, 200); // Short delay to ensure changes are saved
      }
    };

    window.addEventListener(
      "custom-expressions-changed",
      handleCustomExpressionsChanged as EventListener
    );

    return () => {
      window.removeEventListener(
        "custom-expressions-changed",
        handleCustomExpressionsChanged as EventListener
      );
    };
  }, [isGlobalAPIReady, discoverExpressions, debugMode]);

  // COORDINATION: Listen for global API availability changes
  useEffect(() => {
    const handleAPIAvailabilityChange = (event: CustomEvent) => {
      const { available, enhanced } = event.detail;

      if (debugMode) {
        console.log(
          `🌐 Live2D API availability changed in expression testing: available=${available}, enhanced=${enhanced}`
        );
      }

      if (available) {
        // Try to discover expressions now that API is available
        setTimeout(() => {
          discoverExpressions();
        }, 1000);
      } else {
        // Clear expressions when API becomes unavailable
        setAvailableExpressions([]);
      }
    };

    window.addEventListener(
      "live2d-model-availability-changed",
      handleAPIAvailabilityChange as EventListener
    );

    return () => {
      window.removeEventListener(
        "live2d-model-availability-changed",
        handleAPIAvailabilityChange as EventListener
      );
    };
  }, [discoverExpressions, setAvailableExpressions, debugMode]);

  // COORDINATION: Manual refresh trigger (for D key)
  useEffect(() => {
    const handleManualRefresh = () => {
      if (debugMode) {
        console.log("🔄 Manual expression refresh triggered via event");
      }
      discoverExpressions();
    };

    window.addEventListener(
      "expression-refresh-requested",
      handleManualRefresh
    );

    return () => {
      window.removeEventListener(
        "expression-refresh-requested",
        handleManualRefresh
      );
    };
  }, [discoverExpressions, debugMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoTestingIntervalRef.current) {
        clearTimeout(autoTestingIntervalRef.current);
      }
      if (expressionTimeoutRef.current) {
        clearTimeout(expressionTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Legacy expression data
    availableExpressions,
    currentExpressionIndex,
    getCurrentExpressionInfo,

    // Manual testing
    testExpression,
    nextExpression,
    previousExpression,
    resetToDefaultExpression,

    // Auto testing
    startAutoTesting,
    stopAutoTesting,

    // Custom expression integration
    customExpressions: customExpressions, // Access to full custom expressions hook
    applyCustomExpression,
    getExpressionStatistics,
    canPerformExpressionOperations,

    // State
    isTestingInProgress,
    testingMode,
    hasExpressions: availableExpressions.length > 0,

    // Utilities
    discoverExpressions,
    applyExpression: applyExpressionSafe, // COORDINATION: Use safe expression application

    // COORDINATION: Additional status
    isGlobalAPIReady: isGlobalAPIReady(),

    // COORDINATION: Debug helpers
    debugInfo: debugMode
      ? {
          customExpressionsHookInitialized: customExpressions.isInitialized,
          customExpressionsEnabledCount:
            customExpressions.enabledExpressions.length,
          customExpressionManagerReady: customExpressionManager.isReady(),
          globalAPIReady: isGlobalAPIReady(),
          availableExpressionsCount: availableExpressions.length,
          customExpressionsInAvailable: availableExpressions.filter(
            (e) => e.isCustom
          ).length,
        }
      : undefined,
  };
};
