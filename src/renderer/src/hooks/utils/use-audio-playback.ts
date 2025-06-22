// src/renderer/src/hooks/utils/use-audio-playback.ts
import { useCallback, useState, useEffect } from 'react';
import type { DisplayText } from '@/services/websocket-service';

interface AudioPlaybackState {
  isPlaying: boolean;
  isAnalyzing: boolean;
  currentVolume: number;
  error: string | null;
  currentAudioUrl: string | null;
  playbackProgress: number; // 0-1
  duration: number; // in seconds
}

interface AudioPlaybackOptions {
  enableLipSync: boolean;
  volumeSliceLength: number; // Not used in simplified version
  smoothingFactor: number; // Not used in simplified version
  volumeThreshold: number; // Not used in simplified version
  onVolumeUpdate?: (volume: number) => void; // Not used in simplified version
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number, currentTime: number, duration: number) => void;
  enableAutoResume?: boolean;
}

/**
 * Simplified Audio Playback Hook
 * 
 * This is a compatibility layer that maintains the same interface as the original
 * useAudioPlayback hook, but delegates actual audio processing to the Live2D
 * model's built-in speak() method.
 * 
 * This hook is now primarily used for state management and compatibility.
 * The actual audio playback and lip sync is handled by the StreamlinedAudioHandler.
 */
export const useAudioPlayback = (options: AudioPlaybackOptions = { 
  enableLipSync: true, 
  volumeSliceLength: 100,
  smoothingFactor: 0.3,
  volumeThreshold: 0.1,
  enableAutoResume: true,
}) => {
  
  const [state, setState] = useState<AudioPlaybackState>({
    isPlaying: false,
    isAnalyzing: false,
    currentVolume: 0,
    error: null,
    currentAudioUrl: null,
    playbackProgress: 0,
    duration: 0,
  });

  // Migration notice
  useEffect(() => {
    console.log('🔄 useAudioPlayback: Using compatibility mode - actual playback handled by Live2D');
    console.log('ℹ️  Volume analysis and manual lip sync parameters are no longer needed');
  }, []);

  // Simplified audio playback that delegates to the streamlined handler
  const playAudioFromUrl = useCallback(async (audioUrl: string, displayText?: DisplayText): Promise<void> => {
    try {
      setState(prev => ({ 
        ...prev, 
        isAnalyzing: false,
        error: null, 
        currentAudioUrl: audioUrl,
      }));

      console.log('useAudioPlayback: Delegating to StreamlinedAudioHandler:', audioUrl);
      
      // Check if streamlined audio handler is available
      const handler = (window as any).streamlinedAudioHandler;
      if (handler && handler.addAudioTask) {
        // Notify start
        options.onPlaybackStart?.();
        
        setState(prev => ({ ...prev, isPlaying: true }));
        
        // Delegate to streamlined handler
        handler.addAudioTask(
          audioUrl,
          displayText,
          undefined, // actions
          1.0 // volume
        );
        
        console.log('Audio task delegated to StreamlinedAudioHandler successfully');
        
        // Note: onPlaybackEnd will be handled by the StreamlinedAudioHandler
        // through its own callback system
        
      } else {
        throw new Error('StreamlinedAudioHandler not available');
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown audio error';
      console.error('useAudioPlayback: Failed to delegate audio playback:', errorMsg);
      
      setState(prev => ({ 
        ...prev, 
        error: errorMsg, 
        isPlaying: false, 
        isAnalyzing: false,
        currentAudioUrl: null,
      }));
      
      options.onError?.(errorMsg);
    }
  }, [options]);

  // Stop audio playback
  const stopAudio = useCallback(() => {
    console.log('useAudioPlayback: Stopping audio via StreamlinedAudioHandler');
    
    const handler = (window as any).streamlinedAudioHandler;
    if (handler && handler.stopCurrentAudio) {
      handler.stopCurrentAudio();
    }
    
    setState(prev => ({ 
      ...prev, 
      isPlaying: false, 
      currentVolume: 0, 
      playbackProgress: 0,
      currentAudioUrl: null,
      duration: 0,
    }));
  }, []);

  // Pause audio playback
  const pauseAudio = useCallback(() => {
    console.log('useAudioPlayback: Pause not implemented in simplified version - stopping instead');
    stopAudio();
  }, [stopAudio]);

  // Resume audio playback
  const resumeAudio = useCallback(async () => {
    console.log('useAudioPlayback: Resume not implemented in simplified version');
    options.onError?.('Resume functionality not available in simplified audio playback');
  }, [options]);

  // Seek to specific time
  const seekTo = useCallback((timeInSeconds: number) => {
    console.log('useAudioPlayback: Seek not implemented in simplified version');
    options.onError?.('Seek functionality not available in simplified audio playback');
  }, [options]);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    console.log('useAudioPlayback: Volume control not implemented in simplified version');
    // Note: Volume is handled by the Live2D speak() method options
  }, []);

  // Clear analysis cache (no-op in simplified version)
  const clearCache = useCallback(() => {
    console.log('useAudioPlayback: Cache clearing not needed in simplified version');
  }, []);

  // Get current state
  const getCurrentState = useCallback(() => state, [state]);

  // Get audio context state (no-op in simplified version)
  const getAudioContextState = useCallback(() => {
    return {
      state: 'running',
      sampleRate: 44100,
      currentTime: 0,
      baseLatency: 0,
    };
  }, []);

  // Monitor streamlined handler state
  useEffect(() => {
    const interval = setInterval(() => {
      const handler = (window as any).streamlinedAudioHandler;
      if (handler) {
        // Sync state with streamlined handler
        setState(prev => ({
          ...prev,
          isPlaying: handler.isPlaying || false,
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    // Main functions
    playAudioFromUrl,
    stopAudio,
    pauseAudio,
    resumeAudio,
    seekTo,
    setVolume,
    
    // Utility functions
    getCurrentState,
    getAudioContextState,
    clearCache,
    
    // State
    ...state,
  };
};

export default useAudioPlayback;