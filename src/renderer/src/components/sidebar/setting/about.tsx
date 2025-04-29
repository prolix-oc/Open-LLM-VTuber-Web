import { 
  Box, 
  Stack, 
  Text, 
  Heading, 
  HStack,
  Icon,
  VStack
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { FaGithub, FaBook } from 'react-icons/fa';
import { settingStyles } from './setting-styles';
import { Button } from '@/components/ui/button';

function About(): JSX.Element {
  const { t } = useTranslation();
  
  const openExternalLink = (url: string) => {
    // Handle external link opening via electron
    window.open(url, '_blank');
  };
  
  const appVersion = '1.2.0';
  // const appAuthor = 'Open LLM VTuber Team';

  return (
    <Stack {...settingStyles.common.container} gap={3}>
      <Heading size="md" mb={1}>{t('settings.about.title')}</Heading>
      <Box>
        <Text fontWeight="bold" mb={0}>{t('settings.about.version')}</Text>
        <Text>{appVersion}</Text>
      </Box>
      {/* <Box mt={1}>
        <Text fontWeight="bold" mb={0}>{t('Author')}</Text>
        <Text>{appAuthor}</Text>
      </Box> */}
      <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={2} mt={1} />
      <Box mt={1}>
        <Text fontWeight="bold" mb={1}>{t('settings.about.projectLinks')}</Text>
        <HStack mt={1} gap={2}>
          <Button
            size="sm"
            onClick={() => openExternalLink('https://github.com/Open-LLM-VTuber/Open-LLM-VTuber-Web')}
          >
            <Icon as={FaGithub} mr={2} /> {t('settings.about.github')}
          </Button>
          <Button
            size="sm"
            onClick={() => openExternalLink('https://docs.llmvtuber.com')}
          >
            <Icon as={FaBook} mr={2} /> {t('settings.about.documentation')}
          </Button>
        </HStack>
      </Box>
      <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={2} mt={1} />
      <Box mt={1}>
        <Text fontWeight="bold" mb={1}>{t('settings.about.license')}</Text>
        <VStack align="flex-start" gap={1}>
          <Text>
            <strong>{t('settings.about.frontend')}:</strong> {t('settings.about.nonCommercial')} (EULA)
          </Text>
          <Text>
            <strong>{t('settings.about.backend')}:</strong> MIT License
          </Text>
        </VStack>
      </Box>
      <Box mt={1}>
        <Text fontWeight="bold" mb={0}>{t('settings.about.copyright')}</Text>
        <Text>© {new Date().getFullYear()} Open LLM VTuber Team</Text>
      </Box>
    </Stack>
  );
}

export default About;
