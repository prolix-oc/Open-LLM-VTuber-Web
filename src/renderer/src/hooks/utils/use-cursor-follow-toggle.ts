// src/renderer/src/hooks/utils/use-cursor-follow-toggle.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { useLive2DModel } from '@/context/live2d-model-context';
import { useForceIgnoreMouse } from './use-force-ignore-mouse';

interface RandomLookPattern {
  /** Minimum time between look changes (ms) */
  minInterval: number;
  /** Maximum time between look changes (ms) */
  maxInterval: number;
  /** Range of X movement (-1 to 1) */
  xRange: { min: number; max: number };
  /** Range of Y movement (-1 to 1) */
  yRange: { min: number; max: number };
  /** Smoothing factor for transitions (0-1) */
  smoothing: number;
  /** Whether to occasionally look at the center */
  returnToCenter: boolean;
  /** Probability of returning to center (0-1) */
  centerProbability: number;
}

interface UseCursorFollowToggleOptions {
  /** Custom random look pattern configuration */
  randomPattern?: Partial<RandomLookPattern>;
  /** Whether to persist the setting in localStorage */
  persistent?: boolean;
  /** localStorage key for persistence */
  storageKey?: string;
  /** Debug mode for logging */
  debugMode?: boolean;
}

/**
 * Default random look pattern configuration with enhanced variance
 */
const DEFAULT_RANDOM_PATTERN: RandomLookPattern = {
  minInterval: 1500,
  maxInterval: 6000,
  xRange: { min: -0.9, max: 0.9 },
  yRange: { min: -0.4, max: 0.6 },
  smoothing: 0.15,
  returnToCenter: true,
  centerProbability: 0.25,
};

/**
 * Hook for toggling between cursor follow mode and random look patterns
 * Provides natural-looking eye movement when cursor following is disabled
 */
export const useCursorFollowToggle = (options: UseCursorFollowToggleOptions = {}) => {
  const {
    randomPattern = {},
    persistent = true,
    storageKey = 'vtuber-cursor-follow-enabled',
    debugMode = false
  } = options;

  const { currentModel } = useLive2DModel();
  const { forceIgnoreMouse, setForceIgnoreMouse } = useForceIgnoreMouse();
  
  // Combine default and custom pattern
  const pattern = { ...DEFAULT_RANDOM_PATTERN, ...randomPattern };

  // State for cursor follow mode - use ref for immediate access and state for reactivity
  const [isCursorFollowEnabled, setIsCursorFollowEnabledState] = useState(() => {
    if (persistent && typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      const enabled = stored ? JSON.parse(stored) : true;
      // Sync with forceIgnoreMouse on initialization
      setForceIgnoreMouse(!enabled);
      return enabled;
    }
    return true;
  });

  // Use ref to track current state for immediate access in callbacks
  const isCursorFollowEnabledRef = useRef(isCursorFollowEnabled);
  
  // Update ref when state changes
  useEffect(() => {
    isCursorFollowEnabledRef.current = isCursorFollowEnabled;
  }, [isCursorFollowEnabled]);

  // Refs for random look pattern
  const randomLookIntervalRef = useRef<number | null>(null);
  const currentLookTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isRandomLookActiveRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  /**
   * Internal state setter that syncs with forceIgnoreMouse
   */
  const setIsCursorFollowEnabled = useCallback((enabled: boolean) => {
    setIsCursorFollowEnabledState(enabled);
    isCursorFollowEnabledRef.current = enabled;
    
    // Sync with the existing forceIgnoreMouse system
    setForceIgnoreMouse(!enabled);
    
    // Persist to localStorage
    if (persistent) {
      localStorage.setItem(storageKey, JSON.stringify(enabled));
    }
    
    if (debugMode) {
      console.log(`🎯 Cursor follow state changed: ${enabled ? 'enabled' : 'disabled'}, forceIgnoreMouse: ${!enabled}`);
    }
  }, [setForceIgnoreMouse, persistent, storageKey, debugMode]);
  /**
   * Generate a random look target with enhanced variance and natural patterns
   */
  const generateRandomLookTarget = useCallback(() => {
    // Determine if we should look at center
    const shouldLookAtCenter = pattern.returnToCenter && Math.random() < pattern.centerProbability;
    
    if (shouldLookAtCenter) {
      return { x: 0, y: 0 };
    }

    // Create more natural variance with bias toward certain areas
    const biasTypes = ['corners', 'sides', 'center_area', 'random'];
    const biasType = biasTypes[Math.floor(Math.random() * biasTypes.length)];
    
    let x: number, y: number;
    
    switch (biasType) {
      case 'corners':
        // Bias toward corners for more dramatic looks
        x = Math.random() > 0.5 ? 
          pattern.xRange.min + Math.random() * 0.3 : 
          pattern.xRange.max - Math.random() * 0.3;
        y = Math.random() > 0.5 ? 
          pattern.yRange.min + Math.random() * 0.3 : 
          pattern.yRange.max - Math.random() * 0.3;
        break;
        
      case 'sides':
        // Bias toward left/right sides
        x = Math.random() > 0.5 ? 
          pattern.xRange.min + Math.random() * 0.4 : 
          pattern.xRange.max - Math.random() * 0.4;
        y = (pattern.yRange.min + pattern.yRange.max) / 2 + 
            (Math.random() - 0.5) * 0.6;
        break;
        
      case 'center_area':
        // Stay closer to center for subtle movement
        x = (Math.random() - 0.5) * 0.6;
        y = (Math.random() - 0.5) * 0.4;
        break;
        
      default:
        // Pure random within range
        x = pattern.xRange.min + Math.random() * (pattern.xRange.max - pattern.xRange.min);
        y = pattern.yRange.min + Math.random() * (pattern.yRange.max - pattern.yRange.min);
    }

    // Add slight randomization to make it feel more natural
    x += (Math.random() - 0.5) * 0.1;
    y += (Math.random() - 0.5) * 0.1;
    
    // Clamp to ensure we stay within bounds
    x = Math.max(pattern.xRange.min, Math.min(pattern.xRange.max, x));
    y = Math.max(pattern.yRange.min, Math.min(pattern.yRange.max, y));

    return { x, y };
  }, [pattern]);

  /**
   * Apply look target to the Live2D model with proper focus controller management
   */
  const applyLookTarget = useCallback((targetX: number, targetY: number, immediate: boolean = false) => {
    if (!currentModel) return;

    try {
      const focusController = currentModel.internalModel?.focusController;
      if (!focusController) {
        if (debugMode) {
          console.warn('Focus controller not available on model');
        }
        return;
      }

      if (immediate) {
        // Immediate application (for cursor follow mode - but we let the model handle this)
        // In cursor follow mode, we don't manually set targets, the model does it automatically
        return;
      }

      // Manual control for random look mode
      if (!isCursorFollowEnabledRef.current) {
        // We're in random look mode, apply the target manually
        focusController.targetX = targetX;
        focusController.targetY = targetY;
        
        if (debugMode) {
          console.log(`👁️ Manual look target applied: (${targetX.toFixed(2)}, ${targetY.toFixed(2)})`);
        }
      }
      
    } catch (error) {
      console.warn('Failed to apply look target to model:', error);
    }
  }, [currentModel, debugMode]);

  /**
   * Start random look pattern
   */
  const startRandomLookPattern = useCallback(() => {
    if (isRandomLookActiveRef.current || !currentModel) return;

    isRandomLookActiveRef.current = true;
    
    const scheduleNextLook = () => {
      if (!isRandomLookActiveRef.current) return;

      const interval = pattern.minInterval + 
        Math.random() * (pattern.maxInterval - pattern.minInterval);
      
      randomLookIntervalRef.current = window.setTimeout(() => {
        if (!isRandomLookActiveRef.current) return;

        const newTarget = generateRandomLookTarget();
        currentLookTargetRef.current = newTarget;
        applyLookTarget(newTarget.x, newTarget.y);
        
        if (debugMode) {
          console.log(`🎯 Random look: (${newTarget.x.toFixed(2)}, ${newTarget.y.toFixed(2)}) next in ${interval}ms`);
        }
        
        scheduleNextLook();
      }, interval);
    };

    scheduleNextLook();
    console.log('🔄 Started random look pattern');
  }, [currentModel, pattern, generateRandomLookTarget, applyLookTarget, debugMode]);

  /**
   * Stop random look pattern
   */
  const stopRandomLookPattern = useCallback(() => {
    if (!isRandomLookActiveRef.current) return;

    isRandomLookActiveRef.current = false;
    
    if (randomLookIntervalRef.current) {
      clearTimeout(randomLookIntervalRef.current);
      randomLookIntervalRef.current = null;
    }
    
    console.log('⏹️ Stopped random look pattern');
  }, []);

  /**
   * Toggle between cursor follow and random look pattern
   */
  const toggleCursorFollow = useCallback(() => {
    const newMode = !isCursorFollowEnabledRef.current;
    setIsCursorFollowEnabled(newMode);
    
    if (newMode) {
      // Enabling cursor follow - stop random pattern
      stopRandomLookPattern();
      console.log('👁️ Cursor follow enabled');
    } else {
      // Disabling cursor follow - start random pattern
      startRandomLookPattern();
      console.log('🎲 Random look pattern enabled');
    }
  }, []);

  /**
   * Explicitly enable cursor follow
   */
  const enableCursorFollow = useCallback(() => {
    if (!isCursorFollowEnabled) {
      toggleCursorFollow();
    }
  }, [isCursorFollowEnabled, toggleCursorFollow]);

  /**
   * Explicitly enable random look pattern
   */
  const enableRandomLook = useCallback(() => {
    if (isCursorFollowEnabled) {
      toggleCursorFollow();
    }
  }, [isCursorFollowEnabled, toggleCursorFollow]);

  /**
   * Manually trigger a random look (useful for testing)
   */
  const triggerRandomLook = useCallback(() => {
    if (isCursorFollowEnabled) return;

    const newTarget = generateRandomLookTarget();
    currentLookTargetRef.current = newTarget;
    applyLookTarget(newTarget.x, newTarget.y);
    
    console.log(`🎯 Manual random look: (${newTarget.x.toFixed(2)}, ${newTarget.y.toFixed(2)})`);
  }, [isCursorFollowEnabled, generateRandomLookTarget, applyLookTarget]);

  /**
   * Reset look to center
   */
  const lookAtCenter = useCallback(() => {
    currentLookTargetRef.current = { x: 0, y: 0 };
    applyLookTarget(0, 0);
    console.log('👁️ Looking at center');
  }, [applyLookTarget]);

  // Initialize model cursor follow state when model changes
  useEffect(() => {
    if (currentModel) {
      // Small delay to ensure model is fully loaded
      const timer = setTimeout(() => {
        if (isCursorFollowEnabledRef.current) {
          stopRandomLookPattern()
        } else {
          startRandomLookPattern();
        }
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      // Clean up when model is removed
      stopRandomLookPattern();
    }
  }, [currentModel, startRandomLookPattern, stopRandomLookPattern]);

  // Sync with forceIgnoreMouse changes from external sources (like existing model interactions)
  useEffect(() => {
    const shouldBeEnabled = !forceIgnoreMouse;
    if (shouldBeEnabled !== isCursorFollowEnabledRef.current) {
      if (debugMode) {
        console.log(`🔄 Syncing cursor follow with forceIgnoreMouse: ${shouldBeEnabled}`);
      }
      
      // Update state but don't trigger the full toggle (to avoid loops)
      setIsCursorFollowEnabledState(shouldBeEnabled);
      isCursorFollowEnabledRef.current = shouldBeEnabled;
      
      // Update persistence
      if (persistent) {
        localStorage.setItem(storageKey, JSON.stringify(shouldBeEnabled));
      }
      
      // Handle model state
      if (currentModel) {
        if (shouldBeEnabled) {
          stopRandomLookPattern();
        } else {
          setTimeout(() => {
            if (!isCursorFollowEnabledRef.current) {
              startRandomLookPattern();
            }
          }, 100);
        }
      }
    }
  }, [forceIgnoreMouse, debugMode, persistent, storageKey, currentModel, startRandomLookPattern, stopRandomLookPattern]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRandomLookPattern();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Restore model cursor follow if we disabled it
      if (currentModel && !isCursorFollowEnabledRef.current) {
        enableCursorFollow();
      }
    };
  }, [stopRandomLookPattern, currentModel, enableCursorFollow]);

  // Update ref when state changes (for external state updates)
  useEffect(() => {
    isCursorFollowEnabledRef.current = isCursorFollowEnabled;
  }, [isCursorFollowEnabled]);

  return {
    isCursorFollowEnabled: isCursorFollowEnabledRef.current,
    toggleCursorFollow,
    enableCursorFollow,
    enableRandomLook,
    triggerRandomLook,
    lookAtCenter,
    
    // State information
    isRandomLookActive: isRandomLookActiveRef.current,
    currentLookTarget: currentLookTargetRef.current,
    
    // Configuration
    pattern,
    
    // Debug info
    forceIgnoreMouse,
    
    // Internal methods for debugging
    _internal: debugMode ? {
      startRandomLookPattern,
      stopRandomLookPattern,
    } : undefined,
  };
};