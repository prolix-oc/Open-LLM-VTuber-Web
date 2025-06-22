// src/renderer/src/components/settings/obs-settings-panel.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  VStack, 
  HStack, 
  Text, 
  Switch, 
  Input, 
  Button, 
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
  Flex,
  useToast
} from '@chakra-ui/react';
import { toaster } from '@/components/ui/toaster';

interface OBSSettings {
  enabled: boolean;
  port: number;
  enableBrowserSource: boolean;
  enableWindowCapture: boolean;
  windowWidth: number;
  windowHeight: number;
  transparentBackground: boolean;
  autoStart: boolean;
}

export const OBSSettingsPanel = () => {
  const [settings, setSettings] = useState<OBSSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverStatus, setServerStatus] = useState<{
    serverRunning: boolean;
    serverUrl: string | null;
    browserSourceUrl: string | null;
  } | null>(null);

  // Load settings and server status
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      
      // Ensure OBS is initialized (this will be lazy)
      await window.api.obs.ensureInitialized();
      
      // Load settings and status
      const [obsSettings, obsStatus] = await Promise.all([
        window.api.obs.getSettings(),
        window.api.obs.getStatus()
      ]);
      
      setSettings(obsSettings);
      setServerStatus(obsStatus);
    } catch (error) {
      console.error('Failed to load OBS settings:', error);
      toaster.create({
        title: 'Failed to load OBS settings',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        type: 'error',
        duration: 5000,
      });
      
      // Use default disabled settings on error
      setSettings({
        enabled: false,
        port: 8080,
        enableBrowserSource: true,
        enableWindowCapture: true,
        windowWidth: 800,
        windowHeight: 600,
        transparentBackground: true,
        autoStart: false
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Save settings
  const saveSettings = useCallback(async (newSettings: Partial<OBSSettings>) => {
    if (!settings) return;

    try {
      setSaving(true);
      const updatedSettings = await window.api.obs.updateSettings(newSettings);
      setSettings(updatedSettings);

      // Check if OBS was enabled/disabled
      const wasEnabled = settings.enabled;
      const isNowEnabled = updatedSettings.enabled;
      
      if (!wasEnabled && isNowEnabled) {
        toaster.create({
          title: 'OBS Enabled',
          description: 'OBS integration has been enabled. Canvas capture will be available for Live2D models.',
          type: 'success',
          duration: 4000,
        });
      } else if (wasEnabled && !isNowEnabled) {
        toaster.create({
          title: 'OBS Disabled',
          description: 'OBS integration has been disabled. This will reduce memory usage.',
          type: 'info',
          duration: 4000,
        });
      }

      // Refresh server status
      const status = await window.api.obs.getStatus();
      setServerStatus(status);

      return updatedSettings;
    } catch (error) {
      console.error('Failed to save OBS settings:', error);
      toaster.create({
        title: 'Failed to save settings',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        type: 'error',
        duration: 5000,
      });
      throw error;
    } finally {
      setSaving(false);
    }
  }, [settings]);

  // Start/stop OBS server
  const toggleServer = useCallback(async () => {
    if (!settings) return;

    try {
      if (serverStatus?.serverRunning) {
        const result = await window.api.obs.stopServer();
        if (result.success) {
          toaster.create({
            title: 'OBS Server Stopped',
            description: 'OBS streaming server has been stopped.',
            type: 'info',
            duration: 3000,
          });
        }
      } else {
        const result = await window.api.obs.startServer();
        if (result.success) {
          toaster.create({
            title: 'OBS Server Started',
            description: 'OBS streaming server is now running.',
            type: 'success',
            duration: 3000,
          });
        } else {
          throw new Error(result.error || 'Failed to start server');
        }
      }
      
      // Refresh status
      const status = await window.api.obs.getStatus();
      setServerStatus(status);
    } catch (error) {
      console.error('Failed to toggle OBS server:', error);
      toaster.create({
        title: 'Server Operation Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        type: 'error',
        duration: 5000,
      });
    }
  }, [settings, serverStatus]);

  // Copy URL to clipboard
  const copyUrlToClipboard = useCallback(async (url: string, type: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toaster.create({
        title: 'URL Copied',
        description: `${type} URL copied to clipboard`,
        type: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toaster.create({
        title: 'Copy Failed',
        description: 'Failed to copy URL to clipboard',
        type: 'error',
        duration: 3000,
      });
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (loading) {
    return (
      <Box p={4}>
        <Text>Loading OBS settings...</Text>
      </Box>
    );
  }

  if (!settings) {
    return (
      <Box p={4}>
        <Alert status="error">
          <AlertIcon />
          <AlertTitle>Failed to load OBS settings</AlertTitle>
          <AlertDescription>
            Please try refreshing the application.
          </AlertDescription>
        </Alert>
      </Box>
    );
  }

  return (
    <VStack spacing={6} align="stretch" p={4}>
      {/* Header */}
      <Box>
        <Text fontSize="lg" fontWeight="bold" mb={2}>
          OBS Integration Settings
        </Text>
        <Text fontSize="sm" color="gray.500">
          Control OBS streaming functionality and memory usage
        </Text>
      </Box>

      {/* Memory Warning */}
      {!settings.enabled && (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Memory Optimization</AlertTitle>
            <AlertDescription>
              OBS integration is currently disabled, which helps reduce memory usage. 
              Enable it only when you need to stream or capture the Live2D model.
            </AlertDescription>
          </Box>
        </Alert>
      )}

      {/* Enable/Disable OBS */}
      <Box>
        <HStack justify="space-between" mb={4}>
          <VStack align="start" spacing={1}>
            <Text fontWeight="medium">Enable OBS Integration</Text>
            <Text fontSize="sm" color="gray.500">
              {settings.enabled 
                ? "OBS features are active (higher memory usage)" 
                : "OBS features are disabled (memory optimized)"
              }
            </Text>
          </VStack>
          <Switch
            isChecked={settings.enabled}
            onChange={(e) => saveSettings({ enabled: e.target.checked })}
            isDisabled={saving}
            colorScheme="blue"
            size="lg"
          />
        </HStack>
      </Box>

      <Divider />

      {/* OBS Settings (only show when enabled) */}
      {settings.enabled && (
        <>
          {/* Server Status */}
          <Box>
            <Text fontWeight="medium" mb={3}>Server Status</Text>
            <HStack spacing={4} mb={3}>
              <Badge 
                colorScheme={serverStatus?.serverRunning ? "green" : "gray"}
                variant="solid"
                px={3}
                py={1}
              >
                {serverStatus?.serverRunning ? "Running" : "Stopped"}
              </Badge>
              <Button
                size="sm"
                onClick={toggleServer}
                colorScheme={serverStatus?.serverRunning ? "red" : "green"}
                variant="outline"
              >
                {serverStatus?.serverRunning ? "Stop Server" : "Start Server"}
              </Button>
            </HStack>
            
            {serverStatus?.serverRunning && (
              <VStack spacing={2} align="stretch">
                {serverStatus.serverUrl && (
                  <HStack>
                    <Text fontSize="sm" color="gray.500">Server URL:</Text>
                    <Text fontSize="sm" fontFamily="mono">{serverStatus.serverUrl}</Text>
                    <Button 
                      size="xs" 
                      onClick={() => copyUrlToClipboard(serverStatus.serverUrl!, "Server")}
                    >
                      Copy
                    </Button>
                  </HStack>
                )}
                {serverStatus.browserSourceUrl && (
                  <HStack>
                    <Text fontSize="sm" color="gray.500">Browser Source:</Text>
                    <Text fontSize="sm" fontFamily="mono">{serverStatus.browserSourceUrl}</Text>
                    <Button 
                      size="xs" 
                      onClick={() => copyUrlToClipboard(serverStatus.browserSourceUrl!, "Browser Source")}
                    >
                      Copy
                    </Button>
                  </HStack>
                )}
              </VStack>
            )}
          </Box>

          <Divider />

          {/* Basic Settings */}
          <VStack spacing={4} align="stretch">
            <Text fontWeight="medium">Basic Settings</Text>
            
            <HStack>
              <Text minW="120px" fontSize="sm">Server Port:</Text>
              <Input
                type="number"
                value={settings.port}
                onChange={(e) => saveSettings({ port: parseInt(e.target.value) || 8080 })}
                size="sm"
                maxW="120px"
                min={1024}
                max={65535}
              />
            </HStack>

            <HStack justify="space-between">
              <Text fontSize="sm">Auto-start server on app launch</Text>
              <Switch
                isChecked={settings.autoStart}
                onChange={(e) => saveSettings({ autoStart: e.target.checked })}
                isDisabled={saving}
                size="sm"
              />
            </HStack>
          </VStack>

          <Divider />

          {/* Capture Settings */}
          <VStack spacing={4} align="stretch">
            <Text fontWeight="medium">Capture Settings</Text>
            
            <HStack justify="space-between">
              <Text fontSize="sm">Enable Browser Source</Text>
              <Switch
                isChecked={settings.enableBrowserSource}
                onChange={(e) => saveSettings({ enableBrowserSource: e.target.checked })}
                isDisabled={saving}
                size="sm"
              />
            </HStack>

            <HStack justify="space-between">
              <Text fontSize="sm">Enable Window Capture</Text>
              <Switch
                isChecked={settings.enableWindowCapture}
                onChange={(e) => saveSettings({ enableWindowCapture: e.target.checked })}
                isDisabled={saving}
                size="sm"
              />
            </HStack>

            <HStack justify="space-between">
              <Text fontSize="sm">Transparent Background</Text>
              <Switch
                isChecked={settings.transparentBackground}
                onChange={(e) => saveSettings({ transparentBackground: e.target.checked })}
                isDisabled={saving}
                size="sm"
              />
            </HStack>
          </VStack>

          <Divider />

          {/* Window Dimensions */}
          <VStack spacing={4} align="stretch">
            <Text fontWeight="medium">Capture Dimensions</Text>
            
            <HStack>
              <Text minW="60px" fontSize="sm">Width:</Text>
              <Input
                type="number"
                value={settings.windowWidth}
                onChange={(e) => saveSettings({ windowWidth: parseInt(e.target.value) || 800 })}
                size="sm"
                maxW="120px"
                min={100}
                max={4096}
              />
              <Text fontSize="sm">px</Text>
            </HStack>

            <HStack>
              <Text minW="60px" fontSize="sm">Height:</Text>
              <Input
                type="number"
                value={settings.windowHeight}
                onChange={(e) => saveSettings({ windowHeight: parseInt(e.target.value) || 600 })}
                size="sm"
                maxW="120px"
                min={100}
                max={4096}
              />
              <Text fontSize="sm">px</Text>
            </HStack>
          </VStack>

          {/* Instructions */}
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>How to use with OBS</AlertTitle>
              <AlertDescription>
                <VStack align="start" spacing={2} fontSize="sm">
                  <Text>1. Enable OBS integration and start the server</Text>
                  <Text>2. In OBS Studio, add a "Browser Source"</Text>
                  <Text>3. Copy the Browser Source URL and paste it into OBS</Text>
                  <Text>4. Set the width and height to match your capture dimensions</Text>
                  <Text>5. Enable "Shutdown source when not visible" for better performance</Text>
                </VStack>
              </AlertDescription>
            </Box>
          </Alert>
        </>
      )}

      {/* Disabled State Help */}
      {!settings.enabled && (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>OBS Integration Disabled</AlertTitle>
            <AlertDescription>
              To use OBS streaming features, enable OBS integration above. 
              Note that enabling OBS will increase memory usage due to canvas capture and streaming services.
            </AlertDescription>
          </Box>
        </Alert>
      )}
    </VStack>
  );
};

// Hook for accessing OBS settings from other components
export const useOBSSettings = () => {
  const [settings, setSettings] = useState<OBSSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      await window.api.obs.ensureInitialized();
      const obsSettings = await window.api.obs.getSettings();
      setSettings(obsSettings);
    } catch (error) {
      console.error('Failed to load OBS settings:', error);
      setSettings({
        enabled: false,
        port: 8080,
        enableBrowserSource: true,
        enableWindowCapture: true,
        windowWidth: 800,
        windowHeight: 600,
        transparentBackground: true,
        autoStart: false
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<OBSSettings>) => {
    if (!settings) return;

    try {
      setLoading(true);
      const updatedSettings = await window.api.obs.updateSettings(newSettings);
      setSettings(updatedSettings);

      // Dispatch event for other components to react
      window.dispatchEvent(new CustomEvent('obs-settings-changed', { 
        detail: { 
          enabled: updatedSettings.enabled,
          previousEnabled: settings.enabled 
        } 
      }));

      return updatedSettings;
    } catch (error) {
      console.error('Failed to update OBS settings:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    updateSettings,
    reload: loadSettings
  };
};