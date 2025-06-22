import {
  createContext, useMemo, useContext, useState, useCallback, useEffect, useRef,
} from 'react';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';

/**
 * Background file interface
 * @interface BackgroundFile
 */
interface BackgroundFile {
  name: string;
  url: string;
  isLocal?: boolean; // Flag to indicate if this is a local file
  localPath?: string; // Local file path for Electron
  isManaged?: boolean; // Flag to indicate if this is a managed file
}

/**
 * Background URL context state interface
 * @interface BgUrlContextState
 */
export interface BgUrlContextState {
  backgroundUrl: string;
  setBackgroundUrl: (url: string) => void;
  backgroundFiles: BackgroundFile[];
  setBackgroundFiles: (files: BackgroundFile[]) => void;
  resetBackground: () => void;
  addBackgroundFile: (file: BackgroundFile) => void;
  removeBackgroundFile: (name: string) => void;
  isDefaultBackground: boolean;
  useCameraBackground: boolean;
  setUseCameraBackground: (use: boolean) => void;
  
  // Local file management
  localBackgroundPath: string | null;
  setLocalBackgroundPath: (path: string | null) => void;
  selectLocalBackground: () => Promise<void>;
  isLocalBackground: boolean;

  // Managed backgrounds
  managedBackgrounds: string[];
  refreshManagedBackgrounds: () => Promise<void>;
  openBackgroundsDirectory: () => Promise<void>;
  selectedManagedBackground: string | null;
  setSelectedManagedBackground: (filename: string | null) => void;
  
  // Startup restoration
  restoreBackgroundSettings: () => Promise<void>;
}

/**
 * Create the background URL context
 */
const BgUrlContext = createContext<BgUrlContextState | null>(null);

/**
 * Background URL Provider Component
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Child components
 */
export function BgUrlProvider({ children }: { children: React.ReactNode }) {
  // Use a local bundled background image as default
  const DEFAULT_BACKGROUND = '/backgrounds/default-background.jpg';

  // Local storage for persistent background URL
  const [backgroundUrl, setBackgroundUrl] = useLocalStorage<string>(
    'backgroundUrl',
    DEFAULT_BACKGROUND,
  );

  // Local background path storage
  const [localBackgroundPath, setLocalBackgroundPath] = useLocalStorage<string | null>(
    'localBackgroundPath',
    null,
  );

  // Managed background selection
  const [selectedManagedBackground, setSelectedManagedBackground] = useLocalStorage<string | null>(
    'selectedManagedBackground',
    null,
  );

  // Camera background preference
  const [useCameraBackground, setUseCameraBackground] = useLocalStorage<boolean>(
    'useCameraBackground',
    false,
  );

  // State for background files list and managed backgrounds
  const [backgroundFiles, setBackgroundFiles] = useState<BackgroundFile[]>([]);
  const [managedBackgrounds, setManagedBackgrounds] = useState<string[]>([]);
  
  // Use refs to prevent multiple restoration calls
  const hasAttemptedBackgroundRestore = useRef(false);
  const isRestoringBackground = useRef(false);
  const managedBackgroundsLoaded = useRef(false);

  // Refresh managed backgrounds from the backgrounds directory
  const refreshManagedBackgrounds = useCallback(async () => {
    try {
      const backgrounds = await (window.api as any)?.scanBackgrounds?.();
      setManagedBackgrounds(backgrounds || []);
      managedBackgroundsLoaded.current = true;
      
      // If the currently selected managed background is no longer available, clear selection
      if (selectedManagedBackground && !backgrounds?.includes(selectedManagedBackground)) {
        console.warn(`Selected managed background ${selectedManagedBackground} no longer available`);
        setSelectedManagedBackground(null);
        if (!localBackgroundPath && !useCameraBackground) {
          setBackgroundUrl(DEFAULT_BACKGROUND);
        }
      }
    } catch (error) {
      console.error('Failed to refresh managed backgrounds:', error);
    }
  }, [selectedManagedBackground, setSelectedManagedBackground, localBackgroundPath, useCameraBackground, setBackgroundUrl]);

  // Open the backgrounds directory
  const openBackgroundsDirectory = useCallback(async () => {
    try {
      await (window.api as any)?.openBackgroundsDirectory?.();
    } catch (error) {
      console.error('Failed to open backgrounds directory:', error);
    }
  }, []);

  // Restore background settings on startup - ONLY called once
  const restoreBackgroundSettings = useCallback(async () => {
    if (hasAttemptedBackgroundRestore.current || isRestoringBackground.current) {
      return;
    }
    
    isRestoringBackground.current = true;
    
    try {
      console.log('🎨 Restoring background settings...', {
        useCameraBackground,
        localBackgroundPath,
        selectedManagedBackground,
        currentBackgroundUrl: backgroundUrl
      });

      // If camera background is enabled, don't restore file-based backgrounds
      if (useCameraBackground) {
        console.log('📷 Camera background enabled, skipping file restoration');
        return;
      }

      // Restore local background if path exists
      if (localBackgroundPath) {
        try {
          const blobUrl = await (window.api as any)?.createFileBlob?.(localBackgroundPath);
          if (blobUrl) {
            setBackgroundUrl(blobUrl);
            console.log(`📁 Restored local background: ${localBackgroundPath}`);
          } else {
            console.warn('❌ Failed to create blob for local background, clearing path');
            setLocalBackgroundPath(null);
          }
        } catch (error) {
          console.error('❌ Failed to load local background on restore:', error);
          setLocalBackgroundPath(null);
        }
      }
      // Restore managed background if selected
      else if (selectedManagedBackground && managedBackgrounds.length > 0) {
        if (managedBackgrounds.includes(selectedManagedBackground)) {
          try {
            const blobUrl = await (window.api as any)?.getBackgroundBlob?.(selectedManagedBackground);
            if (blobUrl) {
              setBackgroundUrl(blobUrl);
              console.log(`🗂️ Restored managed background: ${selectedManagedBackground}`);
            } else {
              console.warn('❌ Failed to get blob for managed background');
              setSelectedManagedBackground(null);
              setBackgroundUrl(DEFAULT_BACKGROUND);
            }
          } catch (error) {
            console.error('❌ Failed to load managed background on restore:', error);
            setSelectedManagedBackground(null);
            setBackgroundUrl(DEFAULT_BACKGROUND);
          }
        } else {
          console.warn('❌ Selected managed background not found in available backgrounds');
          setSelectedManagedBackground(null);
          setBackgroundUrl(DEFAULT_BACKGROUND);
        }
      }
      // Use default background if no other options
      else if (backgroundUrl !== DEFAULT_BACKGROUND) {
        console.log('🎭 No background preferences found, using default');
        setBackgroundUrl(DEFAULT_BACKGROUND);
      }

    } catch (error) {
      console.error('❌ Failed to restore background settings:', error);
    } finally {
      hasAttemptedBackgroundRestore.current = true;
      isRestoringBackground.current = false;
    }
  }, [
    useCameraBackground,
    localBackgroundPath,
    selectedManagedBackground,
    managedBackgrounds,
    backgroundUrl,
    setBackgroundUrl,
    setLocalBackgroundPath,
    setSelectedManagedBackground
  ]);

  // Load managed backgrounds on startup - ONLY once
  useEffect(() => {
    if (!managedBackgroundsLoaded.current) {
      refreshManagedBackgrounds();
    }
  }, [refreshManagedBackgrounds]);

  // Trigger restoration after managed backgrounds are loaded - ONLY once
  useEffect(() => {
    if (managedBackgroundsLoaded.current && !hasAttemptedBackgroundRestore.current) {
      const timer = setTimeout(() => {
        restoreBackgroundSettings();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [managedBackgroundsLoaded.current, restoreBackgroundSettings]);

  // Load selected managed background when it changes (RUNTIME ONLY - not during startup)
  useEffect(() => {
    if (!hasAttemptedBackgroundRestore.current) return; // Skip during startup restoration
    
    const loadManagedBackground = async () => {
      if (selectedManagedBackground && !useCameraBackground) {
        console.log(`🔄 Runtime: Loading managed background: ${selectedManagedBackground}`);
        try {
          const blobUrl = await (window.api as any)?.getBackgroundBlob?.(selectedManagedBackground);
          if (blobUrl) {
            setBackgroundUrl(blobUrl);
          }
        } catch (error) {
          console.error('Failed to load managed background:', error);
          // Fall back to default if managed file fails
          setSelectedManagedBackground(null);
          if (!localBackgroundPath) {
            setBackgroundUrl(DEFAULT_BACKGROUND);
          }
        }
      }
    };

    loadManagedBackground();
  }, [selectedManagedBackground, useCameraBackground, setBackgroundUrl, setSelectedManagedBackground, localBackgroundPath]);

  // Update background URL when local path changes (RUNTIME ONLY - not during startup)
  useEffect(() => {
    if (!hasAttemptedBackgroundRestore.current) return; // Skip during startup restoration
    
    const loadLocalBackground = async () => {
      if (localBackgroundPath && !useCameraBackground) {
        console.log(`🔄 Runtime: Loading local background: ${localBackgroundPath}`);
        try {
          const blobUrl = await (window.api as any)?.createFileBlob?.(localBackgroundPath);
          if (blobUrl) {
            setBackgroundUrl(blobUrl);
          }
        } catch (error) {
          console.error('Failed to load local background:', error);
          // Fall back to default if local file fails
          setLocalBackgroundPath(null);
          if (!selectedManagedBackground) {
            setBackgroundUrl(DEFAULT_BACKGROUND);
          }
        }
      }
    };

    loadLocalBackground();
  }, [localBackgroundPath, useCameraBackground, setBackgroundUrl, setLocalBackgroundPath, selectedManagedBackground]);

  // Reset background to default
  const resetBackground = useCallback(() => {
    setBackgroundUrl(DEFAULT_BACKGROUND);
    setLocalBackgroundPath(null);
    setSelectedManagedBackground(null);
    setUseCameraBackground(false);
  }, [setBackgroundUrl, setLocalBackgroundPath, setSelectedManagedBackground, setUseCameraBackground]);

  // Add new background file
  const addBackgroundFile = useCallback((file: BackgroundFile) => {
    setBackgroundFiles((prev) => [...prev, file]);
  }, []);

  // Remove background file
  const removeBackgroundFile = useCallback((name: string) => {
    setBackgroundFiles((prev) => prev.filter((file) => file.name !== name));
  }, []);

  // Check if current background is default
  const isDefaultBackground = useMemo(
    () => backgroundUrl === DEFAULT_BACKGROUND && !localBackgroundPath && !selectedManagedBackground && !useCameraBackground,
    [backgroundUrl, localBackgroundPath, selectedManagedBackground, useCameraBackground],
  );

  // Check if current background is local
  const isLocalBackground = useMemo(
    () => Boolean(localBackgroundPath),
    [localBackgroundPath],
  );

  // Select local background file
  const selectLocalBackground = useCallback(async () => {
    try {
      const selectedPath = await (window.api as any)?.selectBackgroundImage?.();
      
      if (selectedPath) {
        // Create a blob URL for the local file
        const blobUrl = await (window.api as any)?.createFileBlob?.(selectedPath);
        
        if (blobUrl) {
          setLocalBackgroundPath(selectedPath);
          setBackgroundUrl(blobUrl);
          setUseCameraBackground(false);
          setSelectedManagedBackground(null); // Clear managed selection when using custom
          
          // Add to background files list for future reference
          const fileName = selectedPath.split(/[/\\]/).pop() || 'Local Background';
          addBackgroundFile({
            name: fileName,
            url: blobUrl,
            isLocal: true,
            localPath: selectedPath,
          });
        }
      }
    } catch (error) {
      console.error('Failed to select local background:', error);
    }
  }, [setLocalBackgroundPath, setBackgroundUrl, addBackgroundFile, setSelectedManagedBackground, setUseCameraBackground]);

  // Memoized context value
  const contextValue = useMemo(() => ({
    backgroundUrl,
    setBackgroundUrl,
    backgroundFiles,
    setBackgroundFiles,
    resetBackground,
    addBackgroundFile,
    removeBackgroundFile,
    isDefaultBackground,
    useCameraBackground,
    setUseCameraBackground,
    localBackgroundPath,
    setLocalBackgroundPath,
    selectLocalBackground,
    isLocalBackground,
    managedBackgrounds,
    refreshManagedBackgrounds,
    openBackgroundsDirectory,
    selectedManagedBackground,
    setSelectedManagedBackground,
    restoreBackgroundSettings,
  }), [
    backgroundUrl, 
    setBackgroundUrl, 
    backgroundFiles, 
    resetBackground, 
    addBackgroundFile, 
    removeBackgroundFile, 
    isDefaultBackground, 
    useCameraBackground,
    setUseCameraBackground,
    localBackgroundPath,
    setLocalBackgroundPath,
    selectLocalBackground,
    isLocalBackground,
    managedBackgrounds,
    refreshManagedBackgrounds,
    openBackgroundsDirectory,
    selectedManagedBackground,
    setSelectedManagedBackground,
    restoreBackgroundSettings,
  ]);

  return (
    <BgUrlContext.Provider value={contextValue}>
      {children}
    </BgUrlContext.Provider>
  );
}

/**
 * Custom hook to use the background URL context
 * @throws {Error} If used outside of BgUrlProvider
 */
export function useBgUrl() {
  const context = useContext(BgUrlContext);

  if (!context) {
    throw new Error('useBgUrl must be used within a BgUrlProvider');
  }

  return context;
}