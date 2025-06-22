import {
  Button,
  Box,
  Text,
  Badge,
  Input,
  Switch,
  HStack,
  VStack,
  Separator,
  Portal,
  NativeSelectRoot,
  NativeSelectField,
} from "@chakra-ui/react";
import { useState, useEffect, useCallback } from "react";
import { useBgUrl } from "@/context/bgurl-context";
import { useLive2DConfig } from "@/context/live2d-config-context";
import { useConfig } from "@/context/character-config-context";
import { useWebSocket } from "@/context/websocket-context";
import { useSubtitle } from "@/context/subtitle-context";
import { useSTT, type STTProvider } from "@/context/stt-context";
import { useLocalStorage } from "@/hooks/utils/use-local-storage";
import { CustomExpressionSettingsPanel } from "@/components/settings/custom-expression-settings-panel";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

// Audio device management hook
const useAudioDeviceManager = () => {
  const [selectedInputDevice, setSelectedInputDevice] = useLocalStorage<string>(
    'selectedAudioInputDevice',
    'default'
  );
  const [selectedOutputDevice, setSelectedOutputDevice] = useLocalStorage<string>(
    'selectedAudioOutputDevice',
    'default'
  );

  // Function to apply input device constraints
  const getAudioConstraints = useCallback((): MediaTrackConstraints => {
    if (selectedInputDevice === 'default') {
      return { echoCancellation: true, noiseSuppression: true };
    }
    return {
      deviceId: { exact: selectedInputDevice },
      echoCancellation: true,
      noiseSuppression: true,
    };
  }, [selectedInputDevice]);

  // Function to set output device for audio elements
  const setAudioOutputDevice = useCallback(async (audioElement: HTMLAudioElement) => {
    if ('setSinkId' in audioElement && selectedOutputDevice !== 'default') {
      try {
        await (audioElement as any).setSinkId(selectedOutputDevice);
        console.log(`Audio output set to device: ${selectedOutputDevice}`);
      } catch (error) {
        console.error('Failed to set audio output device:', error);
      }
    }
  }, [selectedOutputDevice]);

  return {
    selectedInputDevice,
    setSelectedInputDevice,
    selectedOutputDevice,
    setSelectedOutputDevice,
    getAudioConstraints,
    setAudioOutputDevice,
  };
};

function SettingsModal({ isOpen, onClose }: SettingsModalProps): JSX.Element {
  const bgUrlContext = useBgUrl();
  const live2dContext = useLive2DConfig();
  const { confName } = useConfig();
  
  // FIXED: Enhanced destructuring with error checking
  const webSocketContext = useWebSocket();
  console.log('Settings modal - WebSocket context received:', {
    hasSetApiKey: typeof webSocketContext.setApiKey === 'function',
    hasSetWsUrl: typeof webSocketContext.setWsUrl === 'function',
    apiKeyLength: webSocketContext.apiKey ? webSocketContext.apiKey.length : 0,
    wsState: webSocketContext.wsState,
  });
  
  const { 
    wsUrl, 
    setWsUrl, 
    apiKey, 
    setApiKey, 
    isAuthenticated, 
    wsState, 
    connectionStats, 
    getConnectionInfo 
  } = webSocketContext;
  
  // FIXED: Verify functions are available
  if (typeof setApiKey !== 'function') {
    console.error('setApiKey is not a function in settings modal!', { setApiKey, typeof: typeof setApiKey });
    throw new Error('setApiKey function is not available in settings modal');
  }
  
  if (typeof setWsUrl !== 'function') {
    console.error('setWsUrl is not a function in settings modal!', { setWsUrl, typeof: typeof setWsUrl });
    throw new Error('setWsUrl function is not available in settings modal');
  }
  
  const { showCaptions, setShowCaptions } = useSubtitle();
  const sttContext = useSTT();

  // ADDED: Custom Expression Settings state
  const [isCustomExpressionsPanelOpen, setIsCustomExpressionsPanelOpen] = useState(false);

  // Local state for settings - FIXED: Ensure proper default values
  const [localWsUrl, setLocalWsUrl] = useState(() => {
    const initial = wsUrl || 'wss://enspira.tools/ws-client';
    console.log('Initial localWsUrl:', initial);
    return initial;
  });
  // ADDED: Local state for API key with proper default
  const [localApiKey, setLocalApiKey] = useState(() => {
    const initial = apiKey || '';
    console.log('Initial localApiKey length:', initial.length);
    return initial;
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Audio device state management using the custom hook
  const {
    selectedInputDevice,
    setSelectedInputDevice,
    selectedOutputDevice,
    setSelectedOutputDevice,
    getAudioConstraints,
    setAudioOutputDevice,
  } = useAudioDeviceManager();

  const [audioInputDevices, setAudioInputDevices] = useState<AudioDevice[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<AudioDevice[]>([]);

  // Function to enumerate available audio devices
  const enumerateAudioDevices = useCallback(async () => {
    try {
      // Request permissions first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const inputDevices: AudioDevice[] = [
        { deviceId: 'default', label: 'System Default', kind: 'audioinput' }
      ];
      const outputDevices: AudioDevice[] = [
        { deviceId: 'default', label: 'System Default', kind: 'audiooutput' }
      ];

      devices.forEach(device => {
        if (device.kind === 'audioinput' && device.deviceId !== 'default') {
          inputDevices.push({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${inputDevices.length}`,
            kind: device.kind
          });
        } else if (device.kind === 'audiooutput' && device.deviceId !== 'default') {
          outputDevices.push({
            deviceId: device.deviceId,
            label: device.label || `Speaker ${outputDevices.length}`,
            kind: device.kind
          });
        }
      });

      setAudioInputDevices(inputDevices);
      setAudioOutputDevices(outputDevices);
    } catch (error) {
      console.error('Failed to enumerate audio devices:', error);
      // Set default devices if enumeration fails
      setAudioInputDevices([
        { deviceId: 'default', label: 'System Default', kind: 'audioinput' }
      ]);
      setAudioOutputDevices([
        { deviceId: 'default', label: 'System Default', kind: 'audiooutput' }
      ]);
    }
  }, []);

  // Load devices when modal opens
  useEffect(() => {
    if (isOpen) {
      enumerateAudioDevices();
      // Update local state when modal opens - FIXED: Handle undefined values
      const newWsUrl = wsUrl || 'wss://enspira.tools/ws-client';
      const newApiKey = apiKey || '';
      
      console.log('Settings modal opened, loading values:', {
        contextWsUrl: wsUrl,
        contextApiKey: apiKey ? `${apiKey.length} chars` : 'empty',
        newWsUrl,
        newApiKeyLength: newApiKey.length
      });
      
      setLocalWsUrl(newWsUrl);
      setLocalApiKey(newApiKey);
    }
  }, [isOpen, enumerateAudioDevices, wsUrl, apiKey]);

  const handleSelectLocalModel = async () => {
    try {
      await live2dContext?.selectLocalModelDirectory();
    } catch (error) {
      console.error("Failed to select local model:", error);
    }
  };

  const handleSelectLocalBackground = async () => {
    try {
      await bgUrlContext?.selectLocalBackground();
    } catch (error) {
      console.error("Failed to select local background:", error);
    }
  };

  const getCurrentModelDisplay = () => {
    if (live2dContext?.selectedModelName) {
      return live2dContext.selectedModelName;
    }
    return confName || 'No model selected';
  };

  const getCurrentBackgroundDisplay = () => {
    if (bgUrlContext?.useCameraBackground) {
      return "Camera Background";
    }
    if (bgUrlContext?.isLocalBackground && bgUrlContext?.localBackgroundPath) {
      const fileName = bgUrlContext.localBackgroundPath.split(/[/\\]/).pop();
      return `Local: ${fileName}`;
    }
    return "Default background";
  };

  const handleSelectModel = (modelName: string) => {
    live2dContext?.setSelectedModelName(modelName);
  };

  // ADDED: API key validation
  const validateApiKey = (key: string): { isValid: boolean; message?: string } => {
    if (!key.trim()) {
      return { isValid: false, message: 'API key is required' };
    }
    
    if (key.length < 10) {
      return { isValid: false, message: 'API key seems too short' };
    }
    
    if (key.includes(' ')) {
      return { isValid: false, message: 'API key should not contain spaces' };
    }
    
    return { isValid: true };
  };

  // ADDED: Connection test function - FIXED to properly use local state
  const testConnection = async () => {
    const testButton = document.getElementById('test-connection-btn');
    
    try {
      if (testButton) {
        testButton.textContent = '🔄 Testing...';
      }
      
      // Validate before testing
      const apiKeyValidation = validateApiKey(localApiKey);
      if (!apiKeyValidation.isValid) {
        if (testButton) {
          testButton.textContent = '❌ Invalid API Key';
          setTimeout(() => {
            testButton.textContent = '🔌 Test Connection';
          }, 3000);
        }
        return;
      }
      
      console.log('Testing connection with:', {
        url: localWsUrl,
        apiKeyLength: localApiKey.length,
        hasApiKey: !!localApiKey
      });
      
      // Temporarily apply settings for testing
      setWsUrl(localWsUrl);
      setApiKey(localApiKey);
      
      // Wait longer for connection establishment and authentication
      let attempts = 0;
      const maxAttempts = 10; // 5 seconds total
      
      const checkConnection = async (): Promise<boolean> => {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
        
        const connectionInfo = getConnectionInfo ? getConnectionInfo() : null;
        console.log(`Connection check ${attempts}:`, { 
          wsState, 
          isAuthenticated, 
          connectionInProgress: connectionInfo?.connectionInProgress 
        });
        
        // Success case
        if (wsState === 'OPEN' && isAuthenticated) {
          return true;
        }
        
        // Still connecting or authenticating
        if (attempts < maxAttempts && (
          wsState === 'CONNECTING' || 
          wsState === 'RECONNECTING' ||
          connectionInfo?.connectionInProgress ||
          (wsState === 'OPEN' && !isAuthenticated)
        )) {
          return checkConnection();
        }
        
        // Failed
        return false;
      };
      
      const success = await checkConnection();
      
      if (testButton) {
        if (success) {
          testButton.textContent = '✅ Connection Successful';
        } else if (wsState === 'OPEN' && !isAuthenticated) {
          testButton.textContent = '⚠️ Connected but Auth Failed';
        } else {
          testButton.textContent = '❌ Connection Failed';
        }
        
        setTimeout(() => {
          testButton.textContent = '🔌 Test Connection';
        }, 4000);
      }
      
    } catch (error) {
      console.error('Connection test failed:', error);
      if (testButton) {
        testButton.textContent = '❌ Test Failed';
        setTimeout(() => {
          testButton.textContent = '🔌 Test Connection';
        }, 3000);
      }
    }
  };

  const handleSaveSettings = async () => {
    console.log('handleSaveSettings called');
    
    // FIXED: Verify functions before using them
    if (typeof setApiKey !== 'function') {
      console.error('setApiKey is not a function in handleSaveSettings!');
      alert('Error: setApiKey function is not available. Please refresh the page and try again.');
      return;
    }
    
    if (typeof setWsUrl !== 'function') {
      console.error('setWsUrl is not a function in handleSaveSettings!');
      alert('Error: setWsUrl function is not available. Please refresh the page and try again.');
      return;
    }
    
    // Validate API key before saving
    const apiKeyValidation = validateApiKey(localApiKey);
    if (!apiKeyValidation.isValid) {
      alert(`API Key Error: ${apiKeyValidation.message}`);
      return;
    }
    
    setIsSaving(true);
    
    try {
      console.log('Saving settings:', {
        wsUrl: localWsUrl,
        apiKeyLength: localApiKey.length,
        hasApiKey: !!localApiKey,
        inputDevice: selectedInputDevice,
        outputDevice: selectedOutputDevice,
        setApiKeyType: typeof setApiKey,
        setWsUrlType: typeof setWsUrl,
      });
      
      // Save settings to context (which will persist to localStorage)
      console.log('Calling setWsUrl...');
      setWsUrl(localWsUrl);
      
      console.log('Calling setApiKey...');
      setApiKey(localApiKey);
      
      // Small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('Settings saved successfully');
      onClose();
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert(`Failed to save settings: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resetLocalModel = () => {
    live2dContext?.setLocalModelDirectory(null);
    live2dContext?.setModelInfo(undefined);
  };

  const resetLocalBackground = () => {
    bgUrlContext?.setLocalBackgroundPath(null);
    bgUrlContext?.resetBackground();
  };

  // Function to refresh audio devices
  const refreshAudioDevices = async () => {
    await enumerateAudioDevices();
  };

  // Function to get device label by ID
  const getDeviceLabel = useCallback((deviceId: string, devices: AudioDevice[]) => {
    if (deviceId === 'default') return 'System Default';
    const device = devices.find(d => d.deviceId === deviceId);
    return device?.label || 'Unknown Device';
  }, []);

  // Function to test input device
  const testInputDevice = useCallback(async () => {
    try {
      const constraints = getAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
      console.log('Input device test successful:', selectedInputDevice);
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
      
      // Visual feedback
      const button = document.getElementById('test-input-btn');
      if (button) {
        button.textContent = '✅ Test Successful';
        setTimeout(() => {
          button.textContent = '🎤 Test Input Device';
        }, 2000);
      }
    } catch (error) {
      console.error('Input device test failed:', error);
      const button = document.getElementById('test-input-btn');
      if (button) {
        button.textContent = '❌ Test Failed';
        setTimeout(() => {
          button.textContent = '🎤 Test Input Device';
        }, 2000);
      }
    }
  }, [getAudioConstraints, selectedInputDevice]);

  // Function to test output device
  const testOutputDevice = useCallback(async () => {
    try {
      // Create a short test tone
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      console.log('Output device test initiated:', selectedOutputDevice);
      
      // Visual feedback
      const button = document.getElementById('test-output-btn');
      if (button) {
        button.textContent = '🔊 Playing Test Tone...';
        setTimeout(() => {
          button.textContent = '🔊 Test Output Device';
        }, 1000);
      }
    } catch (error) {
      console.error('Output device test failed:', error);
      const button = document.getElementById('test-output-btn');
      if (button) {
        button.textContent = '❌ Test Failed';
        setTimeout(() => {
          button.textContent = '🔊 Test Output Device';
        }, 2000);
      }
    }
  }, [selectedOutputDevice]);

  // STT provider change handler
  const handleSTTProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value as STTProvider;
    sttContext.updateSettings({ provider });
  };

  // STT setting update handlers
  const updateLocalWhisperSettings = (key: string, value: any) => {
    sttContext.updateSettings({
      localWhisper: {
        ...sttContext.settings.localWhisper,
        [key]: value,
      },
    });
  };

  const updateRemoteWhisperSettings = (key: string, value: any) => {
    sttContext.updateSettings({
      remoteWhisper: {
        ...sttContext.settings.remoteWhisper,
        [key]: value,
      },
    });
  };

  const updateWebAPISettings = (key: string, value: any) => {
    sttContext.updateSettings({
      webapi: {
        ...sttContext.settings.webapi,
        [key]: value,
      },
    });
  };

  // Get provider status display
  const getProviderStatusDisplay = (provider: STTProvider) => {
    const isCurrentProvider = sttContext.settings.provider === provider;
    
    return (
      <Badge
        bg={isCurrentProvider ? 'green.600' : 'gray.600'}
        color="white"
        px={2}
        py={1}
        borderRadius="sm"
        fontSize="xs"
      >
        {isCurrentProvider ? 'Active' : 'Inactive'}
      </Badge>
    );
  };

  // ADDED: Get connection status display
  const getConnectionStatusDisplay = () => {
    let statusColor = 'gray.600';
    let statusText = 'Disconnected';

    if (wsState === 'OPEN') {
      if (isAuthenticated) {
        statusColor = 'green.600';
        statusText = 'Connected & Authenticated';
      } else {
        statusColor = 'yellow.600';
        statusText = 'Connected (Auth Pending)';
      }
    } else if (wsState === 'CONNECTING' || wsState === 'RECONNECTING') {
      statusColor = 'blue.600';
      statusText = 'Connecting...';
    } else if (wsState === 'FAILED') {
      statusColor = 'red.600';
      statusText = 'Connection Failed';
    }

    return (
      <Badge
        bg={statusColor}
        color="white"
        px={2}
        py={1}
        borderRadius="sm"
        fontSize="xs"
      >
        {statusText}
      </Badge>
    );
  };

  // ADDED: Helper to check if custom expressions are available
  const hasCustomExpressionSupport = () => {
    return live2dContext?.modelInfo && (
      live2dContext.modelInfo.isLocal || 
      live2dContext.modelInfo.hasCDI3 ||
      live2dContext.availableModels.length > 0
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <Portal>
        {/* FIXED: Modal backdrop with proper z-index */}
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.600"
          zIndex={1000}
          onClick={(e) => {
            // Only close if clicking the container, not the modal content
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        />

        {/* FIXED: Modal container with proper positioning and scrolling */}
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={1001}
          display="flex"
          alignItems="center"
          justifyContent="center"
          p={4}
          onClick={onClose}
        >
          {/* FIXED: Modal content with better height management */}
          <Box
            bg="gray.800"
            color="white"
            borderRadius="lg"
            boxShadow="xl"
            maxWidth="lg"
            width="100%"
            maxHeight="calc(100vh - 2rem)"
            display="flex"
            flexDirection="column"
            onClick={(e) => e.stopPropagation()}
          >
            {/* FIXED: Header with flex-shrink to prevent compression */}
            <Box 
              borderBottom="1px solid" 
              borderColor="whiteAlpha.200" 
              p={6}
              flexShrink={0}
            >
              <Text textStyle="xl" fontWeight="bold">
                Settings
              </Text>
            </Box>

            {/* FIXED: Body with proper flex and overflow handling */}
            <Box 
              flex={1}
              overflowY="auto"
              p={6}
              minHeight={0}
            >
              <VStack gap={6} align="stretch">
                {/* ADDED: Enspira Connection Settings - First Priority */}
                <Box>
                  <Text
                    textStyle="md"
                    fontWeight="semibold"
                    mb={3}
                    color="blue.300"
                  >
                    🚀 Enspira Connection Settings
                  </Text>
                  
                  <VStack gap={4} align="stretch">
                    {/* Connection Status */}
                    <Box
                      p={4}
                      bg="gray.700"
                      borderRadius="md"
                      border="1px solid"
                      borderColor="gray.600"
                    >
                      <HStack justify="space-between" mb={2}>
                        <Text textStyle="sm" fontWeight="medium">
                          Connection Status
                        </Text>
                        {getConnectionStatusDisplay()}
                      </HStack>
                      
                      {connectionStats.connected && (
                        <VStack gap={1} align="stretch">
                          <Text textStyle="xs" color="gray.300">
                            Messages: ↓{connectionStats.messagesReceived} ↑{connectionStats.messagesSent}
                          </Text>
                          {connectionStats.latency && (
                            <Text textStyle="xs" color="gray.300">
                              Latency: {connectionStats.latency}ms
                            </Text>
                          )}
                        </VStack>
                      )}
                    </Box>

                    {/* WebSocket URL */}
                    <Box>
                      <Text textStyle="sm" color="gray.300" mb={1}>
                        Enspira Server WebSocket URL
                      </Text>
                      <Input
                        value={localWsUrl}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          console.log('WebSocket URL changed:', newValue);
                          setLocalWsUrl(newValue);
                        }}
                        placeholder="wss://enspira.tools/ws-client"
                        bg="gray.700"
                        border="1px solid"
                        borderColor="gray.600"
                        _focus={{
                          borderColor: "blue.400",
                          boxShadow: "0 0 0 1px blue.400",
                        }}
                        _hover={{ borderColor: "gray.500" }}
                        size="sm"
                      />
                      <Text textStyle="xs" color="gray.400" mt={1}>
                        Format: wss://hostname/ws-client (or ws:// for local)
                      </Text>
                    </Box>

                    {/* API Key */}
                    <Box>
                      <HStack justify="space-between" mb={1}>
                        <Text textStyle="sm" color="gray.300">
                          Enspira API Key
                        </Text>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setShowApiKey(!showApiKey)}
                          color="gray.400"
                        >
                          {showApiKey ? '🙈 Hide' : '👁️ Show'}
                        </Button>
                      </HStack>
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={localApiKey}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          console.log('API key input changed, length:', newValue.length);
                          setLocalApiKey(newValue);
                        }}
                        placeholder="Enter your Enspira API key..."
                        bg="gray.700"
                        border="1px solid"
                        borderColor={localApiKey ? 'green.600' : 'gray.600'}
                        _focus={{
                          borderColor: "blue.400",
                          boxShadow: "0 0 0 1px blue.400",
                        }}
                        _hover={{ borderColor: "gray.500" }}
                        size="sm"
                      />
                      <Text textStyle="xs" color="gray.400" mt={1}>
                        Get your API key from the Enspira dashboard or server configuration
                      </Text>
                    </Box>

                    {/* Connection Test */}
                    <Button
                      id="test-connection-btn"
                      size="sm"
                      bg="blue.600"
                      color="white"
                      _hover={{ bg: "blue.700" }}
                      onClick={testConnection}
                      width="100%"
                      isDisabled={!localWsUrl || !localApiKey}
                    >
                      🔌 Test Connection
                    </Button>
                  </VStack>
                </Box>

                <Separator borderColor="whiteAlpha.200" />

                {/* Display Settings */}
                <Box>
                  <Text
                    textStyle="md"
                    fontWeight="semibold"
                    mb={3}
                    color="green.300"
                  >
                    Display Settings
                  </Text>
                  <HStack justify="space-between">
                    <Text textStyle="sm">Show Subtitles</Text>
                    <Switch.Root
                      checked={showCaptions}
                      onCheckedChange={(details) =>
                        setShowCaptions(details.checked)
                      }
                      colorPalette="green"
                    >
                      <Switch.HiddenInput />
                      <Switch.Control />
                    </Switch.Root>
                  </HStack>
                </Box>

                <Separator borderColor="whiteAlpha.200" />

                {/* ADDED: Custom Expressions Section */}
                {hasCustomExpressionSupport() && (
                  <>
                    <Box>
                      <Text
                        textStyle="md"
                        fontWeight="semibold"
                        mb={3}
                        color="pink.300"
                      >
                        🎭 Custom Expressions
                      </Text>
                      
                      <VStack gap={4} align="stretch">
                        {/* Current Model Info */}
                        {live2dContext?.modelInfo && (
                          <Box
                            p={4}
                            bg="gray.700"
                            borderRadius="md"
                            border="1px solid"
                            borderColor="gray.600"
                          >
                            <Text textStyle="sm" color="gray.300" mb={2}>
                              Current Model:
                            </Text>
                            <HStack>
                              <Text textStyle="sm" fontWeight="medium">
                                {live2dContext.modelInfo.name || 'Unnamed Model'}
                              </Text>
                              {live2dContext.modelInfo.hasCDI3 && (
                                <Badge
                                  bg="purple.500"
                                  color="white"
                                  px={2}
                                  py={1}
                                  borderRadius="sm"
                                  fontSize="xs"
                                >
                                  CDI3 Enhanced
                                </Badge>
                              )}
                              {live2dContext.modelInfo.isLocal && (
                                <Badge
                                  bg="green.500"
                                  color="white"
                                  px={2}
                                  py={1}
                                  borderRadius="sm"
                                  fontSize="xs"
                                >
                                  Local
                                </Badge>
                              )}
                            </HStack>
                            
                            {live2dContext.modelInfo.hasCDI3 && (
                              <Text textStyle="xs" color="purple.300" mt={1}>
                                Enhanced with CDI3 parameter metadata for better expression mapping
                              </Text>
                            )}
                            
                            {/* Expression count display */}
                            {live2dContext.modelInfo.customExpressions && (
                              <Text textStyle="xs" color="gray.400" mt={2}>
                                {live2dContext.modelInfo.customExpressions.expressions.length} custom expressions configured
                              </Text>
                            )}
                          </Box>
                        )}

                        {/* Custom Expression Settings Button */}
                        <Button
                          size="sm"
                          bg="pink.600"
                          color="white"
                          _hover={{ bg: "pink.700" }}
                          onClick={() => setIsCustomExpressionsPanelOpen(true)}
                          width="100%"
                          isDisabled={!live2dContext?.modelInfo}
                        >
                          🎨 Manage Custom Expressions
                        </Button>
                        
                        {!live2dContext?.modelInfo && (
                          <Text textStyle="xs" color="gray.500" textAlign="center">
                            Load a model to configure custom expressions
                          </Text>
                        )}

                        {/* Quick actions */}
                        {live2dContext?.modelInfo && (
                          <Box
                            p={3}
                            bg="gray.700"
                            borderRadius="md"
                            border="1px solid"
                            borderColor="gray.600"
                          >
                            <Text textStyle="xs" color="gray.300" mb={2}>
                              Quick Actions:
                            </Text>
                            <VStack gap={1} align="stretch">
                              <Text textStyle="2xs" color="gray.400">
                                • Press E/Q to test expressions
                              </Text>
                              <Text textStyle="2xs" color="gray.400">
                                • Press T to start/stop auto-testing
                              </Text>
                              <Text textStyle="2xs" color="gray.400">
                                • Press Esc to reset expression
                              </Text>
                              <Text textStyle="2xs" color="gray.400">
                                • Press ? for all keybinds
                              </Text>
                            </VStack>
                          </Box>
                        )}
                      </VStack>
                    </Box>

                    <Separator borderColor="whiteAlpha.200" />
                  </>
                )}

                {/* Speech-to-Text Settings */}
                <Box>
                  <Text
                    textStyle="md"
                    fontWeight="semibold"
                    mb={3}
                    color="red.300"
                  >
                    Speech-to-Text (STT) Settings
                  </Text>
                  
                  <VStack gap={4} align="stretch">
                    {/* STT Provider Selection */}
                    <Box>
                      <Text textStyle="sm" color="gray.300" mb={2}>
                        STT Provider
                      </Text>
                      <NativeSelectRoot
                        size="sm"
                        variant="outline"
                        bg="gray.700"
                        borderColor="gray.600"
                        _hover={{ borderColor: "gray.500" }}
                        color="white"
                      >
                        <NativeSelectField
                          value={sttContext.settings.provider}
                          onChange={handleSTTProviderChange}
                          placeholder="Select STT Provider"
                        >
                          <option value="webapi">Web Speech API (Browser Native)</option>
                          <option value="local-whisper">Local Whisper</option>
                          <option value="remote-whisper">Remote Whisper (OpenAI API)</option>
                        </NativeSelectField>
                      </NativeSelectRoot>
                    </Box>

                    {/* Web Speech API Settings */}
                    {sttContext.settings.provider === 'webapi' && (
                      <Box
                        p={4}
                        bg="gray.700"
                        borderRadius="md"
                        border="1px solid"
                        borderColor="gray.600"
                      >
                        <HStack justify="space-between" mb={3}>
                          <Text textStyle="sm" fontWeight="medium">
                            Web Speech API Settings
                          </Text>
                          {getProviderStatusDisplay('webapi')}
                        </HStack>
                        
                        <VStack gap={3} align="stretch">
                          <Box>
                            <Text textStyle="xs" color="gray.300" mb={1}>
                              Language
                            </Text>
                            <NativeSelectRoot
                              size="xs"
                              variant="outline"
                              bg="gray.800"
                              borderColor="gray.600"
                              _hover={{ borderColor: "gray.500" }}
                              color="white"
                            >
                              <NativeSelectField
                                value={sttContext.settings.webapi.language}
                                onChange={(e) => updateWebAPISettings('language', e.target.value)}
                                fontSize="12px"
                              >
                                <option value="en-US">English (US)</option>
                                <option value="en-GB">English (UK)</option>
                                <option value="es-ES">Spanish</option>
                                <option value="fr-FR">French</option>
                                <option value="de-DE">German</option>
                                <option value="ja-JP">Japanese</option>
                                <option value="ko-KR">Korean</option>
                                <option value="zh-CN">Chinese (Simplified)</option>
                              </NativeSelectField>
                            </NativeSelectRoot>
                          </Box>

                          <HStack justify="space-between">
                            <Text textStyle="xs" color="gray.300">Continuous Recognition</Text>
                            <Switch.Root
                              checked={sttContext.settings.webapi.continuous}
                              onCheckedChange={(details) => updateWebAPISettings('continuous', details.checked)}
                              colorPalette="red"
                              size="sm"
                            >
                              <Switch.HiddenInput />
                              <Switch.Control />
                            </Switch.Root>
                          </HStack>

                          <HStack justify="space-between">
                            <Text textStyle="xs" color="gray.300">Interim Results</Text>
                            <Switch.Root
                              checked={sttContext.settings.webapi.interimResults}
                              onCheckedChange={(details) => updateWebAPISettings('interimResults', details.checked)}
                              colorPalette="red"
                              size="sm"
                            >
                              <Switch.HiddenInput />
                              <Switch.Control />
                            </Switch.Root>
                          </HStack>
                        </VStack>
                      </Box>
                    )}

                    {/* Local Whisper Settings */}
                    {sttContext.settings.provider === 'local-whisper' && (
                      <Box
                        p={4}
                        bg="gray.700"
                        borderRadius="md"
                        border="1px solid"
                        borderColor="gray.600"
                      >
                        <HStack justify="space-between" mb={3}>
                          <Text textStyle="sm" fontWeight="medium">
                            Local Whisper Settings
                          </Text>
                          {getProviderStatusDisplay('local-whisper')}
                        </HStack>
                        
                        <VStack gap={3} align="stretch">
                          <Box>
                            <Text textStyle="xs" color="gray.300" mb={1}>
                              Model
                            </Text>
                            {sttContext.availableModels.length === 0 ? (
                              <Box
                                p={3}
                                bg="yellow.900"
                                borderRadius="md"
                                border="1px solid"
                                borderColor="yellow.600"
                                mb={2}
                              >
                                <Text fontSize="xs" color="yellow.200" mb={1}>
                                  No Whisper models found
                                </Text>
                                <Text fontSize="2xs" color="yellow.300">
                                  Download models to Documents/Enspira/STT-Models/
                                </Text>
                              </Box>
                            ) : (
                              <NativeSelectRoot
                                size="xs"
                                variant="outline"
                                bg="gray.800"
                                borderColor="gray.600"
                                _hover={{ borderColor: "gray.500" }}
                                color="white"
                              >
                                <NativeSelectField
                                  value={sttContext.settings.localWhisper.modelName || ''}
                                  onChange={(e) => updateLocalWhisperSettings('modelName', e.target.value)}
                                  fontSize="12px"
                                  placeholder="Select a model..."
                                >
                                  <option value="">Select a model...</option>
                                  {sttContext.availableModels.map((model) => (
                                    <option key={model.name} value={model.name}>
                                      {model.name} ({model.size}) {model.supported ? '✓' : '⚠️'}
                                    </option>
                                  ))}
                                </NativeSelectField>
                              </NativeSelectRoot>
                            )}
                            
                            <HStack gap={2} mt={2}>
                              <Button
                                size="xs"
                                bg="blue.600"
                                color="white"
                                _hover={{ bg: "blue.700" }}
                                onClick={() => sttContext.refreshModels()}
                                flex={1}
                              >
                                🔄 Refresh Models
                              </Button>
                              <Button
                                size="xs"
                                bg="green.600"
                                color="white"
                                _hover={{ bg: "green.700" }}
                                onClick={() => window.whisperAPI.openWhisperModelsDirectory()}
                                flex={1}
                              >
                                📁 Open Models Folder
                              </Button>
                            </HStack>
                          </Box>

                          <Box>
                            <Text textStyle="xs" color="gray.300" mb={1}>
                              Language
                            </Text>
                            <NativeSelectRoot
                              size="xs"
                              variant="outline"
                              bg="gray.800"
                              borderColor="gray.600"
                              _hover={{ borderColor: "gray.500" }}
                              color="white"
                            >
                              <NativeSelectField
                                value={sttContext.settings.localWhisper.language}
                                onChange={(e) => updateLocalWhisperSettings('language', e.target.value)}
                                fontSize="12px"
                              >
                                <option value="auto">Auto-detect</option>
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="ja">Japanese</option>
                                <option value="ko">Korean</option>
                                <option value="zh">Chinese</option>
                              </NativeSelectField>
                            </NativeSelectRoot>
                          </Box>

                          <Box>
                            <Text textStyle="xs" color="gray.300" mb={1}>
                              Task
                            </Text>
                            <NativeSelectRoot
                              size="xs"
                              variant="outline"
                              bg="gray.800"
                              borderColor="gray.600"
                              _hover={{ borderColor: "gray.500" }}
                              color="white"
                            >
                              <NativeSelectField
                                value={sttContext.settings.localWhisper.task}
                                onChange={(e) => updateLocalWhisperSettings('task', e.target.value)}
                                fontSize="12px"
                              >
                                <option value="transcribe">Transcribe</option>
                                <option value="translate">Translate to English</option>
                              </NativeSelectField>
                            </NativeSelectRoot>
                          </Box>

                          <Box>
                            <Text textStyle="xs" color="gray.300" mb={1}>
                              Temperature: {sttContext.settings.localWhisper.temperature}
                            </Text>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={sttContext.settings.localWhisper.temperature}
                              onChange={(e) => updateLocalWhisperSettings('temperature', parseFloat(e.target.value))}
                              style={{
                                width: "100%",
                                accentColor: "#E53E3E",
                              }}
                            />
                          </Box>
                        </VStack>
                      </Box>
                    )}

                    {/* Remote Whisper Settings */}
                    {sttContext.settings.provider === 'remote-whisper' && (
                      <Box
                        p={4}
                        bg="gray.700"
                        borderRadius="md"
                        border="1px solid"
                        borderColor="gray.600"
                      >
                        <HStack justify="space-between" mb={3}>
                          <Text textStyle="sm" fontWeight="medium">
                            Remote Whisper Settings
                          </Text>
                          {getProviderStatusDisplay('remote-whisper')}
                        </HStack>
                        
                        <VStack gap={3} align="stretch">
                          <Box>
                            <Text textStyle="xs" color="gray.300" mb={1}>
                              API Endpoint
                            </Text>
                            <Input
                              value={sttContext.settings.remoteWhisper.endpoint}
                              onChange={(e) => updateRemoteWhisperSettings('endpoint', e.target.value)}
                              placeholder="https://api.openai.com"
                              bg="gray.800"
                              border="1px solid"
                              borderColor="gray.600"
                              size="xs"
                              fontSize="12px"
                            />
                          </Box>

                          <Box>
                            <Text textStyle="xs" color="gray.300" mb={1}>
                              API Key
                            </Text>
                            <Input
                              type="password"
                              value={sttContext.settings.remoteWhisper.apiKey}
                              onChange={(e) => updateRemoteWhisperSettings('apiKey', e.target.value)}
                              placeholder="sk-..."
                              bg="gray.800"
                              border="1px solid"
                              borderColor="gray.600"
                              size="xs"
                              fontSize="12px"
                            />
                          </Box>

                          <Box>
                            <Text textStyle="xs" color="gray.300" mb={1}>
                              Model
                            </Text>
                            <NativeSelectRoot
                              size="xs"
                              variant="outline"
                              bg="gray.800"
                              borderColor="gray.600"
                              _hover={{ borderColor: "gray.500" }}
                              color="white"
                            >
                              <NativeSelectField
                                value={sttContext.settings.remoteWhisper.model}
                                onChange={(e) => updateRemoteWhisperSettings('model', e.target.value)}
                                fontSize="12px"
                              >
                                <option value="whisper-1">whisper-1</option>
                              </NativeSelectField>
                            </NativeSelectRoot>
                          </Box>

                          <Box>
                            <Text textStyle="xs" color="gray.300" mb={1}>
                              Language
                            </Text>
                            <NativeSelectRoot
                              size="xs"
                              variant="outline"
                              bg="gray.800"
                              borderColor="gray.600"
                              _hover={{ borderColor: "gray.500" }}
                              color="white"
                            >
                              <NativeSelectField
                                value={sttContext.settings.remoteWhisper.language}
                                onChange={(e) => updateRemoteWhisperSettings('language', e.target.value)}
                                fontSize="12px"
                              >
                                <option value="auto">Auto-detect</option>
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="ja">Japanese</option>
                                <option value="ko">Korean</option>
                                <option value="zh">Chinese</option>
                              </NativeSelectField>
                            </NativeSelectRoot>
                          </Box>

                          <Box>
                            <Text textStyle="xs" color="gray.300" mb={1}>
                              Temperature: {sttContext.settings.remoteWhisper.temperature}
                            </Text>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={sttContext.settings.remoteWhisper.temperature}
                              onChange={(e) => updateRemoteWhisperSettings('temperature', parseFloat(e.target.value))}
                              style={{
                                width: "100%",
                                accentColor: "#E53E3E",
                              }}
                            />
                          </Box>
                        </VStack>
                      </Box>
                    )}

                    {/* STT Status Information */}
                    <Box
                      p={3}
                      bg="gray.700"
                      borderRadius="md"
                      border="1px solid"
                      borderColor="gray.600"
                    >
                      <Text textStyle="xs" color="gray.300" mb={2}>
                        STT Status
                      </Text>
                      <HStack justify="space-between">
                        <Text textStyle="2xs" color="gray.400">
                          Available Models: {sttContext.availableModels.length}
                        </Text>
                        <Text textStyle="2xs" color="gray.400">
                          {sttContext.isRecognizing ? '🎤 Recognizing...' : '⏸️ Idle'}
                        </Text>
                      </HStack>
                    </Box>
                  </VStack>
                </Box>

                <Separator borderColor="whiteAlpha.200" />

                {/* Audio Settings */}
                <Box>
                  <Text
                    textStyle="md"
                    fontWeight="semibold"
                    mb={3}
                    color="cyan.300"
                  >
                    Audio Settings
                  </Text>
                  
                  <VStack gap={4} align="stretch">
                    {/* Input Device Selection */}
                    <Box>
                      <Text textStyle="sm" color="gray.300" mb={2}>
                        Default Input Device (STT)
                      </Text>
                      <Box
                        p={3}
                        bg="gray.700"
                        borderRadius="md"
                        border="1px solid"
                        borderColor="gray.600"
                        mb={2}
                      >
                        <Text textStyle="xs" color="gray.400" mb={1}>
                          Current: {getDeviceLabel(selectedInputDevice, audioInputDevices)}
                        </Text>
                      </Box>
                      <NativeSelectRoot
                        size="sm"
                        variant="outline"
                        bg="gray.700"
                        borderColor="gray.600"
                        _hover={{ borderColor: "gray.500" }}
                        color="white"
                        mb={2}
                      >
                        <NativeSelectField
                          value={selectedInputDevice || 'default'}
                          onChange={(e) => setSelectedInputDevice(e.target.value)}
                        >
                          {audioInputDevices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label}
                            </option>
                          ))}
                        </NativeSelectField>
                      </NativeSelectRoot>
                      <Button
                        id="test-input-btn"
                        size="sm"
                        bg="cyan.600"
                        color="white"
                        _hover={{ bg: "cyan.700" }}
                        onClick={testInputDevice}
                        width="100%"
                      >
                        🎤 Test Input Device
                      </Button>
                    </Box>

                    {/* Output Device Selection */}
                    <Box>
                      <Text textStyle="sm" color="gray.300" mb={2}>
                        Default Output Device (TTS)
                      </Text>
                      <Box
                        p={3}
                        bg="gray.700"
                        borderRadius="md"
                        border="1px solid"
                        borderColor="gray.600"
                        mb={2}
                      >
                        <Text textStyle="xs" color="gray.400" mb={1}>
                          Current: {getDeviceLabel(selectedOutputDevice, audioOutputDevices)}
                        </Text>
                      </Box>
                      <NativeSelectRoot
                        size="sm"
                        variant="outline"
                        bg="gray.700"
                        borderColor="gray.600"
                        _hover={{ borderColor: "gray.500" }}
                        color="white"
                        mb={2}
                      >
                        <NativeSelectField
                          value={selectedOutputDevice || 'default'}
                          onChange={(e) => setSelectedOutputDevice(e.target.value)}
                        >
                          {audioOutputDevices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label}
                            </option>
                          ))}
                        </NativeSelectField>
                      </NativeSelectRoot>
                      <Button
                        id="test-output-btn"
                        size="sm"
                        bg="cyan.600"
                        color="white"
                        _hover={{ bg: "cyan.700" }}
                        onClick={testOutputDevice}
                        width="100%"
                      >
                        🔊 Test Output Device
                      </Button>
                    </Box>

                    {/* Refresh Devices Button */}
                    <Button
                      size="sm"
                      bg="cyan.600"
                      color="white"
                      _hover={{ bg: "cyan.700" }}
                      onClick={refreshAudioDevices}
                      width="100%"
                    >
                      🔄 Refresh Audio Devices
                    </Button>
                  </VStack>
                </Box>

                <Separator borderColor="whiteAlpha.200" />

                {/* Live2D Model Section */}
                <Box>
                  <Text
                    textStyle="md"
                    fontWeight="semibold"
                    mb={3}
                    color="green.300"
                  >
                    Live2D Model
                  </Text>

                  <Box
                    p={4}
                    bg="gray.700"
                    borderRadius="md"
                    border="1px solid"
                    borderColor="gray.600"
                    mb={3}
                  >
                    <Text textStyle="sm" color="gray.300" mb={2}>
                      Current Model:
                    </Text>
                    <HStack>
                      <Text textStyle="sm" fontWeight="medium">
                        {getCurrentModelDisplay()}
                      </Text>
                      {live2dContext?.isLocalModel && (
                        <Badge
                          bg="green.500"
                          color="white"
                          px={2}
                          py={1}
                          borderRadius="sm"
                          fontSize="xs"
                        >
                          Local
                        </Badge>
                      )}
                    </HStack>
                  </Box>

                  <VStack gap={3} align="stretch">
                    {live2dContext?.availableModels.length === 0 ? (
                      <Box
                        p={4}
                        bg="yellow.900"
                        borderRadius="md"
                        border="1px solid"
                        borderColor="yellow.600"
                      >
                        <Text fontSize="sm" color="yellow.200" mb={2}>
                          No models found in your models directory.
                        </Text>
                        <Text fontSize="xs" color="yellow.300">
                          Add Live2D model folders to your Documents/Enspira/Models
                          directory.
                        </Text>
                      </Box>
                    ) : (
                      <Box>
                        <Text fontSize="sm" color="gray.300" mb={2}>
                          Select Model:
                        </Text>
                        <NativeSelectRoot
                          size="sm"
                          variant="outline"
                          bg="gray.700"
                          borderColor="gray.600"
                          _hover={{ borderColor: "gray.500" }}
                          color="white"
                        >
                          <NativeSelectField
                            value={live2dContext?.selectedModelName || ""}
                            onChange={(e) => handleSelectModel(e.target.value)}
                            placeholder="Select a model..."
                          >
                            <option value="">Select a model...</option>
                            {live2dContext?.availableModels.map((model) => (
                              <option key={model.name} value={model.name}>
                                {model.name} {model.hasTextures ? "🎨" : ""}{" "}
                                {model.hasMotions ? "🎭" : ""}{" "}
                                {model.hasCDI3 ? "⭐" : ""}
                              </option>
                            ))}
                          </NativeSelectField>
                        </NativeSelectRoot>
                      </Box>
                    )}

                    <HStack gap={2}>
                      <Button
                        size="sm"
                        bg="green.600"
                        color="white"
                        _hover={{ bg: "green.700" }}
                        onClick={() => live2dContext?.openModelsDirectory()}
                        flex={1}
                      >
                        📁 Open Models Folder
                      </Button>

                      <Button
                        size="sm"
                        bg="blue.600"
                        color="white"
                        _hover={{ bg: "blue.700" }}
                        onClick={() => live2dContext?.refreshModels()}
                        flex={1}
                      >
                        🔄 Refresh
                      </Button>
                    </HStack>

                    {live2dContext?.selectedModelName && (
                      <Button
                        size="sm"
                        bg="red.600"
                        color="white"
                        _hover={{ bg: "red.700" }}
                        onClick={resetLocalModel}
                        width="100%"
                      >
                        ❌ Clear Selected Model
                      </Button>
                    )}
                  </VStack>
                </Box>

                <Separator borderColor="whiteAlpha.200" />

                {/* Background Section */}
                <Box>
                  <Text
                    textStyle="md"
                    fontWeight="semibold"
                    mb={3}
                    color="purple.300"
                  >
                    Background
                  </Text>

                  <HStack justify="space-between" mb={3}>
                    <Text textStyle="sm">Use Camera Background</Text>
                    <Switch.Root
                      checked={bgUrlContext?.useCameraBackground || false}
                      onCheckedChange={(details) =>
                        bgUrlContext?.setUseCameraBackground(details.checked)
                      }
                      colorPalette="purple"
                    >
                      <Switch.HiddenInput />
                      <Switch.Control />
                    </Switch.Root>
                  </HStack>

                  {!bgUrlContext?.useCameraBackground && (
                    <>
                      <Box
                        p={4}
                        bg="gray.700"
                        borderRadius="md"
                        border="1px solid"
                        borderColor="gray.600"
                        mb={3}
                      >
                        <Text textStyle="sm" color="gray.300" mb={2}>
                          Current Background:
                        </Text>
                        <HStack>
                          <Text textStyle="sm" fontWeight="medium">
                            {getCurrentBackgroundDisplay()}
                          </Text>
                          {bgUrlContext?.isLocalBackground && (
                            <Badge
                              bg="purple.500"
                              color="white"
                              px={2}
                              py={1}
                              borderRadius="sm"
                              fontSize="xs"
                            >
                              Local
                            </Badge>
                          )}
                        </HStack>
                      </Box>

                      <VStack gap={2} align="stretch">
                        <Button
                          size="sm"
                          bg="purple.600"
                          color="white"
                          _hover={{ bg: "purple.700" }}
                          onClick={handleSelectLocalBackground}
                          width="100%"
                        >
                          🖼️ Select Local Background Image
                        </Button>

                        {bgUrlContext?.isLocalBackground && (
                          <Button
                            size="sm"
                            bg="red.600"
                            color="white"
                            _hover={{ bg: "red.700" }}
                            onClick={resetLocalBackground}
                            width="100%"
                          >
                            ❌ Clear Local Background
                          </Button>
                        )}
                      </VStack>
                    </>
                  )}
                </Box>
              </VStack>
            </Box>

            {/* FIXED: Footer with flex-shrink to prevent compression */}
            <Box 
              borderTop="1px solid" 
              borderColor="whiteAlpha.200" 
              p={4}
              flexShrink={0}
            >
              <HStack gap={3} justify="flex-end">
                <Button variant="outline" onClick={onClose} colorPalette="gray">
                  Cancel
                </Button>
                <Button
                  bg="blue.600"
                  color="white"
                  _hover={{ bg: "blue.700" }}
                  onClick={handleSaveSettings}
                  isDisabled={!localWsUrl || !localApiKey || isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save & Close'}
                </Button>
              </HStack>
            </Box>
          </Box>
        </Box>
      </Portal>

      {/* ADDED: Custom Expression Settings Panel */}
      <CustomExpressionSettingsPanel
        isOpen={isCustomExpressionsPanelOpen}
        onClose={() => setIsCustomExpressionsPanelOpen(false)}
      />
    </>
  );
}

// Export the audio device manager hook for use in other components
export { useAudioDeviceManager };
export default SettingsModal;