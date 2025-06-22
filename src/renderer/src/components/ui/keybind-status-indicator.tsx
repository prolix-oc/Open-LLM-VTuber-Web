// src/renderer/src/components/ui/keybind-status-indicator.tsx
import { Box, HStack, VStack, Text, Badge, Tooltip, IconButton } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { FiEye, FiEyeOff, FiMouse, FiMousePointer, FiSmile, FiInfo, FiX } from 'react-icons/fi';
import { useAppKeybinds } from '@/hooks/utils/use-app-keybinds';

interface KeybindStatusIndicatorProps {
  /** Whether the indicator is visible by default */
  defaultVisible?: boolean;
  /** Position of the indicator */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Whether to show detailed tooltips */
  showTooltips?: boolean;
  /** Compact mode (smaller indicators) */
  compact?: boolean;
}

const statusIndicatorStyles = {
  container: (position: string, compact: boolean) => ({
    position: 'fixed' as const,
    zIndex: 1000,
    padding: compact ? '8px' : '12px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: '12px',
    border: '1px solid',
    borderColor: 'whiteAlpha.300',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
    cursor: 'default',
    userSelect: 'none',
    minWidth: compact ? '160px' : '200px',
    ...(position === 'top-left' && { top: '20px', left: '20px' }),
    ...(position === 'top-right' && { top: '20px', right: '20px' }),
    ...(position === 'bottom-left' && { bottom: '20px', left: '20px' }),
    ...(position === 'bottom-right' && { bottom: '20px', right: '20px' }),
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  title: {
    fontSize: 'sm',
    fontWeight: 'bold',
    color: 'white',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
    _last: { marginBottom: 0 },
  },
  statusLabel: (compact: boolean) => ({
    fontSize: compact ? 'xs' : 'sm',
    color: 'whiteAlpha.800',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  }),
  statusBadge: (active: boolean, compact: boolean) => ({
    size: compact ? 'sm' : 'md',
    colorScheme: active ? 'green' : 'gray',
    variant: 'solid',
  }),
  hideButton: {
    size: 'xs',
    variant: 'ghost',
    color: 'whiteAlpha.600',
    _hover: { color: 'white', backgroundColor: 'whiteAlpha.200' },
  },
  toggleButton: (visible: boolean) => ({
    position: 'fixed' as const,
    top: '20px',
    right: visible ? 'auto' : '20px',
    left: visible ? 'auto' : 'auto',
    zIndex: 999,
    size: 'sm',
    colorScheme: 'blue',
    variant: 'solid',
    borderRadius: 'full',
    opacity: visible ? 0 : 0.7,
    transition: 'all 0.3s ease',
    _hover: { opacity: 1 },
  }),
};

/**
 * Status indicator component that shows the current state of all keybind features
 * Provides at-a-glance information about UI visibility, cursor follow mode, and expression testing
 */
export const KeybindStatusIndicator = ({
  defaultVisible = false,
  position = 'top-right',
  showTooltips = true,
  compact = false,
}: KeybindStatusIndicatorProps) => {
  const [isVisible, setIsVisible] = useState(defaultVisible);
  const [featureStatus, setFeatureStatus] = useState({
    keybindsEnabled: false,
    uiVisible: true,
    cursorFollowEnabled: true,
    expressionsAvailable: false,
    expressionTestingActive: false,
    currentExpression: null,
  });

  // Get the keybind system (this will be available since it's in the context)
  const keybindSystem = useAppKeybinds({ enabled: false }); // Don't re-register keybinds

  // Update feature status periodically
  useEffect(() => {
    const updateStatus = () => {
      if (keybindSystem?.getFeatureStatus) {
        const status = keybindSystem.getFeatureStatus();
        setFeatureStatus(status);
      }
    };

    // Initial update
    updateStatus();

    // Update every 2 seconds
    const interval = setInterval(updateStatus, 2000);
    
    return () => clearInterval(interval);
  }, [keybindSystem]);

  const StatusIcon = ({ icon: Icon, active, label }: { icon: any; active: boolean; label: string }) => (
    <Box color={active ? 'green.400' : 'gray.400'} fontSize={compact ? 'sm' : 'md'}>
      <Icon />
    </Box>
  );

  const StatusRow = ({ icon, label, active, tooltip }: { 
    icon: any; 
    label: string; 
    active: boolean; 
    tooltip?: string; 
  }) => {
    const content = (
      <HStack {...statusIndicatorStyles.statusRow}>
        <Box {...statusIndicatorStyles.statusLabel(compact)}>
          <StatusIcon icon={icon} active={active} label={label} />
          <Text>{label}</Text>
        </Box>
        <Badge {...statusIndicatorStyles.statusBadge(active, compact)}>
          {active ? 'ON' : 'OFF'}
        </Badge>
      </HStack>
    );

    if (showTooltips && tooltip) {
      return (
        <Tooltip label={tooltip} placement="left" fontSize="xs">
          {content}
        </Tooltip>
      );
    }

    return content;
  };

  if (!isVisible) {
    return (
      <IconButton
        {...statusIndicatorStyles.toggleButton(false)}
        aria-label="Show keybind status"
        icon={<FiInfo />}
        onClick={() => setIsVisible(true)}
      />
    );
  }

  return (
    <Box {...statusIndicatorStyles.container(position, compact)}>
      <HStack {...statusIndicatorStyles.header}>
        <Text {...statusIndicatorStyles.title}>
          🎹 Keybind Status
        </Text>
        <IconButton
          {...statusIndicatorStyles.hideButton}
          aria-label="Hide status indicator"
          icon={<FiX />}
          onClick={() => setIsVisible(false)}
        />
      </HStack>

      <VStack gap={2} align="stretch">
        <StatusRow
          icon={featureStatus.uiVisible ? FiEye : FiEyeOff}
          label="UI Elements"
          active={featureStatus.uiVisible}
          tooltip="Alt+H to toggle UI visibility"
        />
        
        <StatusRow
          icon={featureStatus.cursorFollowEnabled ? FiMousePointer : FiMouse}
          label="Cursor Follow"
          active={featureStatus.cursorFollowEnabled}
          tooltip="Alt+F to toggle cursor follow/random look"
        />
        
        <StatusRow
          icon={FiSmile}
          label="Expressions"
          active={featureStatus.expressionsAvailable}
          tooltip="Alt+E for next, Alt+T for auto-test"
        />

        {featureStatus.expressionTestingActive && (
          <Box>
            <Text fontSize="xs" color="yellow.400" textAlign="center">
              Testing in progress...
            </Text>
          </Box>
        )}

        {featureStatus.currentExpression && (
          <Box>
            <Text fontSize="xs" color="cyan.400" textAlign="center">
              Current: {featureStatus.currentExpression.name}
            </Text>
          </Box>
        )}

        {!featureStatus.keybindsEnabled && (
          <Box>
            <Text fontSize="xs" color="red.400" textAlign="center">
              Keybinds Disabled
            </Text>
          </Box>
        )}
      </VStack>

      {compact && (
        <Text fontSize="xs" color="whiteAlpha.600" textAlign="center" mt={2}>
          F1 for help
        </Text>
      )}
    </Box>
  );
};

export default KeybindStatusIndicator;