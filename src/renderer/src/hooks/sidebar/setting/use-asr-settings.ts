import React, { useRef, useState, useEffect } from 'react';
import { useVAD, VADSettings } from '@/context/vad-context';

export const useASRSettings = () => {
  const {
    settings,
    updateSettings,
    autoStartOnInit,
    setAutoStartOnInit,
  } = useVAD();

  const localSettingsRef = useRef<VADSettings>(settings);
  const originalSettingsRef = useRef(settings);
  const originalAutoStartOnInitRef = useRef(autoStartOnInit);
  
  const [localAutoStartOnInit, setLocalAutoStartOnInit] = useState(autoStartOnInit);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  useEffect(() => {
    setLocalAutoStartOnInit(autoStartOnInit);
  }, [autoStartOnInit]);

  const handleInputChange = (key: keyof VADSettings, value: number | string): void => {
    if (value === '' || value === '-') {
      localSettingsRef.current = { ...localSettingsRef.current, [key]: value };
    } else {
      const parsed = Number(value);
      // eslint-disable-next-line no-restricted-globals
      if (!isNaN(parsed)) {
        localSettingsRef.current = { ...localSettingsRef.current, [key]: parsed };
      }
    }
    forceUpdate();
  };

  const handleAutoStartOnInitChange = (value: boolean) => {
    setLocalAutoStartOnInit(value);
    setAutoStartOnInit(value);
  };

  const handleSave = (): void => {
    updateSettings(localSettingsRef.current);
    originalSettingsRef.current = localSettingsRef.current;
    originalAutoStartOnInitRef.current = localAutoStartOnInit;
  };

  const handleCancel = (): void => {
    localSettingsRef.current = originalSettingsRef.current;
    setLocalAutoStartOnInit(originalAutoStartOnInitRef.current);
    setAutoStartOnInit(originalAutoStartOnInitRef.current);
    forceUpdate();
  };

  return {
    localSettings: localSettingsRef.current,
    autoStartOnInit: localAutoStartOnInit,
    setAutoStartOnInit: handleAutoStartOnInitChange,
    handleInputChange,
    handleSave,
    handleCancel,
  };
};