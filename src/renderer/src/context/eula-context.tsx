import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Context interface definition
interface EulaContextType {
  hasAcceptedEula: boolean;
  setHasAcceptedEula: (accepted: boolean) => void;
}

// Create context with default values
const EulaContext = createContext<EulaContextType | undefined>(undefined);

// Props interface for the provider component
interface EulaProviderProps {
  children: ReactNode;
}

/**
 * Provider component for managing EULA acceptance state
 */
export function EulaProvider({ children }: EulaProviderProps) {
  // Initialize state from localStorage if available
  const [hasAcceptedEula, setHasAcceptedEula] = useState<boolean>(() => {
    const savedValue = localStorage.getItem('hasAcceptedEula');
    return savedValue === 'true';
  });

  // Persist acceptance to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('hasAcceptedEula', hasAcceptedEula.toString());
  }, [hasAcceptedEula]);

  // Context value to be provided
  const value = {
    hasAcceptedEula,
    setHasAcceptedEula,
  };

  return <EulaContext.Provider value={value}>{children}</EulaContext.Provider>;
}

/**
 * Custom hook to access the EULA context
 */
export function useEula(): EulaContextType {
  const context = useContext(EulaContext);
  if (context === undefined) {
    throw new Error('useEula must be used within an EulaProvider');
  }
  return context;
} 