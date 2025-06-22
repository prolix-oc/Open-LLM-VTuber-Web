// src/renderer/src/hooks/utils/use-app-keybinds.ts - UNIFIED FIX
import { useEffect, useRef, useCallback } from 'react';
import { useKeybindSystem } from './use-keybind-system';
import { useUIToggle } from './use-ui-toggle';
import { useCursorFollowToggle } from './use-cursor-follow-toggle';
import { useExpressionTesting } from './use-expression-testing';
import { toaster } from '@/components/ui/toaster';

interface UseAppKeybindsOptions {
  /** Whether keybinds are enabled */
  enabled?: boolean;
  /** Whether to show notifications for keybind actions */
  showNotifications?: boolean;
  /** Whether to show help on first load */
  showHelpOnLoad?: boolean;
  /** Debug mode for detailed logging */
  debugMode?: boolean;
  /** Include custom expressions in testing */
  includeCustomExpressions?: boolean;
}

/**
 * Detect the current platform for cross-platform keybind support
 */
const detectPlatform = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  
  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'mac';
  } else if (platform.includes('win') || userAgent.includes('win')) {
    return 'windows';
  } else {
    return 'linux'; // Default for Linux and other Unix-like systems
  }
};

/**
 * UNIFIED: Enhanced hook that sets up all application keybinds with custom expression support
 * Uses global Live2D API instead of direct model references
 */
export const useAppKeybinds = (options: UseAppKeybindsOptions = {}) => {
  const {
    enabled = true,
    showNotifications = true,
    showHelpOnLoad = false,
    debugMode = false,
    includeCustomExpressions = true
  } = options;

  const platform = detectPlatform();

  // Initialize the keybind system
  const {
    registerKeybind,
    unregisterKeybind,
    getKeybindsByCategory,
    isEnabled: keybindSystemEnabled
  } = useKeybindSystem({
    enabled,
    preventDefault: true,
    debugMode
  });

  // Initialize feature hooks
  const uiToggle = useUIToggle({
    animated: true,
    transitionDuration: 300,
    persistent: true
  });

  const cursorFollow = useCursorFollowToggle({
    persistent: true,
    debugMode
  });

  // UNIFIED: Enhanced expression testing with custom expression support
  const expressionTesting = useExpressionTesting({
    expressionDuration: 3000,
    showNotifications,
    resetToDefault: true,
    debugMode,
    includeCustomExpressions, // Pass through the option
    customExpressionIntensity: 1.0,
    customExpressionTransition: 1000
  });

  // Track registered keybind IDs for cleanup and prevent duplicate registration
  const registeredKeybindsRef = useRef<string[]>([]);
  const registrationTimeoutRef = useRef<number | null>(null);

  /**
   * UNIFIED: Check if global Live2D API is ready for operations
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

  /**
   * Enhanced notification system with custom expression awareness
   */
  const showKeybindNotification = (title: string, description: string, type: 'info' | 'success' | 'warning' = 'info') => {
    if (!showNotifications) return;
    
    toaster.create({
      title,
      description,
      type,
      duration: 2000,
    });
  };

  /**
   * Enhanced help modal with custom expression information
   */
  const showKeybindHelp = () => {
    const categories = getKeybindsByCategory();
    const stats = expressionTesting.getExpressionStatistics();
    
    let helpContent = 'VTuber Application Keybinds:\n\n';
    
    // Add expression statistics
    helpContent += `Expression Statistics:\n`;
    helpContent += `  Total Expressions: ${stats.total}\n`;
    helpContent += `  Model Expressions: ${stats.model}\n`;
    helpContent += `  Custom Expressions: ${stats.custom}\n`;
    if (stats.hasCustom) {
      helpContent += `  Custom Status: ${stats.customEnabled}/${stats.customTotal} enabled\n`;
    }
    helpContent += '\n';
    
    Object.entries(categories).forEach(([category, keybinds]) => {
      helpContent += `${category}:\n`;
      keybinds.forEach(keybind => {
        const keyCombo = [];
        if (keybind.ctrlKey) keyCombo.push('Ctrl');
        if (keybind.altKey) keyCombo.push('Alt');
        if (keybind.shiftKey) keyCombo.push('Shift');
        if (keybind.metaKey) keyCombo.push('Meta');
        keyCombo.push(keybind.key.toUpperCase());
        
        helpContent += `  ${keyCombo.join('+')} - ${keybind.description}\n`;
      });
      helpContent += '\n';
    });

    // Use toaster for help display
    toaster.create({
      title: 'Keybind Help',
      description: `Check console for detailed keybind list. Found ${stats.total} expressions (${stats.custom} custom)`,
      type: 'info',
      duration: 5000,
    });

    console.log(helpContent);
  };

  /**
   * Enhanced expression testing notification with type detection
   */
  const showExpressionTestNotification = (direction: 'next' | 'previous') => {
    if (!expressionTesting.hasExpressions) {
      showKeybindNotification('Expression Test', 'No expressions available - try loading a model or refreshing with D', 'warning');
      return;
    }

    // UNIFIED: Check if there's a global API ready
    if (!isGlobalAPIReady()) {
      showKeybindNotification('Expression Test', 'No Live2D API available - please load a model first', 'warning');
      return;
    }

    const current = expressionTesting.getCurrentExpressionInfo();
    if (current) {
      const expressionType = current.isCustom ? '[Custom]' : '[Model]';
      const stats = expressionTesting.getExpressionStatistics();
      
      showKeybindNotification(
        'Expression Test',
        `${expressionType} ${current.name} (${expressionTesting.currentExpressionIndex + 1}/${stats.total})`,
        'info'
      );
      
      if (debugMode) {
        console.log(`🎭 Expression cycling: ${direction}`, {
          current: current.name,
          isCustom: current.isCustom,
          index: expressionTesting.currentExpressionIndex,
          total: stats.total,
          customCount: stats.custom,
          modelCount: stats.model
        });
      }
    }
  };

  /**
   * UNIFIED: Check if expression operations are safe to perform
   */
  const canPerformExpressionOperations = useCallback(() => {
    return isGlobalAPIReady() && expressionTesting.hasExpressions;
  }, [isGlobalAPIReady, expressionTesting.hasExpressions]);

  /**
   * Get platform-appropriate modifier keys
   */
  const getModifierKeys = (useModifier: boolean = true) => {
    if (!useModifier) return { ctrlKey: false, altKey: false, metaKey: false };
    
    switch (platform) {
      case 'mac':
        return { ctrlKey: false, altKey: false, metaKey: true }; // Cmd key
      case 'windows':
      case 'linux':
      default:
        return { ctrlKey: true, altKey: false, metaKey: false }; // Ctrl key
    }
  };

  /**
   * Register all application keybinds with enhanced expression support
   */
  const registerAllKeybinds = () => {
    const primaryModifier = getModifierKeys(true);
    const noModifier = getModifierKeys(false);
    
    const keybindsToRegister = [
      // UI Toggle Keybinds - Use primary modifier (Cmd on Mac, Ctrl elsewhere)
      {
        key: 'h',
        ...primaryModifier,
        shiftKey: false,
        description: `Toggle UI visibility (${platform === 'mac' ? 'Cmd' : 'Ctrl'}+H)`,
        category: 'UI Control',
        handler: () => {
          uiToggle.toggleUI();
          showKeybindNotification(
            'UI Visibility',
            uiToggle.isUIVisible ? 'UI elements shown' : 'UI elements hidden',
            'info'
          );
        }
      },
      
      // Cursor Follow Keybinds
      {
        key: 'f',
        ...primaryModifier,
        shiftKey: false,
        description: `Toggle cursor follow mode (${platform === 'mac' ? 'Cmd' : 'Ctrl'}+F)`,
        category: 'Live2D Control',
        handler: () => {
          const beforeState = {
            cursorFollow: cursorFollow.isCursorFollowEnabled,
            forceIgnoreMouse: cursorFollow.forceIgnoreMouse,
            randomActive: cursorFollow.isRandomLookActive
          };
          
          cursorFollow.toggleCursorFollow();
          
          // Show updated state in notification
          setTimeout(() => {
            const afterState = {
              cursorFollow: cursorFollow.isCursorFollowEnabled,
              forceIgnoreMouse: cursorFollow.forceIgnoreMouse,
              randomActive: cursorFollow.isRandomLookActive
            };
            
            showKeybindNotification(
              'Cursor Follow',
              cursorFollow.isCursorFollowEnabled ? 'Cursor follow enabled' : 'Random look pattern enabled',
              'info'
            );
            
            if (debugMode) {
              console.log('Cursor follow state change:', { before: beforeState, after: afterState });
            }
          }, 100);
        }
      },
      
      // Single-key alternatives for easier access (no modifier required)
      {
        key: 'u',
        ...noModifier,
        description: 'Toggle UI visibility (U)',
        category: 'Quick Keys',
        handler: () => {
          uiToggle.toggleUI();
          showKeybindNotification(
            'UI Visibility',
            uiToggle.isUIVisible ? 'UI elements shown' : 'UI elements hidden',
            'info'
          );
        }
      },
      
      {
        key: 'm',
        ...noModifier,
        description: 'Toggle cursor follow mode (M for Mouse)',
        category: 'Quick Keys',
        handler: () => {
          cursorFollow.toggleCursorFollow();
          showKeybindNotification(
            'Cursor Follow',
            cursorFollow.isCursorFollowEnabled ? 'Cursor follow enabled' : 'Random look pattern enabled',
            'info'
          );
        }
      },
      
      {
        key: 'r',
        ...noModifier,
        description: 'Trigger random look (R)',
        category: 'Quick Keys',
        handler: () => {
          if (!cursorFollow.isCursorFollowEnabled) {
            cursorFollow.triggerRandomLook();
            showKeybindNotification('Random Look', 'Triggered random look direction', 'info');
          } else {
            showKeybindNotification('Random Look', 'Switch to random mode first (M key)', 'warning');
          }
          
          if (debugMode) {
            console.log('Random look triggered. Current state:', {
              cursorFollow: cursorFollow.isCursorFollowEnabled,
              forceIgnoreMouse: cursorFollow.forceIgnoreMouse,
              randomActive: cursorFollow.isRandomLookActive,
              currentTarget: cursorFollow.currentLookTarget
            });
          }
        }
      },
      
      {
        key: 'c',
        ...noModifier,
        description: 'Look at center (C)',
        category: 'Quick Keys',
        handler: () => {
          cursorFollow.lookAtCenter();
          showKeybindNotification('Look Center', 'Model looking at center', 'info');
        }
      },

      // UNIFIED: Enhanced Expression Testing - Support both model and custom expressions
      {
        key: 'e',
        ...noModifier,
        description: 'Next expression (E) - cycles through model and custom expressions',
        category: 'Expression Testing',
        handler: async () => {
          if (!expressionTesting.canPerformExpressionOperations()) {
            showKeybindNotification('Expression Test', 'Model not ready or no expressions found. Try pressing "D".', 'warning');
            return;
          }
          await expressionTesting.nextExpression();
          showExpressionTestNotification('next');
        }
      },
      
      {
        key: 'q',
        ...noModifier,
        description: 'Previous expression (Q) - cycles through model and custom expressions',
        category: 'Expression Testing',
        handler: async () => {
          if (!expressionTesting.canPerformExpressionOperations()) {
            showKeybindNotification('Expression Test', 'Model not ready or no expressions found. Try pressing "D".', 'warning');
            return;
          }
          await expressionTesting.previousExpression();
          showExpressionTestNotification('previous');
        }
      },
      
      {
        key: 't',
        ...noModifier,
        description: 'Start/stop auto expression testing (T) - tests all expressions including custom',
        category: 'Expression Testing',
        handler: async () => {
          if (!expressionTesting.canPerformExpressionOperations()) {
            showKeybindNotification('Auto-Test', 'Model not ready or no expressions found. Try pressing "D".', 'warning');
            return;
          }
          if (expressionTesting.testingMode === 'auto') {
            await expressionTesting.stopAutoTesting();
            showKeybindNotification('Auto Testing', 'Stopped auto expression testing', 'info');
          } else if (expressionTesting.hasExpressions) {
            const stats = expressionTesting.getExpressionStatistics();
            expressionTesting.startAutoTesting();
            showKeybindNotification(
              'Auto Testing',
              `Started testing ${stats.total} expressions (${stats.custom} custom)`,
              'info'
            );
          } else {
            showKeybindNotification('Auto Testing', 'No expressions available', 'warning');
          }
        }
      },
      
      {
        key: 'Escape',
        ...noModifier,
        description: 'Reset expression to default (Escape) - resets both model and custom expressions',
        category: 'Expression Testing',
        handler: async () => {
          await expressionTesting.resetToDefaultExpression();
          showKeybindNotification('Reset Expression', 'Reset to default expression', 'info');
        }
      },

      // NEW: Custom Expression specific keybinds
      {
        key: 'x',
        ...noModifier,
        description: 'Toggle custom expression inclusion (X)',
        category: 'Custom Expressions',
        handler: () => {
          // This would require state management - for now just show info
          const stats = expressionTesting.getExpressionStatistics();
          if (stats.hasCustom) {
            showKeybindNotification(
              'Custom Expressions',
              `${stats.custom} custom expressions are included in testing`,
              'info'
            );
          } else {
            showKeybindNotification(
              'Custom Expressions',
              'No custom expressions found',
              'warning'
            );
          }
        }
      },

      // Enhanced Help and Utility Keybinds
      {
        key: '?',
        ...noModifier,
        description: 'Show keybind help with expression statistics (?)',
        category: 'Help',
        handler: () => {
          showKeybindHelp();
        }
      },
      
      {
        key: 'h',
        ...noModifier,
        description: 'Show keybind help (H when not focused on input)',
        category: 'Help',
        handler: (event) => {
          // Only show help if we're not in an input field
          const target = event.target as HTMLElement;
          if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
            showKeybindHelp();
          }
        }
      },

      // Function keys
      {
        key: 'F2',
        ...noModifier,
        description: 'Show keybind help with expression statistics (F2)',
        category: 'Help',
        handler: () => {
          showKeybindHelp();
        }
      },

      // UNIFIED: Enhanced Live2D Control with custom expression awareness
      {
        key: 'd',
        ...noModifier,
        description: 'Refresh expressions list (D) - rediscovers model and custom expressions',
        category: 'Live2D Control',
        handler: async () => {
          if (!isGlobalAPIReady()) {
            showKeybindNotification('Expression Refresh', 'No Live2D API available - load a model first', 'warning');
            return;
          }
          
          if (debugMode) {
            console.log('🔄 Manual expression refresh triggered via D key');
          }
          
          // Emit event for coordinated refresh
          window.dispatchEvent(new CustomEvent('expression-refresh-requested'));
          
          // Also call the direct method
          await expressionTesting.discoverExpressions();
          
          // Wait a moment for discovery to complete
          setTimeout(() => {
            const stats = expressionTesting.getExpressionStatistics();
            showKeybindNotification(
              'Expressions Refreshed',
              `Found ${stats.total} expressions (${stats.model} model, ${stats.custom} custom)`,
              'success'
            );
            
            if (debugMode) {
              console.log('🔍 Expression discovery results:', {
                ...stats,
                debugInfo: expressionTesting.debugInfo
              });
            }
          }, 500);
        }
      },

      // UNIFIED: Enhanced debug keybind with expression statistics
      {
        key: 'i',
        ...noModifier,
        description: 'Show debug info (I) - includes expression and cursor follow details',
        category: 'Debug',
        handler: () => {
          const stats = expressionTesting.getExpressionStatistics();
          const current = expressionTesting.getCurrentExpressionInfo();
          
          const info = {
            cursorFollowEnabled: cursorFollow.isCursorFollowEnabled,
            forceIgnoreMouse: cursorFollow.forceIgnoreMouse,
            randomLookActive: cursorFollow.isRandomLookActive,
            currentLookTarget: cursorFollow.currentLookTarget,
            hasGlobalAPI: isGlobalAPIReady(),
            globalAPIInfo: {
              hasLive2D: !!(window as any).live2d,
              hasEnhanced: !!(window as any).live2d?.enhancedExpression,
              hasBasic: !!(window as any).live2d?.setExpression,
              hasGetExpressions: !!(window as any).live2d?.getExpressions,
            },
            expressionStats: stats,
            currentExpression: current ? {
              name: current.name,
              isCustom: current.isCustom,
              index: expressionTesting.currentExpressionIndex
            } : null,
            customExpressionsInitialized: expressionTesting.customExpressions.isInitialized,
            customExpressionsEnabled: expressionTesting.customExpressions.enabledExpressions.length
          };
          
          console.log('🔍 Enhanced Debug Info (Unified):', info);
          showKeybindNotification(
            'Debug Info',
            `Check console for details. ${stats.total} expressions (${stats.custom} custom)`,
            'info'
          );
        }
      },

      // Alternative modifier key combinations
      {
        key: 'Space',
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        description: 'Quick UI toggle (Shift+Space)',
        category: 'Alternative Keys',
        handler: () => {
          uiToggle.toggleUI();
          showKeybindNotification(
            'UI Visibility',
            uiToggle.isUIVisible ? 'UI elements shown' : 'UI elements hidden',
            'info'
          );
        }
      },

      // NEW: Advanced expression testing keybinds
      {
        key: '1',
        ...noModifier,
        description: 'Test first expression (1)',
        category: 'Direct Expression Testing',
        handler: async () => {
          if (!canPerformExpressionOperations()) {
            showKeybindNotification('Expression Test', 'No Live2D API or expressions available', 'warning');
            return;
          }
          
          if (expressionTesting.availableExpressions.length > 0) {
            await expressionTesting.testExpression(0);
            showExpressionTestNotification('next');
          }
        }
      },

      {
        key: '2',
        ...noModifier,
        description: 'Test second expression (2)',
        category: 'Direct Expression Testing',
        handler: async () => {
          if (!canPerformExpressionOperations()) {
            showKeybindNotification('Expression Test', 'No Live2D API or expressions available', 'warning');
            return;
          }
          
          if (expressionTesting.availableExpressions.length > 1) {
            await expressionTesting.testExpression(1);
            showExpressionTestNotification('next');
          }
        }
      },

      {
        key: '3',
        ...noModifier,
        description: 'Test third expression (3)',
        category: 'Direct Expression Testing',
        handler: async () => {
          if (!canPerformExpressionOperations()) {
            showKeybindNotification('Expression Test', 'No Live2D API or expressions available', 'warning');
            return;
          }
          
          if (expressionTesting.availableExpressions.length > 2) {
            await expressionTesting.testExpression(2);
            showExpressionTestNotification('next');
          }
        }
      },

      {
        key: '0',
        ...noModifier,
        description: 'Test last expression (0)',
        category: 'Direct Expression Testing',
        handler: async () => {
          if (!canPerformExpressionOperations()) {
            showKeybindNotification('Expression Test', 'No Live2D API or expressions available', 'warning');
            return;
          }
          
          const lastIndex = expressionTesting.availableExpressions.length - 1;
          if (lastIndex >= 0) {
            await expressionTesting.testExpression(lastIndex);
            showExpressionTestNotification('next');
          }
        }
      }
    ];

    // Register all keybinds and track their IDs
    keybindsToRegister.forEach(keybind => {
      const id = registerKeybind(keybind);
      registeredKeybindsRef.current.push(id);
    });

    console.log(`🎹 Registered ${keybindsToRegister.length} unified application keybinds with custom expression support`);
  };

  /**
   * Unregister all keybinds (cleanup)
   */
  const unregisterAllKeybinds = () => {
    registeredKeybindsRef.current.forEach(id => {
      unregisterKeybind(id);
    });
    registeredKeybindsRef.current = [];
    console.log('🧹 Unregistered all application keybinds');
  };

  /**
   * UNIFIED: Enhanced feature status with custom expression information (memoized)
   */
  const getFeatureStatus = useCallback(() => {
    return {
      keybindsEnabled: keybindSystemEnabled,
      uiVisible: uiToggle.isUIVisible,
      cursorFollowEnabled: cursorFollow.isCursorFollowEnabled,
      expressionsAvailable: expressionTesting.hasExpressions,
      expressionTestingActive: expressionTesting.testingMode !== 'none',
      currentExpression: expressionTesting.getCurrentExpressionInfo(),
      customExpressionsEnabled: includeCustomExpressions,
      customExpressionsInitialized: expressionTesting.customExpressions.isInitialized,
      globalAPIReady: isGlobalAPIReady(),
      platform,
      modifierKey: platform === 'mac' ? 'Cmd' : 'Ctrl',
    };
  }, [
    keybindSystemEnabled, 
    uiToggle.isUIVisible, 
    cursorFollow.isCursorFollowEnabled, 
    expressionTesting.hasExpressions, 
    expressionTesting.testingMode,
    expressionTesting.customExpressions.isInitialized,
    includeCustomExpressions,
    isGlobalAPIReady,
    platform
  ]);

  // Register keybinds when hook initializes and dependencies are ready
  useEffect(() => {
    if (!enabled) return;

    // Clear any pending registration
    if (registrationTimeoutRef.current) {
      clearTimeout(registrationTimeoutRef.current);
    }

    // Unregister existing keybinds first
    unregisterAllKeybinds();

    // Ensure all feature hooks are ready before registering keybinds
    registrationTimeoutRef.current = window.setTimeout(() => {
      try {
        registerAllKeybinds();

        if (debugMode) {
          console.log('🎹 Unified keybind system initialized:', {
            platform,
            uiToggleReady: !!uiToggle.toggleUI,
            cursorFollowReady: !!cursorFollow.toggleCursorFollow,
            expressionTestingReady: !!expressionTesting.testExpression,
            customExpressionsReady: expressionTesting.customExpressions.isInitialized,
            globalAPIReady: isGlobalAPIReady(),
            registeredCount: registeredKeybindsRef.current.length,
            timestamp: new Date().toISOString()
          });
        }

        // Enhanced welcome message
        if (showHelpOnLoad) {
          setTimeout(() => {
            showKeybindNotification(
              'Unified Keybinds Ready',
              'Press ? for help. Try E/Q to cycle expressions!',
              'info'
            );
          }, 1000);
        }
      } catch (error) {
        console.error('❌ Failed to register unified keybinds:', error);
      }
    }, 100); // Small delay to ensure hooks are ready

    // Cleanup function
    return () => {
      if (registrationTimeoutRef.current) {
        clearTimeout(registrationTimeoutRef.current);
        registrationTimeoutRef.current = null;
      }
      unregisterAllKeybinds();
    };
  }, [enabled, platform]); // Keep minimal dependencies to avoid re-registration

  // UNIFIED: Enhanced debug effect to track state changes (stable dependencies)
  useEffect(() => {
    if (debugMode) {
      console.log('🔍 Unified feature states updated:', {
        uiVisible: uiToggle.isUIVisible,
        cursorFollow: cursorFollow.isCursorFollowEnabled,
        expressionCount: expressionTesting.availableExpressions.length,
        testingMode: expressionTesting.testingMode,
        customExpressionsInitialized: expressionTesting.customExpressions.isInitialized,
        globalAPIReady: isGlobalAPIReady()
      });
    }
  }, [
    uiToggle.isUIVisible, 
    cursorFollow.isCursorFollowEnabled, 
    expressionTesting.availableExpressions.length, 
    expressionTesting.testingMode,
    expressionTesting.customExpressions.isInitialized,
    isGlobalAPIReady,
    debugMode
  ]);

  return {
    // Feature hooks (exposed for direct access if needed)
    uiToggle,
    cursorFollow,
    expressionTesting,
    
    // Keybind system
    registerKeybind,
    unregisterKeybind,
    getKeybindsByCategory,
    
    // Enhanced status and utilities
    getFeatureStatus,
    showKeybindHelp,
    
    // State
    isEnabled: enabled && keybindSystemEnabled,
    registeredKeybindsCount: registeredKeybindsRef.current.length,
    
    // Custom expression integration
    customExpressionsEnabled: includeCustomExpressions,
    getExpressionStatistics: expressionTesting.getExpressionStatistics,
    
    // UNIFIED: Additional status
    isGlobalAPIReady: isGlobalAPIReady(),
  };
};