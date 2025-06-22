import { Box, Image } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { canvasStyles } from './canvas-styles';
import { useBgUrl } from '@/context/bgurl-context';

const Background = memo(({ children }: { children?: React.ReactNode }) => {
  const { backgroundUrl, isLocalBackground, localBackgroundPath } = useBgUrl();
  const [imageError, setImageError] = useState(false);
  const [imageSrc, setImageSrc] = useState(backgroundUrl);

  // Handle local file loading
  useEffect(() => {
    const loadLocalBackground = async () => {
      if (isLocalBackground && localBackgroundPath) {
        try {
          // Create blob URL for local file
          const blobUrl = await (window.api as any)?.createFileBlob?.(localBackgroundPath);
          if (blobUrl) {
            setImageSrc(blobUrl);
            setImageError(false);
          } else {
            console.error('Failed to create blob URL for local background');
            setImageError(true);
          }
        } catch (error) {
          console.error('Error loading local background:', error);
          setImageError(true);
        }
      } else {
        // Use the provided background URL for remote files
        setImageSrc(backgroundUrl);
        setImageError(false);
      }
    };

    loadLocalBackground();
  }, [backgroundUrl, isLocalBackground, localBackgroundPath]);

  const handleImageError = () => {
    console.error('Failed to load background image:', imageSrc);
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageError(false);
  };

  return (
    <Box {...canvasStyles.background.container}>
      {!imageError ? (
        <Image
          {...canvasStyles.background.image}
          src={imageSrc}
          alt="background"
          onError={handleImageError}
          onLoad={handleImageLoad}
          loading="lazy"
          fallback={
            <Box
              {...canvasStyles.background.image}
              bg="gray.100"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color="gray.500"
              fontSize="sm"
            >
              Loading background...
            </Box>
          }
        />
      ) : (
        <Box
          {...canvasStyles.background.image}
          bg="gray.800"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="gray.400"
          fontSize="sm"
        >
          {isLocalBackground 
            ? `Failed to load local background: ${localBackgroundPath?.split(/[/\\]/).pop() || 'Unknown file'}`
            : 'Failed to load background image'
          }
        </Box>
      )}
      {children}
    </Box>
  );
});

Background.displayName = 'Background';

export default Background;