// src/renderer/src/hooks/utils/use-obs-canvas-streaming.ts
import { useEffect, useRef, useCallback } from 'react';
import { useLive2DModel } from '@/context/live2d-model-context';

interface OBSCanvasStreamingOptions {
  enabled: boolean;
  frameRate?: number;
  quality?: number;
}

/**
 * Hook that efficiently streams the Live2D canvas to OBS without double-rendering
 * Uses the existing Live2D context and pet mode infrastructure
 */
export const useOBSCanvasStreaming = (options: OBSCanvasStreamingOptions = { enabled: false }) => {
  const { currentModel } = useLive2DModel();
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isStreamingRef = useRef<boolean>(false);

  /**
   * Get the Live2D canvas from the DOM
   * This works for both window mode and pet mode
   */
  const getLive2DCanvas = useCallback((): HTMLCanvasElement | null => {
    // Try to find the Live2D canvas in the DOM
    const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
    if (canvas) {
      canvasRef.current = canvas;
      return canvas;
    }
    return null;
  }, []);

  /**
   * Create a media stream from the Live2D canvas
   */
  const createCanvasStream = useCallback((canvas: HTMLCanvasElement): MediaStream | null => {
    try {
      const frameRate = options.frameRate || 30;
      
      // Create stream from canvas
      const stream = canvas.captureStream(frameRate);
      
      if (stream && stream.getVideoTracks().length > 0) {
        console.log(`✅ Canvas stream created: ${frameRate}fps`);
        return stream;
      } else {
        console.error('❌ Failed to create canvas stream - no video tracks');
        return null;
      }
    } catch (error) {
      console.error('❌ Error creating canvas stream:', error);
      return null;
    }
  }, [options.frameRate]);

  /**
   * Start streaming the Live2D canvas to OBS
   */
  const startStreaming = useCallback(async () => {
    if (isStreamingRef.current) {
      console.log('🎥 Canvas streaming already active');
      return streamRef.current;
    }

    const canvas = getLive2DCanvas();
    if (!canvas) {
      console.error('❌ No Live2D canvas found for streaming');
      return null;
    }

    if (!currentModel) {
      console.warn('⚠️ No Live2D model loaded yet');
      return null;
    }

    const stream = createCanvasStream(canvas);
    if (stream) {
      streamRef.current = stream;
      isStreamingRef.current = true;
      
      // Notify OBS backend about the new stream
      if (window.api?.sendOBSCanvasStream) {
        try {
          await window.api.sendOBSCanvasStream(stream);
          console.log('✅ Canvas stream sent to OBS backend');
        } catch (error) {
          console.error('❌ Failed to send stream to OBS:', error);
        }
      }
      
      return stream;
    }

    return null;
  }, [getLive2DCanvas, currentModel, createCanvasStream]);

  /**
   * Stop streaming
   */
  const stopStreaming = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    isStreamingRef.current = false;
    console.log('🛑 Canvas streaming stopped');
  }, []);

  /**
   * Get the current stream URL for OBS Browser Source
   */
  const getStreamUrl = useCallback((): string | null => {
    if (!streamRef.current) return null;
    
    try {
      // Create a blob URL from the stream for browser source
      const streamUrl = URL.createObjectURL(streamRef.current);
      return streamUrl;
    } catch (error) {
      console.error('❌ Failed to create stream URL:', error);
      return null;
    }
  }, []);

  // Auto-start streaming when enabled and model is available
  useEffect(() => {
    if (options.enabled && currentModel && !isStreamingRef.current) {
      // Delay to ensure canvas is ready
      const timeout = setTimeout(() => {
        startStreaming();
      }, 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [options.enabled, currentModel, startStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    isStreaming: isStreamingRef.current,
    stream: streamRef.current,
    startStreaming,
    stopStreaming,
    getStreamUrl,
  };
};