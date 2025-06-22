import {
  createContext, useContext, useState, useMemo, useEffect, useCallback,
} from 'react';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';

/**
 * Character configuration file interface
 * @interface ConfigFile
 */
export interface ConfigFile {
  filename: string;
  name: string;
}

/**
 * Character configuration context state interface
 * @interface CharacterConfigState
 */
interface CharacterConfigState {
  confName: string;
  confUid: string;
  configFiles: ConfigFile[];
  setConfName: (name: string) => void;
  setConfUid: (uid: string) => void;
  setConfigFiles: (files: ConfigFile[]) => void;
  getFilenameByName: (name: string) => string | undefined;
  // Added method to restore character settings on startup
  restoreCharacterSettings: () => Promise<void>;
}

/**
 * Default values and constants
 */
const DEFAULT_CONFIG = {
  confName: '',
  confUid: '',
  configFiles: [] as ConfigFile[],
};

/**
 * Create the character configuration context
 */
export const ConfigContext = createContext<CharacterConfigState | null>(null);

/**
 * Character Configuration Provider Component
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Child components
 */
export function CharacterConfigProvider({ children }: { children: React.ReactNode }) {
  // Persist character name and UID to localStorage
  const [confName, setConfNameState] = useLocalStorage<string>('confName', DEFAULT_CONFIG.confName);
  const [confUid, setConfUidState] = useLocalStorage<string>('confUid', DEFAULT_CONFIG.confUid);
  const [configFiles, setConfigFiles] = useState<ConfigFile[]>(DEFAULT_CONFIG.configFiles);
  
  // Track if we've attempted restoration to avoid infinite loops
  const [hasAttemptedRestore, setHasAttemptedRestore] = useState(false);

  const getFilenameByName = useCallback(
    (name: string) => configFiles.find((config) => config.name === name)?.filename,
    [configFiles],
  );

  // Enhanced setters that also update localStorage
  const setConfName = useCallback((name: string) => {
    setConfNameState(name);
  }, [setConfNameState]);

  const setConfUid = useCallback((uid: string) => {
    setConfUidState(uid);
  }, [setConfUidState]);

  // Restore character settings on startup
  const restoreCharacterSettings = useCallback(async () => {
    if (hasAttemptedRestore) return;
    
    try {
      // Check if we have persisted character settings
      if (confName && confUid) {
        console.log('Restoring character settings:', { confName, confUid });
        
        // Verify the character config still exists
        const filename = getFilenameByName(confName);
        if (filename && configFiles.length > 0) {
          // Send message to backend to restore the character
          const message = {
            type: 'switch-config',
            file: filename,
          };
          
          // Check if WebSocket is available
          if ((window as any).wsService?.sendMessage) {
            (window as any).wsService.sendMessage(message);
            console.log('Sent character restoration message:', message);
          } else {
            console.warn('WebSocket not available for character restoration');
          }
        } else {
          console.warn('Character config not found, clearing persisted settings');
          setConfName('');
          setConfUid('');
        }
      }
    } catch (error) {
      console.error('Failed to restore character settings:', error);
    } finally {
      setHasAttemptedRestore(true);
    }
  }, [confName, confUid, configFiles, getFilenameByName, setConfName, setConfUid, hasAttemptedRestore]);

  // Attempt to restore character settings when configFiles are loaded
  useEffect(() => {
    if (configFiles.length > 0 && confName && !hasAttemptedRestore) {
      // Delay restoration to ensure WebSocket is ready
      const timer = setTimeout(() => {
        restoreCharacterSettings();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [configFiles, confName, hasAttemptedRestore, restoreCharacterSettings]);

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      confName,
      confUid,
      configFiles,
      setConfName,
      setConfUid,
      setConfigFiles,
      getFilenameByName,
      restoreCharacterSettings,
    }),
    [confName, confUid, configFiles, setConfName, setConfUid, getFilenameByName, restoreCharacterSettings],
  );

  useEffect(() => {
    (window.api as any)?.updateConfigFiles?.(configFiles);
  }, [configFiles]);

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
}

/**
 * Custom hook to use the character configuration context
 * @throws {Error} If used outside of CharacterConfigProvider
 */
export function useConfig() {
  const context = useContext(ConfigContext);

  if (!context) {
    throw new Error('useConfig must be used within a CharacterConfigProvider');
  }

  return context;
}