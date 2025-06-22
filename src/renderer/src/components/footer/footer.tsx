import {
  Box, Textarea, IconButton, HStack, Grid,
} from '@chakra-ui/react';
import { BsMicFill, BsMicMuteFill } from 'react-icons/bs';
import { IoHandRightSharp, IoSettingsSharp } from 'react-icons/io5';
import { FiChevronDown } from 'react-icons/fi';
import { MdSubtitles, MdSubtitlesOff } from 'react-icons/md';
import { memo } from 'react';
import { InputGroup } from '@/components/ui/input-group';
import AIStateIndicator from './ai-state-indicator';
import { useFooter } from '@/hooks/footer/use-footer';
import { useSettingsModal } from '@/hooks/utils/use-settings-modal';
import { useSubtitle } from '@/context/subtitle-context';
import SettingsModal from '@/components/ui/settings-modal';
import { useSendText } from '@/hooks/utils/use-send-text';
const footerStyles = {
  footer: {
    container: (isCollapsed: boolean) => ({
      position: 'relative' as const,
      width: '100%',
      bg: 'gray.800',
      borderTop: '1px solid',
      borderColor: 'whiteAlpha.200',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      height: isCollapsed ? '24px' : '186px',
      overflow: 'hidden',
    }),
    toggleButton: {
      position: 'absolute' as const,
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '60px',
      height: '24px',
      bg: 'whiteAlpha.100',
      _hover: { bg: 'whiteAlpha.200' },
      borderTopRadius: 'md',
      borderBottomRadius: 0,
      zIndex: 10,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 'sm',
      transition: 'all 0.2s',
    },
    actionButton: {
      size: 'md',
      variant: 'solid',
      borderRadius: 'full',
      width: '44px',
      height: '44px',
      _hover: { transform: 'scale(1.05)' },
      transition: 'all 0.2s',
    },
    input: {
      bg: 'gray.700',
      border: '1px solid',
      borderColor: 'whiteAlpha.300',
      _focus: {
        borderColor: 'blue.400',
        boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)',
      },
      _hover: { borderColor: 'whiteAlpha.400' },
      color: 'white',
      placeholder: { color: 'whiteAlpha.600' },
      resize: 'none',
      paddingY: '12px',
      paddingX: '16px',
      fontSize: 'sm',
      lineHeight: 'base',
      borderRadius: '12px',
    },
  },
} as const;

interface FooterProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

interface ToggleButtonProps {
  isCollapsed: boolean;
  onToggle?: () => void;
}

interface ActionButtonsProps {
  micOn: boolean;
  onMicToggle: () => void;
  onInterrupt: () => void;
  showCaptions: boolean;
  onToggleCaptions: () => void;
  onOpenSettings: () => void;
}

interface MessageInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
}

const ToggleButton = memo(({ isCollapsed, onToggle }: ToggleButtonProps) => (
  <Box
    {...footerStyles.footer.toggleButton}
    onClick={onToggle}
    color="whiteAlpha.500"
    style={{
      transform: `translateX(-50%) ${isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)'}`,
    }}
  >
    <FiChevronDown />
  </Box>
));

ToggleButton.displayName = 'ToggleButton';

const ActionButtons = memo(({ 
  micOn, 
  onMicToggle, 
  onInterrupt, 
  showCaptions, 
  onToggleCaptions,
  onOpenSettings 
}: ActionButtonsProps) => (
  <Box minWidth="100px" height="100%" display="flex" flexDirection="column">
    <Box mb={3}>
      <AIStateIndicator />
    </Box>
    <Grid templateColumns="repeat(2, 1fr)" gap={2} width="100px" flex={1} alignItems="center">
      <IconButton
        bg={micOn ? 'green.500' : 'red.500'}
        {...footerStyles.footer.actionButton}
        onClick={onMicToggle}
        aria-label={micOn ? 'Turn off microphone' : 'Turn on microphone'}
      >
        {micOn ? <BsMicFill /> : <BsMicMuteFill />}
      </IconButton>
      <IconButton
        aria-label="Interrupt AI"
        bg="yellow.500"
        {...footerStyles.footer.actionButton}
        onClick={onInterrupt}
      >
        <IoHandRightSharp size="20" />
      </IconButton>
      <IconButton
        bg={showCaptions ? 'blue.500' : 'gray.500'}
        {...footerStyles.footer.actionButton}
        onClick={onToggleCaptions}
        aria-label={showCaptions ? 'Hide captions' : 'Show captions'}
      >
        {showCaptions ? <MdSubtitles size="20" /> : <MdSubtitlesOff size="20" />}
      </IconButton>
      <IconButton
        bg="purple.500"
        {...footerStyles.footer.actionButton}
        onClick={onOpenSettings}
        aria-label="Open settings"
      >
        <IoSettingsSharp size="20" />
      </IconButton>
    </Grid>
  </Box>
));

ActionButtons.displayName = 'ActionButtons';

const MessageInput = memo(({
  value,
  onChange,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
}: MessageInputProps) => (
  <InputGroup width="100%" height="100%">
    <Textarea
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onCompositionStart={onCompositionStart}
      onCompositionEnd={onCompositionEnd}
      placeholder="Type your message..."
      width="100%"
      height="100%"
      {...footerStyles.footer.input}
    />
  </InputGroup>
));

MessageInput.displayName = 'MessageInput';

function Footer({ isCollapsed = false, onToggle }: FooterProps): JSX.Element {
  const {
    inputValue,
    handleInputChange,
    handleKeyPress,
    handleCompositionStart,
    handleCompositionEnd,
    handleInterrupt,
    handleMicToggle,
    micOn,
  } = useFooter();

  const { isOpen, openSettings, closeSettings } = useSettingsModal();
  
  // Add the missing subtitle context import
  const { showCaptions, toggleCaptions } = useSubtitle();

  return (
    <>
      <Box {...footerStyles.footer.container(isCollapsed)}>
        <ToggleButton isCollapsed={isCollapsed} onToggle={onToggle} />

        <Box pt="32px" px="4" pb="4" height="calc(100% - 24px)">
          <HStack width="100%" gap={4} align="flex-start" height="100%">
            <ActionButtons
              micOn={micOn}
              onMicToggle={handleMicToggle}
              onInterrupt={handleInterrupt}
              showCaptions={showCaptions}
              onToggleCaptions={toggleCaptions}
              onOpenSettings={openSettings}
            />

            <Box flex={1} height="100%" display="flex" flexDirection="column">
              <MessageInput
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
              />
            </Box>
          </HStack>
        </Box>
      </Box>

      <SettingsModal isOpen={isOpen} onClose={closeSettings} />
    </>
  );
}

export default Footer;