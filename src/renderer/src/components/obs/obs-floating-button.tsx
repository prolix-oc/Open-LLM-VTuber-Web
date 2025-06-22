// src/renderer/src/components/obs/obs-floating-button.tsx - UPDATED VERSION
import { useState, useEffect } from 'react';
import { IconButton, Box, Tooltip } from '@chakra-ui/react';
import { Video, VideoOff, Monitor, Cast, Globe } from 'lucide-react';
import { EnhancedOBSSettingsPanel } from './enhanced-obs-settings-panel';
import { useOBSPetMode } from '@/hooks/utils/use-obs-pet-mode';

export const OBSFloatingButton = (): JSX.Element => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { captureMode, isActive } = useOBSPetMode();

  // Get the appropriate icon based on capture mode
  const getIcon = () => {
    if (!isActive) return <VideoOff size={18} />;
    
    switch (captureMode) {
      case 'pet-window':
        return <Monitor size={18} />;
      case 'canvas-stream':
        return <Cast size={18} />;
      case 'browser-source':
        return <Globe size={18} />;
      default:
        return <Video size={18} />;
    }
  };

  // Get the appropriate color scheme based on capture mode
  const getColorScheme = () => {
    if (!isActive) return { bg: "gray.700", borderColor: "gray.600", hoverBg: "gray.600" };
    
    switch (captureMode) {
      case 'pet-window':
        return { bg: "green.600", borderColor: "green.500", hoverBg: "green.700" };
      case 'canvas-stream':
        return { bg: "blue.600", borderColor: "blue.500", hoverBg: "blue.700" };
      case 'browser-source':
        return { bg: "purple.600", borderColor: "purple.500", hoverBg: "purple.700" };
      default:
        return { bg: "orange.600", borderColor: "orange.500", hoverBg: "orange.700" };
    }
  };

  // Get tooltip text based on current state
  const getTooltipText = () => {
    if (!isActive) return "OBS Integration - Click to configure";
    
    switch (captureMode) {
      case 'pet-window':
        return "Pet Window Capture Active - Use Window Capture in OBS";
      case 'canvas-stream':
        return "Canvas Stream Active - Stream URL available";
      case 'browser-source':
        return "Browser Source Active - URL ready for OBS";
      default:
        return "OBS Capture Active - Click to manage";
    }
  };

  const openPanel = () => {
    console.log('🎥 OBS Button clicked - opening enhanced panel');
    setIsPanelOpen(true);
  };
  
  const closePanel = () => {
    console.log('🎥 Enhanced OBS Panel closed');
    setIsPanelOpen(false);
  };

  const colors = getColorScheme();

  return (
    <>
      {/* Floating Button */}
      <Box
        position="fixed"
        top={4}
        right={4}
        zIndex={998} // Below panel but above other content
        pointerEvents="auto"
      >
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <IconButton
              aria-label="OBS Integration"
              onClick={openPanel}
              variant="solid"
              bg={colors.bg}
              color="white"
              _hover={{
                bg: colors.hoverBg,
                transform: "scale(1.05)"
              }}
              _active={{
                transform: "scale(0.95)"
              }}
              borderRadius="full"
              size="md"
              boxShadow="lg"
              transition="all 0.2s ease-in-out"
              border="2px solid"
              borderColor={colors.borderColor}
            >
              {getIcon()}
            </IconButton>
          </Tooltip.Trigger>
          <Tooltip.Content 
            side="left" 
            bg="gray.800" 
            color="white" 
            p={2} 
            borderRadius="md"
            fontSize="sm"
            maxWidth="250px"
            textAlign="center"
          >
            <Tooltip.Arrow bg="gray.800" />
            {getTooltipText()}
          </Tooltip.Content>
        </Tooltip.Root>
      </Box>

      {/* Enhanced OBS Settings Panel */}
      <EnhancedOBSSettingsPanel 
        isOpen={isPanelOpen} 
        onClose={closePanel} 
      />
    </>
  );
};