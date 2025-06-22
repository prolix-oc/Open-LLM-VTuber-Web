import {
  Box,
  VStack,
  HStack,
  Text,
  Slider,
  NumberInput,
  Switch,
  Button,
  Card,
  Heading,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { memo } from 'react';
import { useASRSettings } from '@/hooks/sidebar/setting/use-asr-settings';
import { useVAD } from '@/context/vad-context';

interface ASRSettingsPanelProps {
  onSave?: () => void;
  onCancel?: () => void;
}

interface VoiceActivityThresholdProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  description?: string;
}

interface AutoStartSwitchProps {
  label: string;
  description: string;
  isChecked: boolean;
  onChange: (checked: boolean) => void;
  badge?: string;
  badgeColor?: string;
}

const VoiceActivityThreshold = memo(({ 
  label, 
  value, 
  onChange, 
  min = 0, 
  max = 100,
  description 
}: VoiceActivityThresholdProps) => (
  <Box>
    <HStack justify="space-between" mb={2}>
      <Text fontSize="sm" fontWeight="medium">{label}</Text>
      <NumberInput
        value={value}
        onChange={(_, valueAsNumber) => onChange(valueAsNumber)}
        min={min}
        max={max}
        size="sm"
        width="80px"
      >
        <NumberInput.Field />
      </NumberInput>
    </HStack>
    <Slider
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={1}
      colorScheme="blue"
    >
      <Slider.Track>
        <Slider.FilledTrack />
      </Slider.Track>
      <Slider.Thumb />
    </Slider>
    {description && (
      <Text fontSize="xs" color="gray.400" mt={1}>
        {description}
      </Text>
    )}
  </Box>
));

VoiceActivityThreshold.displayName = 'VoiceActivityThreshold';

const AutoStartSwitch = memo(({ 
  label, 
  description, 
  isChecked, 
  onChange, 
  badge,
  badgeColor = "blue"
}: AutoStartSwitchProps) => (
  <HStack justify="space-between" align="flex-start">
    <Box flex={1}>
      <HStack mb={1}>
        <Text fontSize="sm" fontWeight="medium">{label}</Text>
        {badge && (
          <Badge colorScheme={badgeColor} size="sm" variant="subtle">
            {badge}
          </Badge>
        )}
      </HStack>
      <Text fontSize="xs" color="gray.400" lineHeight="short">
        {description}
      </Text>
    </Box>
    <Switch
      isChecked={isChecked}
      onChange={(e) => onChange(e.target.checked)}
      colorScheme="blue"
      size="sm"
    />
  </HStack>
));

AutoStartSwitch.displayName = 'AutoStartSwitch';

function ASRSettingsPanel({ onSave, onCancel }: ASRSettingsPanelProps): JSX.Element {
  const {
    localSettings,
    autoStartOnInit,
    setAutoStartOnInit,
    handleInputChange,
    handleSave,
    handleCancel,
  } = useASRSettings();

  const { micOn, isTranscribing, transcriptionStatus } = useVAD();

  const handleSaveClick = () => {
    handleSave();
    onSave?.();
  };

  const handleCancelClick = () => {
    handleCancel();
    onCancel?.();
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Status Alert */}
      <Alert status={micOn ? "success" : "info"} variant="subtle" borderRadius="md">
        <AlertIcon />
        <Box flex={1}>
          <AlertTitle fontSize="sm">
            {micOn ? "🎤 Always Listening Active" : "🎤 Microphone Off"}
          </AlertTitle>
          <AlertDescription fontSize="xs">
            {micOn 
              ? "Real-time speech detection is running continuously. Just start speaking!" 
              : "Click the microphone button to enable always-listening speech detection."
            }
          </AlertDescription>
        </Box>
      </Alert>

      {/* Voice Activity Detection Settings */}
      <Card>
        <Card.Header>
          <Heading size="sm">Voice Activity Detection</Heading>
        </Card.Header>
        <Card.Body>
          <VStack spacing={4}>
            <VoiceActivityThreshold
              label="Speech Detection Threshold"
              value={localSettings.positiveSpeechThreshold}
              onChange={(value) => handleInputChange('positiveSpeechThreshold', value)}
              description="Sensitivity for detecting when speech starts (higher = less sensitive)"
            />
            
            <VoiceActivityThreshold
              label="Silence Detection Threshold"
              value={localSettings.negativeSpeechThreshold}
              onChange={(value) => handleInputChange('negativeSpeechThreshold', value)}
              description="Sensitivity for detecting when speech ends (lower = more sensitive)"
            />
            
            <VoiceActivityThreshold
              label="Redemption Frames"
              value={localSettings.redemptionFrames}
              onChange={(value) => handleInputChange('redemptionFrames', value)}
              min={1}
              max={100}
              description="Number of frames to wait before confirming speech has ended"
            />
          </VStack>
        </Card.Body>
      </Card>

      {/* Simplified Auto-Start Settings */}
      <Card>
        <Card.Header>
          <HStack justify="space-between">
            <Heading size="sm">Startup Behavior</Heading>
            <Badge colorScheme="green" variant="subtle">Simplified</Badge>
          </HStack>
        </Card.Header>
        <Card.Body>
          <AutoStartSwitch
            label="Auto-Start on App Launch"
            description="Automatically enable always-listening speech detection when the application starts and connects to the server. Once enabled, the microphone stays active until you manually turn it off."
            isChecked={autoStartOnInit}
            onChange={setAutoStartOnInit}
            badge="ONLY AUTO-START"
            badgeColor="blue"
          />
        </Card.Body>
      </Card>

      {/* Real-time Status */}
      {(isTranscribing || transcriptionStatus !== 'idle') && (
        <Alert status="info" variant="subtle" borderRadius="md">
          <AlertIcon />
          <Box flex={1}>
            <AlertTitle fontSize="sm">Processing Status</AlertTitle>
            <AlertDescription fontSize="xs">
              {isTranscribing && "🔊 Transcribing audio..."}
              {transcriptionStatus === 'processing' && "⚙️ Processing speech..."}
              {transcriptionStatus === 'complete' && "✅ Transcription complete"}
              {transcriptionStatus === 'error' && "❌ Transcription failed"}
            </AlertDescription>
          </Box>
        </Alert>
      )}

      {/* Action Buttons */}
      <HStack justify="flex-end" spacing={3}>
        <Button 
          variant="outline" 
          onClick={handleCancelClick}
          size="sm"
        >
          Cancel
        </Button>
        <Button 
          colorScheme="blue" 
          onClick={handleSaveClick}
          size="sm"
        >
          Save Changes
        </Button>
      </HStack>

      {/* Simplified Tips Card */}
      <Card variant="subtle">
        <Card.Body>
          <VStack align="flex-start" spacing={2}>
            <Text fontSize="sm" fontWeight="medium" color="blue.300">
              💡 Always-Listening Speech Detection
            </Text>
            <VStack align="flex-start" spacing={1} fontSize="xs" color="gray.400">
              <Text>• <strong>Simple Control:</strong> Microphone button toggles speech detection on/off</Text>
              <Text>• <strong>Always Listening:</strong> When enabled, VAD runs continuously until you disable it</Text>
              <Text>• <strong>Seamless Conversation:</strong> Speak, wait for AI response, then speak again immediately</Text>
              <Text>• <strong>No Complex Auto-Restart:</strong> You control when speech detection is active</Text>
              <Text>• <strong>Auto-Start Optional:</strong> Can automatically enable when app starts</Text>
            </VStack>
          </VStack>
        </Card.Body>
      </Card>
    </VStack>
  );
}

export default memo(ASRSettingsPanel);