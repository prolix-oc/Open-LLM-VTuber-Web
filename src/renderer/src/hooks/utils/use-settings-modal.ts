import { useState, useCallback } from 'react';

export function useSettingsModal() {
  const [isOpen, setIsOpen] = useState(false);

  const openSettings = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleSettings = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return {
    isOpen,
    openSettings,
    closeSettings,
    toggleSettings,
  };
};