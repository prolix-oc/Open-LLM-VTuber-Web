// src/renderer/src/hooks/utils/use-audio-task.ts
import { useCallback } from 'react';
import { audioTaskQueue } from '@/utils/task-queue';

export interface AudioTask {
  id: string;
  url: string;
  displayText?: {
    text: string;
    name: string;
    avatar: string;
  };
  actions?: {
    expressions?: string[] | number[];
    pictures?: string[];
    sounds?: string[];
  };
  priority: 'low' | 'normal' | 'high' | 'critical';
  timestamp: number;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Simplified useAudioTask hook that integrates with the existing task queue system
 * This provides a compatibility layer while delegating actual audio processing
 * to the WebSocket handler's Live2D integration.
 */
export const useAudioTask = () => {
  
  // Add audio task to the existing queue system
  const addAudioTask = useCallback((
    url: string,
    displayText?: any,
    actions?: any,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ) => {
    console.log('useAudioTask: Adding task via existing queue system:', url);
    
    // Use the existing audio task queue
    audioTaskQueue.addTask(async () => {
      console.log('Processing audio task:', url);
      
      // The actual processing is now handled by the WebSocket handler
      // This is just a compatibility wrapper
      const audio = new Audio(url);
      audio.volume = 1.0;
      
      return new Promise((resolve, reject) => {
        audio.addEventListener('loadstart', () => {
          console.log('Audio loading started');
        });
        
        audio.addEventListener('canplay', () => {
          console.log('Audio can play');
        });
        
        audio.addEventListener('ended', () => {
          console.log('Audio playback ended');
          resolve();
        });
        
        audio.addEventListener('error', (error) => {
          console.error('Audio playback error:', error);
          reject(error);
        });
        
        audio.play().catch(reject);
      });
    });
  }, []);

  // Remove task (not implemented in simplified version)
  const removeTask = useCallback((taskId: string) => {
    console.log('useAudioTask: Remove task not implemented in simplified version');
    return false;
  }, []);

  // Clear queue
  const clearQueue = useCallback(() => {
    console.log('useAudioTask: Clearing audio queue');
    audioTaskQueue.clearQueue();
  }, []);

  // Get queue status
  const getQueueStatus = useCallback(() => {
    return {
      isProcessing: audioTaskQueue.hasTask(),
      currentTask: null,
      queueLength: 0, // Not available in current task queue implementation
      completedTasks: 0,
      failedTasks: 0,
      totalTasks: 0,
      processingCount: audioTaskQueue.hasTask() ? 1 : 0,
      queue: [],
    };
  }, []);

  return {
    // Main functions
    addAudioTask,
    removeTask,
    clearQueue,
    
    // Utility functions
    getQueueStatus,
    
    // State (simplified)
    isProcessing: audioTaskQueue.hasTask(),
    currentTask: null,
    queueLength: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalTasks: 0,
    processingCount: audioTaskQueue.hasTask() ? 1 : 0,
  };
};

export default useAudioTask;