// src/renderer/src/components/debug/pet-mode-debug-panel.tsx
import { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Code,
  Portal,
  IconButton,
  Separator
} from '@chakra-ui/react';
import { Bug, X, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useDirectPetMode } from '@/hooks/utils/use-direct-pet-mode';

interface PetModeDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PetModeDebugPanel = ({ isOpen, onClose }: PetModeDebugPanelProps): JSX.Element => {
  const {
    testMode,
    debugInfo,
    triggerReactModeChange,
    checkLive2DVisibility,
    performFullTest,
    clearDebugInfo
  } = useDirectPetMode();

  const [autoRefresh, setAutoRefresh] = useState(false);

  // Auto-refresh Live2D status
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      checkLive2DVisibility();
    }, 2000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, checkLive2DVisibility]);

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
        zIndex={1002}
        onClick={onClose}
      />

      {/* Debug Panel */}
      <Box
        position="fixed"
        top="10px"
        left="10px"
        bg="gray.900"
        color="white"
        borderRadius="lg"
        boxShadow="2xl"
        border="1px solid"
        borderColor="yellow.500"
        width="400px"
        maxHeight="90vh"
        zIndex={1003}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box 
          borderBottom="1px solid" 
          borderColor="yellow.500" 
          p={4}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          bg="yellow.900"
        >
          <HStack>
            <Bug size={20} color="#f59e0b" />
            <Text fontSize="lg" fontWeight="bold" color="yellow.300">
              Pet Mode Debug
            </Text>
            <Badge colorScheme={testMode === 'pet' ? 'green' : 'gray'} variant="solid">
              {testMode.toUpperCase()}
            </Badge>
          </HStack>
          
          <IconButton
            aria-label="Close Debug Panel"
            variant="ghost"
            onClick={onClose}
            color="yellow.300"
            _hover={{ color: "white", bg: "yellow.800" }}
          >
            <X size={20} />
          </IconButton>
        </Box>

        {/* Body */}
        <Box overflowY="auto" p={4} maxHeight="70vh">
          <VStack gap={4} align="stretch">
            {/* Controls */}
            <VStack gap={3} align="stretch">
              <Text fontSize="md" fontWeight="bold" color="yellow.300">
                Test Controls
              </Text>
              
              <HStack gap={2}>
                <Button
                  onClick={() => triggerReactModeChange('pet')}
                  colorScheme="green"
                  size="sm"
                  variant={testMode === 'pet' ? 'solid' : 'outline'}
                  flex={1}
                >
                  Enable Pet Mode
                </Button>
                <Button
                  onClick={() => triggerReactModeChange('window')}
                  colorScheme="blue"
                  size="sm"
                  variant={testMode === 'window' ? 'solid' : 'outline'}
                  flex={1}
                >
                  Window Mode
                </Button>
              </HStack>

              <HStack gap={2}>
                <Button
                  onClick={checkLive2DVisibility}
                  leftIcon={<Eye size={16} />}
                  variant="outline"
                  size="sm"
                  flex={1}
                >
                  Check Live2D
                </Button>
                <Button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  leftIcon={autoRefresh ? <EyeOff size={16} /> : <RefreshCw size={16} />}
                  variant="outline"
                  size="sm"
                  colorScheme={autoRefresh ? 'green' : 'gray'}
                  flex={1}
                >
                  {autoRefresh ? 'Stop Auto' : 'Auto Check'}
                </Button>
              </HStack>

              <Button
                onClick={performFullTest}
                colorScheme="purple"
                size="sm"
                width="100%"
              >
                🧪 Run Full Test Sequence
              </Button>
            </VStack>

            <Separator borderColor="gray.600" />

            {/* Current Status */}
            <VStack gap={2} align="stretch">
              <Text fontSize="md" fontWeight="bold" color="yellow.300">
                Current Status
              </Text>
              
              <Box p={3} bg="gray.800" borderRadius="md" fontSize="xs">
                <VStack gap={1} align="start">
                  <Text>
                    <strong>Mode:</strong> <Badge colorScheme={testMode === 'pet' ? 'green' : 'blue'}>{testMode}</Badge>
                  </Text>
                  <Text>
                    <strong>Canvas:</strong> {document.querySelector('#canvas') ? '✅ Found' : '❌ Not Found'}
                  </Text>
                  <Text>
                    <strong>Body Classes:</strong> {Array.from(document.body.classList).join(', ') || 'none'}
                  </Text>
                  <Text>
                    <strong>Window Size:</strong> {window.innerWidth}x{window.innerHeight}
                  </Text>
                </VStack>
              </Box>
            </VStack>

            <Separator borderColor="gray.600" />

            {/* Debug Log */}
            <VStack gap={2} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="md" fontWeight="bold" color="yellow.300">
                  Debug Log
                </Text>
                <Button onClick={clearDebugInfo} size="xs" variant="ghost">
                  Clear
                </Button>
              </HStack>
              
              <Box 
                p={3} 
                bg="gray.800" 
                borderRadius="md" 
                maxHeight="200px" 
                overflowY="auto"
                border="1px solid"
                borderColor="gray.600"
              >
                {debugInfo.length === 0 ? (
                  <Text fontSize="xs" color="gray.400" fontStyle="italic">
                    No debug info yet. Try running a test.
                  </Text>
                ) : (
                  <VStack gap={1} align="start">
                    {debugInfo.map((info, index) => (
                      <Code 
                        key={index}
                        fontSize="xs" 
                        p={1} 
                        bg="gray.700" 
                        color="green.300" 
                        borderRadius="sm"
                        width="100%"
                        display="block"
                      >
                        {info}
                      </Code>
                    ))}
                  </VStack>
                )}
              </Box>
            </VStack>

            {/* Instructions */}
            <VStack gap={2} align="stretch">
              <Text fontSize="md" fontWeight="bold" color="yellow.300">
                Instructions
              </Text>
              
              <Box p={3} bg="blue.900" borderRadius="md" border="1px solid" borderColor="blue.500">
                <VStack gap={2} align="start" fontSize="xs">
                  <Text>
                    <strong>1.</strong> Click "Enable Pet Mode" to test React mode switching
                  </Text>
                  <Text>
                    <strong>2.</strong> Check if Live2D canvas is visible and rendering
                  </Text>
                  <Text>
                    <strong>3.</strong> If pet mode works here, the issue is in the window management
                  </Text>
                  <Text>
                    <strong>4.</strong> Use "Run Full Test" to see the complete flow
                  </Text>
                </VStack>
              </Box>
            </VStack>
          </VStack>
        </Box>
      </Box>
    </Portal>
  );
};

// Quick Debug Button Component
export const PetModeDebugButton = (): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Box
        position="fixed"
        top="60px"
        right="4px"
        zIndex={997}
        pointerEvents="auto"
      >
        <IconButton
          aria-label="Pet Mode Debug"
          onClick={() => setIsOpen(true)}
          variant="solid"
          bg="yellow.600"
          color="white"
          _hover={{ bg: "yellow.700", transform: "scale(1.05)" }}
          borderRadius="full"
          size="sm"
          boxShadow="lg"
        >
          <Bug size={16} />
        </IconButton>
      </Box>

      <PetModeDebugPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};