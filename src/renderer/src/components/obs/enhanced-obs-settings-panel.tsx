// src/renderer/src/components/obs/enhanced-obs-settings-panel.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Alert,
  Code,
  Portal,
  IconButton,
  Card,
  Separator
} from '@chakra-ui/react';
import { 
  Copy, 
  ExternalLink, 
  Monitor, 
  X, 
  Wifi, 
  WifiOff, 
  Video, 
  Cast,
  Globe,
  Settings
} from 'lucide-react';
import { useOBSPetMode, OBSCaptureMode } from '@/hooks/utils/use-obs-pet-mode';

interface EnhancedOBSSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnhancedOBSSettingsPanel = ({ isOpen, onClose }: EnhancedOBSSettingsPanelProps): JSX.Element => {
  const {
    captureMode,
    isActive,
    petModeOptions,
    enablePetWindowCapture,
    enableCanvasStream,
    enableBrowserSource,
    disableCapture,
    getCaptureInstructions,
    getStatus,
    updatePetModeOptions,
    isStreaming,
    streamUrl
  } = useOBSPetMode();

  const [isLoading, setIsLoading] = useState(false);
  const [browserSourceUrl, setBrowserSourceUrl] = useState<string | null>(null);

  // Helper function to get OBS API with fallback support
  const getOBSAPI = useCallback(() => {
    return window.api?.obs || (window as any).obsPolyfill?.obs;
  }, []);

  // Load browser source URL when needed
  useEffect(() => {
    if (captureMode === 'browser-source' && !browserSourceUrl) {
      const loadBrowserUrl = async () => {
        try {
          const obsAPI = getOBSAPI();
          if (obsAPI?.getBrowserSourceUrl) {
            const url = await obsAPI.getBrowserSourceUrl(
              petModeOptions.width,
              petModeOptions.height,
              petModeOptions.transparent
            );
            setBrowserSourceUrl(url);
          }
        } catch (error) {
          console.error('Failed to load browser source URL:', error);
        }
      };
      loadBrowserUrl();
    }
  }, [captureMode, browserSourceUrl, petModeOptions, getOBSAPI]);

  const showToast = (title: string, description: string, type: 'success' | 'error' | 'info') => {
    console.log(`${type.toUpperCase()}: ${title} - ${description}`);
    if (type === 'error') {
      alert(`Error: ${description}`);
    }
  };

  const handleModeChange = useCallback(async (mode: OBSCaptureMode) => {
    setIsLoading(true);
    try {
      // Disable current mode first
      if (isActive) {
        await disableCapture();
      }

      // Enable new mode
      switch (mode) {
        case 'pet-window':
          const petResult = await enablePetWindowCapture();
          if (petResult) {
            showToast('Pet Window Enabled', 'Use Window Capture in OBS to capture the transparent window', 'success');
          } else {
            showToast('Failed to Enable Pet Window', 'Could not switch to pet mode', 'error');
          }
          break;

        case 'canvas-stream':
          const streamResult = await enableCanvasStream();
          if (streamResult.success) {
            showToast('Canvas Stream Started', 'Live2D canvas is now being streamed', 'success');
          } else {
            showToast('Failed to Start Stream', 'Could not create canvas stream', 'error');
          }
          break;

        case 'browser-source':
          const browserResult = await enableBrowserSource({
            width: petModeOptions.width,
            height: petModeOptions.height
          });
          if (browserResult.success) {
            setBrowserSourceUrl(browserResult.url || null);
            showToast('Browser Source Ready', 'Use the provided URL in OBS Browser Source', 'success');
          } else {
            showToast('Failed to Setup Browser Source', 'Could not create browser source URL', 'error');
          }
          break;

        case 'disabled':
          await disableCapture();
          setBrowserSourceUrl(null);
          showToast('OBS Capture Disabled', 'All capture modes have been disabled', 'info');
          break;
      }
    } catch (error) {
      console.error('Failed to change capture mode:', error);
      showToast('Mode Change Failed', error.message || 'Could not change capture mode', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isActive, disableCapture, enablePetWindowCapture, enableCanvasStream, enableBrowserSource, petModeOptions]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied', `${label} copied to clipboard`, 'success');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('Copied', `${label} copied to clipboard`, 'success');
    }
  }, []);

  const instructions = getCaptureInstructions();
  const status = getStatus();

  if (!isOpen) return null;

  return (
    <Portal>
      {/* Backdrop */}
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="blackAlpha.600"
        zIndex={1000}
        onClick={onClose}
      />

      {/* Panel Content */}
      <Box
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        bg="gray.900"
        color="white"
        borderRadius="lg"
        boxShadow="2xl"
        border="1px solid"
        borderColor="gray.700"
        maxWidth="2xl"
        width="90vw"
        maxHeight="90vh"
        zIndex={1001}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box 
          borderBottom="1px solid" 
          borderColor="gray.700" 
          p={6}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
        >
          <HStack>
            <Text fontSize="xl" fontWeight="bold">
              🎥 OBS Integration
            </Text>
            {isActive ? (
              <Badge colorScheme="green" variant="solid">
                <HStack gap={1}>
                  <Wifi size={12} />
                  <Text fontSize="xs">{captureMode.replace('-', ' ').toUpperCase()}</Text>
                </HStack>
              </Badge>
            ) : (
              <Badge colorScheme="gray" variant="outline">
                <HStack gap={1}>
                  <WifiOff size={12} />
                  <Text fontSize="xs">Inactive</Text>
                </HStack>
              </Badge>
            )}
          </HStack>
          
          <IconButton
            aria-label="Close OBS Settings"
            variant="ghost"
            onClick={onClose}
            color="gray.400"
            _hover={{ color: "white", bg: "gray.700" }}
          >
            <X size={20} />
          </IconButton>
        </Box>

        {/* Body */}
        <Box overflowY="auto" p={6} maxHeight="70vh">
          <VStack gap={6} align="stretch">
            {/* Current Status */}
            {isActive && (
              <Alert.Root status="success" variant="subtle">
                <Alert.Indicator />
                <Alert.Title>Capture Active</Alert.Title>
                <Alert.Description>
                  {instructions.type} mode is currently active. 
                  {captureMode === 'canvas-stream' && isStreaming && ' Canvas stream is running.'}
                  {captureMode === 'pet-window' && ' Pet window is available for capture.'}
                  {captureMode === 'browser-source' && browserSourceUrl && ' Browser source URL is ready.'}
                </Alert.Description>
              </Alert.Root>
            )}

            {/* Capture Mode Selection */}
            <VStack gap={4} align="stretch">
              <Text fontSize="lg" fontWeight="bold" color="blue.300">
                Choose Capture Method
              </Text>

              {/* Pet Window Capture */}
              <Card.Root 
                bg={captureMode === 'pet-window' ? 'green.900' : 'gray.800'} 
                border="2px solid" 
                borderColor={captureMode === 'pet-window' ? 'green.500' : 'gray.600'}
              >
                <Card.Body p={4}>
                  <HStack justify="space-between" align="start">
                    <VStack align="start" flex={1} gap={2}>
                      <HStack>
                        <Monitor size={20} color={captureMode === 'pet-window' ? '#48bb78' : '#a0aec0'} />
                        <Text fontWeight="bold">Pet Window Capture</Text>
                        <Badge colorScheme="green" variant="outline" size="sm">RECOMMENDED</Badge>
                      </HStack>
                      <Text fontSize="sm" color="gray.300">
                        Uses the existing pet mode to create a transparent window that OBS can capture directly. 
                        Best performance and lowest latency.
                      </Text>
                      {captureMode === 'pet-window' && (
                        <Text fontSize="xs" color="green.300">
                          ✅ Pet window is active - use "Window Capture" in OBS to capture the Enspira VTuber window
                        </Text>
                      )}
                    </VStack>
                    <Button
                      onClick={() => handleModeChange(captureMode === 'pet-window' ? 'disabled' : 'pet-window')}
                      isLoading={isLoading}
                      colorScheme={captureMode === 'pet-window' ? 'red' : 'green'}
                      variant={captureMode === 'pet-window' ? 'outline' : 'solid'}
                      size="sm"
                      disabled={!status.capabilities.petWindow}
                    >
                      {captureMode === 'pet-window' ? 'Disable' : 'Enable'}
                    </Button>
                  </HStack>
                </Card.Body>
              </Card.Root>

              {/* Canvas Stream */}
              <Card.Root 
                bg={captureMode === 'canvas-stream' ? 'blue.900' : 'gray.800'} 
                border="2px solid" 
                borderColor={captureMode === 'canvas-stream' ? 'blue.500' : 'gray.600'}
              >
                <Card.Body p={4}>
                  <HStack justify="space-between" align="start">
                    <VStack align="start" flex={1} gap={2}>
                      <HStack>
                        <Cast size={20} color={captureMode === 'canvas-stream' ? '#4299e1' : '#a0aec0'} />
                        <Text fontWeight="bold">Canvas Stream</Text>
                        <Badge colorScheme="blue" variant="outline" size="sm">EFFICIENT</Badge>
                      </HStack>
                      <Text fontSize="sm" color="gray.300">
                        Streams the Live2D canvas directly without creating additional windows. 
                        Perfect for custom streaming setups.
                      </Text>
                      {captureMode === 'canvas-stream' && streamUrl && (
                        <HStack gap={2} width="100%">
                          <Code fontSize="xs" p={2} bg="gray.700" color="blue.300" borderRadius="md" flex={1}>
                            Stream active: {streamUrl.substring(0, 50)}...
                          </Code>
                          <IconButton
                            aria-label="Copy stream URL"
                            size="xs"
                            variant="ghost"
                            onClick={() => copyToClipboard(streamUrl, 'Stream URL')}
                          >
                            <Copy size={12} />
                          </IconButton>
                        </HStack>
                      )}
                    </VStack>
                    <Button
                      onClick={() => handleModeChange(captureMode === 'canvas-stream' ? 'disabled' : 'canvas-stream')}
                      isLoading={isLoading}
                      colorScheme={captureMode === 'canvas-stream' ? 'red' : 'blue'}
                      variant={captureMode === 'canvas-stream' ? 'outline' : 'solid'}
                      size="sm"
                      disabled={!status.capabilities.canvasStream}
                    >
                      {captureMode === 'canvas-stream' ? 'Stop Stream' : 'Start Stream'}
                    </Button>
                  </HStack>
                </Card.Body>
              </Card.Root>

              {/* Browser Source */}
              <Card.Root 
                bg={captureMode === 'browser-source' ? 'purple.900' : 'gray.800'} 
                border="2px solid" 
                borderColor={captureMode === 'browser-source' ? 'purple.500' : 'gray.600'}
              >
                <Card.Body p={4}>
                  <HStack justify="space-between" align="start">
                    <VStack align="start" flex={1} gap={2}>
                      <HStack>
                        <Globe size={20} color={captureMode === 'browser-source' ? '#9f7aea' : '#a0aec0'} />
                        <Text fontWeight="bold">Browser Source</Text>
                        <Badge colorScheme="purple" variant="outline" size="sm">COMPATIBLE</Badge>
                      </HStack>
                      <Text fontSize="sm" color="gray.300">
                        Creates a web URL that can be used as a Browser Source in OBS. 
                        Good compatibility across different setups.
                      </Text>
                      {captureMode === 'browser-source' && browserSourceUrl && (
                        <HStack gap={2} width="100%">
                          <Code fontSize="xs" p={2} bg="gray.700" color="purple.300" borderRadius="md" flex={1}>
                            {browserSourceUrl}
                          </Code>
                          <IconButton
                            aria-label="Copy browser URL"
                            size="xs"
                            variant="ghost"
                            onClick={() => copyToClipboard(browserSourceUrl, 'Browser Source URL')}
                          >
                            <Copy size={12} />
                          </IconButton>
                          <IconButton
                            aria-label="Open in browser"
                            size="xs"
                            variant="ghost"
                            onClick={() => window.open(browserSourceUrl, '_blank')}
                          >
                            <ExternalLink size={12} />
                          </IconButton>
                        </HStack>
                      )}
                    </VStack>
                    <Button
                      onClick={() => handleModeChange(captureMode === 'browser-source' ? 'disabled' : 'browser-source')}
                      isLoading={isLoading}
                      colorScheme={captureMode === 'browser-source' ? 'red' : 'purple'}
                      variant={captureMode === 'browser-source' ? 'outline' : 'solid'}
                      size="sm"
                      disabled={!status.capabilities.browserSource}
                    >
                      {captureMode === 'browser-source' ? 'Disable' : 'Enable'}
                    </Button>
                  </HStack>
                </Card.Body>
              </Card.Root>
            </VStack>

            {/* Instructions */}
            {isActive && (
              <>
                <Separator borderColor="gray.700" />
                <VStack gap={4} align="stretch">
                  <Text fontSize="lg" fontWeight="bold" color="yellow.300">
                    📋 Setup Instructions
                  </Text>
                  
                  <Box p={4} bg="gray.800" borderRadius="md" border="1px solid" borderColor="gray.600">
                    <VStack align="start" gap={2}>
                      <Text fontSize="md" fontWeight="medium" color="yellow.200">
                        {instructions.type}
                      </Text>
                      {instructions.instructions.map((instruction, index) => (
                        <Text key={index} fontSize="sm" color="gray.300">
                          {instruction}
                        </Text>
                      ))}
                      <Box mt={2} p={2} bg="blue.900" borderRadius="md" borderLeft="4px solid" borderColor="blue.500">
                        <Text fontSize="xs" color="blue.200">
                          💡 {instructions.tips}
                        </Text>
                      </Box>
                    </VStack>
                  </Box>
                </VStack>
              </>
            )}

            {/* Capabilities Check */}
            <VStack gap={2} align="stretch">
              <Text fontSize="md" fontWeight="medium" color="gray.400">
                System Capabilities
              </Text>
              <HStack gap={4} fontSize="sm">
                <Text color={status.capabilities.petWindow ? 'green.300' : 'red.300'}>
                  {status.capabilities.petWindow ? '✅' : '❌'} Pet Mode
                </Text>
                <Text color={status.capabilities.canvasStream ? 'green.300' : 'red.300'}>
                  {status.capabilities.canvasStream ? '✅' : '❌'} Canvas Stream
                </Text>
                <Text color={status.capabilities.browserSource ? 'green.300' : 'yellow.300'}>
                  {status.capabilities.browserSource ? '✅' : '⚠️'} Browser Source
                </Text>
              </HStack>
            </VStack>
          </VStack>
        </Box>

        {/* Footer */}
        <Box borderTop="1px solid" borderColor="gray.700" p={4}>
          <HStack justify="space-between">
            <Text fontSize="xs" color="gray.500">
              💡 Tip: Pet Window Capture provides the best performance for most users
            </Text>
            
            {isActive && (
              <Button
                onClick={() => handleModeChange('disabled')}
                variant="outline"
                colorScheme="red"
                size="sm"
                leftIcon={<X size={16} />}
              >
                Disable All Capture
              </Button>
            )}
          </HStack>
        </Box>
      </Box>
    </Portal>
  );
};