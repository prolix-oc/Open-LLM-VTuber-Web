// src/renderer/src/hooks/utils/use-ui-toggle.ts
import { useState, useCallback, useEffect, useRef } from 'react';

interface UIElement {
  selector: string;
  description: string;
  priority: number; // Higher priority = hidden first
}

/**
 * Default UI elements to hide/show (excluding Live2D canvas and background)
 * These are the elements that should be toggled when UI visibility is changed
 */
const DEFAULT_UI_ELEMENTS: UIElement[] = [
  {
    selector: '[data-testid="footer"], footer',
    description: 'Footer component',
    priority: 1
  },
  {
    selector: '[data-testid="title-bar"]',
    description: 'Title bar (Electron)',
    priority: 1
  },
  {
    selector: '.ws-status, [class*="wsStatus"]',
    description: 'WebSocket status indicator',
    priority: 2
  },
  {
    selector: '.obs-floating-button, [class*="obsFloating"]',
    description: 'OBS floating button',
    priority: 3
  },
  {
    selector: '.subtitle, [class*="subtitle"]',
    description: 'Subtitle overlay',
    priority: 4
  },
  {
    selector: 'header, [role="banner"]',
    description: 'Header elements',
    priority: 1
  },
  {
    selector: '.settings-modal, [class*="settingsModal"]',
    description: 'Settings modal',
    priority: 5
  },
  {
    selector: '.toaster, [class*="toaster"], [class*="toast"]',
    description: 'Toast notifications',
    priority: 5
  }
];

interface UseUIToggleOptions {
  /**
   * Additional UI elements to include in the toggle
   */
  additionalElements?: UIElement[];
  
  /**
   * Elements to exclude from the toggle (will never be hidden)
   */
  excludeElements?: string[];
  
  /**
   * Whether to animate the transitions
   */
  animated?: boolean;
  
  /**
   * Transition duration in milliseconds
   */
  transitionDuration?: number;
  
  /**
   * Store visibility state in localStorage
   */
  persistent?: boolean;
  
  /**
   * localStorage key for persistence
   */
  storageKey?: string;
}

/**
 * Hook for toggling UI element visibility while preserving Live2D canvas and background
 * Allows users to create a clean view with only the VTuber model visible
 */
export const useUIToggle = (options: UseUIToggleOptions = {}) => {
  const {
    additionalElements = [],
    excludeElements = [],
    animated = true,
    transitionDuration = 300,
    persistent = true,
    storageKey = 'vtuber-ui-visible'
  } = options;

  // State for UI visibility - use ref for immediate access and state for reactivity
  const [isUIVisible, setIsUIVisibleState] = useState(() => {
    if (persistent && typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : true;
    }
    return true;
  });

  // Use ref to track current state for immediate access in callbacks
  const isUIVisibleRef = useRef(isUIVisible);
  
  // Update ref when state changes
  useEffect(() => {
    isUIVisibleRef.current = isUIVisible;
  }, [isUIVisible]);

  /**
   * Internal state setter that handles persistence
   */
  const setIsUIVisible = useCallback((visible: boolean) => {
    setIsUIVisibleState(visible);
    isUIVisibleRef.current = visible;
    
    // Persist to localStorage
    if (persistent) {
      localStorage.setItem(storageKey, JSON.stringify(visible));
    }
  }, [persistent, storageKey]);

  // Combine default and additional elements
  const allUIElements = [...DEFAULT_UI_ELEMENTS, ...additionalElements];

  // Filter out excluded elements
  const filteredUIElements = allUIElements.filter(
    element => !excludeElements.some(excluded => element.selector.includes(excluded))
  );

  /**
   * Find and return DOM elements matching the selectors
   */
  const findUIElements = useCallback(() => {
    const foundElements: { element: HTMLElement; config: UIElement }[] = [];

    filteredUIElements.forEach(config => {
      const elements = document.querySelectorAll(config.selector);
      elements.forEach(element => {
        if (element instanceof HTMLElement) {
          foundElements.push({ element, config });
        }
      });
    });

    // Sort by priority (higher priority = hidden first)
    return foundElements.sort((a, b) => b.config.priority - a.config.priority);
  }, [filteredUIElements]);

  /**
   * Apply visibility changes to UI elements
   */
  const applyVisibilityChanges = useCallback((visible: boolean) => {
    const elements = findUIElements();
    
    elements.forEach(({ element, config }, index) => {
      const delay = animated ? index * 50 : 0; // Stagger animation
      
      setTimeout(() => {
        if (visible) {
          // Show element
          if (animated) {
            element.style.transition = `opacity ${transitionDuration}ms ease-in-out, transform ${transitionDuration}ms ease-in-out`;
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
            element.style.pointerEvents = 'auto';
          }
          
          // Remove display: none
          if (element.style.display === 'none') {
            element.style.display = '';
          }
          
          // Remove data attribute for tracking
          element.removeAttribute('data-ui-hidden');
          
        } else {
          // Hide element
          if (animated) {
            element.style.transition = `opacity ${transitionDuration}ms ease-in-out, transform ${transitionDuration}ms ease-in-out`;
            element.style.opacity = '0';
            element.style.transform = 'translateY(-10px)';
            element.style.pointerEvents = 'none';
            
            // After animation, set display: none
            setTimeout(() => {
              if (!isUIVisibleRef.current) { // Check current state, not stale closure
                element.style.display = 'none';
              }
            }, transitionDuration);
          } else {
            element.style.display = 'none';
            element.style.pointerEvents = 'none';
          }
          
          // Add data attribute for tracking
          element.setAttribute('data-ui-hidden', 'true');
        }
      }, delay);
    });

    console.log(`🎭 ${visible ? 'Showing' : 'Hiding'} ${elements.length} UI elements`);
  }, [findUIElements, animated, transitionDuration]);

  /**
   * Toggle UI visibility
   */
  const toggleUI = useCallback(() => {
    const newVisibility = !isUIVisibleRef.current;
    setIsUIVisible(newVisibility);
    
    console.log(`🔄 UI visibility toggled: ${newVisibility ? 'visible' : 'hidden'}`);
  }, [setIsUIVisible]);

  /**
   * Explicitly show UI
   */
  const showUI = useCallback(() => {
    if (!isUIVisibleRef.current) {
      setIsUIVisible(true);
    }
  }, [setIsUIVisible]);

  /**
   * Explicitly hide UI
   */
  const hideUI = useCallback(() => {
    if (isUIVisibleRef.current) {
      setIsUIVisible(false);
    }
  }, [setIsUIVisible]);

  /**
   * Force refresh UI state (useful after DOM changes)
   */
  const refreshUIState = useCallback(() => {
    applyVisibilityChanges(isUIVisible);
  }, [isUIVisible, applyVisibilityChanges]);

  /**
   * Get count of affected elements
   */
  const getAffectedElementsCount = useCallback(() => {
    return findUIElements().length;
  }, [findUIElements]);

  /**
   * Check if specific element is currently hidden
   */
  const isElementHidden = useCallback((selector: string) => {
    const element = document.querySelector(selector) as HTMLElement;
    return element?.hasAttribute('data-ui-hidden') || element?.style.display === 'none';
  }, []);

  // Apply visibility changes when state changes
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      applyVisibilityChanges(isUIVisible);
    }, 100);

    return () => clearTimeout(timer);
  }, [isUIVisible, applyVisibilityChanges]);

  // Handle page navigation and DOM changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      // Refresh UI state when DOM changes
      refreshUIState();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });

    return () => observer.disconnect();
  }, [refreshUIState]);

  // Add CSS for smooth transitions
  useEffect(() => {
    if (!animated) return;

    const style = document.createElement('style');
    style.textContent = `
      [data-ui-hidden] {
        transition: opacity ${transitionDuration}ms ease-in-out, transform ${transitionDuration}ms ease-in-out !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [animated, transitionDuration]);

  return {
    isUIVisible,
    toggleUI,
    showUI,
    hideUI,
    refreshUIState,
    getAffectedElementsCount,
    isElementHidden,
    
    // State information
    affectedElementsCount: getAffectedElementsCount(),
    
    // Configuration
    animated,
    transitionDuration,
  };
};