import { useState, useEffect, useCallback } from 'react';

// FIXED: Enhanced useLocalStorage hook that prevents undefined values
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prevValue: T) => T)) => void] {
  // Initialize state with default value to prevent undefined
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') {
        console.log(`useLocalStorage(${key}): Server-side, using default:`, defaultValue);
        return defaultValue;
      }
      
      const item = window.localStorage.getItem(key);
      console.log(`useLocalStorage(${key}): Retrieved from localStorage:`, item);
      
      if (item === null) {
        // If no stored value, use default and store it
        console.log(`useLocalStorage(${key}): No stored value, using and storing default:`, defaultValue);
        window.localStorage.setItem(key, JSON.stringify(defaultValue));
        return defaultValue;
      }
      
      const parsed = JSON.parse(item);
      console.log(`useLocalStorage(${key}): Parsed value:`, parsed);
      
      // Ensure we never return undefined - use default if parsed is undefined/null
      const finalValue = parsed !== null && parsed !== undefined ? parsed : defaultValue;
      console.log(`useLocalStorage(${key}): Final value:`, finalValue);
      
      return finalValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  // Enhanced setValue function with better error handling
  const setValue = useCallback(
    (value: T | ((prevValue: T) => T)) => {
      try {
        // Allow value to be a function so we have the same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        
        // Ensure we never store undefined - use default instead
        const finalValue = valueToStore !== null && valueToStore !== undefined ? valueToStore : defaultValue;
        
        console.log(`useLocalStorage(${key}): Setting value:`, finalValue);
        
        setStoredValue(finalValue);
        
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(finalValue));
          console.log(`useLocalStorage(${key}): Stored to localStorage:`, JSON.stringify(finalValue));
          
          // Verify storage
          const verification = window.localStorage.getItem(key);
          console.log(`useLocalStorage(${key}): Verification read:`, verification);
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue, defaultValue]
  );

  // Listen for changes to the localStorage key from other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue);
          setStoredValue(newValue !== null && newValue !== undefined ? newValue : defaultValue);
        } catch (error) {
          console.error(`Error parsing localStorage change for key "${key}":`, error);
          setStoredValue(defaultValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, defaultValue]);

  return [storedValue, setValue];
}