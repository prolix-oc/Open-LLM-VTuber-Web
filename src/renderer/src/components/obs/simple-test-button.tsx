// src/renderer/src/components/obs/simple-test-button.tsx
// Simple version that ALWAYS shows up for testing

import { useState } from 'react';
import { Box, Button, Text, VStack, Portal } from '@chakra-ui/react';

export const SimpleTestOBSButton = (): JSX.Element => {
  const [showPanel, setShowPanel] = useState(false);

  console.log('🎥 SimpleTestOBSButton is rendering!');

  return (
    <>
      {/* Always Visible Test Button */}
      <Box
        position="fixed"
        top="20px"
        right="20px"
        zIndex={999}
        pointerEvents="auto"
      >
        <Button
          onClick={() => {
            console.log('🎥 Test button clicked!');
            setShowPanel(true);
          }}
          bg="orange.500"
          color="white"
          _hover={{ bg: "orange.600" }}
          size="sm"
          borderRadius="md"
        >
          🎥 OBS Test
        </Button>
      </Box>

      {/* Simple Test Panel */}
      {showPanel && (
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
            onClick={() => setShowPanel(false)}
          />

          {/* Panel */}
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="gray.800"
            color="white"
            p={6}
            borderRadius="lg"
            zIndex={1001}
            minWidth="400px"
            onClick={(e) => e.stopPropagation()}
          >
            <VStack gap={4}>
              <Text fontSize="xl" fontWeight="bold">
                🎥 OBS Test Panel
              </Text>
              
              <Text fontSize="sm" color="gray.300">
                This is a simple test to verify the OBS components are working.
              </Text>

              <Box p={4} bg="gray.700" borderRadius="md" width="100%">
                <Text fontSize="sm" fontWeight="medium" mb={2}>Debug Info:</Text>
                <Text fontSize="xs" color="green.300">
                  ✅ React component rendered successfully
                </Text>
                <Text fontSize="xs" color="green.300">
                  ✅ Chakra UI components working
                </Text>
                <Text fontSize="xs" color="green.300">
                  ✅ Portal rendering working
                </Text>
                <Text fontSize="xs" color="green.300">
                  ✅ Click events working
                </Text>
                <Text fontSize="xs" color={window.api ? "green.300" : "yellow.300"}>
                  {window.api ? "✅" : "⚠️"} window.api available: {window.api ? "Yes" : "No"}
                </Text>
                <Text fontSize="xs" color={window.api?.obsGetStatus ? "green.300" : "yellow.300"}>
                  {window.api?.obsGetStatus ? "✅" : "⚠️"} OBS API available: {window.api?.obsGetStatus ? "Yes" : "No"}
                </Text>
              </Box>

              <Button
                onClick={() => {
                  console.log('🧪 Full diagnostic info:', {
                    windowApi: !!window.api,
                    apiMethods: window.api ? Object.keys(window.api) : 'none',
                    obsGetStatus: !!window.api?.obsGetStatus,
                    userAgent: navigator.userAgent,
                    location: window.location.href
                  });
                  alert('Diagnostic info logged to console - check the browser developer tools!');
                }}
                colorScheme="blue"
                size="sm"
              >
                🔍 Run Full Diagnostic (Check Console)
              </Button>

              <Button
                onClick={() => setShowPanel(false)}
                variant="outline"
                size="sm"
              >
                Close
              </Button>
            </VStack>
          </Box>
        </Portal>
      )}
    </>
  );
};